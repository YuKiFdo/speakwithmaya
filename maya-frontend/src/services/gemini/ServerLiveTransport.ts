import { getLogTimestamp } from '@/utils/time';
import type {
  ILiveTransport,
  LiveTransportCallbacks,
  LiveTransportConfig,
} from './LiveTransport';

// Backpressure threshold for client audio upload: 64 KB
const CLIENT_BACKPRESSURE_THRESHOLD = 64 * 1024;

export class ServerLiveTransport implements ILiveTransport {
  private ws: WebSocket | null = null;
  private callbacks: LiveTransportCallbacks = {};
  private config: LiveTransportConfig = {};
  private isOpen: boolean = false;
  private backendWsUrl: string;
  private userTranscriptAccumulator: string = '';
  private modelTranscriptAccumulator: string = '';
  private hasModelSpokenThisTurn: boolean = false;
  private clientSessionId: string = '';
  private lastPingAt: number = 0;
  private backpressureWarningCount: number = 0;
  private opusDecoder: any = null;
  private pingInterval: any = null;

  constructor(backendWsUrl?: string) {
    if (backendWsUrl) {
      this.backendWsUrl = backendWsUrl;
    } else {
      const httpBase = process.env.EXPO_PUBLIC_BACKEND_URL || process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
      const wsProto = httpBase.startsWith('https') ? 'wss' : 'ws';
      const host = httpBase.replace(/^https?:\/\//, '').replace(/\/$/, '');
      this.backendWsUrl = `${wsProto}://${host}/live-session`;
    }
  }

  connect(
    config: LiveTransportConfig & { sessionOptions?: any },
    callbacks: LiveTransportCallbacks,
  ): void {
    this.config = config;
    this.callbacks = callbacks;
    this.clientSessionId = `client-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    // Initialize Opus decoder (VOIP mode, 24kHz, mono) for low-bandwidth 3G streaming
    try {
      const OpusScript = require('opusscript');
      this.opusDecoder = new OpusScript(24000, 1, OpusScript.Application.VOIP, { wasm: false });
      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport:${this.clientSessionId}] Opus decoder initialized (93% bandwidth compression)`);
    } catch (e: any) {
      console.warn(`[${getLogTimestamp()}] ⚠️ [ServerLiveTransport:${this.clientSessionId}] Opus decoder unavailable, using raw PCM fallback:`, e?.message);
      this.opusDecoder = null;
    }

