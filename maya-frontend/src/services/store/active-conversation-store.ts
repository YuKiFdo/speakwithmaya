import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { OnboardingStore } from './onboarding-store';

export interface ActiveConversationState {
  userId?: string;          // Scoped owner ID
  sessionId?: string;
  scenarioId: string;       // e.g. 'casual-chat', 'workplace', 'job-interview', 'travel-english', 'role-play', 'ielts-speaking'
  scenarioTitle: string;    // e.g. 'Job Interview', 'Casual Chat', 'Workplace'
  topic: string;            // e.g. 'Tell me about yourself'
  summary?: string | null;  // e.g. 'Practiced answering why you are a good fit for this role'
  nextFollowup?: string | null;
  lastPracticedAt: string;  // ISO timestamp
  durationSeconds?: number;
}

const STORAGE_KEY = 'maya_active_conversation_v1';

function getCurrentUserId(): string | undefined {
  try {
    return OnboardingStore.getState().user?.id;
  } catch {
    return undefined;
  }
}

let memoryState: ActiveConversationState | null = loadInitialState();
const listeners = new Set<(state: ActiveConversationState | null) => void>();

function notify() {
  for (const listener of listeners) {
    listener(memoryState);
  }
}

export function isRoadmapOrIntroTopic(
  topic?: string | null,
  scenarioTitle?: string | null,
  scenarioId?: string | null,
  roadmapLevelId?: string | null,
  summary?: string | null,
): boolean {
  if (roadmapLevelId) return true;
  if (
    scenarioId &&
    (scenarioId.startsWith('lvl-') ||
      scenarioId === 'general-practice' ||
      scenarioId.includes('roadmap') ||
      scenarioId.includes('mission'))
  ) {
    return true;
  }

  const t = [topic, scenarioTitle, scenarioId, summary]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (!t) return false;

  return (
    // Intro & onboarding
    t.includes('intro') ||
    t.includes('onboarding') ||
    t.includes('assessment') ||
    t.includes('placement') ||
    t.includes('free trial') ||
    t.includes('diagnostic') ||
    // Roadmap metadata
    t.includes('roadmap') ||
    t.includes('level') ||
    t.includes('milestone') ||
    t.includes('lvl-') ||
    t.includes('mission') ||
    t.includes('lesson') ||
    // Curriculum topics & scenarios (e.g. Level 1: Room Mix-Up at the Hotel)
    t.includes('hospitality') ||
    t.includes('conflict') ||
    t.includes('mix-up') ||
    t.includes('mix up') ||
    t.includes('room mix') ||
    t.includes('hotel') ||
    t.includes('suite') ||
    t.includes('ocean-view') ||
    t.includes('ocean view') ||
    t.includes('receptionist') ||
    t.includes('front desk') ||
    t.includes('hotel guest') ||
    t.includes('spa credit') ||
    t.includes('garden room') ||
    t.includes('garden suite') ||
    t.includes('reservation') ||
    // Other known curriculum roleplays
    t.includes('crying friend') ||
    t.includes('scholarship') ||
    t.includes('strict interview') ||
    t.includes('engineering director') ||
    t.includes('bank account balance') ||
    t.includes('customer service') ||
    // Roleplay markers from scenario engine
    t.includes('roleplay scenario') ||
    t.includes('role play scenario') ||
    t.includes('role play practice') ||
    t.includes('roleplay practice')
  );
}

function loadInitialState(): ActiveConversationState | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const currentUserId = getCurrentUserId();
      const userKey = currentUserId ? `${STORAGE_KEY}_${currentUserId}` : STORAGE_KEY;
      const raw = window.localStorage.getItem(userKey) || window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (currentUserId && parsed.userId && parsed.userId !== currentUserId) {
          return null;
        }
        if (
          isRoadmapOrIntroTopic(
            parsed.topic,
            parsed.scenarioTitle,
            parsed.scenarioId,
            parsed.roadmapLevelId,
            parsed.summary
          )
        ) {
          window.localStorage.removeItem(userKey);
          window.localStorage.removeItem(STORAGE_KEY);
          return null;
        }
        return parsed;
      }
    } catch {}
  }
  return null;
}

function persistState(state: ActiveConversationState | null) {
  memoryState = state;
  notify();
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const currentUserId = state?.userId || getCurrentUserId();
      const userKey = currentUserId ? `${STORAGE_KEY}_${currentUserId}` : STORAGE_KEY;
      if (state) {
        window.localStorage.setItem(userKey, JSON.stringify(state));
      } else {
        window.localStorage.removeItem(userKey);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }
}

export const ActiveConversationStore = {
  getState(): ActiveConversationState | null {
    const currentUserId = getCurrentUserId();
    if (memoryState && currentUserId && memoryState.userId && memoryState.userId !== currentUserId) {
      // Belongs to a different account, clear stale cache
      memoryState = null;
      return null;
    }
    if (
      memoryState &&
      isRoadmapOrIntroTopic(
        memoryState.topic,
        memoryState.scenarioTitle,
        memoryState.scenarioId,
        (memoryState as any).roadmapLevelId,
        memoryState.summary
      )
    ) {
      memoryState = null;
      persistState(null);
      return null;
    }
    return memoryState;
  },

  setActive(conv: Partial<ActiveConversationState> & { scenarioId: string; scenarioTitle: string; roadmapLevelId?: string }) {
    // Strictly do not create a resume card for intro calls, assessments, or ANY roadmap curriculum sessions
    if (isRoadmapOrIntroTopic(conv.topic, conv.scenarioTitle, conv.scenarioId, conv.roadmapLevelId, conv.summary)) {
      persistState(null);
      return;
    }

    const currentUserId = conv.userId || getCurrentUserId();
    const updated: ActiveConversationState = {
      userId: currentUserId,
      sessionId: conv.sessionId || memoryState?.sessionId,
      scenarioId: conv.scenarioId,
      scenarioTitle: conv.scenarioTitle,
      topic: conv.topic || memoryState?.topic || conv.scenarioTitle,
      summary: conv.summary !== undefined ? conv.summary : memoryState?.summary,
      nextFollowup: conv.nextFollowup !== undefined ? conv.nextFollowup : memoryState?.nextFollowup,
      lastPracticedAt: conv.lastPracticedAt || new Date().toISOString(),
      durationSeconds: conv.durationSeconds || memoryState?.durationSeconds,
    };
    persistState(updated);
  },

  setSummary(summary: string, nextFollowup?: string, sessionId?: string) {
    if (!memoryState) return;
    const updated: ActiveConversationState = {
      ...memoryState,
      summary,
      nextFollowup: nextFollowup || memoryState.nextFollowup,
      sessionId: sessionId || memoryState.sessionId,
      lastPracticedAt: new Date().toISOString(),
    };
    persistState(updated);
  },

  clear() {
    persistState(null);
  },

  subscribe(listener: (state: ActiveConversationState | null) => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

export function useActiveConversation(): ActiveConversationState | null {
  const [state, setState] = useState<ActiveConversationState | null>(memoryState);

  useEffect(() => {
    setState(ActiveConversationStore.getState());
    return ActiveConversationStore.subscribe((updated) => {
      setState(updated);
    });
  }, []);

  return state;
}
