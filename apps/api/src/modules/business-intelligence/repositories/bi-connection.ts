import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { databaseUrl } from '../etl.config';
import { UnavailableError } from '../../../common/errors/application.error';

@Injectable()
export class BiConnection implements OnModuleDestroy {
  private readonly client: PrismaClient | undefined;
  private readonly enabled = process.env.BI_ENABLED === 'true';
  constructor() {
    // Lazy Prisma connection. BI configuration never prevents the operational API from starting.
    if (this.enabled) {
      try { this.client = new PrismaClient({ datasources: { db: { url: databaseUrl(process.env.BI_DATABASE_URL, 2) } }, log: [] }); }
      catch { /* A request reports BI_UNAVAILABLE; no credential or driver details are exposed. */ }
    }
  }
  async read<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!this.enabled) throw new UnavailableError('Business intelligence is disabled', 'BI_DISABLED');
    if (!this.client) throw new UnavailableError('Business intelligence is unavailable', 'BI_UNAVAILABLE');
    try {
      return await this.client.$transaction(async tx => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
        await tx.$executeRaw`SET LOCAL transaction_timeout = '10s'`;
        return work(tx);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: 10000, maxWait: 1000 });
    } catch { throw new UnavailableError('Business intelligence is unavailable', 'BI_UNAVAILABLE'); }
  }
  async onModuleDestroy(): Promise<void> { await this.client?.$disconnect(); }
}
