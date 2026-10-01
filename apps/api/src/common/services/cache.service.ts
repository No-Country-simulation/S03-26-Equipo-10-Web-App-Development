import { randomUUID, createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { RedisStoreService } from './redis-store.service';

const RELEASE_LOCK = `if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1]) end return 0`;
const MAX_VALUE_BYTES = 256 * 1024;

@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);

  constructor(private readonly redis: RedisStoreService) {}

  /** Una versión por tenant evita barrer claves y descarta escritores anteriores a publicar. */
  async invalidateTenantPublic(tenantId: string): Promise<void> {
    try {
      const client = await this.redis.connection();
      await client.incr(`public-cache-version:v1:${tenantId}`);
    } catch (error) {
      // La escritura de dominio ya confirmó. El TTL acota la posible vista antigua.
      this.logger.error('Public cache invalidation failed', error);
    }
  }

  async getOrSetPublic<T>(tenantId: string, query: string, factory: () => Promise<T>, ttlMs = 60_000): Promise<T> {
    let loading = false;
    try {
      const client = await this.redis.connection();
      const version = await client.get(`public-cache-version:v1:${tenantId}`) ?? '0';
      const queryHash = createHash('sha256').update(query).digest('hex');
      const key = `public-cache:v1:${tenantId}:${version}:${queryHash}`;
      const cached = await client.get(key);
      if (cached !== null) return JSON.parse(cached) as T;

      const lockKey = `${key}:lock`;
      const token = randomUUID();
      const locked = await client.set(lockKey, token, { NX: true, PX: 5000 });
      if (locked === 'OK') {
        try {
          loading = true;
          const value = await factory();
          loading = false;
          try {
            const serialized = JSON.stringify(value);
            if (Buffer.byteLength(serialized) <= MAX_VALUE_BYTES) {
              await client.set(key, serialized, { PX: ttlMs });
            }
          } catch (error) {
            this.logger.warn('Public cache write failed; returning computed value', error);
          }
          return value;
        } finally {
          await client.eval(RELEASE_LOCK, { keys: [lockKey], arguments: [token] }).catch(() => undefined);
        }
      }

      for (let attempt = 0; attempt < 20; attempt += 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
        const waited = await client.get(key);
        if (waited !== null) return JSON.parse(waited) as T;
      }
    } catch (error) {
      if (loading) throw error;
      this.logger.warn('Public cache unavailable; loading from PostgreSQL', error);
    }
    return factory();
  }
}
