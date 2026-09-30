import { useState, useRef, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { createAudioCapture } from '@/services/audio/AudioCapture';
import { createAudioPlayer } from '@/services/audio/AudioPlayer';
import { LiveTransport, GrammarCorrectionPayload } from '@/services/gemini/LiveTransport';
import { persistSessionRecord, SessionHistoryRecord } from '@/services/supabase';
import { GrammarFeedbackData } from '@/components/call/grammar-feedback-modal';
import { MicPermissionErrorType } from '@/components/call/microphone-permission-popup';
import { getLogTimestamp } from '@/utils/time';

export const getBackendBaseUrl = (): string => {
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
  const [tokens, setTokens] = useState({ audioIn: 0, audioOut: 0, total: 0, costLkr: 0 });
  const [userVolume, setUserVolume] = useState<number>(0);
  const [modelVolume, setModelVolume] = useState<number>(0);
  const [isPermissionModalVisible, setIsPermissionModalVisible] = useState<boolean>(false);
  const [permissionErrorType, setPermissionErrorType] = useState<MicPermissionErrorType>(null);

  const captureRef = useRef(createAudioCapture());
  const playerRef = useRef(createAudioPlayer());
  const transportRef = useRef(new LiveTransport());

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
  const statusRef = useRef<CallStatus>('idle');
  const secondsElapsedRef = useRef<number>(0);
  const tokensRef = useRef({ audioIn: 0, audioOut: 0, total: 0, costLkr: 0 });
  const isConcludingRef = useRef<boolean>(false);
  const concludeTimerRef = useRef<any>(null);
  const isModelSpeakingRef = useRef<boolean>(false);
  const echoHangoverUntilRef = useRef<number>(0);
  const lastUserVolUpdateRef = useRef<number>(0);
  const lastUserVolValueRef = useRef<number>(0);
  const lastModelVolUpdateRef = useRef<number>(0);
  const lastModelVolValueRef = useRef<number>(0);
  const userChunksSentRef = useRef<number>(0);
  const endCallRef = useRef<(() => Promise<void>) | null>(null);

  const reconnectAttemptsRef = useRef<number>(0);
  const reconnectTimerRef = useRef<any>(null);
  const resumptionHandleRef = useRef<string | null>(null);
  const cachedTokenDataRef = useRef<any>(null);

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

  // Session seconds counter
  useEffect(() => {
    if (status === 'listening' || status === 'speaking') {
      if (!timerRef.current) {
        timerRef.current = setInterval(() => {
          setSecondsElapsed((prev) => {
            const next = prev + 1;
            secondsElapsedRef.current = next;
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
  }, [status]);

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
        // Clear cached token if it failed to force refresh on next attempt
        cachedTokenDataRef.current = null;
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
        resumptionHandleRef.current = null;
        cachedTokenDataRef.current = null;
      }

      // 1. Fetch ephemeral token from NestJS backend (or use cached configuration during reconnect)
      let tokenData = cachedTokenDataRef.current;
      if (!tokenData) {
        const backendBaseUrl = getBackendBaseUrl();
        const res = await fetch(`${backendBaseUrl}/v1/session-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            topic: options.topic,
            goal: options.goal,
            level: options.level,
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

        cachedTokenDataRef.current = tokenData;
      }

      sessionIdRef.current = tokenData.sessionId || sessionIdRef.current;

      // 2. Initialize Audio Player
      await playerRef.current.init({
        onPlaybackStateChange: (pState: 'idle' | 'speaking') => {
          const isSpeaking = pState === 'speaking';
          isModelSpeakingRef.current = isSpeaking;
          if (!isSpeaking) {
            // Echo hangover: give phone speaker 800ms to completely silence and room reverb to decay
            echoHangoverUntilRef.current = Date.now() + 800;
            setModelVolume(0);

            // If session conclusion was requested, cleanly end call now that Maya finished her farewell speech
            if (isConcludingRef.current) {
              console.log('[useLiveCall] Maya finished speaking farewell message -> ending call now');
              isConcludingRef.current = false;
              if (concludeTimerRef.current) {
                clearTimeout(concludeTimerRef.current);
                concludeTimerRef.current = null;
              }
              setTimeout(() => {
                endCallRef.current?.();
              }, 800);
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

      // 3. Connect Live Transport WebSocket
      transportRef.current.connect(
        {
          wsUrl: tokenData.wsUrl,
          token: tokenData.token,
          systemPrompt: tokenData.systemPrompt,
          tools: tokenData.tools,
          model: tokenData.model,
          voiceName: tokenData.voiceName || 'Aoede',
          resumptionHandle: resumptionHandleRef.current,
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
          onAudioChunk: (base64) => {
            isModelSpeakingRef.current = true;
            userChunksSentRef.current = 0;
            // While Maya is delivering her farewell speech, keep resetting the safety timeout so it never cuts her off
            if (isConcludingRef.current && concludeTimerRef.current) {
              clearTimeout(concludeTimerRef.current);
              concludeTimerRef.current = setTimeout(() => {
                if (isConcludingRef.current) {
                  console.log('[useLiveCall] Safety timeout reached for conclude_call -> ending call');
                  isConcludingRef.current = false;
                  endCallRef.current?.();
                }
              }, 12000);
            }
            playerRef.current.playPcmChunk(base64);
          },
          onOutputTranscript: (text) => {
            isModelSpeakingRef.current = true;
            if (activeRoleRef.current !== 'model') {
              if (currentModelTextRef.current.trim()) {
                setPreviousSubtitles(currentModelTextRef.current.trim());
              }
              if (currentUserTextRef.current.trim()) {
                turnsRef.current.push({
                  role: 'user',
                  text: currentUserTextRef.current.trim(),
                  timestamp: new Date().toISOString(),
                });
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
                turnsRef.current.push({
                  role: 'model',
                  text: currentModelTextRef.current.trim(),
                  timestamp: new Date().toISOString(),
                });
              }
              activeRoleRef.current = 'user';
              currentUserTextRef.current = '';
            }

            currentUserTextRef.current = text;
          },
          onTurnComplete: () => {
            playerRef.current.flush();
            if (activeRoleRef.current === 'model' && currentModelTextRef.current.trim()) {
              turnsRef.current.push({
                role: 'model',
                text: currentModelTextRef.current.trim(),
                timestamp: new Date().toISOString(),
              });
              activeRoleRef.current = null;
            }

            // If Gemini called conclude_call and this turn completed without Maya speaking audio:
            if (isConcludingRef.current && !isModelSpeakingRef.current) {
              console.log('[useLiveCall] Conclude turn completed without audio -> ending call cleanly');
              if (concludeTimerRef.current) {
                clearTimeout(concludeTimerRef.current);
                concludeTimerRef.current = null;
              }
              setTimeout(() => {
                if (isConcludingRef.current) {
                  isConcludingRef.current = false;
                  endCallRef.current?.();
                }
              }, 1200);
            }
          },
          onInterrupted: () => {
            // If concluding, ignore stray interruptions to let Maya finish her farewell completely
            if (isConcludingRef.current) {
              console.log('[useLiveCall] Ignoring interruption during call conclusion farewell');
              return;
            }

            // Instant barge-in: flush player buffer (< 300ms)
            isModelSpeakingRef.current = false;
            echoHangoverUntilRef.current = 0;
            playerRef.current.clear();
            setStatus('listening');
            setModelVolume(0);
            if (activeRoleRef.current === 'model' && currentModelTextRef.current.trim()) {
              turnsRef.current.push({
                role: 'model',
                text: currentModelTextRef.current.trim(),
                timestamp: new Date().toISOString(),
              });
              activeRoleRef.current = null;
            }
          },
          onGrammarCorrection: (payload: GrammarCorrectionPayload) => {
            const correctionItem = {
              ...payload,
              timestamp: new Date().toISOString(),
            };
            correctionsRef.current.push(correctionItem);

            setFeedbackData({
              originalSentence: payload.studentSaid,
              correctedSentence: payload.moreNatural,
              whyExplanation: payload.explanation,
              highlightedMistake: payload.highlightWords?.[0] || '',
              highlightedCorrection: payload.highlightWords?.[0] || '',
              autoDismissSeconds: 6,
            });
            setFeedbackVisible(true);
          },
          onConcludeCall: () => {
            console.log('[useLiveCall] Gemini requested conclude_call -> waiting for farewell speech to complete');
            isConcludingRef.current = true;
            if (!concludeTimerRef.current) {
              concludeTimerRef.current = setTimeout(() => {
                if (isConcludingRef.current) {
                  console.log('[useLiveCall] Safety timeout reached for conclude_call -> ending call');
                  isConcludingRef.current = false;
                  endCallRef.current?.();
                }
              }, 6000);
            }
          },
          onUsageUpdate: (usage) => {
            const costLkr = Number((((usage.audioIn / 1_000_000) * 3.0 + (usage.audioOut / 1_000_000) * 12.0) * 300).toFixed(2));
            setTokens({
              audioIn: usage.audioIn,
              audioOut: usage.audioOut,
              total: usage.total,
              costLkr,
            });
          },
          onError: (err: Error) => {
            console.error('[LiveTransport Error]:', err);
            if (statusRef.current !== 'ended' && !isConcludingRef.current) {
              setStatus('reconnecting');
            }
          },
          onClose: (code?: number, reason?: string) => {
            console.log('[LiveTransport Closed]:', code, reason);
            if (statusRef.current !== 'ended' && !isConcludingRef.current) {
              setStatus('reconnecting');
              scheduleReconnect();
            } else {
              setStatus('ended');
            }
          },
        },
      );

      // 4. Start Microphone Capture
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
          // Half-duplex acoustic echo gate: clamp mic while model is speaking, farewell concluding, reverb is decaying, or reconnecting
          const isBlocked =
            isMutedRef.current ||
            isModelSpeakingRef.current ||
            isConcludingRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            Date.now() < echoHangoverUntilRef.current;

          if (!isBlocked && transportRef.current.isConnected()) {
            userChunksSentRef.current++;
            transportRef.current.sendAudioChunk(pcm16);
          }
        },
        onVoiceEnd: () => {
          // When client-side VAD detects end of speech, explicitly signal turn completion to Gemini Live
          const isBlocked =
            isMutedRef.current ||
            isModelSpeakingRef.current ||
            isConcludingRef.current ||
            statusRef.current === 'reconnecting' ||
            statusRef.current === 'ended' ||
            Date.now() < echoHangoverUntilRef.current;

          // Only dispatch end-of-turn if genuine user speech chunks were actually streamed to Gemini
          if (!isBlocked && userChunksSentRef.current >= 3 && transportRef.current.isConnected()) {
            transportRef.current.sendEndOfTurn();
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

      // Microphone initialized successfully
      setIsPermissionModalVisible(false);
      setPermissionErrorType(null);
    } catch (err: any) {
      console.error('[StartCall Error]:', err);
      setStatus('idle');

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
      }
    }
  }, [options.topic, options.goal, options.level, isMuted]);

  const endCall = useCallback(async (shouldNavigate: boolean = true) => {
    if (statusRef.current === 'ended') return;
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
    reconnectAttemptsRef.current = 0;
    isConcludingRef.current = false;
    resumptionHandleRef.current = null;
    cachedTokenDataRef.current = null;

    // 1. Immediately teardown audio & transport
    try {
      transportRef.current.sendAudioStreamEnd();
      await captureRef.current.stop();
      await playerRef.current.stop();
      transportRef.current.close();
    } catch (err) {
      console.warn('[useLiveCall] Error during call teardown:', err);
    }

    // 2. Navigate to history screen only if explicitly requested (not on component unmount / Fast Refresh)
    if (shouldNavigate) {
      router.replace('/history');
    }

    // 3. Persist session history asynchronously in background (non-blocking)
    const secs = secondsElapsedRef.current || 1;
    const finalRecord: SessionHistoryRecord = {
      id: sessionIdRef.current,
      start_time: new Date(Date.now() - secs * 1000).toISOString(),
      end_time: new Date().toISOString(),
      duration_seconds: secs,
      topic: options.topic || 'General Practice',
      overall_score: 85,
      fluency_score: 84,
      grammar_score: correctionsRef.current.length > 2 ? 76 : 88,
      pronunciation_score: 82,
      status: 'completed',
      turns: [...turnsRef.current],
      corrections: [...correctionsRef.current],
    };

    persistSessionRecord(finalRecord).catch((err) =>
      console.warn('[useLiveCall] Error persisting session record:', err)
    );

    // 4. Notify backend asynchronously in background (non-blocking)
    try {
      const backendBaseUrl = getBackendBaseUrl();
      // If Gemini didn't emit usageMetadata yet (e.g. abrupt disconnect) but turns occurred or seconds elapsed,
      // calculate estimated tokens from verified facts.md rates (~25 tokens/s audio in, ~32 tokens/s audio out)
      let audioIn = tokensRef.current.audioIn;
      let audioOut = tokensRef.current.audioOut;
      let total = tokensRef.current.total;

      if (total === 0 && secs > 1) {
        audioIn = Math.round(secs * 25);
        audioOut = turnsRef.current.some((t) => t.role === 'model') ? Math.round((secs / 2) * 32) : 0;
        total = audioIn + audioOut;
      }

      fetch(`${backendBaseUrl}/v1/sessions/${sessionIdRef.current}/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          durationSeconds: secs,
          tokensUsed: {
            audioInTokens: audioIn,
            audioOutTokens: audioOut,
            totalTokens: total,
          },
          turns: turnsRef.current,
          grammarCorrections: correctionsRef.current,
        }),
      }).catch((err) => console.warn('[useLiveCall] Error calling finish endpoint:', err));
    } catch {}
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
  };
}

