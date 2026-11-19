import { describe, expect, it } from 'vitest';
import { computeXpByUser, practiceXp, XP_RULES } from './xp-calculator.js';

describe('practiceXp', () => {
  it('follows the practice rule (>= 30 s, 5 XP per full minute, minimum 5)', () => {
    expect(practiceXp(0)).toBe(0);
    expect(practiceXp(29)).toBe(0);
    expect(practiceXp(30)).toBe(5);
    expect(practiceXp(59)).toBe(5);
    expect(practiceXp(60)).toBe(5);
    expect(practiceXp(119)).toBe(5);
    expect(practiceXp(120)).toBe(10);
    expect(practiceXp(300)).toBe(25);
  });
});

describe('computeXpByUser', () => {
  const rows = {
    progressRows: [
      { user_id: 'u1', roadmap_level_id: 'L1', status: 'completed', is_passed: true, xp_earned: 100, completed_at: '2026-11-01T00:00:00Z' },
      // same level passed again: counted once
      { user_id: 'u1', roadmap_level_id: 'L1', status: 'completed', is_passed: true, xp_earned: 100, completed_at: '2026-11-10T00:00:00Z' },
      // not passed: no level XP (attempt XP lives in the ledger)
      { user_id: 'u1', roadmap_level_id: 'L2', status: 'in_progress', is_passed: false, xp_earned: 25 },
      { user_id: 'u2', roadmap_level_id: 'L1', status: 'completed', is_passed: true, xp_earned: null, completed_at: '2026-11-18T00:00:00Z' },
    ],
    sessionRows: [
      { user_id: 'u1', duration_seconds: 130, created_at: '2026-11-18T00:00:00Z' }, // 10
      { user_id: 'u1', duration_seconds: 20, created_at: '2026-11-18T00:00:00Z' }, // 0 (too short)
      { user_id: 'u1', duration_seconds: 600, roadmap_level_id: 'L2', created_at: '2026-11-18T00:00:00Z' }, // roadmap: 0 here
    ],
    xpEventRows: [
      { user_id: 'u1', amount: 6, created_at: '2026-11-18T00:00:00Z' },
      { user_id: 'u1', amount: 25, created_at: '2026-10-01T00:00:00Z' },
    ],
  };

  it('adds passed levels once, practice calls and the ledger', () => {
    const { allTime } = computeXpByUser(rows);
    expect(allTime.get('u1')).toBe(100 + 10 + 6 + 25);
    expect(allTime.get('u2')).toBe(XP_RULES.levelPassXp); // missing xp_earned -> 100
  });

  it('splits period XP by time (earliest completion counts for a level)', () => {
    const { period } = computeXpByUser(rows, new Date('2026-11-15T00:00:00Z').getTime());
    expect(period.get('u1')).toBe(10 + 6); // level L1 was first passed on Nov 1
    expect(period.get('u2')).toBe(100);
  });

  it('uses fallbackUserId for single-user rows', () => {
    const { allTime } = computeXpByUser(
      { sessionRows: [{ duration_seconds: 60 }], xpEventRows: [{ amount: 2 }] },
      0,
      'me',
    );
    expect(allTime.get('me')).toBe(7);
  });
});
