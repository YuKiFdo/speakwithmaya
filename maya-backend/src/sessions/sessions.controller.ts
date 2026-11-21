import {
  Controller,
  Post,
  Get,
  Query,
  Body,
  Param,
  Headers,
  Req,
  Res,
  UsePipes,
  UseGuards,
  ValidationPipe,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { SessionsService } from './sessions.service.js';
import { AuthGuard, AdminGuard, GetUser } from '../auth/index.js';
import { CreateSessionTokenDto, FinishSessionDto, QueryUsageDto, TranslateDto, GenerateHintDto, AnalyzeSessionDto, SessionTtsDto, SessionReviewDto } from './dto/session.dto.js';

@Controller('v1')
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post('sessions/translate')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async translate(
    @Body() dto: TranslateDto,
  ) {
    return this.sessionsService.translateText(dto);
  }

  @Post('sessions/hint')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getHint(
    @Body() dto: GenerateHintDto,
  ) {
    return this.sessionsService.generateHint(dto);
  }

  @Post('sessions/analyze')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async analyzeSession(
    @Body() dto: AnalyzeSessionDto,
  ) {
    return this.sessionsService.analyzeSession(dto);
  }

  @Post('sessions/review')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async saveReview(
    @Body() dto: SessionReviewDto,
  ) {
    return this.sessionsService.saveSessionReview(dto);
  }

  @Post('sessions/tts')
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getTtsAudio(
    @Body() dto: SessionTtsDto,
  ) {
    return this.sessionsService.generateTtsAudio(dto);
  }

  @Get('sessions/tts')
  async streamTtsAudio(
    @Query('text') text: string,
    @Res() res: any,
  ) {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return res.status(400).send('Missing text parameter');
    }
    const audioObj = await this.sessionsService.generateTtsAudio({ text: cleanText });
    if (!audioObj.audioBase64) {
      return res.status(500).send('Synthesis failed');
    }
    const buf = Buffer.from(audioObj.audioBase64, 'base64');
    res.setHeader('Content-Type', audioObj.mimeType || 'audio/wav');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  }

  @Post('session-token')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async createToken(
    @Body() dto: CreateSessionTokenDto,
    @GetUser('id') userId: string,
  ) {
    return this.sessionsService.createSessionToken(userId, dto);
  }

  @Post('sessions/:id/finish')
  @UseGuards(AuthGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async finishSession(
    @Param('id') sessionId: string,
    @Body() dto: FinishSessionDto,
    @GetUser('id') userId: string,
  ) {
    return this.sessionsService.finishSession(sessionId, userId, dto);
  }

  @Get('sessions')
  @UseGuards(AuthGuard)
  async getSessions(@GetUser('id') userId: string, @Query('view') view?: string) {
    // ?view=summary: lightweight list for periodic stats sync (no transcripts,
    // corrections, storage listing or roadmap lookups)
    if (view === 'summary') {
      return this.sessionsService.getUserSessionSummaries(userId);
    }
    // ?view=resume: the few latest sessions with just the fields the dashboard's
    // "Resume Practice" banner needs (no transcripts, corrections or storage listing)
    if (view === 'resume') {
      return this.sessionsService.getUserResumeCandidates(userId);
    }
    // ?view=list: history list without transcripts/corrections; details are loaded per session
    if (view === 'list') {
      return this.sessionsService.getUserSessions(userId, { light: true });
    }
    return this.sessionsService.getUserSessions(userId);
  }

  /**
   * One of the signed-in user's own sessions, with transcript and corrections (History detail).
   * Previously unauthenticated: anyone with a session id could read its transcript. The admin
   * transcript viewer now uses GET /v1/admin/sessions/:id instead.
   */
  @Get('sessions/:id')
  @UseGuards(AuthGuard)
  async getSessionById(@GetUser('id') userId: string, @Param('id') sessionId: string) {
    const [record] = await this.sessionsService.getUserSessions(userId, { sessionId });
    if (!record) throw new NotFoundException('Session not found');
    return record;
  }

  @Get('admin/sessions/:id')
  @UseGuards(AdminGuard)
  async getAdminSessionById(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }

  // Stream Session Recording Audio: 302 to the stored file (.webm, or legacy .wav), or with
  // format=wav a WAV conversion for browsers that cannot play WebM/Opus (iOS Safari < 17.4).
  @Get('sessions/:id/recording-audio')
  async streamRecordingAudio(
    @Param('id') sessionId: string,
    @Query('type') type: string,
    @Query('speaker') speaker: string,
    @Query('index') index: string,
    @Query('format') format: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const cleanType = (['full', 'user', 'model', 'turn'].includes(type) ? type : 'full') as 'full' | 'user' | 'model' | 'turn';
    const cleanSpeaker = (speaker === 'model' ? 'model' : 'user') as 'user' | 'model';
    const cleanIndex = parseInt(index || '0', 10) || 0;

    const sendBuffer = (buf: Buffer, contentType: string) => {
      const total = buf.length;
      const range = req.headers?.range;
      if (range) {
        const parts = String(range).replace(/bytes=/, '').split('-');
        const start = Math.max(0, parseInt(parts[0], 10) || 0);
        const end = Math.min(total - 1, parts[1] ? parseInt(parts[1], 10) : total - 1);
        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(end - start + 1),
          'Content-Type': contentType,
        });
        return res.end(buf.subarray(start, end + 1));
      }
      res.set({
        'Content-Type': contentType,
        'Content-Length': String(total),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=86400',
      });
      return res.end(buf);
    };

    try {
      if (format === 'wav') {
        const wav = await this.sessionsService.getRecordingAsWav(sessionId, cleanType, cleanSpeaker, cleanIndex);
        if (!wav) return res.status(404).json({ error: 'Recording audio not found' });
        return sendBuffer(wav, 'audio/wav');
      }

      // Instant 302 redirect to the storage CDN (supports HTTP range streaming)
      const directCdnUrl = await this.sessionsService.getRecordingAudioUrl(sessionId, cleanType, cleanSpeaker, cleanIndex);
      if (directCdnUrl) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.redirect(302, directCdnUrl);
      }

      // Fallback: stream the bytes ourselves
      const file = await this.sessionsService.downloadRecordingBuffer(sessionId, cleanType, cleanSpeaker, cleanIndex);
      if (!file) return res.status(404).json({ error: 'Recording audio not found' });
      return sendBuffer(file.buffer, file.path.endsWith('.webm') ? 'audio/webm' : 'audio/wav');
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not stream recording audio' });
    }
  }

  @Get('sessions/:id/diagnostics')
  async getSessionDiagnostics(@Param('id') sessionId: string) {
    const diag = await this.sessionsService.getSessionDiagnostics(sessionId);
    return diag || { message: 'No diagnostics found for session', sessionId };
  }

  @Get('admin/diagnostics')
  @UseGuards(AdminGuard)
  async getRecentDiagnostics() {
    return this.sessionsService.getAllRecentDiagnostics();
  }

  @Get('admin/usage')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ transform: true, whitelist: true }))
  async getUsage(@Query() query: QueryUsageDto) {
    return this.sessionsService.getUsagePage(query);
  }

  @Get('admin/usage/sessions/:id')
  @UseGuards(AdminGuard)
  async getSessionDetail(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }
}

