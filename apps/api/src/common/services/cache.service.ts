import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache with TTL support and bounded size.
 * Designed for single-node deployments (no shared state between instances).
 *
 * H-09: Agrega MAX_ENTRIES para evitar crecimiento ilimitado en memoria.
 * Usa evicción FIFO cuando se alcanza el límite.
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 60_000; // 60 seconds
  /** Límite de entradas simultáneas. Previene memory leaks en servicios de larga vida. */
  private readonly MAX_ENTRIES = 10_000;

  /**
   * Get a cached value by key. Returns null if expired or missing.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set a value in the cache with an optional TTL in milliseconds.
   * Si el store alcanza MAX_ENTRIES, evicta la entrada más antigua (FIFO).
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    // Evicción FIFO cuando se alcanza el límite de capacidad
    if (!this.store.has(key) && this.store.size >= this.MAX_ENTRIES) {
      const oldestKey = this.store.keys().next().value;
      if (oldestKey !== undefined) {
        this.store.delete(oldestKey);
      }
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.DEFAULT_TTL_MS),
    });
  }

  /**
   * Get a value from cache, or compute and cache it if missing/expired.
   */
  async getOrSet<T>(key: string, factory: () => Promise<T>, ttlMs?: number): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) return cached;

    const data = await factory();
    this.set(key, data, ttlMs);
    return data;
  }

  /**
   * Invalidate a specific cache key.
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix.
   */
  invalidateByPrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Clear all cached entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Devuelve el número de entradas actualmente en caché.
   * Útil para métricas y health checks.
   */
  get size(): number {
    return this.store.size;
  }
}
