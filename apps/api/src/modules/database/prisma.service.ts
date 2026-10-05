import { PrismaClient, Prisma } from '@prisma/client';
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';

@Injectable()
export class PrismaService
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'>
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Query text and engine messages can contain user values; log metadata only.
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration > 100) {
        this.logger.warn({ event: 'database.slow_query', durationMs: e.duration }, 'Slow query detected');
      }
    });

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error({ event: 'database.engine_error', target: e.target }, 'Prisma error');
    });

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn({ event: 'database.engine_warning', target: e.target }, 'Prisma warning');
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Reintenta únicamente conflictos de escritura/deadlocks P2034. La operación
   * debe poder repetirse sin efectos externos y escribir de forma idempotente.
   */
  async withRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 200,
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.$transaction(operation);
      } catch (error: unknown) {
        attempt++;
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034'
        ) {
          if (attempt >= maxRetries) throw error;

          const delay = Math.floor(Math.random() * Math.min(baseDelayMs * 2 ** (attempt - 1), 2_000));
          this.logger.warn(
            { attempt, maxRetries, delayMs: delay, errorCode: error.code },
            'Transaction conflict — retrying',
          );
          await new Promise<void>(resolve => setTimeout(resolve, delay));
        } else {
          // Error no transitorio: propagar inmediatamente
          throw error;
        }
      }
    }
    throw new Error('Transaction failed after max retries');
  }
}
