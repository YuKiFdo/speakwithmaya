/**
 * A Map that never grows beyond `maxEntries`. When full, inserting a new key
 * evicts the oldest entry (insertion order; re-setting an existing key refreshes
 * its position, giving LRU-on-write semantics). Optional `ttlMs` makes `get`/`has`
 * treat expired entries as absent.
 *
 * Used for per-session and response caches that previously grew for the lifetime
 * of the process.
 */
export class BoundedMap<K, V> extends Map<K, V> {
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private readonly writtenAt = new Map<K, number>();

  constructor(maxEntries: number, ttlMs = 0) {
    super();
    this.maxEntries = Math.max(1, maxEntries);
    this.ttlMs = Math.max(0, ttlMs);
  }

  override set(key: K, value: V): this {
    // writtenAt is undefined only if Map's constructor calls set() (never, we pass no iterable).
    if (!this.writtenAt) return super.set(key, value);
    if (super.has(key)) {
      super.delete(key);
      this.writtenAt.delete(key);
    }
    while (this.size >= this.maxEntries) {
      const oldest = super.keys().next();
      if (oldest.done) break;
      this.delete(oldest.value);
    }
    this.writtenAt.set(key, Date.now());
    return super.set(key, value);
  }

  private isExpired(key: K): boolean {
    if (!this.ttlMs) return false;
    const at = this.writtenAt.get(key);
    return at !== undefined && Date.now() - at > this.ttlMs;
  }

  override get(key: K): V | undefined {
    if (this.isExpired(key)) {
      this.delete(key);
      return undefined;
    }
    return super.get(key);
  }

  override has(key: K): boolean {
    if (this.isExpired(key)) {
      this.delete(key);
      return false;
    }
    return super.has(key);
  }

  override delete(key: K): boolean {
    this.writtenAt?.delete(key);
    return super.delete(key);
  }

  override clear(): void {
    this.writtenAt?.clear();
    super.clear();
  }
}
