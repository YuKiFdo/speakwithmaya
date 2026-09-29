import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

export interface SessionHistoryRecord {
  id: string;
  user_id?: string;
  start_time: string;
  end_time?: string;
  duration_seconds: number;
  topic: string;
  overall_score: number;
  fluency_score: number;
  grammar_score: number;
  pronunciation_score: number;
  status: 'active' | 'completed' | 'dropped';
  turns?: Array<{
    role: 'user' | 'model';
    text: string;
    timestamp?: string;
  }>;
  corrections?: Array<{
    id?: string;
    studentSaid: string;
    moreNatural: string;
    explanation: string;
    highlightWords?: string[];
    timestamp?: string;
  }>;
}

const LOCAL_STORAGE_KEY = 'maya_local_practice_history';

// Helper to get local cache
function getLocalSessions(): SessionHistoryRecord[] {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(LOCAL_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }
  return [];
}

// Helper to save to local cache
function saveLocalSession(record: SessionHistoryRecord) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    try {
      const prev = getLocalSessions();
      const updated = [record, ...prev.filter((s) => s.id !== record.id)];
      window.localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    } catch {
      // Local storage full or blocked
    }
  }
}

/**
 * Persists a completed session to Supabase, with automatic local offline caching.
 */
export async function persistSessionRecord(record: SessionHistoryRecord): Promise<void> {
  // Always cache locally for instant UI update
  saveLocalSession(record);

  if (!supabase) return;

  try {
    // 1. Upsert session row
    await supabase.from('sessions').upsert({
      id: record.id,
      duration_seconds: record.duration_seconds,
      topic: record.topic,
      overall_score: record.overall_score,
      fluency_score: record.fluency_score,
      grammar_score: record.grammar_score,
      pronunciation_score: record.pronunciation_score,
      status: record.status,
      end_time: record.end_time || new Date().toISOString(),
    });

    // 2. Insert turns if present
    if (record.turns && record.turns.length > 0) {
      const turnsData = record.turns.map((t, idx) => ({
        session_id: record.id,
        turn_order: idx + 1,
        role: t.role,
        text_transcript: t.text,
      }));
      await supabase.from('session_turns').insert(turnsData);
    }

    // 3. Insert grammar corrections if present
    if (record.corrections && record.corrections.length > 0) {
      const correctionsData = record.corrections.map((c) => ({
        session_id: record.id,
        student_said: c.studentSaid,
        more_natural: c.moreNatural,
        explanation: c.explanation,
        highlight_words: c.highlightWords || [],
      }));
      await supabase.from('grammar_corrections').insert(correctionsData);
    }
  } catch (err) {
    console.warn('[Supabase Sync Error, kept in local storage]:', err);
  }
}

/**
 * Fetches practice sessions from Supabase (or local offline cache).
 */
export async function fetchAllPracticeSessions(): Promise<SessionHistoryRecord[]> {
  const localList = getLocalSessions();

  if (!supabase) {
    return localList;
  }

  try {
    const { data: sessions, error } = await supabase
      .from('sessions')
      .select('*, session_turns(*), grammar_corrections(*)')
      .order('start_time', { ascending: false });

    if (error || !sessions) {
      return localList;
    }

    const mapped: SessionHistoryRecord[] = sessions.map((s: any) => ({
      id: s.id,
      user_id: s.user_id,
      start_time: s.start_time,
      end_time: s.end_time,
      duration_seconds: s.duration_seconds || 0,
      topic: s.topic || 'General Practice',
      overall_score: s.overall_score || 80,
      fluency_score: s.fluency_score || 80,
      grammar_score: s.grammar_score || 80,
      pronunciation_score: s.pronunciation_score || 80,
      status: s.status || 'completed',
      turns: (s.session_turns || []).map((t: any) => ({
        role: t.role,
        text: t.text_transcript,
        timestamp: t.timestamp,
      })),
      corrections: (s.grammar_corrections || []).map((c: any) => ({
        id: c.id,
        studentSaid: c.student_said,
        moreNatural: c.more_natural,
        explanation: c.explanation,
        highlightWords: c.highlight_words || [],
        timestamp: c.created_at,
      })),
    }));

    return mapped.length > 0 ? mapped : localList;
  } catch {
    return localList;
  }
}
