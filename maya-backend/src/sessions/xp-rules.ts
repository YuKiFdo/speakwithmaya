/**
 * XP rules that are stored as events (xp_events), as opposed to the XP that is derived on read
 * (roadmap levels from user_roadmap_progress, general practice = floor(minutes) x 5).
 */

export const STREAK_RULES = {
  /** A streak turn counts from this position on (3rd consecutive hint-free turn). */
  minStreak: 3,
  /** XP per streak turn once the streak is active. */
  xpPerTurn: 2,
  /** Maximum streak bonus per session. */
  maxPerSession: 20,
  /** A learner turn must have at least this many words to count (no "um", noise). */
  minWords: 2,
} as const;

export interface XpTurn {
  role: 'user' | 'model' | string;
  text?: string;
  timestamp?: string;
}

/**
 * Streak bonus for one session.
 *
 * A "streak turn" is a learner turn with real speech and no hint requested between Maya's
 * previous reply and that turn. From the `minStreak`-th consecutive streak turn on, each one
 * earns `xpPerTurn`, capped at `maxPerSession`. A hint, or a turn without real speech, resets it.
 *
 * Turns without timestamps are treated as hint-free (we cannot place a hint before them).
 */
export function computeStreakBonus(
  turns: XpTurn[] | undefined,
  hintAtMs: number[] | undefined,
  opts: { isIntroCall?: boolean } = {},
  rules = STREAK_RULES,
): { bonusXp: number; longestStreak: number; streakTurns: number } {
  if (opts.isIntroCall || !Array.isArray(turns) || turns.length === 0) {
    return { bonusXp: 0, longestStreak: 0, streakTurns: 0 };
  }
  const hints = [...(hintAtMs || [])].filter((t) => Number.isFinite(t)).sort((a, b) => a - b);

  let streak = 0;
  let longest = 0;
  let rewardedTurns = 0;
  let windowStart = Number.NEGATIVE_INFINITY; // time of Maya's previous reply

  for (const t of turns) {
    const ts = t.timestamp ? Date.parse(t.timestamp) : NaN;
    if (t.role === 'model') {
      if (Number.isFinite(ts)) windowStart = ts;
      continue;
    }
    if (t.role !== 'user') continue;

    const words = (t.text || '').trim().split(/\s+/).filter(Boolean);
    const isRealSpeech = words.length >= rules.minWords && !(t.text || '').trim().startsWith('(');
    const usedHint =
      Number.isFinite(ts) && hints.some((h) => h > windowStart && h <= ts);

    if (!isRealSpeech || usedHint) {
      streak = 0;
      continue;
    }
    streak += 1;
    longest = Math.max(longest, streak);
    if (streak >= rules.minStreak) rewardedTurns += 1;
  }

  const bonusXp = Math.min(rules.maxPerSession, rewardedTurns * rules.xpPerTurn);
  return { bonusXp, longestStreak: longest, streakTurns: rewardedTurns };
}

/**
 * Validates the streak bonus the call screen showed live. Accepted only up to what the stored
 * transcript allows: at most `xpPerTurn` for every real-speech learner turn after the first
 * (minStreak - 1), rounded to whole streak turns, and never above `maxPerSession`.
 */
export function acceptClientStreakBonus(
  clientBonusXp: number | undefined,
  turns: XpTurn[] | undefined,
  isIntroCall: boolean,
  rules = STREAK_RULES,
): number {
  const claimed = Math.floor(Number(clientBonusXp) || 0);
  if (isIntroCall || claimed <= 0 || !Array.isArray(turns)) return 0;
  const realTurns = turns.filter((t) => {
    if (t.role !== 'user') return false;
    const text = (t.text || '').trim();
    return text.split(/\s+/).filter(Boolean).length >= rules.minWords && !text.startsWith('(');
  }).length;
  const possibleTurns = Math.max(0, realTurns - (rules.minStreak - 1));
  const maxXp = Math.min(rules.maxPerSession, possibleTurns * rules.xpPerTurn);
  const wholeTurns = Math.floor(claimed / rules.xpPerTurn) * rules.xpPerTurn;
  return Math.max(0, Math.min(wholeTurns, maxXp));
}
