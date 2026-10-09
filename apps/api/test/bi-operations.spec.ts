import { BiControlConnection } from '../src/modules/business-intelligence/repositories/bi-control-connection';
import { idempotencyKeySchema, loadRequestInputSchema, nextScheduledAt, settingsPatchSchema } from '../src/modules/business-intelligence/operations.types';
import { restoreEnvironment } from './fixtures/bi-control-environment';

describe('BI operation contracts', () => {
  it('rejects unknown fields, empty changes and unsupported cadence or tolerance', () => {
    for (const value of [{ expectedVersion: 0 }, { expectedVersion: 0, frequencyHours: 2 },
      { expectedVersion: 0, delayToleranceMinutes: 15 }, { expectedVersion: 0, scheduleEnabled: true, tenantId: 'foreign' }]) {
      expect(settingsPatchSchema.safeParse(value).success).toBe(false);
    }
    expect(settingsPatchSchema.parse({ expectedVersion: 0, frequencyHours: 24, scheduleEnabled: false })).toMatchObject({ frequencyHours: 24 });
  });
  it('requires explicit retry lineage and bounded safe idempotency keys', () => {
    expect(loadRequestInputSchema.safeParse({ kind: 'retry' }).success).toBe(false);
    expect(loadRequestInputSchema.safeParse({ kind: 'manual', retryOfRunId: '00000000-0000-4000-8000-000000000000' }).success).toBe(false);
    for (const value of ['', 'a'.repeat(129), 'key\n']) expect(idempotencyKeySchema.safeParse(value).success).toBe(false);
  });
  it('aligns future UTC slots across leap days and year boundaries', () => {
    expect(nextScheduledAt(new Date('2024-02-29T23:59:59.999Z'), 24).toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(nextScheduledAt(new Date('2024-12-31T23:00:00Z'), 6).toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(nextScheduledAt(new Date('2024-02-29T06:00:00Z'), 6).toISOString()).toBe('2024-02-29T12:00:00.000Z');
  });
  it('defaults management to disabled and keeps invalid control configuration outside API startup', async () => {
    const previous = { BI_ENABLED: process.env.BI_ENABLED, BI_OPERATIONS_ENABLED: process.env.BI_OPERATIONS_ENABLED, BI_CONTROL_DATABASE_URL: process.env.BI_CONTROL_DATABASE_URL };
    let connection: BiControlConnection | undefined;
    try {
      process.env.BI_ENABLED = 'true'; delete process.env.BI_OPERATIONS_ENABLED;
      connection = new BiControlConnection(); await expect(connection.write(async () => undefined)).rejects.toMatchObject({ code: 'BI_OPERATIONS_DISABLED' });
      await connection.onModuleDestroy(); process.env.BI_OPERATIONS_ENABLED = 'true'; process.env.BI_CONTROL_DATABASE_URL = 'invalid';
      connection = new BiControlConnection(); await expect(connection.write(async () => undefined)).rejects.toMatchObject({ code: 'BI_UNAVAILABLE' });
    } finally {
      await connection?.onModuleDestroy(); restoreEnvironment(previous);
    }
  });
});
