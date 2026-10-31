import { Prisma } from '@prisma/client';
import { ApplicationError } from '../../../common/errors/application.error';
import { PrismaService } from '../../database/prisma.service';
import { BillingRuleError } from '../domain/billing.types';

export const billingConflict = (code: string) =>
  new ApplicationError(code, 'conflict', code);

export async function billingTransaction<T>(
  prisma: PrismaService,
  work: (tx: Prisma.TransactionClient) => Promise<T>,
  transaction?: Prisma.TransactionClient,
): Promise<T> {
  try {
    if (transaction) return await work(transaction);
    return await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL lock_timeout = '3s'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
        return work(tx);
      },
      { maxWait: 5000, timeout: 10000 },
    );
  } catch (error) {
    if (error instanceof BillingRuleError) throw billingConflict(error.code);
    throw error;
  }
}

// All lifecycle/quota writers take the tenant lock before obligation/resource locks.
export async function lockBillingAccount(
  tx: Prisma.TransactionClient,
  tenantId: string,
) {
  // Prisma 6.5 can emulate an empty-update upsert with a read then insert.
  // Native ON CONFLICT must establish the row before concurrent first purchases.
  await tx.$executeRaw`INSERT INTO billing_accounts (tenant_id) VALUES (${tenantId}::uuid) ON CONFLICT (tenant_id) DO NOTHING`;
  await tx.$executeRaw`SELECT tenant_id FROM billing_accounts WHERE tenant_id = ${tenantId}::uuid FOR UPDATE`;
  return tx.billingAccount.findUniqueOrThrow({ where: { tenantId } });
}
