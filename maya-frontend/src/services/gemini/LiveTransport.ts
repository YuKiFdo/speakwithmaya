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
}

export class LiveTransport {
  private ws: WebSocket | null = null;
  private callbacks: LiveTransportCallbacks = {};
  private config: LiveTransportConfig = {};
  private audioChunkCount: number = 0;
  private isOpen: boolean = false;

  connect(config: LiveTransportConfig, callbacks: LiveTransportCallbacks): void {
    this.config = config;
    this.callbacks = callbacks;

    if (!config.wsUrl) {
      const err = new Error('LiveTransport requires a valid Gemini Live WebSocket URL');
      console.error('[LiveTransport]', err.message);
      this.callbacks.onError?.(err);
      return;
    }

    try {
      console.log('[LiveTransport] Connecting to Gemini Live WebSocket URL:', config.wsUrl.split('?')[0]);
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

    const setupMsg = {
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
        systemInstruction: this.config.systemPrompt
          ? {
              parts: [{ text: this.config.systemPrompt }],
            }
          : undefined,
      },
    };

    console.log('[LiveTransport] Sending setup message to Gemini...');
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
      if (this.audioChunkCount <= 3) console.log('[LiveTransport] sendAudioChunk BLOCKED: ws not open, readyState=', this.ws?.readyState);
      return;
    }

    // Convert ArrayBuffer to base64
    const bytes = new Uint8Array(pcm16Chunk);
    const len = bytes.byteLength;

    if (this.audioChunkCount <= 5 || this.audioChunkCount % 50 === 0) {
      // Check if data has audio signal
      let nonZeroCount = 0;
      for (let i = 0; i < Math.min(len, 200); i++) {
        if (bytes[i] !== 0) nonZeroCount++;
      }
      console.log(`[LiveTransport] Streaming audio chunk #${this.audioChunkCount}: ${len} bytes (nonZero=${nonZeroCount}/${Math.min(len, 200)})`);
    }

    if (len === 0) {
      console.warn('[LiveTransport] sendAudioChunk: EMPTY buffer, skipping');
      return;
    }

    let binary = '';
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    // Universal Gemini Live BidiGenerateContent audio payload (supports both audio and mediaChunks)
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
    console.log('[LiveTransport] Sending audioStreamEnd (mic closed / session finish)');
    this.ws.send(
      JSON.stringify({
        realtimeInput: {
          audioStreamEnd: true,
        },
      }),
    );
  }

  sendInterrupted() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
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
        console.error('[LiveTransport] ❌ Gemini Live API Error:', JSON.stringify(msg.error));
        this.callbacks.onError?.(new Error(msg.error.message || 'Gemini Live error'));
        return;
      }

      // Setup completion from Gemini -> trigger greeting!
      if (msg.setupComplete) {
        console.log('[LiveTransport] Gemini setupComplete received! Sending greeting...');
        this.sendGreetingTurn();
        return;
      }

      // Session heartbeat
      if (msg.sessionResumptionUpdate) {
        return;
      }

      // 1. Audio and serverContent
      if (msg.serverContent) {
        const sc = msg.serverContent;

        // Model audio playback chunks
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              this.callbacks.onAudioChunk?.(part.inlineData.data);
            }
          }
        }

        // Subtitles / output transcript (Maya speaking)
        const outputText = sc.outputTranscription?.text || sc.output_transcription?.text;
        if (outputText) {
          console.log('[LiveTransport Maya Subtitle]:', outputText);
          this.callbacks.onOutputTranscript?.(outputText);
        }

        // Interim Student transcript (streaming preview)
        const interimText = sc.interimInputTranscription?.text || sc.interim_input_transcription?.text;
        if (interimText) {
          console.log('[LiveTransport Hearing User]:', interimText);
          this.callbacks.onInputTranscript?.(interimText);
        }

        // Final Student transcript
        const inputText = sc.inputTranscription?.text || sc.input_transcription?.text;
        if (inputText) {
          console.log('[LiveTransport User Transcript]:', inputText);
          this.callbacks.onInputTranscript?.(inputText);
        }

        // Interrupted by user voice (barge-in)
        if (sc.interrupted) {
          console.log('[LiveTransport Interrupted by user voice]');
          this.callbacks.onInterrupted?.();
        }

        // Turn complete
        if (sc.turnComplete) {
          console.log('[LiveTransport Turn Complete]');
          this.callbacks.onTurnComplete?.();
        }
      }

      // 2. Tool Calls (show_grammar_correction, conclude_call)
      if (msg.toolCall?.functionCalls) {
        const functionResponses = [];

        for (const call of msg.toolCall.functionCalls) {
          console.log('[LiveTransport Tool Call]:', call.name, call.args);
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

      // 3. Usage metadata (can be on top-level msg, serverContent, or modelTurn)
      const usage = msg.usageMetadata || msg.serverContent?.usageMetadata || msg.serverContent?.modelTurn?.usageMetadata;
      if (usage) {
        console.log('[LiveTransport Usage Metadata]:', usage);
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
