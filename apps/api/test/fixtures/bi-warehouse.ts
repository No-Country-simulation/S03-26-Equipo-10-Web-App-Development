import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { PrismaClient } from '@prisma/client';
import { applyWarehouseMigration } from '../../src/modules/business-intelligence/repositories/warehouse-migrations';

/** Fresh disposable fixtures only. Existing histories require the manual backfill between 0002/0003. */
export async function installBiWarehouse(client: PrismaClient): Promise<void> {
  for (const version of ['0001_initial.sql', '0002_snapshot_time_expand.sql', '0003_snapshot_time_constraints.sql']) {
    // Fixed repository basenames, no caller-supplied path.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const sql = await readFile(join(__dirname, '../../warehouse/migrations', version), 'utf8');
    await applyWarehouseMigration(client, version, sql);
  }
}
