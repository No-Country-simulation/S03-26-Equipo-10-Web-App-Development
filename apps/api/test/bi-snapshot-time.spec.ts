import { migrationTarget, selectMigrations } from '../src/modules/business-intelligence/migration.cli';
import { backfillMode, main as backfill } from '../src/modules/business-intelligence/snapshot-time-backfill.cli';
import { SnapshotTimeBackfillRepository } from '../src/modules/business-intelligence/repositories/snapshot-time-backfill.repository';
import type { PrismaClient } from '@prisma/client';

describe('snapshot time maintenance entry points', () => {
  it('selects a known migration boundary and rejects arbitrary or unknown paths', () => {
    const files = ['0003_snapshot_time_constraints.sql', 'ignored.md', '0001_initial.sql', '0002_snapshot_time_expand.sql'];
    expect(selectMigrations(files, migrationTarget(['--apply', '--to', '0002_snapshot_time_expand.sql'])))
      .toEqual(['0001_initial.sql', '0002_snapshot_time_expand.sql']);
    expect(selectMigrations(files, migrationTarget(['--apply']))).toHaveLength(3);
    for (const args of [[], ['--to', '0002_snapshot_time_expand.sql'], ['--apply', '--to', '../0002_snapshot_time_expand.sql'], ['--apply', '--to', '0002_x.sql', '--force']]) {
      expect(() => migrationTarget(args)).toThrow('BI_CONFIGURATION_INVALID');
    }
    expect(() => selectMigrations(files, '9999_missing.sql')).toThrow('BI_MIGRATION_INVALID');
  });
  it('requires an explicit maintenance acknowledgement for writes before constructing a client', async () => {
    expect(backfillMode(['--check'])).toBe('check');
    expect(backfillMode(['--apply', '--maintenance'])).toBe('apply');
    for (const args of [[], ['--apply'], ['--check', '--maintenance'], ['--apply', '--apply'], ['--apply', '--maintenance', '--force']]) {
      await expect(backfill(args)).rejects.toMatchObject({ code: 'BI_CONFIGURATION_INVALID' });
    }
  });
  it('bounds memory batches and cancels before any database access', async () => {
    const client = {} as PrismaClient;
    expect(() => new SnapshotTimeBackfillRepository(client, 1001)).toThrow();
    expect(() => new SnapshotTimeBackfillRepository(client, 0)).toThrow();
    const controller = new AbortController(); controller.abort();
    await expect(new SnapshotTimeBackfillRepository(client).apply({ signal: controller.signal }))
      .rejects.toMatchObject({ code: 'BI_BACKFILL_INTERRUPTED' });
  });
});
