import { getLogTimestamp } from '@/utils/time';
import {
  Modality,
  StartSensitivity,
  EndSensitivity,
  type LiveClientMessage,
  type LiveServerMessage,
  type LiveServerSessionResumptionUpdate,
  type LiveServerContent,
  type UsageMetadata,
  type GenerationConfig,
  type ModalityTokenCount,
  ActivityHandling,
} from '@google/genai';

export interface GrammarCorrectionPayload {
  studentSaid: string;
  moreNatural: string;
  explanation: string;
  highlightWords: string[];
}

export interface RephraseSuggestionPayload {
  studentSaid: string;
  moreNatural: string;
  explanation: string;
  highlightWords: string[];
}

export interface RecordedObjectivePayload {
  objectiveId: string;
  status: 'mastered' | 'assisted' | 'struggling';
  note?: string;
}

export interface LiveTransportCallbacks {
  onOpen?: () => void;
  onAudioChunk?: (base64Pcm: string) => void;
  onAudioSamples?: (samples: Float32Array) => void;
  onOutputTranscript?: (text: string) => void;
  onInputTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onGrammarCorrection?: (correction: GrammarCorrectionPayload) => void;
  onRephraseSuggestion?: (suggestion: RephraseSuggestionPayload) => void;
  onObjectiveRecorded?: (payload: RecordedObjectivePayload) => void;
  onConcludeCall?: (reason: string) => void;
  onUsageUpdate?: (tokens: {
    textIn: number;
    audioIn: number;
    audioOut: number;
    textOut?: number;
    thoughtsTokens?: number;
    total: number;
  }) => void;
  onSessionResumptionUpdate?: (handle: string) => void;
  onSessionResumed?: () => void;
  onGoAway?: (timeLeft: string) => void;
  onError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
  onSlowConnection?: (bufferedKB: number) => void;
  onLatencyUpdate?: (latencyMs: number, avgLatencyMs: number) => void;
}

export interface LiveTransportConfig {
  wsUrl?: string;
  token?: string;
  systemPrompt?: string;
  tools?: any[];
  model?: string;
  voiceName?: string;
  resumptionHandle?: string | null;
  greetingPrompt?: string;
  languageMode?: string;
  sinhalaStyle?: 'smart' | 'balanced' | 'deep_guidance';
  generationConfig?: GenerationConfig;
}

export interface ILiveTransport {
  connect(config: LiveTransportConfig & { sessionOptions?: any }, callbacks: LiveTransportCallbacks): void;
  sendAudioChunk(pcm16: ArrayBuffer): void;
  sendEndOfTurn(): void;
  sendAudioStreamEnd(): void;
  sendInterrupted(): void;
  sendTimeWrapupCue(remainingSeconds?: number): void;
  close(): void;
  isConnected(): boolean;
  getResumptionHandle?(): string | null;
}

export class LiveTransport implements ILiveTransport {
  private ws: WebSocket | null = null;
  private callbacks: LiveTransportCallbacks = {};
  private config: LiveTransportConfig = {};
  private audioChunkCount: number = 0;
  private isOpen: boolean = false;
  private resumptionHandle: string | null = null;
  private isResumedSession: boolean = false;
  private lastTurnDispatchedAt: number = 0;
  private hasReceivedAudioThisTurn: boolean = false;
  private currentTurnSubtitles: string = '';
  private isWrappingUp: boolean = false;
  private pendingFeedbackNudge: boolean = false;
  private feedbackNudgeTimer: ReturnType<typeof setTimeout> | null = null;
  private cumulativeAudioOutTokens: number = 0;
  private cumulativeTextOutTokens: number = 0;
  private cumulativeAudioInTokens: number = 0;
  private cumulativeTextInTokens: number = 0;
  private cumulativeThoughtsTokens: number = 0;

