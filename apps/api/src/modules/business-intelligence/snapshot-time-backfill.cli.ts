import { ConsoleLogger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseUrl } from './etl.config';
import { EtlError } from './etl.types';
import { SnapshotTimeBackfillRepository } from './repositories/snapshot-time-backfill.repository';
import { SnapshotTimeValidationError } from './repositories/snapshot-time-validation';

export function backfillMode(args: string[]): 'check' | 'apply' {
  if (args.length === 1 && args[0] === '--check') return 'check';
  if (args.length === 2 && new Set(args).size === 2 && args.includes('--apply') && args.includes('--maintenance')) return 'apply';
  throw new EtlError('BI_CONFIGURATION_INVALID');
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const mode = backfillMode(args);
  // --maintenance records the operator's instruction to stop workers; database checks also enforce quiescence.
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl(process.env.BI_MIGRATION_DATABASE_URL, 1) } }, log: [] });
  const logger = new ConsoleLogger('SnapshotTimeBackfill', { json: true });
  const controller = new AbortController(); const shutdown = () => controller.abort();
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
  try {
    const repository = new SnapshotTimeBackfillRepository(client);
    const state = mode === 'check' ? await repository.check() : await repository.apply({ signal: controller.signal,
      afterBatch: batch => logger.log({ event: 'bi.snapshot_time_batch', kind: batch.kind, changed: batch.changed.toString() }) });
    logger.log({ event: 'bi.snapshot_time_checked', mode, pendingRuns: state.pendingRuns.toString(),
      pendingRows: state.pendingRows.toString(), successfulRuns: state.successfulRuns.toString() });
    if (mode === 'check' && (state.pendingRows > 0n || state.pendingRuns > 0n)) throw new EtlError('BI_BACKFILL_REQUIRED');
  } finally {
    process.off('SIGINT', shutdown); process.off('SIGTERM', shutdown); await client.$disconnect();
  }
}
if (require.main === module) {
  void main().catch(error => {
    new ConsoleLogger('SnapshotTimeBackfill', { json: true }).error({ event: 'bi.snapshot_time_failed',
      code: error instanceof EtlError ? error.code : 'BI_ETL_FAILED',
      ...(error instanceof SnapshotTimeValidationError ? { tenantId: error.tenantId } : {}) });
    process.exitCode = 1;
  });
}
