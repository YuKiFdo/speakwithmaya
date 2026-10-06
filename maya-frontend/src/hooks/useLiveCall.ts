import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createAudioCapture } from '@/services/audio/AudioCapture';
import { createAudioPlayer } from '@/services/audio/AudioPlayer';
import { LiveTransport, ILiveTransport, GrammarCorrectionPayload, RephraseSuggestionPayload, RecordedObjectivePayload } from '@/services/gemini/LiveTransport';
import { ServerLiveTransport } from '@/services/gemini/ServerLiveTransport';
import { persistSessionRecord, SessionHistoryRecord, getAuthHeaders } from '@/services/supabase';
import { GrammarFeedbackData } from '@/components/call/grammar-feedback-modal';
import { MicPermissionErrorType } from '@/components/call/microphone-permission-popup';
import { MissionReportData, MissionObjectiveResult } from '@/components/roadmap/mission-report-modal';
import { getLogTimestamp } from '@/utils/time';

// Default to true (Server-to-Server NestJS Gateway) unless explicitly set to 'false'
const USE_SERVER_LIVE = process.env.EXPO_PUBLIC_USE_SERVER_LIVE !== 'false';

export const getBackendBaseUrl = (): string => {
  // Local web development: always point to local NestJS backend on port 3000
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (Platform.OS !== 'web') {
      const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
      return metroHost ? `http://${metroHost}:3000` : 'http://10.0.2.2:3000';
    }
    return 'http://localhost:3000';
  }

  let url = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
  if (Platform.OS !== 'web' && url.includes('localhost')) {
    const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
    if (metroHost) {
      url = url.replace('localhost', metroHost);
    } else {
      url = url.replace('localhost', '10.0.2.2');
    }
  }
  return url;
};

export type CallStatus = 'idle' | 'connecting' | 'listening' | 'speaking' | 'reconnecting' | 'ended';

interface UseLiveCallOptions {
  topic?: string;
  goal?: string;
  level?: string;
  durationSeconds?: number;
  languageMode?: 'sinhala' | 'english';
  sinhalaStyle?: 'smart' | 'balanced' | 'deep_guidance';
  aiSuggestions?: boolean;
  scenarioId?: string;
  userName?: string;
  isIntroCall?: boolean;
  roadmapLevelId?: string;
  levelNumber?: number;
  levelTitle?: string;
  targetSpeakingShare?: number;
  learningObjectives?: Array<{
    id: string;
    title: string;
    description?: string;
    isMandatory?: boolean;
    targetTurns?: number;
  }>;
  onCallCompleted?: (report: MissionReportData) => void;
  guidedPrompt?: {
    scenarioRole?: string;
    coachingFocus?: string;
    openingQuestion?: string;
    customPromptAddon?: string;
    learningObjectives?: Array<{
      id: string;
      title: string;
      description?: string;
      isMandatory?: boolean;
      targetTurns?: number;
    }>;
  };
}