  connect(config: LiveTransportConfig, callbacks: LiveTransportCallbacks): void {
    this.config = config;
    this.callbacks = callbacks;
    this.resumptionHandle = config.resumptionHandle || null;
    this.isResumedSession = !!this.resumptionHandle;
    if (!this.isResumedSession) {
      this.cumulativeAudioOutTokens = 0;
      this.cumulativeTextOutTokens = 0;
      this.cumulativeAudioInTokens = 0;
      this.cumulativeTextInTokens = 0;
      this.cumulativeThoughtsTokens = 0;
    }

    if (!config.wsUrl) {
      const err = new Error('LiveTransport requires a valid Gemini Live WebSocket URL');
      console.error('[LiveTransport]', err.message);
      this.callbacks.onError?.(err);
      return;
    }

    try {
      console.log(
        '[LiveTransport] Connecting to Gemini Live WebSocket URL (resumed:',
        this.isResumedSession,
        '):',
        config.wsUrl.split('?')[0],
      );
      this.ws = new WebSocket(config.wsUrl);

      this.ws.onopen = () => {
        this.isOpen = true;
        console.log('[LiveTransport] WebSocket connected successfully to Gemini Live!');
        this.callbacks.onOpen?.();
        this.sendInitialSetup();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (event: any) => {
        console.error('[LiveTransport] WebSocket error event:', event);
        const error = new Error('WebSocket connection error');
        this.callbacks.onError?.(error);
      };

      this.ws.onclose = (event) => {
        console.log('[LiveTransport] WebSocket closed:', event.code, event.reason);
        this.isOpen = false;
        this.callbacks.onClose?.(event.code, event.reason);
      };
    } catch (err: any) {
      console.error('[LiveTransport] Error creating WebSocket:', err);
      this.callbacks.onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  }

  private sendInitialSetup() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const generationConfig: GenerationConfig = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: this.config.voiceName || 'Callirrhoe',
          },
        },
      },
      thinkingConfig: {
        thinkingBudget: 0,
      },
      ...this.config.generationConfig,
    };

    const setupMsg: LiveClientMessage = {
      setup: {
        model: `models/${this.config.model || 'gemini-3.8-live'}`,
        generationConfig,
        // Official Gemini Live API VAD tuning (ai.google.dev/api/live#AutomaticActivityDetection)
        realtimeInputConfig: {
          activityHandling: ActivityHandling.NO_INTERRUPTION,
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 200,
            silenceDurationMs: 700,
          },
        },
        inputAudioTranscription: {
          languageCodes: ['en-US', 'si-LK'],
        },
        outputAudioTranscription: {},
        tools: this.config.tools || [],
        sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : undefined,
        contextWindowCompression: {
          triggerTokens: '25000',
          slidingWindow: {
            targetTokens: '12000',
          },
        },
        systemInstruction: this.config.systemPrompt
          ? {
            parts: [{ text: this.config.systemPrompt }],
          }
          : undefined,
      },
    };

    console.log('[LiveTransport] Sending setup message to Gemini... (resumed:', this.isResumedSession, ')');
    this.ws.send(JSON.stringify(setupMsg));
  }

  private sendGreetingTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const greetingText =
      this.config.greetingPrompt ||
      '[INSTRUCTION FOR OPENING TURN]: Greet the student warmly as their AI English speaking coach and ask an engaging opening question to begin practice.';

    const initialGreetingTurn = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: greetingText,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    console.log('[LiveTransport] Dispatching initial greeting prompt to Gemini Live:', greetingText.slice(0, 60) + '...');
    this.ws.send(JSON.stringify(initialGreetingTurn));
  }

  sendAudioChunk(pcm16Chunk: ArrayBuffer) {
    this.audioChunkCount++;

    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      if (this.audioChunkCount <= 3) console.log(`[${getLogTimestamp()}] [LiveTransport] sendAudioChunk BLOCKED: ws not open, readyState=${this.ws?.readyState}`);
      return;
    }

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(pcm16Chunk);
    const len = bytes.byteLength;

    if (len === 0) {
      console.warn(`[${getLogTimestamp()}] [LiveTransport] sendAudioChunk: EMPTY buffer, skipping`);
      return;
    }

    let binary = '';
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    // Gemini Live BidiGenerateContent audio payload (mediaChunks is DEPRECATED per official docs)
    const realtimeInput = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data,
        },
      },
    };

    this.ws.send(JSON.stringify(realtimeInput));
  }

  sendAudioStreamEnd() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audioStreamEnd: true,
        },
      }),
    );
  }

  sendEndOfTurn() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.lastTurnDispatchedAt = Date.now();
    this.hasReceivedAudioThisTurn = false;
    this.currentTurnSubtitles = '';
    console.log(`[${getLogTimestamp()}] 🚀 [Turn Dispatch] User speech ended — streaming acoustic flush & signaling turnComplete to Gemini`);

    // If user speaks during coaching pause, cancel any pending timers
    if (this.feedbackNudgeTimer) {
      clearTimeout(this.feedbackNudgeTimer);
      this.feedbackNudgeTimer = null;
      this.pendingFeedbackNudge = false;
    }

    // Flush Gemini Live audio jitter buffer with 5 silence frames (400ms of zeros at 16kHz 16-bit mono).
    // This pushes the user's speech through Gemini's acoustic layers so it transcribes immediately without waiting for desk taps!
    const silenceBase64 = 'AAAA'.repeat(853) + 'AA==';
    for (let i = 0; i < 5; i++) {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: silenceBase64,
            },
          },
        }),
      );
    }

    // Official Gemini Live API signal: tell server to generate response with currently accumulated audio NOW
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turnComplete: true,
        },
      }),
    );
  }

  sendInterrupted() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    if (this.feedbackNudgeTimer) {
      clearTimeout(this.feedbackNudgeTimer);
      this.feedbackNudgeTimer = null;
    }
    this.pendingFeedbackNudge = false;
    console.log(`[${getLogTimestamp()}] [LiveTransport] Dispatching interrupt clientContent to Gemini`);
    this.ws.send(
      JSON.stringify({
        clientContent: {
          turnComplete: true,
          turns: [],
        },
      }),
    );
  }

  sendTimeWrapupCue(remainingSeconds: number = 0) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.isWrappingUp = true;
    console.log(`[${getLogTimestamp()}] ⏰ [LiveTransport] Dispatching farewell cue to Gemini Live (session time ended)`);
    const cueMsg = {
      clientContent: {
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
      },
    };
    this.ws.send(JSON.stringify(cueMsg));
  }

  private sendContinueAfterFeedback() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn(`[${getLogTimestamp()}] ⚠️ [Feedback Nudge] Cannot send continuation cue — WebSocket not open`);
      return;
    }
    const isSinhala = this.config.languageMode === 'sinhala';
    const isDeepGuidance = isSinhala && this.config.sinhalaStyle === 'deep_guidance';
    console.log(`[${getLogTimestamp()}] 🚀 [Feedback Nudge] Triggering continuation cue (isSinhala: ${isSinhala}, isDeepGuidance: ${isDeepGuidance})`);
    const cueText = isSinhala
      ? isDeepGuidance
        ? '[INSTRUCTION]: The student has absorbed your coaching tip. With warmth and energy, transition back into the practice conversation: ask your next question following the dual-language pattern (ask first in Sinhala, then in English: "[Sinhala question]? [English question]?") so the student hears both and your voice accent remains natural.'
        : '[INSTRUCTION]: The student has absorbed your coaching tip. With warmth, ask your next short English practice question directly (strictly under 8 words) to keep the conversation flowing smoothly.'
      : '[INSTRUCTION]: The student has absorbed your coaching tip. With warmth and vibrant energy, naturally and dynamically bridge back into the conversation with your own fresh words (without using any scripted or repetitive phrases), and ask your next engaging question on our topic.';

    console.log(`[${getLogTimestamp()}] 📜 [Feedback Nudge Prompt]: "${cueText}"`);

    const nudgeMsg = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: cueText,
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };
    this.ws.send(JSON.stringify(nudgeMsg));
    console.log(`[${getLogTimestamp()}] ✅ [Feedback Nudge] Continuation cue successfully dispatched over WebSocket to Gemini`);
    this.pendingFeedbackNudge = false;
    this.feedbackNudgeTimer = null;
  }

  private async handleMessage(data: string | Blob | ArrayBuffer) {
    let text = '';
    if (typeof data === 'string') {
      text = data;
    } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
      text = await data.text();
    } else if (data instanceof ArrayBuffer) {
      text = new TextDecoder().decode(data);
    }

    if (!text) return;

    try {
      const msg: LiveServerMessage = JSON.parse(text);

      // Check for Gemini API errors
      if ((msg as any).error) {
        console.error(`[${getLogTimestamp()}] [LiveTransport] ❌ Gemini Live API Error:`, JSON.stringify((msg as any).error));
        this.callbacks.onError?.(new Error((msg as any).error.message || 'Gemini Live error'));
        return;
      }

      // Setup completion from Gemini -> trigger greeting only on fresh sessions!
      if (msg.setupComplete) {
        console.log(`[${getLogTimestamp()}] [LiveTransport] Gemini setupComplete received! Resumed: ${this.isResumedSession}`);
        if (this.isResumedSession) {
          console.log(`[${getLogTimestamp()}] [LiveTransport] Existing session resumed successfully! Context preserved.`);
          this.callbacks.onSessionResumed?.();
        } else {
          this.sendGreetingTurn();
        }
        return;
      }

      // Session resumption token updates
      if (msg.sessionResumptionUpdate) {
        const sru: LiveServerSessionResumptionUpdate = msg.sessionResumptionUpdate;
        const newHandle = sru.newHandle || (sru as any).new_handle;
        if (sru.resumable && newHandle) {
          console.log(`[${getLogTimestamp()}] [LiveTransport] Session resumption handle updated: ${newHandle.substring(0, 16)}...`);
          this.resumptionHandle = newHandle;
          this.callbacks.onSessionResumptionUpdate?.(newHandle);
        }
        return;
      }

      // Server GoAway warning before disconnection
      if (msg.goAway) {
        console.warn(`[${getLogTimestamp()}] [LiveTransport] Received GoAway from Gemini Live, timeLeft: ${msg.goAway.timeLeft}`);
        this.callbacks.onGoAway?.(msg.goAway.timeLeft || '');
      }

      // 1. Audio and serverContent
      if (msg.serverContent) {
        const sc: LiveServerContent = msg.serverContent;

        // Model audio playback chunks
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              if (!this.hasReceivedAudioThisTurn) {
                this.hasReceivedAudioThisTurn = true;
                const delayMs = this.lastTurnDispatchedAt > 0 ? `${Date.now() - this.lastTurnDispatchedAt}ms` : 'instant';
                console.log(`[${getLogTimestamp()}] 🤖 [Maya Voice] First audio chunk received (delay: ${delayMs})`);
              }
              this.callbacks.onAudioChunk?.(part.inlineData.data);
            }
          }
        }

        // Subtitles / output transcript (Maya speaking)
        const outputText = sc.outputTranscription?.text || (sc as any).output_transcription?.text;
        if (outputText) {
          this.currentTurnSubtitles += outputText;
          this.callbacks.onOutputTranscript?.(outputText);
        }

        // Interim Student transcript (streaming preview for UI)
        const interimText = sc.interimInputTranscription?.text || (sc as any).interim_input_transcription?.text;
        if (interimText) {
          this.callbacks.onInputTranscript?.(interimText);
        }

        // Final Student transcript
        const inputText = sc.inputTranscription?.text || (sc as any).input_transcription?.text;
        if (inputText) {
          console.log(`[${getLogTimestamp()}] 📝 [Student Said]: "${inputText}"`);
          this.callbacks.onInputTranscript?.(inputText);
        }

        // Interrupted by user voice (barge-in)
        if (sc.interrupted) {
          console.log(`[${getLogTimestamp()}] ⚡ [Interrupted] User voice interrupted Maya`);
          this.currentTurnSubtitles = '';
          this.callbacks.onInterrupted?.();
        }

        // Turn complete
        if (sc.turnComplete) {
          const completeTranscript = this.currentTurnSubtitles.trim();
          console.log(
            `[${getLogTimestamp()}] ✅ [Maya Turn Complete]${completeTranscript ? `: "${completeTranscript}"` : ''} ` +
            `[AudioReceived: ${this.hasReceivedAudioThisTurn}, PendingNudge: ${this.pendingFeedbackNudge}]`,
          );
          this.currentTurnSubtitles = '';
          this.callbacks.onTurnComplete?.();

          // After a coaching turn WITH AUDIO, wait 750ms then nudge the model to continue smoothly
          // Skip the tool-call turnComplete (no audio) — only fire on the coaching audio turnComplete
          if (this.pendingFeedbackNudge && this.hasReceivedAudioThisTurn) {
            this.pendingFeedbackNudge = false;
            if (this.feedbackNudgeTimer) clearTimeout(this.feedbackNudgeTimer);
            console.log(`[${getLogTimestamp()}] ⏳ [Feedback Nudge] Spoken coaching finished! Starting 750ms pause before continuation prompt...`);
            this.feedbackNudgeTimer = setTimeout(() => {
              console.log(`[${getLogTimestamp()}] ⏰ [Feedback Nudge] 750ms timer fired -> triggering sendContinueAfterFeedback()`);
              this.sendContinueAfterFeedback();
            }, 750);
          } else if (this.pendingFeedbackNudge && !this.hasReceivedAudioThisTurn) {
            console.log(`[${getLogTimestamp()}] ℹ️ [Feedback Turn] Tool handshake turn completed with no audio — pendingFeedbackNudge armed and waiting for Maya's coaching audio turn`);
          } else if (!this.pendingFeedbackNudge && this.hasReceivedAudioThisTurn && completeTranscript) {
            // Safety net: check if Maya delivered spoken coaching directly without emitting a tool call
            const hasCoachingMarkers =
              /(ඔයාට පුළුවන්|වඩාත් ස්වාභාවිකව|කියලා කියන්න|You can say|Try saying)\b/i.test(completeTranscript);
            const isQuestion =
              /[?؟]\s*$/.test(completeTranscript) ||
              /\b(ද\?|මොකක්ද\?|කොහොමද\?|නේද\?|right\?|what\?|how\?)\s*$/i.test(completeTranscript);

            if (hasCoachingMarkers && !isQuestion) {
              console.warn(
                `[${getLogTimestamp()}] ⚠️ [Direct Coaching Detected]: Maya delivered spoken coaching WITHOUT tool call: "${completeTranscript.slice(0, 80)}..."`,
              );

              // Extract target phrase inside quotes if present
              const quotedMatch = completeTranscript.match(/["'“]([^"'“”]+)["'”]/);
              const targetPhrase = quotedMatch ? quotedMatch[1] : '';

              if (targetPhrase) {
                const isRephrase = /(ස්වාභාවිකව|rephrase|natural)/i.test(completeTranscript);
                if (isRephrase) {
                  this.callbacks.onRephraseSuggestion?.({
                    studentSaid: '',
                    moreNatural: targetPhrase,
                    explanation: completeTranscript,
                    highlightWords: [targetPhrase],
                  });
                } else {
                  this.callbacks.onGrammarCorrection?.({
                    studentSaid: '',
                    moreNatural: targetPhrase,
                    explanation: completeTranscript,
                    highlightWords: [targetPhrase],
                  });
                }
                console.log(`[${getLogTimestamp()}] 💡 [UI Card Fallback]: Dispatched synthetic feedback card for "${targetPhrase}"`);
              }

              // Fire the 750ms nudge so conversation continues smoothly!
              if (this.feedbackNudgeTimer) clearTimeout(this.feedbackNudgeTimer);
              console.log(`[${getLogTimestamp()}] ⏳ [Feedback Nudge Fallback] Starting 750ms pause before continuation prompt...`);
              this.feedbackNudgeTimer = setTimeout(() => {
                console.log(`[${getLogTimestamp()}] ⏰ [Feedback Nudge Fallback] 750ms timer fired -> triggering sendContinueAfterFeedback()`);
                this.sendContinueAfterFeedback();
              }, 750);
            }
          }

          // Reset audio tracker for next turn
          this.hasReceivedAudioThisTurn = false;
        }
      }

      // 2. Tool Calls (show_grammar_correction, conclude_call)
      if (msg.toolCall?.functionCalls) {
        const functionCalls = msg.toolCall.functionCalls;
        const functionResponses = [];

        const isSinhala = this.config.languageMode === 'sinhala';
        const isDeepGuidance = isSinhala && this.config.sinhalaStyle === 'deep_guidance';

        for (const call of functionCalls) {
          const args = (call.args || {}) as any;
          console.log(`[${getLogTimestamp()}] 🛠️ [Tool Call Invoked]: ${call.name}`, JSON.stringify(args));
          if (call.name === 'show_grammar_correction') {
            const correction: GrammarCorrectionPayload = {
              studentSaid: String(args.studentSaid || args.student_said || ''),
              moreNatural: String(args.moreNatural || args.more_natural || ''),
              explanation: String(args.explanation || ''),
              highlightWords: Array.isArray(args.highlightWords || args.highlight_words) ? (args.highlightWords || args.highlight_words) : [],
            };
            console.log(
              `[${getLogTimestamp()}] 💡 [Tool: Grammar Correction] Mistake: "${correction.studentSaid}" -> Fix: "${correction.moreNatural}" (Why: "${correction.explanation}")`,
            );
            this.callbacks.onGrammarCorrection?.(correction);

            this.pendingFeedbackNudge = false;
            const shortKeyPhrase = (correction.moreNatural.split(/[.,;!?]/)[0] || correction.moreNatural).trim().replace(/"/g, "'");
            const rawExplanation = correction.explanation.replace(/"/g, "'");

            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'displayed_to_student',
                instruction: isSinhala
                  ? isDeepGuidance
                    ? `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                    : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "ඔයාට පුළුවන් '${shortKeyPhrase}' කියලා කියන්න"), and immediately ask your next short English question. Total turn strictly under 12 words.`
                  : `Correction card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short corrected key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`,
              },
            });
            console.log(`[${getLogTimestamp()}] 📤 [Tool Response Queued]: Queued response for show_grammar_correction`);
          } else if (call.name === 'show_rephrase_suggestion') {
            const suggestion: RephraseSuggestionPayload = {
              studentSaid: String(args.studentSaid || args.student_said || ''),
              moreNatural: String(args.moreNatural || args.more_natural || ''),
              explanation: String(args.explanation || ''),
              highlightWords: Array.isArray(args.highlightWords || args.highlight_words) ? (args.highlightWords || args.highlight_words) : [],
            };
            console.log(
              `[${getLogTimestamp()}] 💬 [Tool: Rephrase Suggestion] Phrasing: "${suggestion.studentSaid}" -> More Natural: "${suggestion.moreNatural}" (Why: "${suggestion.explanation}")`,
            );
            this.callbacks.onRephraseSuggestion?.(suggestion);

            this.pendingFeedbackNudge = false;
            const shortKeyPhrase = (suggestion.moreNatural.split(/[.,;!?]/)[0] || suggestion.moreNatural).trim().replace(/"/g, "'");
            const rawExplanation = suggestion.explanation.replace(/"/g, "'");

            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'displayed_to_student',
                instruction: isSinhala
                  ? isDeepGuidance
                    ? `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්", then "${rawExplanation}"), and immediately ask your next short English question. Total turn strictly under 15 words.`
                    : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "මේක වඩාත් ස්වාභාවිකව '${shortKeyPhrase}' කියලා කියන්න පුළුවන්"), and immediately ask your next short English question. Total turn strictly under 12 words.`
                  : `Rephrase card displayed to student. In a SINGLE fluid spoken response: verbally model ONLY the short natural key phrase (say "You can say: '${shortKeyPhrase}'"), and immediately ask your next short English question. Total turn strictly under 12 words.`,
              },
            });
            console.log(`[${getLogTimestamp()}] 📤 [Tool Response Queued]: Queued response for show_rephrase_suggestion`);
          } else if (call.name === 'conclude_call') {
            const reason = String(args.farewellReason || args.farewell_reason || '');
            const isUserDeparture =
              /\b(bye|goodbye|good bye|see you|athii|yanna|enough|leave|leaving|going|gotta go|have to go|talk later|catch you|take care)\b/i.test(reason) ||
              /(බායි|බයි|යනවා|යන්නම්|ඇති|නවත්තමු|කන්න යනවා)/.test(reason);
            const canConclude = this.isWrappingUp || isUserDeparture;

            if (canConclude) {
              // System farewell cue was sent or student explicitly said goodbye
              console.log(`[${getLogTimestamp()}] 🏁 [Tool: Conclude Call ACCEPTED]: isWrappingUp=${this.isWrappingUp}, isUserDeparture=${isUserDeparture}, reason: "${reason}"`);
              this.callbacks.onConcludeCall?.(reason || 'Session concluding');
              functionResponses.push({
                name: call.name,
                id: call.id,
                response: {
                  result: 'concluding',
                  instruction: 'Call concluded. Farewell delivered. Do NOT speak any further words.',
                },
              });
            } else {
              // System farewell cue NOT sent yet AND student did not ask to leave — model is self-concluding prematurely
              console.warn(`[${getLogTimestamp()}] ⚠️ [Tool: Conclude Call REJECTED]: isWrappingUp=false, reason: "${reason}" — session time has NOT ended yet.`);
              functionResponses.push({
                name: call.name,
                id: call.id,
                response: {
                  rejected: true,
                  message: 'REJECTED: Session time has NOT ended, and the student did not ask to leave. You are strictly forbidden to wrap up or say goodbye on your own initiative. Continue the conversation immediately: ask your next engaging question on the topic without mentioning this rejection.',
                },
              });
            }
          }
        }

        // Send function responses back
        if (functionResponses.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
          console.log(`[${getLogTimestamp()}] 📤 [LiveTransport] Dispatching ${functionResponses.length} toolResponse(s) to Gemini WebSocket`);
          this.ws.send(
            JSON.stringify({
              toolResponse: {
                functionResponses,
              },
            }),
          );
        }
      }

      // 3. Multi-message wire schema usage extraction (Google AI Studio & Vertex AI formats)
      const rawUsage: any =
        msg.usageMetadata ||
        (msg as any).usage_metadata ||
        (msg.serverContent as any)?.usageMetadata ||
        (msg.serverContent as any)?.usage_metadata ||
        (msg.serverContent as any)?.modelTurn?.usageMetadata ||
        (msg.serverContent as any)?.modelTurn?.usage_metadata;
      if (rawUsage) {
        // Output tokens: check responseTokensDetails (AI Studio) and candidatesTokensDetails (Vertex AI) in camelCase & snake_case
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

        // Input tokens: check promptTokensDetails in camelCase & snake_case
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

        // Proportional fallback if prompt details are missing:
        // Avoid misclassifying expensive audio input tokens as cheap text tokens.
        if (turnTextIn === 0 && turnAudioIn === 0 && promptCount > 0) {
          const estimatedTextBaseline = this.config.systemPrompt
            ? Math.max(250, Math.min(800, Math.ceil(this.config.systemPrompt.length / 4)))
            : 400;

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
          this.cumulativeAudioInTokens = Math.max(this.cumulativeAudioInTokens, turnAudioIn);
          this.cumulativeTextInTokens = Math.max(this.cumulativeTextInTokens, turnTextIn);
        }

        // 2. Output tokens: responseTokenCount / candidatesTokenCount represents the tokens generated
        //    for the CURRENT model turn. We accumulate output tokens across all turns.
        if (turnAudioOut > 0 || turnTextOut > 0 || outCount > 0) {
          this.cumulativeAudioOutTokens += turnAudioOut;
          this.cumulativeTextOutTokens += turnTextOut;
        }
        if (turnThoughts > 0) {
          this.cumulativeThoughtsTokens += turnThoughts;
        }

        const total =
          this.cumulativeAudioInTokens +
          this.cumulativeTextInTokens +
          this.cumulativeAudioOutTokens +
          this.cumulativeTextOutTokens +
          this.cumulativeThoughtsTokens;

        console.log(
          `[${getLogTimestamp()}] 📊 [Live Usage Snapshot]: in(text: ${this.cumulativeTextInTokens}, audio: ${this.cumulativeAudioInTokens}) | out(audio: ${this.cumulativeAudioOutTokens}, text: ${this.cumulativeTextOutTokens}, thoughts: ${this.cumulativeThoughtsTokens}) | Total: ${total}`
        );

        this.callbacks.onUsageUpdate?.({
          textIn: this.cumulativeTextInTokens,
          audioIn: this.cumulativeAudioInTokens,
          audioOut: this.cumulativeAudioOutTokens,
          textOut: this.cumulativeTextOutTokens,
          thoughtsTokens: this.cumulativeThoughtsTokens,
          total,
        });
      }

    } catch (e) {
      console.error('[LiveTransport] Error parsing incoming WebSocket message:', e);
    }
  }

  getResumptionHandle(): string | null {
    return this.resumptionHandle;
  }

  close() {
    this.isOpen = false;
    if (this.feedbackNudgeTimer) {
      clearTimeout(this.feedbackNudgeTimer);
      this.feedbackNudgeTimer = null;
    }
    this.pendingFeedbackNudge = false;
    if (this.ws) {
      try {
        this.ws.close();
      } catch { }
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.isOpen;
  }
}
