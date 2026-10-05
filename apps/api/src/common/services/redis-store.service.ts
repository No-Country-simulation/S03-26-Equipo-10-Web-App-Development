import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import type { AppConfig } from '../../config/app.config';

function makeClient(url: string) {
  return createClient({
    url,
    disableOfflineQueue: true,
    socket: { connectTimeout: 1500, reconnectStrategy: false },
  });
}

type RedisClient = ReturnType<typeof makeClient>;

/** Una conexión por proceso; sin cola offline para no aceptar cuotas sin Redis. */
@Injectable()
export class RedisStoreService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisStoreService.name);
  private client: RedisClient | null = null;
  private connecting: Promise<RedisClient> | null = null;

  constructor(private readonly config: ConfigService) {}

  async connection(): Promise<RedisClient> {
    if (this.client?.isReady) return this.client;
    if (this.connecting) return this.connecting;
    const url = this.config.get<AppConfig>('app')?.redis.url;
    if (!url) throw new Error('REDIS_URL is required');
    const client = makeClient(url);
    client.on('error', () => this.logger.warn('Redis connection error'));
    this.client = client;
    this.connecting = client.connect().then(() => client).catch(error => {
      client.destroy();
      if (this.client === client) this.client = null;
      throw error;
    }).finally(() => { this.connecting = null; });
    return this.connecting;
  }

  async onModuleDestroy(): Promise<void> {
    this.client?.destroy();
    this.client = null;
  }
}
