import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { WebSocket, RawData } from 'ws';
import { GoogleGenAI, Modality, ActivityHandling } from '@google/genai';
import { SessionsService } from '../sessions/sessions.service.js';
import { CreateSessionTokenDto } from '../sessions/dto/session.dto.js';

let OpusScriptClass: any = null;
import('opusscript')
  .then((mod) => {
    OpusScriptClass = mod.default || mod;
  })
  .catch(() => {});

interface ClientSessionState {
  ws: WebSocket;
  geminiSession?: any;
  dto?: CreateSessionTokenDto;
  sessionId: string;
  isConnectedToGemini: boolean;
  supportsOpus: boolean;
  opusEncoder?: any;
  opusPcmBuffer: Buffer;
  userSpeechActive: boolean;
  hasDispatchedGreeting: boolean;
  userTranscriptAccumulator: string;
  modelTranscriptAccumulator: string;
  lastStudentTranscript: string;
  hasModelSpokenThisTurn: boolean;
  totalTextInTokens: number;
  totalAudioInTokens: number;
  totalAudioOutTokens: number;
  totalTextOutTokens: number;
  totalThoughtsTokens: number;
  rateMultiplier: number;

  // Latency tracking: measures time from activityEnd to first Gemini audio response
  turnEndTimestamp: number | null;
  awaitingGeminiResponse: boolean;
  turnLatencies: number[];

  // Heartbeat
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  lastPongAt: number;

  // Backpressure tracking
  backpressureWarningCount: number;

  // Session diagnostics log
  sessionLog: Array<{
    ts: number;
    event: string;
    detail?: string;
  }>;
  connectedAt: number;
  recordedObjectives?: Set<string>;
}

// Backpressure threshold: 128 KB of queued data
const BACKPRESSURE_THRESHOLD = 128 * 1024;
// Heartbeat interval: 10 seconds
const HEARTBEAT_INTERVAL_MS = 10_000;
// Heartbeat timeout: 30 seconds without pong (gives 3 heartbeat cycles grace period)
const HEARTBEAT_TIMEOUT_MS = 30_000;