    try {
      let targetWsUrl = this.backendWsUrl;

      // If backend gave an explicit wsUrl or if on web, dynamically match window location or configured backend
      if (typeof window !== 'undefined' && window.location) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
          // If on a public domain or local network IP, connect to backend at the same origin or configured API
          const host = process.env.EXPO_PUBLIC_BACKEND_URL 
            ? process.env.EXPO_PUBLIC_BACKEND_URL.replace(/^https?:\/\//, '').replace(/\/$/, '')
            : `${window.location.hostname}:3000`;
          targetWsUrl = `${proto}//${host}/live-session`;
        }
      }

      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport:${this.clientSessionId}] Connecting to NestJS Gateway: ${targetWsUrl}`);
      this.ws = new WebSocket(targetWsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log(`[${getLogTimestamp()}] ✅ [ServerLiveTransport:${this.clientSessionId}] WebSocket connected to NestJS Backend`);
        this.isOpen = true;

        // Start Gemini session on backend with Opus capability flag
        this.ws?.send(
          JSON.stringify({
            type: 'start_session',
            sessionId: config.sessionOptions?.sessionId || this.clientSessionId,
            supportsOpus: !!this.opusDecoder,
            options: config.sessionOptions || {
              languageMode: config.languageMode,
              sinhalaStyle: config.sinhalaStyle,
            },
          }),
        );

        this.callbacks.onOpen?.();

        // Start ping probing every 5 seconds to measure RTT and network quality
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.isOpen && this.ws?.readyState === WebSocket.OPEN) {
            try {
              this.ws.send(JSON.stringify({ type: 'client_ping', ts: Date.now() }));
            } catch {}
          }
        }, 5000);
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            // Heartbeat ping handling: respond immediately
            if (event.data === 'ping') {
              this.ws?.send('pong');
              return;
            }

            const msg = JSON.parse(event.data);
            if (msg.type === 'ping') {
              this.lastPingAt = Date.now();
              this.ws?.send('pong');
              return;
            }

            this.handleServerMessage(msg);
          } catch (e: any) {
            console.error(`[ServerLiveTransport:${this.clientSessionId}] Parse error:`, e);
          }
        }
      };

      this.ws.onerror = (evt: any) => {
        console.error(`[ServerLiveTransport:${this.clientSessionId}] Socket error:`, evt);
        this.callbacks.onError?.(new Error('ServerLiveTransport socket error'));
      };

      this.ws.onclose = (evt: CloseEvent) => {
        console.log(`[${getLogTimestamp()}] 🔌 [ServerLiveTransport:${this.clientSessionId}] Socket closed (code: ${evt.code}, reason: ${evt.reason || 'none'})`);
        this.isOpen = false;
        this.callbacks.onClose?.(evt.code, evt.reason);
      };
    } catch (err: any) {
      this.callbacks.onError?.(err);
    }
  }

  sendAudioChunk(pcm16: ArrayBuffer): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      // Backpressure check on outgoing mic audio: detect slow upload pipe
      const buffered = this.ws.bufferedAmount || 0;
      if (buffered > CLIENT_BACKPRESSURE_THRESHOLD) {
        this.backpressureWarningCount++;
        if (this.backpressureWarningCount % 20 === 1) {
          const kb = Math.round(buffered / 1024);
          console.warn(`[${getLogTimestamp()}] ⚠️ [ServerLiveTransport:${this.clientSessionId}] Upload backpressure: ${kb}KB audio queued in socket`);
          this.callbacks.onSlowConnection?.(kb);
        }
      }

      // Send raw binary PCM audio buffer directly to NestJS gateway
      this.ws.send(pcm16);
    } catch (err: any) {
      console.error(`[ServerLiveTransport:${this.clientSessionId}] Send audio error:`, err);
    }
  }

  sendEndOfTurn(): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport:${this.clientSessionId}] User speech ended — signaling turn_complete to server`);
      this.ws.send(
        JSON.stringify({
          type: 'turn_complete',
        }),
      );
    } catch (err: any) {
      console.error(`[ServerLiveTransport:${this.clientSessionId}] Send end-of-turn error:`, err);
    }
  }

  sendInterrupted(): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'interrupt',
        }),
      );
    } catch (e) {
      // ignore
    }
  }

  sendAudioStreamEnd(): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'audio_stream_end',
        }),
      );
    } catch (e) {
      // ignore
    }
  }

  sendTimeWrapupCue(remainingSeconds: number = 0): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(
        JSON.stringify({
          type: 'time_wrapup_cue',
          remainingSeconds,
        }),
      );
    } catch (e) {
      // ignore
    }
  }

  close(): void {
    this.isOpen = false;
    if (this.ws) {
      try {
        this.ws.close(1000, 'User closed session');
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.opusDecoder) {
      try {
        this.opusDecoder.delete?.();
      } catch {}
      this.opusDecoder = null;
    }
  }

  isConnected(): boolean {
    return this.isOpen && this.ws?.readyState === WebSocket.OPEN;
  }

  private handleServerMessage(msg: any): void {
    switch (msg.type) {
      case 'ready':
        console.log(`[${getLogTimestamp()}] 🤖 [ServerLiveTransport:${this.clientSessionId}] Gemini session ready via Backend (Model: ${msg.model})`);
        break;

      case 'latency':
        // Latency report from NestJS gateway
        if (typeof msg.turnLatencyMs === 'number') {
          console.log(`[${getLogTimestamp()}] ⏱️ [ServerLiveTransport:${this.clientSessionId}] Turn latency: ${msg.turnLatencyMs}ms (Avg: ${msg.avgLatencyMs}ms)`);
          this.callbacks.onLatencyUpdate?.(msg.turnLatencyMs, msg.avgLatencyMs);
        }
        break;

      case 'slow_connection':
        // Downlink backpressure warning from NestJS gateway
        console.warn(`[${getLogTimestamp()}] ⚠️ [ServerLiveTransport:${this.clientSessionId}] Server slow connection warning (${msg.bufferedKB}KB buffered)`);
        this.callbacks.onSlowConnection?.(msg.bufferedKB);
        break;

      case 'client_pong': {
        if (typeof msg.ts === 'number') {
          const rtt = Math.max(0, Date.now() - msg.ts);
          const buffered = this.ws?.bufferedAmount || 0;
          const quality: 'good' | 'fair' | 'poor' =
            rtt > 450 || buffered > 48000
              ? 'poor'
              : rtt > 220 || buffered > 16000
                ? 'fair'
                : 'good';

          this.callbacks.onNetworkQualityChange?.(quality, rtt);
        }
        break;
      }

      case 'audio_opus':
        if (msg.data && this.opusDecoder) {
          this.hasModelSpokenThisTurn = true;
          try {
            const binaryString = atob(msg.data);
            const len = binaryString.length;
            const opusBytes = new Uint8Array(len);
            for (let i = 0; i < len; i++) {
              opusBytes[i] = binaryString.charCodeAt(i);
            }
            const decodedPcm = this.opusDecoder.decode(opusBytes);
            const int16 = new Int16Array(decodedPcm.buffer, decodedPcm.byteOffset, decodedPcm.length / 2);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
              float32[i] = int16[i] < 0 ? int16[i] / 32768.0 : int16[i] / 32767.0;
            }
            this.callbacks.onAudioSamples?.(float32);
          } catch (err: any) {
            console.error(`[ServerLiveTransport:${this.clientSessionId}] Opus decode error:`, err);
          }
        }
        break;

      case 'audio':
        if (msg.data) {
          this.hasModelSpokenThisTurn = true;
          this.callbacks.onAudioChunk?.(msg.data);
        }
        break;

      case 'output_transcript':
        if (msg.text) {
          this.hasModelSpokenThisTurn = true;
          this.modelTranscriptAccumulator += msg.text;
          this.callbacks.onOutputTranscript?.(msg.text);
        }
        break;

      case 'input_transcript':
        if (msg.text) {
          this.userTranscriptAccumulator += msg.text;
          console.log(`[${getLogTimestamp()}] 📝 [ServerLiveTransport:${this.clientSessionId}] Student Said: "${msg.text}"`);
          this.callbacks.onInputTranscript?.(msg.text);
        }
        break;

      case 'turn_complete': {
        const studentSaid = this.userTranscriptAccumulator.trim();
        const modelReplied = this.modelTranscriptAccumulator.trim();

        if (this.hasModelSpokenThisTurn || modelReplied) {
          console.log(
            `[${getLogTimestamp()}] ✅ [ServerLiveTransport:${this.clientSessionId}] Turn Complete\n` +
            `   🗣️ Student: "${studentSaid || '(untranscribed speech)'}"\n` +
            `   💬 Maya: "${modelReplied || '(audio stream)'}"`
          );
          this.userTranscriptAccumulator = '';
          this.modelTranscriptAccumulator = '';
          this.hasModelSpokenThisTurn = false;
        } else {
          console.log(
            `[${getLogTimestamp()}] ⏳ [ServerLiveTransport:${this.clientSessionId}] Turn handshake complete: Student speech queued ("${studentSaid || 'audio streaming'}"). Waiting for Maya response...`
          );
        }

        this.callbacks.onTurnComplete?.();
        break;
      }

      case 'interrupted':
        console.log(`[${getLogTimestamp()}] ⚡ [ServerLiveTransport:${this.clientSessionId}] Interrupted by student voice`);
        this.modelTranscriptAccumulator = '';
        this.hasModelSpokenThisTurn = false;
        this.callbacks.onInterrupted?.();
        break;

      case 'tool_call':
        if (msg.name === 'show_grammar_correction') {
          this.callbacks.onGrammarCorrection?.(msg.args);
        } else if (msg.name === 'show_rephrase_suggestion') {
          this.callbacks.onRephraseSuggestion?.(msg.args);
        } else if (msg.name === 'record_objective') {
          console.log(`[${getLogTimestamp()}] 🎯 [ServerLiveTransport:${this.clientSessionId}] Objective recorded:`, msg.args);
          this.callbacks.onObjectiveRecorded?.(msg.args);
        } else if (msg.name === 'conclude_call') {
          this.callbacks.onConcludeCall?.(msg.args?.farewellReason || 'Call completed');
        }
        break;

      case 'usage':
        if (msg.usage) {
          this.callbacks.onUsageUpdate?.(msg.usage);
        }
        break;

      case 'error':
        console.error(`[${getLogTimestamp()}] ❌ [ServerLiveTransport:${this.clientSessionId}] Server error: ${msg.message}`);
        this.callbacks.onError?.(new Error(msg.message || 'Server error'));
        break;

      case 'closed':
        this.callbacks.onClose?.(1000, msg.reason || 'Server closed');
        break;
    }
  }
}
