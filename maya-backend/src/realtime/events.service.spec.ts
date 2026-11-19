import { describe, expect, it } from 'vitest';
import { EventsService } from './events.service.js';

/** Minimal stand-in for a ws socket. */
function fakeSocket(open = true, buffered = 0) {
  const sent: string[] = [];
  return {
    readyState: open ? 1 : 3,
    bufferedAmount: buffered,
    send: (m: string) => sent.push(m),
    sent,
  } as any;
}

describe('EventsService', () => {
  it('sends a user event only to that user (all of their sockets)', () => {
    const svc = new EventsService();
    const a1 = fakeSocket();
    const a2 = fakeSocket();
    const b = fakeSocket();
    svc.register(a1, { userId: 'a' });
    svc.register(a2, { userId: 'a' });
    svc.register(b, { userId: 'b' });

    svc.notifyUser('a', 'stats.changed');

    expect(a1.sent).toEqual([JSON.stringify({ type: 'stats.changed' })]);
    expect(a2.sent).toHaveLength(1);
    expect(b.sent).toHaveLength(0);
  });

  it('sends admin events to admins only and broadcasts to everyone', () => {
    const svc = new EventsService();
    const user = fakeSocket();
    const admin = fakeSocket();
    svc.register(user, { userId: 'u' });
    svc.register(admin, { isAdmin: true });

    svc.notifyAdmins('broadcast.progress', { jobId: 'j', totalSent: 3 });
    expect(user.sent).toHaveLength(0);
    expect(JSON.parse(admin.sent[0])).toEqual({ type: 'broadcast.progress', jobId: 'j', totalSent: 3 });

    svc.broadcast('maintenance.changed');
    expect(user.sent).toEqual([JSON.stringify({ type: 'maintenance.changed' })]);
    expect(admin.sent).toHaveLength(2);
  });

  it('skips closed and backed-up sockets, and forgets unregistered ones', () => {
    const svc = new EventsService();
    const closed = fakeSocket(false);
    const slow = fakeSocket(true, 1024 * 1024);
    const ok = fakeSocket();
    svc.register(closed, { userId: 'u' });
    svc.register(slow, { userId: 'u' });
    svc.register(ok, { userId: 'u' });

    svc.notifyUser('u', 'payment.updated');
    expect(closed.sent).toHaveLength(0);
    expect(slow.sent).toHaveLength(0);
    expect(ok.sent).toHaveLength(1);

    svc.unregister(ok, 'u');
    svc.unregister(closed, 'u');
    svc.unregister(slow, 'u');
    expect(svc.socketsOf('u')).toBeUndefined();
    expect(svc.stats()).toMatchObject({ users: 0, userSockets: 0, adminSockets: 0, eventsSent: 1 });
  });

  it('ignores missing user ids', () => {
    const svc = new EventsService();
    expect(() => svc.notifyUser(null, 'stats.changed')).not.toThrow();
    expect(() => svc.notifyUser(undefined, 'stats.changed')).not.toThrow();
  });
});
