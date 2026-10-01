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

export interface LiveTransportCallbacks {
  onOpen?: () => void;
  onAudioChunk?: (base64Pcm: string) => void;
  onOutputTranscript?: (text: string) => void;
  onInputTranscript?: (text: string) => void;
  onTurnComplete?: () => void;
  onInterrupted?: () => void;
  onGrammarCorrection?: (correction: GrammarCorrectionPayload) => void;
  onRephraseSuggestion?: (suggestion: RephraseSuggestionPayload) => void;
  onConcludeCall?: (reason: string) => void;
  onUsageUpdate?: (tokens: { audioIn: number; audioOut: number; total: number }) => void;
  onSessionResumptionUpdate?: (handle: string) => void;
  onSessionResumed?: () => void;
  onGoAway?: (timeLeft: string) => void;
  onError?: (err: Error) => void;
  onClose?: (code: number, reason: string) => void;
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
  generationConfig?: GenerationConfig;
}

export class LiveTransport {
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

  connect(config: LiveTransportConfig, callbacks: LiveTransportCallbacks): void {
    this.config = config;
    this.callbacks = callbacks;
    this.resumptionHandle = config.resumptionHandle || null;
    this.isResumedSession = !!this.resumptionHandle;

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
            voiceName: this.config.voiceName || 'Aoede',
          },
        },
      },
      ...this.config.generationConfig,
    };

    const setupMsg: LiveClientMessage = {
      setup: {
        model: `models/${this.config.model || 'gemini-3.8-live'}`,
        generationConfig,
        // Official Gemini Live API VAD tuning (ai.google.dev/api/live#AutomaticActivityDetection)
        realtimeInputConfig: {
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
            targetTokens: '12500',
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
    console.log(`[${getLogTimestamp()}] 🚀 [Turn Dispatch] Streaming 600ms silence tail & signaling turn end to Gemini server-side VAD`);

    // If user speaks during the post-coaching pause, cancel the nudge — user responded naturally
    if (this.feedbackNudgeTimer) {
      clearTimeout(this.feedbackNudgeTimer);
      this.feedbackNudgeTimer = null;
      this.pendingFeedbackNudge = false;
      console.log(`[${getLogTimestamp()}] ⏹️ [Feedback Nudge] Cancelled — student responded during coaching pause`);
    }

    // Stream 6 comfort silence frames (600ms of zeros, 1600 samples per 100ms = 3200 bytes)
    // as an acoustic hint to help server-side VAD commit faster.
    const silenceBase64 = 'A'.repeat(4267) + '=';
    for (let i = 0; i < 6; i++) {
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

    // Official Gemini Live API signal: notify server-side VAD that audio stream turn has ended
    this.sendAudioStreamEnd();
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
    console.log(`[${getLogTimestamp()}] 🚀 [Feedback Nudge] Triggering continuation cue (isSinhala: ${isSinhala})`);
    const cueText = isSinhala
      ? '[INSTRUCTION]: The student has absorbed your coaching tip. With warmth and energy, transition back into the practice conversation: ask your next question following the dual-language pattern (ask first in Sinhala, then in English: "[Sinhala question]? [English question]?") so the student hears both and your voice accent remains natural.'
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

            this.pendingFeedbackNudge = true;
            console.log(`[${getLogTimestamp()}] 📌 [Feedback Nudge Armed]: pendingFeedbackNudge = TRUE. Will trigger continuation after Maya delivers coaching speech.`);
            const targetPhrase = correction.moreNatural.replace(/"/g, "'");
            const rawExplanation = correction.explanation.replace(/"/g, "'");

            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'displayed_to_student',
                instruction: isSinhala
                  ? `Correction card displayed to student. In your spoken voice response, verbally model the corrected English phrase aloud and give your brief Sinhala explanation: say "ඔයාට පුළුවන් '${targetPhrase}' කියලා කියන්න" followed by your brief explanation in Sinhala ("${rawExplanation}"). Do NOT add any follow-up question. End your turn after coaching.`
                  : `Correction card displayed to student. In your spoken voice response, verbally model the corrected English phrase aloud: say "You can say: '${targetPhrase}'" followed by your brief explanation ("${rawExplanation}"). Do NOT add any follow-up question. End your turn after coaching.`,
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

            this.pendingFeedbackNudge = true;
            console.log(`[${getLogTimestamp()}] 📌 [Feedback Nudge Armed]: pendingFeedbackNudge = TRUE. Will trigger continuation after Maya delivers coaching speech.`);
            const targetPhrase = suggestion.moreNatural.replace(/"/g, "'");
            const rawExplanation = suggestion.explanation.replace(/"/g, "'");

            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'displayed_to_student',
                instruction: isSinhala
                  ? `Rephrase suggestion card displayed to student. In your spoken voice response, verbally model the natural English phrase aloud and give your brief Sinhala explanation: say "මේක වඩාත් ස්වාභාවිකව '${targetPhrase}' කියලා කියන්න පුළුවන්" followed by your brief explanation in Sinhala ("${rawExplanation}"). Do NOT add any follow-up question. End your turn after coaching.`
                  : `Rephrase suggestion card displayed to student. In your spoken voice response, verbally model the natural English phrase aloud: say "You can say: '${targetPhrase}'" followed by your brief explanation ("${rawExplanation}"). Do NOT add any follow-up question. End your turn after coaching.`,
              },
            });
            console.log(`[${getLogTimestamp()}] 📤 [Tool Response Queued]: Queued response for show_rephrase_suggestion`);
          } else if (call.name === 'conclude_call') {
            const reason = String(args.farewellReason || args.farewell_reason || '');
            const isUserDeparture = /\b(bye|goodbye|good bye|see you|athii|yanna|enough|leave|gotta go|have to go|talk later|catch you|take care)\b/i.test(reason);
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

      // 3. Usage metadata (internal ledger update, no terminal spam)
      const usage: (UsageMetadata & { candidatesTokenCount?: number }) | undefined =
        msg.usageMetadata || (msg.serverContent as any)?.usageMetadata || (msg.serverContent as any)?.modelTurn?.usageMetadata;
      if (usage) {
        console.log(usage)
        let audioOutFromDetails = 0;
        if (Array.isArray(usage.responseTokensDetails)) {
          for (const d of usage.responseTokensDetails) {
            audioOutFromDetails += (d.tokenCount || 0);
          }
        }

        const audioOut =
          (audioOutFromDetails > 0 ? audioOutFromDetails : undefined) ??
          usage.responseTokenCount ??
          usage.candidatesTokenCount ??
          (usage.totalTokenCount && usage.promptTokenCount
            ? Math.max(0, usage.totalTokenCount - usage.promptTokenCount)
            : 0);
        const audioIn = usage.promptTokenCount || 0;
        const total = usage.totalTokenCount || (audioIn + audioOut);

        this.callbacks.onUsageUpdate?.({
          audioIn,
          audioOut,
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
