import { PrismaClient, Prisma } from '@prisma/client';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class PrismaService extends PrismaClient<any, 'query' | 'error' | 'warn'> implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    } as any);
  }

  async onModuleInit() {
    await this.$connect();

    this.$on('query', (e: any) => {
      // Log slow queries (> 100ms) as warnings for observability (SKL-DB-001)
      if (e.duration > 100) {
        this.logger.warn(`Slow Query [${e.duration}ms]: ${e.query}`);
      }
    });

    this.$on('error', (e: any) => {
      this.logger.error(`Prisma Error: ${e.message}`, e.target);
    });

    this.$on('warn', (e: any) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ejecuta una transacción con lógica de reintentos (Retry Logic) simple
   * Ideal para mitigar bloqueos de concurrencia transitorios (Deadlocks).
   */
  async withRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 200
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.$transaction(operation);
      } catch (error: any) {
        attempt++;
        // Prisma error codes for transient transaction conflicts/deadlocks (e.g. P2028, P2034)
        if (error && error.code && ['P2028', 'P2034'].includes(error.code)) {
          if (attempt >= maxRetries) throw error;
          
          const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
          this.logger.warn(`Transaction conflict. Retrying ${attempt}/${maxRetries} after ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        } else {
          // If it's not a transient deadlock/timeout error, throw immediately
          throw error;
        }
      }
    }
    throw new Error('Transaction failed after max retries');
  }
}

