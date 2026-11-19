import { computeStreakBonus, STREAK_RULES } from './xp-rules';

const T0 = Date.parse('2026-11-19T10:00:00Z');
const at = (s: number) => new Date(T0 + s * 1000).toISOString();

/** Alternating Maya / learner turns, 10s apart; learner turns at 5s, 15s, 25s... */
function convo(userTexts: string[]) {
  const turns: { role: string; text: string; timestamp: string }[] = [];
  userTexts.forEach((text, i) => {
    turns.push({ role: 'model', text: 'Question?', timestamp: at(i * 10) });
    turns.push({ role: 'user', text, timestamp: at(i * 10 + 5) });
  });
  return turns;
}

describe('computeStreakBonus', () => {
  it('rewards from the 3rd consecutive hint-free turn', () => {
    const r = computeStreakBonus(convo(['I am fine', 'I like tea', 'I work here', 'Yes I do']), []);
    expect(r.longestStreak).toBe(4);
    expect(r.streakTurns).toBe(2); // turns 3 and 4
    expect(r.bonusXp).toBe(2 * STREAK_RULES.xpPerTurn);
  });

  it('a hint before a turn resets the streak', () => {
    const turns = convo(['I am fine', 'I like tea', 'I work here', 'Yes I do', 'It is good']);
    // hint between Maya's 3rd question (20s) and the 3rd answer (25s)
    const r = computeStreakBonus(turns, [T0 + 22_000]);
    // streak: 1, 2, reset, 1, 2 -> no rewarded turns
    expect(r.streakTurns).toBe(0);
    expect(r.bonusXp).toBe(0);
    expect(r.longestStreak).toBe(2);
  });

  it('caps the bonus per session', () => {
    const many = Array.from({ length: 40 }, () => 'I really like it');
    const r = computeStreakBonus(convo(many), []);
    expect(r.bonusXp).toBe(STREAK_RULES.maxPerSession);
  });

  it('ignores one-word noise and placeholders (they reset the streak)', () => {
    const r = computeStreakBonus(convo(['I am fine', 'um', 'I like tea', '(spoken audio)', 'Yes I do']), []);
    expect(r.longestStreak).toBe(1);
    expect(r.bonusXp).toBe(0);
  });

  it('gives nothing for intro calls', () => {
    const r = computeStreakBonus(convo(['I am fine', 'I like tea', 'I work here', 'Yes I do']), [], {
      isIntroCall: true,
    });
    expect(r.bonusXp).toBe(0);
  });

  it('handles empty input', () => {
    expect(computeStreakBonus(undefined, undefined).bonusXp).toBe(0);
    expect(computeStreakBonus([], []).bonusXp).toBe(0);
  });
});
