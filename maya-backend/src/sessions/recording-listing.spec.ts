import { describe, expect, it } from 'vitest';
import { BoundedMap } from '../common/bounded-map.js';
import { SessionsService, mapWithConcurrency } from './sessions.service.js';

const SID = '6f1c2a9e-2b7d-4c1a-9e3f-1a2b3c4d5e6f';
const HOUR_AGO_PLUS = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

/** Calls the private listing method against a fake storage client. */
function lister(listResult: () => Promise<{ data: any; error: any }>) {
  let calls = 0;
  const self: any = {
    supabase: { storage: { from: () => ({ list: () => (calls++, listResult()) }) } },
    completedSessionFilesCache: new BoundedMap<string, Set<string>>(100),
  };
  const list = (sess: any) => (SessionsService.prototype as any).listSessionRecordingFilesNow.call(self, sess);
  return { self, list, calls: () => calls };
}

describe('session recording listing', () => {
  it('caches a successful listing that has the full recording', async () => {
    const { self, list } = lister(async () => ({ data: [{ name: 'full_conversation.webm' }, { name: 'turns' }], error: null }));
    const files = await list({ id: SID, created_at: new Date().toISOString() });
    expect(SessionsService.hasRecordingFile(files, 'full_conversation')).toBe(true);
    expect(self.completedSessionFilesCache.get(SID)).toBe(files);
  });

  it('treats a failed listing as unknown and never caches it as "no audio"', async () => {
    const { self, list } = lister(async () => ({ data: null, error: { message: 'storage timeout' } }));
    expect(await list({ id: SID, created_at: HOUR_AGO_PLUS })).toBeNull();
    expect(self.completedSessionFilesCache.has(SID)).toBe(false);
  });

  it('does not cache an empty listing of a recent session (recording may still be uploading)', async () => {
    const { self, list } = lister(async () => ({ data: [], error: null }));
    const files = await list({ id: SID, created_at: new Date().toISOString() });
    expect(files?.size).toBe(0);
    expect(self.completedSessionFilesCache.has(SID)).toBe(false);
  });

  it('caches an empty listing once the session is over an hour old', async () => {
    const { self, list } = lister(async () => ({ data: [], error: null }));
    await list({ id: SID, created_at: HOUR_AGO_PLUS });
    expect(self.completedSessionFilesCache.get(SID)?.size).toBe(0);
  });
});

describe('mapWithConcurrency', () => {
  it('keeps at most `limit` calls in flight and returns results in order', async () => {
    let inFlight = 0;
    let peak = 0;
    const out = await mapWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight--;
      return n * 10;
    });
    expect(peak).toBe(3);
    expect(out).toEqual([10, 20, 30, 40, 50, 60, 70]);
  });

  it('handles an empty list', async () => {
    expect(await mapWithConcurrency([], 5, async () => 1)).toEqual([]);
  });
});
