import { describe, expect, it } from 'vitest';
import { AuthService } from './auth.service.js';

const SL = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Colombo' });

// buildAnalyticsOverview only uses its argument, so it can run without a real service instance
const build = (counts: any) => (AuthService.prototype as any).buildAnalyticsOverview.call({}, counts);

const base = {
  totalUsers: 10,
  level: { beginner: 4, intermediate: 3, advanced: 1, '': 2 },
  goal: { 'speak-confidently': 6, exams: 2, unset: 2 },
  tier: { starter: 7, pro: 3 },
  status: { active: 9, canceled: 1 },
  daily: { '5': 5, '10': 3, '30': 2 },
  employment: { student: 4, unset: 6 },
  lang: { sinhala_support: 3, english_only: 1, other_mode: 1 },
  sessions: 20,
  seconds: 1200,
  tokens: 5000,
  lkr: 12.345,
  usd: 0.0412,
  regsByDay: {} as Record<string, number>,
  sessionsByDay: {} as Record<string, number>,
};

describe('buildAnalyticsOverview', () => {
  it('builds KPIs from the counts', () => {
    const today = SL.format(new Date());
    const r = build({ ...base, regsByDay: { [today]: 2 }, sessionsByDay: { [today]: 5 } });
    expect(r.kpis).toEqual({
      totalUsers: 10,
      activeSubscriptions: 9,
      totalPracticeMinutes: 20,
      totalSessions: 20,
      avgSessionDurationSeconds: 60,
      totalCostLkr: 12.35,
      totalCostUsd: 0.04,
      totalTokens: 5000,
      newUsersLast7Days: 2,
      newUsersToday: 2,
    });
    expect(r.trends.days14).toHaveLength(14);
    expect(r.trends.days14[13]).toMatchObject({ date: today, dayLabel: 'Today', registrations: 2, sessions: 5, isToday: true });
  });

  it('computes percentages per section like before', () => {
    const r = build(base);
    // Language modes: percentages of everyone who chose a mode (including unknown modes)
    expect(r.languageModes.totalSelections).toBe(5);
    expect(r.languageModes.breakdown[0]).toMatchObject({ key: 'sinhala_support', count: 3, percentage: 60 });
    // Levels: percentages of all real users; unset levels are not listed
    expect(r.levels.breakdown.map((l: any) => [l.key, l.count, l.percentage])).toEqual([
      ['beginner', 4, 40],
      ['intermediate', 3, 30],
      ['upper-intermediate', 0, 0],
      ['advanced', 1, 10],
    ]);
    // Goals: unset goals get their own row only when present
    expect(r.goals.breakdown.at(-1)).toMatchObject({ key: 'unset', count: 2, percentage: 20 });
    expect(r.plans.tiers.find((t: any) => t.tier === 'pro')).toMatchObject({ count: 3, percentage: 30 });
    expect(r.dailyCommitment.breakdown.map((d: any) => d.count)).toEqual([5, 3, 0, 2]);
    expect(r.employment.breakdown.find((e: any) => e.key === 'student')).toMatchObject({ count: 4, percentage: 40 });
  });

  it('handles an empty database', () => {
    const r = build({ ...base, totalUsers: 0, sessions: 0, seconds: 0, lang: {}, level: {}, goal: {} });
    expect(r.kpis.avgSessionDurationSeconds).toBe(0);
    expect(r.levels.breakdown[0].percentage).toBe(0);
    expect(r.goals.breakdown.some((g: any) => g.key === 'unset')).toBe(false);
  });
});
