import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createAudioCapture } from '@/services/audio/AudioCapture';
import { createAudioPlayer } from '@/services/audio/AudioPlayer';
import {
  LiveTransport,
  ILiveTransport,
  GrammarCorrectionPayload,
  RephraseSuggestionPayload,
  RecordedObjectivePayload,
  PracticeTaskPayload,
  TestScorePayload,
  LevelEvaluationPayload,
} from '@/services/gemini/LiveTransport';
import { ServerLiveTransport } from '@/services/gemini/ServerLiveTransport';
import { persistSessionRecord, SessionHistoryRecord, getAuthHeaders } from '@/services/supabase';
import { GrammarFeedbackData } from '@/components/call/grammar-feedback-modal';
import { MicPermissionErrorType } from '@/components/call/microphone-permission-popup';
import { MissionReportData, MissionObjectiveResult } from '@/components/roadmap/mission-report-modal';
import { getLogTimestamp } from '@/utils/time';
import { sanitizeModelText } from '@/utils/text-sanitizer';
import { createWavBlobUrlFromPcm } from '@/utils/audio-wav';
import { registerMicSuppressor } from '@/services/sound/sound-service';
import { OnboardingStore } from '@/services/store/onboarding-store';

// Default to true (Server-to-Server NestJS Gateway) unless explicitly set to 'false'
const USE_SERVER_LIVE = process.env.EXPO_PUBLIC_USE_SERVER_LIVE !== 'false';

