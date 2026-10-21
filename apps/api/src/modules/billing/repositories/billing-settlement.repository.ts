import { randomUUID } from 'node:crypto';
import type { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { idempotencyKeySchema } from '../contracts/billing.schemas';
import { manualPaidPeriod } from '../domain/calendar';
import { applyPaymentObservation } from '../domain/settlement';
import type {
  BillingCurrency,
  BillingEnvironment,
  BillingInterval,
  BillingMode,
  BillingProvider,
  PaymentObservation,
  PaymentStatus,
} from '../domain/billing.types';
import {
  billingConflict,
  billingTransaction,
  lockBillingAccount,
} from './billing-transaction';

@Injectable()
export class BillingSettlementRepository {
  constructor(private readonly prisma: PrismaService) {}

  // Local purchase intent only. No SDK/network calls and no access granted here.
  async preparePurchase(input: {
    tenantId: string;
    environment: BillingEnvironment;
    priceId: string;
    mode: BillingMode;
    cycleKey: string;
  }) {
    idempotencyKeySchema.parse(input.cycleKey);
    return billingTransaction(this.prisma, async (tx) => {
      await lockBillingAccount(tx, input.tenantId);
      const price = await tx.billingPrice.findUnique({
        where: { id: input.priceId },
      });
      if (
        !price ||
        !(input.mode === 'manual'
          ? price.manualEnabled
          : price.automaticEnabled)
      )
        throw billingConflict('BILLING_PRICE_UNAVAILABLE');
      const account = await tx.billingProviderAccount.findFirst({
        where: {
          provider: price.provider,
          environment: input.environment,
          enabled: true,
        },
      });
      if (!account) throw billingConflict('BILLING_PROVIDER_UNAVAILABLE');
      const binding = await tx.billingPriceBinding.findFirst({
        where: {
          priceId: price.id,
          providerAccountId: account.id,
          status: 'ready',
        },
      });
      if (!binding) throw billingConflict('BILLING_PRICE_NOT_READY');
      let subscription = await tx.billingSubscription.findFirst({
        where: {
          tenantId: input.tenantId,
          environment: input.environment,
          status: { in: ['pending', 'active', 'past_due', 'cancel_pending'] },
        },
      });
      if (
        subscription &&
        (subscription.priceId !== price.id ||
          subscription.mode !== input.mode ||
          subscription.providerAccountId !== account.id ||
          subscription.status === 'cancel_pending')
      ) {
        throw billingConflict('BILLING_SUBSCRIPTION_CONFLICT');
      }
      const version = await tx.billingPlanVersion.findUniqueOrThrow({
        where: { id: price.planVersionId },
      });
      if (!subscription) {
        if (version.status !== 'published')
          throw billingConflict('BILLING_PLAN_UNAVAILABLE');
        const coverage = await tx.billingAccessPeriod.count({
          where: {
            tenantId: input.tenantId,
            environment: input.environment,
            kind: 'paid',
            revokedAt: null,
            endsAt: { gt: new Date() },
          },
        });
        if (coverage) throw billingConflict('BILLING_CHANGE_NOT_DUE');
        subscription = await tx.billingSubscription.create({
          data: {
            tenantId: input.tenantId,
            environment: input.environment,
            provider: price.provider,
            providerAccountId: account.id,
            priceId: price.id,
            planVersionId: price.planVersionId,
            mode: input.mode,
            status: 'pending',
            anchorDay: new Date().getUTCDate(),
          },
        });
      }
      const existing = await tx.billingObligation.findFirst({
        where: {
          tenantId: input.tenantId,
          environment: input.environment,
          subscriptionId: subscription.id,
          cycleKey: input.cycleKey,
        },
      });
      if (existing) return existing;
      if (input.mode === 'automatic' && subscription.status !== 'pending')
        throw billingConflict('BILLING_ALREADY_SUBSCRIBED');
      const pending = await tx.billingObligation.count({
        where: {
          tenantId: input.tenantId,
          environment: input.environment,
          subscriptionId: subscription.id,
          status: 'open',
        },
      });
      if (pending) throw billingConflict('BILLING_PAYMENT_PENDING');
      const order = await tx.billingOrder.create({
        data: {
          tenantId: input.tenantId,
          environment: input.environment,
          subscriptionId: subscription.id,
          externalReference: randomUUID(),
        },
      });
      const obligation = await tx.billingObligation.create({
        data: {
          tenantId: input.tenantId,
          environment: input.environment,
          orderId: order.id,
          subscriptionId: subscription.id,
          providerAccountId: account.id,
          cycleKey: input.cycleKey,
          amountMinor: price.amountMinor,
          currency: price.currency,
        },
      });
      await tx.billingAudit.create({
        data: {
          tenantId: input.tenantId,
          environment: input.environment,
          action: 'obligation.created',
          entityId: obligation.id,
          correlationId: randomUUID(),
          nextState: 'open',
        },
      });
      return obligation;
    });
  }

  // Observations must originate from an authenticated adapter query (phase 3),
  // never from a browser request. Both scopes are checked before applying money.
  async recordObservation(
    tenantId: string,
    environment: BillingEnvironment,
    observation: PaymentObservation,
    options: {
      providerStatus: string;
      paidAt?: Date;
      recurringPeriod?: { startsAt: Date; endsAt: Date };
    },
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await lockBillingAccount(tx, tenantId);
      await tx.$executeRaw`SELECT id FROM billing_obligations WHERE tenant_id = ${tenantId}::uuid
        AND environment = ${environment} AND id = ${observation.obligationId}::uuid FOR UPDATE`;
      const obligation = await tx.billingObligation.findFirst({
        where: { id: observation.obligationId, tenantId, environment },
      });
      if (!obligation) throw billingConflict('BILLING_OBLIGATION_NOT_FOUND');
      if (obligation.status === 'void')
        throw billingConflict('BILLING_OBLIGATION_VOID');
      const subscription = await tx.billingSubscription.findFirstOrThrow({
        where: { id: obligation.subscriptionId, tenantId, environment },
      });
      const order = await tx.billingOrder.findFirstOrThrow({
        where: { id: obligation.orderId, tenantId, environment },
      });
      const rows = await tx.billingPayment.findMany({
        where: { obligationId: obligation.id, tenantId, environment },
      });
      const expected = {
        tenantId,
        environment,
        obligationId: obligation.id,
        externalReference: order.externalReference,
        provider: subscription.provider as BillingProvider,
        accountId: obligation.providerAccountId,
        money: {
          amountMinor: obligation.amountMinor,
          currency: obligation.currency as BillingCurrency,
        },
      };
      const result = applyPaymentObservation(
        {
          expected,
          creditedPaymentId:
            rows.find((row) => row.id === obligation.creditedPaymentId)
              ?.externalPaymentId ?? null,
          payments: rows.map((row) => ({
            paymentId: row.externalPaymentId,
            status: row.status as PaymentStatus,
            refundedMinor: row.refundedMinor,
          })),
        },
        observation,
      );
      const decision = result.settlement.payments.find(
        (p) => p.paymentId === observation.paymentId,
      )!;
      const existing = rows.find(
        (p) => p.externalPaymentId === observation.paymentId,
      );
      const globalPayment = await tx.billingPayment.findFirst({
        where: {
          providerAccountId: obligation.providerAccountId,
          externalPaymentId: observation.paymentId,
        },
      });
      if (globalPayment && globalPayment.obligationId !== obligation.id)
        throw billingConflict('BILLING_PAYMENT_ALREADY_LINKED');
      const paymentData = {
        status: decision.status,
        refundedMinor: decision.refundedMinor,
        providerStatus: options.providerStatus,
        observedAt: new Date(),
      };
      const payment = existing
        ? await tx.billingPayment.update({
            where: { id: existing.id, tenantId, environment },
            data: paymentData,
          })
        : await tx.billingPayment.create({
            data: {
              tenantId,
              environment,
              obligationId: obligation.id,
              providerAccountId: obligation.providerAccountId,
              externalPaymentId: observation.paymentId,
              amountMinor: obligation.amountMinor,
              currency: obligation.currency,
              ...paymentData,
            },
          });
      if (result.accessEffect === 'grant') {
        const paidAt = options.paidAt ?? new Date();
        const price = await tx.billingPrice.findUniqueOrThrow({
          where: { id: subscription.priceId },
        });
        const period =
          subscription.mode === 'manual'
            ? manualPaidPeriod({
                paidAt,
                paidThrough: subscription.paidThrough,
                interval: price.interval as BillingInterval,
                anchorDay: subscription.anchorDay,
              })
            : options.recurringPeriod;
        if (
          !period ||
          !Number.isFinite(period.startsAt.getTime()) ||
          !Number.isFinite(period.endsAt.getTime()) ||
          period.endsAt <= period.startsAt
        )
          throw billingConflict('BILLING_PERIOD_INVALID');
        await tx.billingObligation.update({
          where: { id: obligation.id, tenantId, environment },
          data: { status: 'paid', creditedPaymentId: payment.id },
        });
        await tx.billingOrder.update({
          where: { id: order.id, tenantId, environment },
          data: { status: 'paid' },
        });
        await tx.billingAccessPeriod.updateMany({
          where: { tenantId, environment, kind: 'trial', revokedAt: null },
          data: { revokedAt: paidAt },
        });
        await tx.billingAccessPeriod.create({
          data: {
            tenantId,
            environment,
            planVersionId: subscription.planVersionId,
            kind: 'paid',
            obligationId: obligation.id,
            paymentId: payment.id,
            startsAt: period.startsAt,
            endsAt: period.endsAt,
          },
        });
        await tx.billingSubscription.update({
          where: { id: subscription.id, tenantId, environment },
          data: {
            status: ['canceled', 'cancel_pending'].includes(subscription.status)
              ? subscription.status
              : 'active',
            paidThrough:
              !subscription.paidThrough ||
              period.endsAt > subscription.paidThrough
                ? period.endsAt
                : subscription.paidThrough,
            anchorDay:
              subscription.mode === 'manual' &&
              (!subscription.paidThrough || subscription.paidThrough < paidAt)
                ? paidAt.getUTCDate()
                : subscription.anchorDay,
          },
        });
      } else if (result.accessEffect === 'revoke') {
        await tx.billingAccessPeriod.updateMany({
          where: {
            tenantId,
            environment,
            obligationId: obligation.id,
            paymentId: payment.id,
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
        const periods = await tx.$queryRaw<Array<{ horizon: Date | null }>>`
          SELECT max(p.ends_at) AS horizon FROM billing_access_periods p JOIN billing_obligations o ON o.id = p.obligation_id
          WHERE p.tenant_id = ${tenantId}::uuid AND p.environment = ${environment} AND p.kind = 'paid'
            AND p.revoked_at IS NULL AND o.subscription_id = ${subscription.id}::uuid`;
        await tx.billingSubscription.update({
          where: { id: subscription.id, tenantId, environment },
          data: { paidThrough: periods[0]?.horizon ?? null },
        });
      }
      if (
        !existing ||
        existing.status !== decision.status ||
        existing.refundedMinor !== decision.refundedMinor ||
        result.accessEffect !== 'none'
      ) {
        await tx.billingAudit.create({
          data: {
            tenantId,
            environment,
            action: result.discrepancy
              ? 'payment.additional'
              : `payment.${decision.status}`,
            entityId: payment.id,
            correlationId: randomUUID(),
            previousState: existing?.status ?? null,
            nextState: decision.status,
          },
        });
      }
      return {
        payment,
        accessEffect: result.accessEffect,
        discrepancy: result.discrepancy,
      };
    };
    return billingTransaction(this.prisma, work, transaction);
  }
}
