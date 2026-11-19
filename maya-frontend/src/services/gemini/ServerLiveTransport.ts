import { Buffer } from 'buffer';
import { getLogTimestamp } from '@/utils/time';
import { OnboardingStore } from '@/services/store/onboarding-store';
import { getBackendWsUrl } from '@/utils/backend-url';
import type {
  ILiveTransport,
  LiveTransportCallbacks,
  LiveTransportConfig,
} from './LiveTransport';

// Ensure Buffer is globally accessible for third-party libraries (like opusscript) in browser environments
if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
  (globalThis as any).Buffer = Buffer;
}
if (typeof window !== 'undefined' && !(window as any).Buffer) {
  (window as any).Buffer = Buffer;
}

// Backpressure threshold for client audio upload: 64 KB
const CLIENT_BACKPRESSURE_THRESHOLD = 64 * 1024;

// Uplink Opus: 20ms frames of 16kHz mono PCM, ~32 kbps (vs 256 kbps raw PCM). Wire format understood by
// the gateway: 'OPU1' magic, then repeated [u16BE length][packet].
const UPLINK_SAMPLE_RATE = 16000;
const UPLINK_FRAME_SAMPLES = 320;
const UPLINK_BITRATE = 32000;
const UPLINK_OPUS_MAGIC = [0x4f, 0x50, 0x55, 0x31]; // 'OPU1'

// Replay: keep the learner's speech that Maya hasn't answered yet (up to 15s) and resend it on a fresh
// connection, so words spoken during a drop (or into a dead socket before it was detected) aren't lost.
const REPLAY_MAX_BYTES = UPLINK_SAMPLE_RATE * 2 * 15;

