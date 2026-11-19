import { describe, expect, it } from 'vitest';
import { levelForXp, levelProgress, xpNeededForLevel } from './xp-calculator.js';

describe('level curve', () => {
  it('needs 180 XP for level 1, +60 per level, capped at 600', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 20].map(xpNeededForLevel)).toEqual([180, 240, 300, 360, 420, 480, 540, 600, 600, 600]);
  });

  it('maps total XP to levels at the cumulative boundaries', () => {
    const cases: Array<[number, number]> = [
      [0, 1], [179, 1], [180, 2], [419, 2], [420, 3], [720, 4], [1080, 5],
      [1500, 6], [1980, 7], [2519, 7], [2520, 8], [3119, 8], [3120, 9], [3720, 10],
    ];
    for (const [xp, level] of cases) expect([xp, levelForXp(xp)]).toEqual([xp, level]);
  });

  it('reports progress inside the current level', () => {
    expect(levelProgress(240)).toEqual({ level: 2, intoLevel: 60, needed: 240, progress: 0.25 });
    expect(levelProgress(0)).toEqual({ level: 1, intoLevel: 0, needed: 180, progress: 0 });
    expect(levelProgress(2520 + 300)).toEqual({ level: 8, intoLevel: 300, needed: 600, progress: 0.5 });
    expect(levelProgress(-50).level).toBe(1);
  });
});
