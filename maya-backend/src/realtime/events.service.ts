import { Injectable, Logger } from '@nestjs/common';
import type { WebSocket } from 'ws';

/**
 * Server -> client "something changed" hints over the /events WebSocket.
 *
 * Design (see realtime/events.gateway.ts for the connection rules):
 *  - Events are HINTS without personal data: { type, ...small ids }. The client re-fetches
 *    the real data over HTTP, so a lost event is harmless (the client also re-fetches on every
 *    reconnect) and duplicates / reordering do no damage.
 *  - In-memory registry: correct for ONE backend instance. With several instances, implement
 *    the same three methods over Redis pub/sub (e.g. channel per event) - callers do not change.
 */
export type ServerEventType =
  | 'stats.changed' // XP / level / minutes / plan of THIS user changed
  | 'payment.updated' // a PayHere notification for THIS user was processed
  | 'maintenance.changed' // maintenance mode switched (everyone)
  | 'broadcast.progress'; // admin SMS broadcast progress (admins only)

export interface ServerEvent {
  type: ServerEventType;
  [key: string]: unknown;
}

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);
  private readonly byUser = new Map<string, Set<WebSocket>>();
  private readonly admins = new Set<WebSocket>();
  private sent = 0;

  /** Called by the gateway once a socket is authenticated. */
  register(client: WebSocket, identity: { userId?: string; isAdmin?: boolean }) {
    if (identity.userId) {
      let set = this.byUser.get(identity.userId);
      if (!set) {
        set = new Set();
        this.byUser.set(identity.userId, set);
      }
      set.add(client);
    }
    if (identity.isAdmin) this.admins.add(client);
  }

  unregister(client: WebSocket, userId?: string) {
    if (userId) {
      const set = this.byUser.get(userId);
      if (set) {
        set.delete(client);
        if (set.size === 0) this.byUser.delete(userId);
      }
    }
    this.admins.delete(client);
  }

  /** Open sockets of one user (gateway uses it for the per-user connection cap). */
  socketsOf(userId: string): Set<WebSocket> | undefined {
    return this.byUser.get(userId);
  }

  notifyUser(userId: string | null | undefined, type: ServerEventType, extra: Record<string, unknown> = {}) {
    if (!userId) return;
    const set = this.byUser.get(userId);
    if (!set || set.size === 0) return;
    this.send(set, { type, ...extra });
  }

  notifyAdmins(type: ServerEventType, extra: Record<string, unknown> = {}) {
    if (this.admins.size === 0) return;
    this.send(this.admins, { type, ...extra });
  }

  /** Every connected client (e.g. maintenance switched). */
  broadcast(type: ServerEventType, extra: Record<string, unknown> = {}) {
    const all = new Set<WebSocket>();
    for (const set of this.byUser.values()) for (const c of set) all.add(c);
    for (const c of this.admins) all.add(c);
    this.send(all, { type, ...extra });
  }

  stats() {
    let users = 0;
    let sockets = 0;
    for (const set of this.byUser.values()) {
      users += 1;
      sockets += set.size;
    }
    return { users, userSockets: sockets, adminSockets: this.admins.size, eventsSent: this.sent };
  }

  private send(targets: Iterable<WebSocket>, event: ServerEvent) {
    const payload = JSON.stringify(event);
    for (const c of targets) {
      // 1 = OPEN. Skip sockets that are already slow (big send buffer) rather than queueing more.
      if (c.readyState !== 1 || c.bufferedAmount > 64 * 1024) continue;
      try {
        c.send(payload);
        this.sent += 1;
      } catch (e: any) {
        this.logger.debug?.(`send failed: ${e?.message}`);
      }
    }
  }
}
