import { Inject, Injectable } from '@nestjs/common';
import type { Prisma, BillingPlanVersion } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { ApplicationError } from '../../../common/errors/application.error';
import {
  BILLING_CONFIG,
  type BillingConfig,
} from '../integrations/billing.config';
import { termsPeriod } from '../domain/terms-period';
import {
  evaluateAccess,
  hasFeature,
  assertQuota,
} from '../domain/access-policy';
import { BillingRuleError } from '../domain/billing.types';
import type {
  BillingFeature,
  BillingQuota,
  PlanFeatures,
} from '../domain/billing.types';
import {
  billingConflict,
  billingTransaction,
  lockBillingAccount,
} from './billing-transaction';

export function commercialFeatures(v: BillingPlanVersion): PlanFeatures {
  return {
    media: v.media,
    analytics: v.analytics,
    scoring: v.scoring,
    business_intelligence: v.businessIntelligence,
    bi_statistics: v.biStatistics,
    api_keys: v.apiKeys,
    webhooks: v.webhooks,
  };
}
export function commercialQuotas(v: BillingPlanVersion | null) {
  return {
    active_users: v?.activeUsers == null ? null : Number(v.activeUsers),
    stored_testimonials:
      v?.storedTestimonials == null ? null : Number(v.storedTestimonials),
    active_api_keys: v?.activeApiKeys == null ? null : Number(v.activeApiKeys),
    active_webhooks:
      v?.activeWebhooks == null ? null : Number(v.activeWebhooks),
  };
}
export interface CommercialMutation {
  feature?: BillingFeature;
  quota?: BillingQuota;
  increase?: number | ((tx: Prisma.TransactionClient) => Promise<number>);
}
@Injectable()
export class BillingAccessRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(BILLING_CONFIG) readonly config: BillingConfig,
  ) {}
  get enabled() {
    return this.config.mode !== 'disabled';
  }
  async snapshot(tenantId: string, tx: Prisma.TransactionClient = this.prisma) {
    if (!this.enabled)
      return {
        enforcementEnabled: false,
        trialConsumed: false,
        revision: 0,
        version: null,
        periods: [],
        access: evaluateAccess({
          enabled: false,
          now: new Date(),
          graceDays: 0,
          periods: [],
        }),
      };
    const account = await tx.billingAccount.findUnique({ where: { tenantId } });
    const now = new Date();
    const periods = await tx.billingAccessPeriod.findMany({
      where: { tenantId, environment: 'sandbox', startsAt: { lte: now } },
      orderBy: [{ endsAt: 'desc' }, { id: 'desc' }],
    });
    const current = termsPeriod(periods, now);
    const version = current
      ? await tx.billingPlanVersion.findUnique({
          where: { id: current.planVersionId },
        })
      : null;
    const access = evaluateAccess({
      enabled: account?.enforcementEnabled ?? false,
      now,
      graceDays: version?.graceDays ?? 0,
      periods: periods.map((p) => ({
        kind: p.kind === 'paid' ? 'paid' : 'trial',
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        revoked: !!p.revokedAt,
      })),
    });
    return {
      enforcementEnabled: account?.enforcementEnabled ?? false,
      trialConsumed: !!account?.trialConsumedAt,
      revision: Number(account?.policyRevision ?? 0n),
      version,
      periods,
      access,
    };
  }
  async usage(tenantId: string, tx: Prisma.TransactionClient = this.prisma) {
    const now = new Date();
    const [users, testimonials, keys, webhooks] = await Promise.all([
      tx.user.count({ where: { tenantId, isActive: true } }),
      tx.testimonial.count({ where: { tenantId } }),
      tx.apiKey.count({
        where: {
          tenantId,
          isActive: true,
          status: 'ACTIVE',
          revokedAt: null,
          OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        },
      }),
      tx.webhook.count({
        where: { tenantId, isActive: true, deletedAt: null },
      }),
    ]);
    return {
      active_users: users,
      stored_testimonials: testimonials,
      active_api_keys: keys,
      active_webhooks: webhooks,
    };
  }
  async canFeature(
    tenantId: string,
    feature: BillingFeature,
    tx: Prisma.TransactionClient = this.prisma,
  ) {
    const s = await this.snapshot(tenantId, tx);
    return (
      !s.enforcementEnabled ||
      (s.access.canMutate &&
        hasFeature({
          enforcementEnabled: true,
          feature,
          features: s.version ? commercialFeatures(s.version) : null,
          authorized: true,
          technicalEnabled: true,
        }))
    );
  }
  // Background publishers skip withdrawn features rather than rejecting an HTTP request.
  // Keep the policy check and publication under the same commercial tenant lock.
  async canFeatureForUpdate(
    tenantId: string,
    feature: BillingFeature,
    tx: Prisma.TransactionClient,
  ): Promise<boolean> {
    if (!this.enabled) return true;
    await lockBillingAccount(tx, tenantId);
    return this.canFeature(tenantId, feature, tx);
  }
  async requireWrite(tenantId: string, feature?: BillingFeature) {
    const s = await this.snapshot(tenantId);
    this.assert(s, feature);
  }
  private assert(
    s: Awaited<ReturnType<BillingAccessRepository['snapshot']>>,
    feature?: BillingFeature,
  ) {
    if (!s.access.canMutate)
      throw new ApplicationError(
        'Tu acceso es de consulta. Revisá Facturación para renovarlo.',
        'forbidden',
        'BILLING_ACCESS_REQUIRED',
      );
    if (
      feature &&
      !hasFeature({
        enforcementEnabled: s.enforcementEnabled,
        feature,
        features: s.version ? commercialFeatures(s.version) : null,
        authorized: true,
        technicalEnabled: true,
      })
    )
      throw new ApplicationError(
        'La función no está incluida en el plan.',
        'forbidden',
        'BILLING_FEATURE_REQUIRED',
      );
  }
  async checkMutation(
    tenantId: string,
    tx: Prisma.TransactionClient,
    options: CommercialMutation = {},
  ) {
    if (!this.enabled) return;
    await lockBillingAccount(tx, tenantId);
    const s = await this.snapshot(tenantId, tx);
    this.assert(s, options.feature);
    if (s.enforcementEnabled && options.quota) {
      const usage = await this.usage(tenantId, tx);
      const limits = commercialQuotas(s.version);
      const increase =
        typeof options.increase === 'function'
          ? await options.increase(tx)
          : (options.increase ?? 1);
      try {
        assertQuota(usage[options.quota], limits[options.quota], increase);
      } catch (error) {
        if (error instanceof BillingRuleError)
          throw billingConflict(error.code);
        throw error;
      }
    }
  }
  async mutate<T>(
    tenantId: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
    options: CommercialMutation = {},
    transaction?: Prisma.TransactionClient,
  ): Promise<T> {
    if (!this.enabled) return work(transaction ?? this.prisma);
    return billingTransaction(
      this.prisma,
      async (tx) => {
        await this.checkMutation(tenantId, tx, options);
        return work(tx);
      },
      transaction,
    );
  }
}
