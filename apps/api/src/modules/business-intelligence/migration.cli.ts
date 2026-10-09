import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ConsoleLogger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { databaseUrl } from './etl.config';
import { EtlError } from './etl.types';
import { applyWarehouseMigration } from './repositories/warehouse-migrations';
import { SnapshotTimeValidationError } from './repositories/snapshot-time-validation';

export function migrationTarget(args: string[]): string | null {
  if (args.length === 1 && args[0] === '--apply') return null;
  if (args.length === 3 && args[0] === '--apply' && args[1] === '--to' && /^\d{4}_[a-z_]+\.sql$/.test(args[2] ?? '')) return args[2]!;
  throw new EtlError('BI_CONFIGURATION_INVALID');
}

export function selectMigrations(files: string[], target: string | null): string[] {
  const sorted = files.filter(file => /^\d{4}_[a-z_]+\.sql$/.test(file)).sort();
  if (!sorted.length || target !== null && !sorted.includes(target)) throw new EtlError('BI_MIGRATION_INVALID');
  return target === null ? sorted : sorted.slice(0, sorted.indexOf(target) + 1);
}

export async function main(args = process.argv.slice(2)): Promise<void> {
  const target = migrationTarget(args);
  const logger = new ConsoleLogger('BusinessIntelligenceMigrator', { json: true });
  const url = databaseUrl(process.env.BI_MIGRATION_DATABASE_URL, 1);
  const client = new PrismaClient({ datasources: { db: { url } }, log: [] });
  const directory = resolve(process.cwd(), 'warehouse/migrations');
  try {
    // Fixed repository directory, never a path supplied by an HTTP caller.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const files = selectMigrations(await readdir(directory), target);
    for (const file of files) {
      // Repository-owned fixed directory and validated basename, never a request path.
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const sql = await readFile(resolve(directory, file), 'utf8');
      const applied = await applyWarehouseMigration(client, file, sql);
      logger.log({ event: 'bi.migration_checked', version: file, applied });
    }
  } finally { await client.$disconnect(); }
}

if (require.main === module) {
  void main().catch(error => {
    new ConsoleLogger('BusinessIntelligenceMigrator', { json: true }).error({ event: 'bi.migration_failed',
      code: error instanceof EtlError ? error.code : 'BI_ETL_FAILED',
      ...(error instanceof SnapshotTimeValidationError ? { tenantId: error.tenantId } : {}) });
    process.exitCode = 1;
  });
}
