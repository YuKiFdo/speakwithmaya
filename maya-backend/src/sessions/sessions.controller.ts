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
    res.setHeader('Content-Type', 'audio/wav');
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
  async getSessions(@GetUser('id') userId: string) {
    return this.sessionsService.getUserSessions(userId);
  }

  @Get('sessions/:id')
  async getSessionById(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }

  // Stream Session Recording Audio (Direct Azure CDN 302 Redirect with range fallback)
  @Get('sessions/:id/recording-audio')
  async streamRecordingAudio(
    @Param('id') sessionId: string,
    @Query('type') type: string,
    @Query('speaker') speaker: string,
    @Query('index') index: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const cleanType = (type || 'full') as 'full' | 'user' | 'model' | 'turn';
    const cleanSpeaker = (speaker === 'model' ? 'model' : 'user') as 'user' | 'model';
    const cleanIndex = parseInt(index || '0', 10) || 0;

    try {
      // Approach A: Instant 302 redirect to Azure Blob Storage CDN for native client HTTP range streaming
      const directCdnUrl = await this.sessionsService.getRecordingAudioUrl(
        sessionId,
        cleanType,
        cleanSpeaker,
        cleanIndex,
      );
      if (directCdnUrl) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.redirect(302, directCdnUrl);
      }

      // Fallback: Stream directly with byte ranges if storage adapter returned buffer
      const audioBuffer = await this.sessionsService.downloadRecordingBuffer(
        sessionId,
        cleanType,
        cleanSpeaker,
        cleanIndex,
      );
      if (!audioBuffer) {
        return res.status(404).json({ error: 'Recording audio not found' });
      }

      const totalLength = audioBuffer.length;
      const range = req.headers?.range;
      if (range) {
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalLength - 1;
        const chunksize = end - start + 1;
        const chunk = audioBuffer.subarray(start, end + 1);

        res.status(206);
        res.set({
          'Content-Range': `bytes ${start}-${end}/${totalLength}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunksize),
          'Content-Type': 'audio/wav',
        });
        res.end(chunk);
      } else {
        res.set({
          'Content-Type': 'audio/wav',
          'Content-Length': String(totalLength),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(audioBuffer);
      }
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
    return this.sessionsService.getUsageData(query);
  }

  @Get('admin/usage/sessions/:id')
  @UseGuards(AdminGuard)
  async getSessionDetail(@Param('id') sessionId: string) {
    return this.sessionsService.getSessionDetail(sessionId);
  }
}

