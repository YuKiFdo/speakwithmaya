import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CreateRoadmapLevelDto, UpdateRoadmapLevelDto, ReorderItemDto, SimulateLevelTurnDto } from './dto/roadmap.dto.js';
import { GoogleGenAI } from '@google/genai';

export interface RoadmapLevelEntity {
  id: string;
  levelNumber: number;
  title: string;
  description: string;
  topic: string;
  targetDurationMinutes: number;
  xpReward: number;
  iconType: 'robot' | 'chat' | 'family' | 'home' | 'wave' | 'directions';
  numberColor: string;
  haloColor: string;
  haloBorderColor: string;
  scenarioId?: string;
  customSvg?: string;
  guidedPrompt: {
    scenarioRole?: string;
    coachingFocus?: string;
    openingQuestion?: string;
    customPromptAddon?: string;
  };
  unlockRule: {
    type: 'free' | 'completion' | 'score' | 'time';
    minScore?: number;
    minDurationSeconds?: number;
    requiresLevelNumber?: number;
  };
  learningObjectives?: Array<{
    id: string;
    title: string;
    description?: string;
    isMandatory?: boolean;
  }>;
  targetSpeakingShare?: number;
  isPublished: boolean;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_LEVELS: RoadmapLevelEntity[] = [
  {
    id: 'lvl-01-meet-ai',
    levelNumber: 1,
    title: 'Meet your AI partner',
    description: 'Break the ice with Maya. Introduce yourself and get comfortable speaking English.',
    topic: 'Introduction & Greetings',
    targetDurationMinutes: 5,
    xpReward: 50,
    iconType: 'robot',
    numberColor: '#0057FF',
    haloColor: '#EFF6FF',
    haloBorderColor: '#BFDBFE',
    scenarioId: 'general-practice',
    guidedPrompt: {
      scenarioRole: 'Maya is a warm, enthusiastic AI English coach introducing herself to a new student.',
      coachingFocus: 'Comfort, positive reinforcement, and basic self-introduction phrases.',
      openingQuestion: 'Hi there! I am Maya, your AI speaking coach. Tell me a little about yourself — what do you like to do in your free time?',
      customPromptAddon: 'Keep Maya extremely supportive. Praise every attempt to speak.',
    },
    learningObjectives: [
      {
        id: 'obj_self_intro',
        title: 'Introduce Yourself',
        description: 'Shares name, studies or work, and where they live',
        isMandatory: true,
      },
      {
        id: 'obj_free_time',
        title: 'Free Time & Hobbies',
        description: 'Describes at least one hobby or favorite weekend activity',
        isMandatory: true,
      },
    ],
    targetSpeakingShare: 40,
    unlockRule: {
      type: 'free',
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-02-daily-routine',
    levelNumber: 2,
    title: 'Talking about your day',
    description: 'Describe your daily morning routine, work or school schedule, and evening habits.',
    topic: 'Daily Routine & Habits',
    targetDurationMinutes: 5,
    xpReward: 75,
    iconType: 'chat',
    numberColor: '#9333EA',
    haloColor: '#FAF5FF',
    haloBorderColor: '#E9D5FF',
    scenarioId: 'general-practice',
    guidedPrompt: {
      scenarioRole: 'Maya is a friendly, curious conversation partner asking about how you spend your days.',
      coachingFocus: 'Present simple tense verbs and frequency adverbs (always, usually, sometimes, after that).',
      openingQuestion: 'How was your morning today? What is the first thing you usually do when you wake up?',
    },
    learningObjectives: [
      {
        id: 'obj_morning_routine',
        title: 'Morning Routine',
        description: 'Describes morning routine using present simple verbs (wake up, brush, eat)',
        isMandatory: true,
      },
      {
        id: 'obj_frequency_adverbs',
        title: 'Frequency Words',
        description: 'Uses frequency adverbs like always, usually, or sometimes',
        isMandatory: true,
      },
    ],
    targetSpeakingShare: 40,
    unlockRule: {
      type: 'completion',
      requiresLevelNumber: 1,
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-03-family-friends',
    levelNumber: 3,
    title: 'Family and friends',
    description: 'Learn to talk about your family members, close friends, and their personalities.',
    topic: 'Family & Relationships',
    targetDurationMinutes: 10,
    xpReward: 100,
    iconType: 'family',
    numberColor: '#E11D48',
    haloColor: '#FFF1F2',
    haloBorderColor: '#FECDD3',
    scenarioId: 'general-practice',
    guidedPrompt: {
      scenarioRole: 'Maya is an empathetic friend asking about who you are closest to in your family.',
      coachingFocus: 'Descriptive adjectives for personality and physical appearance (kind, hardworking, energetic).',
      openingQuestion: 'Tell me about someone in your family or a close friend who inspires you. What are they like?',
    },
    learningObjectives: [
      {
        id: 'obj_describe_person',
        title: 'Describe a Family Member / Friend',
        description: 'Names a person and describes their relationship',
        isMandatory: true,
      },
      {
        id: 'obj_personality_adjectives',
        title: 'Personality Adjectives',
        description: 'Uses descriptive adjectives (kind, friendly, smart, funny)',
        isMandatory: true,
      },
    ],
    targetSpeakingShare: 40,
    unlockRule: {
      type: 'score',
      minScore: 70,
      requiresLevelNumber: 2,
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-04-hometown',
    levelNumber: 4,
    title: 'Describing your home town',
    description: 'Talk about your city, local foods, climate, landmarks, and favorite spots.',
    topic: 'Hometown & Culture',
    targetDurationMinutes: 10,
    xpReward: 125,
    iconType: 'home',
    numberColor: '#16A34A',
    haloColor: '#F0FDF4',
    haloBorderColor: '#BBF7D0',
    scenarioId: 'general-practice',
    guidedPrompt: {
      scenarioRole: 'Maya is a curious traveler who has never visited your hometown.',
      coachingFocus: 'Prepositions of place and descriptive sensory adjectives (bustling, peaceful, scenic).',
      openingQuestion: 'Which town or city do you live in? What is your favorite thing about living there?',
    },
    unlockRule: {
      type: 'score',
      minScore: 75,
      requiresLevelNumber: 3,
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-05-greetings-public',
    levelNumber: 5,
    title: 'Greetings & introductions in public',
    description: 'Practice natural small talk in professional and social settings with strangers.',
    topic: 'Social Small Talk',
    targetDurationMinutes: 10,
    xpReward: 150,
    iconType: 'wave',
    numberColor: '#F59E0B',
    haloColor: '#FFFBEB',
    haloBorderColor: '#FDE68A',
    scenarioId: 'workplace',
    guidedPrompt: {
      scenarioRole: 'Maya roleplays as a new colleague you just met at a seminar or office hallway.',
      coachingFocus: 'Polite small talk questions, active listening reactions, and continuing conversations smoothly.',
      openingQuestion: 'Nice to meet you! Are you also attending the workshop today? What department are you in?',
    },
    unlockRule: {
      type: 'score',
      minScore: 75,
      requiresLevelNumber: 4,
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'lvl-06-directions',
    levelNumber: 6,
    title: 'Asking for directions',
    description: 'Navigate unfamiliar places, ask for landmark locations, and give clear directions.',
    topic: 'Travel & Navigation',
    targetDurationMinutes: 10,
    xpReward: 200,
    iconType: 'directions',
    numberColor: '#0057FF',
    haloColor: '#EFF6FF',
    haloBorderColor: '#BFDBFE',
    scenarioId: 'travel-english',
    guidedPrompt: {
      scenarioRole: 'Maya roleplays as a helpful local on the street assisting a visitor who needs directions.',
      coachingFocus: 'Directional phrases: "turn right at the corner", "straight ahead", "opposite to", "next to".',
      openingQuestion: 'Excuse me, you look like you are searching for somewhere. Where are you trying to get to?',
    },
    unlockRule: {
      type: 'score',
      minScore: 75,
      requiresLevelNumber: 5,
    },
    isPublished: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

@Injectable()
export class RoadmapService {
  private readonly logger = new Logger(RoadmapService.name);
  private readonly supabase: SupabaseClient | null = null;
  private memoryLevels: RoadmapLevelEntity[] = JSON.parse(JSON.stringify(DEFAULT_LEVELS));

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      this.logger.log('RoadmapService connected to Supabase client');
      this.initDatabaseTable();
    } else {
      this.logger.warn('RoadmapService running with in-memory curriculum store');
    }
  }

  private async initDatabaseTable() {
    if (!this.supabase) return;
    try {
      const { data, error } = await this.supabase
        .from('roadmap_levels')
        .select('id')
        .limit(1);

      if (error && error.code === '42P01') {
        this.logger.warn('Table roadmap_levels does not exist in Supabase yet. Run schema.sql to persist in DB.');
      } else if (data && data.length === 0) {
        this.logger.log('Seeding initial roadmap levels to Supabase...');
        for (const lvl of DEFAULT_LEVELS) {
          await this.supabase.from('roadmap_levels').insert({
            id: lvl.id,
            level_number: lvl.levelNumber,
            title: lvl.title,
            description: lvl.description,
            topic: lvl.topic,
            target_duration_minutes: lvl.targetDurationMinutes,
            icon_type: lvl.iconType,
            number_color: lvl.numberColor,
            halo_color: lvl.haloColor,
            halo_border_color: lvl.haloBorderColor,
            scenario_id: lvl.scenarioId,
            guided_prompt: lvl.guidedPrompt,
            unlock_rule: lvl.unlockRule,
            is_published: lvl.isPublished,
          });
        }
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
          return data.map((d: any) => ({
            id: d.id,
            levelNumber: d.level_number,
            title: d.title,
            description: d.description || '',
            topic: d.topic || '',
            targetDurationMinutes: d.target_duration_minutes || 5,
            xpReward: d.xp_reward || 100,
            iconType: d.icon_type || 'chat',
            numberColor: d.number_color || '#0057FF',
            haloColor: d.halo_color || '#EFF6FF',
            haloBorderColor: d.halo_border_color || '#BFDBFE',
            scenarioId: d.scenario_id,
            customSvg: d.custom_svg,
            guidedPrompt: d.guided_prompt || {},
            unlockRule: d.unlock_rule || { type: 'score', minScore: 75 },
            learningObjectives: d.learning_objectives || [],
            targetSpeakingShare: d.target_speaking_share ?? 40,
            isPublished: d.is_published ?? true,
            createdAt: d.created_at || new Date().toISOString(),
            updatedAt: d.updated_at || new Date().toISOString(),
          }));
        }
      } catch (err: any) {
        this.logger.debug(`getAllLevels DB query failed, falling back to memory: ${err?.message}`);
      }
    }

    const list = this.memoryLevels.sort((a, b) => a.levelNumber - b.levelNumber);
    return adminView ? list : list.filter((l) => l.isPublished);
  }

  async getLevelById(id: string): Promise<RoadmapLevelEntity> {
    const levels = await this.getAllLevels(true);
    const found = levels.find((l) => l.id === id);
    if (!found) {
      throw new NotFoundException(`Roadmap level with id '${id}' not found`);
    }
    return found;
  }

  async createLevel(dto: CreateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
    const newId = `lvl-${Date.now().toString(36)}`;
    const newLevel: RoadmapLevelEntity = {
      id: newId,
      levelNumber: dto.levelNumber,
      title: dto.title,
      description: dto.description || '',
      topic: dto.topic || dto.title,
      targetDurationMinutes: dto.targetDurationMinutes || 5,
      xpReward: dto.xpReward || 100,
      iconType: dto.iconType || 'chat',
      numberColor: dto.numberColor || '#0057FF',
      haloColor: dto.haloColor || '#EFF6FF',
      haloBorderColor: dto.haloBorderColor || '#BFDBFE',
      scenarioId: dto.scenarioId || 'general-practice',
      customSvg: dto.customSvg,
      guidedPrompt: dto.guidedPrompt || {},
      unlockRule: dto.unlockRule || { type: 'score', minScore: 75 },
      learningObjectives: dto.learningObjectives || [],
      targetSpeakingShare: dto.targetSpeakingShare ?? 40,
      isPublished: dto.isPublished ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        await this.supabase.from('roadmap_levels').insert({
          id: newLevel.id,
          level_number: newLevel.levelNumber,
          title: newLevel.title,
          description: newLevel.description,
          topic: newLevel.topic,
          target_duration_minutes: newLevel.targetDurationMinutes,
          xp_reward: newLevel.xpReward,
          icon_type: newLevel.iconType,
          number_color: newLevel.numberColor,
          halo_color: newLevel.haloColor,
          halo_border_color: newLevel.haloBorderColor,
          scenario_id: newLevel.scenarioId,
          custom_svg: newLevel.customSvg,
          guided_prompt: newLevel.guidedPrompt,
          unlock_rule: newLevel.unlockRule,
          learning_objectives: newLevel.learningObjectives,
          target_speaking_share: newLevel.targetSpeakingShare,
          is_published: newLevel.isPublished,
        });
      } catch (err: any) {
        this.logger.warn(`Failed to insert into Supabase: ${err?.message}`);
      }
    }

    this.memoryLevels.push(newLevel);
    return newLevel;
  }

  async updateLevel(id: string, dto: UpdateRoadmapLevelDto): Promise<RoadmapLevelEntity> {
    const existing = await this.getLevelById(id);
    const updated: RoadmapLevelEntity = {
      ...existing,
      levelNumber: dto.levelNumber !== undefined ? dto.levelNumber : existing.levelNumber,
      title: dto.title !== undefined ? dto.title : existing.title,
      description: dto.description !== undefined ? dto.description : existing.description,
      topic: dto.topic !== undefined ? dto.topic : existing.topic,
      targetDurationMinutes: dto.targetDurationMinutes !== undefined ? dto.targetDurationMinutes : existing.targetDurationMinutes,
      xpReward: dto.xpReward !== undefined ? dto.xpReward : existing.xpReward,
      iconType: dto.iconType !== undefined ? dto.iconType : existing.iconType,
      numberColor: dto.numberColor !== undefined ? dto.numberColor : existing.numberColor,
      haloColor: dto.haloColor !== undefined ? dto.haloColor : existing.haloColor,
      haloBorderColor: dto.haloBorderColor !== undefined ? dto.haloBorderColor : existing.haloBorderColor,
      scenarioId: dto.scenarioId !== undefined ? dto.scenarioId : existing.scenarioId,
      customSvg: dto.customSvg !== undefined ? dto.customSvg : existing.customSvg,
      guidedPrompt: dto.guidedPrompt !== undefined ? { ...existing.guidedPrompt, ...dto.guidedPrompt } : existing.guidedPrompt,
      unlockRule: dto.unlockRule !== undefined ? { ...existing.unlockRule, ...dto.unlockRule } : existing.unlockRule,
      learningObjectives: dto.learningObjectives !== undefined ? dto.learningObjectives : existing.learningObjectives,
      targetSpeakingShare: dto.targetSpeakingShare !== undefined ? dto.targetSpeakingShare : existing.targetSpeakingShare,
      isPublished: dto.isPublished !== undefined ? dto.isPublished : existing.isPublished,
      updatedAt: new Date().toISOString(),
    };

    if (this.supabase) {
      try {
        await this.supabase
          .from('roadmap_levels')
          .update({
            level_number: updated.levelNumber,
            title: updated.title,
            description: updated.description,
            topic: updated.topic,
            target_duration_minutes: updated.targetDurationMinutes,
            xp_reward: updated.xpReward,
            icon_type: updated.iconType,
            number_color: updated.numberColor,
            halo_color: updated.haloColor,
            halo_border_color: updated.haloBorderColor,
            scenario_id: updated.scenarioId,
            custom_svg: updated.customSvg,
            guided_prompt: updated.guidedPrompt,
            unlock_rule: updated.unlockRule,
            learning_objectives: updated.learningObjectives,
            target_speaking_share: updated.targetSpeakingShare,
            is_published: updated.isPublished,
            updated_at: updated.updatedAt,
          })
          .eq('id', id);
      } catch (err: any) {
        this.logger.warn(`Failed to update in Supabase: ${err?.message}`);
      }
    }

    const idx = this.memoryLevels.findIndex((l) => l.id === id);
    if (idx !== -1) {
      this.memoryLevels[idx] = updated;
    }
    return updated;
  }

  async deleteLevel(id: string): Promise<{ success: boolean; deletedId: string }> {
    if (this.supabase) {
      try {
        await this.supabase.from('roadmap_levels').delete().eq('id', id);
      } catch (err: any) {
        this.logger.warn(`Failed to delete from Supabase: ${err?.message}`);
      }
    }

    this.memoryLevels = this.memoryLevels.filter((l) => l.id !== id);
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
            .update({ level_number: item.levelNumber })
            .eq('id', item.id);
        } catch (err) {
          // ignore
        }
      }
    }

    return this.getAllLevels(true);
  }

  async simulateTurn(dto: SimulateLevelTurnDto) {
    const role = dto.guidedPrompt?.scenarioRole || 'Maya is a friendly English coach.';
    const focus = dto.guidedPrompt?.coachingFocus || 'Focus on conversational flow and fluency.';
    const opening = dto.guidedPrompt?.openingQuestion || '';
    const addon = dto.guidedPrompt?.customPromptAddon || '';

    const systemPrompt = `You are Maya (මායා), an upbeat, encouraging AI English speaking coach for Sri Lankan learners.
ROLEPLAY SCENARIO:
- Role: ${role}
- Specific Coaching Focus: ${focus}
${opening ? `- Icebreaker Question Context: "${opening}"` : ''}
${addon ? `- Additional Constraints: ${addon}` : ''}

INSTRUCTIONS:
1. Student just said: "${dto.userMessage}".
2. Check if the student made a noticeable grammatical, prepositional, or phrasing error.
3. Respond in character as Maya. Keep your spoken response strictly under 15 words.
4. If there was a grammatical mistake, verbally model the short correction in natural Sinhala ("ඔයාට පුළුවන් '[short fix]' කියලා කියන්න"), followed immediately by your next short English question. Keep total spoken turn under 15 words.
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
  "focusEvaluation": "1 sentence on how the reply followed the coaching focus"
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

    // Contextual smart simulation fallback
    const lower = (dto.userMessage || '').toLowerCase();
    const hasPastTenseError = lower.includes('buyed') || lower.includes('goed') || lower.includes('eated');
    const hasPrepositionError = lower.includes('in morning') || lower.includes('listen music');

    if (hasPastTenseError) {
      const wrong = lower.includes('buyed') ? 'buyed' : lower.includes('goed') ? 'goed' : 'eated';
      const right = wrong === 'buyed' ? 'bought' : wrong === 'goed' ? 'went' : 'ate';
      return {
        success: true,
        mayaSpoken: `ඔයාට පුළුවන් '${right}' කියලා කියන්න. What did you do next?`,
        wordCount: 11,
        hasMistake: true,
        correction: {
          studentSaid: wrong,
          moreNatural: right,
          explanation: `අතීත කාල ක්‍රියා පදය සඳහා '${right}' භාවිතා කරන්න.`,
          highlightWords: [wrong],
        },
        focusEvaluation: `Identified irregular past tense mistake and modeled correction in Sinhala.`,
      };
    }

    if (hasPrepositionError) {
      return {
        success: true,
        mayaSpoken: `ඔයාට පුළුවන් 'in the morning' කියලා කියන්න. How was the weather?`,
        wordCount: 12,
        hasMistake: true,
        correction: {
          studentSaid: 'in morning',
          moreNatural: 'in the morning',
          explanation: `'morning' ඉදිරියෙන් 'the' නිපාතය එකතු කරන්න.`,
          highlightWords: ['in morning'],
        },
        focusEvaluation: `Checked preposition and article usage per coaching focus.`,
      };
    }

    const words = `That sounds wonderful! How often do you usually do that?`.split(/\s+/).length;
    return {
      success: true,
      mayaSpoken: `That sounds wonderful! How often do you usually do that?`,
      wordCount: words,
      hasMistake: false,
      correction: null,
      focusEvaluation: `Engaged with student input and prompted next turn under 15 words.`,
    };
  }
}
