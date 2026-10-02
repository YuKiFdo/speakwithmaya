import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

// Clean up any historical test data stored in browser localStorage
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('maya_local_practice_history');
  } catch {}
}

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

const getBackendBaseUrl = (): string => {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('azurewebsites.net') || hostname.includes('southeastasia')) {
      return 'https://maya-backend.icyisland-5baf2c26.southeastasia-01.azurewebsites.net';
    }
  }
  return process.env.EXPO_PUBLIC_BACKEND_URL || 'http://localhost:3000';
};

/**
 * Persists a completed session to Supabase.
 */
export async function persistSessionRecord(record: SessionHistoryRecord): Promise<void> {
  // Only call direct PostgREST if anon key is a valid JWT; otherwise backend /finish handles it
  if (!supabase || !supabaseAnonKey.startsWith('ey')) return;

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
    console.warn('[Supabase Sync Error]:', err);
  }
}

/**
 * Fetches practice sessions directly from Supabase / Backend API (no localStorage).
 */
export async function fetchAllPracticeSessions(): Promise<SessionHistoryRecord[]> {
  // 1. Fetch authoritative records from backend API (connected to Supabase via service role key)
  try {
    const backendUrl = getBackendBaseUrl();
    const res = await fetch(`${backendUrl}/v1/sessions`);
    if (res.ok) {
      const serverSessions: SessionHistoryRecord[] = await res.json();
      if (Array.isArray(serverSessions)) {
        return serverSessions;
      }
    }
  } catch (err) {
    console.warn('[fetchAllPracticeSessions] Backend fetch error:', err);
  }

  // 2. Direct Supabase query if anon key is configured
  if (supabase && supabaseAnonKey.startsWith('ey')) {
    try {
      const { data: sessions, error } = await supabase
        .from('sessions')
        .select('*, session_turns(*), grammar_corrections(*)')
        .order('start_time', { ascending: false });

      if (!error && sessions && sessions.length > 0) {
        return sessions.map((s: any) => ({
          id: s.id,
          user_id: s.user_id,
          start_time: s.start_time || s.created_at,
          end_time: s.end_time,
          duration_seconds: s.duration_seconds || 0,
          topic: s.topic || 'General Practice',
          overall_score: s.overall_score || 85,
          fluency_score: s.fluency_score || 84,
          grammar_score: s.grammar_score || 82,
          pronunciation_score: s.pronunciation_score || 86,
          status: s.status || 'completed',
          turns: (s.session_turns || [])
            .sort((a: any, b: any) => (a.turn_order || 0) - (b.turn_order || 0))
            .map((t: any) => ({
              role: t.role,
              text: t.text_transcript,
              timestamp: t.timestamp || t.created_at,
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
      }
    } catch (err) {
      console.warn('[fetchAllPracticeSessions] Direct Supabase error:', err);
    }
  }

  return [];
}

/**
 * Resolves authentication headers for backend API requests.
 * Uses active Supabase user session JWT if logged in,
 * otherwise falls back to configured publishable/anon key.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  try {
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.access_token) {
        headers['Authorization'] = `Bearer ${data.session.access_token}`;
        return headers;
      }
    }
  } catch (err) {
    console.warn('[getAuthHeaders] Error retrieving session:', err);
  }

  if (supabaseAnonKey) {
    headers['Authorization'] = `Bearer ${supabaseAnonKey}`;
  }

  return headers;
}
