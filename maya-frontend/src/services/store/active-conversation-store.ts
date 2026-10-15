import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

export interface ActiveConversationState {
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

let memoryState: ActiveConversationState | null = loadInitialState();
const listeners = new Set<(state: ActiveConversationState | null) => void>();

function notify() {
  for (const listener of listeners) {
    listener(memoryState);
  }
}

function loadInitialState(): ActiveConversationState | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
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
      if (state) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }
}

export const ActiveConversationStore = {
  getState(): ActiveConversationState | null {
    return memoryState;
  },

  setActive(conv: Partial<ActiveConversationState> & { scenarioId: string; scenarioTitle: string }) {
    const updated: ActiveConversationState = {
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
