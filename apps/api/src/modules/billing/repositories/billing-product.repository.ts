import { Inject, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../database/prisma.service';
import { ApplicationError } from '../../../common/errors/application.error';
import { IdempotencyRepository } from '../../../common/repositories/idempotency.repository';
import {
  BILLING_CONFIG,
  type BillingConfig,
} from '../integrations/billing.config';
import {
  BillingAccessRepository,
  commercialFeatures,
  commercialQuotas,
} from './billing-access.repository';
import { BillingTenantRepository } from './billing-tenant.repository';
import { BillingSettlementRepository } from './billing-settlement.repository';
import { BillingLedgerRepository } from './billing-ledger.repository';
import { assertBillingOperator } from './billing-operator.repository';
import {
  billingTransaction,
  lockBillingAccount,
  billingConflict,
} from './billing-transaction';
import type { CheckoutRequest } from '../contracts/billing.schemas';
type Wire<T> = T extends Date | bigint
  ? string
  : T extends readonly (infer U)[]
    ? Wire<U>[]
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;
export const billingWire = <T>(value: T): Wire<T> =>
  JSON.parse(
    JSON.stringify(value, (_k, v) =>
      typeof v === 'bigint' ? v.toString() : v,
    ),
  ) as Wire<T>;
type CatalogVersion = Prisma.BillingPlanVersionGetPayload<{
  include: { billingPrice: { include: { billingPriceBinding: true } } };
}>;
export interface BillingActor {
  userId: string;
  tenantId: string;
  roles: string[];
}
@Injectable()
export class BillingProductRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: BillingAccessRepository,
    private readonly tenant: BillingTenantRepository,
    private readonly settlements: BillingSettlementRepository,
    private readonly ledger: BillingLedgerRepository,
    private readonly receipts: IdempotencyRepository,
    @Inject(BILLING_CONFIG) readonly config: BillingConfig,
  ) {}
  requireEnabled() {
    if (this.config.mode === 'disabled')
      throw new ApplicationError(
        'La facturación todavía no está configurada.',
        'unavailable',
        'BILLING_DISABLED',
      );
  }
  async receipt(
    actor: BillingActor,
    key: string,
    path: string,
    payload: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    this.requireEnabled();
    const result = await this.receipts.execute(
      {
        key,
        tenantId: actor.tenantId,
        principalId: actor.userId,
        principalKind: 'user',
        method: 'POST',
        path,
        payload,
        statusCode:
          path === '/billing/trial' ||
          path === '/platform/billing/plans' ||
          /^\/platform\/billing\/plans\/[^/]+\/versions$/.test(path)
            ? 201
            : 202,
      },
      async (tx) => billingWire(await work(tx!)),
    );
    return result.value;
  }
  async operatorReceipt(
    actor: BillingActor,
    key: string,
    path: string,
    payload: unknown,
    work: (tx: Prisma.TransactionClient) => Promise<unknown>,
  ) {
    return this.receipt(actor, key, path, payload, async (tx) => {
      await assertBillingOperator(tx, actor.userId);
      return work(tx);
    });
  }
  private accountsWhere(): Prisma.BillingProviderAccountWhereInput {
    if (this.config.mode === 'simulation')
      return {
        environment: 'sandbox',
        enabled: true,
        configurationKey: 'BILLING_SIMULATION',
      };
    if (this.config.mode === 'sandbox')
      return {
        environment: 'sandbox',
        enabled: true,
        id: {
          in: [
            this.config.stripe?.accountId,
            this.config.mercadopago?.accountId,
          ].filter((id): id is string => !!id),
        },
      };
    return { id: { in: [] } };
  }
  private version(v: CatalogVersion) {
    return {
      id: v.id,
      planId: v.planId,
      version: v.version,
      revision: Number(v.revision),
      status: v.status,
      name: v.name,
      description: v.description,
      trialDays: v.trialDays,
      graceDays: v.graceDays,
      features: commercialFeatures(v),
      quotas: commercialQuotas(v),
      prices: (v.billingPrice ?? []).map((p) => ({
        id: p.id,
        provider: p.provider,
        currency: p.currency,
        interval: p.interval,
        amountMinor: p.amountMinor.toString(),
        modes: [
          ...(p.manualEnabled ? ['manual'] : []),
          ...(p.automaticEnabled ? ['automatic'] : []),
        ],
        ready: (p.billingPriceBinding ?? []).some((b) => b.status === 'ready'),
      })),
    };
  }
  async catalog(platform = false) {
    if (this.config.mode === 'disabled') return [];
    const accounts = await this.prisma.billingProviderAccount.findMany({
      where: this.accountsWhere(),
      select: { id: true },
    });
    const rows = await this.prisma.billingPlan.findMany({
      where: platform ? {} : { archivedAt: null },
      include: {
        billingPlanVersion: {
          where: platform ? {} : { status: 'published' },
          orderBy: { version: 'desc' },
          include: {
            billingPrice: {
              include: {
                billingPriceBinding: {
                  where: {
                    providerAccountId: { in: accounts.map((a) => a.id) },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { code: 'asc' },
      take: 100,
    });
    return rows
      .map((p) => ({
        id: p.id,
        code: p.code,
        archived: !!p.archivedAt,
        versions: p.billingPlanVersion.map((v) => this.version(v)),
      }))
      .filter((p) => platform || p.versions.length > 0);
  }
  async summary(actor: BillingActor) {
    const s = await this.access.snapshot(actor.tenantId);
    if (this.config.mode === 'disabled')
      return {
        runtime: 'disabled',
        isOperator: false,
        enforcementEnabled: false,
        access: s.access,
        trialConsumed: false,
        revision: 0,
        plan: null,
        features: null,
        quotas: commercialQuotas(null),
        usage: null,
        coverage: null,
        pendingOperationId: null,
        subscription: null,
        change: null,
      };
    const [usage, operator, subscription, change] = await Promise.all([
      this.access.usage(actor.tenantId),
      this.prisma.billingPlatformOperator.findFirst({
        where: {
          userId: actor.userId,
          revokedAt: null,
          users: { isActive: true, tenant: { isActive: true } },
        },
        select: { userId: true },
      }),
      this.prisma.billingSubscription.findFirst({
        where: { tenantId: actor.tenantId, environment: 'sandbox' },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: { billingPrice: true },
      }),
      this.prisma.billingSubscriptionChange.findFirst({
        where: {
          tenantId: actor.tenantId,
          environment: 'sandbox',
          status: { in: ['requested', 'cancel_pending', 'awaiting_checkout'] },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    const lastCheckout = actor.roles.includes('admin')
      ? await this.prisma.billingOperation.findFirst({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            kind: 'checkout',
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          select: { id: true, entityId: true },
        })
      : null;
    const pendingOperationId =
      lastCheckout &&
      (await this.prisma.billingObligation.findFirst({
        where: {
          id: lastCheckout.entityId,
          tenantId: actor.tenantId,
          environment: 'sandbox',
          status: 'open',
        },
        select: { id: true },
      }))
        ? lastCheckout.id
        : null;
    const current =
      s.periods.find((p) => !p.revokedAt && p.endsAt > new Date()) ??
      s.periods[0];
    const coverage = current
      ? {
          startsAt: current.startsAt,
          endsAt: current.endsAt,
          graceEndsAt:
            current.kind === 'paid' && !current.revokedAt
              ? new Date(
                  current.endsAt.getTime() +
                    (s.version?.graceDays ?? 0) * 86400000,
                )
              : null,
        }
      : null;
    return billingWire({
      runtime: this.config.mode,
      coverage,
      pendingOperationId,
      isOperator: !!operator,
      enforcementEnabled: s.enforcementEnabled,
      revision: s.revision,
      trialConsumed: s.trialConsumed,
      access: s.access,
      plan: s.version
        ? {
            id: s.version.id,
            name: s.version.name,
            graceDays: s.version.graceDays,
          }
        : null,
      features: s.version ? commercialFeatures(s.version) : null,
      quotas: commercialQuotas(s.version),
      usage,
      subscription:
        actor.roles.includes('admin') && subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              mode: subscription.mode,
              paidThrough: subscription.paidThrough,
              renewalStoppedAt: subscription.renewalStoppedAt,
              price: {
                id: subscription.billingPrice.id,
                provider: subscription.billingPrice.provider,
                currency: subscription.billingPrice.currency,
                interval: subscription.billingPrice.interval,
                amountMinor: subscription.billingPrice.amountMinor.toString(),
              },
            }
          : null,
      change:
        actor.roles.includes('admin') && change
          ? {
              id: change.id,
              status: change.status,
              targetPriceId: change.targetPriceId,
              targetMode: change.targetMode,
              effectiveAt: change.effectiveAt,
            }
          : null,
    });
  }
  async startTrial(actor: BillingActor, key: string, planVersionId: string) {
    return this.receipt(actor, key, '/billing/trial', { planVersionId }, (tx) =>
      this.tenant.startTrial(
        actor.tenantId,
        'sandbox',
        planVersionId,
        new Date(),
        tx,
      ),
    );
  }
  async checkout(actor: BillingActor, key: string, input: CheckoutRequest) {
    return this.receipt(actor, key, '/billing/checkouts', input, async (tx) => {
      await lockBillingAccount(tx, actor.tenantId);
      const change = await tx.billingSubscriptionChange.findFirst({
        where: {
          tenantId: actor.tenantId,
          environment: 'sandbox',
          status: { in: ['requested', 'cancel_pending', 'awaiting_checkout'] },
        },
      });
      if (
        change &&
        (change.effectiveAt > new Date() ||
          change.targetPriceId !== input.priceId ||
          change.targetMode !== input.mode)
      )
        throw billingConflict('BILLING_CHANGE_NOT_DUE');
      const stopped = await tx.billingSubscription.findMany({
        where: {
          tenantId: actor.tenantId,
          environment: 'sandbox',
          status: 'canceled',
        },
        select: { id: true },
      });
      if (
        stopped.length &&
        (await tx.billingObligation.count({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            subscriptionId: { in: stopped.map((s) => s.id) },
            status: 'open',
          },
        }))
      )
        throw billingConflict('BILLING_PREVIOUS_PAYMENT_UNRESOLVED');
      if (
        !(await tx.billingPrice.findFirst({
          where: {
            id: input.priceId,
            billingPriceBinding: {
              some: {
                status: 'ready',
                billingProviderAccount: this.accountsWhere(),
              },
            },
          },
          select: { id: true },
        }))
      )
        throw billingConflict('BILLING_PRICE_UNAVAILABLE');
      const obligation = await this.settlements.preparePurchase(
        {
          tenantId: actor.tenantId,
          environment: 'sandbox',
          priceId: input.priceId,
          mode: input.mode,
          cycleKey: key,
        },
        tx,
      );
      const operation = await this.ledger.enqueueCheckout(
        actor.tenantId,
        'sandbox',
        obligation.id,
        key,
        tx,
      );
      if (change)
        await tx.billingSubscriptionChange.update({
          where: { id: change.id },
          data: { status: 'awaiting_checkout' },
        });
      return { operationId: operation.id };
    });
  }
  async cancel(actor: BillingActor, key: string) {
    return this.receipt(
      actor,
      key,
      '/billing/subscription/cancel',
      {},
      async (tx) => {
        await lockBillingAccount(tx, actor.tenantId);
        const sub = await tx.billingSubscription.findFirst({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            status: { in: ['pending', 'active', 'past_due', 'cancel_pending'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!sub) throw billingConflict('BILLING_SUBSCRIPTION_NOT_ACTIVE');
        const op = await this.ledger.enqueueCancellation(
          actor.tenantId,
          'sandbox',
          sub.id,
          key,
          tx,
        );
        return { operationId: op.id };
      },
    );
  }
  async change(actor: BillingActor, key: string, input: CheckoutRequest) {
    return this.receipt(
      actor,
      key,
      '/billing/subscription/changes',
      input,
      async (tx) => {
        await lockBillingAccount(tx, actor.tenantId);
        const sub = await tx.billingSubscription.findFirst({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            status: { in: ['active', 'past_due', 'pending', 'cancel_pending'] },
          },
          orderBy: { createdAt: 'desc' },
        });
        if (!sub) throw billingConflict('BILLING_SUBSCRIPTION_NOT_ACTIVE');
        const price = await tx.billingPrice.findFirst({
          where: {
            id: input.priceId,
            billingPlanVersion: { status: 'published' },
            billingPriceBinding: {
              some: {
                status: 'ready',
                billingProviderAccount: this.accountsWhere(),
              },
            },
          },
        });
        if (
          !price ||
          !(input.mode === 'manual'
            ? price.manualEnabled
            : price.automaticEnabled)
        )
          throw billingConflict('BILLING_PRICE_UNAVAILABLE');
        if (sub.priceId === price.id && sub.mode === input.mode)
          throw billingConflict('BILLING_CHANGE_UNNECESSARY');
        if (
          await tx.billingSubscriptionChange.count({
            where: {
              tenantId: actor.tenantId,
              sourceSubscriptionId: sub.id,
              status: {
                in: ['requested', 'cancel_pending', 'awaiting_checkout'],
              },
            },
          })
        )
          throw billingConflict('BILLING_CHANGE_EXISTS');
        const latest = await tx.billingAccessPeriod.aggregate({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            kind: 'paid',
            revokedAt: null,
          },
          _max: { endsAt: true },
        });
        const effectiveAt =
          latest._max.endsAt && latest._max.endsAt > new Date()
            ? latest._max.endsAt
            : new Date();
        const change = await tx.billingSubscriptionChange.create({
          data: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            sourceSubscriptionId: sub.id,
            targetPriceId: price.id,
            targetMode: input.mode,
            effectiveAt,
            status: 'cancel_pending',
          },
        });
        const operation = await this.ledger.enqueueCancellation(
          actor.tenantId,
          'sandbox',
          sub.id,
          key,
          tx,
        );
        return { changeId: change.id, operationId: operation.id, effectiveAt };
      },
    );
  }
  async cancelChange(actor: BillingActor, key: string) {
    return this.receipt(
      actor,
      key,
      '/billing/subscription/changes/cancel',
      {},
      async (tx) => {
        await lockBillingAccount(tx, actor.tenantId);
        const changed = await tx.billingSubscriptionChange.updateMany({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            status: {
              in: ['requested', 'cancel_pending', 'awaiting_checkout'],
            },
          },
          data: { status: 'canceled' },
        });
        return { canceled: changed.count > 0 };
      },
    );
  }
  async operation(actor: BillingActor, id: string) {
    this.requireEnabled();
    const op = await this.prisma.billingOperation.findFirst({
      where: { id, tenantId: actor.tenantId, environment: 'sandbox' },
      select: {
        id: true,
        status: true,
        errorCode: true,
        kind: true,
        entityId: true,
        providerAccountId: true,
        externalResourceId: true,
        tenantId: true,
        environment: true,
        createdAt: true,
      },
    });
    if (!op)
      throw new ApplicationError(
        'Operación no disponible.',
        'not_found',
        'BILLING_OPERATION_NOT_FOUND',
      );
    const obligation =
      op.kind === 'checkout'
        ? await this.prisma.billingObligation.findFirst({
            where: {
              id: op.entityId,
              tenantId: actor.tenantId,
              environment: 'sandbox',
            },
          })
        : null;
    const payment = obligation
      ? await this.prisma.billingPayment.findFirst({
          where: {
            tenantId: actor.tenantId,
            environment: 'sandbox',
            obligationId: obligation.id,
            ...(obligation.creditedPaymentId
              ? { id: obligation.creditedPaymentId }
              : {}),
          },
          orderBy: { observedAt: 'desc' },
          select: { status: true },
        })
      : null;
    return {
      id: op.id,
      status: op.status,
      kind: op.kind,
      errorCode: op.errorCode,
      paymentStatus: ['refunded', 'charged_back'].includes(
        payment?.status ?? '',
      )
        ? 'reversed'
        : obligation?.status === 'paid'
          ? 'confirmed'
          : op.status === 'review' ||
              ['failed', 'canceled'].includes(payment?.status ?? '')
            ? 'failed'
            : 'pending',
    };
  }
  async ownedOperation(actor: BillingActor, id: string) {
    this.requireEnabled();
    const row = await this.prisma.billingOperation.findFirst({
      where: { id, tenantId: actor.tenantId, environment: 'sandbox' },
    });
    if (!row)
      throw new ApplicationError('Operación no disponible.', 'not_found');
    return row;
  }
  async checkoutContext(actor: BillingActor, id: string) {
    await this.operation(actor, id);
    const row = await this.prisma.billingOperation.findUniqueOrThrow({
      where: { id },
    });
    if (
      row.kind !== 'checkout' ||
      row.status !== 'succeeded' ||
      !row.externalResourceId
    )
      return null;
    return {
      row,
      command: await this.ledger.command({
        kind: 'operation',
        row,
        recovering: true,
      }),
    };
  }
  async payments(tenantId: string, page: number, limit: number) {
    this.requireEnabled();
    const where = { tenantId, environment: 'sandbox' };
    const [rows, total] = await Promise.all([
      this.prisma.billingPayment.findMany({
        where,
        select: {
          id: true,
          status: true,
          amountMinor: true,
          refundedMinor: true,
          currency: true,
          observedAt: true,
          providerStatus: true,
        },
        orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.billingPayment.count({ where }),
    ]);
    return { items: billingWire(rows), total, page, limit };
  }
  async platform(actor: BillingActor) {
    this.requireEnabled();
    return billingTransaction(this.prisma, async (tx) => {
      await assertBillingOperator(tx, actor.userId);
      return billingWire({
        runtime: this.config.mode,
        accounts: await tx.billingProviderAccount.findMany({
          where: { environment: 'sandbox' },
          orderBy: { provider: 'asc' },
        }),
        operations: await tx.billingOperation.findMany({
          select: {
            id: true,
            tenantId: true,
            kind: true,
            status: true,
            attempts: true,
            errorCode: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
        inbox: await tx.billingWebhookInbox.findMany({
          select: {
            id: true,
            topic: true,
            status: true,
            attempts: true,
            errorCode: true,
            receivedAt: true,
          },
          orderBy: [{ receivedAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
        discrepancies: await tx.billingAudit.findMany({
          where: { action: { in: ['payment.additional', 'ledger.review'] } },
          select: {
            id: true,
            tenantId: true,
            entityId: true,
            action: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
        payments: await tx.billingPayment.findMany({
          select: {
            id: true,
            tenantId: true,
            status: true,
            amountMinor: true,
            refundedMinor: true,
            currency: true,
            observedAt: true,
          },
          orderBy: [{ observedAt: 'desc' }, { id: 'desc' }],
          take: 50,
        }),
      });
    });
  }
  async tenantPolicy(actor: BillingActor, tenantId: string) {
    this.requireEnabled();
    return billingTransaction(this.prisma, async (tx) => {
      await assertBillingOperator(tx, actor.userId);
      if (
        !(await tx.tenant.findUnique({
          where: { id: tenantId },
          select: { id: true },
        }))
      )
        throw new ApplicationError('Tenant no disponible.', 'not_found');
      const policy = await this.access.snapshot(tenantId, tx);
      return {
        tenantId,
        revision: policy.revision,
        enforcementEnabled: policy.enforcementEnabled,
        access: policy.access,
      };
    });
  }
  async configureAccount(
    actor: BillingActor,
    key: string,
    input: {
      provider: 'stripe' | 'mercadopago';
      sellerId: string;
      applicationId: string | null;
      configurationKey: string;
      enabled: boolean;
    },
  ) {
    return this.receipt(
      actor,
      key,
      '/platform/billing/accounts',
      input,
      async (tx) => {
        await assertBillingOperator(tx, actor.userId);
        const setting =
          this.config.mode === 'sandbox'
            ? input.provider === 'stripe'
              ? this.config.stripe
              : this.config.mercadopago
            : null;
        if (
          this.config.mode === 'sandbox' &&
          (!setting ||
            setting.sellerId !== input.sellerId ||
            (setting.applicationId ?? null) !== input.applicationId ||
            input.configurationKey === 'BILLING_SIMULATION')
        )
          throw billingConflict('BILLING_ACCOUNT_MISMATCH');
        if (
          this.config.mode === 'simulation' &&
          input.configurationKey !== 'BILLING_SIMULATION'
        )
          throw billingConflict('BILLING_SIMULATION_ACCOUNT_REQUIRED');
        const old = await tx.billingProviderAccount.findUnique({
          where: {
            provider_environment: {
              provider: input.provider,
              environment: 'sandbox',
            },
          },
        });
        if (
          old &&
          (old.sellerId !== input.sellerId ||
            old.applicationId !== input.applicationId ||
            old.configurationKey !== input.configurationKey)
        )
          throw billingConflict('BILLING_ACCOUNT_IMMUTABLE');
        const row = old
          ? await tx.billingProviderAccount.update({
              where: { id: old.id },
              data: { enabled: input.enabled },
            })
          : await tx.billingProviderAccount.create({
              data: {
                id: setting?.accountId ?? randomUUID(),
                environment: 'sandbox',
                ...input,
              },
            });
        await tx.billingAudit.create({
          data: {
            actorId: actor.userId,
            entityId: row.id,
            environment: 'sandbox',
            action: 'provider.configured',
            correlationId: randomUUID(),
            nextState: row.enabled ? 'enabled' : 'disabled',
          },
        });
        return { id: row.id, enabled: row.enabled };
      },
    );
  }
}
