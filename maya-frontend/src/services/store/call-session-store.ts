import { router } from 'expo-router';
import { ActiveConversationStore, isRoadmapOrIntroTopic } from './active-conversation-store';

export interface CallSessionConfig {
  topic?: string;
  durationSeconds?: number;
  durationMinutes?: number;
  languageMode?: 'sinhala' | 'english';
  sinhalaStyle?: 'balanced' | 'deep_guidance';
  aiSuggestions?: boolean;
  scenarioId?: string;
  scenarioTitle?: string;
  roadmapLevelId?: string;
  practicePoints?: string[];
  canonicalContent?: string;
  passingScorePercent?: number;
  levelNumber?: number;
  scenarioPrompt?: string;
  openingMode?: 'maya_explains_first' | 'maya_in_character' | 'user_starts';
  openingLine?: string;
  scenarioBriefing?: string;
  emotionTags?: string[];
  userRole?: string;
  mayaRole?: string;
  goalTitle?: string;
  goalDescription?: string;
  targetSpeakingShare?: number;
  isIntroCall?: boolean;
  userName?: string;
  goal?: string;
  challenge?: string;
  level?: string;
  dailyGoal?: string;
  employment?: string;
  phone?: string;
}


let activeSessionConfig: CallSessionConfig | null = null;

export const CallSessionStore = {
  getConfig(): CallSessionConfig | null {
    return activeSessionConfig;
  },

  setConfig(config: CallSessionConfig) {
    activeSessionConfig = config;
  },

  clearConfig() {
    activeSessionConfig = null;
  },

  /**
   * Enterprise-grade clean route transition to a live call session.
   * Keeps sensitive and bulky configurations inside the store with zero URL leakage.
   */
  startCall(config: CallSessionConfig, options?: { isIntroCall?: boolean }) {
    activeSessionConfig = {
      ...config,
      isIntroCall: options?.isIntroCall ?? config.isIntroCall ?? false,
    };

    if (
      activeSessionConfig.isIntroCall ||
      config.roadmapLevelId ||
      config.levelNumber ||
      isRoadmapOrIntroTopic(config.topic, config.scenarioTitle, config.scenarioId, config.roadmapLevelId)
    ) {
      // Intro calls and roadmap curriculum sessions must NEVER create or update a resume card in dashboard
      ActiveConversationStore.clear();
    } else if (config.scenarioId || config.scenarioTitle) {
      try {
        ActiveConversationStore.setActive({
          scenarioId: config.scenarioId || 'casual-chat',
          scenarioTitle: config.scenarioTitle || config.topic || 'Casual Chat',
          topic: config.topic || config.scenarioTitle || 'Casual Chat',
          roadmapLevelId: config.roadmapLevelId,
        });
      } catch {}
    }

    if (activeSessionConfig.isIntroCall) {
      router.replace('/onboarding/call' as any);
    } else {
      router.push('/call' as any);
    }
  },

  /** Alias for startCall to guarantee resilient caller compatibility */
  startSession(config: CallSessionConfig, options?: { isIntroCall?: boolean }) {
    this.startCall(config, options);
  },
};
