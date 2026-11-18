import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { instrumentFetch, requestDiagnosticsMiddleware } from './request-diagnostics.js';

function fakeRes() {
  const res: any = new EventEmitter();
  res.statusCode = 200;
  return res;
}

describe('request diagnostics', () => {
  it('passes fetch through unchanged outside a request', async () => {
    const inner = vi.fn(async () => new Response('ok'));
    const f = instrumentFetch(inner as any);
    const r = await f('https://example.supabase.co/rest/v1/x');
    expect(await r.text()).toBe('ok');
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('attributes outbound calls to the active request and still returns responses', async () => {
    const inner = vi.fn(async () => new Response('ok'));
    const f = instrumentFetch(inner as any);
    const res = fakeRes();
    let result = '';
    await new Promise<void>((resolve) => {
      requestDiagnosticsMiddleware({ method: 'GET', originalUrl: '/v1/x' }, res, async () => {
        const r1 = await f('https://abc.supabase.co/rest/v1/a');
        await f(new URL('https://generativelanguage.googleapis.com/v1/b'));
        result = await r1.text();
        resolve();
      });
    });
    res.emit('finish'); // fast request: must not throw or log
    expect(result).toBe('ok');
    expect(inner).toHaveBeenCalledTimes(2);
  });

  it('propagates fetch errors', async () => {
    const f = instrumentFetch((async () => {
      throw new Error('boom');
    }) as any);
    await expect(
      new Promise((resolve, reject) => {
        requestDiagnosticsMiddleware({ method: 'GET', originalUrl: '/v1/x' }, fakeRes(), () => {
          f('https://abc.supabase.co/x').then(resolve, reject);
        });
      }),
    ).rejects.toThrow('boom');
  });
});
