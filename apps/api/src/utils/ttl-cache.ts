/**
 * Lightweight in-process TTL + LRU cache used for server-side search result caching,
 * dataset search-context caching, and analytics aggregation caching (ADR-08).
 *
 * - Entries expire after `ttlMs`.
 * - When `maxEntries` is exceeded, the least-recently-used entry is evicted.
 * - Hit/miss counters feed cache-effectiveness reporting (Section 14 / Bonus F).
 *
 * NOTE: This cache is per Node.js process. In a multi-instance deployment it should be
 * replaced (or fronted) by a shared cache such as Redis (see ADR-08 Future Limitations).
 */

export interface TtlCacheOptions {
  maxEntries: number;
  ttlMs: number;
}

export interface TtlCacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
}

interface CacheEntry<V> {
  value: V;
  expiresAt: number;
}

export class TtlCache<V> {
  private readonly store = new Map<string, CacheEntry<V>>();
  private readonly maxEntries: number;
  private readonly ttlMs: number;
  private hits = 0;
  private misses = 0;

  constructor(options: TtlCacheOptions) {
    this.maxEntries = Math.max(1, options.maxEntries);
    this.ttlMs = Math.max(1, options.ttlMs);
  }

  get(key: string): V | undefined {
    const entry = this.store.get(key);
    if (!entry) {
      this.misses += 1;
      return undefined;
    }

    if (entry.expiresAt <= Date.now()) {
      this.store.delete(key);
      this.misses += 1;
      return undefined;
    }

    // Refresh LRU position
    this.store.delete(key);
    this.store.set(key, entry);
    this.hits += 1;
    return entry.value;
  }

  set(key: string, value: V, ttlMs: number = this.ttlMs): void {
    if (this.store.has(key)) {
      this.store.delete(key);
    }

    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });

    while (this.store.size > this.maxEntries) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey === undefined) break;
      this.store.delete(oldestKey);
    }
  }

  delete(key: string): boolean {
    return this.store.delete(key);
  }

  deleteByPrefix(prefix: string): number {
    let removed = 0;
    for (const key of [...this.store.keys()]) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clear(): void {
    this.store.clear();
  }

  stats(): TtlCacheStats {
    const total = this.hits + this.misses;
    return {
      size: this.store.size,
      hits: this.hits,
      misses: this.misses,
      hitRate: total === 0 ? 0 : Number((this.hits / total).toFixed(4)),
    };
  }
}
