import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { ApplicationError } from '../../../common/errors/application.error';
import { PrismaService } from '../../database/prisma.service';
import { billingConflict, billingTransaction } from './billing-transaction';

export async function assertBillingOperator(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  // CLI grants/revocations take FOR UPDATE on this same user row. This
  // shared lock serializes membership changes without write privileges on
  // billing_platform_operators (locking that table would require UPDATE).
  await tx.$executeRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR KEY SHARE`;
  const rows = await tx.$queryRaw<Array<{ id: string }>>`
    SELECT o.user_id AS id FROM billing_platform_operators o
    JOIN users u ON u.id = o.user_id JOIN tenants t ON t.id = u.tenant_id
    WHERE o.user_id = ${userId}::uuid AND o.revoked_at IS NULL AND u.is_active AND t.is_active`;
  if (rows.length !== 1)
    throw new ApplicationError(
      'BILLING_OPERATOR_REQUIRED',
      'forbidden',
      'BILLING_OPERATOR_REQUIRED',
    );
}

@Injectable()
export class BillingOperatorRepository {
  constructor(private readonly prisma: PrismaService) {}

  async isOperator(userId: string): Promise<boolean> {
    const rows = await this.prisma.$queryRaw<Array<{ allowed: boolean }>>`
      SELECT EXISTS(SELECT 1 FROM billing_platform_operators o
      JOIN users u ON u.id = o.user_id JOIN tenants t ON t.id = u.tenant_id
      WHERE o.user_id = ${userId}::uuid AND o.revoked_at IS NULL AND u.is_active AND t.is_active) AS allowed`;
    return rows[0]?.allowed === true;
  }

  // Manual CLI authority only. Never expose this method through a tenant API.
  async setMembership(userId: string, grant: boolean): Promise<void> {
    await billingTransaction(this.prisma, async (tx) => {
      const users = await tx.$queryRaw<Array<{ active: boolean }>>`
        SELECT (u.is_active AND t.is_active) AS active FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE u.id = ${userId}::uuid FOR UPDATE OF u`;
      if (!users.length || (grant && !users[0]!.active))
        throw billingConflict('BILLING_OPERATOR_TARGET_INVALID');
      const existing = await tx.billingPlatformOperator.findUnique({
        where: { userId },
      });
      if (existing && (existing.revokedAt === null) === grant) return;
      if (!existing && !grant) return;
      const now = new Date();
      await tx.billingPlatformOperator.upsert({
        where: { userId },
        create: { userId, grantedAt: now },
        update: grant
          ? { grantedAt: now, revokedAt: null }
          : { revokedAt: now },
      });
      await tx.billingAudit.create({
        data: {
          action: grant ? 'operator.granted' : 'operator.revoked',
          entityId: userId,
          correlationId: randomUUID(),
          previousState: existing?.revokedAt === null ? 'granted' : 'revoked',
          nextState: grant ? 'granted' : 'revoked',
        },
      });
    });
  }
}
