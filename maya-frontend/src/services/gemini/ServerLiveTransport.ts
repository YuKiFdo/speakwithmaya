import { getLogTimestamp } from '@/utils/time';
import type {
  ILiveTransport,
  LiveTransportCallbacks,
  LiveTransportConfig,
} from './LiveTransport';

export class ServerLiveTransport implements ILiveTransport {
  private ws: WebSocket | null = null;
  private callbacks: LiveTransportCallbacks = {};
  private config: LiveTransportConfig = {};
  private isOpen: boolean = false;
  private backendWsUrl: string;
  private userTranscriptAccumulator: string = '';
  private modelTranscriptAccumulator: string = '';
  private hasModelSpokenThisTurn: boolean = false;

  constructor(backendWsUrl?: string) {
    if (backendWsUrl) {
      this.backendWsUrl = backendWsUrl;
    } else {
      const httpBase = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
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

      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport] Connecting to NestJS Gateway: ${targetWsUrl}`);
      this.ws = new WebSocket(targetWsUrl);
      this.ws.binaryType = 'arraybuffer';

      this.ws.onopen = () => {
        console.log(`[${getLogTimestamp()}] ✅ [ServerLiveTransport] WebSocket connected to NestJS Backend`);
        this.isOpen = true;

        // Start Gemini session on backend
        this.ws?.send(
          JSON.stringify({
            type: 'start_session',
            options: config.sessionOptions || {
              languageMode: config.languageMode,
              sinhalaStyle: config.sinhalaStyle,
            },
          }),
        );

        this.callbacks.onOpen?.();
      };

      this.ws.onmessage = (event) => {
        if (typeof event.data === 'string') {
          try {
            const msg = JSON.parse(event.data);
            this.handleServerMessage(msg);
          } catch (e: any) {
            console.error('[ServerLiveTransport] Parse error:', e);
          }
        }
      };

      this.ws.onerror = (evt: any) => {
        console.error('[ServerLiveTransport] Socket error:', evt);
        this.callbacks.onError?.(new Error('ServerLiveTransport socket error'));
      };

      this.ws.onclose = (evt: CloseEvent) => {
        console.log(`[ServerLiveTransport] Socket closed (code: ${evt.code})`);
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
      // Send raw binary PCM audio buffer directly to NestJS gateway
      this.ws.send(pcm16);
    } catch (err: any) {
      console.error('[ServerLiveTransport] Send audio error:', err);
    }
  }

  sendEndOfTurn(): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport] User speech ended — signaling turn_complete to server`);
      this.ws.send(
        JSON.stringify({
          type: 'turn_complete',
        }),
      );
    } catch (err: any) {
      console.error('[ServerLiveTransport] Send end-of-turn error:', err);
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
  }

  isConnected(): boolean {
    return this.isOpen && this.ws?.readyState === WebSocket.OPEN;
  }

  private handleServerMessage(msg: any): void {
    switch (msg.type) {
      case 'ready':
        console.log(`[${getLogTimestamp()}] 🤖 [ServerLiveTransport] Gemini session ready via Backend (Model: ${msg.model})`);
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
          console.log(`[${getLogTimestamp()}] 📝 [ServerLiveTransport] Student Said: "${msg.text}"`);
          this.callbacks.onInputTranscript?.(msg.text);
        }
        break;

      case 'turn_complete': {
        const studentSaid = this.userTranscriptAccumulator.trim();
        const modelReplied = this.modelTranscriptAccumulator.trim();

        if (this.hasModelSpokenThisTurn || modelReplied) {
          console.log(
            `[${getLogTimestamp()}] ✅ [ServerLiveTransport] Turn Complete\n` +
            `   🗣️ Student: "${studentSaid || '(untranscribed speech)'}"\n` +
            `   💬 Maya: "${modelReplied || '(audio stream)'}"`
          );
          this.userTranscriptAccumulator = '';
          this.modelTranscriptAccumulator = '';
          this.hasModelSpokenThisTurn = false;
        } else {
          console.log(
            `[${getLogTimestamp()}] ⏳ [ServerLiveTransport] Turn handshake complete: Student speech queued ("${studentSaid || 'audio streaming'}"). Waiting for Maya response...`
          );
        }

        this.callbacks.onTurnComplete?.();
        break;
      }

      case 'interrupted':
        console.log(`[${getLogTimestamp()}] ⚡ [ServerLiveTransport] Interrupted by student voice`);
        this.modelTranscriptAccumulator = '';
        this.hasModelSpokenThisTurn = false;
        this.callbacks.onInterrupted?.();
        break;

      case 'tool_call':
        if (msg.name === 'show_grammar_correction') {
          this.callbacks.onGrammarCorrection?.(msg.args);
        } else if (msg.name === 'show_rephrase_suggestion') {
          this.callbacks.onRephraseSuggestion?.(msg.args);
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
        this.callbacks.onError?.(new Error(msg.message || 'Server error'));
        break;

      case 'closed':
        this.callbacks.onClose?.(1000, msg.reason || 'Server closed');
        break;
    }
  }
}
