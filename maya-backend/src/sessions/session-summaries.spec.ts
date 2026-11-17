import { describe, it, expect, vi } from 'vitest';
import { SessionsService } from './sessions.service.js';

function makeService(rows: any[], error: any = null) {
  const calls: { select?: string; eq?: [string, string]; limit?: number } = {};
  const builder: any = {
    select: (cols: string) => ((calls.select = cols), builder),
    eq: (col: string, val: string) => ((calls.eq = [col, val]), builder),
    order: () => builder,
    limit: (n: number) => ((calls.limit = n), Promise.resolve({ data: rows, error })),
  };
  const service: any = Object.create(SessionsService.prototype);
  service.supabase = { from: () => builder };
  service.logger = { error: vi.fn() };
  return { service: service as SessionsService, calls };
}

describe('SessionsService.getUserSessionSummaries', () => {
  it('selects only scalar columns for the user (no nested turns/corrections)', async () => {
    const { service, calls } = makeService([]);
    await service.getUserSessionSummaries('u1');
    expect(calls.select).not.toMatch(/session_turns|grammar_corrections|\*/);
    expect(calls.eq).toEqual(['user_id', 'u1']);
    expect(calls.limit).toBe(50);
  });

  it('excludes intro/onboarding sessions and maps roadmap fields', async () => {
    const { service } = makeService([
      { id: 'a', topic: 'Intro call', duration_seconds: 60 },
      { id: 'b', topic: 'Coffee shop', duration_seconds: 120, roadmap_level_id: 'lvl-1' },
      { id: 'c', topic: 'Placement assessment', duration_seconds: 30 },
    ]);
    const out: any[] = await service.getUserSessionSummaries('u1');
    expect(out.map((s) => s.id)).toEqual(['b']);
    expect(out[0]).toMatchObject({ duration_seconds: 120, roadmap_level_id: 'lvl-1', roadmapLevelId: 'lvl-1', is_roadmap: true });
  });

  it('returns [] on query error', async () => {
    const { service } = makeService(null as any, { message: 'boom' });
    expect(await service.getUserSessionSummaries('u1')).toEqual([]);
  });
});
