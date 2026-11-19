/**
 * THE XP rules. Every screen and endpoint (dashboard total, rank, leaderboards, call summary)
 * computes XP through this file, so the numbers can never disagree.
 *
 * Total XP =
 *   - roadmap levels: `xp_earned` (100) for each PASSED level, counted once per level
 *   - practice calls (no roadmap level, intro included): >= 30 s -> max(1, floor(min)) x 5
 *   - XP ledger (xp_events): streak bonus, failed-attempt XP, replay XP ...
 *
 * Level: growing curve, see LEVEL_CURVE below.
 */

export const XP_RULES = {
  levelPassXp: 100,
  practiceXpPerMinute: 5,
  practiceMinSeconds: 30,
  /** XP for a genuine but failed attempt at a roadmap level ... */
  attemptXp: 25,
  /** ... at most this many times per level (no farming). */
  maxRewardedAttemptsPerLevel: 3,
} as const;

/** XP for a practice call (also used for replaying an already passed roadmap level). */
export function practiceXp(durationSeconds: number): number {
  const d = Number(durationSeconds) || 0;
  if (d < XP_RULES.practiceMinSeconds) return 0;
  return Math.max(1, Math.floor(d / 60)) * XP_RULES.practiceXpPerMinute;
}

/**
 * Level curve: Level 1 is quick (180 XP), each next level needs 60 XP more, capped at 600.
 *   Level 1 -> 2: 180, 2 -> 3: 240, 3 -> 4: 300 ... 7 -> 8: 540, then 600 per level.
 * Cumulative XP to reach a level: L2 180, L3 420, L4 720, L5 1080, L6 1500, L7 1980, L8 2520.
 * KEEP IN SYNC: maya-backend/src/common/xp-calculator.ts and maya-frontend/src/utils/levels.ts.
 */
export const LEVEL_CURVE = { firstLevelXp: 180, stepXp: 60, maxLevelXp: 600 } as const;

/** XP needed to go from `level` to `level + 1`. */
export function xpNeededForLevel(level: number): number {
  const n = Math.max(1, Math.floor(level));
  return Math.min(LEVEL_CURVE.maxLevelXp, LEVEL_CURVE.firstLevelXp + (n - 1) * LEVEL_CURVE.stepXp);
}

/** Level, XP into that level, XP the level needs, and 0..1 progress for a total XP. */
export function levelProgress(totalXp: number): { level: number; intoLevel: number; needed: number; progress: number } {
  let remaining = Math.max(0, Math.floor(Number(totalXp) || 0));
  let level = 1;
  // Growing part of the curve (until the cap), then a closed form for the flat part
  while (xpNeededForLevel(level) < LEVEL_CURVE.maxLevelXp && remaining >= xpNeededForLevel(level)) {
    remaining -= xpNeededForLevel(level);
    level += 1;
  }
  if (xpNeededForLevel(level) >= LEVEL_CURVE.maxLevelXp) {
    const extra = Math.floor(remaining / LEVEL_CURVE.maxLevelXp);
    level += extra;
    remaining -= extra * LEVEL_CURVE.maxLevelXp;
  }
  const needed = xpNeededForLevel(level);
  return { level, intoLevel: remaining, needed, progress: Math.min(1, remaining / needed) };
}

export function levelForXp(xp: number): number {
  return levelProgress(xp).level;
}

export interface XpProgressRow {
  user_id?: string;
  id?: string;
  roadmap_level_id?: string | null;
  level_number?: number | null;
  status?: string | null;
  is_passed?: boolean | null;
  xp_earned?: number | string | null;
  completed_at?: string | null;
  created_at?: string | null;
}
export interface XpSessionRow {
  user_id?: string;
  duration_seconds?: number | string | null;
  roadmap_level_id?: string | null;
  created_at?: string | null;
}
export interface XpEventRow {
  user_id?: string;
  amount?: number | string | null;
  created_at?: string | null;
}

const isPassedRow = (r: XpProgressRow) => r.status === 'completed' || r.is_passed === true;
const levelKey = (r: XpProgressRow) => String(r.roadmap_level_id || r.level_number || r.id || '');
const ts = (iso?: string | null) => (iso ? new Date(iso).getTime() : 0);

/**
 * XP per user. `cutoffMs` > 0 also returns XP earned since that time (weekly / monthly boards).
 * `fallbackUserId` is used for rows fetched for one user without a user_id column.
 */
export function computeXpByUser(
  input: { progressRows?: XpProgressRow[]; sessionRows?: XpSessionRow[]; xpEventRows?: XpEventRow[] },
  cutoffMs = 0,
  fallbackUserId?: string,
): { allTime: Map<string, number>; period: Map<string, number> } {
  const allTime = new Map<string, number>();
  const period = new Map<string, number>();
  const add = (userId: string | undefined, amount: number, at: number) => {
    const u = userId || fallbackUserId;
    if (!u || !amount) return;
    allTime.set(u, (allTime.get(u) || 0) + amount);
    if (cutoffMs === 0 || at >= cutoffMs) period.set(u, (period.get(u) || 0) + amount);
  };

  // Passed roadmap levels, once per level (earliest completion decides the period)
  const seen = new Set<string>();
  const passed = (input.progressRows || [])
    .filter(isPassedRow)
    .sort((a, b) => ts(a.completed_at || a.created_at) - ts(b.completed_at || b.created_at));
  for (const r of passed) {
    const key = `${r.user_id || fallbackUserId}|${levelKey(r)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const earned = r.xp_earned === null || r.xp_earned === undefined || r.xp_earned === '' ? XP_RULES.levelPassXp : Number(r.xp_earned) || 0;
    add(r.user_id, earned, ts(r.completed_at || r.created_at));
  }

  // Practice calls (intro included); roadmap sessions earn through progress rows / the ledger
  for (const s of input.sessionRows || []) {
    if (s.roadmap_level_id && !String(s.roadmap_level_id).startsWith('practice-')) continue;
    add(s.user_id, practiceXp(Number(s.duration_seconds) || 0), ts(s.created_at));
  }

  // XP ledger
  for (const e of input.xpEventRows || []) add(e.user_id, Number(e.amount) || 0, ts(e.created_at));

  return { allTime, period };
}
