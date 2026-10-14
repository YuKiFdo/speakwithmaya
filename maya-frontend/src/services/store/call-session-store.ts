import { router } from 'expo-router';

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
