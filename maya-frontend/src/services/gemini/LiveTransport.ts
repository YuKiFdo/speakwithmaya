import { getLogTimestamp } from '@/utils/time';

export interface GrammarCorrectionPayload {
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

  connect(config: LiveTransportConfig, callbacks: LiveTransportCallbacks): void {
    this.config = config;
    this.callbacks = callbacks;
    this.resumptionHandle = config.resumptionHandle || this.resumptionHandle;
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

    const setupMsg: any = {
      setup: {
        model: `models/${this.config.model || 'gemini-3.8-live'}`,
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: this.config.voiceName || 'Aoede',
              },
            },
          },
        },
        inputAudioTranscription: {
          languageCodes: ['en-US', 'si-LK'],
        },
        outputAudioTranscription: {},
        tools: this.config.tools || [],
        sessionResumption: this.resumptionHandle ? { handle: this.resumptionHandle } : {},
        contextWindowCompression: {
          slidingWindow: {},
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

    const initialGreetingTurn = {
      clientContent: {
        turns: [
          {
            role: 'user',
            parts: [
              {
                text: 'Hello Maya! Greet me warmly in 1 short sentence as my speaking coach, and ask me a quick question to kick off our practice.',
              },
            ],
          },
        ],
        turnComplete: true,
      },
    };

    console.log('[LiveTransport] Dispatching initial greeting prompt to Gemini Live...');
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

    // Universal Gemini Live BidiGenerateContent audio payload
    const realtimeInput = {
      realtimeInput: {
        audio: {
          mimeType: 'audio/pcm;rate=16000',
          data: base64Data,
        },
        mediaChunks: [
          {
            mimeType: 'audio/pcm;rate=16000',
            data: base64Data,
          },
        ],
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
    console.log(`[${getLogTimestamp()}] 🚀 [Turn Dispatch] Streaming silence tail to trigger Gemini server-side VAD`);

    // Stream 6 comfort silence frames (600ms of zeros) to provide acoustic silence decay.
    // Gemini's server-side VAD automatically detects this natural pause and responds within ~800ms.
    const silenceBase64 = 'A'.repeat(4264) + 'AAA=';
    for (let i = 0; i < 6; i++) {
      this.ws.send(
        JSON.stringify({
          realtimeInput: {
            audio: {
              mimeType: 'audio/pcm;rate=16000',
              data: silenceBase64,
            },
            mediaChunks: [
              {
                mimeType: 'audio/pcm;rate=16000',
                data: silenceBase64,
              },
            ],
          },
        }),
      );
    }
  }

  sendInterrupted() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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
      const msg = JSON.parse(text);

      // Check for Gemini API errors
      if (msg.error) {
        console.error(`[${getLogTimestamp()}] [LiveTransport] ❌ Gemini Live API Error:`, JSON.stringify(msg.error));
        this.callbacks.onError?.(new Error(msg.error.message || 'Gemini Live error'));
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
        const sru = msg.sessionResumptionUpdate;
        const newHandle = sru.newHandle || sru.new_handle;
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
        const sc = msg.serverContent;

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
        const outputText = sc.outputTranscription?.text || sc.output_transcription?.text;
        if (outputText) {
          this.currentTurnSubtitles += outputText;
          this.callbacks.onOutputTranscript?.(outputText);
        }

        // Interim Student transcript (streaming preview for UI)
        const interimText = sc.interimInputTranscription?.text || sc.interim_input_transcription?.text;
        if (interimText) {
          this.callbacks.onInputTranscript?.(interimText);
        }

        // Final Student transcript
        const inputText = sc.inputTranscription?.text || sc.input_transcription?.text;
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
          console.log(`[${getLogTimestamp()}] ✅ [Maya Turn Complete]${completeTranscript ? `: "${completeTranscript}"` : ''}`);
          this.currentTurnSubtitles = '';
          this.callbacks.onTurnComplete?.();
        }
      }

      // 2. Tool Calls (show_grammar_correction, conclude_call)
      if (msg.toolCall?.functionCalls) {
        const functionResponses = [];

        for (const call of msg.toolCall.functionCalls) {
          console.log(`[${getLogTimestamp()}] 🛠️ [Tool Call]: ${call.name}`, call.args || {});
          if (call.name === 'show_grammar_correction' && call.args) {
            const correction: GrammarCorrectionPayload = {
              studentSaid: call.args.studentSaid,
              moreNatural: call.args.moreNatural,
              explanation: call.args.explanation || '',
              highlightWords: call.args.highlightWords || [],
            };
            this.callbacks.onGrammarCorrection?.(correction);

            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'ok',
                scheduling: 'WHEN_IDLE',
              },
            });
          } else if (call.name === 'conclude_call') {
            this.callbacks.onConcludeCall?.(call.args?.farewellReason || 'User departure');
            functionResponses.push({
              name: call.name,
              id: call.id,
              response: {
                result: 'concluding',
                scheduling: 'WHEN_IDLE',
              },
            });
          }
        }

        // Send function responses back
        if (functionResponses.length > 0 && this.ws && this.ws.readyState === WebSocket.OPEN) {
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
      const usage = msg.usageMetadata || msg.serverContent?.usageMetadata || msg.serverContent?.modelTurn?.usageMetadata;
      if (usage) {
        this.callbacks.onUsageUpdate?.({
          audioIn: usage.promptTokenCount || 0,
          audioOut: usage.candidatesTokenCount || 0,
          total: usage.totalTokenCount || 0,
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
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }

  isConnected(): boolean {
    return this.isOpen;
  }
}
