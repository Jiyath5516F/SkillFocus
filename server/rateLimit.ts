// In-memory sliding-window rate limiter (single-instance deployment) with bounded memory.

/**
 * Counts hits per key inside a sliding window. Memory is bounded by `maxKeys`: expired keys are swept first, then the
 * least recently used keys are evicted one at a time, so flooding the table with new keys can never reset everyone
 * else's counters at once.
 */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>(); // insertion order = least → most recently used
  private lastSweep = 0;

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    private readonly maxKeys = 10_000,
  ) {}

  /** Records an attempt for `key`; returns true when the key has already used its allowance for this window. */
  hit(key: string, now = Date.now()): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    const blocked = recent.length >= this.limit;
    if (!blocked) recent.push(now); // a blocked key's list never grows past `limit`
    this.hits.delete(key);
    this.hits.set(key, recent);
    if (this.hits.size > this.maxKeys) this.evict(now);
    return blocked;
  }

  private evict(now: number) {
    if (now - this.lastSweep >= 1_000) {
      this.lastSweep = now;
      for (const [k, ts] of this.hits) if (ts.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
    }
    for (const k of this.hits.keys()) {
      if (this.hits.size <= this.maxKeys) break;
      this.hits.delete(k);
    }
  }
}
