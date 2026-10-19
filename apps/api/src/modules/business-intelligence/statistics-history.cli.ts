import { ConsoleLogger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseUrl } from './etl.config';
import { EtlError } from './etl.types';
import { backfillMode } from './snapshot-time-backfill.cli';
import { StatisticsHistoryRepository } from './repositories/statistics-history.repository';

export async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = backfillMode(args);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl(process.env.BI_MIGRATION_DATABASE_URL, 1) } }, log: [] });
  const logger = new ConsoleLogger('StatisticsHistory');
  const controller = new AbortController(); const shutdown = () => controller.abort();
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  try {
    const repository = new StatisticsHistoryRepository(client);
    const state = mode === 'check' ? await repository.check() : await repository.apply({ signal: controller.signal,
      afterBatch: changed => logger.log({ event: 'bi.statistics_history_batch', changed: changed.toString() }) });
    logger.log({ event: 'bi.statistics_history_checked', mode, tenants: state.tenants.toString(),
      pendingTenants: state.pendingTenants.toString(), missingCreations: state.missingCreations.toString() });
    if (state.pendingTenants > 0n || state.missingCreations > 0n) throw new EtlError('BI_BACKFILL_REQUIRED');
  } finally {
    process.off('SIGINT', shutdown); process.off('SIGTERM', shutdown); await client.$disconnect();
  }
}
if (require.main === module) {
  void main().catch(error => {
    new ConsoleLogger('StatisticsHistory').error({ event: 'bi.statistics_history_failed',
      code: error instanceof EtlError ? error.code : 'BI_ETL_FAILED' });
    process.exitCode = 1;
  });
}
