import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RoadmapService } from './roadmap.service.js';

/** Minimal chainable fake of the supabase query builder used by fetchLevelRows(). */
function fakeSupabase(rowsOrError: () => { data: any[] | null; error: any }) {
  const calls = { count: 0 };
  const builder: any = {
    select: () => builder,
    not: () => builder,
    order: () => builder,
    eq: () => builder,
    then: (resolve: any, reject: any) => {
      calls.count++;
      return Promise.resolve(rowsOrError()).then(resolve, reject);
    },
  };
  return { client: { from: () => builder }, calls };
}

describe('RoadmapService.getAllLevels cache', () => {
  let service: RoadmapService;

  beforeEach(() => {
    service = Object.create(RoadmapService.prototype);
    (service as any).logger = { warn: vi.fn(), error: vi.fn(), log: vi.fn() };
    (service as any).levelsCache = new Map();
    (service as any).levelsInFlight = new Map();
    (service as any).mapDbRowToEntity = (d: any) => d;
  });

  it('serves repeat calls from cache and dedupes concurrent calls', async () => {
    const fake = fakeSupabase(() => ({ data: [{ id: 'l1', title: 'A' }], error: null }));
    (service as any).supabase = fake.client;

    await Promise.all([service.getAllLevels(true), service.getAllLevels(true), service.getAllLevels(true)]);
    await service.getAllLevels(true);
    expect(fake.calls.count).toBe(1);
  });

  it('caches admin and published views separately', async () => {
    const fake = fakeSupabase(() => ({ data: [], error: null }));
    (service as any).supabase = fake.client;
    await service.getAllLevels(true);
    await service.getAllLevels(false);
    expect(fake.calls.count).toBe(2);
  });

  it('returns clones so caller mutations do not leak into the cache', async () => {
    const fake = fakeSupabase(() => ({ data: [{ id: 'l1', title: 'A' }], error: null }));
    (service as any).supabase = fake.client;
    const first: any[] = await service.getAllLevels(true);
    first[0].title = 'MUTATED';
    const second: any[] = await service.getAllLevels(true);
    expect(second[0].title).toBe('A');
  });

  it('refetches after invalidateLevelsCache()', async () => {
    const fake = fakeSupabase(() => ({ data: [], error: null }));
    (service as any).supabase = fake.client;
    await service.getAllLevels(true);
    service.invalidateLevelsCache();
    await service.getAllLevels(true);
    expect(fake.calls.count).toBe(2);
  });

  it('does not cache errors', async () => {
    let fail = true;
    const fake = fakeSupabase(() => (fail ? { data: null, error: { message: 'boom' } } : { data: [], error: null }));
    (service as any).supabase = fake.client;
    expect(await service.getAllLevels(true)).toEqual([]);
    fail = false;
    await service.getAllLevels(true);
    expect(fake.calls.count).toBe(2);
  });
});