@WebSocketGateway({
  path: '/live-session',
})
export class LiveGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(LiveGateway.name);
  private readonly clients = new Map<WebSocket, ClientSessionState>();
  private readonly ai: GoogleGenAI;
  private readonly liveModel: string;

  constructor(private readonly sessionsService: SessionsService) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
    this.liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
  }

  handleConnection(client: WebSocket) {
    const sessionId = `gw-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    this.logger.log(`[${sessionId}] Client connected over WebSocket`);

    const state: ClientSessionState = {
      ws: client,
      sessionId,
      isConnectedToGemini: false,
      supportsOpus: false,
      opusEncoder: null,
      opusPcmBuffer: Buffer.alloc(0),
      userSpeechActive: false,
      hasDispatchedGreeting: false,
      userTranscriptAccumulator: '',
      modelTranscriptAccumulator: '',
      lastStudentTranscript: '',
      hasModelSpokenThisTurn: false,
      totalTextInTokens: 0,
      totalAudioInTokens: 0,
      totalAudioOutTokens: 0,
      totalTextOutTokens: 0,
      totalThoughtsTokens: 0,
      rateMultiplier: Number((0.37 + Math.random() * 0.03).toFixed(4)),

      // Latency tracking
      turnEndTimestamp: null,
      awaitingGeminiResponse: false,
      turnLatencies: [],

      // Heartbeat
      heartbeatInterval: null,
      lastPongAt: Date.now(),

      // Backpressure
      backpressureWarningCount: 0,

      // Session diagnostics
      sessionLog: [{ ts: Date.now(), event: 'client_connected' }],
      connectedAt: Date.now(),
      recordedObjectives: new Set<string>(),
    };
    this.clients.set(client, state);

    // Start ping/pong heartbeat with client
    this.startHeartbeat(client, state);

    client.on('message', async (data: RawData, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Direct binary PCM 16kHz audio buffer
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
          await this.handleAudioChunk(client, buffer);
        } else {
          // Text / JSON message
          const text = data.toString('utf-8');

          // Handle pong responses from client heartbeat (plain text, JSON, or whitespace)
          const trimmed = text.trim();
          if (trimmed === 'pong' || trimmed === '{"type":"pong"}' || trimmed.includes('"pong"')) {
            state.lastPongAt = Date.now();
            return;
          }

          const message = JSON.parse(text);
          await this.handleClientMessage(client, message);
        }
      } catch (err: any) {
        this.logger.error(`[${state.sessionId}] Error processing client message: ${err?.message}`);
        this.addSessionLog(state, 'client_message_error', err?.message);
      }
    });

    client.on('error', (err) => {
      this.logger.error(`[${state.sessionId}] Client socket error: ${err.message}`);
      this.addSessionLog(state, 'client_socket_error', err.message);
    });

    client.on('close', (code, reason) => {
      this.addSessionLog(state, 'client_socket_closed', `code=${code} reason=${reason?.toString() || ''}`);
    });
  }

  async handleDisconnect(client: WebSocket) {
    const state = this.clients.get(client);
    const sid = state?.sessionId || 'unknown';
    this.logger.log(`[${sid}] Client disconnected`);

    if (state) {
      // Stop heartbeat
      this.stopHeartbeat(state);

      // Print session diagnostics summary
      this.printSessionSummary(state);

      // Persist session diagnostics to DB and in-memory store
      const durationMs = Date.now() - state.connectedAt;
      const durationSec = Math.round(durationMs / 1000);
      const avgLatency = state.turnLatencies.length > 0
        ? Math.round(state.turnLatencies.reduce((s, v) => s + v, 0) / state.turnLatencies.length)
        : 0;
      const maxLatency = state.turnLatencies.length > 0
        ? Math.round(Math.max(...state.turnLatencies))
        : 0;
      const slowTurns = state.turnLatencies.filter((l) => l > 3000).length;
      const errorEvents = state.sessionLog.filter((e) =>
        e.event.includes('error') || e.event.includes('timeout') || e.event.includes('backpressure'),
      );

      this.sessionsService
        .saveSessionDiagnostics({
          sessionId: state.sessionId,
          durationSeconds: durationSec,
          turnsCount: state.turnLatencies.length,
          avgLatencyMs: avgLatency,
          maxLatencyMs: maxLatency,
          slowTurnsCount: slowTurns,
          backpressureWarnings: state.backpressureWarningCount,
          errorCount: errorEvents.length,
          events: state.sessionLog,
        })
        .catch((e: any) => {
          this.logger.warn(`[${sid}] Failed to save diagnostics: ${e?.message}`);
        });

      if (state.geminiSession) {
        try {
          await state.geminiSession.close();
        } catch (e: any) {
          this.logger.debug(`[${sid}] Error closing Gemini session: ${e?.message}`);
        }
      }

      state.opusEncoder = null;
      state.opusPcmBuffer = Buffer.alloc(0);
    }
    this.clients.delete(client);
  }

  // ─── HEARTBEAT ───────────────────────────────────────────────────────────────

  private startHeartbeat(client: WebSocket, state: ClientSessionState) {
    state.lastPongAt = Date.now();
    state.heartbeatInterval = setInterval(() => {
      if (client.readyState !== WebSocket.OPEN) {
        this.stopHeartbeat(state);
        return;
      }

      // Check if we got a pong since last ping
      const sincePong = Date.now() - state.lastPongAt;
      if (sincePong > HEARTBEAT_TIMEOUT_MS) {
        this.logger.warn(`[${state.sessionId}] ❌ Heartbeat timeout — no pong for ${Math.round(sincePong / 1000)}s → closing stale client`);
        this.addSessionLog(state, 'heartbeat_timeout', `${Math.round(sincePong / 1000)}s since last pong`);
        this.stopHeartbeat(state);
        try {
          client.close(4008, 'Heartbeat timeout');
        } catch {}
        return;
      }

      // Send ping with server timestamp for client RTT calculation
      try {
        client.send(JSON.stringify({ type: 'ping', ts: Date.now() }));
      } catch {}
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(state: ClientSessionState) {
    if (state.heartbeatInterval) {
      clearInterval(state.heartbeatInterval);
      state.heartbeatInterval = null;
    }
  }

  // ─── SESSION LOGGING ─────────────────────────────────────────────────────────

  private addSessionLog(state: ClientSessionState, event: string, detail?: string) {
    state.sessionLog.push({ ts: Date.now(), event, detail });
    // Cap log at 500 entries to prevent memory issues in long sessions
    if (state.sessionLog.length > 500) {
      state.sessionLog = state.sessionLog.slice(-400);
    }
  }

  private printSessionSummary(state: ClientSessionState) {
    const durationMs = Date.now() - state.connectedAt;
    const durationSec = Math.round(durationMs / 1000);
    const avgLatency = state.turnLatencies.length > 0
      ? Math.round(state.turnLatencies.reduce((s, v) => s + v, 0) / state.turnLatencies.length)
      : 0;
    const maxLatency = state.turnLatencies.length > 0
      ? Math.round(Math.max(...state.turnLatencies))
      : 0;
    const slowTurns = state.turnLatencies.filter(l => l > 3000).length;

    const errorEvents = state.sessionLog.filter(e =>
      e.event.includes('error') || e.event.includes('timeout') || e.event.includes('backpressure')
    );

    this.logger.log(
      `[${state.sessionId}] 📊 SESSION SUMMARY\n` +
      `   Duration: ${durationSec}s | Turns: ${state.turnLatencies.length} | Backpressure warnings: ${state.backpressureWarningCount}\n` +
      `   Latency → Avg: ${avgLatency}ms | Max: ${maxLatency}ms | Slow turns (>3s): ${slowTurns}\n` +
      `   Errors/warnings: ${errorEvents.length} events\n` +
      `   ${errorEvents.length > 0 ? 'Events: ' + errorEvents.map(e => `[${new Date(e.ts).toISOString()}] ${e.event}: ${e.detail || ''}`).join(' | ') : 'No errors recorded'}`
    );
  }

  // ─── SAFE SEND WITH BACKPRESSURE ─────────────────────────────────────────────

  private safeSendToClient(state: ClientSessionState, data: string) {
    const { ws } = state;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;

    // Check backpressure: if too much data is queued, log warning
    const buffered = ws.bufferedAmount || 0;
    if (buffered > BACKPRESSURE_THRESHOLD) {
      state.backpressureWarningCount++;
      // Log every 10th occurrence to avoid log spam
      if (state.backpressureWarningCount % 10 === 1) {
        this.logger.warn(
          `[${state.sessionId}] ⚠️ Client WS backpressure: ${Math.round(buffered / 1024)}KB queued ` +
          `(warning #${state.backpressureWarningCount})`
        );
        this.addSessionLog(state, 'backpressure_warning', `${Math.round(buffered / 1024)}KB queued`);
      }

      // Notify client of slow connection
      try {
        ws.send(JSON.stringify({
          type: 'slow_connection',
          bufferedKB: Math.round(buffered / 1024),
        }));
      } catch {}
    }

    try {
      ws.send(data);
    } catch (err: any) {
      this.logger.error(`[${state.sessionId}] Send to client failed: ${err?.message}`);
      this.addSessionLog(state, 'send_error', err?.message);
    }
  }

  // ─── MESSAGE HANDLERS ────────────────────────────────────────────────────────

  private async handleClientMessage(client: WebSocket, message: any) {
    const state = this.clients.get(client);
    if (!state) return;

    switch (message.type) {
      case 'start_session': {
        const dto: CreateSessionTokenDto = message.options || {};
        if (message.options?.sessionId) {
          state.sessionId = message.options.sessionId;
        }
        state.dto = dto;

        // Initialize Opus compression if client supports it (cuts downlink bandwidth from 512kbps to ~24kbps)
        state.supportsOpus = !!message.supportsOpus;
        if (state.supportsOpus) {
          try {
            if (!OpusScriptClass) {
              const mod = await import('opusscript').catch(() => null);
              if (mod) OpusScriptClass = mod.default || mod;
            }
            if (OpusScriptClass) {
              state.opusEncoder = new OpusScriptClass(24000, 1, OpusScriptClass.Application.VOIP);
              state.opusPcmBuffer = Buffer.alloc(0);
              this.logger.log(`[${state.sessionId}] 🚀 Opus compression enabled for client downlink (24kHz VOIP, 20ms frames)`);
              this.addSessionLog(state, 'opus_enabled');
            } else {
              this.logger.warn(`[${state.sessionId}] Opus module unavailable in runtime, falling back to raw PCM`);
              state.opusEncoder = null;
              state.supportsOpus = false;
            }
          } catch (e: any) {
            this.logger.warn(`[${state.sessionId}] Failed to initialize Opus encoder: ${e?.message}`);
            state.opusEncoder = null;
            state.supportsOpus = false;
          }
        }

        this.addSessionLog(state, 'start_session', `topic=${dto.topic || 'General'} lang=${dto.languageMode || 'english'}`);
        await this.initGeminiLiveSession(client, state, dto);
        break;
      }

      case 'audio_chunk': {
        // Base64 PCM chunk
        if (message.data) {
          const buffer = Buffer.from(message.data, 'base64');
          await this.handleAudioChunk(client, buffer);
        }
        break;
      }

      case 'turn_complete': {
        // User speech turn ended -> flush trailing silence and signal Gemini
        this.addSessionLog(state, 'user_turn_complete');
        await this.handleEndOfTurn(state);
        break;
      }

      case 'interrupt': {
        // User barge-in signal
        if (state.geminiSession) {
          this.logger.log(`[${state.sessionId}] User barge-in interrupt signal received`);
          this.addSessionLog(state, 'user_interrupt');
        }
        break;
      }

      case 'audio_stream_end': {
        // Client signaled mic turned off / paused.
        // With manual VAD (disabled server VAD), audioStreamEnd is NOT used.
        // Instead, activityEnd marks stream interruption per Gemini docs.
        try {
          if (state.userSpeechActive) {
            state.geminiSession?.sendRealtimeInput({ activityEnd: {} });
            state.userSpeechActive = false;
            this.logger.debug(`[${state.sessionId}] 🛑 activityEnd sent (mic off/paused)`);
            this.addSessionLog(state, 'activity_end_mic_pause');
          }
        } catch (e: any) {
          // ignore
        }
        break;
      }

      case 'time_wrapup_cue': {
        this.logger.log(`[${state.sessionId}] ⏰ Time wrapup cue received from client`);
        this.addSessionLog(state, 'time_wrapup_cue');
        if (state.geminiSession && state.isConnectedToGemini) {
          try {
            state.geminiSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[SYSTEM TIME NOTICE: The practice session time has ended. Right now, in your current spoken turn, wrap up naturally: share 1 short encouraging observation about how they did today, thank them warmly, speak your cheerful goodbye aloud, and then call conclude_call. Keep your farewell brief (under 15 seconds of speech).]`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
            this.logger.log(`[${state.sessionId}] ⏰ Time wrapup cue dispatched to Gemini Live`);
          } catch (e: any) {
            this.logger.warn(`[${state.sessionId}] Failed to send time wrapup cue to Gemini: ${e?.message}`);
          }
        }
        break;
      }

      case 'curriculum_pacing_cue': {
        const nextTitle = message.nextObjectiveTitle || 'the next objective';
        const nextId = message.nextObjectiveId || '';
        this.logger.log(`[${state.sessionId}] 🎯 Curriculum pacing cue received from client -> target: "${nextTitle}" (${nextId})`);
        this.addSessionLog(state, 'curriculum_pacing_cue', `${nextTitle} (${nextId})`);
        if (state.geminiSession && state.isConnectedToGemini) {
          try {
            state.geminiSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `[PEDAGOGICAL PACING NOTICE: Session time is progressing. In your very next spoken turn, smoothly conclude the previous topic in under 5 words, and ask an engaging question pivoting directly to the next objective: "${nextTitle}" (ID: "${nextId}"). Remember to keep your turn strictly under 15 words.]`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
            this.logger.log(`[${state.sessionId}] 🎯 Curriculum pacing cue dispatched to Gemini Live`);
          } catch (e: any) {
            this.logger.warn(`[${state.sessionId}] Failed to send curriculum pacing cue to Gemini: ${e?.message}`);
          }
        }
        break;
      }

      case 'pong': {
        state.lastPongAt = Date.now();
        break;
      }

      case 'client_ping': {
        state.lastPongAt = Date.now();
        this.safeSendToClient(state, JSON.stringify({
          type: 'client_pong',
          ts: message.ts,
          serverTime: Date.now(),
        }));
        break;
      }

      default:
        this.logger.warn(`[${state.sessionId}] Unknown message type: ${message.type}`);
    }
  }

  private async handleAudioChunk(client: WebSocket, buffer: Buffer) {
    const state = this.clients.get(client);
    if (!state?.geminiSession || !state.isConnectedToGemini) return;

    try {
      // Manual VAD: signal activityStart on the first chunk of a new speech burst.
      // Gemini will not process audio until it receives this signal.
      if (!state.userSpeechActive) {
        state.userSpeechActive = true;
        state.geminiSession.sendRealtimeInput({ activityStart: {} });
        this.logger.debug(`[${state.sessionId}] 🎙️ activityStart sent — user speech burst began`);
        this.addSessionLog(state, 'activity_start');
      }

      // Stream raw 16kHz PCM audio chunk to Gemini
      state.geminiSession.sendRealtimeInput({
        audio: {
          data: buffer.toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err: any) {
      this.logger.error(`[${state.sessionId}] sendRealtimeInput error: ${err?.message}`);
      this.addSessionLog(state, 'gemini_send_error', err?.message);
    }
  }

  private async handleEndOfTurn(state: ClientSessionState) {
    if (!state.geminiSession || !state.isConnectedToGemini) return;

    try {
      this.logger.log(`[${state.sessionId}] 🚀 Turn Complete: Sending activityEnd to Gemini Live`);

      // Manual VAD: signal activityEnd so Gemini immediately processes all accumulated audio.
      // This replaces the old approach of sending silence frames + clientContent.turnComplete
      // which only affected text turns and was invisible to Gemini's audio pipeline.
      if (state.userSpeechActive) {
        state.geminiSession.sendRealtimeInput({ activityEnd: {} });
        state.userSpeechActive = false;
        this.logger.debug(`[${state.sessionId}] 🛑 activityEnd sent — user speech burst ended`);
        this.addSessionLog(state, 'activity_end_turn');

        // Start latency measurement: record when we sent activityEnd
        state.turnEndTimestamp = Date.now();
        state.awaitingGeminiResponse = true;
      }
    } catch (err: any) {
      this.logger.error(`[${state.sessionId}] handleEndOfTurn error: ${err?.message}`);
      this.addSessionLog(state, 'end_of_turn_error', err?.message);
    }
  }

  private async initGeminiLiveSession(
    client: WebSocket,
    state: ClientSessionState,
    dto: CreateSessionTokenDto,
  ) {
    try {
      const isSinhala = dto.languageMode === 'sinhala' || dto.mode === 'sinhala_tutor';
      const systemInstruction = this.sessionsService.getSystemPrompt(dto);
      const toolsDeclaration = this.sessionsService.getToolsDeclaration(
        dto.aiSuggestions !== false,
        isSinhala,
      );
      const greetingPrompt = this.sessionsService.generateGreetingPrompt(dto);
      const voiceName = isSinhala ? 'Callirrhoe' : 'Aoede';

      this.logger.log(`[${state.sessionId}] Connecting to Gemini Live API (${this.liveModel})...`);
      this.addSessionLog(state, 'gemini_connecting', `model=${this.liveModel}`);

      let session: any = null;

      session = await this.ai.live.connect({
        model: this.liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
          thinkingConfig: {
            thinkingBudget: 0,
          },
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
          tools: toolsDeclaration as any,
          realtimeInputConfig: {
            activityHandling: ActivityHandling.NO_INTERRUPTION,
            automaticActivityDetection: {
              disabled: true,  // Manual VAD: we control turns via activityStart/activityEnd
            },
          },
          inputAudioTranscription: {
            languageCodes: ['en-US', 'si-LK'],
          },
          outputAudioTranscription: {},
          contextWindowCompression: {
            triggerTokens: '25000',
            slidingWindow: {
              targetTokens: '12000',
            },
          },
        },
        callbacks: {
          onopen: () => {
            this.logger.log(`[${state.sessionId}] ✅ Connected to Gemini Live API`);
            state.isConnectedToGemini = true;
            this.addSessionLog(state, 'gemini_connected');

            // Notify client that session is ready
            this.safeSendToClient(state, JSON.stringify({
              type: 'ready',
              model: this.liveModel,
              voiceName,
            }));

            // Dispatch opening turn greeting prompt if fresh session
            const isFreshSession = !dto.isReconnect && !dto.memory;
            if (isFreshSession && greetingPrompt && session && !state.hasDispatchedGreeting) {
              state.hasDispatchedGreeting = true;
              this.logger.log(`[${state.sessionId}] Dispatching opening turn greeting prompt`);
              this.addSessionLog(state, 'greeting_dispatched');

              // Start latency timer for greeting response
              state.turnEndTimestamp = Date.now();
              state.awaitingGeminiResponse = true;

              session.sendClientContent({
                turns: [
                  {
                    role: 'user',
                    parts: [{ text: greetingPrompt }],
                  },
                ],
                turnComplete: true,
              });
            } else if (!isFreshSession && !state.hasDispatchedGreeting) {
              state.hasDispatchedGreeting = true;
              this.logger.log(`[${state.sessionId}] Reconnected session / existing memory present -> skipping opening greeting prompt`);
              this.addSessionLog(state, 'greeting_skipped_reconnect');
            }
          },

          onmessage: (response: any) => {
            this.handleGeminiServerMessage(client, state, response, session);
          },

          onerror: (err: any) => {
            this.logger.error(`[${state.sessionId}] Gemini Live error: ${err?.message || err}`);
            this.addSessionLog(state, 'gemini_error', err?.message || String(err));
            this.safeSendToClient(state, JSON.stringify({
              type: 'error',
              message: err?.message || 'Gemini Live error',
            }));
          },

          onclose: (e: any) => {
            this.logger.log(`[${state.sessionId}] Gemini Live closed: ${e?.reason || 'Normal'}`);
            state.isConnectedToGemini = false;
            this.addSessionLog(state, 'gemini_closed', e?.reason || 'Normal');
            this.safeSendToClient(state, JSON.stringify({
              type: 'closed',
              reason: e?.reason,
            }));
          },
        },
      });

      state.geminiSession = session;

      // If onopen fired before await returned and greeting wasn't sent yet
      const isFreshSession = !dto.isReconnect && !dto.memory;
      if (isFreshSession && greetingPrompt && state.isConnectedToGemini && session && !state.hasDispatchedGreeting) {
        state.hasDispatchedGreeting = true;
        this.logger.log(`[${state.sessionId}] Ensuring opening turn greeting prompt is dispatched`);
        this.addSessionLog(state, 'greeting_dispatched_fallback');

        // Start latency timer for greeting response
        state.turnEndTimestamp = Date.now();
        state.awaitingGeminiResponse = true;

        session.sendClientContent({
          turns: [
            {
              role: 'user',
              parts: [{ text: greetingPrompt }],
            },
          ],
          turnComplete: true,
        });
      }
    } catch (err: any) {
      this.logger.error(`[${state.sessionId}] Failed to connect to Gemini Live: ${err?.message}`, err?.stack);
      this.addSessionLog(state, 'gemini_connect_failed', err?.message);
      this.safeSendToClient(state, JSON.stringify({
        type: 'error',
        message: `Failed to initialize Gemini Live: ${err?.message}`,
      }));
    }
  }

  private handleGeminiServerMessage(
    client: WebSocket,
    state: ClientSessionState,
    response: any,
    session: any,
  ) {
    const serverContent = response.serverContent;

    // 1. Process Model Audio Turn Chunks
    if (serverContent?.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          state.hasModelSpokenThisTurn = true;

          // Latency measurement: first audio chunk after activityEnd
          if (state.awaitingGeminiResponse && state.turnEndTimestamp) {
            const latencyMs = Date.now() - state.turnEndTimestamp;
            state.turnLatencies.push(latencyMs);
            state.awaitingGeminiResponse = false;

            const severity = latencyMs > 8000 ? '🔴' : latencyMs > 3000 ? '🟡' : '🟢';
            this.logger.log(`[${state.sessionId}] ${severity} Turn latency: ${latencyMs}ms (Gemini thinking time)`);
            this.addSessionLog(state, 'turn_latency', `${latencyMs}ms`);

            // Forward latency measurement to client
            this.safeSendToClient(state, JSON.stringify({
              type: 'latency',
              turnLatencyMs: latencyMs,
              avgLatencyMs: Math.round(
                state.turnLatencies.reduce((s, v) => s + v, 0) / state.turnLatencies.length
              ),
            }));
          }

          if (state.supportsOpus && state.opusEncoder) {
            // Compress 24kHz PCM to Opus (20ms frames = 480 samples = 960 bytes)
            const chunkBuffer = Buffer.from(part.inlineData.data, 'base64');
            state.opusPcmBuffer = Buffer.concat([state.opusPcmBuffer, chunkBuffer]);

            const FRAME_SAMPLES = 480;
            const FRAME_BYTES = FRAME_SAMPLES * 2; // 960 bytes

            while (state.opusPcmBuffer.length >= FRAME_BYTES) {
              const frame = state.opusPcmBuffer.subarray(0, FRAME_BYTES);
              state.opusPcmBuffer = state.opusPcmBuffer.subarray(FRAME_BYTES);

              try {
                const opusPacket = state.opusEncoder.encode(frame, FRAME_SAMPLES);
                this.safeSendToClient(state, JSON.stringify({
                  type: 'audio_opus',
                  data: opusPacket.toString('base64'),
                }));
              } catch (err: any) {
                this.logger.warn(`[${state.sessionId}] Opus encode error: ${err?.message}`);
              }
            }
          } else {
            // Send legacy raw base64 PCM audio chunk to client (with backpressure check)
            this.safeSendToClient(state, JSON.stringify({
              type: 'audio',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
            }));
          }
        }
      }
    }

    // 2. Transcriptions (User & Model)
    if (serverContent?.outputTranscription?.text) {
      const text = serverContent.outputTranscription.text;
      state.modelTranscriptAccumulator += text;
      state.hasModelSpokenThisTurn = true;

      // Also count as first response if we were awaiting
      if (state.awaitingGeminiResponse && state.turnEndTimestamp) {
        const latencyMs = Date.now() - state.turnEndTimestamp;
        state.turnLatencies.push(latencyMs);
        state.awaitingGeminiResponse = false;
        this.logger.log(`[${state.sessionId}] Turn latency (transcript): ${latencyMs}ms`);
        this.addSessionLog(state, 'turn_latency_transcript', `${latencyMs}ms`);

        this.safeSendToClient(state, JSON.stringify({
          type: 'latency',
          turnLatencyMs: latencyMs,
          avgLatencyMs: Math.round(
            state.turnLatencies.reduce((s, v) => s + v, 0) / state.turnLatencies.length
          ),
        }));
      }

      this.safeSendToClient(state, JSON.stringify({
        type: 'output_transcript',
        text,
      }));
    }

    if (serverContent?.inputTranscription?.text) {
      const text = serverContent.inputTranscription.text;
      state.userTranscriptAccumulator += text;
      state.lastStudentTranscript += text;
      this.logger.log(`[${state.sessionId}] 📝 [Student Said Chunk]: "${text}"`);
      this.safeSendToClient(state, JSON.stringify({
        type: 'input_transcript',
        text,
      }));
    }

    // 3. Turn Complete
    if (serverContent?.turnComplete) {
      // Flush residual Opus buffer if partial frame was pending
      if (state.supportsOpus && state.opusEncoder && state.opusPcmBuffer.length > 0) {
        const FRAME_SAMPLES = 480;
        const FRAME_BYTES = FRAME_SAMPLES * 2;
        const padded = Buffer.alloc(FRAME_BYTES);
        state.opusPcmBuffer.copy(padded, 0);
        state.opusPcmBuffer = Buffer.alloc(0);

        try {
          const opusPacket = state.opusEncoder.encode(padded, FRAME_SAMPLES);
          this.safeSendToClient(state, JSON.stringify({
            type: 'audio_opus',
            data: opusPacket.toString('base64'),
          }));
        } catch {}
      }

      const userText = (state.userTranscriptAccumulator || state.lastStudentTranscript).trim();
      const modelText = state.modelTranscriptAccumulator.trim();

      // Only print turn complete summary when the model actually responded or when user turn finished
      if (state.hasModelSpokenThisTurn || modelText) {
        this.logger.log(
          `[${state.sessionId}] 🤖 [Model Turn Complete]\n` +
          `   🗣️ User Said: "${userText || '(untranscribed / audio speech)'}"\n` +
          `   💬 Maya Replied: "${modelText || '(audio only)'}"`
        );
        this.addSessionLog(state, 'model_turn_complete', `user="${userText?.slice(0, 80)}" maya="${modelText?.slice(0, 80)}"`);
        // Turn fully complete: clear accumulators for the next conversational exchange
        state.userTranscriptAccumulator = '';
        state.lastStudentTranscript = '';
        state.modelTranscriptAccumulator = '';
        state.hasModelSpokenThisTurn = false;
        this.safeSendToClient(state, JSON.stringify({
          type: 'turn_complete',
        }));
      } else {
        // Intermediate turn completion (e.g. handshake/tool call/user acoustic closure)
        this.logger.log(
          `[${state.sessionId}] ⏳ [Turn Handshake Completed] Student transcription accumulated: "${userText || '(awaiting recognition)'}". Model audio generation in progress...`
        );
        this.addSessionLog(state, 'turn_handshake', `user="${userText?.slice(0, 80)}"`);
        this.safeSendToClient(state, JSON.stringify({
          type: 'turn_handshake',
        }));
      }
    }

    // 4. Interrupted Event
    if (serverContent?.interrupted) {
      this.logger.log(`[${state.sessionId}] ⚡ [Interrupted] User voice interrupted model response`);
      state.modelTranscriptAccumulator = '';
      state.hasModelSpokenThisTurn = false;
      state.awaitingGeminiResponse = false;
      this.addSessionLog(state, 'model_interrupted');
      this.safeSendToClient(state, JSON.stringify({
        type: 'interrupted',
      }));
    }

    // 5. Function Calling / Tools
    if (response.toolCall?.functionCalls) {
      const functionResponses: any[] = [];
      const isSinhala = state.dto?.languageMode === 'sinhala' || state.dto?.mode === 'sinhala_tutor';
      const isDeepGuidance = isSinhala && state.dto?.sinhalaStyle === 'deep_guidance';

      for (const fc of response.toolCall.functionCalls) {
        const args = (fc.args || {}) as any;
        this.logger.log(`[${state.sessionId}] 🛠️ Tool Call invoked: ${fc.name}`);
        this.addSessionLog(state, 'tool_call', fc.name);

        // Forward to client so UI displays grammar card or farewell
        this.safeSendToClient(state, JSON.stringify({
          type: 'tool_call',
          name: fc.name,
          args: fc.args,
        }));

        if (fc.name === 'conclude_call') {
          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'concluding',
              instruction: isSinhala
                ? 'The call is terminating now. In natural spoken everyday Sinhala, speak a final closing farewell statement (STRICTLY NEVER ASK A QUESTION, NO QUESTION MARKS, NO "කරමුද?"): "නියමයි! ඔයාගේ progress එක save වුණා. ඊළඟ levels dashboard එකෙන් බලාගන්න පුළුවන්. සුභ දවසක්! Goodbye!" then stop speaking.'
                : 'The call is terminating now. Speak a short warm friendly farewell statement (STRICTLY NEVER ASK A QUESTION): "Great job! Your progress has been saved. You can check the next levels on your dashboard. Have a wonderful day! Goodbye!" then stop speaking.',
            },
          });
        } else if (fc.name === 'show_grammar_correction') {
          const shortKeyPhrase = String(args.moreNatural || args.more_natural || '').split(/[.,;!?]/)[0].trim().replace(/"/g, "'");
          const rawExplanation = String(args.explanation || '').replace(/"/g, "'");
          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'displayed_to_student',
              instruction: isSinhala
                ? isDeepGuidance
                  ? `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                  : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න"), and immediately ask your next short English question. Total turn strictly under 12 words.`
                : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`,
            },
          });
        } else if (fc.name === 'show_rephrase_suggestion') {
          const shortKeyPhrase = String(args.moreNatural || args.more_natural || '').split(/[.,;!?]/)[0].trim().replace(/"/g, "'");
          const rawExplanation = String(args.explanation || '').replace(/"/g, "'");
          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'displayed_to_student',
              instruction: isSinhala
                ? isDeepGuidance
                  ? `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                  : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්"), and immediately ask your next short English question. Total turn strictly under 12 words.`
                : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`,
            },
          });
        } else if (fc.name === 'record_objective') {
          const rawId = String(args.objectiveId || '').trim();
          if (rawId && state.recordedObjectives) {
            state.recordedObjectives.add(rawId.toLowerCase());
          }

          const allObjectives =
            state.dto?.guidedPrompt?.learningObjectives ||
            state.dto?.learningObjectives ||
            [];
          const isAllCompleted =
            allObjectives.length > 0 &&
            Boolean(state.recordedObjectives && state.recordedObjectives.size >= allObjectives.length);

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'objective_recorded',
              allObjectivesCompleted: isAllCompleted,
              instruction: isAllCompleted
                ? 'All milestones for this level are now complete! In your current spoken turn: if the student ALREADY asked to wrap up, leave, or says goodbye, speak a definitive farewell statement (STRICTLY NEVER ASK A QUESTION) and call conclude_call. If they have NOT yet asked to wrap up, ask in natural spoken Sinhala: "නියමයි! ඔයා මේ ලෙවල් එකේ milestones ඔක්කොම complete කළා! දැන් අපි call එක wrap up කරලා save කරමුද?".'
                : 'Objective successfully recorded. In your current spoken turn: give ONE brief validation sentence (under 5 words), and immediately ask a question pivoting to the next objective. Keep your total turn under 15 words.',
            },
          });
        } else {
          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: { result: 'ok' },
          });
        }
      }

      if (typeof session.sendToolResponse === 'function') {
        session.sendToolResponse({ functionResponses });
      }
    }

    // 6. Live Token Usage
    const rawUsage =
      response.usageMetadata ||
      serverContent?.modelTurn?.parts?.find((p: any) => p.usageMetadata)?.usageMetadata;

    if (rawUsage) {
      // 1. Output tokens: check responseTokensDetails (AI Studio) and candidatesTokensDetails (Vertex AI)
      const outDetails =
        rawUsage.responseTokensDetails ||
        rawUsage.candidatesTokensDetails ||
        rawUsage.response_tokens_details ||
        rawUsage.candidates_tokens_details;

      let turnAudioOut = 0;
      let turnTextOut = 0;
      if (Array.isArray(outDetails)) {
        for (const d of outDetails) {
          const count = Number(d.tokenCount || d.token_count || 0);
          if (d.modality === 'AUDIO') {
            turnAudioOut += count;
          } else if (d.modality === 'TEXT') {
            turnTextOut += count;
          }
        }
      }

      const outCount = Number(
        rawUsage.responseTokenCount ||
        rawUsage.candidatesTokenCount ||
        rawUsage.response_token_count ||
        rawUsage.candidates_token_count ||
        0,
      );

      if (turnAudioOut === 0 && turnTextOut === 0 && outCount > 0) {
        turnAudioOut = outCount;
      }

      const turnThoughts = Number(rawUsage.thoughtsTokenCount || rawUsage.thoughts_token_count || 0);

      // 2. Input tokens: check promptTokensDetails
      const inDetails = rawUsage.promptTokensDetails || rawUsage.prompt_tokens_details;
      let turnTextIn = 0;
      let turnAudioIn = 0;

      if (Array.isArray(inDetails) && inDetails.length > 0) {
        for (const d of inDetails) {
          const count = Number(d.tokenCount || d.token_count || 0);
          if (d.modality === 'TEXT') {
            turnTextIn += count;
          } else if (d.modality === 'AUDIO') {
            turnAudioIn += count;
          }
        }
      }

      const promptCount = Number(rawUsage.promptTokenCount || rawUsage.prompt_token_count || 0);

      // Fallback if prompt details are not split by modality:
      // System prompt and instructions are ~450 text tokens; user mic stream accounts for the rest.
      if (turnTextIn === 0 && turnAudioIn === 0 && promptCount > 0) {
        const estimatedTextBaseline = 450;
        if (promptCount <= estimatedTextBaseline) {
          turnTextIn = promptCount;
          turnAudioIn = 0;
        } else {
          turnTextIn = estimatedTextBaseline;
          turnAudioIn = promptCount - estimatedTextBaseline;
        }
      }

      // Note on Gemini Live API:
      // 1. Input tokens: promptTokenCount represents the CUMULATIVE context window processed so far.
      //    We take the maximum/latest snapshot so it does not compound exponentially.
      if (turnAudioIn > 0 || turnTextIn > 0 || promptCount > 0) {
        state.totalAudioInTokens = Math.max(state.totalAudioInTokens, turnAudioIn);
        state.totalTextInTokens = Math.max(state.totalTextInTokens, turnTextIn);
      }

      // 2. Output tokens: responseTokenCount / candidatesTokenCount represents the tokens generated
      //    for the CURRENT model turn. We accumulate output tokens across the turns.
      if (turnAudioOut > 0 || turnTextOut > 0 || outCount > 0) {
        state.totalAudioOutTokens += turnAudioOut;
        state.totalTextOutTokens += turnTextOut;
      }
      if (turnThoughts > 0) {
        state.totalThoughtsTokens += turnThoughts;
      }

      const total =
        state.totalAudioInTokens +
        state.totalTextInTokens +
        state.totalAudioOutTokens +
        state.totalTextOutTokens +
        state.totalThoughtsTokens;

      const rateMultiplier = state.rateMultiplier || Number((0.37 + Math.random() * 0.03).toFixed(4));
      const rawCostUsd =
        (state.totalTextInTokens / 1_000_000) * 0.75 +
        (state.totalAudioInTokens / 1_000_000) * 3.0 +
        (state.totalAudioOutTokens / 1_000_000) * 12.0 +
        ((state.totalTextOutTokens + state.totalThoughtsTokens) / 1_000_000) * 4.5;
      const costUsd = Number((rawCostUsd * rateMultiplier).toFixed(6));
      const costLkr = Number((costUsd * 308.50).toFixed(2));

      this.safeSendToClient(state, JSON.stringify({
        type: 'usage',
        usage: {
          textIn: state.totalTextInTokens,
          audioIn: state.totalAudioInTokens,
          audioOut: state.totalAudioOutTokens,
          textOut: state.totalTextOutTokens,
          thoughtsTokens: state.totalThoughtsTokens,
          total,
          costUsd,
          costLkr,
        },
      }));
    }
  }
}
