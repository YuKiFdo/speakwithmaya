import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  CreateRoadmapLevelDto,
  UpdateRoadmapLevelDto,
  ReorderItemDto,
  SimulateLevelTurnDto,
  GenerateScenarioPromptDto,
  UploadScenarioAudioDto,
  parseCanonicalLessonContent,
  formatCanonicalLessonContent,
} from './dto/roadmap.dto.js';
import {
  UserRoadmapProgressEntity,
  RecordUserRoadmapProgressDto,
} from './dto/user-roadmap-progress.dto.js';
import { randomUUID, createHash } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

export interface RoadmapLevelEntity {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
  targetDurationMinutes?: number;
  xpReward: number;
  iconType: string;
  numberColor: string;
  haloColor: string;
  haloBorderColor: string;
  scenarioId?: string;
  customSvg?: string;
  practicePoints: string[];
  canonicalContent: string;
  passingScorePercent?: number;
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  isScenarioMode?: boolean;
  userRole?: string;
  mayaRole?: string;
  goalTitle?: string;
  goalDescription?: string;
  ttsScriptEnglish?: string;
  ttsScriptSinhala?: string;
  audioUrlEnglish?: string;
  audioUrlSinhala?: string;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RoadmapService implements OnModuleInit {
  private readonly logger = new Logger(RoadmapService.name);
  private readonly supabase: SupabaseClient | null = null;
  private hasHaloBorderColorSnake = false;
  private readonly briefingAudioCache = new Map<string, Buffer>();
  private readonly inFlightSyntheses = new Map<string, Promise<Buffer>>();
  private readonly audioCacheDir = path.resolve(process.cwd(), 'assets', 'audio-cache');

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('RoadmapService connected to Supabase client');
      this.checkSchema();
    } else {
      this.logger.warn('RoadmapService: SUPABASE_URL or keys not configured; Supabase features unavailable');
    }

