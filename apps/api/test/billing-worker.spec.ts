import { randomUUID } from 'node:crypto';
import { runBillingWorker } from '../src/modules/billing/worker.cli';
describe('explicit bounded financial worker CLI', () => {
  test('rejects unknown args, missing consent and non-UUID actor before any database connection', async () => {
    for (const args of [
      [],
      ['--once', randomUUID()],
      ['--once', 'not-a-uuid', '--apply'],
      ['--once', randomUUID(), '--apply', 'extra'],
    ])
      await expect(runBillingWorker(args, {})).rejects.toThrow();
  });
  test('requires an enabled billing mode and a dedicated external DSN', async () => {
    await expect(
      runBillingWorker(['--once', randomUUID(), '--apply'], {}),
    ).rejects.toThrow('BILLING_WORKER_CONFIGURATION_REQUIRED');
    await expect(
      runBillingWorker(['--once', randomUUID(), '--apply'], {
        BILLING_MODE: 'simulation',
        BILLING_CONFIG_JSON: JSON.stringify({
          returnUrl: 'http://localhost/return',
          simulationKey: 'synthetic-only-test-key-at-least-32',
        }),
      }),
    ).rejects.toThrow('BILLING_WORKER_CONFIGURATION_REQUIRED');
  });
});
