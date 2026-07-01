interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Cache em memória simples com TTL. Adequado para MVP em dev
 * e para instâncias single-node. Em produção multi-instância,
 * trocar por Redis (Upstash).
 */
export class MemoryCache<T = unknown> {
  private readonly store = new Map<string, CacheEntry<T>>();

  get(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value;
  }

  set(key: string, value: T, ttlSeconds: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
  }

  clear(): void {
    this.store.clear();
  }
}
