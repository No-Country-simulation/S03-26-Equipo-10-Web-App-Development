import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { ApplicationError, UnavailableError } from '../../../common/errors/application.error';
import { databaseUrl } from '../etl.config';
import { BiOperationsError } from '../operations.types';

export interface ControlTransactions {
  write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T>;
}

/** Independent HTTP control identity; no OLTP fallback, analytical writes or DDL privileges. */
@Injectable()
export class BiControlConnection implements ControlTransactions, OnModuleDestroy {
  private readonly enabled = process.env.BI_ENABLED === 'true' && process.env.BI_OPERATIONS_ENABLED === 'true';
  private readonly client: PrismaClient | undefined;
  constructor() {
    if (this.enabled) {
      try { this.client = new PrismaClient({ datasources: { db: { url: databaseUrl(process.env.BI_CONTROL_DATABASE_URL, 2) } }, log: [] }); }
      catch { /* Report configuration failures at the BI boundary without credentials. */ }
    }
  }
  get configured(): boolean { return this.enabled && this.client !== undefined; }
  async write<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    if (!this.enabled) throw new BiOperationsError('BI_OPERATIONS_DISABLED');
    if (!this.client) throw new UnavailableError('Business intelligence is unavailable', 'BI_UNAVAILABLE');
    try {
      return await this.client.$transaction(async tx => {
        await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
        await tx.$executeRaw`SET LOCAL transaction_timeout = '10s'`;
        return work(tx);
      }, { maxWait: 1000, timeout: 10000 });
    } catch (error) {
      if (error instanceof ApplicationError) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010') {
        if (error.meta?.code === '55P03') throw new BiOperationsError('BI_OPERATION_BUSY');
        if (error.meta?.code === '23505') throw new BiOperationsError('BI_REQUEST_CONFLICT');
      }
      throw new UnavailableError('Business intelligence is unavailable', 'BI_UNAVAILABLE');
    }
  }
  async onModuleDestroy(): Promise<void> { await this.client?.$disconnect(); }
}
