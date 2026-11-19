/**
 * The server-confirmed XP for the call that just ended. The finish reply usually arrives a moment
 * after the complete screen opens, so the screen shows the estimate first (same rules) and then
 * switches to this exact number, which is what the dashboard total will grow by.
 */
export interface CallXpResult {
  /** Total XP this call added on the server (practice / level / attempt / replay + streak). */
  xp: number;
  streakBonusXp: number;
  at: number;
}

let latest: CallXpResult | null = null;
const listeners = new Set<(r: CallXpResult) => void>();

export function publishCallXpResult(xp: number, streakBonusXp: number) {
  latest = { xp: Math.max(0, Math.round(xp)), streakBonusXp: Math.max(0, Math.round(streakBonusXp)), at: Date.now() };
  for (const l of [...listeners]) {
    try {
      l(latest);
    } catch {}
  }
}

/** Forget the previous call's result when a new call starts. */
export function resetCallXpResult() {
  latest = null;
}

export function getCallXpResult(): CallXpResult | null {
  return latest;
}

export function onCallXpResult(listener: (r: CallXpResult) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