    try {
      if (!fs.existsSync(this.audioCacheDir)) {
        fs.mkdirSync(this.audioCacheDir, { recursive: true });
      }
    } catch (err: any) {
      this.logger.warn(`Could not create audio cache directory: ${err?.message}`);
    }
  }

  async onModuleInit() {
    await this.ensureStorageBucket();
    // Eagerly prewarm roadmap audio in background on server start
    setTimeout(() => {
      this.warmupAllLevelsAudio().catch((err) => {
        this.logger.warn(`[Audio Warmup] Failed during initial warmup: ${err?.message}`);
      });
    }, 2500);
  }

  private async ensureStorageBucket(): Promise<void> {
    if (!this.supabase) return;
    try {
      const { data: buckets } = await this.supabase.storage.listBuckets();
      if (!buckets?.find((b) => b.name === 'roadmap-audio')) {
        await this.supabase.storage.createBucket('roadmap-audio', { public: true });
        this.logger.log('Created Supabase storage bucket "roadmap-audio"');
      }
    } catch (err: any) {
      this.logger.warn(`Could not verify/create roadmap-audio storage bucket: ${err?.message}`);
    }
  }

  private async restoreAudioFromSupabase(
    levelId: string,
    lang: 'en' | 'si',
    diskPath: string,
  ): Promise<Buffer | null> {
    if (!this.supabase) return null;
    const cacheKey = `${levelId}_${lang}`;
    try {
      const { data, error } = await this.supabase.storage
        .from('roadmap-audio')
        .download(`${cacheKey}.wav`);
      if (error || !data) return null;

      const arrayBuffer = await data.arrayBuffer();
      const audioBuffer = Buffer.from(arrayBuffer);
      this.briefingAudioCache.set(cacheKey, audioBuffer);
      try {
        fs.writeFileSync(diskPath, audioBuffer);
        this.logger.log(`[Supabase CDN Cache] Restored ${cacheKey}.wav from Supabase Storage (${audioBuffer.length} bytes)`);
      } catch (err: any) {
        this.logger.debug(`Could not write restored disk cache for ${cacheKey}: ${err?.message}`);
      }

      // Also register contentHash cache for instant Admin Studio TTS preview hits
      try {
        const level = await this.getLevelById(levelId);
        const script = (lang === 'si' ? level.ttsScriptSinhala : level.ttsScriptEnglish)?.trim();
        if (script) {
          const contentHash = createHash('sha256')
            .update(`${lang}_Callirrhoe_${script}`)
            .digest('hex')
            .slice(0, 24);
          this.briefingAudioCache.set(contentHash, audioBuffer);
          const hashDiskPath = path.join(this.audioCacheDir, `tts_${contentHash}.wav`);
          try {
            if (!fs.existsSync(hashDiskPath)) fs.writeFileSync(hashDiskPath, audioBuffer);
          } catch {}
        }
      } catch {}

      return audioBuffer;
    } catch {
      return null;
    }
  }

  private async uploadAudioToSupabase(
    levelId: string,
    lang: 'en' | 'si',
    audioBuffer: Buffer,
  ): Promise<string | null> {
    if (!this.supabase) return null;
    const cacheKey = `${levelId}_${lang}`;
    try {
      const { error: uploadErr } = await this.supabase.storage
        .from('roadmap-audio')
        .upload(`${cacheKey}.wav`, audioBuffer, {
          contentType: 'audio/wav',
          upsert: true,
        });

      if (uploadErr) {
        this.logger.warn(`[Supabase Storage] Upload error for ${cacheKey}: ${uploadErr.message}`);
        return null;
      }

      const { data: pubData } = this.supabase.storage
        .from('roadmap-audio')
        .getPublicUrl(`${cacheKey}.wav`);
      const publicUrl = pubData?.publicUrl || '';
      this.logger.log(`[Supabase Storage] Uploaded ${cacheKey}.wav -> ${publicUrl}`);

      // Update roadmap_levels row in Supabase
      const updatePayload: Record<string, any> = {
        [lang === 'si' ? 'audio_url_sinhala' : 'audio_url_english']: publicUrl,
        updated_at: new Date().toISOString(),
      };
      await this.supabase
        .from('roadmap_levels')
        .update(updatePayload)
        .eq('id', levelId);

      return publicUrl;
    } catch (err: any) {
      this.logger.warn(`[Supabase Storage] Failed to upload ${cacheKey}: ${err?.message}`);
      return null;
    }
  }

  async warmupAllLevelsAudio(): Promise<void> {
    try {
      const levels = await this.getAllLevels(true);
      for (const lvl of levels) {
        if (!lvl.isPublished && lvl.levelNumber > 3) continue;
        for (const lang of ['en', 'si'] as const) {
          const cacheKey = `${lvl.id}_${lang}`;
          const diskPath = path.join(this.audioCacheDir, `${cacheKey}.wav`);
          const existingUrl = lang === 'si' ? lvl.audioUrlSinhala : lvl.audioUrlEnglish;

          // 1. If local disk has it, ensure it's synced to Supabase Storage
          if (fs.existsSync(diskPath)) {
            if (this.supabase && (!existingUrl || !existingUrl.trim())) {
              try {
                const audioBuffer = fs.readFileSync(diskPath);
                await this.uploadAudioToSupabase(lvl.id, lang, audioBuffer);
              } catch (e: any) {
                this.logger.debug(`Could not sync existing disk audio to Supabase for ${cacheKey}: ${e?.message}`);
              }
            }
            continue;
          }

          // 2. If not on disk, check if Supabase Storage already has it (zero cost restore)
          if (this.supabase) {
            const restored = await this.restoreAudioFromSupabase(lvl.id, lang, diskPath);
            if (restored) {
              continue;
            }
          }

          // 3. Otherwise synthesize fresh
          if (!this.inFlightSyntheses.has(cacheKey)) {
            this.logger.log(`[Audio Warmup] Pre-synthesizing ${lvl.title} (${lang})...`);
            await this.getBriefingAudio(lvl.id, lang).catch((e) => {
              this.logger.warn(`[Audio Warmup] Error pre-synthesizing ${lvl.id} (${lang}): ${e?.message}`);
            });
          }
        }
      }
    } catch (err: any) {
      this.logger.debug(`warmupAllLevelsAudio skipped: ${err?.message}`);
    }
  }

  prewarmLevelAudio(levelId: string): void {
    // Fire-and-forget background pre-warm and upload to Supabase Storage
    for (const lang of ['en', 'si'] as const) {
      const cacheKey = `${levelId}_${lang}`;
      this.briefingAudioCache.delete(cacheKey);
      const diskPath = path.join(this.audioCacheDir, `${cacheKey}.wav`);
      try {
        if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
      } catch {}
      this.getBriefingAudio(levelId, lang).catch((err) => {
        this.logger.warn(`[Prewarm] Background audio synthesis failed for ${cacheKey}: ${err?.message}`);
      });
    }
  }

  private async checkSchema() {
    if (!this.supabase) return;
    try {
      const { error: snakeErr } = await this.supabase
        .from('roadmap_levels')
        .select('halo_border_color')
        .limit(1);
      this.hasHaloBorderColorSnake = !snakeErr;
    } catch {
      this.hasHaloBorderColorSnake = false;
    }
  }

  private mapDbRowToEntity(d: any): RoadmapLevelEntity {
    const rawPoints =
      d.practice_points ||
      d.practicePoints ||
      (Array.isArray(d.learning_objectives) ? d.learning_objectives.map((o: any) => o.title || o) : []);
    const practicePoints: string[] = Array.isArray(rawPoints)
      ? rawPoints.map((p: any) => (typeof p === 'string' ? p : p.title || String(p)))
      : [];
    const canonicalContent =
      d.canonical_content || d.canonicalContent || formatCanonicalLessonContent(d.title, practicePoints);

    return {
      id: d.id,
      levelNumber: d.level_number ?? d.levelNumber ?? 1,
      title: d.title || '',
      description: d.description || '',
      topic: d.topic || '',
      targetDurationMinutes: d.target_duration_minutes ?? d.targetDurationMinutes ?? 6,
      xpReward: d.xp_reward ?? d.xpReward ?? 100,
      iconType: d.icon_type || d.iconType || 'chat',
      numberColor: d.number_color || d.numberColor || '#0057FF',
      haloColor: d.halo_color || d.haloColor || '#EFF6FF',
      haloBorderColor: d.halo_border_color || d.halobordercolor || d.haloBorderColor || '#BFDBFE',
      scenarioId: d.scenario_id || d.scenarioId || 'general-practice',
      customSvg: d.custom_svg || d.customSvg || '',
      practicePoints,
      canonicalContent,
      passingScorePercent: d.passing_score_percent ?? d.passingScorePercent ?? 75,
      scenarioPrompt: d.scenario_prompt || d.scenarioPrompt || '',
      openingMode: d.opening_mode || d.openingMode || 'maya_explains_first',
      openingLine: d.opening_line || d.openingLine || '',
      scenarioBriefing: d.scenario_briefing || d.scenarioBriefing || d.description || '',
      emotionTags: Array.isArray(d.emotion_tags || d.emotionTags) ? (d.emotion_tags || d.emotionTags) : ['neutral'],
      isScenarioMode: d.is_scenario_mode ?? d.isScenarioMode ?? true,
      userRole: d.user_role || d.userRole || '',
      mayaRole: d.maya_role || d.mayaRole || '',
      goalTitle: d.goal_title || d.goalTitle || '',
      goalDescription: d.goal_description || d.goalDescription || '',
      ttsScriptEnglish: d.tts_script_english || d.ttsScriptEnglish || '',
      ttsScriptSinhala: d.tts_script_sinhala || d.ttsScriptSinhala || '',
      audioUrlEnglish: d.audio_url_english || d.audioUrlEnglish || '',
      audioUrlSinhala: d.audio_url_sinhala || d.audioUrlSinhala || '',
      isPublished: d.is_published ?? d.isPublished ?? true,
      createdAt: d.created_at || d.createdAt || new Date().toISOString(),
      updatedAt: d.updated_at || d.updatedAt || new Date().toISOString(),
    };
  }

  private mapEntityToDbRow(e: RoadmapLevelEntity): any {
    const row: any = {
      id: e.id,
      level_number: e.levelNumber,
      title: e.title,
      description: e.description,
      topic: e.topic,
      target_duration_minutes: e.targetDurationMinutes ?? 6,
      xp_reward: e.xpReward,
      icon_type: e.iconType,
      number_color: e.numberColor,
      halo_color: e.haloColor,
      scenario_id: e.scenarioId,
      custom_svg: e.customSvg || '',
      practice_points: e.practicePoints,
      canonical_content: e.canonicalContent,
      passing_score_percent: e.passingScorePercent,
      scenario_prompt: e.scenarioPrompt || '',
      opening_mode: e.openingMode || 'maya_explains_first',
      opening_line: e.openingLine || '',
      scenario_briefing: e.scenarioBriefing || e.description || '',
      emotion_tags: e.emotionTags || ['neutral'],
      is_scenario_mode: e.isScenarioMode ?? true,
      user_role: e.userRole || '',
      maya_role: e.mayaRole || '',
      goal_title: e.goalTitle || '',
      goal_description: e.goalDescription || '',
      tts_script_english: e.ttsScriptEnglish || '',
      tts_script_sinhala: e.ttsScriptSinhala || '',
      audio_url_english: e.audioUrlEnglish || '',
      audio_url_sinhala: e.audioUrlSinhala || '',
      is_published: e.isPublished,
      created_at: e.createdAt,
      updated_at: e.updatedAt,
    };

    if (this.hasHaloBorderColorSnake) {
      row.halo_border_color = e.haloBorderColor;
    } else {
      row.halobordercolor = e.haloBorderColor;
    }

    return row;
  }


  async getAllLevels(adminView: boolean = true): Promise<RoadmapLevelEntity[]> {
    if (!this.supabase) {
      this.logger.warn('Supabase client not initialized in getAllLevels');
      return [];
    }

    try {
      let query = this.supabase
        .from('roadmap_levels')
        .select('*')
        .order('level_number', { ascending: true });

      if (!adminView) {
        query = query.eq('is_published', true);
      }

      const { data, error } = await query;
      if (error) {
        this.logger.error(`Supabase DB query error in getAllLevels: ${error.message} (code: ${error.code})`);
        return [];
      }

      return (data || []).map((d: any) => this.mapDbRowToEntity(d));
    } catch (err: any) {
      this.logger.error(`getAllLevels query failed: ${err?.message}`);
      return [];
    }
  }

  async getLevelById(id: string): Promise<RoadmapLevelEntity> {
    if (!this.supabase) {
      throw new NotFoundException(`Roadmap level with id '${id}' not found (Supabase offline)`);
    }

    try {
      // 1. Try matching exact id
      const { data, error } = await this.supabase
        .from('roadmap_levels')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!error && data) {
        return this.mapDbRowToEntity(data);
      }

      // 2. If id contains a number (e.g. 'lvl-1' or '1' or 'lvl-01'), search by level_number
      const numMatch = String(id).match(/\d+/);
      if (numMatch) {
        const levelNum = parseInt(numMatch[0], 10);
        const { data: numData, error: numError } = await this.supabase
          .from('roadmap_levels')
          .select('*')
          .eq('level_number', levelNum)
          .maybeSingle();

        if (!numError && numData) {
          return this.mapDbRowToEntity(numData);
        }
      }
    } catch (err: any) {
      this.logger.debug(`getLevelById error for id ${id}: ${err?.message}`);
    }

    throw new NotFoundException(`Roadmap level with id '${id}' not found`);
  }

  async createLevel(dto: CreateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
    if (!this.supabase) {
      throw new Error('Supabase client not available to create roadmap level');
    }

    const title = dto.title.trim();
    let practicePoints = (dto.practicePoints && dto.practicePoints.length > 0) ? dto.practicePoints : [];

    if (practicePoints.length === 0 && dto.canonicalContent) {
      const parsed = parseCanonicalLessonContent(dto.canonicalContent);
      if (parsed.practicePoints.length > 0) {
        practicePoints = parsed.practicePoints;
      }
    }

    const canonicalContent = formatCanonicalLessonContent(title, practicePoints);
    const newId = `lvl-${Date.now().toString(36)}`;
    const newLevel: RoadmapLevelEntity = {
      id: newId,
      levelNumber: dto.levelNumber,
      title,
      description: dto.description?.trim() || '',
      topic: dto.topic?.trim() || title,
      targetDurationMinutes: dto.targetDurationMinutes || (Math.floor(Math.random() * 4) + 5),
      xpReward: dto.xpReward || 100,
      iconType: dto.iconType || 'chat',
      numberColor: dto.numberColor || '#0057FF',
      haloColor: dto.haloColor || '#EFF6FF',
      haloBorderColor: dto.haloBorderColor || '#BFDBFE',
      scenarioId: dto.scenarioId || 'general-practice',
      customSvg: dto.customSvg,
      practicePoints,
      canonicalContent,
      passingScorePercent: dto.passingScorePercent || 75,
      scenarioPrompt: dto.scenarioPrompt || '',
      openingMode: dto.openingMode || 'maya_explains_first',
      openingLine: dto.openingLine || '',
      scenarioBriefing: dto.scenarioBriefing || dto.description?.trim() || '',
      emotionTags: dto.emotionTags || ['neutral'],
      isScenarioMode: dto.isScenarioMode ?? true,
      userRole: dto.userRole?.trim() || '',
      mayaRole: dto.mayaRole?.trim() || '',
      goalTitle: dto.goalTitle?.trim() || '',
      goalDescription: dto.goalDescription?.trim() || '',
      ttsScriptEnglish: dto.ttsScriptEnglish?.trim() || '',
      ttsScriptSinhala: dto.ttsScriptSinhala?.trim() || '',
      audioUrlEnglish: dto.audioUrlEnglish?.trim() || '',
      audioUrlSinhala: dto.audioUrlSinhala?.trim() || '',
      isPublished: dto.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbRow = this.mapEntityToDbRow(newLevel);
    const { error } = await this.supabase.from('roadmap_levels').insert(dbRow);
    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(`Level number ${newLevel.levelNumber} already exists in the roadmap. Please choose a different level number.`);
      }
      this.logger.error(`Failed to insert level ${newLevel.id} into Supabase DB: ${error.message} (code: ${error.code})`);
      throw new Error(`Failed to create level in Supabase DB: ${error.message}`);
    }

    this.logger.log(`[DB INSERT] Successfully added level "${newLevel.title}" (${newLevel.id}) to Supabase DB`);
    this.prewarmLevelAudio(newLevel.id);
    return newLevel;
  }

  async updateLevel(id: string, dto: UpdateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
    if (!this.supabase) {
      throw new Error('Supabase client not available to update roadmap level');
    }

    const existing = await this.getLevelById(id);
    const title = dto.title !== undefined ? dto.title.trim() : existing.title;
    let practicePoints = dto.practicePoints !== undefined ? dto.practicePoints : existing.practicePoints;

    if (practicePoints.length === 0 && dto.canonicalContent) {
      const parsed = parseCanonicalLessonContent(dto.canonicalContent);
      if (parsed.practicePoints.length > 0) {
        practicePoints = parsed.practicePoints;
      }
    }

    const canonicalContent = formatCanonicalLessonContent(title, practicePoints);

    const updated: RoadmapLevelEntity = {
      ...existing,
      levelNumber: dto.levelNumber !== undefined ? dto.levelNumber : existing.levelNumber,
      title,
      description: dto.description !== undefined ? dto.description.trim() : existing.description,
      topic: dto.topic !== undefined ? dto.topic.trim() : existing.topic,
      targetDurationMinutes: dto.targetDurationMinutes !== undefined ? dto.targetDurationMinutes : existing.targetDurationMinutes,
      xpReward: dto.xpReward !== undefined ? dto.xpReward : existing.xpReward,
      iconType: dto.iconType !== undefined ? dto.iconType : existing.iconType,
      numberColor: dto.numberColor !== undefined ? dto.numberColor : existing.numberColor,
      haloColor: dto.haloColor !== undefined ? dto.haloColor : existing.haloColor,
      haloBorderColor: dto.haloBorderColor !== undefined ? dto.haloBorderColor : existing.haloBorderColor,
      scenarioId: dto.scenarioId !== undefined ? dto.scenarioId : existing.scenarioId,
      customSvg: dto.customSvg !== undefined ? dto.customSvg : existing.customSvg,
      practicePoints,
      canonicalContent,
      passingScorePercent: dto.passingScorePercent !== undefined ? dto.passingScorePercent : existing.passingScorePercent,
      scenarioPrompt: dto.scenarioPrompt !== undefined ? dto.scenarioPrompt : existing.scenarioPrompt,
      openingMode: dto.openingMode !== undefined ? dto.openingMode : existing.openingMode,
      openingLine: dto.openingLine !== undefined ? dto.openingLine : existing.openingLine,
      scenarioBriefing: dto.scenarioBriefing !== undefined ? dto.scenarioBriefing : existing.scenarioBriefing,
      emotionTags: dto.emotionTags !== undefined ? dto.emotionTags : existing.emotionTags,
      isScenarioMode: dto.isScenarioMode !== undefined ? dto.isScenarioMode : existing.isScenarioMode,
      userRole: dto.userRole !== undefined ? dto.userRole.trim() : existing.userRole || '',
      mayaRole: dto.mayaRole !== undefined ? dto.mayaRole.trim() : existing.mayaRole || '',
      goalTitle: dto.goalTitle !== undefined ? dto.goalTitle.trim() : existing.goalTitle || '',
      goalDescription: dto.goalDescription !== undefined ? dto.goalDescription.trim() : existing.goalDescription || '',
      ttsScriptEnglish: dto.ttsScriptEnglish !== undefined ? dto.ttsScriptEnglish.trim() : existing.ttsScriptEnglish || '',
      ttsScriptSinhala: dto.ttsScriptSinhala !== undefined ? dto.ttsScriptSinhala.trim() : existing.ttsScriptSinhala || '',
      audioUrlEnglish: dto.audioUrlEnglish !== undefined ? dto.audioUrlEnglish.trim() : existing.audioUrlEnglish || '',
      audioUrlSinhala: dto.audioUrlSinhala !== undefined ? dto.audioUrlSinhala.trim() : existing.audioUrlSinhala || '',
      isPublished: dto.isPublished !== undefined ? dto.isPublished : existing.isPublished,
      updatedAt: new Date().toISOString(),
    };

    const dbRow = this.mapEntityToDbRow(updated);
    const { error } = await this.supabase
      .from('roadmap_levels')
      .update(dbRow)
      .eq('id', existing.id);

    if (error) {
      if (error.code === '23505') {
        throw new ConflictException(`Level number ${updated.levelNumber} already exists in the roadmap. Please choose a different level number.`);
      }
      this.logger.error(`Failed to update level ${existing.id} in Supabase DB: ${error.message} (code: ${error.code})`);
      throw new Error(`Failed to update level in Supabase DB: ${error.message}`);
    }

    // Invalidate cached audio files for this level if script changed
    for (const lang of ['en', 'si'] as const) {
      const cacheKey = `${existing.id}_${lang}`;
      this.briefingAudioCache.delete(cacheKey);
      const diskPath = path.join(this.audioCacheDir, `${cacheKey}.wav`);
      if (fs.existsSync(diskPath)) {
        try { fs.unlinkSync(diskPath); } catch {}
      }
    }
    // Re-prewarm immediately in background
    this.prewarmLevelAudio(existing.id);

    this.logger.log(`[DB UPDATE] Successfully updated level "${updated.title}" (${existing.id}) in Supabase DB`);
    return updated;
  }

  async deleteLevel(id: string): Promise<{ success: boolean; deletedId: string }> {
    if (!this.supabase) {
      throw new Error('Supabase client not available to delete roadmap level');
    }

    const { error } = await this.supabase.from('roadmap_levels').delete().eq('id', id);
    if (error) {
      this.logger.error(`Failed to delete level ${id} from Supabase DB: ${error.message}`);
      throw new Error(`Failed to delete level from Supabase: ${error.message}`);
    }

    this.logger.log(`[DB DELETE] Successfully deleted level ${id} from Supabase DB`);
    return { success: true, deletedId: id };
  }

  async reorderLevels(items: ReorderItemDto[]): Promise<RoadmapLevelEntity[]> {
    if (this.supabase) {
      for (const item of items) {
        try {
          await this.supabase
            .from('roadmap_levels')
            .update({ level_number: item.levelNumber, updated_at: new Date().toISOString() })
            .eq('id', item.id);
        } catch (err: any) {
          this.logger.warn(`Failed to reorder level ${item.id}: ${err?.message}`);
        }
      }
    }
    return this.getAllLevels(true);
  }

  async simulateTurn(dto: SimulateLevelTurnDto) {
    const title = dto.levelTitle || 'Speaking Practice';
    const points = (dto.practicePoints || []).map((p) => `- ${p}`).join('\n');

    let systemPrompt = '';
    if (dto.scenarioPrompt && dto.scenarioPrompt.trim().length > 0) {
      systemPrompt = `${dto.scenarioPrompt.trim()}

INSTRUCTIONS:
1. Student just said: "${dto.userMessage}".
2. Fully commit to your roleplay character persona, emotional state, and scenario context.
3. Respond dynamically as your character. Keep your spoken response strictly under 15 words.
4. Check if the student made a noticeable phrasing or grammar mistake.
5. Return ONLY a valid JSON object matching:
{
  "mayaSpoken": "Your spoken reply in character strictly under 15 words",
  "wordCount": 10,
  "hasMistake": boolean,
  "correction": {
    "studentSaid": "mistake phrase",
    "moreNatural": "corrected natural phrase",
    "explanation": "concise explanation in natural Sinhala/Singlish",
    "highlightWords": ["words"]
  } | null,
  "focusEvaluation": "1 sentence on how the reply advances the roleplay scenario"
}`;
    } else {
      systemPrompt = `You are Maya, a dynamic, encouraging AI English speaking coach for Sri Lankan learners.
LESSON: "${title}"
PRACTICE GOALS:
${points || '- General conversation'}

INSTRUCTIONS:
1. Student just said: "${dto.userMessage}".
2. Check if the student made an obvious phrasing or grammar mistake.
3. Respond dynamically as Maya. Keep your spoken response strictly under 15 words.
4. If there was a grammatical mistake, verbally model the correction in natural everyday Sinhala, followed immediately by your next practice prompt.
5. Return ONLY a valid JSON object matching:
{
  "mayaSpoken": "Your spoken reply strictly under 15 words",
  "wordCount": 10,
  "hasMistake": boolean,
  "correction": {
    "studentSaid": "mistake phrase",
    "moreNatural": "corrected natural phrase",
    "explanation": "concise explanation in natural Sinhala",
    "highlightWords": ["words"]
  } | null,
  "focusEvaluation": "1 sentence on how the reply addresses the lesson goals"
}`;
    }


    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: 'gemini-3.5-flash-lite',
          contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
          config: {
            responseMimeType: 'application/json',
          },
        });
        const text = res.text?.trim() || '';
        if (text) {
          const parsed = JSON.parse(text);
          const words = (parsed.mayaSpoken || '').split(/\s+/).filter(Boolean).length;
          return {
            success: true,
            ...parsed,
            wordCount: words,
          };
        }
      } catch (err: any) {
        this.logger.debug(`Gemini simulation API call: ${err?.message}`);
      }
    }

    return {
      success: true,
      mayaSpoken: `That was a great attempt! How would you describe that next?`,
      wordCount: 11,
      hasMistake: false,
      correction: null,
      focusEvaluation: `Engaged with student input and prompted next turn under 15 words.`,
    };
  }

  async getUserProgress(userId: string): Promise<UserRoadmapProgressEntity[]> {
    if (!this.supabase) {
      this.logger.warn('Supabase client not available in getUserProgress');
      return [];
    }

    try {
      const { data, error } = await this.supabase
        .from('user_roadmap_progress')
        .select('*')
        .eq('user_id', userId)
        .order('level_number', { ascending: true });

      if (error) {
        this.logger.warn(`getUserProgress Supabase error (${error.code}): ${error.message}`);
        return [];
      }

      if (Array.isArray(data)) {
        return data.map((d: any) => ({
          id: d.id,
          userId: d.user_id,
          roadmapLevelId: d.roadmap_level_id,
          levelNumber: d.level_number,
          sessionId: d.session_id,
          status: d.status,
          scorePercent: d.score_percent,
          isPassed: d.is_passed,
          xpEarned: d.xp_earned,
          completedAt: d.completed_at,
          createdAt: d.created_at,
          updatedAt: d.updated_at,
        }));
      }
    } catch (err: any) {
      this.logger.debug(`getUserProgress query error: ${err?.message}`);
    }

    return [];
  }

  async recordUserProgress(
    userId: string,
    dto: RecordUserRoadmapProgressDto,
  ): Promise<UserRoadmapProgressEntity> {
    const now = new Date().toISOString();
    const record: UserRoadmapProgressEntity = {
      id: randomUUID(),
      userId,
      roadmapLevelId: dto.roadmapLevelId,
      levelNumber: dto.levelNumber,
      sessionId: dto.sessionId || null,
      status: dto.status || 'completed',
      scorePercent: dto.scorePercent ?? 75,
      isPassed: dto.isPassed ?? true,
      xpEarned: dto.xpEarned ?? 100,
      completedAt: dto.isPassed !== false ? now : undefined,
      createdAt: now,
      updatedAt: now,
    };

    if (this.supabase) {
      try {
        const row = {
          id: record.id,
          user_id: record.userId,
          roadmap_level_id: record.roadmapLevelId,
          level_number: record.levelNumber,
          session_id: record.sessionId,
          status: record.status,
          score_percent: record.scorePercent,
          is_passed: record.isPassed,
          xp_earned: record.xpEarned,
          completed_at: record.completedAt,
          updated_at: record.updatedAt,
        };
        const { error } = await this.supabase
          .from('user_roadmap_progress')
          .upsert(row, { onConflict: 'user_id, roadmap_level_id' });
        if (error) {
          this.logger.warn(`Failed to upsert user_roadmap_progress to Supabase: ${error.message}`);
        } else {
          this.logger.log(`[DB UPSERT] Recorded user_roadmap_progress in Supabase for user ${userId}, level ${record.roadmapLevelId}`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to upsert user_roadmap_progress to Supabase: ${err?.message}`);
      }
    }

    return record;
  }

  async generateScenarioPrompt(dto: GenerateScenarioPromptDto): Promise<{
    emotion: string;
    openingMode: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
    openingLine: string;
    scenarioPrompt: string;
    ttsScriptEnglish: string;
    ttsScriptSinhala: string;
  }> {
    const userRole = (dto.userRole || '').trim() || 'English Learner';
    const mayaRole = (dto.mayaRole || '').trim() || 'Roleplay Partner';
    const goalTitle = (dto.goalTitle || '').trim() || 'Reach a positive resolution';
    const goalDesc = (dto.goalDescription || '').trim() || 'Express your thoughts clearly and resolve the situation.';
    const briefing = (dto.briefing || '').trim() || dto.title;

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const systemPrompt = `You are an expert AI roleplay prompt engineer and voice director for Maya AI, an English speaking coach app.
An admin is creating a real-world scenario practice level for students learning English.
Given the scenario details below, generate:
1. "emotion": The single most appropriate primary emotional state for Maya from: "angry" | "crying" | "cheerful" | "strict" | "professional" | "neutral"
2. "openingMode": The best opening protocol from:
   - "maya_explains_first" (Maya introduces setup briefly in 1 sentence, then transitions into character)
   - "maya_in_character" (Maya immediately starts speaking in character without any intro)
   - "user_starts" (Maya waits for the student to speak first)
3. "openingLine": Maya's exact first spoken opening sentence in character (concise, natural English, under 18 words).
4. "scenarioPrompt": A full, highly detailed prompt directive for the AI roleplay actor (approx 800 - 1200 characters) containing:
   - Maya's Character Persona, role (${mayaRole}), backstory, setting, and relation to the student (${userRole}).
   - Emotional state and acoustic acting behavior matching the selected emotion.
   - Core Conversation Rules:
     * Keep every spoken response strictly under 15-20 words per turn. No long monologues.
     * React authentically to what the student says.
     * Speak natural, conversational English.
   - MANDATORY GOAL COMPLETION & WRAP-UP DIRECTIVE:
     * Maya must actively track whether the student achieves their goal: "${goalTitle}: ${goalDesc}".
     * As soon as the student demonstrates the required behavior / reaches agreement / calms Maya down / solves the problem, Maya must accept the outcome in character (e.g. "Alright, that works for me. Thank you for sorting this out."), deliver a natural concluding remark in character, and gracefully wrap up the roleplay session.

5. "ttsScriptEnglish": A warm, encouraging English spoken briefing narration (approx 60-90 words) where Maya speaks directly to the student before the call to explain the scenario, roles, and goal.
Use natural conversational expression tags: <short pause>, <sighs>, <chuckle>, <cheer>, <giggle>.
Format EXACTLY like this structure:
Welcome to your next scenario: ${dto.title}! <short pause>

Picture this... <sighs> [1-2 sentences setting the scene based on: ${briefing}]

In this scenario, your role is ${userRole}, <short pause> and Maya will be playing ${mayaRole}.

Your goal here is simple: ${goalTitle}.

[1-2 sentences explaining: ${goalDesc} with realistic advice]. <short pause>

Ready? Let's start the roleplay!

6. "ttsScriptSinhala": Spoken colloquial Sri Lankan Sinhala (කතා කරන සිංහල) warmly spoken by Maya, naturally blended with everyday English roleplay terms (Singlish conversational style, approx 60-90 words).
CRITICAL RULES FOR SINHALA:
- DO NOT explain in English! The narration must be primarily in spoken colloquial Sinhala with English loanwords naturally blended in.
- DO NOT use formal bookish Sinhala (no "කරනු ලැබේ", "ඔබට", "සඳහාය", "ලදිමි").
- Use everyday spoken words ("ඔයා", "හිතන්නකෝ", "කලබල නොවී", "calm පිට", "issue එක explain කරලා", "හොඳ solution එකක් negotiate කරන්න", "Ready ද?").
- Include conversational expression tags: <short pause>, <sighs>, <chuckle>.
Format EXACTLY like this structure:
හරි... ඔයාගේ ඊළඟ scenario එක: ${dto.title}! <short pause>

මේක පොඩ්ඩක් හිතන්නකෝ... <sighs> [1-2 sentences setting the scene in spoken Sinhala with natural English loanwords based on: ${briefing}]. <short pause>

මේ scenario එකේ ඔයා තමයි ${userRole}, <short pause> Maya තමයි ${mayaRole} විදිහට ඉන්නේ.

ඔයාගේ goal එක හරිම simple: [Goal Title in spoken Sinhala].

[1-2 sentences explaining the goal in spoken Sinhala with practical advice, e.g. කලබල නොවී calm පිට issue එක explain කරලා, Maya එක්ක කතා කරලා හොඳ solution එකක් negotiate කරන්න]. <short pause>

Ready ද? <short pause> එහෙනම් අපි roleplay එක පටන් ගමු!

SCENARIO DETAILS:
- Title: ${dto.title}
- Topic/Category: ${dto.topic || 'Role Play Practice'}
- Situation Briefing: ${briefing}
- Student's Role: ${userRole}
- Maya's Role: ${mayaRole}
- Student's Goal Title: ${goalTitle}
- Student's Goal Description: ${goalDesc}

Return strictly a JSON object with:
{
  "emotion": "angry" | "crying" | "cheerful" | "strict" | "professional" | "neutral",
  "openingMode": "maya_explains_first" | "maya_in_character" | "user_starts",
  "openingLine": "string",
  "scenarioPrompt": "string",
  "ttsScriptEnglish": "string",
  "ttsScriptSinhala": "string"
}`;

        const res = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: [{ role: 'user', parts: [{ text: systemPrompt }] }],
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = res.text?.trim() || '';
        if (text) {
          const parsed = JSON.parse(text);
          return {
            emotion: parsed.emotion || 'neutral',
            openingMode: parsed.openingMode || 'maya_explains_first',
            openingLine: parsed.openingLine || '',
            scenarioPrompt: parsed.scenarioPrompt || '',
            ttsScriptEnglish: parsed.ttsScriptEnglish || `Welcome to your next scenario: ${dto.title}! <short pause>\n\nPicture this... <sighs> ${briefing}\n\nIn this scenario, your role is ${userRole}, <short pause> and Maya will be playing ${mayaRole}.\n\nYour goal here is simple: ${goalTitle}.\n\n${goalDesc} <short pause>\n\nReady? Let's start the roleplay!`,
            ttsScriptSinhala: parsed.ttsScriptSinhala || `හරි... ඔයාගේ ඊළඟ scenario එක: ${dto.title}! <short pause>\n\nමේක පොඩ්ඩක් හිතන්නකෝ... <sighs> ${briefing}. <short pause>\n\nමේ scenario එකේ ඔයා තමයි ${userRole}, <short pause> Maya තමයි ${mayaRole} විදිහට ඉන්නේ.\n\nඔයාගේ goal එක හරිම simple: ${goalTitle}.\n\n${goalDesc} කලබල නොවී calm පිට issue එක explain කරලා හොඳ solution එකක් negotiate කරන්න. <short pause>\n\nReady ද? <short pause> එහෙනම් අපි roleplay එක පටන් ගමු!`,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Gemini generateScenarioPrompt API error: ${err?.message}`);
      }
    }

    // High quality deterministic fallback generator
    let detectedEmotion = 'neutral';
    const textAll = `${dto.title} ${briefing}`.toLowerCase();
    if (textAll.includes('angry') || textAll.includes('mix-up') || textAll.includes('complaint') || textAll.includes('dispute') || textAll.includes('delay')) {
      detectedEmotion = 'angry';
    } else if (textAll.includes('cry') || textAll.includes('sad') || textAll.includes('scholarship') || textAll.includes('reject')) {
      detectedEmotion = 'crying';
    } else if (textAll.includes('interview') || textAll.includes('strict') || textAll.includes('boss')) {
      detectedEmotion = 'strict';
    } else if (textAll.includes('cafe') || textAll.includes('coffee') || textAll.includes('party') || textAll.includes('friend')) {
      detectedEmotion = 'cheerful';
    }

    return {
      emotion: detectedEmotion,
      openingMode: 'maya_explains_first',
      openingLine: `Hello! I see you're here regarding the ${dto.title.toLowerCase()}. How can I assist you today?`,
      scenarioPrompt: `You are Maya playing the role of ${mayaRole}.
Setting & Premise: ${briefing}
Student's Role: ${userRole}.

Emotional State & Tone: ${detectedEmotion.toUpperCase()}. Speak authentically in character.

Core Conversation Rules:
1. Keep spoken responses snappy, conversational, and strictly under 15-20 words per turn.
2. React genuinely to the student's words. If they are polite, empathetic, or structured, acknowledge it.
3. GOAL COMPLETION & WRAP-UP DIRECTIVE:
   - Student's Target Goal: "${goalTitle} - ${goalDesc}".
   - As soon as the student achieves this goal or negotiates a fair resolution, accept it in character, give a closing sentence, and naturally conclude the roleplay.`,
      ttsScriptEnglish: `Welcome to your next scenario: ${dto.title}! <short pause>\n\nPicture this... <sighs> ${briefing}\n\nIn this scenario, your role is ${userRole}, <short pause> and Maya will be playing ${mayaRole}.\n\nYour goal here is simple: ${goalTitle}.\n\n${goalDesc} <short pause>\n\nReady? Let's start the roleplay!`,
      ttsScriptSinhala: `හරි... ඔයාගේ ඊළඟ scenario එක: ${dto.title}! <short pause>\n\nමේක පොඩ්ඩක් හිතන්නකෝ... <sighs> ${briefing}. <short pause>\n\nමේ scenario එකේ ඔයා තමයි ${userRole}, <short pause> Maya තමයි ${mayaRole} විදිහට ඉන්නේ.\n\nඔයාගේ goal එක හරිම simple: ${goalTitle}.\n\n${goalDesc} කලබල නොවී calm පිට issue එක explain කරලා හොඳ solution එකක් negotiate කරන්න. <short pause>\n\nReady ද? <short pause> එහෙනම් අපි roleplay එක පටන් ගමු!`,
    };
  }

  async synthesizeScenarioTts(
    text: string,
    language: 'en' | 'si' = 'en',
    voice: string = 'Callirrhoe',
  ): Promise<{ audioBase64: string; mimeType: string }> {
    const cleanText = (text || '').trim();
    if (!cleanText) {
      return { audioBase64: '', mimeType: 'audio/wav' };
    }

    // Check content hash cache first (0ms if already generated or warmed up)
    const contentHash = createHash('sha256')
      .update(`${language}_${voice}_${cleanText}`)
      .digest('hex')
      .slice(0, 24);
    const diskPath = path.join(this.audioCacheDir, `tts_${contentHash}.wav`);

    if (this.briefingAudioCache.has(contentHash)) {
      const buffer = this.briefingAudioCache.get(contentHash)!;
      return {
        audioBase64: buffer.toString('base64'),
        mimeType: 'audio/wav',
      };
    }

    if (fs.existsSync(diskPath)) {
      try {
        const buffer = fs.readFileSync(diskPath);
        this.briefingAudioCache.set(contentHash, buffer);
        return {
          audioBase64: buffer.toString('base64'),
          mimeType: 'audio/wav',
        };
      } catch (err: any) {
        this.logger.debug(`Could not read disk cache for hash ${contentHash}: ${err?.message}`);
      }
    }

    // 3. Check Supabase Storage for this contentHash clip
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase.storage
          .from('roadmap-audio')
          .download(`tts_${contentHash}.wav`);
        if (!error && data) {
          const arrayBuffer = await data.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);
          this.briefingAudioCache.set(contentHash, buffer);
          try {
            if (!fs.existsSync(diskPath)) fs.writeFileSync(diskPath, buffer);
          } catch {}
          this.logger.log(`[TTS Synthesis] Restored hash TTS ${contentHash} from Supabase Storage (${buffer.length} bytes)`);
          return {
            audioBase64: buffer.toString('base64'),
            mimeType: 'audio/wav',
          };
        }
      } catch {}
    }

    // 4. Check if any level in the database already has this exact script (re-use existing audio)
    try {
      const levels = await this.getAllLevels(true);
      const matchingLevel = levels.find((lvl) => {
        const script = language === 'si' ? lvl.ttsScriptSinhala : lvl.ttsScriptEnglish;
        return script && script.trim() === cleanText;
      });
      if (matchingLevel) {
        this.logger.log(`[TTS Synthesis] Found matching script in "${matchingLevel.title}" (${language}) - reusing existing audio`);
        const { audioBuffer, mimeType } = await this.getBriefingAudio(matchingLevel.id, language);
        if (audioBuffer && audioBuffer.length > 0) {
          this.briefingAudioCache.set(contentHash, audioBuffer);
          try {
            if (!fs.existsSync(diskPath)) fs.writeFileSync(diskPath, audioBuffer);
          } catch {}
          return {
            audioBase64: audioBuffer.toString('base64'),
            mimeType: mimeType || 'audio/wav',
          };
        }
      }
    } catch (err: any) {
      this.logger.debug(`Could not check matching levels for script: ${err?.message}`);
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured for TTS generation');
    }

    this.logger.log(`[TTS Synthesis] Requesting Gemini TTS for voice=${voice}, lang=${language}...`);
    const ai = new GoogleGenAI({ apiKey });
    const interaction: any = await (ai as any).interactions.create({
      model: 'gemini-3.8-flash-lite-tts',
      input: [
        {
          type: 'user_input',
          content: [
            {
              type: 'text',
              text: cleanText,
              annotations: [
                {
                  type: 'speech_metadata',
                  style:
                    language === 'si'
                      ? 'warm, friendly, engaging, natural colloquial Sinhala'
                      : 'warm, bright, encouraging, natural conversational coach',
                },
              ],
            },
          ],
        },
      ],
      response_format: { type: 'audio' },
      generation_config: {
        speech_config: [{ voice }],
      },
    });

    const audioBase64 = interaction.output_audio?.data || '';
    if (audioBase64) {
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      this.briefingAudioCache.set(contentHash, audioBuffer);
      try {
        fs.writeFileSync(diskPath, audioBuffer);
        this.logger.log(`[Disk Cache] Saved hash TTS audio: ${diskPath} (${audioBuffer.length} bytes)`);
      } catch (err: any) {
        this.logger.debug(`Could not write disk cache for hash ${contentHash}: ${err?.message}`);
      }

      if (this.supabase) {
        this.supabase.storage
          .from('roadmap-audio')
          .upload(`tts_${contentHash}.wav`, audioBuffer, {
            contentType: 'audio/wav',
            upsert: true,
          })
          .catch(() => null);
      }
    }

    return {
      audioBase64,
      mimeType: 'audio/wav',
    };
  }

  async getBriefingAudio(
    levelId: string,
    lang: 'en' | 'si' = 'en',
  ): Promise<{ audioBuffer: Buffer; mimeType: string }> {
    const cacheKey = `${levelId}_${lang}`;

    // 1. In-memory hot cache (0ms)
    if (this.briefingAudioCache.has(cacheKey)) {
      return {
        audioBuffer: this.briefingAudioCache.get(cacheKey)!,
        mimeType: 'audio/wav',
      };
    }

    // 2. Persistent disk cache (1-2ms)
    const diskPath = path.join(this.audioCacheDir, `${cacheKey}.wav`);
    if (fs.existsSync(diskPath)) {
      try {
        const audioBuffer = fs.readFileSync(diskPath);
        this.briefingAudioCache.set(cacheKey, audioBuffer);
        return {
          audioBuffer,
          mimeType: 'audio/wav',
        };
      } catch (err: any) {
        this.logger.warn(`Could not read disk cache for ${cacheKey}: ${err?.message}`);
      }
    }

    // 3. Supabase Storage CDN Cache (restores across backend restarts / fresh containers)
    if (this.supabase) {
      const restoredBuffer = await this.restoreAudioFromSupabase(levelId, lang, diskPath);
      if (restoredBuffer) {
        return {
          audioBuffer: restoredBuffer,
          mimeType: 'audio/wav',
        };
      }
    }

    // 4. Deduplicate in-flight requests (share same Promise across concurrent calls)
    if (this.inFlightSyntheses.has(cacheKey)) {
      const audioBuffer = await this.inFlightSyntheses.get(cacheKey)!;
      return {
        audioBuffer,
        mimeType: 'audio/wav',
      };
    }

    // 5. Synthesize with Gemini TTS and persist
    const synthesisPromise = (async (): Promise<Buffer> => {
      const level = await this.getLevelById(levelId);
      let script = lang === 'si' ? level.ttsScriptSinhala : level.ttsScriptEnglish;

      if (!script || !script.trim()) {
        const briefing = level.scenarioBriefing || level.description || '';
        const userRole = level.userRole || 'Learner';
        const mayaRole = level.mayaRole || 'Roleplay Partner';
        const goalTitle = level.goalTitle || 'Find a resolution';
        const goalDesc = level.goalDescription || 'Negotiate politely and resolve the issue.';
        if (lang === 'si') {
          script = `හරි... ඔයාගේ ඊළඟ scenario එක: ${level.title}! <short pause>\n\nමේක පොඩ්ඩක් හිතන්නකෝ... <sighs> ${briefing}. <short pause>\n\nමේ scenario එකේ ඔයා තමයි ${userRole}, <short pause> Maya තමයි ${mayaRole} විදිහට ඉන්නේ.\n\nඔයාගේ goal එක හරිම simple: ${goalTitle}.\n\n${goalDesc} කලබල නොවී calm පිට issue එක explain කරලා හොඳ solution එකක් negotiate කරන්න. <short pause>\n\nReady ද? <short pause> එහෙනම් අපි roleplay එක පටන් ගමු!`;
        } else {
          script = `Welcome to your next scenario: ${level.title}! <short pause>\n\nPicture this... <sighs> ${briefing}\n\nIn this scenario, your role is ${userRole}, <short pause> and Maya will be playing ${mayaRole}.\n\nYour goal here is simple: ${goalTitle}.\n\n${goalDesc} <short pause>\n\nReady? Let's start the roleplay!`;
        }
      }

      this.logger.log(`[TTS Synthesis] Synthesizing voice for ${level.title} (${lang})...`);
      const { audioBase64 } = await this.synthesizeScenarioTts(script, lang, 'Callirrhoe');
      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // Save to disk
      try {
        fs.writeFileSync(diskPath, audioBuffer);
        this.logger.log(`[Disk Cache] Saved briefing audio: ${diskPath} (${audioBuffer.length} bytes)`);
      } catch (err: any) {
        this.logger.warn(`Could not write disk cache for ${cacheKey}: ${err?.message}`);
      }

      // Save to memory
      this.briefingAudioCache.set(cacheKey, audioBuffer);

      // Upload to Supabase Storage and update database row
      await this.uploadAudioToSupabase(levelId, lang, audioBuffer);

      return audioBuffer;
    })();

    this.inFlightSyntheses.set(cacheKey, synthesisPromise);
    try {
      const audioBuffer = await synthesisPromise;
      return {
        audioBuffer,
        mimeType: 'audio/wav',
      };
    } finally {
      this.inFlightSyntheses.delete(cacheKey);
    }
  }

  async uploadScenarioAudio(
    dto: UploadScenarioAudioDto,
  ): Promise<{ publicUrl: string; fileName: string; sizeBytes: number }> {
    const rawBase64 = (dto.audioBase64 || '').replace(/^data:audio\/[^;]+;base64,/, '').trim();
    if (!rawBase64) {
      throw new BadRequestException('No audio data provided');
    }

    const audioBuffer = Buffer.from(rawBase64, 'base64');
    if (audioBuffer.length < 100) {
      throw new BadRequestException('Audio file is empty or corrupted');
    }

    const lang = dto.language === 'si' ? 'si' : 'en';
    const cleanLevelId = (dto.levelId || '').trim();
    const storageFileName = cleanLevelId
      ? `${cleanLevelId}_${lang}.wav`
      : `custom_${Date.now()}_${lang}.wav`;

    // 1. Save to local disk cache and memory cache if levelId is specified
    if (cleanLevelId) {
      const cacheKey = `${cleanLevelId}_${lang}`;
      this.briefingAudioCache.set(cacheKey, audioBuffer);
      const diskPath = path.join(this.audioCacheDir, `${cacheKey}.wav`);
      try {
        fs.writeFileSync(diskPath, audioBuffer);
        this.logger.log(`[Disk Cache] Saved custom uploaded audio: ${diskPath} (${audioBuffer.length} bytes)`);
      } catch (err: any) {
        this.logger.warn(`Could not save disk cache for custom audio: ${err?.message}`);
      }
    }

    // 2. Upload to Supabase Storage bucket roadmap-audio
    let publicUrl = '';
    if (this.supabase) {
      await this.ensureStorageBucket();
      const { error: uploadErr } = await this.supabase.storage
        .from('roadmap-audio')
        .upload(storageFileName, audioBuffer, {
          contentType: 'audio/wav',
          upsert: true,
        });

      if (uploadErr) {
        this.logger.warn(`[Supabase Storage] Custom audio upload error: ${uploadErr.message}`);
        throw new Error(`Supabase Storage upload failed: ${uploadErr.message}`);
      }

      const { data: pubData } = this.supabase.storage
        .from('roadmap-audio')
        .getPublicUrl(storageFileName);
      publicUrl = pubData?.publicUrl || '';
      this.logger.log(`[Supabase Storage] Custom audio uploaded successfully -> ${publicUrl}`);

      // If levelId exists in database, also update the row
      if (cleanLevelId) {
        const updatePayload: Record<string, any> = {
          [lang === 'si' ? 'audio_url_sinhala' : 'audio_url_english']: publicUrl,
          updated_at: new Date().toISOString(),
        };
        await this.supabase
          .from('roadmap_levels')
          .update(updatePayload)
          .eq('id', cleanLevelId);
      }
    } else {
      publicUrl = `/v1/roadmap/levels/${cleanLevelId || 'custom'}/briefing-audio?lang=${lang}`;
    }

    return {
      publicUrl,
      fileName: storageFileName,
      sizeBytes: audioBuffer.length,
    };
  }
}