export function useLiveCall(options: UseLiveCallOptions = {}) {
  const [status, setStatus] = useState<CallStatus>('idle');
  const [secondsElapsed, setSecondsElapsed] = useState<number>(0);
  const [subtitles, setSubtitles] = useState<string>('');
  const [previousSubtitles, setPreviousSubtitles] = useState<string>('');
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const isMutedRef = useRef<boolean>(false);
  const [feedbackVisible, setFeedbackVisible] = useState<boolean>(false);
  const [feedbackData, setFeedbackData] = useState<GrammarFeedbackData | null>(null);
  const [tokens, setTokens] = useState({ textIn: 0, audioIn: 0, audioOut: 0, textOut: 0, thoughtsTokens: 0, total: 0, costLkr: 0 });
  const [userVolume, setUserVolume] = useState<number>(0);
  const [modelVolume, setModelVolume] = useState<number>(0);
  const [isPermissionModalVisible, setIsPermissionModalVisible] = useState<boolean>(false);
  const [permissionErrorType, setPermissionErrorType] = useState<MicPermissionErrorType>(null);
  const [missionReport, setMissionReport] = useState<MissionReportData | null>(null);
  const [isSlowResponse, setIsSlowResponse] = useState<boolean>(false);
  const [lastTurnLatencyMs, setLastTurnLatencyMs] = useState<number | null>(null);
  const [networkQuality, setNetworkQuality] = useState<'good' | 'fair' | 'poor'>('good');
  const [networkRttMs, setNetworkRttMs] = useState<number>(0);

  const captureRef = useRef(createAudioCapture());
  const playerRef = useRef(createAudioPlayer());
  const transportRef = useRef<ILiveTransport>(USE_SERVER_LIVE ? new ServerLiveTransport() : new LiveTransport());

  const turnStartTimeRef = useRef<number | null>(null);
  const responseTimeoutRef = useRef<any>(null);

  const timerRef = useRef<any>(null);
  const sessionIdRef = useRef<string>(`session-${Date.now()}`);
  const currentModelTextRef = useRef<string>('');
  const currentUserTextRef = useRef<string>('');
  const activeRoleRef = useRef<'user' | 'model' | null>(null);
  const turnsRef = useRef<Array<{ role: 'user' | 'model'; text: string; timestamp: string }>>([]);
  const correctionsRef = useRef<Array<{
    studentSaid: string;
    moreNatural: string;
    explanation: string;
    highlightWords: string[];
    timestamp: string;
  }>>([]);
  const recordedObjectivesRef = useRef<Map<string, { status: 'mastered' | 'assisted' | 'struggling'; note?: string }>>(new Map());
  const userSpeakingSecondsRef = useRef<number>(0);
  const mayaSpeakingSecondsRef = useRef<number>(0);
  const statusRef = useRef<CallStatus>('idle');
  const secondsElapsedRef = useRef<number>(0);
  const tokensRef = useRef({ textIn: 0, audioIn: 0, audioOut: 0, textOut: 0, thoughtsTokens: 0, total: 0, costLkr: 0 });
  const isConcludingRef = useRef<boolean>(false);
  const hasSpokenFarewellRef = useRef<boolean>(false);
  const concludeTimerRef = useRef<any>(null);
  const isModelSpeakingRef = useRef<boolean>(false);
  const echoHangoverUntilRef = useRef<number>(0);
  const lastUserVolUpdateRef = useRef<number>(0);
  const lastUserVolValueRef = useRef<number>(0);
  const lastModelVolUpdateRef = useRef<number>(0);
  const lastModelVolValueRef = useRef<number>(0);
  const userChunksSentRef = useRef<number>(0);
  const rateMultiplierRef = useRef<number>(Number((0.37 + Math.random() * 0.03).toFixed(4)));
  const endCallRef = useRef<((shouldNavigate?: boolean) => Promise<void>) | null>(null);

  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<any>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const hasFinishedRef = useRef<boolean>(false);
  const hasSentMidSessionCueRef = useRef<boolean>(false);

  // Sync state to refs for non-stale callback access
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    secondsElapsedRef.current = secondsElapsed;
  }, [secondsElapsed]);

  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);

  // Session seconds counter & mid-session curriculum pacing check
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setSecondsElapsed((prev) => {
            const next = prev + 1;
            secondsElapsedRef.current = next;

            // Check curriculum pacing: at ~45% of session time, if second objective hasn't started, prompt Maya
            const totalDuration = options.durationSeconds || 300;
            const curriculumObjectives = options.learningObjectives || options.guidedPrompt?.learningObjectives || [];
            if (
              !hasSentMidSessionCueRef.current &&
              curriculumObjectives.length > 1 &&
              next >= Math.floor(totalDuration * 0.45)
            ) {
              const secondObj = curriculumObjectives[1];
              const isRecorded =
                recordedObjectivesRef.current.has(secondObj.id) ||
                recordedObjectivesRef.current.has(secondObj.id.toLowerCase()) ||
                recordedObjectivesRef.current.has(secondObj.title) ||
                recordedObjectivesRef.current.has(secondObj.title.toLowerCase());
              if (!isRecorded) {
                hasSentMidSessionCueRef.current = true;
                console.log(`[useLiveCall] 🎯 Mid-session threshold reached (${next}s/${totalDuration}s) -> sending curriculum pacing cue for "${secondObj.title}"`);
                transportRef.current.sendCurriculumPacingCue?.(secondObj.id, secondObj.title);
              }
            }

            return next;
          });
        }, 1000);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status, options.durationSeconds, options.learningObjectives, options.guidedPrompt]);

  const scheduleReconnect = useCallback(() => {
    if (statusRef.current === 'ended' || isConcludingRef.current) return;

    if (reconnectAttemptsRef.current >= 5) {
      console.warn('[useLiveCall] Max reconnection attempts (5) reached -> setting status to ended');
      setStatus('ended');
      return;
    }

    reconnectAttemptsRef.current += 1;
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttemptsRef.current - 1), 5000);
    console.log(
      `[useLiveCall] Network interrupted. Reconnecting in ${Math.round(delay)}ms (attempt ${reconnectAttemptsRef.current}/5, hasResumeHandle=${!!resumptionHandleRef.current})...`,
    );
    setStatus('reconnecting');

    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = setTimeout(async () => {
      if (statusRef.current === 'ended' || isConcludingRef.current) return;
      try {
        console.log('[useLiveCall] Initiating reconnect attempt to Gemini Live...');
        await startCall(true);
      } catch (err) {
        console.error('[useLiveCall] Reconnection failed:', err);
        scheduleReconnect();
      }
    }, delay);
  }, []);

  const startCall = useCallback(async (isReconnect: boolean = false) => {
    try {
      if (isReconnect) {
        setStatus('reconnecting');
        transportRef.current.close();
      } else {
        setStatus('connecting');
        sessionIdRef.current = `session-${Date.now()}`;
        turnsRef.current = [];
        correctionsRef.current = [];
        reconnectAttemptsRef.current = 0;
        rateMultiplierRef.current = Number((0.37 + Math.random() * 0.03).toFixed(4));
        resumptionHandleRef.current = null;
        hasFinishedRef.current = false;
        hasSpokenFarewellRef.current = false;
        hasSentMidSessionCueRef.current = false;
      }

      // 1. Initialize Audio Player
      await playerRef.current.init({
        onPlaybackStateChange: (pState: 'idle' | 'speaking') => {
          const isSpeaking = pState === 'speaking';
          isModelSpeakingRef.current = isSpeaking;
          if (!isSpeaking) {
            // Echo hangover: give phone speaker 300ms to silence and room reverb to decay
            echoHangoverUntilRef.current = Date.now() + 300;
            setModelVolume(0);

            // If session conclusion was requested AND Maya has actually delivered her farewell audio, cleanly end call
            if (isConcludingRef.current && hasSpokenFarewellRef.current) {
              console.log('[useLiveCall] Maya finished speaking farewell message -> ending call now');
              isConcludingRef.current = false;
              if (concludeTimerRef.current) {
                clearTimeout(concludeTimerRef.current);
                concludeTimerRef.current = null;
              }
              // Allow a brief 300ms pause for audio buffer completion then invoke endCall with navigation
              setTimeout(() => {
                endCallRef.current?.(true);
              }, 300);
              return;
            }
          }
          setStatus(isSpeaking ? 'speaking' : 'listening');
        },
        onVolumeChange: (vol: number) => {
          const now = Date.now();
          if (
            (vol === 0 && lastModelVolValueRef.current !== 0) ||
            (now - lastModelVolUpdateRef.current >= 80 && Math.abs(vol - lastModelVolValueRef.current) >= 0.04)
          ) {
            lastModelVolUpdateRef.current = now;
            lastModelVolValueRef.current = vol;
            setModelVolume(vol);
          }
        },
        onError: (err: Error) => console.error('[AudioPlayer Error]:', err),
      });

      // 2. Acquire and start Microphone Capture BEFORE connecting to Gemini Live!
      // This ensures we NEVER connect to Gemini or start consuming tokens until the user has granted microphone permission.
      await captureRef.current.start({
        isOutputPlaying: () => {
          return (
            isMutedRef.current ||
            isModelSpeakingRef.current ||
            isConcludingRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            Date.now() < echoHangoverUntilRef.current
          );
        },
        onAudioData: (pcm16: ArrayBuffer) => {
          // Half-duplex acoustic echo gate: clamp mic while model is actively outputting audio, farewell concluding, or reconnecting
          const isBlocked =
            isMutedRef.current ||
            isConcludingRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            (isModelSpeakingRef.current && Date.now() < echoHangoverUntilRef.current);

          if (!isBlocked && transportRef.current.isConnected()) {
            userChunksSentRef.current++;
            // 16kHz PCM 16-bit mono = 32,000 bytes per second
            userSpeakingSecondsRef.current += (pcm16.byteLength / 32000);
            transportRef.current.sendAudioChunk(pcm16);
          }
        },
        onVoiceEnd: () => {
          // When client-side VAD detects end of speech, explicitly signal turn completion to Gemini Live
          const isBlocked =
            isMutedRef.current ||
            isConcludingRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended';

          // Require >= 4 chunks (~320ms of genuine speech) so small noise spikes don't trigger turn completion
          if (!isBlocked && userChunksSentRef.current >= 4 && transportRef.current.isConnected()) {
            transportRef.current.sendEndOfTurn();
            userChunksSentRef.current = 0;

            // Start round-trip timer for turn response: if no response in 3.5s, warn UI
            turnStartTimeRef.current = Date.now();
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = setTimeout(() => {
              console.warn('[useLiveCall] ⚠️ Response delay > 3.5s — waiting for Maya response');
              setIsSlowResponse(true);
            }, 3500);
          } else if (userChunksSentRef.current < 4) {
            // Discard transient mic click or throat clear without signaling turn complete
            userChunksSentRef.current = 0;
          }
        },
        onVolumeChange: (vol: number) => {
          const isBlocked =
            isMutedRef.current ||
            isModelSpeakingRef.current ||
            isConcludingRef.current ||
            Date.now() < echoHangoverUntilRef.current;

          const currentVol = isBlocked ? 0 : vol;
          const now = Date.now();
          if (
            (currentVol === 0 && lastUserVolValueRef.current !== 0) ||
            (now - lastUserVolUpdateRef.current >= 80 && Math.abs(currentVol - lastUserVolValueRef.current) >= 0.04)
          ) {
            lastUserVolUpdateRef.current = now;
            lastUserVolValueRef.current = currentVol;
            setUserVolume(currentVol);
          }
        },
        onError: (err: Error) => console.error('[AudioCapture Error]:', err),
      });

      // Microphone initialized successfully -> dismiss permission modal
      setIsPermissionModalVisible(false);
      setPermissionErrorType(null);

      // Compute rolling text memory from recent conversation turns to preserve context
      const rollingMemory = turnsRef.current
        .slice(-8)
        .map((t) => `${t.role === 'user' ? 'Student' : 'Maya'}: ${t.text}`)
        .join('\n');

      const effectiveObjectives = options.learningObjectives || options.guidedPrompt?.learningObjectives;
      const effectiveGuidedPrompt = options.guidedPrompt
        ? {
            ...options.guidedPrompt,
            learningObjectives: options.guidedPrompt.learningObjectives || effectiveObjectives,
          }
        : effectiveObjectives
          ? { learningObjectives: effectiveObjectives }
          : undefined;

      const backendBaseUrl = getBackendBaseUrl();
      const authHeaders = await getAuthHeaders();
      const res = await fetch(`${backendBaseUrl}/v1/session-token`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          sessionId: isReconnect ? sessionIdRef.current : undefined,
          isReconnect,
          topic: options.topic,
          goal: options.goal,
          level: options.level,
          durationSeconds: options.durationSeconds,
          languageMode: options.languageMode,
          sinhalaStyle: options.sinhalaStyle || 'balanced',
          aiSuggestions: options.aiSuggestions,
          scenarioId: options.scenarioId,
          userName: options.userName,
          isIntroCall: options.isIntroCall,
          roadmapLevelId: options.roadmapLevelId,
          guidedPrompt: effectiveGuidedPrompt,
          learningObjectives: effectiveObjectives,
          memory: rollingMemory || undefined,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`Failed to obtain ephemeral session token from backend (${res.status}): ${errBody}`);
      }

      const tokenData = await res.json();
      if (!tokenData?.wsUrl || !tokenData?.token) {
        throw new Error('Backend returned invalid session token response: wsUrl or token is missing');
      }

      sessionIdRef.current = tokenData.sessionId || sessionIdRef.current;

      // 4. Connect Live Transport WebSocket (Direct to Google or Server-to-Server)
      transportRef.current.connect(
        {
          wsUrl: tokenData.wsUrl,
          token: tokenData.token,
          systemPrompt: tokenData.systemPrompt,
          tools: tokenData.tools,
          model: tokenData.model,
          voiceName: tokenData.voiceName || 'Callirrhoe',
          resumptionHandle: resumptionHandleRef.current,
          greetingPrompt: tokenData.greetingPrompt,
          languageMode: tokenData.languageMode || options.languageMode,
          sinhalaStyle: (tokenData.sinhalaStyle as any) || options.sinhalaStyle || 'balanced',
          sessionOptions: {
            sessionId: sessionIdRef.current,
            topic: options.topic,
            goal: options.goal,
            level: options.level,
            durationSeconds: options.durationSeconds,
            languageMode: options.languageMode,
            sinhalaStyle: options.sinhalaStyle || 'balanced',
            aiSuggestions: options.aiSuggestions,
            scenarioId: options.scenarioId,
            userName: options.userName,
            isIntroCall: options.isIntroCall,
            roadmapLevelId: options.roadmapLevelId,
            guidedPrompt: effectiveGuidedPrompt,
            learningObjectives: effectiveObjectives,
            isReconnect,
            memory: rollingMemory || undefined,
          },
        },
        {
          onOpen: () => {
            console.log('[useLiveCall] Gemini Live transport connection established');
            reconnectAttemptsRef.current = 0;
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            if (statusRef.current === 'reconnecting') {
              setStatus('listening');
            }
          },
          onSessionResumptionUpdate: (handle: string) => {
            console.log('[useLiveCall] Received session resumption handle from Gemini');
            resumptionHandleRef.current = handle;
          },
          onSessionResumed: () => {
            console.log('[useLiveCall] Gemini resumed existing session with full conversation memory!');
            reconnectAttemptsRef.current = 0;
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            setStatus('listening');
          },
          onGoAway: (timeLeft: string) => {
            console.warn('[useLiveCall] Received server GoAway notice (timeLeft:', timeLeft, '). Proactively preparing reconnect...');
            scheduleReconnect();
          },
          onAudioSamples: (samples: Float32Array) => {
            if (hasFinishedRef.current || statusRef.current === 'ended') return;
            isModelSpeakingRef.current = true;
            userChunksSentRef.current = 0;

            // Turn response arrived: clear timer and record turnaround latency
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            if (turnStartTimeRef.current) {
              const elapsed = Date.now() - turnStartTimeRef.current;
              setLastTurnLatencyMs(elapsed);
              turnStartTimeRef.current = null;
            }
            setIsSlowResponse(false);

            // 24kHz Float32 mono = 24,000 samples per second
            mayaSpeakingSecondsRef.current += (samples.length / 24000);

            if (isConcludingRef.current) {
              hasSpokenFarewellRef.current = true;
            }

            if (isConcludingRef.current && concludeTimerRef.current) {
              clearTimeout(concludeTimerRef.current);
              concludeTimerRef.current = setTimeout(() => {
                if (isConcludingRef.current) {
                  console.log('[useLiveCall] Safety timeout reached for conclude_call -> ending call');
                  isConcludingRef.current = false;
                  endCallRef.current?.(true);
                }
              }, 12000);
            }
            playerRef.current.playFloat32Chunk?.(samples);
          },
          onAudioChunk: (base64) => {
            if (hasFinishedRef.current || statusRef.current === 'ended') return;
            isModelSpeakingRef.current = true;
            userChunksSentRef.current = 0;

            if (isConcludingRef.current) {
              hasSpokenFarewellRef.current = true;
            }

            // Turn response arrived: clear timer and record turnaround latency
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            if (turnStartTimeRef.current) {
              const elapsed = Date.now() - turnStartTimeRef.current;
              setLastTurnLatencyMs(elapsed);
              turnStartTimeRef.current = null;
            }
            setIsSlowResponse(false);

            // 24kHz PCM 16-bit mono = 48,000 bytes per second
            const byteLen = Math.floor((base64.length * 3) / 4);
            mayaSpeakingSecondsRef.current += (byteLen / 48000);
            // While Maya is delivering her farewell speech, keep resetting the safety timeout so it never cuts her off
            if (isConcludingRef.current && concludeTimerRef.current) {
              clearTimeout(concludeTimerRef.current);
              concludeTimerRef.current = setTimeout(() => {
                if (isConcludingRef.current) {
                  console.log('[useLiveCall] Safety timeout reached for conclude_call -> ending call');
                  isConcludingRef.current = false;
                  endCallRef.current?.(true);
                }
              }, 12000);
            }
            playerRef.current.playPcmChunk(base64);
          },
          onOutputTranscript: (text) => {
            if (hasFinishedRef.current || statusRef.current === 'ended') return;
            isModelSpeakingRef.current = true;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            setIsSlowResponse(false);
            if (activeRoleRef.current !== 'model') {
              if (currentModelTextRef.current.trim()) {
                setPreviousSubtitles(currentModelTextRef.current.trim());
              }
              if (currentUserTextRef.current.trim()) {
                const textToPush = currentUserTextRef.current.trim();
                const lastTurn = turnsRef.current[turnsRef.current.length - 1];
                if (!lastTurn || lastTurn.role !== 'user' || lastTurn.text !== textToPush) {
                  turnsRef.current.push({
                    role: 'user',
                    text: textToPush,
                    timestamp: new Date().toISOString(),
                  });
                }
                currentUserTextRef.current = '';
              }
              activeRoleRef.current = 'model';
              currentModelTextRef.current = '';
            }

            // Append streaming words and tokens smoothly
            currentModelTextRef.current = currentModelTextRef.current
              ? (text.startsWith(' ') || currentModelTextRef.current.endsWith(' ')
                  ? currentModelTextRef.current + text
                  : currentModelTextRef.current + ' ' + text)
              : text;

            setSubtitles(currentModelTextRef.current);
          },
          onInputTranscript: (text) => {
            if (activeRoleRef.current !== 'user') {
              if (currentModelTextRef.current.trim()) {
                const textToPush = currentModelTextRef.current.trim();
                const lastTurn = turnsRef.current[turnsRef.current.length - 1];
                if (!lastTurn || lastTurn.role !== 'model' || lastTurn.text !== textToPush) {
                  turnsRef.current.push({
                    role: 'model',
                    text: textToPush,
                    timestamp: new Date().toISOString(),
                  });
                }
                currentModelTextRef.current = '';
              }
              activeRoleRef.current = 'user';
              currentUserTextRef.current = '';
            }

            currentUserTextRef.current = text;
          },
          onTurnComplete: () => {
            playerRef.current.flush();
            if (currentModelTextRef.current.trim()) {
              const textToPush = currentModelTextRef.current.trim();
              const lastTurn = turnsRef.current[turnsRef.current.length - 1];
              if (!lastTurn || lastTurn.role !== 'model' || lastTurn.text !== textToPush) {
                turnsRef.current.push({
                  role: 'model',
                  text: textToPush,
                  timestamp: new Date().toISOString(),
                });
              }
              currentModelTextRef.current = '';
            }
            activeRoleRef.current = null;

            // If Gemini called conclude_call:
            if (isConcludingRef.current) {
              if (hasSpokenFarewellRef.current) {
                console.log('[useLiveCall] Maya finished speaking her farewell turn -> concluding call cleanly');
                if (concludeTimerRef.current) {
                  clearTimeout(concludeTimerRef.current);
                  concludeTimerRef.current = null;
                }
                setTimeout(() => {
                  if (isConcludingRef.current) {
                    isConcludingRef.current = false;
                    endCallRef.current?.(true);
                  }
                }, 1500);
              } else {
                console.log('[useLiveCall] Conclude tool call handshake completed; waiting for Maya spoken farewell audio');
              }
            }
          },
          onInterrupted: () => {
            // If concluding, ignore stray interruptions to let Maya finish her farewell completely
            if (isConcludingRef.current) {
              console.log('[useLiveCall] Ignoring interruption during call conclusion farewell');
              return;
            }

            // Instant barge-in: flush player buffer (< 300ms)
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            turnStartTimeRef.current = null;
            setIsSlowResponse(false);

            isModelSpeakingRef.current = false;
            echoHangoverUntilRef.current = 0;
            playerRef.current.clear();
            setStatus('listening');
            setModelVolume(0);
            if (currentModelTextRef.current.trim()) {
              const textToPush = currentModelTextRef.current.trim();
              const lastTurn = turnsRef.current[turnsRef.current.length - 1];
              if (!lastTurn || lastTurn.role !== 'model' || lastTurn.text !== textToPush) {
                turnsRef.current.push({
                  role: 'model',
                  text: textToPush,
                  timestamp: new Date().toISOString(),
                });
              }
              currentModelTextRef.current = '';
            }
            activeRoleRef.current = null;
          },

          onGrammarCorrection: (payload: GrammarCorrectionPayload) => {
            console.log('[useLiveCall] 💡 [UI Feedback Card] Grammar correction displayed:', payload.studentSaid, '->', payload.moreNatural);
            const correctionItem = {
              ...payload,
              timestamp: new Date().toISOString(),
            };
            correctionsRef.current.push(correctionItem);

            setFeedbackData({
              type: 'grammar',
              originalSentence: payload.studentSaid,
              correctedSentence: payload.moreNatural,
              whyExplanation: payload.explanation,
              highlightedMistake: payload.highlightWords?.[0] || '',
              highlightedCorrection: payload.highlightWords?.[0] || '',
              autoDismissSeconds: 8,
            });
            setFeedbackVisible(true);
          },
          onRephraseSuggestion: (payload: RephraseSuggestionPayload) => {
            console.log('[useLiveCall] 💬 [UI Feedback Card] Rephrase suggestion displayed:', payload.studentSaid, '->', payload.moreNatural);
            const correctionItem = {
              ...payload,
              timestamp: new Date().toISOString(),
            };
            correctionsRef.current.push(correctionItem);

            setFeedbackData({
              type: 'rephrase',
              originalSentence: payload.studentSaid,
              correctedSentence: payload.moreNatural,
              whyExplanation: payload.explanation,
              highlightedCorrection: payload.highlightWords?.[0] || '',
              autoDismissSeconds: 8,
            });
            setFeedbackVisible(true);
          },
          onObjectiveRecorded: (payload: RecordedObjectivePayload) => {
            console.log('[useLiveCall] 🎯 Objective recorded by Maya coach:', payload.objectiveId, payload.status, payload.note);
            recordedObjectivesRef.current.set(payload.objectiveId, {
              status: payload.status,
              note: payload.note,
            });
            const normKey = payload.objectiveId.trim().toLowerCase();
            if (normKey !== payload.objectiveId) {
              recordedObjectivesRef.current.set(normKey, {
                status: payload.status,
                note: payload.note,
              });
            }
          },
          onConcludeCall: (reason?: string) => {
            console.log(`[useLiveCall] 🏁 [Call Conclusion] conclude_call triggered (reason: "${reason || 'normal'}") -> waiting for farewell speech to complete`);
            isConcludingRef.current = true;
            if (!concludeTimerRef.current) {
              concludeTimerRef.current = setTimeout(() => {
                if (isConcludingRef.current) {
                  console.log('[useLiveCall] Safety timeout reached for conclude_call -> ending call');
                  isConcludingRef.current = false;
                  endCallRef.current?.();
                }
              }, 12000);
            }
          },
          onUsageUpdate: (usage) => {
            const textIn = usage.textIn || 0;
            const audioIn = usage.audioIn || 0;
            const audioOut = usage.audioOut || 0;
            const textOut = usage.textOut || 0;
            const thoughtsTokens = usage.thoughtsTokens || 0;
            const total = usage.total || (textIn + audioIn + audioOut + textOut + thoughtsTokens);

            // Google Gemini Live verified pricing from docs/facts.md:
            // Text In (System Prompt + Tools): $0.75 per 1M tokens
            // Audio In (User Mic Voice + Context): $3.00 per 1M tokens
            // Audio Out (Maya Spoken Voice): $12.00 per 1M tokens
            // Text Out / Thoughts (Reasoning tokens): $4.50 per 1M tokens
            // USD to LKR conversion (configurable via EXPO_PUBLIC_USD_TO_LKR)
            const usdToLkr = Number(process.env.EXPO_PUBLIC_USD_TO_LKR) || 308.50;
            // Random multiplier between 0.37 and 0.40 per session
            const rateMultiplier = rateMultiplierRef.current;
            const rawCostUsd =
              (textIn / 1_000_000) * 0.75 +
              (audioIn / 1_000_000) * 3.0 +
              (audioOut / 1_000_000) * 12.0 +
              ((textOut + thoughtsTokens) / 1_000_000) * 4.5;
            const costUsd = rawCostUsd * rateMultiplier;
            const costLkr = Number((costUsd * usdToLkr).toFixed(2));

            const tokenData = {
              textIn,
              audioIn,
              audioOut,
              textOut,
              thoughtsTokens,
              total,
              costLkr,
            };
            tokensRef.current = tokenData;
            setTokens(tokenData);
          },
          onError: (err: Error) => {
            console.error('[LiveTransport Error]:', err);
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            setIsSlowResponse(false);
            if (statusRef.current !== 'ended' && !isConcludingRef.current) {
              setStatus('reconnecting');
            }
          },
          onClose: (code?: number, reason?: string) => {
            console.log('[LiveTransport Closed]:', code, reason);
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            setIsSlowResponse(false);
            const isIntentionalExit =
              hasFinishedRef.current ||
              isConcludingRef.current ||
              statusRef.current === 'ended';

            if (isIntentionalExit) {
              console.log('[useLiveCall] Session closed intentionally (code:', code, '), no reconnect scheduled');
              setStatus('ended');
              statusRef.current = 'ended';
            } else {
              console.log(`[useLiveCall] ⚠️ Connection dropped unexpectedly (code: ${code}, reason: ${reason || 'none'}) -> entering reconnecting state`);
              if (code === 1011 || code === 1007) {
                resumptionHandleRef.current = null;
              }
              setStatus('reconnecting');
              scheduleReconnect();
            }
          },
          onSlowConnection: (bufferedKB: number) => {
            console.warn(`[useLiveCall] ⚠️ Slow connection reported by transport (${bufferedKB}KB buffered)`);
            setIsSlowResponse(true);
          },
          onLatencyUpdate: (turnLatencyMs: number, avgLatencyMs: number) => {
            setLastTurnLatencyMs(turnLatencyMs);
            if (turnLatencyMs > 4000) {
              console.warn(`[useLiveCall] ⏱️ High turn latency reported: ${turnLatencyMs}ms (Avg: ${avgLatencyMs}ms)`);
            }
          },
          onNetworkQualityChange: (quality: 'good' | 'fair' | 'poor', rtt: number) => {
            setNetworkQuality(quality);
            setNetworkRttMs(rtt);
            if (quality === 'poor') {
              setIsSlowResponse(true);
              playerRef.current.setJitterBuffer?.(350);
              captureRef.current.setNetworkQuality?.('poor');
            } else if (quality === 'fair') {
              playerRef.current.setJitterBuffer?.(250);
              captureRef.current.setNetworkQuality?.('fair');
            } else {
              setIsSlowResponse(false);
              playerRef.current.setJitterBuffer?.(150);
              captureRef.current.setNetworkQuality?.('good');
            }
          },
        },
      );
    } catch (err: any) {
      console.error('[StartCall Error]:', err);
      // Keep status as 'connecting' so ConnectingView remains visible behind the permission popup
      setStatus('connecting');
      statusRef.current = 'connecting';

      const errMsg = err?.message || String(err);
      const errName = err?.name || '';
      const isNotAllowed =
        errName === 'NotAllowedError' ||
        errName === 'PermissionDeniedError' ||
        errMsg.toLowerCase().includes('permission') ||
        errMsg.toLowerCase().includes('not allowed');

      const isInsecure =
        errMsg.toLowerCase().includes('https') ||
        (Platform.OS === 'web' &&
          typeof window !== 'undefined' &&
          !window.isSecureContext &&
          window.location.hostname !== 'localhost' &&
          window.location.hostname !== '127.0.0.1');

      const isUnsupported = errMsg.toLowerCase().includes('not supported');

      if (isInsecure) {
        setPermissionErrorType('insecure');
        setIsPermissionModalVisible(true);
      } else if (isNotAllowed) {
        setPermissionErrorType('denied');
        setIsPermissionModalVisible(true);
      } else if (isUnsupported) {
        setPermissionErrorType('unsupported');
        setIsPermissionModalVisible(true);
      } else {
        setPermissionErrorType('error');
        setIsPermissionModalVisible(true);
      }
    }
  }, [options.topic, options.goal, options.level, isMuted]);

  const endCall = useCallback(async (shouldNavigate: boolean = true) => {
    if (hasFinishedRef.current) {
      console.log('[useLiveCall] Call already finished or ending in progress, skipping redundant endCall');
      return;
    }
    hasFinishedRef.current = true;
    setStatus('ended');
    statusRef.current = 'ended';
    setUserVolume(0);
    setModelVolume(0);
    setPreviousSubtitles('');

    if (concludeTimerRef.current) {
      clearTimeout(concludeTimerRef.current);
      concludeTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (responseTimeoutRef.current) {
      clearTimeout(responseTimeoutRef.current);
      responseTimeoutRef.current = null;
    }
    turnStartTimeRef.current = null;
    setIsSlowResponse(false);
    reconnectAttemptsRef.current = 0;
    isConcludingRef.current = false;
    resumptionHandleRef.current = null;

    // 1. Immediately teardown audio & transport
    try {
      transportRef.current.sendAudioStreamEnd();
      await captureRef.current.stop();
      await playerRef.current.stop();
      transportRef.current.close();
    } catch (err) {
      console.warn('[useLiveCall] Error during call teardown:', err);
    }

    // 2. Calculate speaking share, curriculum objectives achievement, and multi-factor scores
    const secs = secondsElapsedRef.current || 1;
    const userSecs = Math.round(userSpeakingSecondsRef.current);
    const mayaSecs = Math.round(mayaSpeakingSecondsRef.current);
    const totalTalkSecs = userSecs + mayaSecs;
    const userShare = totalTalkSecs > 0 ? Math.min(100, Math.round((userSecs / totalTalkSecs) * 100)) : 0;
    const targetShare = options.targetSpeakingShare ?? 40;

    const curriculumObjectives = options.learningObjectives || options.guidedPrompt?.learningObjectives || [];
    const objectivesResult: MissionObjectiveResult[] = curriculumObjectives.map((obj) => {
      const rec =
        recordedObjectivesRef.current.get(obj.id) ||
        recordedObjectivesRef.current.get(obj.id.toLowerCase()) ||
        recordedObjectivesRef.current.get(obj.title) ||
        recordedObjectivesRef.current.get(obj.title.toLowerCase()) ||
        Array.from(recordedObjectivesRef.current.entries()).find(([k]) =>
          k.toLowerCase().includes(obj.id.toLowerCase()) ||
          obj.title.toLowerCase().includes(k.toLowerCase()) ||
          k.toLowerCase().includes(obj.title.toLowerCase())
        )?.[1];
      return {
        id: obj.id,
        title: obj.title,
        description: obj.description,
        isMandatory: obj.isMandatory !== false,
        status: rec ? rec.status : 'incomplete',
        note: rec?.note,
      };
    });

    let objectiveScore = 100;
    if (curriculumObjectives.length > 0) {
      const totalPoints = objectivesResult.reduce((sum, o) => {
        if (o.status === 'mastered') return sum + 100;
        if (o.status === 'assisted') return sum + 80;
        if (o.status === 'struggling') return sum + 40;
        return sum + 0;
      }, 0);
      objectiveScore = Math.round(totalPoints / curriculumObjectives.length);
    }

    const grammarMistakes = correctionsRef.current.length;
    const grammarScore = Math.max(50, Math.min(98, 92 - grammarMistakes * 4));
    const fluencyScore = userShare >= targetShare
      ? Math.min(95, 80 + Math.round((userShare - targetShare) / 2))
      : Math.max(55, 75 - (targetShare - userShare));
    const pronunciationScore = 85;

    const overallScore = Math.min(
      99,
      Math.max(45, Math.round(objectiveScore * 0.45 + fluencyScore * 0.35 + grammarScore * 0.20))
    );

    const mandatoryFailed = objectivesResult.some((o) => o.isMandatory && o.status === 'incomplete');
    const minPassingScore = 70;
    const passed = !mandatoryFailed && overallScore >= minPassingScore;

    let passReason = 'All core objectives achieved with great conversational flow!';
    if (mandatoryFailed) {
      passReason = 'Complete all mandatory curriculum checkpoints to unlock the next level.';
    } else if (userShare < targetShare - 10) {
      passReason = `Try speaking more! Aim for at least ${targetShare}% student speech next time.`;
    } else if (overallScore < minPassingScore) {
      passReason = `Score fell below ${minPassingScore}%. Review the corrections below and retry.`;
    }

    // 3. Handle Roadmap Session vs Free Practice
    if (options.roadmapLevelId) {
      const report: MissionReportData = {
        roadmapLevelId: options.roadmapLevelId,
        levelNumber: options.levelNumber,
        levelTitle: options.levelTitle || options.topic,
        topic: options.topic,
        durationSeconds: secs,
        targetDurationSeconds: options.durationSeconds || 300,
        userSpeakingSeconds: userSecs,
        userSpeakingShare: userShare,
        targetSpeakingShare: targetShare,
        overallScore,
        fluencyScore,
        grammarScore,
        pronunciationScore,
        passed,
        passReason,
        objectives: objectivesResult,
        corrections: correctionsRef.current.map((c) => ({
          studentSaid: c.studentSaid,
          moreNatural: c.moreNatural,
          explanation: c.explanation,
        })),
      };

      setMissionReport(report);
      if (options.onCallCompleted) {
        options.onCallCompleted(report);
      }

      // If passed, immediately cache completed roadmap level ID for instant zero-jump unlock
      if (passed) {
        try {
          if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
            const raw = window.localStorage.getItem('maya_cached_completed_levels');
            const stored: string[] = raw ? JSON.parse(raw) : [];
            const candidates = [
              options.roadmapLevelId,
              options.levelNumber ? `lvl-${options.levelNumber}` : null,
              options.levelNumber ? `lvl-0${options.levelNumber}` : null,
              options.levelNumber ? String(options.levelNumber) : null,
            ].filter(Boolean) as string[];

            let changed = false;
            for (const c of candidates) {
              if (!stored.includes(c)) {
                stored.push(c);
                changed = true;
              }
            }
            if (changed) {
              window.localStorage.setItem('maya_cached_completed_levels', JSON.stringify(stored));
            }
          }
        } catch (e) {
          console.warn('[useLiveCall] Error caching completed level:', e);
        }
      }
    } else if (shouldNavigate) {
      router.replace('/history');
    }

    // 4. Persist session history asynchronously in background (non-blocking)
    const finalRecord: SessionHistoryRecord = {
      id: sessionIdRef.current,
      start_time: new Date(Date.now() - secs * 1000).toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: secs,
      topic: options.topic || 'General Practice',
      overall_score: overallScore,
      fluency_score: fluencyScore,
      grammar_score: grammarScore,
      pronunciation_score: pronunciationScore,
      status: 'completed',
      turns: [...turnsRef.current],
      corrections: [...correctionsRef.current],
      roadmap_level_id: options.roadmapLevelId,
    };

    persistSessionRecord(finalRecord).catch((err) =>
      console.warn('[useLiveCall] Error persisting session record:', err)
    );

    // 4. Notify backend asynchronously in background with auth headers (non-blocking)
    (async () => {
      try {
        const backendBaseUrl = getBackendBaseUrl();
        const authHeaders = await getAuthHeaders();
        const textIn = tokensRef.current.textIn;
        const audioIn = tokensRef.current.audioIn;
        const audioOut = tokensRef.current.audioOut;
        const textOut = tokensRef.current.textOut;
        const thoughtsTokens = tokensRef.current.thoughtsTokens;
        const total = tokensRef.current.total;

        await fetch(`${backendBaseUrl}/v1/sessions/${sessionIdRef.current}/finish`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            durationSeconds: secs,
            tokensUsed: {
              textInTokens: textIn,
              audioInTokens: audioIn,
              textOutTokens: textOut,
              audioOutTokens: audioOut,
              thoughtsTokens: thoughtsTokens,
              totalTokens: total,
              promptTokens: textIn + audioIn,
              responseTokens: textOut + audioOut + thoughtsTokens,
            },
            turns: turnsRef.current,
            grammarCorrections: correctionsRef.current,
            userName: options.userName || 'Tharindu Fernando',
            model: 'gemini-3.8-live',
            topic: options.topic || 'English Speaking Practice',
            languageMode: options.languageMode || 'sinhala',
            sinhalaStyle: options.sinhalaStyle || 'balanced',
          }),
        });
      } catch (err) {
        console.warn('[useLiveCall] Error calling finish endpoint:', err);
      }
    })();
  }, [options.topic]);

  endCallRef.current = endCall;

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      isMutedRef.current = next;
      if (next) {
        console.log('[useLiveCall] User muted mic -> sending audioStreamEnd');
        transportRef.current.sendAudioStreamEnd();
      } else {
        console.log('[useLiveCall] User unmuted mic');
      }
      return next;
    });
  }, []);

  const closeFeedbackModal = useCallback(() => {
    setFeedbackVisible(false);
  }, []);

  const resumeAudio = useCallback(async () => {
    await playerRef.current.resume();
  }, []);

  const interrupt = useCallback(() => {
    console.log('[useLiveCall] User triggered manual interrupt');
    isModelSpeakingRef.current = false;
    echoHangoverUntilRef.current = 0;
    playerRef.current.clear();
    transportRef.current.sendInterrupted();
    setStatus('listening');
    setModelVolume(0);
  }, []);

  const requestMicrophoneAndStart = useCallback(async () => {
    setIsPermissionModalVisible(false);
    await startCall(false);
  }, [startCall]);

  const closePermissionModal = useCallback(() => {
    setIsPermissionModalVisible(false);
  }, []);

  const sendTimeWrapupCue = useCallback((remainingSeconds?: number) => {
    transportRef.current.sendTimeWrapupCue(remainingSeconds);
  }, []);

  const sendCurriculumPacingCue = useCallback((nextObjectiveId?: string, nextObjectiveTitle?: string) => {
    transportRef.current.sendCurriculumPacingCue?.(nextObjectiveId, nextObjectiveTitle);
  }, []);

  return {
    status,
    secondsElapsed,
    subtitles,
    previousSubtitles,
    isMuted,
    feedbackVisible,
    feedbackData,
    tokens,
    userVolume,
    modelVolume,
    isPermissionModalVisible,
    permissionErrorType,
    setIsPermissionModalVisible,
    closePermissionModal,
    requestMicrophoneAndStart,
    startCall,
    endCall,
    toggleMute,
    closeFeedbackModal,
    resumeAudio,
    interrupt,
    sendTimeWrapupCue,
    sendCurriculumPacingCue,
    missionReport,
    setMissionReport,
    isSlowResponse,
    lastTurnLatencyMs,
    networkQuality,
    networkRttMs,
  };
}

