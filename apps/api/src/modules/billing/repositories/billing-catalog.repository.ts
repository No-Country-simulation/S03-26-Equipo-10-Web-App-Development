import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  planVersionDraftSchema,
  type PlanVersionDraft,
} from '../contracts/billing.schemas';
import { assertBillingOperator } from './billing-operator.repository';
import { billingConflict, billingTransaction } from './billing-transaction';

function versionData(draft: PlanVersionDraft) {
  return {
    name: draft.name,
    description: draft.description,
    trialDays: draft.trialDays,
    graceDays: draft.graceDays,
    media: draft.features.media,
    analytics: draft.features.analytics,
    scoring: draft.features.scoring,
    businessIntelligence: draft.features.business_intelligence,
    biStatistics: draft.features.bi_statistics,
    apiKeys: draft.features.api_keys,
    webhooks: draft.features.webhooks,
    activeUsers:
      draft.quotas.active_users === null
        ? null
        : BigInt(draft.quotas.active_users),
    storedTestimonials:
      draft.quotas.stored_testimonials === null
        ? null
        : BigInt(draft.quotas.stored_testimonials),
    activeApiKeys:
      draft.quotas.active_api_keys === null
        ? null
        : BigInt(draft.quotas.active_api_keys),
    activeWebhooks:
      draft.quotas.active_webhooks === null
        ? null
        : BigInt(draft.quotas.active_webhooks),
  };
}
function pricesData(draft: PlanVersionDraft, planVersionId: string) {
  return draft.prices.map((price) => ({
    planVersionId,
    provider: price.provider,
    currency: price.currency,
    interval: price.interval,
    amountMinor: BigInt(price.amountMinor),
    manualEnabled: price.modes.includes('manual'),
    automaticEnabled: price.modes.includes('automatic'),
  }));
}

@Injectable()
export class BillingCatalogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createPlan(
    actorId: string,
    code: string,
    transaction?: Prisma.TransactionClient,
  ) {
    if (!/^[a-z][a-z0-9_-]{0,63}$/.test(code))
      throw billingConflict('BILLING_PLAN_CODE_INVALID');
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const plan = await tx.billingPlan.create({ data: { code } });
      await tx.billingAudit.create({
        data: {
          actorId,
          action: 'plan.created',
          entityId: plan.id,
          correlationId: randomUUID(),
          nextState: 'draft',
        },
      });
      return plan;
    };
    return billingTransaction(this.prisma, work, transaction);
  }

  async createVersion(
    actorId: string,
    planId: string,
    input: PlanVersionDraft,
    transaction?: Prisma.TransactionClient,
  ) {
    const draft = planVersionDraftSchema.parse(input);
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      await tx.$executeRaw`SELECT id FROM billing_plans WHERE id = ${planId}::uuid FOR UPDATE`;
      const plan = await tx.billingPlan.findUnique({ where: { id: planId } });
      if (!plan || plan.archivedAt)
        throw billingConflict('BILLING_PLAN_UNAVAILABLE');
      const latest = await tx.billingPlanVersion.aggregate({
        where: { planId },
        _max: { version: true },
      });
      const version = await tx.billingPlanVersion.create({
        data: {
          planId,
          version: (latest._max.version ?? 0) + 1,
          ...versionData(draft),
        },
      });
      await tx.billingPrice.createMany({ data: pricesData(draft, version.id) });
      await tx.billingAudit.create({
        data: {
          actorId,
          action: 'version.created',
          entityId: version.id,
          correlationId: randomUUID(),
          nextState: 'draft',
        },
      });
      return version;
    };
    return billingTransaction(this.prisma, work, transaction);
  }

  async editDraft(
    actorId: string,
    versionId: string,
    expectedRevision: bigint,
    input: PlanVersionDraft,
    transaction?: Prisma.TransactionClient,
  ) {
    const draft = planVersionDraftSchema.parse(input);
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const updated = await tx.billingPlanVersion.updateMany({
        where: { id: versionId, status: 'draft', revision: expectedRevision },
        data: { ...versionData(draft), revision: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw billingConflict('BILLING_VERSION_CONFLICT');
      await tx.billingPrice.deleteMany({ where: { planVersionId: versionId } });
      await tx.billingPrice.createMany({ data: pricesData(draft, versionId) });
      await tx.billingAudit.create({
        data: {
          actorId,
          action: 'version.edited',
          entityId: versionId,
          correlationId: randomUUID(),
          previousState: 'draft',
          nextState: 'draft',
        },
      });
      return tx.billingPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
      });
    };
    return billingTransaction(this.prisma, work, transaction);
  }

  async publish(
    actorId: string,
    versionId: string,
    expectedRevision: bigint,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const prices = await tx.billingPrice.count({
        where: { planVersionId: versionId },
      });
      if (!prices) throw billingConflict('BILLING_PRICE_REQUIRED');
      const result = await tx.billingPlanVersion.updateMany({
        where: { id: versionId, status: 'draft', revision: expectedRevision },
        data: {
          status: 'published',
          publishedAt: new Date(),
          revision: { increment: 1 },
        },
      });
      if (result.count !== 1) throw billingConflict('BILLING_VERSION_CONFLICT');
      await tx.billingAudit.create({
        data: {
          actorId,
          action: 'version.published',
          entityId: versionId,
          correlationId: randomUUID(),
          previousState: 'draft',
          nextState: 'published',
        },
      });
      return tx.billingPlanVersion.findUniqueOrThrow({
        where: { id: versionId },
      });
    };
    return billingTransaction(this.prisma, work, transaction);
  }

  async archive(
    actorId: string,
    versionId: string,
    expectedRevision: bigint,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const result = await tx.billingPlanVersion.updateMany({
        where: {
          id: versionId,
          status: 'published',
          revision: expectedRevision,
        },
        data: { status: 'archived', revision: { increment: 1 } },
      });
      if (result.count !== 1) throw billingConflict('BILLING_VERSION_CONFLICT');
      await tx.billingAudit.create({
        data: {
          actorId,
          action: 'version.archived',
          entityId: versionId,
          correlationId: randomUUID(),
          previousState: 'published',
          nextState: 'archived',
        },
      });
    };
    return billingTransaction(this.prisma, work, transaction);
  }
}
