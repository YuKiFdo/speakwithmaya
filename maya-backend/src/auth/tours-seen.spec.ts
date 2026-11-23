import { describe, expect, it } from 'vitest';
import { addTourSeen, MAX_TOURS_SEEN, normalizeToursSeen, TOUR_ID_PATTERN } from './tours-seen.js';

describe('TOUR_ID_PATTERN', () => {
  it('accepts versioned and plain tour ids', () => {
    expect(TOUR_ID_PATTERN.test('dashboard-welcome:v1')).toBe(true);
    expect(TOUR_ID_PATTERN.test('whats-new.history')).toBe(true);
  });

  it('rejects malformed ids', () => {
    for (const bad of ['', 'Dashboard', '-x', 'a:b', 'a:v', 'x'.repeat(49), 'a b', "a'; drop"]) {
      expect(TOUR_ID_PATTERN.test(bad)).toBe(false);
    }
  });
});

describe('normalizeToursSeen', () => {
  it('returns [] for null or non-arrays (column missing before migration 030)', () => {
    expect(normalizeToursSeen(null)).toEqual([]);
    expect(normalizeToursSeen(undefined)).toEqual([]);
    expect(normalizeToursSeen('dashboard-welcome:v1')).toEqual([]);
  });

  it('drops duplicates and invalid entries', () => {
    expect(normalizeToursSeen(['a:v1', 'a:v1', 7, 'BAD', 'b'])).toEqual(['a:v1', 'b']);
  });
});

describe('addTourSeen', () => {
  it('appends a new id', () => {
    expect(addTourSeen(['a:v1'], 'b:v1')).toEqual(['a:v1', 'b:v1']);
    expect(addTourSeen(null, 'a:v1')).toEqual(['a:v1']);
  });

  it('returns null when the id is already stored (no write needed)', () => {
    expect(addTourSeen(['a:v1'], 'a:v1')).toBeNull();
  });

  it('keeps only the newest MAX_TOURS_SEEN ids', () => {
    const full = Array.from({ length: MAX_TOURS_SEEN }, (_, i) => `t${i}`);
    const next = addTourSeen(full, 'new:v1')!;
    expect(next).toHaveLength(MAX_TOURS_SEEN);
    expect(next[0]).toBe('t1');
    expect(next[next.length - 1]).toBe('new:v1');
  });
});