type ReplayItem = { kind: 'audio'; pcm: ArrayBuffer; sentGen: number } | { kind: 'end'; sentGen: number };

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
  private lastPongAt: number = Date.now();
  private recentRtts: number[] = [];
  private offlineHandler: (() => void) | null = null;
  private backpressureWarningCount: number = 0;
  private opusDecoder: any = null;
  private pingInterval: any = null;
  private inboundAudioChunksCount: number = 0;
  private opusEncoder: any = null;
  /** True once the current connection's 'ready' confirmed the server can decode uplink Opus. */
  private uplinkOpus: boolean = false;
  private encodeRemainder: Int16Array = new Int16Array(0);
  /** Incremented per connect(); readyGen is the generation whose 'ready' has arrived. */
  private connectionGen: number = 0;
  private readyGen: number = -1;
  private replayLog: ReplayItem[] = [];
  private replayAudioBytes: number = 0;

  constructor(backendWsUrl?: string) {
    this.backendWsUrl = backendWsUrl ?? getBackendWsUrl('/live-session');
  }

  connect(
    config: LiveTransportConfig & { sessionOptions?: any },
    callbacks: LiveTransportCallbacks,
  ): void {
    this.config = config;
    this.callbacks = callbacks;
    this.inboundAudioChunksCount = 0;
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

    // Fresh uplink encoder per connection (the server creates a fresh decoder per socket)
    this.connectionGen++;
    this.uplinkOpus = false;
    this.encodeRemainder = new Int16Array(0);
    if (this.opusEncoder) {
      try {
        this.opusEncoder.delete?.();
      } catch {}
    }
    try {
      const OpusScript = require('opusscript');
      this.opusEncoder = new OpusScript(UPLINK_SAMPLE_RATE, 1, OpusScript.Application.VOIP, { wasm: false });
      this.opusEncoder.setBitrate(UPLINK_BITRATE);
    } catch (e: any) {
      console.warn(`[${getLogTimestamp()}] ⚠️ [ServerLiveTransport:${this.clientSessionId}] Opus encoder unavailable, mic stays raw PCM:`, e?.message);
      this.opusEncoder = null;
    }

    try {
      // Ensure any previous socket or ping timer from an earlier connect attempt is cleanly closed first
      if (this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close(1000, 'Reconnecting session');
        } catch {}
        this.ws = null;
      }

      let targetWsUrl = this.backendWsUrl;

      // If backend gave an explicit wsUrl or if on web, dynamically match window location or configured backend
      if (typeof window !== 'undefined' && window.location) {
        const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        if (window.location.hostname.endsWith('speakwithmaya.com')) {
          targetWsUrl = 'wss://api.speakwithmaya.com/live-session';
        } else if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
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

        // Start Gemini session on backend with Opus capability flag and authenticated token
        this.ws?.send(
          JSON.stringify({
            type: 'start_session',
            sessionId: config.sessionOptions?.sessionId || this.clientSessionId,
            accessToken: OnboardingStore.getState().accessToken || config.token || undefined,
            supportsOpus: !!this.opusDecoder,
            supportsOpusBatch: !!this.opusDecoder,
            supportsUplinkOpus: !!this.opusEncoder,
            options: config.sessionOptions || {
              languageMode: config.languageMode,
              sinhalaStyle: config.sinhalaStyle,
            },
          }),
        );

        this.lastPongAt = Date.now();
        this.callbacks.onOpen?.();

        // Browser offline event listener for immediate disconnect detection on web
        if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
          if (this.offlineHandler) {
            window.removeEventListener('offline', this.offlineHandler);
          }
          this.offlineHandler = () => {
            console.warn(`[${getLogTimestamp()}] 🔌 [ServerLiveTransport:${this.clientSessionId}] Browser offline event detected - closing socket`);
            if (this.isOpen && this.ws) {
              try {
                // Note: Browser WebSocket.close() only allows code 1000 or 3000-4999 (1006 throws InvalidAccessError)
                this.ws.close(4006, 'Network offline');
              } catch {}
              this.isOpen = false;
              this.callbacks.onClose?.(1006, 'Network offline');
            }
          };
          window.addEventListener('offline', this.offlineHandler);
        }

        // Active heartbeat probing every 3 seconds to measure RTT and guard against silent socket drop
        if (this.pingInterval) clearInterval(this.pingInterval);
        this.pingInterval = setInterval(() => {
          if (this.isOpen && this.ws?.readyState === WebSocket.OPEN) {
            // If no pong or message received for > 9000ms (3 ping cycles), socket is dead (e.g. Wi-Fi turned off).
            // Was 15s: on flaky mobile data that left the learner talking into a dead socket for too long.
            const timeSinceLastPong = Date.now() - this.lastPongAt;
            if (timeSinceLastPong > 9000) {
              console.warn(
                `[${getLogTimestamp()}] ⚠️ [ServerLiveTransport:${this.clientSessionId}] Heartbeat timeout (${timeSinceLastPong}ms without response) -> forcing reconnect`,
              );
              if (this.pingInterval) {
                clearInterval(this.pingInterval);
                this.pingInterval = null;
              }
              try {
                // Use valid custom close code 4008 so browser actually closes the TCP/WS connection
                this.ws.close(4008, 'Heartbeat timeout');
              } catch {}
              this.isOpen = false;
              this.callbacks.onClose?.(1006, 'Heartbeat timeout');
              return;
            }

            try {
              this.ws.send(JSON.stringify({ type: 'client_ping', ts: Date.now() }));
            } catch {}
          }
        }, 3000);
      };

      this.ws.onmessage = (event) => {
        this.lastPongAt = Date.now();
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

  /** Audio may only go out once this connection's Gemini session is ready (the server drops it before). */
  private canSendAudioNow(): boolean {
    return this.isOpen && !!this.ws && this.ws.readyState === WebSocket.OPEN && this.readyGen === this.connectionGen;
  }

  sendAudioChunk(pcm16: ArrayBuffer): void {
    if (!pcm16 || pcm16.byteLength === 0) return;
    const item: ReplayItem = { kind: 'audio', pcm: pcm16.slice(0), sentGen: -1 };
    this.replayLog.push(item);
    this.replayAudioBytes += pcm16.byteLength;
    this.trimReplayLog();
    if (this.canSendAudioNow()) {
      this.transmitAudio(pcm16);
      item.sentGen = this.connectionGen;
    }
  }

  sendEndOfTurn(): void {
    // Only meaningful if there is unanswered speech after the last end marker
    const last = this.replayLog[this.replayLog.length - 1];
    if (!last || last.kind !== 'audio') return;
    const item: ReplayItem = { kind: 'end', sentGen: -1 };
    this.replayLog.push(item);
    if (this.canSendAudioNow()) {
      this.transmitEndOfTurn();
      item.sentGen = this.connectionGen;
    } else {
      console.log(`[${getLogTimestamp()}] 📦 [ServerLiveTransport:${this.clientSessionId}] Turn ended while offline - will resend after reconnect`);
    }
  }

  private trimReplayLog(): void {
    while (this.replayAudioBytes > REPLAY_MAX_BYTES && this.replayLog.length > 0) {
      const dropped = this.replayLog.shift()!;
      if (dropped.kind === 'audio') this.replayAudioBytes -= dropped.pcm.byteLength;
    }
  }

  /** Maya started answering: everything up to the last completed user turn has been received. */
  private acknowledgeUserTurns(): void {
    let lastEnd = -1;
    for (let i = this.replayLog.length - 1; i >= 0; i--) {
      if (this.replayLog[i].kind === 'end') {
        lastEnd = i;
        break;
      }
    }
    if (lastEnd < 0) return;
    const removed = this.replayLog.splice(0, lastEnd + 1);
    for (const r of removed) {
      if (r.kind === 'audio') this.replayAudioBytes -= r.pcm.byteLength;
    }
  }

  /** Send everything this connection hasn't received yet (buffered while offline, or lost with the old socket). */
  private flushReplayLog(): void {
    let audioMs = 0;
    let turns = 0;
    for (const item of this.replayLog) {
      if (item.sentGen === this.connectionGen) continue;
      if (item.kind === 'audio') {
        this.transmitAudio(item.pcm);
        audioMs += (item.pcm.byteLength / 2 / UPLINK_SAMPLE_RATE) * 1000;
      } else {
        this.transmitEndOfTurn();
        turns++;
      }
      item.sentGen = this.connectionGen;
    }
    if (audioMs > 0 || turns > 0) {
      console.log(
        `[${getLogTimestamp()}] 🔁 [ServerLiveTransport:${this.clientSessionId}] Replayed ${Math.round(audioMs)}ms of unanswered speech (${turns} completed turn(s)) on the new connection`,
      );
    }
  }

  private transmitEndOfTurn(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.flushEncoder();
    try {
      console.log(`[${getLogTimestamp()}] 🚀 [ServerLiveTransport:${this.clientSessionId}] User speech ended - signaling turn_complete to server`);
      this.ws.send(JSON.stringify({ type: 'turn_complete' }));
    } catch (err: any) {
      console.error(`[ServerLiveTransport:${this.clientSessionId}] Send end-of-turn error:`, err);
    }
  }

  /** Encode whole 20ms frames to Opus; carries the leftover samples to the next chunk. */
  private encodeOpusFrames(samples: Int16Array): Uint8Array[] {
    const merged = new Int16Array(this.encodeRemainder.length + samples.length);
    merged.set(this.encodeRemainder, 0);
    merged.set(samples, this.encodeRemainder.length);
    const packets: Uint8Array[] = [];
    let offset = 0;
    while (offset + UPLINK_FRAME_SAMPLES <= merged.length) {
      const frame = Buffer.from(merged.buffer, merged.byteOffset + offset * 2, UPLINK_FRAME_SAMPLES * 2);
      const packet = this.opusEncoder.encode(frame, UPLINK_FRAME_SAMPLES);
      packets.push(new Uint8Array(packet.buffer, packet.byteOffset, packet.length).slice());
      offset += UPLINK_FRAME_SAMPLES;
    }
    this.encodeRemainder = merged.slice(offset);
    return packets;
  }

  private sendOpusPackets(packets: Uint8Array[]): void {
    if (packets.length === 0 || !this.ws) return;
    let total = UPLINK_OPUS_MAGIC.length;
    for (const p of packets) total += 2 + p.length;
    const out = new Uint8Array(total);
    out.set(UPLINK_OPUS_MAGIC, 0);
    let pos = UPLINK_OPUS_MAGIC.length;
    for (const p of packets) {
      out[pos] = (p.length >> 8) & 0xff;
      out[pos + 1] = p.length & 0xff;
      out.set(p, pos + 2);
      pos += 2 + p.length;
    }
    this.ws.send(out.buffer);
  }

  /** Pad and send the last partial frame so the end of the learner's sentence isn't clipped. */
  private flushEncoder(): void {
    if (!this.uplinkOpus || !this.opusEncoder || this.encodeRemainder.length === 0) return;
    try {
      const padded = new Int16Array(UPLINK_FRAME_SAMPLES - this.encodeRemainder.length);
      this.sendOpusPackets(this.encodeOpusFrames(padded));
    } catch {}
    this.encodeRemainder = new Int16Array(0);
  }

  private transmitAudio(pcm16: ArrayBuffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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

      if (this.uplinkOpus && this.opusEncoder) {
        try {
          this.sendOpusPackets(this.encodeOpusFrames(new Int16Array(pcm16)));
          return;
        } catch (encErr: any) {
          // Encoder failure: fall back to raw PCM for the rest of this connection
          console.warn(`[ServerLiveTransport:${this.clientSessionId}] Opus encode failed, falling back to PCM:`, encErr?.message);
          this.uplinkOpus = false;
          this.encodeRemainder = new Int16Array(0);
        }
      }
      // Send raw binary PCM audio buffer directly to NestJS gateway
      this.ws.send(pcm16);
    } catch (err: any) {
      console.error(`[ServerLiveTransport:${this.clientSessionId}] Send audio error:`, err);
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

  sendCurriculumPacingCue(nextObjectiveId?: string, nextObjectiveTitle?: string): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      console.log(`[${getLogTimestamp()}] 🎯 [ServerLiveTransport] Sending curriculum pacing cue for "${nextObjectiveTitle}" (${nextObjectiveId})`);
      this.ws.send(
        JSON.stringify({
          type: 'curriculum_pacing_cue',
          nextObjectiveId: nextObjectiveId || '',
          nextObjectiveTitle: nextObjectiveTitle || '',
        }),
      );
    } catch (e) {
      // ignore
    }
  }

  sendSessionMeta(meta: any): void {
    if (!this.isOpen || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    try {
      this.ws.send(JSON.stringify({ type: 'session_meta', ...meta }));
    } catch (e) {}
  }

  close(reason?: string): void {
    this.isOpen = false;
    this.readyGen = -1;
    // Keep unanswered speech across an internal reconnect; a real end of call discards it
    if (reason !== 'client_reconnecting') {
      this.replayLog = [];
      this.replayAudioBytes = 0;
    }
    if (this.opusEncoder) {
      try {
        this.opusEncoder.delete?.();
      } catch {}
      this.opusEncoder = null;
    }
    if (this.ws) {
      try {
        const closeReason = reason ? String(reason).slice(0, 120) : 'User closed session';
        this.ws.close(1000, closeReason);
      } catch (e) {
        // ignore
      }
      this.ws = null;
    }
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.offlineHandler && typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('offline', this.offlineHandler);
      this.offlineHandler = null;
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
        this.readyGen = this.connectionGen;
        this.uplinkOpus = !!msg.uplinkOpus && !!this.opusEncoder;
        this.encodeRemainder = new Int16Array(0);
        console.log(
          `[${getLogTimestamp()}] 🤖 [ServerLiveTransport:${this.clientSessionId}] Gemini session ready via Backend (Model: ${msg.model}, mic: ${this.uplinkOpus ? 'Opus 32kbps' : 'PCM'})`,
        );
        this.flushReplayLog();
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
        this.lastPongAt = Date.now();
        if (typeof msg.ts === 'number') {
          // Median of the last 3 RTTs: one slow ping (e.g. a brief server stall) must not
          // flip the call into "poor" for the next ~10s.
          this.recentRtts.push(Math.max(0, Date.now() - msg.ts));
          if (this.recentRtts.length > 3) this.recentRtts.shift();
          const rtt = [...this.recentRtts].sort((a, b) => a - b)[Math.floor(this.recentRtts.length / 2)];
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

      case 'turn_handshake':
        console.log(`[${getLogTimestamp()}] ⏳ [ServerLiveTransport:${this.clientSessionId}] Turn handshake received from server`);
        break;

      case 'audio_opus': {
        // Server sends either one packet ({ data }) or, when we advertised supportsOpusBatch,
        // several consecutive 20ms packets ({ packets: [...] }) to cut per-message overhead.
        const packets: string[] = Array.isArray(msg.packets) ? msg.packets : msg.data ? [msg.data] : [];
        if (packets.length > 0 && this.opusDecoder) {
          this.hasModelSpokenThisTurn = true;
          this.acknowledgeUserTurns();
          for (const packet of packets) {
            this.inboundAudioChunksCount++;
            if (this.inboundAudioChunksCount <= 3 || this.inboundAudioChunksCount % 15 === 0) {
              console.log(`[${getLogTimestamp()}] 🔊 [ServerLiveTransport:${this.clientSessionId}] Received audio_opus packet #${this.inboundAudioChunksCount} (${packet.length} chars)`);
            }
            try {
              const binaryString = atob(packet);
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
        }
        break;
      }

      case 'audio':
        if (msg.data) {
          this.hasModelSpokenThisTurn = true;
          this.acknowledgeUserTurns();
          this.inboundAudioChunksCount++;
          if (this.inboundAudioChunksCount <= 3 || this.inboundAudioChunksCount % 15 === 0) {
            console.log(`[${getLogTimestamp()}] 🔊 [ServerLiveTransport:${this.clientSessionId}] Received raw audio chunk #${this.inboundAudioChunksCount} (${msg.data.length} chars)`);
          }
          this.callbacks.onAudioChunk?.(msg.data);
        }
        break;

      case 'output_transcript':
        if (msg.text) {
          this.hasModelSpokenThisTurn = true;
          this.acknowledgeUserTurns();
          this.modelTranscriptAccumulator += msg.text;
          console.log(`[${getLogTimestamp()}] 💬 [ServerLiveTransport:${this.clientSessionId}] Output transcript chunk: "${msg.text}"`);
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

        this.callbacks.onTurnComplete?.({
          userText: msg.userText || studentSaid || undefined,
          modelText: msg.modelText || modelReplied || undefined,
        });
        break;
      }

      case 'interrupted':
        console.log(`[${getLogTimestamp()}] ⚡ [ServerLiveTransport:${this.clientSessionId}] Interrupted by student voice`);
        this.modelTranscriptAccumulator = '';
        this.hasModelSpokenThisTurn = false;
        this.callbacks.onInterrupted?.();
        break;

      case 'practice_task_update':
        this.callbacks.onPracticeTaskUpdate?.({
          pointIndex: Number(msg.pointIndex) || 0,
          phase: msg.phase === 'testing' ? 'testing' : 'teaching',
          pointTitle: String(msg.pointTitle || ''),
          guidanceOrScenario: String(msg.guidanceOrScenario || ''),
        });
        break;

      case 'test_score_update':
        this.callbacks.onTestScoreRecorded?.({
          pointIndex: Number(msg.pointIndex) || 0,
          passed: Boolean(msg.passed),
          note: String(msg.note || ''),
        });
        break;

      case 'level_evaluation_completed':
        this.callbacks.onLevelEvaluationCompleted?.({
          isPassed: Boolean(msg.isPassed),
          scorePercent: Number(msg.scorePercent) || 0,
          feedbackSinhala: String(msg.feedbackSinhala || ''),
          feedbackEnglish: String(msg.feedbackEnglish || ''),
        });
        break;

      case 'tool_call':
        if (msg.name === 'show_grammar_correction') {
          this.callbacks.onGrammarCorrection?.(msg.args);
        } else if (msg.name === 'show_rephrase_suggestion') {
          this.callbacks.onRephraseSuggestion?.(msg.args);
        } else if (msg.name === 'set_active_practice_task') {
          this.callbacks.onPracticeTaskUpdate?.({
            pointIndex: Number(msg.args?.pointIndex) || 0,
            phase: msg.args?.phase === 'testing' ? 'testing' : 'teaching',
            pointTitle: String(msg.args?.taskTitle || msg.args?.pointTitle || ''),
            guidanceOrScenario: String(msg.args?.hint || msg.args?.guidanceOrScenario || ''),
          });
        } else if (msg.name === 'record_test_score') {
          this.callbacks.onTestScoreRecorded?.({
            pointIndex: Number(msg.args?.pointIndex) || 0,
            passed: Boolean(msg.args?.passed),
            note: String(msg.args?.note || ''),
          });
        } else if (msg.name === 'conclude_level_evaluation') {
          this.callbacks.onLevelEvaluationCompleted?.({
            isPassed: Boolean(msg.args?.isPassed),
            scorePercent: Number(msg.args?.scorePercent) || 0,
            feedbackSinhala: String(msg.args?.feedbackSinhala || ''),
            feedbackEnglish: String(msg.args?.feedbackEnglish || ''),
          });
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
