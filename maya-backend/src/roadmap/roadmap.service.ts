import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
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

const DEFAULT_ROADMAP_LEVELS: RoadmapLevelEntity[] = [
  {
    id: 'lvl-01',
    levelNumber: 1,
    title: 'Ordering Coffee & Snacks',
    description: 'Learn how to greet a barista, place an order, customize milk or sugar, and ask for the bill with confidence.',
    topic: 'Ordering Coffee & Snacks',
    xpReward: 100,
    iconType: 'coffee',
    numberColor: '#D97706',
    haloColor: '#FEF3C7',
    haloBorderColor: '#FDE68A',
    scenarioId: 'cafe-order',
    customSvg: '',
    practicePoints: [
      'Politely greet the barista and state your coffee order (e.g. "Can I have a cappuccino, please?")',
      'Specify customization preferences such as size, sugar, or type of milk (e.g. "Small with oat milk, no sugar")',
      'Ask for the price or bill and conclude the payment warmly (e.g. "How much is that? Can I pay by card?")',
    ],
    canonicalContent: `LESSON: Ordering Coffee & Snacks
PRACTICE SKILLS:
- Politely greet the barista and state your coffee order (e.g. "Can I have a cappuccino, please?")
- Specify customization preferences such as size, sugar, or type of milk (e.g. "Small with oat milk, no sugar")
- Ask for the price or bill and conclude the payment warmly (e.g. "How much is that? Can I pay by card?")`,
    passingScorePercent: 75,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-02',
    levelNumber: 2,
    title: 'Asking for Street Directions',
    description: 'Navigate city streets smoothly by asking locals for directions, clarifying walking distance, and thanking them.',
    topic: 'Asking for Street Directions',
    xpReward: 125,
    iconType: 'map-pin',
    numberColor: '#2563EB',
    haloColor: '#DBEAFE',
    haloBorderColor: '#BFDBFE',
    scenarioId: 'street-directions',
    customSvg: '',
    practicePoints: [
      'Stop someone politely and ask how to get to a landmark (e.g. "Excuse me, could you tell me how to get to the train station?")',
      'Clarify walking time or distance (e.g. "Is it within walking distance or should I take a tuk-tuk?")',
      'Thank them politely for their help (e.g. "Thank you so much, have a wonderful day!")',
    ],
    canonicalContent: `LESSON: Asking for Street Directions
PRACTICE SKILLS:
- Stop someone politely and ask how to get to a landmark (e.g. "Excuse me, could you tell me how to get to the train station?")
- Clarify walking time or distance (e.g. "Is it within walking distance or should I take a tuk-tuk?")
- Thank them politely for their help (e.g. "Thank you so much, have a wonderful day!")`,
    passingScorePercent: 75,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-03',
    levelNumber: 3,
    title: 'Dining at a Restaurant',
    description: 'Master table reservations, asking about menu recommendations, and requesting dietary adjustments.',
    topic: 'Dining at a Restaurant',
    xpReward: 150,
    iconType: 'utensils',
    numberColor: '#059669',
    haloColor: '#D1FAE5',
    haloBorderColor: '#A7F3D0',
    scenarioId: 'restaurant-dining',
    customSvg: '',
    practicePoints: [
      'Request a table for your group (e.g. "Could we get a table for two near the window, please?")',
      'Ask the waiter for popular recommendations (e.g. "What would you recommend for dinner tonight?")',
      'Ask for the bill and compliment the meal (e.g. "Everything was delicious, could we have the bill please?")',
    ],
    canonicalContent: `LESSON: Dining at a Restaurant
PRACTICE SKILLS:
- Request a table for your group (e.g. "Could we get a table for two near the window, please?")
- Ask the waiter for popular recommendations (e.g. "What would you recommend for dinner tonight?")
- Ask for the bill and compliment the meal (e.g. "Everything was delicious, could we have the bill please?")`,
    passingScorePercent: 75,
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);
  private readonly supabase: SupabaseClient | null = null;
  private readonly filePath = path.join(process.cwd(), 'data', 'roadmap_levels.json');
  private readonly userProgressFilePath = path.join(process.cwd(), 'data', 'user_roadmap_progress.json');
  private memoryLevels: RoadmapLevelEntity[] = [];
  private memoryUserProgress: UserRoadmapProgressEntity[] = [];

  constructor() {
    // 1. Initialize local persistent file storage
    this.memoryLevels = this.loadFromFile();
    this.memoryUserProgress = this.loadUserProgressFromFile();

    // 2. Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_SECRET_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('RoadmapService connected to Supabase client');
      this.initDatabaseTable();
    } else {
      this.logger.warn(`RoadmapService running with local file store (${this.memoryLevels.length} levels loaded)`);
    }
  }

  private loadFromFile(): RoadmapLevelEntity[] {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          this.logger.log(`Loaded ${parsed.length} roadmap levels from local store (${this.filePath})`);
          return parsed;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to read roadmap levels from file: ${err?.message}`);
    }

    // Ensure directory exists and write default levels
    this.saveToFile(DEFAULT_ROADMAP_LEVELS);
    return [...DEFAULT_ROADMAP_LEVELS];
  }

  private saveToFile(levels: RoadmapLevelEntity[]): void {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.filePath, JSON.stringify(levels, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.warn(`Failed to save roadmap levels to file: ${err?.message}`);
    }
  }

  private hasHaloBorderColorSnake = false;

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

  private async initDatabaseTable() {
    if (!this.supabase) return;
    try {
      const { error: snakeErr } = await this.supabase
        .from('roadmap_levels')
        .select('halo_border_color')
        .limit(1);
      this.hasHaloBorderColorSnake = !snakeErr;

      const { data, error } = await this.supabase
        .from('roadmap_levels')
        .select('*')
        .order('level_number', { ascending: true });

      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          this.logger.warn(
            `Table 'public.roadmap_levels' does not exist in Supabase yet. Run 'src/database/create_roadmap_levels.sql' in your Supabase SQL editor. Local persistence active (${this.memoryLevels.length} levels loaded).`
          );
        } else {
          this.logger.warn(`initDatabaseTable error: ${error.message} (code: ${error.code})`);
        }
        return;
      }

      if (data && data.length > 0) {
        const dbLevels = data.map((d: any) => this.mapDbRowToEntity(d));
        this.memoryLevels = dbLevels;
        this.saveToFile(this.memoryLevels);
        this.logger.log(`RoadmapService synchronized ${dbLevels.length} levels from Supabase DB`);
      } else if (data && data.length === 0 && this.memoryLevels.length > 0) {
        // Table exists but is empty -> seed initial levels to Supabase DB
        this.logger.log(`Seeding ${this.memoryLevels.length} initial levels to Supabase DB...`);
        for (const lvl of this.memoryLevels) {
          const row = this.mapEntityToDbRow(lvl);
          await this.supabase.from('roadmap_levels').insert(row);
        }
        this.logger.log(`RoadmapService successfully seeded ${this.memoryLevels.length} levels into Supabase DB`);
      }
    } catch (err: any) {
      this.logger.debug(`initDatabaseTable error: ${err?.message}`);
    }
  }

  async getAllLevels(adminView: boolean = true): Promise<RoadmapLevelEntity[]> {
    if (this.supabase) {
      try {
        let query = this.supabase
          .from('roadmap_levels')
          .select('*')
          .order('level_number', { ascending: true });

        if (!adminView) {
          query = query.eq('is_published', true);
        }

        const { data, error } = await query;
        if (!error && data && data.length > 0) {
          const dbLevels = data.map((d: any) => this.mapDbRowToEntity(d));
          if (adminView) {
            this.memoryLevels = dbLevels;
            this.saveToFile(this.memoryLevels);
          }
          return dbLevels;
        }

        if (error && error.code !== 'PGRST205' && error.code !== '42P01') {
          this.logger.warn(`Supabase DB query error in getAllLevels: ${error.message}`);
        }
      } catch (err: any) {
        this.logger.debug(`getAllLevels DB query failed, falling back to local store: ${err?.message}`);
      }
    }

    const list = [...this.memoryLevels].sort((a, b) => a.levelNumber - b.levelNumber);
    return adminView ? list : list.filter((l) => l.isPublished);
  }

  async getLevelById(id: string): Promise<RoadmapLevelEntity> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('roadmap_levels')
          .select('*')
          .eq('id', id)
          .maybeSingle();

        if (!error && data) {
          return this.mapDbRowToEntity(data);
        }
      } catch (err: any) {
        this.logger.debug(`getLevelById DB query failed for id ${id}: ${err?.message}`);
      }
    }

    const levels = await this.getAllLevels(true);
    const rawId = String(id).toLowerCase().replace(/^lvl-0?/, '');
    const found = levels.find(
      (l) =>
        l.id.toLowerCase() === id.toLowerCase() ||
        l.id.toLowerCase() === `lvl-${id.toLowerCase()}` ||
        String(l.levelNumber) === rawId
    );

    if (!found) {
      throw new NotFoundException(`Roadmap level with id '${id}' not found`);
    }
    return found;
  }

  async createLevel(dto: CreateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
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

    // Save to memory and local persistent file
    this.memoryLevels = this.memoryLevels.filter((l) => l.id !== newLevel.id);
    this.memoryLevels.push(newLevel);
    this.saveToFile(this.memoryLevels);

    // Save to Supabase DB
    if (this.supabase) {
      try {
        const dbRow = this.mapEntityToDbRow(newLevel);
        const { error } = await this.supabase.from('roadmap_levels').insert(dbRow);
        if (error) {
          this.logger.error(
            `Failed to insert level ${newLevel.id} into Supabase DB: ${error.message} (code: ${error.code})`
          );
        } else {
          this.logger.log(`[DB INSERT] Successfully added level "${newLevel.title}" (${newLevel.id}) to Supabase DB`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to insert into Supabase: ${err?.message}`);
      }
    }

    return newLevel;
  }

  async updateLevel(id: string, dto: UpdateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
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

    // Update memory and local persistent file
    const idx = this.memoryLevels.findIndex((l) => l.id === id);
    if (idx !== -1) {
      this.memoryLevels[idx] = updated;
    } else {
      this.memoryLevels.push(updated);
    }
    this.saveToFile(this.memoryLevels);

    // Update in Supabase DB
    if (this.supabase) {
      try {
        const dbRow = this.mapEntityToDbRow(updated);
        const { error } = await this.supabase
          .from('roadmap_levels')
          .update(dbRow)
          .eq('id', id);

        if (error) {
          this.logger.error(`Failed to update level ${id} in Supabase DB: ${error.message} (code: ${error.code})`);
        } else {
          this.logger.log(`[DB UPDATE] Successfully updated level "${updated.title}" (${id}) in Supabase DB`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to update in Supabase: ${err?.message}`);
      }
    }

    return updated;
  }

  async deleteLevel(id: string): Promise<{ success: boolean; deletedId: string }> {
    // Delete from memory and local file
    this.memoryLevels = this.memoryLevels.filter((l) => l.id !== id);
    this.saveToFile(this.memoryLevels);

    // Delete from Supabase DB
    if (this.supabase) {
      try {
        const { error } = await this.supabase.from('roadmap_levels').delete().eq('id', id);
        if (error) {
          this.logger.error(`Failed to delete level ${id} from Supabase DB: ${error.message}`);
        } else {
          this.logger.log(`[DB DELETE] Successfully deleted level ${id} from Supabase DB`);
        }
      } catch (err: any) {
        this.logger.warn(`Failed to delete from Supabase: ${err?.message}`);
      }
    }

    return { success: true, deletedId: id };
  }

  async reorderLevels(items: ReorderItemDto[]): Promise<RoadmapLevelEntity[]> {
    for (const item of items) {
      const found = this.memoryLevels.find((l) => l.id === item.id);
      if (found) {
        found.levelNumber = item.levelNumber;
        found.updatedAt = new Date().toISOString();
      }

      if (this.supabase) {
        try {
          await this.supabase
            .from('roadmap_levels')
            .update({ level_number: item.levelNumber, updated_at: new Date().toISOString() })
            .eq('id', item.id);
        } catch (err) {
          // ignore
        }
      }
    }

    this.saveToFile(this.memoryLevels);
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

  private loadUserProgressFromFile(): UserRoadmapProgressEntity[] {
    try {
      if (fs.existsSync(this.userProgressFilePath)) {
        const raw = fs.readFileSync(this.userProgressFilePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err: any) {
      this.logger.warn(`Failed to read user progress from file: ${err?.message}`);
    }
    return [];
  }

  private saveUserProgressToFile(progress: UserRoadmapProgressEntity[]): void {
    try {
      const dir = path.dirname(this.userProgressFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.userProgressFilePath, JSON.stringify(progress, null, 2), 'utf-8');
    } catch (err: any) {
      this.logger.warn(`Failed to save user progress to file: ${err?.message}`);
    }
  }

  async getUserProgress(userId: string): Promise<UserRoadmapProgressEntity[]> {
    if (this.supabase) {
      try {
        const { data, error } = await this.supabase
          .from('user_roadmap_progress')
          .select('*')
          .eq('user_id', userId)
          .order('level_number', { ascending: true });

        if (!error && Array.isArray(data)) {
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
        this.logger.debug(`getUserProgress Supabase query error: ${err?.message}`);
      }
    }

    return this.memoryUserProgress.filter((p) => p.userId === userId);
  }

  async recordUserProgress(
    userId: string,
    dto: RecordUserRoadmapProgressDto,
  ): Promise<UserRoadmapProgressEntity> {
    const now = new Date().toISOString();
    const existingIdx = this.memoryUserProgress.findIndex(
      (p) => p.userId === userId && p.roadmapLevelId === dto.roadmapLevelId,
    );

    const record: UserRoadmapProgressEntity = {
      id: existingIdx >= 0 ? this.memoryUserProgress[existingIdx].id : randomUUID(),
      userId,
      roadmapLevelId: dto.roadmapLevelId,
      levelNumber: dto.levelNumber,
      sessionId: dto.sessionId || null,
      status: dto.status || 'completed',
      scorePercent: dto.scorePercent ?? 75,
      isPassed: dto.isPassed ?? true,
      xpEarned: dto.xpEarned ?? 100,
      completedAt: dto.isPassed !== false ? now : undefined,
      createdAt: existingIdx >= 0 ? this.memoryUserProgress[existingIdx].createdAt : now,
      updatedAt: now,
    };

    if (existingIdx >= 0) {
      this.memoryUserProgress[existingIdx] = record;
    } else {
      this.memoryUserProgress.push(record);
    }
    this.saveUserProgressToFile(this.memoryUserProgress);

    // Save to Supabase DB if available
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
        await this.supabase
          .from('user_roadmap_progress')
          .upsert(row, { onConflict: 'user_id, roadmap_level_id' });
      } catch (err: any) {
        this.logger.warn(`Failed to upsert user_roadmap_progress to Supabase: ${err?.message}`);
      }
    }

    return record;
  }
}
