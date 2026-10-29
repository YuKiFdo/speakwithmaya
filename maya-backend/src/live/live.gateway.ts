import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { WebSocket, RawData } from 'ws';
import { GoogleGenAI, Modality, ActivityHandling } from '@google/genai';
import { SessionsService, toValidUuid } from '../sessions/sessions.service.js';
import { AuthService } from '../auth/auth.service.js';
import { CreateSessionTokenDto } from '../sessions/dto/session.dto.js';
import { randomUUID } from 'node:crypto';

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
  userId?: string;
  userName?: string;
  isConnectedToGemini: boolean;
  supportsOpus: boolean;
  opusEncoder?: any;
  opusPcmBuffer: Buffer;
  userAudioChunks: Buffer[];
  currentUserTurnAudioChunks: Buffer[];
  userTurnAudioMap: Map<number, Buffer>;
  userTurnCount: number;
  modelAudioChunks: Buffer[];
  currentModelTurnAudioChunks: Buffer[];
  modelTurnAudioMap: Map<number, Buffer>;
  modelTurnCount: number;
  chronologicalAudioTurns: Array<{ speaker: 'user' | 'model'; turnIdx: number; pcm: Buffer; sampleRate: number }>;
  authoritativeTurns: Array<{ role: 'user' | 'model'; text: string; timestamp: string }>;
  grammarCorrections: Array<{ studentSaid: string; moreNatural: string; explanation: string; highlightWords?: string[] }>;
  userSpeechActive: boolean;
  hasDispatchedGreeting: boolean;
  isGreetingInProgress: boolean;
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

  // Greeting audio diagnosis
  greetingAudioChunksReceived: number;
  greetingAudioBytesReceived: number;
  greetingTranscriptReceived: string;
  geminiConnectedAt?: number;
  greetingDispatchedAt?: number;
  greetingPacketCount: number;
  greetingRawEvents: string[];

  // Latency tracking: measures time from activityEnd to first Gemini audio response
  turnEndTimestamp: number | null;
  awaitingGeminiResponse: boolean;
  turnLatencies: number[];

  // Heartbeat
  heartbeatInterval: ReturnType<typeof setInterval> | null;
  maxDurationTimer?: ReturnType<typeof setTimeout> | null;
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
  activePracticeTask?: {
    pointIndex: number;
    phase: 'teaching' | 'testing';
    pointTitle: string;
    guidanceOrScenario?: string;
  };
  testScores?: Map<number, boolean>;
  practiceTaskToolCalledThisTurn?: boolean;
  evaluationResult?: {
    isPassed: boolean;
    scorePercent: number;
    feedbackSinhala?: string;
    feedbackEnglish?: string;
  };
  supersededByReconnect?: boolean;
}

interface PersistentSessionAudioState {
  userAudioChunks: Buffer[];
  userTurnAudioMap: Map<number, Buffer>;
  userTurnTranscriptMap: Map<number, string>;
  userTurnCount: number;
  modelAudioChunks: Buffer[];
  modelTurnAudioMap: Map<number, Buffer>;
  modelTurnCount: number;
  chronologicalAudioTurns: Array<{ speaker: 'user' | 'model'; turnIdx: number; pcm: Buffer; sampleRate: number }>;
  authoritativeTurns: Array<{ role: 'user' | 'model'; text: string; timestamp: string }>;
  grammarCorrections: Array<{ studentSaid: string; moreNatural: string; explanation: string; highlightWords?: string[] }>;
  totalTextInTokens: number;
  totalAudioInTokens: number;
  totalAudioOutTokens: number;
  totalTextOutTokens: number;
  totalThoughtsTokens: number;
  firstConnectedAt: number;
  hasDispatchedGreeting: boolean;
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
  private readonly sessionStateById = new Map<string, PersistentSessionAudioState>();
  private readonly ai: GoogleGenAI;
  private readonly liveModel: string;

  constructor(
    private readonly sessionsService: SessionsService,
    private readonly authService: AuthService,
  ) {
    const apiKey = process.env.GEMINI_API_KEY || '';
    this.ai = new GoogleGenAI({ apiKey });
    this.liveModel = process.env.GEMINI_LIVE_MODEL || 'gemini-3.8-live';
  }

