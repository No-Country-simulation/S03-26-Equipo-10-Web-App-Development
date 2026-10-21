import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  assertQuota,
  evaluateAccess,
  startTrial,
} from '../domain/access-policy';
import type { BillingEnvironment, BillingQuota } from '../domain/billing.types';
import { assertBillingOperator } from './billing-operator.repository';
import {
  billingConflict,
  billingTransaction,
  lockBillingAccount,
} from './billing-transaction';

@Injectable()
export class BillingTenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async setPolicy(
    actorId: string,
    tenantId: string,
    expectedRevision: bigint,
    enabled: boolean,
  ) {
    return billingTransaction(this.prisma, async (tx) => {
      await assertBillingOperator(tx, actorId);
      const account = await lockBillingAccount(tx, tenantId);
      if (account.policyRevision !== expectedRevision)
        throw billingConflict('BILLING_POLICY_CONFLICT');
      const updated = await tx.billingAccount.update({
        where: { tenantId },
        data: { enforcementEnabled: enabled, policyRevision: { increment: 1 } },
      });
      await tx.billingAudit.create({
        data: {
          actorId,
          tenantId,
          action: 'policy.changed',
          entityId: tenantId,
          correlationId: randomUUID(),
          previousState: account.enforcementEnabled ? 'enabled' : 'disabled',
          nextState: enabled ? 'enabled' : 'disabled',
        },
      });
      return updated;
    });
  }

  async startTrial(
    tenantId: string,
    environment: BillingEnvironment,
    planVersionId: string,
    now = new Date(),
    transaction?: Prisma.TransactionClient,
  ) {
    return billingTransaction(
      this.prisma,
      async (tx) => {
        const account = await lockBillingAccount(tx, tenantId);
        const version = await tx.billingPlanVersion.findFirst({
          where: { id: planVersionId, status: 'published' },
        });
        if (!version) throw billingConflict('BILLING_PLAN_UNAVAILABLE');
        const paid = await tx.billingAccessPeriod.count({
          where: {
            tenantId,
            environment,
            kind: 'paid',
            revokedAt: null,
            endsAt: { gt: now },
          },
        });
        const period = startTrial({
          now,
          days: version.trialDays,
          alreadyConsumed: account.trialConsumedAt !== null,
          hasPaidCoverage: paid > 0,
        });
        const result = await tx.billingAccessPeriod.create({
          data: {
            tenantId,
            environment,
            planVersionId,
            kind: 'trial',
            startsAt: period.startsAt,
            endsAt: period.endsAt,
          },
        });
        await tx.billingAccount.update({
          where: { tenantId },
          data: { trialConsumedAt: now },
        });
        await tx.billingAudit.create({
          data: {
            tenantId,
            environment,
            action: 'trial.started',
            entityId: result.id,
            correlationId: randomUUID(),
            nextState: 'trial',
          },
        });
        return result;
      },
      transaction,
    );
  }

  // Phase 4 will call this from each creation/reactivation/rotation path. No
  // arbitrary callback comes from HTTP; it must perform only local DB work.
  async withQuota<T>(
    tenantId: string,
    environment: BillingEnvironment,
    quota: BillingQuota,
    increase: number,
    mutate: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return billingTransaction(this.prisma, async (tx) => {
      const account = await lockBillingAccount(tx, tenantId);
      if (account.enforcementEnabled) {
        const now = new Date();
        const periods = await tx.billingAccessPeriod.findMany({
          where: { tenantId, environment, startsAt: { lte: now } },
          orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
        });
        const current =
          periods.find(
            (p) => p.revokedAt === null && p.endsAt > now && p.kind === 'paid',
          ) ??
          periods.find((p) => p.revokedAt === null && p.endsAt > now) ??
          periods.find((p) => p.kind === 'paid') ??
          periods[0];
        const version = current
          ? await tx.billingPlanVersion.findUnique({
              where: { id: current.planVersionId },
            })
          : null;
        const access = evaluateAccess({
          enabled: true,
          now,
          graceDays: version?.graceDays ?? 0,
          periods: periods.map((p) => ({
            startsAt: p.startsAt,
            endsAt: p.endsAt,
            kind: p.kind === 'paid' ? 'paid' : 'trial',
            revoked: p.revokedAt !== null,
          })),
        });
        if (!access.canMutate || !version)
          throw billingConflict('BILLING_ACCESS_REQUIRED');
        let used: number;
        let limit: bigint | null;
        switch (quota) {
          case 'active_users':
            used = await tx.user.count({ where: { tenantId, isActive: true } });
            limit = version.activeUsers;
            break;
          case 'stored_testimonials':
            used = await tx.testimonial.count({ where: { tenantId } });
            limit = version.storedTestimonials;
            break;
          case 'active_webhooks':
            used = await tx.webhook.count({
              where: { tenantId, isActive: true },
            });
            limit = version.activeWebhooks;
            break;
          case 'active_api_keys':
            used = await tx.apiKey.count({
              where: {
                tenantId,
                isActive: true,
                status: 'ACTIVE',
                revokedAt: null,
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
              },
            });
            limit = version.activeApiKeys;
            break;
        }
        assertQuota(used, limit === null ? null : Number(limit), increase);
      }
      return mutate(tx);
    });
  }
}