export const getBackendBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://127.0.0.1:3000';
    }
    if (hostname.includes('azurecontainerapps.io') || hostname.includes('azurewebsites.net') || hostname.includes('southeastasia')) {
      return 'https://maya-backend.icyisland-5baf2c26.southeastasia.azurecontainerapps.io';
    }
    const envUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
    if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1')) {
      return envUrl;
    }
    return 'https://maya-backend.icyisland-5baf2c26.southeastasia.azurecontainerapps.io';
  }

  if (typeof __DEV__ !== 'undefined' && __DEV__) {
    if (Platform.OS !== 'web') {
      const metroHost = Constants.expoConfig?.hostUri?.split(':')[0];
      return metroHost ? `http://${metroHost}:3000` : 'http://10.0.2.2:3000';
    }
    return 'http://127.0.0.1:3000';
  }

  let url = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://127.0.0.1:3000';
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
  sinhalaStyle?: 'balanced' | 'deep_guidance';
  aiSuggestions?: boolean;
  scenarioId?: string;
  userName?: string;
  isIntroCall?: boolean;
  challenge?: string;
  dailyGoal?: string;
  roadmapLevelId?: string;
  levelNumber?: number;
  levelTitle?: string;
  practicePoints?: string[];
  canonicalContent?: string;
  passingScorePercent?: number;
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  userRole?: string;
  mayaRole?: string;
  goalTitle?: string;
  goalDescription?: string;
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
  hintsUsedCount?: number | (() => number);
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

  // Connection gate and greeting audio hold
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const isInitialGreetingHeldRef = useRef<boolean>(true);
  const initialGreetingBufferRef = useRef<
    Array<{ type: 'samples'; data: Float32Array } | { type: 'chunk'; data: string }>
  >([]);
  const initialGreetingTranscriptRef = useRef<string>('');
  const greetingAudioChunksCountRef = useRef<number>(0);
  const greetingAudioBytesCountRef = useRef<number>(0);

  // Next-generation deliberate practice & testing states
  const [activePracticeTask, setActivePracticeTask] = useState<PracticeTaskPayload | null>(null);
  const [testScores, setTestScores] = useState<Map<number, TestScorePayload>>(new Map());
  const [evaluationResult, setEvaluationResult] = useState<LevelEvaluationPayload | null>(null);
  const testScoresRef = useRef<Map<number, TestScorePayload>>(new Map());
  const evaluationResultRef = useRef<LevelEvaluationPayload | null>(null);

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
  const currentUserTurnPcmChunksRef = useRef<ArrayBuffer[]>([]);
  const lastUserTurnAudioUrlRef = useRef<string>('');
  const turnsRef = useRef<Array<{ role: 'user' | 'model'; text: string; timestamp: string; turnIndex?: number; audioUrl?: string }>>([]);
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
  const isFirstGreetingPendingRef = useRef<boolean>(false);
  const echoHangoverUntilRef = useRef<number>(0);
  const lastUserVolUpdateRef = useRef<number>(0);
  const lastUserVolValueRef = useRef<number>(0);
  const lastModelVolUpdateRef = useRef<number>(0);
  const lastModelVolValueRef = useRef<number>(0);
  const userChunksSentRef = useRef<number>(0);
  const rateMultiplierRef = useRef<number>(Number((0.37 + Math.random() * 0.03).toFixed(4)));
  const endCallRef = useRef<((shouldNavigate?: boolean) => Promise<void>) | null>(null);
  const lastModelAudioChunkTimeRef = useRef<number>(Date.now());

  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<any>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const hasFinishedRef = useRef<boolean>(false);
  const hasSentMidSessionCueRef = useRef<boolean>(false);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const sessionStartTimeRef = useRef<number | null>(null);

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

  // Register mic suppressor: mutes mic capture & VAD whenever UI sounds (e.g. Hint button chime) play
  useEffect(() => {
    const unregister = registerMicSuppressor((durationMs: number) => {
      echoHangoverUntilRef.current = Math.max(echoHangoverUntilRef.current, Date.now() + durationMs);
    });
    return unregister;
  }, []);

  const suppressMicFor = useCallback((durationMs: number = 1000) => {
    echoHangoverUntilRef.current = Math.max(echoHangoverUntilRef.current, Date.now() + durationMs);
  }, []);

  // Session seconds counter & mid-session curriculum pacing check
  // Uses monotonic wall-clock delta to prevent drift or freeze on component re-render
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      if (sessionStartTimeRef.current === null) {
        sessionStartTimeRef.current = Date.now() - secondsElapsedRef.current * 1000;
      }
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          if (sessionStartTimeRef.current === null) return;
          const actualElapsed = Math.floor((Date.now() - sessionStartTimeRef.current) / 1000);
          secondsElapsedRef.current = actualElapsed;
          setSecondsElapsed(actualElapsed);

          // Check curriculum pacing: at ~45% of session time, if second objective hasn't started, prompt Maya
          const totalDuration = optionsRef.current.durationSeconds || 300;
          const curriculumObjectives =
            optionsRef.current.learningObjectives ||
            optionsRef.current.guidedPrompt?.learningObjectives ||
            [];
          if (
            !hasSentMidSessionCueRef.current &&
            curriculumObjectives.length > 1 &&
            actualElapsed >= Math.floor(totalDuration * 0.45)
          ) {
            const secondObj = curriculumObjectives[1];
            const isRecorded =
              recordedObjectivesRef.current.has(secondObj.id) ||
              recordedObjectivesRef.current.has(secondObj.id.toLowerCase()) ||
              recordedObjectivesRef.current.has(secondObj.title) ||
              recordedObjectivesRef.current.has(secondObj.title.toLowerCase());
            if (!isRecorded) {
              hasSentMidSessionCueRef.current = true;
              console.log(
                `[useLiveCall] 🎯 Mid-session threshold reached (${actualElapsed}s/${totalDuration}s) -> sending curriculum pacing cue for "${secondObj.title}"`,
              );
              transportRef.current.sendCurriculumPacingCue?.(secondObj.id, secondObj.title);
            }
          }
        }, 500);
      }
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (status === 'reconnecting') {
        // preserve sessionStartTimeRef so reconnection does not lose elapsed time
      } else if (status === 'ended' || status === 'idle') {
        sessionStartTimeRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  // Speaking Watchdog: prevents Maya from ever being frozen in 'speaking' with user mic muted
  useEffect(() => {
    if (status === 'speaking' || isModelSpeakingRef.current) {
      const interval = setInterval(() => {
        const now = Date.now();
        const timeSinceLastChunk = now - lastModelAudioChunkTimeRef.current;
        if (timeSinceLastChunk > 3500 && modelVolume === 0) {
          console.warn('[useLiveCall] ⚠️ Model speaking watchdog elapsed: no audio received for 3.5s -> auto-recovering to listening');
          isModelSpeakingRef.current = false;
          isFirstGreetingPendingRef.current = false;
          playerRef.current.clear();
          setStatus('listening');
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, modelVolume]);

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
        sessionStartTimeRef.current = null;
        secondsElapsedRef.current = 0;
        setSecondsElapsed(0);
        setActivePracticeTask(null);
        setTestScores(new Map());
        setEvaluationResult(null);
        testScoresRef.current.clear();
        evaluationResultRef.current = null;

        // Fresh session: gate microphone and initial greeting audio until Maya finishes speaking her opening turn greeting
        isFirstGreetingPendingRef.current = true;
        isInitialGreetingHeldRef.current = true;
        initialGreetingBufferRef.current = [];
        greetingAudioChunksCountRef.current = 0;
        greetingAudioBytesCountRef.current = 0;
        setIsConnected(false);
        setTimeout(() => {
          if (isFirstGreetingPendingRef.current && !isInitialGreetingHeldRef.current) {
            console.warn('[useLiveCall] Initial greeting safety timeout expired (7s) — unlocking mic');
            isFirstGreetingPendingRef.current = false;
            if (modelVolume === 0) {
              isModelSpeakingRef.current = false;
              setStatus('listening');
            }
          }
        }, 7000);
      }

      // 1. Initialize Audio Player
      await playerRef.current.init({
        onPlaybackStateChange: (pState: 'idle' | 'speaking') => {
          const isSpeaking = pState === 'speaking';
          isModelSpeakingRef.current = isSpeaking;
          if (!isSpeaking) {
            // Once Maya's opening greeting audio finishes playing through speakers, ensure mic is unlocked
            if (isFirstGreetingPendingRef.current) {
              console.log('[useLiveCall] 🌟 Initial greeting audio playback completed — unlocking mic');
              isFirstGreetingPendingRef.current = false;
            }

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
            isFirstGreetingPendingRef.current ||
            Date.now() < echoHangoverUntilRef.current
          );
        },
        onAudioData: (pcm16: ArrayBuffer) => {
          // Half-duplex acoustic echo gate: clamp mic while model is actively outputting audio, farewell concluding, reconnecting, awaiting greeting, or UI sound/hangover active
          const isBlocked =
            isMutedRef.current ||
            isConcludingRef.current ||
            isInitialGreetingHeldRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            isFirstGreetingPendingRef.current ||
            isModelSpeakingRef.current ||
            Date.now() < echoHangoverUntilRef.current;

          if (!isBlocked && transportRef.current.isConnected()) {
            userChunksSentRef.current++;
            // 16kHz PCM 16-bit mono = 32,000 bytes per second
            userSpeakingSecondsRef.current += (pcm16.byteLength / 32000);
            transportRef.current.sendAudioChunk(pcm16);
            currentUserTurnPcmChunksRef.current.push(pcm16.slice(0));
          }
        },
        onVoiceEnd: () => {
          // When client-side VAD detects end of speech, explicitly signal turn completion to Gemini Live
          const isBlocked =
            isMutedRef.current ||
            isConcludingRef.current ||
            isInitialGreetingHeldRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            isFirstGreetingPendingRef.current ||
            isModelSpeakingRef.current ||
            Date.now() < echoHangoverUntilRef.current;

          // Require >= 4 chunks (~320ms of genuine speech) so small noise spikes don't trigger turn completion
          if (!isBlocked && userChunksSentRef.current >= 4 && transportRef.current.isConnected()) {
            if (currentUserTurnPcmChunksRef.current.length > 0) {
              const wavUrl = createWavBlobUrlFromPcm(currentUserTurnPcmChunksRef.current, 16000);
              lastUserTurnAudioUrlRef.current = wavUrl;
            }
            currentUserTurnPcmChunksRef.current = [];
            transportRef.current.sendEndOfTurn();
            userChunksSentRef.current = 0;

            // Start round-trip timer for turn response: if no response in 5s, show "thinking" indicator
            turnStartTimeRef.current = Date.now();
            if (responseTimeoutRef.current) clearTimeout(responseTimeoutRef.current);
            responseTimeoutRef.current = setTimeout(() => {
              console.warn('[useLiveCall] ⚠️ Response delay > 5s — Maya is still thinking');
              setIsSlowResponse(true);
            }, 5000);
          } else {
            // Discard transient mic click or throat clear without signaling turn complete
            currentUserTurnPcmChunksRef.current = [];
            userChunksSentRef.current = 0;
          }
        },
        onVolumeChange: (vol: number) => {
          const isBlocked =
            isMutedRef.current ||
            isModelSpeakingRef.current ||
            isInitialGreetingHeldRef.current ||
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

      let tokenData: any = {};

      // If connecting directly to Google Live API, mint ephemeral token.
      // If using NestJS Server WebSocket Gateway (USE_SERVER_LIVE=true), bypass session-token entirely!
      if (!USE_SERVER_LIVE) {
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
            challenge: options.challenge,
            dailyGoal: options.dailyGoal,
            roadmapLevelId: options.roadmapLevelId,
            scenarioPrompt: options.scenarioPrompt,
            openingMode: options.openingMode,
            openingLine: options.openingLine,
            scenarioTitle: options.levelTitle || options.topic,
            scenarioBriefing: options.scenarioBriefing,
            emotionTags: options.emotionTags,
            userRole: options.userRole,
            mayaRole: options.mayaRole,
            goalTitle: options.goalTitle,
            goalDescription: options.goalDescription,
            practicePoints: options.practicePoints,
            canonicalContent: options.canonicalContent,
            passingScorePercent: options.passingScorePercent,
            memory: rollingMemory || undefined,
          }),
        });

        if (!res.ok) {
          const errBody = await res.text().catch(() => '');
          throw new Error(`Failed to obtain ephemeral session token from backend (${res.status}): ${errBody}`);
        }

        tokenData = await res.json();
        if (!tokenData?.wsUrl || !tokenData?.token) {
          throw new Error('Backend returned invalid session token response: wsUrl or token is missing');
        }
        sessionIdRef.current = tokenData.sessionId || sessionIdRef.current;
      } else {
        sessionIdRef.current =
          sessionIdRef.current ||
          `session-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      }

      // 4. Connect Live Transport WebSocket (Direct to Google or Server-to-Server)
      transportRef.current.connect(
        {
          wsUrl: tokenData.wsUrl,
          token: tokenData.token,
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
            challenge: options.challenge,
            dailyGoal: options.dailyGoal,
            roadmapLevelId: options.roadmapLevelId,
            scenarioPrompt: options.scenarioPrompt,
            openingMode: options.openingMode,
            openingLine: options.openingLine,
            scenarioTitle: options.levelTitle || options.topic,
            scenarioBriefing: options.scenarioBriefing,
            emotionTags: options.emotionTags,
            practicePoints: options.practicePoints,
            canonicalContent: options.canonicalContent,
            passingScorePercent: options.passingScorePercent,
            isReconnect,
            memory: rollingMemory || undefined,
          },
        },
        {
          onOpen: () => {
            console.log('[useLiveCall] Gemini Live transport connection established');
            setIsConnected(true);
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

            if (isFirstGreetingPendingRef.current) {
              greetingAudioChunksCountRef.current++;
              greetingAudioBytesCountRef.current += samples.length * 4;
              console.log(
                `[useLiveCall] 🔊 [Greeting Audio Chunk #${greetingAudioChunksCountRef.current}] Float32: ${samples.length} samples (held: ${isInitialGreetingHeldRef.current})`,
              );
            }

            // If greeting chime is still playing, buffer initial greeting audio
            if (isInitialGreetingHeldRef.current) {
              initialGreetingBufferRef.current.push({ type: 'samples', data: samples });
              return;
            }

            isModelSpeakingRef.current = true;
            lastModelAudioChunkTimeRef.current = Date.now();
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

            if (isFirstGreetingPendingRef.current) {
              greetingAudioChunksCountRef.current++;
              greetingAudioBytesCountRef.current += Math.floor((base64.length * 3) / 4);
              console.log(
                `[useLiveCall] 🔊 [Greeting Audio Chunk #${greetingAudioChunksCountRef.current}] Base64 PCM: ${base64.length} chars (held: ${isInitialGreetingHeldRef.current})`,
              );
            }

            // If greeting chime is still playing, buffer initial greeting audio
            if (isInitialGreetingHeldRef.current) {
              initialGreetingBufferRef.current.push({ type: 'chunk', data: base64 });
              return;
            }

            isModelSpeakingRef.current = true;
            lastModelAudioChunkTimeRef.current = Date.now();
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

            if (isFirstGreetingPendingRef.current) {
              console.log(`[useLiveCall] 📝 [Greeting Transcript Chunk] "${text}" (held: ${isInitialGreetingHeldRef.current})`);
            }

            // If greeting is currently held (e.g. during intro tutorial), buffer transcript text
            if (isInitialGreetingHeldRef.current) {
              initialGreetingTranscriptRef.current = initialGreetingTranscriptRef.current
                ? (text.startsWith(' ') || initialGreetingTranscriptRef.current.endsWith(' ')
                    ? initialGreetingTranscriptRef.current + text
                    : initialGreetingTranscriptRef.current + ' ' + text)
                : text;
              return;
            }

            isModelSpeakingRef.current = true;
            if (responseTimeoutRef.current) {
              clearTimeout(responseTimeoutRef.current);
              responseTimeoutRef.current = null;
            }
            setIsSlowResponse(false);
            if (activeRoleRef.current !== 'model') {
              if (currentModelTextRef.current.trim()) {
                setPreviousSubtitles(sanitizeModelText(currentModelTextRef.current.trim()));
              }
              if (currentUserTextRef.current.trim()) {
                const textToPush = currentUserTextRef.current.trim();
                const lastTurn = turnsRef.current[turnsRef.current.length - 1];
                if (!lastTurn || lastTurn.role !== 'user' || lastTurn.text !== textToPush) {
                  turnsRef.current.push({
                    role: 'user',
                    text: textToPush,
                    timestamp: new Date().toISOString(),
                    turnIndex: turnsRef.current.length,
                    audioUrl: lastUserTurnAudioUrlRef.current,
                  });
                  lastUserTurnAudioUrlRef.current = '';
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

            setSubtitles(sanitizeModelText(currentModelTextRef.current));
          },
          onInputTranscript: (text) => {
            // Guard against phantom transcripts during opening greeting
            if (isFirstGreetingPendingRef.current) {
              return;
            }
            if (activeRoleRef.current !== 'user') {
              if (currentModelTextRef.current.trim()) {
                const textToPush = sanitizeModelText(currentModelTextRef.current.trim());
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

            // Smoothly accumulate incoming student speech chunks
            currentUserTextRef.current = currentUserTextRef.current
              ? (text.startsWith(' ') || currentUserTextRef.current.endsWith(' ')
                  ? currentUserTextRef.current + text
                  : currentUserTextRef.current + ' ' + text)
              : text;
          },
          onTurnComplete: (data?: { userText?: string; modelText?: string }) => {
            playerRef.current.flush();

            // Commit any verified student turn text from this exchange
            const userTurnText = (data?.userText || currentUserTextRef.current).trim();
            if (userTurnText) {
              const lastTurn = turnsRef.current[turnsRef.current.length - 1];
              if (lastTurn && lastTurn.role === 'user') {
                lastTurn.text = userTurnText;
              } else {
                turnsRef.current.push({
                  role: 'user',
                  text: userTurnText,
                  timestamp: new Date().toISOString(),
                  turnIndex: turnsRef.current.length,
                  audioUrl: lastUserTurnAudioUrlRef.current,
                });
                lastUserTurnAudioUrlRef.current = '';
              }
              currentUserTextRef.current = '';
            }

            // Commit any verified Maya model turn text
            const modelTurnText = (data?.modelText || currentModelTextRef.current).trim();
            if (modelTurnText) {
              const textToPush = sanitizeModelText(modelTurnText);
              const lastTurn = turnsRef.current[turnsRef.current.length - 1];
              if (lastTurn && lastTurn.role === 'model') {
                lastTurn.text = textToPush;
              } else {
                turnsRef.current.push({
                  role: 'model',
                  text: textToPush,
                  timestamp: new Date().toISOString(),
                });
              }
              currentModelTextRef.current = '';
            }
            activeRoleRef.current = null;

            if (isFirstGreetingPendingRef.current) {
              console.log(
                `[useLiveCall] 🏁 [Greeting Turn Complete] Total greeting audio received: ${greetingAudioChunksCountRef.current} chunks (${(greetingAudioBytesCountRef.current / 1024).toFixed(1)} KB), text: "${(currentModelTextRef.current || initialGreetingTranscriptRef.current).slice(0, 60)}"`,
              );
              isFirstGreetingPendingRef.current = false;
            }

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

            if (isFirstGreetingPendingRef.current) {
              console.log('[useLiveCall] Ignoring interruption while initial greeting is pending');
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
            const sanitizedExplanation = sanitizeModelText(payload.explanation);
            const correctionItem = {
              ...payload,
              explanation: sanitizedExplanation,
              timestamp: new Date().toISOString(),
            };
            correctionsRef.current.push(correctionItem);

            setFeedbackData({
              type: 'grammar',
              originalSentence: payload.studentSaid,
              correctedSentence: payload.moreNatural,
              whyExplanation: sanitizedExplanation,
              highlightedMistake: payload.highlightWords?.[0] || '',
              highlightedCorrection: payload.highlightWords?.[0] || '',
              autoDismissSeconds: 8,
            });
            setFeedbackVisible(true);
          },
          onRephraseSuggestion: (payload: RephraseSuggestionPayload) => {
            console.log('[useLiveCall] 💬 [UI Feedback Card] Rephrase suggestion displayed:', payload.studentSaid, '->', payload.moreNatural);
            const sanitizedExplanation = sanitizeModelText(payload.explanation);
            const correctionItem = {
              ...payload,
              explanation: sanitizedExplanation,
              timestamp: new Date().toISOString(),
            };
            correctionsRef.current.push(correctionItem);

            setFeedbackData({
              type: 'rephrase',
              originalSentence: payload.studentSaid,
              correctedSentence: payload.moreNatural,
              whyExplanation: sanitizedExplanation,
              highlightedCorrection: payload.highlightWords?.[0] || '',
              autoDismissSeconds: 8,
            });
            setFeedbackVisible(true);
          },
          onPracticeTaskUpdate: (task: PracticeTaskPayload) => {
            console.log('[useLiveCall] 🎯 Active practice task update:', task);
            setActivePracticeTask(task);
          },
          onTestScoreRecorded: (score: TestScorePayload) => {
            console.log('[useLiveCall] 📝 Test score recorded:', score);
            testScoresRef.current.set(score.pointIndex, score);
            setTestScores((prev) => {
              const updated = new Map(prev);
              updated.set(score.pointIndex, score);
              return updated;
            });
          },
          onLevelEvaluationCompleted: (evaluation: LevelEvaluationPayload) => {
            console.log('[useLiveCall] 🏆 Level evaluation completed:', evaluation);
            const cleanEval: LevelEvaluationPayload = {
              ...evaluation,
              feedbackSinhala: sanitizeModelText(evaluation.feedbackSinhala),
            };
            evaluationResultRef.current = cleanEval;
            setEvaluationResult(cleanEval);
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
    isFirstGreetingPendingRef.current = false;
    resumptionHandleRef.current = null;

    // Flush any pending text into turns before teardown
    if (currentUserTextRef.current.trim()) {
      const textToPush = currentUserTextRef.current.trim();
      const lastTurn = turnsRef.current[turnsRef.current.length - 1];
      if (lastTurn && lastTurn.role === 'user') {
        lastTurn.text = textToPush;
      } else {
        turnsRef.current.push({
          role: 'user',
          text: textToPush,
          timestamp: new Date().toISOString(),
          turnIndex: turnsRef.current.length,
          audioUrl: lastUserTurnAudioUrlRef.current,
        });
      }
      currentUserTextRef.current = '';
    }

    if (currentModelTextRef.current.trim()) {
      const textToPush = sanitizeModelText(currentModelTextRef.current.trim());
      const lastTurn = turnsRef.current[turnsRef.current.length - 1];
      if (lastTurn && lastTurn.role === 'model') {
        lastTurn.text = textToPush;
      } else {
        turnsRef.current.push({
          role: 'model',
          text: textToPush,
          timestamp: new Date().toISOString(),
        });
      }
      currentModelTextRef.current = '';
    }

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

    const evalRes = evaluationResultRef.current;
    const isRoadmap = Boolean(options.roadmapLevelId);
    const minPassingScore = options.passingScorePercent || 75;

    const userTurns = turnsRef.current.filter((t) => t.role === 'user');
    const userSentencesCount = Math.max(0, userTurns.length);
    const talkTimeSecs = totalTalkSecs > 0 ? totalTalkSecs : secs;
    const isVeryShortSession = secs < 25 || userSentencesCount < 2;

    // Strict evaluation rules: A roadmap level CANNOT be passed without completing the Stage 2 evaluation test
    let passed = false;
    let overallScore = 0;
    let passReason = '';
    let feedbackSinhala = evalRes?.feedbackSinhala;
    let feedbackEnglish = evalRes?.feedbackEnglish;

    if (isRoadmap) {
      if (evalRes) {
        passed = Boolean(evalRes.isPassed);
        overallScore = evalRes.scorePercent;
        passReason = evalRes.feedbackEnglish || evalRes.feedbackSinhala || (passed ? 'Level mastered!' : 'Review practice points and retry.');
      } else if (isVeryShortSession) {
        // User exited early without speaking sufficiently
        passed = false;
        overallScore = 0;
        passReason = 'Session ended early before sufficient practice.';
        feedbackSinhala = feedbackSinhala || 'ඔයා session එක අතරමගදී අවසන් කළා. Roleplay එක සම්පූර්ණ කරන්න ආපසු ඇවිත් practice කරන්න.';
        feedbackEnglish = feedbackEnglish || 'Session ended early before completing the scenario roleplay. Try again to pass this level.';
      } else {
        // Scenario Roleplay mode (or active practice): calculate score from fluency, grammar, and turns completed
        const turnBonus = Math.min(8, userSentencesCount >= 6 ? 6 : userSentencesCount);
        const hintsUsed = typeof options.hintsUsedCount === 'function' ? options.hintsUsedCount() : (options.hintsUsedCount || 0);
        const hintRatio = userSentencesCount > 0 ? hintsUsed / userSentencesCount : 0;
        let hintAdjustment = 0;
        if (hintRatio === 0 && userSentencesCount >= 3) {
          hintAdjustment = 4; // Independent speech bonus!
        } else if (hintRatio > 0.5) {
          hintAdjustment = -8; // Heavy hint reliance
        } else if (hintRatio > 0.25) {
          hintAdjustment = -4;
        }

        const calculatedRoleplayScore = Math.min(
          98,
          Math.max(
            50,
            Math.round(
              fluencyScore * 0.45 +
              grammarScore * 0.40 +
              pronunciationScore * 0.15 +
              turnBonus +
              hintAdjustment
            )
          )
        );
        overallScore = calculatedRoleplayScore;
        passed = calculatedRoleplayScore >= minPassingScore;
        if (passed) {
          passReason = 'Scenario goal achieved with great roleplay flow!';
          feedbackSinhala = feedbackSinhala || 'නියමයි! ඔයා roleplay එක සාර්ථකව අවසන් කළා. ඔයාගේ English communication එක ගොඩක් ස්වභාවිකයි.';
          feedbackEnglish = feedbackEnglish || 'Excellent roleplay performance! You communicated naturally and achieved the scenario goal.';
        } else {
          passReason = `Needs a bit more practice to reach the passing score of ${minPassingScore}%.`;
          feedbackSinhala = feedbackSinhala || 'හොඳ උත්සාහයක්! Grammar suggestions බලලා තව ටිකක් practice කරලා score එක වැඩි කරගමු.';
          feedbackEnglish = feedbackEnglish || 'Good effort! Review your grammar suggestions and try the roleplay again to boost your score.';
        }
      }
    } else {
      // General Chat / Free Practice
      if (isVeryShortSession) {
        passed = false;
        overallScore = 0;
        passReason = 'Session ended early before sufficient practice.';
        feedbackEnglish = 'You ended the call before practicing. Whenever you are ready, come back and practice speaking with Maya!';
      } else {
        passed = true;
        overallScore = fluencyScore;
        passReason = 'All core objectives achieved with great conversational flow!';
      }
    }

    // Build deliberate practice tasks list for the report
    let finalObjectives: MissionObjectiveResult[] = [];
    const pointsList: string[] = (options.practicePoints && options.practicePoints.length > 0)
      ? options.practicePoints
      : curriculumObjectives.map((o) => o.title);

    if (pointsList.length > 0) {
      finalObjectives = pointsList.map((pt, idx) => {
        const testScore = testScoresRef.current.get(idx);
        let status: 'mastered' | 'assisted' | 'struggling' | 'incomplete' = 'incomplete';
        if (testScore) {
          status = testScore.passed ? 'mastered' : 'assisted';
        } else if (evalRes) {
          status = evalRes.isPassed ? 'mastered' : 'assisted';
        } else if (passed) {
          status = 'mastered';
        } else if (!isVeryShortSession) {
          status = 'assisted';
        }
        return {
          id: `task-${idx}`,
          title: pt,
          status,
          note: testScore?.note,
        };
      });
    } else {
      finalObjectives = objectivesResult;
    }

    // 3. Assemble Post-Call Session & Mission Report
    const isGeneral = !options.roadmapLevelId;
    const xpEarned = isRoadmap
      ? (passed ? 100 : (!isVeryShortSession ? 25 : 0))
      : (passed ? 50 : 0);

    const report: MissionReportData = {
      roadmapLevelId: options.roadmapLevelId || '',
      levelNumber: options.levelNumber,
      levelTitle: options.levelTitle || options.topic,
      topic: options.topic,
      durationSeconds: secs,
      overallScore,
      passingScorePercent: minPassingScore,
      fluencyScore,
      grammarScore,
      passed,
      passReason,
      feedbackSinhala,
      feedbackEnglish,
      userSentencesCount,
      talkTimeSeconds: talkTimeSecs,
      hintsUsedCount: typeof options.hintsUsedCount === 'function' ? options.hintsUsedCount() : (options.hintsUsedCount || 0),
      xpEarned,
      isGeneralChat: isGeneral,
      objectives: finalObjectives,
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
      hints_used_count: typeof options.hintsUsedCount === 'function' ? options.hintsUsedCount() : (options.hintsUsedCount || 0),
      hintsUsedCount: typeof options.hintsUsedCount === 'function' ? options.hintsUsedCount() : (options.hintsUsedCount || 0),
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

        const finishRes = await fetch(`${backendBaseUrl}/v1/sessions/${sessionIdRef.current}/finish`, {
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
            scores: {
              overall: overallScore,
              fluency: fluencyScore,
              grammar: grammarScore,
              pronunciation: pronunciationScore,
            },
            turns: turnsRef.current,
            grammarCorrections: correctionsRef.current,
            userName: (options.userName || 'Learner').trim(),
            model: 'gemini-3.8-live',
            topic: options.topic || 'English Speaking Practice',
            languageMode: options.languageMode || 'sinhala',
            sinhalaStyle: options.sinhalaStyle || 'balanced',
            hintsUsedCount: typeof options.hintsUsedCount === 'function' ? options.hintsUsedCount() : (options.hintsUsedCount ?? 0),
            isIntroCall: Boolean(options.isIntroCall),
            roadmapLevelId: options.roadmapLevelId,
            levelNumber: options.levelNumber,
          }),
        });

        if (finishRes.ok) {
          const finishData = await finishRes.json().catch(() => null);
          if (!options.isIntroCall && finishData && typeof finishData.remainingMinutes === 'number') {
            OnboardingStore.updateMinutesBalance(finishData.remainingMinutes);
          }
        }
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

  const requestGracefulHangup = useCallback(() => {
    console.log('[useLiveCall] 🛑 User initiated call conclusion -> muting mic & dispatching conclude cue to Maya');

    // 1. Immediately mute mic so user speech stops streaming and echo is clamped
    isMutedRef.current = true;
    setIsMuted(true);

    // 2. Mark concluding state
    isConcludingRef.current = true;
    hasSpokenFarewellRef.current = false;

    // 3. Send conclude call wrap-up cue to Maya
    transportRef.current.sendTimeWrapupCue?.(0);

    // 4. Safety guard: if Maya takes >12s or network fails to produce audio, auto-end call cleanly
    if (concludeTimerRef.current) clearTimeout(concludeTimerRef.current);
    concludeTimerRef.current = setTimeout(() => {
      console.log('[useLiveCall] Farewell wrapup safety timer elapsed (12s) -> auto-ending call');
      isConcludingRef.current = false;
      endCallRef.current?.(true);
    }, 12000);
  }, []);

  // Release buffered greeting audio and transcript once connected chime or intro guide finishes
  const releaseGreeting = useCallback(() => {
    if (!isInitialGreetingHeldRef.current) return;
    console.log(
      `[useLiveCall] 🚀 [Greeting Release] Unlocking initial greeting (${initialGreetingBufferRef.current.length} buffered audio chunks, transcript: "${initialGreetingTranscriptRef.current.slice(0, 60)}")`,
    );
    isInitialGreetingHeldRef.current = false;

    // Release buffered transcript to subtitles
    if (initialGreetingTranscriptRef.current) {
      currentModelTextRef.current = initialGreetingTranscriptRef.current;
      initialGreetingTranscriptRef.current = '';
      activeRoleRef.current = 'model';
      setSubtitles(sanitizeModelText(currentModelTextRef.current));
    }

    const buffered = [...initialGreetingBufferRef.current];
    initialGreetingBufferRef.current = [];

    if (buffered.length > 0) {
      isModelSpeakingRef.current = true;
      lastModelAudioChunkTimeRef.current = Date.now();
      setStatus('speaking');
      buffered.forEach((item) => {
        if (item.type === 'samples') {
          playerRef.current.playFloat32Chunk?.(item.data);
        } else {
          playerRef.current.playPcmChunk(item.data);
        }
      });
    } else if (statusRef.current === 'connecting') {
      setStatus('listening');
    }
  }, []);

  return {
    status,
    sessionId: sessionIdRef.current,
    secondsElapsed,
    subtitles,
    previousSubtitles,
    isMuted,
    isConcluding: isConcludingRef.current,
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
    requestGracefulHangup,
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
    activePracticeTask,
    testScores,
    evaluationResult,
    turns: turnsRef.current,
    isConnected,
    releaseGreeting,
    suppressMicFor,
  };
}