  handleConnection(client: WebSocket) {
    const sessionId = randomUUID();
    this.logger.log(`[${sessionId}] Client connected over WebSocket`);

    const state: ClientSessionState = {
      ws: client,
      sessionId,
      isConnectedToGemini: false,
      supportsOpus: false,
      opusEncoder: null,
      opusPcmBuffer: Buffer.alloc(0),
      userAudioChunks: [],
      currentUserTurnAudioChunks: [],
      userTurnAudioMap: new Map(),
      userTurnCount: 0,
      modelAudioChunks: [],
      currentModelTurnAudioChunks: [],
      modelTurnAudioMap: new Map(),
      modelTurnCount: 0,
      chronologicalAudioTurns: [],
      authoritativeTurns: [],
      grammarCorrections: [],
      userSpeechActive: false,
      hasDispatchedGreeting: false,
      isGreetingInProgress: false,
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

      // Greeting audio diagnosis
      greetingAudioChunksReceived: 0,
      greetingAudioBytesReceived: 0,
      greetingTranscriptReceived: '',
      greetingPacketCount: 0,
      greetingRawEvents: [],

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
      testScores: new Map<number, boolean>(),
    };
    this.clients.set(client, state);

    // Start ping/pong heartbeat with client
    this.startHeartbeat(client, state);

    client.on('message', async (data: RawData, isBinary: boolean) => {
      try {
        state.lastPongAt = Date.now();
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
      // Stop heartbeat and max duration timer
      this.stopHeartbeat(state);
      if (state.maxDurationTimer) {
        clearTimeout(state.maxDurationTimer);
        state.maxDurationTimer = null;
      }

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

      // Flush any final verified pending user turn audio (only commits if student speech was transcribed)
      this.commitPendingUserTurnAudio(state);
      state.currentUserTurnAudioChunks = [];

      // If model was still speaking when call closed, commit final turn audio
      if (state.currentModelTurnAudioChunks.length > 0) {
        const modelBuffer = Buffer.concat(state.currentModelTurnAudioChunks);
        state.modelTurnAudioMap.set(state.modelTurnCount, modelBuffer);
        state.chronologicalAudioTurns.push({
          speaker: 'model',
          turnIdx: state.modelTurnCount,
          pcm: modelBuffer,
          sampleRate: 24000,
        });
        state.modelTurnCount++;
        state.currentModelTurnAudioChunks = [];
      }

      this.syncPersistentSessionState(state);

      const hasAnotherActiveSocketForSession = Array.from(this.clients.entries()).some(
        ([otherClient, otherState]) =>
          otherClient !== client &&
          otherState.sessionId === state.sessionId &&
          otherClient.readyState === WebSocket.OPEN,
      );
      const isSupersededReconnect = Boolean(state.supersededByReconnect || hasAnotherActiveSocketForSession);

      // Save user, model, per-turn audio recordings, and chronological conversation to Supabase Storage
      if (
        !isSupersededReconnect &&
        (state.userAudioChunks.length > 0 ||
          state.modelAudioChunks.length > 0 ||
          state.userTurnAudioMap.size > 0 ||
          state.modelTurnAudioMap.size > 0)
      ) {
        const userPcm = state.userAudioChunks.length > 0 ? Buffer.concat(state.userAudioChunks) : undefined;
        const modelPcm = state.modelAudioChunks.length > 0 ? Buffer.concat(state.modelAudioChunks) : undefined;
        this.logger.log(
          `[${sid}] 💾 Finalizing and saving session audio recordings to Supabase (${state.userTurnAudioMap.size} user turns, ${state.modelTurnAudioMap.size} model turns, ${state.chronologicalAudioTurns.length} chronological turns)...`,
        );
        this.sessionsService
          .saveSessionAudioRecordings(
            state.sessionId,
            userPcm,
            modelPcm,
            state.userTurnAudioMap,
            state.modelTurnAudioMap,
            state.chronologicalAudioTurns,
          )
          .catch((e: any) => {
            this.logger.warn(`[${sid}] Failed saving session audio recordings: ${e?.message}`);
          });
      }

      // Persist server-authoritative conversation turns directly to DB and conversation.json
      if (state.authoritativeTurns && state.authoritativeTurns.length > 0) {
        this.sessionsService.setAuthoritativeTurns(state.sessionId, state.authoritativeTurns);
        if (!isSupersededReconnect) {
          this.sessionsService.saveSessionTurns(state.sessionId, state.authoritativeTurns, state.dto?.topic).catch((e: any) => {
            this.logger.warn(`[${sid}] Failed saving authoritative turns on disconnect: ${e?.message}`);
          });
        }
      }

      // Auto-finalize session on server disconnect if real conversation/audio activity occurred.
      // This guarantees that when a user's phone dies, network drops, or browser closes abruptly,
      // the session is marked completed in public.sessions, recorded in usage_ledger (Admin Usage),
      // and practice minutes are accurately calculated and deducted from profiles.minutes_balance.
      const hadActivity =
        !isSupersededReconnect &&
        ((state.authoritativeTurns && state.authoritativeTurns.length > 0) ||
          state.userTurnCount > 0 ||
          state.modelTurnCount > 0 ||
          state.totalAudioInTokens > 0 ||
          state.totalAudioOutTokens > 0);

      if (hadActivity) {
        const isHeartbeatTimeout = state.sessionLog.some((e) => e.event === 'heartbeat_timeout');
        const isSocketError = state.sessionLog.some((e) => e.event === 'client_socket_error');
        const isAbruptDisconnect = isHeartbeatTimeout || isSocketError;

        // If heartbeat timed out (e.g. 30s without pong because phone died), use the time up to lastPongAt
        // so the student is only billed for actual connected time before their device lost power.
        const activeDurationSec = isHeartbeatTimeout && state.lastPongAt > state.connectedAt
          ? Math.max(5, Math.round((state.lastPongAt - state.connectedAt) / 1000))
          : Math.max(5, durationSec);

        const snapshotSessionId = state.sessionId;
        const snapshotUserId = state.userId || 'guest-user';
        const snapshotDto = state.dto;
        const snapshotTurns = [...state.authoritativeTurns];
        const snapshotCorrections = [...state.grammarCorrections];
        const snapshotEval = state.evaluationResult;
        const snapshotTokens = {
          textInTokens: state.totalTextInTokens || 520,
          audioInTokens: state.totalAudioInTokens || Math.max(150, state.userTurnCount * 320),
          audioOutTokens: state.totalAudioOutTokens || Math.max(250, state.modelTurnCount * 480),
          textOutTokens: state.totalTextOutTokens || Math.max(40, state.modelTurnCount * 35),
          thoughtsTokens: state.totalThoughtsTokens || 0,
        };
        const totalTok =
          snapshotTokens.textInTokens +
          snapshotTokens.audioInTokens +
          snapshotTokens.audioOutTokens +
          snapshotTokens.textOutTokens +
          snapshotTokens.thoughtsTokens;

        const runAutoFinalize = () => {
          this.logger.log(
            `[${snapshotSessionId}] 🛡️ Auto-finalizing session on disconnect (abrupt=${isAbruptDisconnect}, activeDuration=${activeDurationSec}s, turns=${snapshotTurns.length}, tokens=${totalTok})`,
          );
          this.sessionsService
            .finishSession(snapshotSessionId, snapshotUserId, {
              durationSeconds: activeDurationSec,
              tokensUsed: {
                ...snapshotTokens,
                totalTokens: totalTok,
                promptTokens: snapshotTokens.textInTokens + snapshotTokens.audioInTokens,
                responseTokens: snapshotTokens.audioOutTokens + snapshotTokens.textOutTokens + snapshotTokens.thoughtsTokens,
              },
              turns: snapshotTurns,
              grammarCorrections: snapshotCorrections,
              scores: snapshotEval?.scorePercent
                ? {
                    overall: snapshotEval.scorePercent,
                    fluency: snapshotEval.scorePercent,
                    grammar: snapshotEval.scorePercent,
                    pronunciation: snapshotEval.scorePercent,
                  }
                : undefined,
              userName: state.userName || snapshotDto?.userName || 'Learner',
              model: this.liveModel,
              topic: snapshotDto?.topic || 'English Speaking Practice',
              languageMode: snapshotDto?.languageMode || 'sinhala',
              sinhalaStyle: snapshotDto?.sinhalaStyle || 'balanced',
              isIntroCall: Boolean(snapshotDto?.isIntroCall),
              roadmapLevelId: snapshotDto?.roadmapLevelId,
              levelNumber: snapshotDto?.levelNumber,
            })
            .catch((err: any) => {
              this.logger.warn(`[${snapshotSessionId}] Auto-finalize on disconnect warning: ${err?.message}`);
            });
        };

        if (isAbruptDisconnect) {
          // Device/connection is dead; finalize immediately
          runAutoFinalize();
        } else {
          // Normal disconnect: give client 3 seconds to send HTTP POST /v1/sessions/:id/finish first,
          // then auto-finalize if client closed tab/app before HTTP request completed.
          setTimeout(runAutoFinalize, 3000);
        }
      }

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

  // ─── PERSISTENT SESSION STATE ACROSS RECONNECTS ──────────────────────────────

  private bindAndRestorePersistentSessionState(client: WebSocket, state: ClientSessionState) {
    const sid = state.sessionId;

    // If an older socket for the same sessionId is still open (e.g. half-open socket replaced by reconnect),
    // flush its verified audio turns, mark it superseded, and close it cleanly.
    for (const [otherClient, otherState] of this.clients.entries()) {
      if (otherClient !== client && otherState.sessionId === sid) {
        otherState.supersededByReconnect = true;
        this.commitPendingUserTurnAudio(otherState);
        otherState.currentUserTurnAudioChunks = [];
        if (otherState.currentModelTurnAudioChunks.length > 0) {
          const modelBuffer = Buffer.concat(otherState.currentModelTurnAudioChunks);
          otherState.modelTurnAudioMap.set(otherState.modelTurnCount, modelBuffer);
          otherState.chronologicalAudioTurns.push({
            speaker: 'model',
            turnIdx: otherState.modelTurnCount,
            pcm: modelBuffer,
            sampleRate: 24000,
          });
          otherState.modelTurnCount++;
          otherState.currentModelTurnAudioChunks = [];
        }
        this.syncPersistentSessionState(otherState);
        this.stopHeartbeat(otherState);
        try {
          otherClient.close(1000, 'Superseded by reconnected session');
        } catch {}
      }
    }

    let persistent = this.sessionStateById.get(sid);
    if (!persistent) {
      persistent = {
        userAudioChunks: state.userAudioChunks,
        userTurnAudioMap: state.userTurnAudioMap,
        userTurnTranscriptMap: new Map<number, string>(),
        userTurnCount: state.userTurnCount,
        modelAudioChunks: state.modelAudioChunks,
        modelTurnAudioMap: state.modelTurnAudioMap,
        modelTurnCount: state.modelTurnCount,
        chronologicalAudioTurns: state.chronologicalAudioTurns,
        authoritativeTurns: state.authoritativeTurns,
        grammarCorrections: state.grammarCorrections,
        totalTextInTokens: state.totalTextInTokens,
        totalAudioInTokens: state.totalAudioInTokens,
        totalAudioOutTokens: state.totalAudioOutTokens,
        totalTextOutTokens: state.totalTextOutTokens,
        totalThoughtsTokens: state.totalThoughtsTokens,
        firstConnectedAt: state.connectedAt,
        hasDispatchedGreeting: state.hasDispatchedGreeting,
      };
      this.sessionStateById.set(sid, persistent);
    } else {
      // Merge any early audio chunks captured before start_session arrived into the persistent buffers
      if (state.userAudioChunks.length > 0 && state.userAudioChunks !== persistent.userAudioChunks) {
        persistent.userAudioChunks.push(...state.userAudioChunks);
      }
      state.userAudioChunks = persistent.userAudioChunks;
      state.userTurnAudioMap = persistent.userTurnAudioMap;
      state.userTurnCount = persistent.userTurnCount;
      state.modelAudioChunks = persistent.modelAudioChunks;
      state.modelTurnAudioMap = persistent.modelTurnAudioMap;
      state.modelTurnCount = persistent.modelTurnCount;
      state.chronologicalAudioTurns = persistent.chronologicalAudioTurns;
      state.authoritativeTurns = persistent.authoritativeTurns;
      state.grammarCorrections = persistent.grammarCorrections;
      state.totalTextInTokens = persistent.totalTextInTokens;
      state.totalAudioInTokens = persistent.totalAudioInTokens;
      state.totalAudioOutTokens = persistent.totalAudioOutTokens;
      state.totalTextOutTokens = persistent.totalTextOutTokens;
      state.totalThoughtsTokens = persistent.totalThoughtsTokens;
      state.connectedAt = persistent.firstConnectedAt;
      state.hasDispatchedGreeting = persistent.hasDispatchedGreeting;

      this.logger.log(
        `[${sid}] 🔄 Restored cumulative session state on reconnect: ${state.userTurnCount} user turns, ${state.modelTurnCount} model turns, ${state.chronologicalAudioTurns.length} chronological audio segments, ${state.authoritativeTurns.length} transcript turns`,
      );
    }
  }

  private syncPersistentSessionState(state: ClientSessionState) {
    const persistent = this.sessionStateById.get(state.sessionId);
    if (!persistent) return;
    persistent.userTurnCount = Math.max(persistent.userTurnCount, state.userTurnCount);
    persistent.modelTurnCount = Math.max(persistent.modelTurnCount, state.modelTurnCount);
    persistent.totalTextInTokens = Math.max(persistent.totalTextInTokens, state.totalTextInTokens);
    persistent.totalAudioInTokens = Math.max(persistent.totalAudioInTokens, state.totalAudioInTokens);
    persistent.totalAudioOutTokens = Math.max(persistent.totalAudioOutTokens, state.totalAudioOutTokens);
    persistent.totalTextOutTokens = Math.max(persistent.totalTextOutTokens, state.totalTextOutTokens);
    persistent.totalThoughtsTokens = Math.max(persistent.totalThoughtsTokens, state.totalThoughtsTokens);
    persistent.hasDispatchedGreeting = persistent.hasDispatchedGreeting || state.hasDispatchedGreeting;
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
        this.logger.warn(`[${state.sessionId}] ❌ Heartbeat timeout - no pong for ${Math.round(sincePong / 1000)}s → closing stale client`);
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
        const rawSessionId = message.options?.sessionId || message.sessionId;
        if (rawSessionId) {
          state.sessionId = toValidUuid(rawSessionId);
        }
        state.dto = dto;
        this.bindAndRestorePersistentSessionState(client, state);

        // Verify user token & quota balance if token is provided
        let resolvedUserId: string | undefined;
        if (message.accessToken) {
          try {
            const userId = this.authService.validateAuthToken(message.accessToken);
            resolvedUserId = userId;
            state.userId = userId;
            const profile = await this.authService.getProfile(userId);
            if (profile?.display_name) {
              state.userName = profile.display_name;
              if (!dto.userName || dto.userName === 'Learner') {
                dto.userName = profile.display_name;
              }
            }
            if (!dto.isIntroCall && (profile.minutes_balance ?? 0) <= 0) {
              this.logger.warn(`[${state.sessionId}] ⛔ Blocking live session for user ${userId}: 0 minutes remaining`);
              this.safeSendToClient(
                state,
                JSON.stringify({
                  type: 'error',
                  message: 'Your practice minutes balance is 0. Please top up or upgrade your plan.',
                }),
              );
              client.close(1008, 'Insufficient practice minutes');
              return;
            }
          } catch (authErr: any) {
            this.logger.warn(`[${state.sessionId}] Token check note in start_session: ${authErr?.message}`);
          }
        }

        // Register active session in SessionsService so user_id, topic, and metadata are tracked on server
        await this.sessionsService.registerActiveSession(state.sessionId, {
          userId: resolvedUserId,
          userName: state.userName || dto.userName,
          model: this.liveModel,
          topic: dto.topic,
          scenarioId: dto.scenarioId,
          languageMode: dto.languageMode,
          sinhalaStyle: dto.sinhalaStyle,
          roadmapLevelId: dto.roadmapLevelId,
          isIntroCall: dto.isIntroCall,
          isReconnect: dto.isReconnect,
        });

        // Enforce server-side max session duration timer (+90s grace for intro guide & farewell wrap-up, max 30 min)
        if (state.maxDurationTimer) {
          clearTimeout(state.maxDurationTimer);
        }
        const requestedSec = Number(dto.durationSeconds) || 300;
        const maxAllowedMs = Math.min(requestedSec + 90, 1800) * 1000;
        state.maxDurationTimer = setTimeout(() => {
          this.logger.warn(`[${state.sessionId}] ⏰ Server max session duration (${Math.round(maxAllowedMs / 1000)}s) reached - closing live session`);
          try {
            state.geminiSession?.close?.();
          } catch {}
          try {
            client.close(1000, 'Max session duration reached');
          } catch {}
        }, maxAllowedMs);

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
        if (state.isGreetingInProgress) {
          this.logger.debug(`[${state.sessionId}] Suppressing user interrupt while opening greeting is in progress`);
          return;
        }
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
            const isIntro = state.dto?.isIntroCall === true;
            const isSinhala = state.dto?.languageMode === 'sinhala' || state.dto?.mode === 'sinhala_tutor';
            const studentName = (state.dto?.userName || '').trim() || 'the student';

            const wrapupNotice = isIntro
              ? isSinhala
                ? `[SYSTEM TIME NOTICE - INTRO CALL WRAP-UP]: The 2-minute introductory call is now complete. In your very next spoken turn: warmly praise ${studentName} for speaking with you today (e.g. "ගොඩක් හොඳයි ${studentName}!"), explain that based on this quick chat their personalized daily learning plan is now ready, speak a cheerful goodbye, and call tool conclude_call. Deliver this in under 15 seconds with zero test scoring.`
                : `[SYSTEM TIME NOTICE - INTRO CALL WRAP-UP]: The 2-minute introductory call is now complete. In your very next spoken turn: warmly praise ${studentName} for speaking with you today, let them know their personalized daily learning roadmap is now ready, speak an enthusiastic goodbye, and call tool conclude_call. Deliver this in under 15 seconds with zero test scoring.`
              : `[SYSTEM TIME NOTICE: The practice session time has ended. Right now, in your current spoken turn, wrap up naturally: share 1 short encouraging observation about how they did today, thank them warmly, speak your cheerful goodbye aloud, and then call conclude_call. Keep your farewell brief (under 15 seconds of speech).]`;

            if (state.userSpeechActive) {
              try {
                state.geminiSession.sendRealtimeInput({ activityEnd: {} });
              } catch {}
              state.userSpeechActive = false;
            }
            state.geminiSession.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: wrapupNotice,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
            this.logger.log(`[${state.sessionId}] ⏰ Time wrapup cue dispatched to Gemini Live (isIntro: ${isIntro})`);
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
            if (state.userSpeechActive) {
              try {
                state.geminiSession.sendRealtimeInput({ activityEnd: {} });
              } catch {}
              state.userSpeechActive = false;
            }
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
    if (!state) return;

    if (buffer && buffer.length > 0) {
      state.userAudioChunks.push(buffer);
      state.currentUserTurnAudioChunks.push(buffer);
    }

    if (!state.geminiSession || !state.isConnectedToGemini) return;

    if (state.isGreetingInProgress) {
      // Opening turn greeting is in progress. Suppress user mic audio and activityStart
      // so ambient noise or early mic streaming does not cancel/interrupt Maya's initial greeting.
      return;
    }

    try {
      // Manual VAD: signal activityStart on the first chunk of a new speech burst.
      // Gemini will not process audio until it receives this signal.
      if (!state.userSpeechActive) {
        state.userSpeechActive = true;
        state.geminiSession.sendRealtimeInput({ activityStart: {} });
        this.logger.debug(`[${state.sessionId}] 🎙️ activityStart sent - user speech burst began`);
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

    if (state.isGreetingInProgress) {
      this.logger.debug(`[${state.sessionId}] Suppressing handleEndOfTurn during opening greeting`);
      return;
    }

    try {
      this.logger.log(`[${state.sessionId}] 🚀 Turn Complete: Sending activityEnd to Gemini Live`);

      // Manual VAD: signal activityEnd so Gemini immediately processes all accumulated audio.
      // This replaces the old approach of sending silence frames + clientContent.turnComplete
      // which only affected text turns and was invisible to Gemini's audio pipeline.
      if (state.userSpeechActive) {
        state.geminiSession.sendRealtimeInput({ activityEnd: {} });
        state.userSpeechActive = false;
        this.logger.debug(`[${state.sessionId}] 🛑 activityEnd sent - user speech burst ended`);
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

  private commitPendingUserTurnAudio(state: ClientSessionState) {
    if (state.currentUserTurnAudioChunks.length === 0) return;

    // Check if Gemini actually transcribed student words for this speech segment
    const transcribedText = (state.userTranscriptAccumulator || state.lastStudentTranscript).trim();

    // If NO transcription was recognized (e.g. ambient noise, throat clearing, breathing, thinking hum),
    // do NOT commit as an isolated user turn. This prevents creating ghost audio turns that misalign
    // history transcript turns and audio clips!
    if (!transcribedText) {
      if (state.hasModelSpokenThisTurn) {
        this.logger.debug(
          `[${state.sessionId}] 🔇 Discarding untranscribed acoustic noise buffer (${(Buffer.concat(state.currentUserTurnAudioChunks).length / 1024).toFixed(1)} KB) - no student words recognized`
        );
        state.currentUserTurnAudioChunks = [];
      }
      return;
    }

    const turnBuffer = Buffer.concat(state.currentUserTurnAudioChunks);
    state.currentUserTurnAudioChunks = [];

    // If student text was recognized, commit audio if buffer has data
    if (turnBuffer.length > 0) {
      const currentTurnIdx = state.userTurnCount;
      state.userTurnAudioMap.set(currentTurnIdx, turnBuffer);
      state.chronologicalAudioTurns.push({
        speaker: 'user',
        turnIdx: currentTurnIdx,
        pcm: turnBuffer,
        sampleRate: 16000,
      });
      this.logger.log(
        `[${state.sessionId}] 🎙️ Committed verified user turn ${currentTurnIdx} audio (${(turnBuffer.length / 1024).toFixed(1)} KB) for speech: "${transcribedText.slice(0, 50)}"`
      );
      state.userTurnCount++;
      this.syncPersistentSessionState(state);

      // Progressively upload turn audio in background so it is instantly available in Cloud storage
      this.sessionsService
        .uploadSingleTurnAudio(state.sessionId, currentTurnIdx, turnBuffer, 'user', transcribedText)
        .catch(() => {});
    }
  }

  private async initGeminiLiveSession(
    client: WebSocket,
    state: ClientSessionState,
    dto: CreateSessionTokenDto,
  ) {
    try {
      // Ensure roadmap curriculum details are fully loaded
      await this.sessionsService.enrichRoadmapDto(dto);

      const isSinhala = dto.languageMode === 'sinhala' || dto.mode === 'sinhala_tutor';
      const isScenarioRoleplay = Boolean(dto.scenarioPrompt && dto.scenarioPrompt.trim().length > 0);
      const systemInstruction = this.sessionsService.getSystemPrompt(dto);
      const toolsDeclaration = this.sessionsService.getToolsDeclaration(
        isScenarioRoleplay ? false : (dto.aiSuggestions !== false),
        isSinhala,
      );
      const greetingPrompt = this.sessionsService.generateGreetingPrompt(dto);
      const voiceName = this.sessionsService.getVoiceForSession(dto);

      this.logger.log(`[${state.sessionId}] Connecting to Gemini Live API (${this.liveModel}) [voice: ${voiceName}, scenario: ${isScenarioRoleplay}]...`);
      this.addSessionLog(state, 'gemini_connecting', `model=${this.liveModel} voice=${voiceName}`);

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
          // thinkingConfig omitted: unsupported on gemini-3.8-live and suppresses interleaved reasoning
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
            this.logger.log(`[${state.sessionId}] 🔌 WebSocket transport opened with Gemini Live API`);
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
      state.isConnectedToGemini = true;
      state.geminiConnectedAt = Date.now();
      this.logger.log(`[${state.sessionId}] ✅ Gemini Live session established and ready`);
      this.addSessionLog(state, 'gemini_connected');

      // Notify client that session is ready (sent AFTER Gemini handshake completed)
      this.safeSendToClient(state, JSON.stringify({
        type: 'ready',
        model: this.liveModel,
        voiceName,
      }));

      // If roadmap curriculum session with practice points (and not in custom scenario mode), proactively prime Task 0 on client
      if (!dto.scenarioPrompt && dto.practicePoints && dto.practicePoints.length > 0) {
        const firstPoint = dto.practicePoints[0];
        state.activePracticeTask = {
          pointIndex: 0,
          phase: 'teaching',
          pointTitle: firstPoint,
          guidanceOrScenario: '',
        };
        this.safeSendToClient(state, JSON.stringify({
          type: 'tool_call',
          name: 'set_active_practice_task',
          args: {
            pointIndex: 0,
            phase: 'teaching',
            taskTitle: firstPoint,
            hint: '',
          },
        }));
      }

      // Dispatch opening turn greeting prompt if no prior in-call turns exist (only skip if this is a mid-call socket reconnect with existing turns)
      const hasExistingInCallTurns = Boolean(dto.isReconnect && dto.memory && dto.memory.trim().length > 0);
      if (!hasExistingInCallTurns && greetingPrompt && !state.hasDispatchedGreeting) {
        state.hasDispatchedGreeting = true;
        state.isGreetingInProgress = true;
        state.greetingAudioChunksReceived = 0;
        state.greetingAudioBytesReceived = 0;
        state.greetingTranscriptReceived = '';
        state.greetingPacketCount = 0;
        state.greetingRawEvents = [];

        const scenarioEmotion = (dto.emotionTags && dto.emotionTags[0] ? dto.emotionTags[0] : '').trim();
        const voiceDirective = isScenarioRoleplay
          ? `[ACTING & PROSODY DIRECTIVE: Perform this opening line with 100% vocal emotion (${scenarioEmotion || 'Angry, impatient, sharp, fast pace'}). Do NOT sound like a polite AI assistant. Speak immediately in character!]`
          : `[SYSTEM VOICE DIRECTIVE: Speak your response aloud using natural voice output.]`;

        // Wait 160ms after setupComplete so Gemini's initial `sessionResumptionUpdate` (+1ms) packet
        // settles before sending `sendClientContent`. Sending at +0ms races with sessionResumptionUpdate
        // and causes Gemini to buffer the prompt without triggering audio synthesis until the user speaks.
        setTimeout(() => {
          if (!state.isConnectedToGemini || !state.geminiSession) return;

          state.greetingDispatchedAt = Date.now();
          state.turnEndTimestamp = Date.now();
          state.awaitingGeminiResponse = true;

          const msSinceConnect = state.geminiConnectedAt ? `${Date.now() - state.geminiConnectedAt}ms` : 'unknown';
          this.logger.log(`[${state.sessionId}] 🚀 [Greeting Dispatch] Sending opening greeting prompt to Gemini Live (Native Audio Mode, +${msSinceConnect} post-connect)`);
          this.logger.log(`[${state.sessionId}] 📜 [Greeting Prompt Preview]: "${greetingPrompt.slice(0, 150)}..."`);
          this.addSessionLog(state, 'greeting_dispatched', `+${msSinceConnect}: ${greetingPrompt.slice(0, 100)}`);

          const t0 = Date.now();
          if (state.userSpeechActive) {
            try {
              session.sendRealtimeInput({ activityEnd: {} });
            } catch {}
            state.userSpeechActive = false;
          }
          try {
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [{ text: `${greetingPrompt}\n${voiceDirective}` }],
                },
              ],
              turnComplete: true,
            });
            const dispatchDurationMs = Date.now() - t0;
            this.logger.log(`[${state.sessionId}] 📤 [Greeting Dispatch] ClientContent turn delivered in ${dispatchDurationMs}ms (awaiting native Gemini Live audio)`);
          } catch (sendErr: any) {
            this.logger.warn(`[${state.sessionId}] Greeting sendClientContent error: ${sendErr?.message}`);
          }

          // Fast 2.3s auto-retry nudge: if Gemini buffered the greeting without emitting audio chunks,
          // re-trigger turnComplete so Maya speaks immediately without waiting for the user to speak first.
          setTimeout(() => {
            if (
              state.isGreetingInProgress &&
              state.greetingAudioChunksReceived === 0 &&
              state.isConnectedToGemini &&
              state.geminiSession
            ) {
              this.logger.warn(
                `[${state.sessionId}] 🔄 [Greeting Auto-Retry] 0 audio chunks after 2.3s — sending wakeup nudge to Gemini Live`,
              );
              this.addSessionLog(state, 'greeting_auto_retry_nudge');
              try {
                state.turnEndTimestamp = Date.now();
                state.geminiSession.sendClientContent({
                  turns: [
                    {
                      role: 'user',
                      parts: [{ text: 'Please start speaking your opening greeting aloud now.' }],
                    },
                  ],
                  turnComplete: true,
                });
              } catch (retryErr: any) {
                this.logger.warn(`[${state.sessionId}] Greeting auto-retry error: ${retryErr?.message}`);
              }
            }
          }, 2300);

          // Safety watchdog: after 8s, unlock audio input even if Gemini drops the turn
          setTimeout(() => {
            if (state.isGreetingInProgress) {
              this.logger.warn(
                `[${state.sessionId}] ⚠️ [Greeting Watchdog] Expired (8s) - unlocking user audio gate\n` +
                `   Audio chunks received: ${state.greetingAudioChunksReceived} (${(state.greetingAudioBytesReceived / 1024).toFixed(1)} KB)\n` +
                `   Total packets received: ${state.greetingPacketCount}\n` +
                `   Raw packet timeline:\n` +
                (state.greetingRawEvents.length > 0
                  ? state.greetingRawEvents.map((e) => `      - ${e}`).join('\n')
                  : '      (no Gemini packets received during greeting window)'),
              );
              state.isGreetingInProgress = false;
              state.awaitingGeminiResponse = false;
            }
          }, 8000);
        }, 160);
      } else if (hasExistingInCallTurns && !state.hasDispatchedGreeting) {
        state.hasDispatchedGreeting = true;
        state.isGreetingInProgress = false;
        this.logger.log(`[${state.sessionId}] Reconnected session / existing memory present -> skipping opening greeting prompt`);
        this.addSessionLog(state, 'greeting_skipped_reconnect');
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

  private cleanLiveTranscriptText(text: string): string {
    if (!text) return text;
    return text
      .replace(/தேவையான/g, 'අවශ්‍ය')
      .replace(/வணக்கம்/g, 'ආයුබෝවන්')
      .replace(/[\u0B80-\u0BFF\u0900-\u097F\u0600-\u06FF\u0980-\u0CFF\u0D00-\u0D7F]+/g, '');
  }

  private handleGeminiServerMessage(
    client: WebSocket,
    state: ClientSessionState,
    response: any,
    session: any,
  ) {
    const keys = Object.keys(response || {});

    // Diagnostic trace for setupComplete
    if (response?.setupComplete) {
      const elapsedFromConnect = state.geminiConnectedAt ? `${Date.now() - state.geminiConnectedAt}ms` : 'unknown';
      this.logger.log(`[${state.sessionId}] ⚙️ [Gemini Server] setupComplete received (+${elapsedFromConnect} post-connect)`);
      this.addSessionLog(state, 'gemini_setup_complete', `+${elapsedFromConnect}`);
    }

    // High-resolution packet tracing during opening greeting phase
    if (state.isGreetingInProgress) {
      state.greetingPacketCount++;
      const elapsedMs = state.greetingDispatchedAt ? Date.now() - state.greetingDispatchedAt : 0;
      let detail = `keys=[${keys.join(', ')}]`;

      if (response.serverContent) {
        const scKeys = Object.keys(response.serverContent);
        detail += ` serverContent=[${scKeys.join(', ')}]`;

        if (response.serverContent.modelTurn?.parts) {
          const partSummaries = response.serverContent.modelTurn.parts.map((p: any, idx: number) => {
            if (p.inlineData) {
              const byteLen = p.inlineData.data ? Buffer.from(p.inlineData.data, 'base64').length : 0;
              return `p#${idx}:audio(${p.inlineData.mimeType || 'unknown'},${byteLen}B)`;
            }
            if (p.text) {
              return `p#${idx}:text("${p.text.slice(0, 30)}")`;
            }
            if (p.thought) {
              return `p#${idx}:thought`;
            }
            return `p#${idx}:${Object.keys(p).join('+')}`;
          });
          detail += ` parts=[${partSummaries.join(', ')}]`;
        }

        if (response.serverContent.outputTranscription?.text) {
          detail += ` transcript="${response.serverContent.outputTranscription.text.slice(0, 30)}"`;
        }
        if (response.serverContent.interrupted) {
          detail += ` [INTERRUPTED]`;
        }
        if (response.serverContent.turnComplete) {
          detail += ` [TURN_COMPLETE]`;
        }
      }

      if (response.toolCall) {
        detail += ` toolCall=[${response.toolCall.functionCalls?.map((f: any) => f.name).join(', ')}]`;
      }

      const logMsg = `[${state.sessionId}] 📦 [Greeting Packet #${state.greetingPacketCount}] (+${elapsedMs}ms) ${detail}`;
      this.logger.log(logMsg);
      state.greetingRawEvents.push(`+${elapsedMs}ms: ${detail}`);
    }

    const serverContent = response.serverContent;

    // If Gemini started responding or transcribing, commit any verified pending user speech audio
    if (serverContent?.inputTranscription || serverContent?.modelTurn) {
      this.commitPendingUserTurnAudio(state);
    }

    // 1. Process Model Audio Turn Chunks
    if (serverContent?.modelTurn?.parts) {
      for (const part of serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          state.hasModelSpokenThisTurn = true;
          const chunkBuffer = Buffer.from(part.inlineData.data, 'base64');
          if (chunkBuffer.length > 0) {
            state.modelAudioChunks.push(chunkBuffer);
            state.currentModelTurnAudioChunks.push(chunkBuffer);
          }

          if (state.isGreetingInProgress) {
            state.greetingAudioChunksReceived++;
            state.greetingAudioBytesReceived += chunkBuffer.length;
            if (state.greetingAudioChunksReceived <= 3 || state.greetingAudioChunksReceived % 10 === 0) {
              this.logger.log(
                `[${state.sessionId}] 🔊 [Greeting Audio Chunk #${state.greetingAudioChunksReceived}] Received ${chunkBuffer.length} bytes (Total: ${(state.greetingAudioBytesReceived / 1024).toFixed(1)} KB, Opus: ${state.supportsOpus})`,
              );
            }
          }

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
      const rawText = serverContent.outputTranscription.text;
      const text = this.cleanLiveTranscriptText(rawText);
      state.modelTranscriptAccumulator += text;
      state.hasModelSpokenThisTurn = true;

      if (state.isGreetingInProgress) {
        state.greetingTranscriptReceived += text;
        this.logger.log(`[${state.sessionId}] 📝 [Greeting Transcript Chunk]: "${text}"`);
      }

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
      if (state.isGreetingInProgress) {
        this.logger.debug(
          `[${state.sessionId}] 🔇 Suppressing ASR artifact during opening greeting generation: "${serverContent.inputTranscription.text}"`
        );
      } else {
        const text = serverContent.inputTranscription.text;
        state.userTranscriptAccumulator += text;
        state.lastStudentTranscript += text;
        this.logger.log(`[${state.sessionId}] 📝 [Student Said Chunk]: "${text}"`);
        this.safeSendToClient(state, JSON.stringify({
          type: 'input_transcript',
          text,
        }));
      }
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

      const modelText = this.cleanLiveTranscriptText(state.modelTranscriptAccumulator.trim());
      const isGreetingTurn = state.isGreetingInProgress;
      if (state.isGreetingInProgress) {
        state.isGreetingInProgress = false;
        state.userTranscriptAccumulator = '';
        state.lastStudentTranscript = '';
        state.currentUserTurnAudioChunks = [];
        const totalGreetingDuration = state.greetingDispatchedAt ? Date.now() - state.greetingDispatchedAt : 0;

        if (state.greetingAudioChunksReceived > 0) {
          this.logger.log(
            `[${state.sessionId}] 🌟 [Greeting Diagnosis: SUCCESS] (+${totalGreetingDuration}ms from dispatch)\n` +
            `   🔊 Native Audio: ${state.greetingAudioChunksReceived} chunks (${(state.greetingAudioBytesReceived / 1024).toFixed(1)} KB)\n` +
            `   💬 Subtitles: "${modelText || state.greetingTranscriptReceived}"\n` +
            `   📦 Inbound Packets: ${state.greetingPacketCount}\n` +
            `   ✅ Status: Greeting audio generated and streamed to client cleanly`,
          );
          this.addSessionLog(
            state,
            'greeting_diagnosis_success',
            `${state.greetingAudioChunksReceived} chunks, ${(state.greetingAudioBytesReceived / 1024).toFixed(1)} KB in ${totalGreetingDuration}ms`,
          );
        } else {
          this.logger.error(
            `[${state.sessionId}] 🚨 [Greeting Diagnosis: AUDIO MISSING ALERT] (+${totalGreetingDuration}ms from dispatch)\n` +
            `   ⚠️ Gemini Live returned 0 inlineData audio chunks for greeting!\n` +
            `   💬 Returned Text: "${modelText || state.greetingTranscriptReceived}"\n` +
            `   📦 Inbound Packets: ${state.greetingPacketCount}\n` +
            `   📜 Packet Timeline:\n` +
            (state.greetingRawEvents.length > 0
              ? state.greetingRawEvents.map((e) => `      - ${e}`).join('\n')
              : '      (no packets received)') + '\n' +
            `   ❌ This indicates Gemini Live generated text without audio frames.`,
          );
          this.addSessionLog(
            state,
            'greeting_diagnosis_audio_missing',
            `packets=${state.greetingPacketCount} text="${(modelText || state.greetingTranscriptReceived).slice(0, 100)}" in ${totalGreetingDuration}ms`,
          );
        }
      }

      const userText = isGreetingTurn ? '' : (state.userTranscriptAccumulator || state.lastStudentTranscript).trim();

      // Only print turn complete summary when the model actually responded or when user turn finished
      if (state.hasModelSpokenThisTurn || modelText) {
        this.logger.log(
          `[${state.sessionId}] 🤖 [Model Turn Complete]\n` +
          `   🗣️ User Said: "${userText || (isGreetingTurn ? '(opening greeting / model first)' : '(untranscribed / audio speech)')}"\n` +
          `   💬 Maya Replied: "${modelText || '(audio only)'}"`
        );
        this.addSessionLog(state, 'model_turn_complete', `user="${userText?.slice(0, 80)}" maya="${modelText?.slice(0, 80)}"`);

        // Commit verified user turn audio for this exchange (only if student actually spoke words and not greeting)
        if (!isGreetingTurn) {
          this.commitPendingUserTurnAudio(state);
        }
        state.currentUserTurnAudioChunks = [];

        // Commit isolated model turn audio
        if (state.currentModelTurnAudioChunks.length > 0) {
          const modelTurnBuffer = Buffer.concat(state.currentModelTurnAudioChunks);
          const currentTurnIdx = state.modelTurnCount;
          state.modelTurnAudioMap.set(currentTurnIdx, modelTurnBuffer);
          state.chronologicalAudioTurns.push({
            speaker: 'model',
            turnIdx: currentTurnIdx,
            pcm: modelTurnBuffer,
            sampleRate: 24000,
          });
          this.logger.log(`[${state.sessionId}] 🤖 Captured model turn ${currentTurnIdx} audio (${(modelTurnBuffer.length / 1024).toFixed(1)} KB)`);
          state.modelTurnCount++;
          state.currentModelTurnAudioChunks = [];
          this.syncPersistentSessionState(state);

          this.sessionsService
            .uploadSingleTurnAudio(state.sessionId, currentTurnIdx, modelTurnBuffer, 'model', modelText)
            .catch(() => {});
        } else if (modelText) {
          // Model turn completed with text only (no TTS per user constraint)
          state.modelTurnCount++;
          this.syncPersistentSessionState(state);
        }

        // Record authoritative server-verified conversation turns
        if (userText && !isGreetingTurn) {
          state.authoritativeTurns.push({
            role: 'user',
            text: userText,
            timestamp: new Date().toISOString(),
          });
        }
        if (modelText) {
          state.authoritativeTurns.push({
            role: 'model',
            text: modelText,
            timestamp: new Date().toISOString(),
          });
        }
        this.sessionsService.setAuthoritativeTurns(state.sessionId, state.authoritativeTurns);

        // Turn fully complete: clear accumulators for the next conversational exchange
        state.userTranscriptAccumulator = '';
        state.lastStudentTranscript = '';
        state.modelTranscriptAccumulator = '';
        state.currentUserTurnAudioChunks = [];
        state.hasModelSpokenThisTurn = false;
        state.practiceTaskToolCalledThisTurn = false;
        this.safeSendToClient(state, JSON.stringify({
          type: 'turn_complete',
          userText: userText || undefined,
          modelText: modelText || undefined,
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
      if (state.isGreetingInProgress) {
        this.logger.warn(`[${state.sessionId}] 🛡️ Shielded: ignoring interruption during opening greeting generation`);
        return;
      }
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
      const isRoadmap = Boolean(
        state.dto?.roadmapLevelId ||
        (state.dto?.practicePoints && state.dto.practicePoints.length > 0)
      );

      for (const fc of response.toolCall.functionCalls) {
        const args = (fc.args || {}) as any;
        this.logger.log(`[${state.sessionId}] 🛠️ Tool Call invoked: ${fc.name}`);
        this.addSessionLog(state, 'tool_call', fc.name);

        if (fc.name === 'conclude_call') {
          const isIntro = state.dto?.isIntroCall === true;
          const isScenario = Boolean(state.dto?.scenarioPrompt && state.dto?.scenarioPrompt.trim().length > 0);
          const turnsCompleted = state.userTurnCount || 0;

          // If this is a scenario roleplay session and user has spoken less than 8 turns, block premature conclusion!
          if (isScenario && turnsCompleted < 8 && !isIntro) {
            this.logger.warn(
              `[${state.sessionId}] ⏳ Blocked premature conclude_call in scenario mode: only ${turnsCompleted}/8 turns completed. Instructing model to continue dialogue.`,
            );
            functionResponses.push({
              name: fc.name,
              id: fc.id,
              response: {
                result: 'continue_roleplay',
                instruction: `DO NOT conclude the call yet! The scenario requires at least 8 to 10 back-and-forth turns of speaking practice. The student has only spoken ${turnsCompleted} turns so far. In character, continue the dialogue: ask for clarification, counter-offer with alternatives/perks, explore their preferences, or present realistic challenges. Keep the negotiation going naturally!`,
              },
            });
            continue;
          }

          // Forward to client so UI displays farewell and wraps up gracefully
          this.safeSendToClient(state, JSON.stringify({
            type: 'tool_call',
            name: fc.name,
            args: fc.args,
          }));

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'concluding',
              instruction: isIntro
                ? (isSinhala
                    ? 'The introductory call is concluding right now. Speak a warm, cheerful 1-sentence final goodbye statement (e.g. "ඔයාගේ personalized roadmap එක දැන් ready, see you in your next practice session!"). ABSOLUTELY NEVER ASK ANY QUESTION. STRICTLY FORBIDDEN TO USE "?" OR ASK "ප්‍රශ්න තියෙනවද?". Then stop speaking.'
                    : 'The introductory call is concluding right now. Speak a warm, cheerful 1-sentence final goodbye statement (e.g. "Your personalized daily learning plan is ready, see you in our first practice session!"). ABSOLUTELY NEVER ASK ANY QUESTION. Then stop speaking.')
                : (isSinhala
                    ? 'The call is terminating right now. Speak a warm, 1-sentence definitive final goodbye statement (e.g. wishing them a great day or to keep practicing). ABSOLUTELY NEVER ASK ANY QUESTION. STRICTLY FORBIDDEN TO USE "?" OR ASK "ප්‍රශ්න තියෙනවද?" OR "කරමුද?". Then stop speaking.'
                    : 'The call is terminating right now. Speak a warm, 1-sentence definitive final goodbye statement (e.g. wishing them a great day or to keep practicing). ABSOLUTELY NEVER ASK ANY QUESTION. STRICTLY FORBIDDEN TO USE "?" OR ASK ANY QUESTION. Then stop speaking.'),
            },
          });
        } else if (fc.name === 'show_grammar_correction') {
          const shortKeyPhrase = String(args.moreNatural || args.more_natural || '').split(/[.,;!?]/)[0].trim().replace(/"/g, "'");
          const rawExplanation = String(args.explanation || '').replace(/"/g, "'");
          let instruction: string;

          state.grammarCorrections.push({
            studentSaid: String(args.studentSaid || args.student_said || ''),
            moreNatural: String(args.moreNatural || args.more_natural || ''),
            explanation: String(args.explanation || ''),
            highlightWords: Array.isArray(args.highlightWords) ? args.highlightWords : [],
          });

          // Forward to client so UI displays the animated grammar feedback drawer / card
          this.safeSendToClient(state, JSON.stringify({
            type: 'tool_call',
            name: fc.name,
            args: fc.args,
          }));

          if (isRoadmap) {
            instruction = isSinhala
              ? `Correction card displayed to student. In friendly spoken Sinhala: explain why it was wrong, model the correct English phrase "${shortKeyPhrase}", and explicitly ask the student to repeat it aloud (say "මේක කියලා බලන්න: '${shortKeyPhrase}'"). STRICTLY DO NOT ask your next question yet. DO NOT advance to the next step. Wait for the student to repeat.`
              : `Correction card displayed to student. Verbally explain the correction, model the correct phrase "${shortKeyPhrase}", and explicitly ask the student to repeat it aloud (say "Try saying: '${shortKeyPhrase}'"). DO NOT ask your next question yet. Wait for the student to repeat.`;
          } else {
            instruction = isSinhala
              ? isDeepGuidance
                ? `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න"), and immediately ask your next short English question. Total turn strictly under 12 words.`
              : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`;
          }

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'displayed_to_student',
              instruction,
            },
          });
        } else if (fc.name === 'show_rephrase_suggestion') {
          const shortKeyPhrase = String(args.moreNatural || args.more_natural || '').split(/[.,;!?]/)[0].trim().replace(/"/g, "'");
          const rawExplanation = String(args.explanation || '').replace(/"/g, "'");
          let instruction: string;

          state.grammarCorrections.push({
            studentSaid: String(args.studentSaid || args.student_said || ''),
            moreNatural: String(args.moreNatural || args.more_natural || ''),
            explanation: String(args.explanation || ''),
            highlightWords: Array.isArray(args.highlightWords) ? args.highlightWords : [],
          });

          // Forward to client so UI displays the animated rephrase feedback drawer / card
          this.safeSendToClient(state, JSON.stringify({
            type: 'tool_call',
            name: fc.name,
            args: fc.args,
          }));

          if (isRoadmap) {
            instruction = isSinhala
              ? `Rephrase card displayed to student. In friendly spoken Sinhala: explain why this phrasing is more natural, model the natural phrase "${shortKeyPhrase}", and explicitly ask the student to repeat it aloud (say "මේක කියලා බලන්න: '${shortKeyPhrase}'"). STRICTLY DO NOT ask your next question yet. DO NOT advance to the next step. Wait for the student to repeat.`
              : `Rephrase card displayed to student. Verbally model the natural phrase "${shortKeyPhrase}", and explicitly ask the student to repeat it aloud (say "Try saying: '${shortKeyPhrase}'"). DO NOT ask your next question yet. Wait for the student to repeat.`;
          } else {
            instruction = isSinhala
              ? isDeepGuidance
                ? `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්"), and immediately ask your next short English question. Total turn strictly under 12 words.`
              : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`;
          }

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'displayed_to_student',
              instruction,
            },
          });
        } else if (fc.name === 'set_active_practice_task') {
          const pointIndex = Number(args.pointIndex) || 0;
          const phase = (args.phase === 'testing' ? 'testing' : 'teaching') as 'teaching' | 'testing';
          const pointTitle = String(args.taskTitle || args.pointTitle || '').trim();
          const guidanceOrScenario = String(args.hint || args.guidanceOrScenario || '').trim();

          state.activePracticeTask = {
            pointIndex,
            phase,
            pointTitle,
            guidanceOrScenario,
          };

          this.safeSendToClient(state, JSON.stringify({
            type: 'practice_task_update',
            pointIndex,
            phase,
            pointTitle,
            guidanceOrScenario,
          }));

          state.practiceTaskToolCalledThisTurn = true;

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'task_card_displayed',
            },
          });
        } else if (fc.name === 'record_test_score') {
          const pointIndex = Number(args.pointIndex) || 0;
          const passed = Boolean(args.passed);
          const note = String(args.note || args.studentSaidSummary || '');

          if (!state.testScores) {
            state.testScores = new Map<number, boolean>();
          }
          state.testScores.set(pointIndex, passed);

          const allScores = Array.from(state.testScores.entries())
            .map(([idx, p]) => `#${idx}:${p ? 'PASS' : 'FAIL'}`)
            .join(', ');
          this.logger.log(
            `[${state.sessionId}] 📝 [record_test_score] Point ${pointIndex}: passed=${passed ? 'YES' : 'NO'} | Note: "${note}" | Current Progress: [${allScores}]`,
          );

          this.safeSendToClient(state, JSON.stringify({
            type: 'test_score_update',
            pointIndex,
            passed,
            note,
          }));

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'test_score_recorded',
            },
          });
        } else if (fc.name === 'conclude_level_evaluation') {
          const isPassed = Boolean(args.isPassed);
          const scorePercent = Number(args.scorePercent) || 0;
          const feedbackSinhala = String(args.feedbackSinhala || '').trim();
          const feedbackEnglish = String(args.feedbackEnglish || '').trim();

          state.evaluationResult = {
            isPassed,
            scorePercent,
            feedbackSinhala,
            feedbackEnglish,
          };

          this.logger.log(
            `[${state.sessionId}] 🏆 [conclude_level_evaluation] Score: ${scorePercent}% | Passed: ${isPassed ? 'YES' : 'NO'} | Feedback (Sinhala): "${feedbackSinhala}" | Feedback (English): "${feedbackEnglish}"`,
          );

          this.safeSendToClient(state, JSON.stringify({
            type: 'level_evaluation_completed',
            isPassed,
            scorePercent,
            feedbackSinhala,
            feedbackEnglish,
          }));

          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'evaluation_completed',
              instruction: isSinhala
                ? 'Evaluation finalized. In your own natural, spontaneous spoken everyday Sinhala (කතා කරන බසින්, strictly NO canned scripts): deliver your definitive closing verdict to the student. State whether they passed and unlocked the next level or need to re-attempt, highlighting specific feedback. STRICTLY NEVER ASK A QUESTION (NO "?", NO "කරමුද?"), then call conclude_call.'
                : 'Evaluation finalized. In your own natural, spontaneous spoken words: deliver your definitive closing verdict to the student. State whether they passed and unlocked the next level or need to re-attempt, highlighting specific feedback. STRICTLY NEVER ASK A QUESTION, then call conclude_call.',
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
