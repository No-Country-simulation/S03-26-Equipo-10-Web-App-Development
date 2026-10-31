import { createHash } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { PrismaService } from '../database/prisma.service';
import { readBillingConfig } from './integrations/billing.config';
import { SimulationGateway } from './integrations/simulation.gateway';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';
import { BillingSettlementRepository } from './repositories/billing-settlement.repository';
import { BillingLedgerRepository } from './repositories/billing-ledger.repository';
import { BillingGateways } from './services/billing-gateways.service';
import { BillingProcessor } from './services/billing-processor.service';

export async function runSimulation(
  args: string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const [actorId, operationId, scenario, at, cycle] = z
    .tuple([
      z.uuid(),
      z.uuid(),
      z.enum([
        'pending',
        'approved',
        'rejected',
        'partial_refund',
        'full_refund',
        'chargeback',
      ]),
      z.iso.datetime(),
      z.string().regex(/^[a-zA-Z0-9_-]{1,50}$/),
      z.literal('--apply'),
    ])
    .parse(args);
  const config = readBillingConfig(env);
  if (config.mode !== 'simulation' || !env.BILLING_SIMULATION_DATABASE_URL)
    throw Error('BILLING_SIMULATION_REQUIRED');
  const db = new PrismaClient({
    datasources: { db: { url: env.BILLING_SIMULATION_DATABASE_URL } },
  });
  try {
    const prisma = db as unknown as PrismaService;
    if (!(await new BillingOperatorRepository(prisma).isOperator(actorId)))
      throw Error('BILLING_OPERATOR_REQUIRED');
    const ledger = new BillingLedgerRepository(
      prisma,
      new BillingSettlementRepository(prisma),
    );
    const row = await ledger.operatorOperation(actorId, operationId);
    if (row.kind !== 'checkout') throw Error('BILLING_CHECKOUT_REQUIRED');
    const gateways = new BillingGateways(config, ledger);
    const gateway = await gateways.get(row.providerAccountId);
    if (!(gateway instanceof SimulationGateway))
      throw Error('BILLING_SIMULATION_REQUIRED');
    const command = await ledger.command({
      kind: 'operation',
      row,
      recovering: true,
    });
    const resourceId = gateway.observation(
      command,
      scenario,
      new Date(at),
      cycle,
    );
    await ledger.receive(row.providerAccountId, 'sandbox', {
      topic: 'simulation',
      resourceId,
      eventKey: createHash('sha256').update(resourceId).digest('hex'),
    });
    await new BillingProcessor(ledger, gateways).tick([row.providerAccountId]);
    // Only stable IDs/counts, no checkout URL or signature token.
    return { operationId: row.id, scenario, accepted: true };
  } finally {
    await db.$disconnect();
  }
}
if (require.main === module) {
  void runSimulation(process.argv.slice(2))
    .then((result) => {
      process.stdout.write(JSON.stringify(result) + '\n');
    })
    .catch(() => {
      process.stderr.write('BILLING_SIMULATION_FAILED\n');
      process.exitCode = 1;
    });
}
