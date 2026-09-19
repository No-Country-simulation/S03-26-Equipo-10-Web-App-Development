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

    // Log slow queries (> 100ms) as warnings for observability (SKL-DB-001)
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration > 100) {
        this.logger.warn({ durationMs: e.duration, query: e.query }, 'Slow query detected');
      }
    });

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error({ target: e.target, message: e.message }, 'Prisma error');
    });

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn({ message: e.message }, 'Prisma warning');
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ejecuta una transacción con lógica de reintentos (Retry Logic) simple.
   * Ideal para mitigar bloqueos de concurrencia transitorios (Deadlocks, P2028, P2034).
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
        // Narrowing con el tipo oficial de Prisma para errores de request conocidos (P2028, P2034)
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2028', 'P2034'].includes(error.code)
        ) {
          if (attempt >= maxRetries) throw error;

          const delay = baseDelayMs * Math.pow(2, attempt - 1); // Exponential backoff
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
