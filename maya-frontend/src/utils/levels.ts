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
