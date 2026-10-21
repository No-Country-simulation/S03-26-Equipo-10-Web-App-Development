import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { PrismaService } from '../database/prisma.service';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';

export async function runOperatorCommand(
  args: string[],
  databaseUrl: string | undefined,
): Promise<void> {
  const [command, rawUserId, apply] = args;
  const userId = z.uuid().parse(rawUserId);
  if (
    !databaseUrl ||
    args.length !== (command === 'check' ? 2 : 3) ||
    !['grant', 'revoke', 'check'].includes(command ?? '') ||
    (command === 'check' ? apply !== undefined : apply !== '--apply')
  )
    throw new Error('BILLING_OPERATOR_CLI_INPUT_INVALID');
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl } },
  });
  try {
    const repository = new BillingOperatorRepository(
      prisma as unknown as PrismaService,
    );
    if (command !== 'check')
      await repository.setMembership(userId, command === 'grant');
    process.stdout.write(
      JSON.stringify({ allowed: await repository.isOperator(userId) }) + '\n',
    );
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void runOperatorCommand(
    process.argv.slice(2),
    process.env.BILLING_OPERATOR_DATABASE_URL,
  ).catch(() => {
    process.stderr.write('BILLING_OPERATOR_CLI_FAILED\n');
    process.exitCode = 1;
  });
}
