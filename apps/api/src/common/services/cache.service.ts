import { Injectable } from '@nestjs/common';

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

/**
 * Simple in-memory cache with TTL support.
 * Designed for single-node deployments (no shared state between instances).
 */
@Injectable()
export class CacheService {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly DEFAULT_TTL_MS = 60_000; // 60 seconds

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
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
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
}
