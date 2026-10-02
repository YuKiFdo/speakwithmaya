import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { WebSocket, RawData } from 'ws';
import { GoogleGenAI, Modality, ActivityHandling, StartSensitivity, EndSensitivity } from '@google/genai';
import { SessionsService } from '../sessions/sessions.service.js';
import { CreateSessionTokenDto } from '../sessions/dto/session.dto.js';

interface ClientSessionState {
  ws: WebSocket;
  geminiSession?: any;
  dto?: CreateSessionTokenDto;
  isConnectedToGemini: boolean;
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
}

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
    this.logger.log('[LiveGateway] Client connected over WebSocket');
    const state: ClientSessionState = {
      ws: client,
      isConnectedToGemini: false,
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
    };
    this.clients.set(client, state);

    client.on('message', async (data: RawData, isBinary: boolean) => {
      try {
        if (isBinary) {
          // Direct binary PCM 16kHz audio buffer
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data as any);
          await this.handleAudioChunk(client, buffer);
        } else {
          // Text / JSON message
          const text = data.toString('utf-8');
          const message = JSON.parse(text);
          await this.handleClientMessage(client, message);
        }
      } catch (err: any) {
        this.logger.error(`[LiveGateway] Error processing client message: ${err?.message}`);
      }
    });

    client.on('error', (err) => {
      this.logger.error(`[LiveGateway] Client socket error: ${err.message}`);
    });
  }

  async handleDisconnect(client: WebSocket) {
    this.logger.log('[LiveGateway] Client disconnected');
    const state = this.clients.get(client);
    if (state?.geminiSession) {
      try {
        await state.geminiSession.close();
      } catch (e: any) {
        this.logger.debug(`[LiveGateway] Error closing Gemini session: ${e?.message}`);
      }
    }
    this.clients.delete(client);
  }

  private async handleClientMessage(client: WebSocket, message: any) {
    const state = this.clients.get(client);
    if (!state) return;

    switch (message.type) {
      case 'start_session': {
        const dto: CreateSessionTokenDto = message.options || {};
        state.dto = dto;
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
        await this.handleEndOfTurn(state);
        break;
      }

      case 'interrupt': {
        // User barge-in signal
        if (state.geminiSession) {
          this.logger.log('[LiveGateway] User barge-in interrupt signal received');
        }
        break;
      }

      case 'audio_stream_end': {
        // Client signaled mic turned off / paused
        try {
          state.geminiSession?.sendRealtimeInput({
            audioStreamEnd: true,
          });
        } catch (e: any) {
          // ignore
        }
        break;
      }

      default:
        this.logger.warn(`[LiveGateway] Unknown message type: ${message.type}`);
    }
  }

  private async handleAudioChunk(client: WebSocket, buffer: Buffer) {
    const state = this.clients.get(client);
    if (!state?.geminiSession || !state.isConnectedToGemini) return;

    try {
      state.userSpeechActive = true;
      // Stream raw 16kHz PCM audio chunk to Gemini
      state.geminiSession.sendRealtimeInput({
        audio: {
          data: buffer.toString('base64'),
          mimeType: 'audio/pcm;rate=16000',
        },
      });
    } catch (err: any) {
      this.logger.error(`[LiveGateway] sendRealtimeInput error: ${err?.message}`);
    }
  }

  private async handleEndOfTurn(state: ClientSessionState) {
    if (!state.geminiSession || !state.isConnectedToGemini) return;

    try {
      this.logger.log('[LiveGateway] 🚀 Turn Complete: Flushing trailing silence frames & signaling turnComplete to Gemini Live');
      state.userSpeechActive = false;

      // 1. Send 5 silence frames (400ms of zeros at 16kHz 16-bit mono) on the server.
      // This pushes phonemes through Gemini's acoustic neural network without waiting for desk taps!
      const silenceBytes = Buffer.alloc(1280 * 2, 0); // 80ms chunk of zeros
      const silenceBase64 = silenceBytes.toString('base64');

      for (let i = 0; i < 5; i++) {
        state.geminiSession.sendRealtimeInput({
          audio: {
            data: silenceBase64,
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      }

      // 2. Dispatch turn completion to Gemini
      // Official Gemini Live API: clientContent with turnComplete: true instructs Gemini
      // to immediately stop waiting for more audio and synthesize response with the accumulated audio!
      if (typeof state.geminiSession.conn?.send === 'function') {
        state.geminiSession.conn.send(
          JSON.stringify({
            clientContent: {
              turnComplete: true,
            },
          }),
        );
      } else if (typeof state.geminiSession.sendClientContent === 'function') {
        state.geminiSession.sendClientContent({
          turnComplete: true,
        });
      }
    } catch (err: any) {
      this.logger.error(`[LiveGateway] handleEndOfTurn error: ${err?.message}`);
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

      this.logger.log(`[LiveGateway] Connecting to Gemini Live API (${this.liveModel})...`);

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
              disabled: false,
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              prefixPaddingMs: 200,
              silenceDurationMs: 600,
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
            this.logger.log('[LiveGateway] ✅ Connected to Gemini Live API');
            state.isConnectedToGemini = true;

            // Notify client that session is ready
            client.send(
              JSON.stringify({
                type: 'ready',
                model: this.liveModel,
                voiceName,
              }),
            );

            // Dispatch opening turn greeting prompt if fresh session
            if (greetingPrompt && session && !state.hasDispatchedGreeting) {
              state.hasDispatchedGreeting = true;
              this.logger.log('[LiveGateway] Dispatching opening turn greeting prompt');
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
          },

          onmessage: (response: any) => {
            this.handleGeminiServerMessage(client, state, response, session);
          },

          onerror: (err: any) => {
            this.logger.error(`[LiveGateway] Gemini Live error: ${err?.message || err}`);
            client.send(
              JSON.stringify({
                type: 'error',
                message: err?.message || 'Gemini Live error',
              }),
            );
          },

          onclose: (e: any) => {
            this.logger.log(`[LiveGateway] Gemini Live closed: ${e?.reason || 'Normal'}`);
            state.isConnectedToGemini = false;
            client.send(
              JSON.stringify({
                type: 'closed',
                reason: e?.reason,
              }),
            );
          },
        },
      });

      state.geminiSession = session;

      // If onopen fired before await returned and greeting wasn't sent yet
      if (greetingPrompt && state.isConnectedToGemini && session && !state.hasDispatchedGreeting) {
        state.hasDispatchedGreeting = true;
        this.logger.log('[LiveGateway] Ensuring opening turn greeting prompt is dispatched');
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
      this.logger.error(`[LiveGateway] Failed to connect to Gemini Live: ${err?.message}`, err?.stack);
      client.send(
        JSON.stringify({
          type: 'error',
          message: `Failed to initialize Gemini Live: ${err?.message}`,
        }),
      );
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
          // Send base64 audio chunk to client
          client.send(
            JSON.stringify({
              type: 'audio',
              data: part.inlineData.data,
              mimeType: part.inlineData.mimeType || 'audio/pcm;rate=24000',
            }),
          );
        }
      }
    }

    // 2. Transcriptions (User & Model)
    if (serverContent?.outputTranscription?.text) {
      const text = serverContent.outputTranscription.text;
      state.modelTranscriptAccumulator += text;
      state.hasModelSpokenThisTurn = true;
      client.send(
        JSON.stringify({
          type: 'output_transcript',
          text,
        }),
      );
    }

    if (serverContent?.inputTranscription?.text) {
      const text = serverContent.inputTranscription.text;
      state.userTranscriptAccumulator += text;
      state.lastStudentTranscript += text;
      this.logger.log(`[LiveGateway] 📝 [Student Said Chunk]: "${text}"`);
      client.send(
        JSON.stringify({
          type: 'input_transcript',
          text,
        }),
      );
    }

    // 3. Turn Complete
    if (serverContent?.turnComplete) {
      const userText = (state.userTranscriptAccumulator || state.lastStudentTranscript).trim();
      const modelText = state.modelTranscriptAccumulator.trim();

      // Only print turn complete summary when the model actually responded or when user turn finished
      if (state.hasModelSpokenThisTurn || modelText) {
        this.logger.log(
          `[LiveGateway] 🤖 [Model Turn Complete]\n` +
          `   🗣️ User Said: "${userText || '(untranscribed / audio speech)'}"\n` +
          `   💬 Maya Replied: "${modelText || '(audio only)'}"`
        );
        // Turn fully complete: clear accumulators for the next conversational exchange
        state.userTranscriptAccumulator = '';
        state.lastStudentTranscript = '';
        state.modelTranscriptAccumulator = '';
        state.hasModelSpokenThisTurn = false;
      } else {
        // Intermediate turn completion (e.g. handshake/tool call/user acoustic closure)
        this.logger.log(
          `[LiveGateway] ⏳ [Turn Handshake Completed] Student transcription accumulated: "${userText || '(awaiting recognition)'}". Model audio generation in progress...`
        );
      }

      client.send(
        JSON.stringify({
          type: 'turn_complete',
        }),
      );
    }

    // 4. Interrupted Event
    if (serverContent?.interrupted) {
      this.logger.log(`[LiveGateway] ⚡ [Interrupted] User voice interrupted model response`);
      state.modelTranscriptAccumulator = '';
      state.hasModelSpokenThisTurn = false;
      client.send(
        JSON.stringify({
          type: 'interrupted',
        }),
      );
    }

    // 5. Function Calling / Tools
    if (response.toolCall?.functionCalls) {
      const functionResponses: any[] = [];
      const isSinhala = state.dto?.languageMode === 'sinhala' || state.dto?.mode === 'sinhala_tutor';
      const isDeepGuidance = isSinhala && state.dto?.sinhalaStyle === 'deep_guidance';

      for (const fc of response.toolCall.functionCalls) {
        const args = (fc.args || {}) as any;
        this.logger.log(`[LiveGateway] 🛠️ Tool Call invoked: ${fc.name}`);

        // Forward to client so UI displays grammar card or farewell
        client.send(
          JSON.stringify({
            type: 'tool_call',
            name: fc.name,
            args: fc.args,
          }),
        );

        if (fc.name === 'conclude_call') {
          functionResponses.push({
            name: fc.name,
            id: fc.id,
            response: {
              result: 'concluding',
              instruction: isSinhala
                ? 'Student is leaving. Speak a warm, friendly farewell aloud in Sinhala and English (under 15 words) wishing them well, then stop speaking.'
                : 'Student is leaving. Speak a short warm friendly farewell aloud (under 15 words) wishing them well, then stop speaking.',
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

      const rateMultiplier = 0.48;
      const rawCostUsd =
        (state.totalTextInTokens / 1_000_000) * 0.75 +
        (state.totalAudioInTokens / 1_000_000) * 3.0 +
        (state.totalAudioOutTokens / 1_000_000) * 12.0 +
        ((state.totalTextOutTokens + state.totalThoughtsTokens) / 1_000_000) * 4.5;
      const costUsd = Number((rawCostUsd * rateMultiplier).toFixed(6));
      const costLkr = Number((costUsd * 308.50).toFixed(2));

      client.send(
        JSON.stringify({
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
        }),
      );
    }
  }
}
