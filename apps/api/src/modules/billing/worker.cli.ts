import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { PrismaService } from '../database/prisma.service';
import { readBillingConfig } from './integrations/billing.config';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';
import { BillingSettlementRepository } from './repositories/billing-settlement.repository';
import { BillingLedgerRepository } from './repositories/billing-ledger.repository';
import { BillingGateways } from './services/billing-gateways.service';
import { BillingProcessor } from './services/billing-processor.service';

/** One bounded durable tick; never a second recurring debit engine. */
export async function runBillingWorker(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const [, actorId] = z
    .tuple([z.literal('--once'), z.uuid(), z.literal('--apply')])
    .parse(args);
  const config = readBillingConfig(env);
  if (config.mode === 'disabled' || !env.BILLING_WORKER_DATABASE_URL)
    throw Error('BILLING_WORKER_CONFIGURATION_REQUIRED');
  const db = new PrismaClient({
    datasources: { db: { url: env.BILLING_WORKER_DATABASE_URL } },
  });
  try {
    const prisma = db as unknown as PrismaService;
    if (!(await new BillingOperatorRepository(prisma).isOperator(actorId)))
      throw Error('BILLING_OPERATOR_REQUIRED');
    const ledger = new BillingLedgerRepository(
      prisma,
      new BillingSettlementRepository(prisma),
    );
    const gateways = new BillingGateways(config, ledger);
    const ids =
      config.mode === 'simulation'
        ? await ledger.simulationAccountIds()
        : gateways.accountIds();
    await new BillingProcessor(ledger, gateways).tick(ids);
    return { accepted: true, accounts: ids.length };
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) {
  void runBillingWorker(process.argv.slice(2))
    .then((result) => process.stdout.write(JSON.stringify(result) + '\n'))
    .catch(() => {
      process.stderr.write('BILLING_WORKER_CLI_FAILED\n');
      process.exitCode = 1;
    });
}
