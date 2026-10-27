import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  Query,
  Req,
  Res,
  UsePipes,
  UseGuards,
  ValidationPipe,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { RoadmapService } from './roadmap.service.js';
import {
  CreateRoadmapLevelDto,
  UpdateRoadmapLevelDto,
  ReorderRoadmapLevelsDto,
  SimulateLevelTurnDto,
  GenerateScenarioPromptDto,
  SynthesizeScenarioTtsDto,
  UploadScenarioAudioDto,
} from './dto/roadmap.dto.js';
import { RecordUserRoadmapProgressDto } from './dto/user-roadmap-progress.dto.js';
import { AuthService } from '../auth/auth.service.js';
import { AdminGuard } from '../auth/guards/admin.guard.js';

@Controller('v1')
export class RoadmapController {
  constructor(
    private readonly roadmapService: RoadmapService,
    private readonly authService: AuthService,
  ) {}

  // 1. Student / Public endpoint - returns only published levels
  @Get('roadmap')
  async getStudentRoadmap() {
    const levels = await this.roadmapService.getAllLevels(false);
    return {
      levels,
      total: levels.length,
    };
  }

  // 2. Admin: Get all levels (draft + published)
  @Get('admin/roadmap')
  @UseGuards(AdminGuard)
  async getAdminRoadmap() {
    const levels = await this.roadmapService.getAllLevels(true);
    return {
      levels,
      total: levels.length,
    };
  }

  // 3. Admin: Get single level details
  @Get('admin/roadmap/:id')
  @UseGuards(AdminGuard)
  async getLevelById(@Param('id') id: string) {
    return this.roadmapService.getLevelById(id);
  }

  // 4. Admin: Create new level
  @Post('admin/roadmap')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async createLevel(@Body() dto: CreateRoadmapLevelDto) {
    return this.roadmapService.createLevel(dto);
  }

  // 5. Admin: Reorder levels
  @Put('admin/roadmap/reorder')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async reorderLevels(@Body() dto: ReorderRoadmapLevelsDto) {
    return this.roadmapService.reorderLevels(dto.levels);
  }

  // 6. Admin: Update level
  @Put('admin/roadmap/:id')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateLevel(
    @Param('id') id: string,
    @Body() dto: UpdateRoadmapLevelDto,
  ) {
    return this.roadmapService.updateLevel(id, dto);
  }

  // 7. Admin: Delete level
  @Delete('admin/roadmap/:id')
  @UseGuards(AdminGuard)
  async deleteLevel(@Param('id') id: string) {
    return this.roadmapService.deleteLevel(id);
  }

  // 8. Admin: Test / Simulate a level turn in the Playground
  @Post('admin/roadmap/simulate')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async simulateLevelTurn(@Body() dto: SimulateLevelTurnDto) {
    return this.roadmapService.simulateTurn(dto);
  }

  // 8b. Admin: Generate AI Persona, Emotion, Opening Protocol, and Directive
  @Post('admin/roadmap/generate-prompt')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async generateScenarioPrompt(@Body() dto: GenerateScenarioPromptDto) {
    return this.roadmapService.generateScenarioPrompt(dto);
  }

  // 8c. Admin: Synthesize Expressive Scenario TTS Preview
  @Post('admin/roadmap/synthesize-tts')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async synthesizeScenarioTts(
    @Body() dto: SynthesizeScenarioTtsDto,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const { audioBase64, mimeType } = await this.roadmapService.synthesizeScenarioTts(
        dto.text,
        dto.language,
        dto.voice,
        false,
        dto.levelId,
        dto.forceFresh,
      );

      // If client explicitly requests JSON without audio, return JSON object
      const acceptHeader = req.headers.accept || '';
      if (acceptHeader.includes('application/json') && !acceptHeader.includes('audio/')) {
        return res.status(200).json({ audioBase64, mimeType });
      }

      // Default: Stream binary audio buffer for direct browser audio playback
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      res.set({
        'Content-Type': mimeType || 'audio/wav',
        'Content-Length': String(audioBuffer.length),
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'public, max-age=3600',
      });
      res.end(audioBuffer);
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'TTS synthesis failed' });
    }
  }

  // 8e. Admin: Upload Custom Pre-Recorded Audio WAV File
  @Post('admin/roadmap/upload-audio')
  @UseGuards(AdminGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async uploadScenarioAudio(@Body() dto: UploadScenarioAudioDto) {
    return this.roadmapService.uploadScenarioAudio(dto);
  }

  // 8d. Public / Student: Stream Scenario Briefing Audio (Direct Azure CDN 302 Redirect with range fallback)
  @Get('roadmap/levels/:id/briefing-audio')
  async streamBriefingAudio(
    @Param('id') id: string,
    @Query('lang') lang: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const cleanLang = (lang === 'si' ? 'si' : 'en') as 'en' | 'si';
    try {
      // Approach A: Instant 302 redirect to Azure Blob Storage CDN for native client HTTP range streaming
      const directCdnUrl = await this.roadmapService.getBriefingAudioUrl(id, cleanLang);
      if (directCdnUrl) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
        return res.redirect(302, directCdnUrl);
      }

      const { audioBuffer, mimeType } = await this.roadmapService.getBriefingAudio(id, cleanLang);
      const totalLength = audioBuffer.length;
      const range = req.headers.range;

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
          'Content-Type': mimeType,
        });
        res.end(chunk);
      } else {
        res.set({
          'Content-Type': mimeType,
          'Content-Length': String(totalLength),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=86400',
        });
        res.end(audioBuffer);
      }
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Could not stream briefing audio' });
    }
  }

  // 9. User Roadmap Progress: Get completed levels for user
  @Get('roadmap/user-progress')
  async getUserProgress(
    @Headers('authorization') authHeader?: string,
    @Query('userId') queryUserId?: string,
  ) {
    let userId = queryUserId;
    if (authHeader) {
      try {
        userId = this.authService.validateAuthToken(authHeader);
      } catch {}
    }
    if (!userId) {
      const activeProf = await this.authService.getActiveProfile();
      userId = activeProf?.id;
    }
    if (!userId) {
      throw new UnauthorizedException('Authentication required to view roadmap progress');
    }

    const progress = await this.roadmapService.getUserProgress(userId);
    const completedItems = progress.filter((p) => p.status === 'completed' || p.isPassed);
    return {
      userId,
      progress,
      completedLevelIds: completedItems.map((p) => p.roadmapLevelId),
      completedLevelNumbers: completedItems.map((p) => p.levelNumber),
      totalCompleted: completedItems.length,
    };
  }

  // 10. User Roadmap Progress: Record a completed level
  @Post('roadmap/user-progress')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async recordUserProgress(
    @Body() dto: RecordUserRoadmapProgressDto,
    @Headers('authorization') authHeader?: string,
    @Query('userId') queryUserId?: string,
  ) {
    let userId = queryUserId;
    if (authHeader) {
      try {
        userId = this.authService.validateAuthToken(authHeader);
      } catch {}
    }
    if (!userId) {
      const activeProf = await this.authService.getActiveProfile();
      userId = activeProf?.id;
    }
    if (!userId) {
      throw new UnauthorizedException('Authentication required to record roadmap progress');
    }

    return this.roadmapService.recordUserProgress(userId, dto);
  }
}
