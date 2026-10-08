import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CreateRoadmapLevelDto,
  UpdateRoadmapLevelDto,
  ReorderItemDto,
  SimulateLevelTurnDto,
  parseCanonicalLessonContent,
  formatCanonicalLessonContent,
} from './dto/roadmap.dto.js';
import {
  UserRoadmapProgressEntity,
  RecordUserRoadmapProgressDto,
} from './dto/user-roadmap-progress.dto.js';
import { randomUUID } from 'node:crypto';
import { GoogleGenAI } from '@google/genai';

export interface RoadmapLevelEntity {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
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
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);
  private readonly supabase: SupabaseClient | null = null;
  private hasHaloBorderColorSnake = false;

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
      xp_reward: e.xpReward,
      icon_type: e.iconType,
      number_color: e.numberColor,
      halo_color: e.haloColor,
      scenario_id: e.scenarioId,
      custom_svg: e.customSvg || '',
      practice_points: e.practicePoints,
      canonical_content: e.canonicalContent,
      passing_score_percent: e.passingScorePercent,
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
      isPublished: dto.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const dbRow = this.mapEntityToDbRow(newLevel);
    const { error } = await this.supabase.from('roadmap_levels').insert(dbRow);
    if (error) {
      this.logger.error(`Failed to insert level ${newLevel.id} into Supabase DB: ${error.message} (code: ${error.code})`);
      throw new Error(`Failed to create level in Supabase DB: ${error.message}`);
    }

    this.logger.log(`[DB INSERT] Successfully added level "${newLevel.title}" (${newLevel.id}) to Supabase DB`);
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
      isPublished: dto.isPublished !== undefined ? dto.isPublished : existing.isPublished,
      updatedAt: new Date().toISOString(),
    };

    const dbRow = this.mapEntityToDbRow(updated);
    const { error } = await this.supabase
      .from('roadmap_levels')
      .update(dbRow)
      .eq('id', existing.id);

    if (error) {
      this.logger.error(`Failed to update level ${existing.id} in Supabase DB: ${error.message} (code: ${error.code})`);
      throw new Error(`Failed to update level in Supabase DB: ${error.message}`);
    }

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

    const systemPrompt = `You are Maya, a dynamic, encouraging AI English speaking coach for Sri Lankan learners.
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

    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
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
}
