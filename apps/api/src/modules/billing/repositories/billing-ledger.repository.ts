import { createHash, randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import {
  Prisma,
  type BillingOperation,
  type BillingObligation,
  type BillingWebhookInbox,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type {
  BillingEnvironment,
  BillingInterval,
  BillingMode,
  BillingProvider,
  BillingCurrency,
} from '../domain/billing.types';
import type {
  CheckoutCommand,
  VerifiedPayment,
  VerifiedCheckoutExpiration,
  GatewaySnapshot,
} from '../ports/financial-gateway.port';
import { GatewayError } from '../ports/financial-gateway.port';
import { idempotencyKeySchema } from '../contracts/billing.schemas';
import {
  billingConflict,
  billingTransaction,
  lockBillingAccount,
} from './billing-transaction';
import { assertBillingOperator } from './billing-operator.repository';
import { BillingSettlementRepository } from './billing-settlement.repository';

export type LedgerJob =
  | { kind: 'operation'; row: BillingOperation; recovering: boolean }
  | { kind: 'inbox'; row: BillingWebhookInbox };
export interface Receipt {
  eventKey: string;
  topic: string;
  resourceId: string;
}
const digest = (v: object) =>
  createHash('sha256').update(JSON.stringify(v)).digest('hex');
@Injectable()
export class BillingLedgerRepository {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settlements: BillingSettlementRepository,
  ) {}
  async receive(
    accountId: string,
    environment: BillingEnvironment,
    receipt: Receipt,
    transaction?: Prisma.TransactionClient,
  ) {
    // Native conflict handling, including concurrent redeliveries, before ACK.
    if (
      receipt.eventKey.length > 200 ||
      receipt.topic.length > 100 ||
      receipt.resourceId.length > 4000
    )
      throw new GatewayError('BILLING_RECEIPT_INVALID', true);
    const client = transaction ?? this.prisma;
    await client.$executeRaw`INSERT INTO billing_webhook_inbox
      (id, provider_account_id, environment, event_key, topic, resource_id)
      VALUES (${randomUUID()}::uuid, ${accountId}::uuid, ${environment}, ${receipt.eventKey}, ${receipt.topic}, ${receipt.resourceId})
      ON CONFLICT (provider_account_id, event_key) DO NOTHING`;
  }
  async simulationAccountIds() {
    return (
      await this.prisma.billingProviderAccount.findMany({
        where: {
          environment: 'sandbox',
          configurationKey: 'BILLING_SIMULATION',
          enabled: true,
        },
        select: { id: true },
        orderBy: { id: 'asc' },
      })
    ).map((account) => account.id);
  }

  async account(id: string) {
    return this.prisma.billingProviderAccount.findUniqueOrThrow({
      where: { id },
    });
  }
  private async operation(
    tx: Prisma.TransactionClient,
    input: {
      tenantId: string | null;
      environment: string;
      providerAccountId: string;
      kind: string;
      entityId: string;
      key: string;
      target?: 'obligation' | 'subscription';
    },
  ) {
    idempotencyKeySchema.parse(input.key);
    const requestData = {
      entityId: input.entityId,
      ...(input.target ? { target: input.target } : {}),
    };
    const hash = digest({ kind: input.kind, ...requestData });
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${input.providerAccountId + input.kind + (input.tenantId ?? '') + input.key}, 0))`;
    const old = await tx.billingOperation.findFirst({
      where: {
        tenantId: input.tenantId,
        providerAccountId: input.providerAccountId,
        kind: input.kind,
        idempotencyKey: input.key,
      },
    });
    if (old) {
      // Request hashes are public content digests, not authentication secrets.
      // eslint-disable-next-line security/detect-possible-timing-attacks
      if (old.requestHash !== hash)
        throw billingConflict('IDEMPOTENCY_KEY_REUSED');
      return old;
    }
    if (input.kind === 'checkout') {
      const duplicate = await tx.billingOperation.findFirst({
        where: {
          tenantId: input.tenantId,
          providerAccountId: input.providerAccountId,
          kind: 'checkout',
          entityId: input.entityId,
        },
      });
      if (duplicate)
        throw billingConflict('BILLING_CHECKOUT_ALREADY_REQUESTED');
    }
    return tx.billingOperation.create({
      data: {
        tenantId: input.tenantId,
        environment: input.environment,
        providerAccountId: input.providerAccountId,
        kind: input.kind,
        entityId: input.entityId,
        idempotencyKey: input.key,
        requestHash: hash,
        requestData:
          input.kind === 'checkout'
            ? { ...requestData, checkoutSubmission: 'not_started' }
            : requestData,
      },
    });
  }
  async enqueueCheckout(
    tenantId: string,
    environment: BillingEnvironment,
    obligationId: string,
    key: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await lockBillingAccount(tx, tenantId);
      const obligation = await tx.billingObligation.findFirstOrThrow({
        where: { id: obligationId, tenantId, environment, status: 'open' },
      });
      return this.operation(tx, {
        tenantId,
        environment,
        providerAccountId: obligation.providerAccountId,
        kind: 'checkout',
        entityId: obligationId,
        key,
      });
    };
    return billingTransaction(this.prisma, work, transaction);
  }
  async enqueueSync(
    actorId: string,
    accountId: string,
    priceId: string,
    key: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const account = await tx.billingProviderAccount.findUniqueOrThrow({
        where: { id: accountId },
      });
      const price = await tx.billingPrice.findFirstOrThrow({
        where: { id: priceId, provider: account.provider },
      });
      const version = await tx.billingPlanVersion.findUniqueOrThrow({
        where: { id: price.planVersionId },
      });
      if (version.status === 'draft')
        throw billingConflict('BILLING_PLAN_NOT_PUBLISHED');
      await tx.billingPriceBinding.upsert({
        where: {
          priceId_providerAccountId: { priceId, providerAccountId: accountId },
        },
        create: {
          priceId,
          planVersionId: price.planVersionId,
          providerAccountId: accountId,
          provider: account.provider,
          environment: account.environment,
        },
        update: {},
      });
      return this.operation(tx, {
        tenantId: null,
        environment: account.environment,
        providerAccountId: accountId,
        kind: 'sync_catalog',
        entityId: priceId,
        key,
      });
    };
    return billingTransaction(this.prisma, work, transaction);
  }
  async enqueueCancellation(
    tenantId: string,
    environment: BillingEnvironment,
    subscriptionId: string,
    key: string,
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await lockBillingAccount(tx, tenantId);
      const sub = await tx.billingSubscription.findFirstOrThrow({
        where: { id: subscriptionId, tenantId, environment },
      });
      const operation = await this.operation(tx, {
        tenantId,
        environment,
        providerAccountId: sub.providerAccountId,
        kind: 'stop_renewal',
        entityId: sub.id,
        key,
      });
      if (!['canceled', 'ended'].includes(sub.status))
        await tx.billingSubscription.update({
          where: { id: sub.id },
          data: { status: 'cancel_pending' },
        });
      return operation;
    };
    return billingTransaction(this.prisma, work, transaction);
  }
  async claim(
    accountIds: string[],
    kind: 'operation' | 'inbox',
  ): Promise<LedgerJob | null> {
    if (!accountIds.length) return null;
    const token = randomUUID();
    const accounts = Prisma.join(
      accountIds.map((id) => Prisma.sql`${id}::uuid`),
    );
    if (kind === 'operation') {
      const rows = await this.prisma.$queryRaw<
        Array<{ id: string; recovering: boolean }>
      >`
        WITH candidate AS (SELECT id, CASE
          WHEN kind = 'checkout' AND request_data->>'checkoutSubmission' = 'not_started' THEN false
          WHEN kind = 'checkout' AND request_data->>'checkoutSubmission' = 'possibly_submitted' THEN true
          ELSE status <> 'ready' END AS recovering FROM billing_operations
          WHERE provider_account_id IN (${accounts}) AND
          ((status IN ('ready','uncertain') AND next_attempt_at <= now()) OR (status = 'processing' AND lease_until <= now()))
          ORDER BY next_attempt_at, created_at FOR UPDATE SKIP LOCKED LIMIT 1)
        UPDATE billing_operations j SET status='processing', lease_token=${token}::uuid, lease_until=now()+interval '60 seconds', attempts=attempts+1, updated_at=now()
        FROM candidate c WHERE j.id=c.id RETURNING j.id, c.recovering`;
      if (!rows[0]) return null;
      const row = await this.prisma.billingOperation.findUniqueOrThrow({
        where: { id: rows[0].id },
      });
      return row.leaseToken === token
        ? { kind, row, recovering: rows[0].recovering }
        : null;
    }
    const rows = await this.prisma.$queryRaw<Array<{ id: string }>>`
      WITH candidate AS (SELECT id FROM billing_webhook_inbox WHERE provider_account_id IN (${accounts}) AND
        ((status='ready' AND next_attempt_at <= now()) OR (status='processing' AND lease_until <= now()))
        ORDER BY next_attempt_at, received_at FOR UPDATE SKIP LOCKED LIMIT 1)
      UPDATE billing_webhook_inbox j SET status='processing', lease_token=${token}::uuid, lease_until=now()+interval '60 seconds', attempts=attempts+1
      FROM candidate c WHERE j.id=c.id RETURNING j.id`;
    if (!rows[0]) return null;
    const row = await this.prisma.billingWebhookInbox.findUniqueOrThrow({
      where: { id: rows[0].id },
    });
    return row.leaseToken === token ? { kind, row } : null;
  }
  async heartbeat(job: LedgerJob) {
    const leaseUntil = new Date(Date.now() + 60000);
    const where = {
      id: job.row.id,
      status: 'processing',
      leaseToken: job.row.leaseToken,
      leaseUntil: { gt: new Date() },
    };
    const result =
      job.kind === 'operation'
        ? await this.prisma.billingOperation.updateMany({
            where,
            data: { leaseUntil },
          })
        : await this.prisma.billingWebhookInbox.updateMany({
            where,
            data: { leaseUntil },
          });
    return result.count === 1;
  }
  private async fenced(tx: Prisma.TransactionClient, job: LedgerJob) {
    const rows =
      job.kind === 'operation'
        ? await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT id FROM billing_operations WHERE id=${job.row.id}::uuid AND status='processing' AND lease_token=${job.row.leaseToken}::uuid AND lease_until>now() FOR UPDATE`
        : await tx.$queryRaw<
            Array<{ id: string }>
          >`SELECT id FROM billing_webhook_inbox WHERE id=${job.row.id}::uuid AND status='processing' AND lease_token=${job.row.leaseToken}::uuid AND lease_until>now() FOR UPDATE`;
    if (!rows.length) throw new GatewayError('BILLING_LEASE_LOST', true);
  }
  private unsubmitted(row: BillingOperation): boolean {
    const data = row.requestData;
    return (
      row.kind === 'checkout' &&
      data !== null &&
      typeof data === 'object' &&
      !Array.isArray(data) &&
      data.checkoutSubmission === 'not_started'
    );
  }
  async markCheckoutSubmitted(job: LedgerJob) {
    if (
      job.kind !== 'operation' ||
      job.row.kind !== 'checkout' ||
      job.recovering
    )
      throw new GatewayError('BILLING_JOB_INVALID', true);
    await billingTransaction(this.prisma, async (tx) => {
      await this.fenced(tx, job);
      const row = await tx.billingOperation.findUniqueOrThrow({
        where: { id: job.row.id },
      });
      const data = row.requestData;
      if (!data || typeof data !== 'object' || Array.isArray(data))
        throw new GatewayError('BILLING_JOB_INVALID', true);
      if (data.checkoutSubmission === 'possibly_submitted')
        throw new GatewayError('BILLING_CHECKOUT_UNCERTAIN');
      await tx.billingOperation.update({
        where: { id: row.id },
        data: {
          requestData: { ...data, checkoutSubmission: 'possibly_submitted' },
        },
      });
    });
  }
  private async expireCheckout(
    tx: Prisma.TransactionClient,
    job: LedgerJob,
    expired: VerifiedCheckoutExpiration,
    payments: VerifiedPayment[],
  ) {
    await tx.$executeRaw`SELECT id FROM billing_operations WHERE id=${expired.operationId}::uuid
      AND tenant_id=${expired.tenantId}::uuid AND provider_account_id=${job.row.providerAccountId}::uuid
      AND environment=${job.row.environment} FOR UPDATE`;
    const operation = await tx.billingOperation.findFirst({
      where: {
        id: expired.operationId,
        tenantId: expired.tenantId,
        environment: job.row.environment,
        providerAccountId: job.row.providerAccountId,
        kind: 'checkout',
      },
    });
    if (
      !operation ||
      (operation.externalResourceId &&
        operation.externalResourceId !== expired.checkoutId)
    )
      throw new GatewayError('BILLING_EXPIRATION_MISMATCH', true);
    await lockBillingAccount(tx, expired.tenantId);
    const obligation = await tx.billingObligation.findFirstOrThrow({
      where: {
        id: operation.entityId,
        tenantId: expired.tenantId,
        environment: job.row.environment,
        providerAccountId: job.row.providerAccountId,
      },
      include: { billingOrder: true, billingSubscription: true },
    });
    const sub = obligation.billingSubscription;
    if (
      obligation.billingOrder.externalReference !== expired.reference ||
      sub.id !== expired.localSubscriptionId ||
      sub.provider !== 'stripe' ||
      obligation.amountMinor !== expired.money.amountMinor ||
      obligation.currency !== expired.money.currency ||
      sub.externalSubscriptionId
    )
      throw new GatewayError('BILLING_EXPIRATION_MISMATCH', true);
    // Never turn a confirmed or reversed payment back into an unpaid purchase.
    if (obligation.status === 'paid' || obligation.creditedPaymentId)
      throw new GatewayError('BILLING_EXPIRATION_CONFLICT', true);
    if (payments.some((p) => !['failed', 'canceled'].includes(p.status)))
      throw new GatewayError('BILLING_EXPIRATION_CONFLICT', true);
    if (obligation.status === 'void') return;
    for (const payment of payments)
      await this.settle(
        tx,
        job.row.providerAccountId,
        job.row.environment as BillingEnvironment,
        payment,
      );
    if (
      await tx.billingPayment.count({
        where: {
          obligationId: obligation.id,
          tenantId: expired.tenantId,
          environment: job.row.environment,
          status: { notIn: ['failed', 'canceled'] },
        },
      })
    )
      throw new GatewayError('BILLING_EXPIRATION_CONFLICT', true);
    await tx.billingObligation.update({
      where: { id: obligation.id },
      data: { status: 'void' },
    });
    await tx.billingOrder.update({
      where: { id: obligation.orderId },
      data: { status: 'expired' },
    });
    const coverage = await tx.billingAccessPeriod.count({
      where: {
        tenantId: expired.tenantId,
        environment: job.row.environment,
        billingObligation: { subscriptionId: sub.id },
        kind: 'paid',
      },
    });
    if (
      !coverage &&
      !sub.paidThrough &&
      ['pending', 'cancel_pending'].includes(sub.status)
    )
      await tx.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'ended' },
      });
    await tx.billingOperation.update({
      where: { id: operation.id },
      data: {
        externalResourceId: expired.checkoutId,
        status: 'succeeded',
        leaseToken: null,
        leaseUntil: null,
        errorCode: null,
      },
    });
    await tx.billingAudit.create({
      data: {
        tenantId: expired.tenantId,
        environment: job.row.environment,
        entityId: obligation.id,
        correlationId: randomUUID(),
        action: 'checkout.expired',
        previousState: 'open',
        nextState: 'void',
      },
    });
  }
  async finish(
    job: LedgerJob,
    result: {
      externalId?: string;
      snapshot?: GatewaySnapshot;
      binding?: { productId: string | null; priceId: string | null };
      canceled?: boolean;
    } = {},
  ) {
    return billingTransaction(this.prisma, async (tx) => {
      await this.fenced(tx, job);
      if (result.snapshot?.checkoutExpiration)
        await this.expireCheckout(
          tx,
          job,
          result.snapshot.checkoutExpiration,
          result.snapshot.payments,
        );
      else
        for (const payment of result.snapshot?.payments ?? [])
          await this.settle(
            tx,
            job.row.providerAccountId,
            job.row.environment as BillingEnvironment,
            payment,
          );
      if (result.snapshot?.subscription) {
        const remote = result.snapshot.subscription;
        const order = await tx.billingOrder.findFirst({
          where: {
            externalReference: remote.reference,
            environment: job.row.environment,
          },
        });
        if (!order) throw new GatewayError('BILLING_REFERENCE_UNKNOWN', true);
        await lockBillingAccount(tx, order.tenantId);
        const sub = await tx.billingSubscription.findFirstOrThrow({
          where: {
            id: order.subscriptionId,
            tenantId: order.tenantId,
            environment: job.row.environment,
            providerAccountId: job.row.providerAccountId,
            mode: 'automatic',
          },
        });
        if (
          sub.externalSubscriptionId &&
          sub.externalSubscriptionId !== remote.id
        )
          throw new GatewayError('BILLING_SUBSCRIPTION_MISMATCH', true);
        await tx.billingSubscription.update({
          where: { id: sub.id },
          data: {
            externalSubscriptionId: remote.id,
            ...(remote.stopped
              ? { renewalStoppedAt: new Date(), status: 'canceled' }
              : {}),
          },
        });
      }
      if (job.kind === 'operation') {
        if (result.binding)
          await tx.billingPriceBinding.update({
            where: {
              priceId_providerAccountId: {
                priceId: job.row.entityId,
                providerAccountId: job.row.providerAccountId,
              },
            },
            data: {
              status: 'ready',
              externalProductId: result.binding.productId,
              externalPriceId: result.binding.priceId,
              errorCode: null,
            },
          });
        if (job.row.kind === 'checkout' && result.externalId)
          await tx.billingOrder.updateMany({
            where: {
              tenantId: job.row.tenantId!,
              environment: job.row.environment,
              billingObligation: { some: { id: job.row.entityId } },
              status: 'created',
            },
            data: { status: 'pending' },
          });
        if (result.canceled) {
          await lockBillingAccount(tx, job.row.tenantId!);
          await tx.billingSubscription.update({
            where: {
              id: job.row.entityId,
              tenantId: job.row.tenantId!,
              providerAccountId: job.row.providerAccountId,
              environment: job.row.environment,
            },
            data: { status: 'canceled', renewalStoppedAt: new Date() },
          });
        }
        await tx.billingOperation.update({
          where: { id: job.row.id },
          data: {
            status: 'succeeded',
            leaseToken: null,
            leaseUntil: null,
            errorCode: null,
            ...(result.externalId
              ? { externalResourceId: result.externalId }
              : {}),
          },
        });
      } else
        await tx.billingWebhookInbox.update({
          where: { id: job.row.id },
          data: {
            status: 'completed',
            leaseToken: null,
            leaseUntil: null,
            errorCode: null,
          },
        });
      await tx.billingAudit.create({
        data: {
          tenantId: job.kind === 'operation' ? job.row.tenantId : null,
          environment: job.row.environment,
          entityId: job.row.id,
          correlationId: randomUUID(),
          action: 'ledger.completed',
          previousState: 'processing',
          nextState: job.kind === 'operation' ? 'succeeded' : 'completed',
        },
      });
    });
  }
  async fail(
    job: LedgerJob,
    code: string,
    permanent = false,
    retryAfterMs = 0,
  ) {
    const review = permanent || job.row.attempts >= 10;
    // No raw SDK error messages, response bodies, emails or URLs in persistence.
    const errorCode = /^[A-Z_]{1,80}$/.test(code)
      ? code
      : 'BILLING_PROVIDER_UNAVAILABLE';
    const data = {
      status: review
        ? 'review'
        : job.kind === 'operation'
          ? 'uncertain'
          : 'ready',
      leaseToken: null,
      leaseUntil: null,
      errorCode,
      nextAttemptAt: new Date(
        Date.now() +
          Math.max(
            Math.min(86400000, retryAfterMs),
            Math.floor(
              Math.random() * Math.min(3600000, 3000 * 2 ** job.row.attempts),
            ),
          ),
      ),
    };
    const where = {
      id: job.row.id,
      status: 'processing',
      leaseToken: job.row.leaseToken,
      leaseUntil: { gt: new Date() },
    };
    await billingTransaction(this.prisma, async (tx) => {
      if (!review && job.kind === 'operation') {
        const current = await tx.billingOperation.findUniqueOrThrow({
          where: { id: job.row.id },
        });
        if (this.unsubmitted(current)) data.status = 'ready';
      }
      const changed =
        job.kind === 'operation'
          ? await tx.billingOperation.updateMany({ where, data })
          : await tx.billingWebhookInbox.updateMany({ where, data });
      if (changed.count)
        await tx.billingAudit.create({
          data: {
            tenantId: job.kind === 'operation' ? job.row.tenantId : null,
            environment: job.row.environment,
            entityId: job.row.id,
            correlationId: randomUUID(),
            action: review ? 'ledger.review' : 'ledger.retry_scheduled',
            previousState: 'processing',
            nextState: data.status,
          },
        });
    });
  }
  async operatorOperation(actorId: string, operationId: string) {
    return billingTransaction(this.prisma, async (tx) => {
      await assertBillingOperator(tx, actorId);
      return tx.billingOperation.findUniqueOrThrow({
        where: { id: operationId },
      });
    });
  }
  async retry(
    actorId: string,
    id: string,
    kind: 'operation' | 'inbox',
    transaction?: Prisma.TransactionClient,
  ) {
    const work = async (tx: Prisma.TransactionClient) => {
      await assertBillingOperator(tx, actorId);
      const row =
        kind === 'operation'
          ? await tx.billingOperation.findUniqueOrThrow({ where: { id } })
          : await tx.billingWebhookInbox.findUniqueOrThrow({ where: { id } });
      if (row.status !== 'review')
        throw billingConflict('BILLING_REVIEW_REQUIRED');
      const data = {
        status:
          kind === 'operation' && !this.unsubmitted(row as BillingOperation)
            ? 'uncertain'
            : 'ready',
        attempts: 0,
        nextAttemptAt: new Date(),
        errorCode: null,
      };
      const changed =
        kind === 'operation'
          ? await tx.billingOperation.updateMany({
              where: { id, status: 'review' },
              data,
            })
          : await tx.billingWebhookInbox.updateMany({
              where: { id, status: 'review' },
              data,
            });
      if (changed.count !== 1) throw billingConflict('BILLING_REVIEW_CONFLICT');
      await tx.billingAudit.create({
        data: {
          actorId,
          tenantId:
            kind === 'operation' ? (row as BillingOperation).tenantId : null,
          environment: row.environment,
          entityId: row.id,
          correlationId: randomUUID(),
          action: 'ledger.retry',
          previousState: 'review',
          nextState: data.status,
        },
      });
      // Only durable proof of not_started permits creation. Legacy/possibly
      // submitted checkouts stay uncertain; operator replay cannot authorize a second POST.
    };
    return billingTransaction(this.prisma, work, transaction);
  }
  async command(job: LedgerJob): Promise<CheckoutCommand> {
    if (job.kind !== 'operation' || !job.row.tenantId)
      throw new GatewayError('BILLING_JOB_INVALID', true);
    const obligationTarget =
      job.row.requestData &&
      typeof job.row.requestData === 'object' &&
      !Array.isArray(job.row.requestData) &&
      job.row.requestData.target === 'obligation';
    const obligation =
      job.row.kind === 'checkout' || obligationTarget
        ? await this.prisma.billingObligation.findFirstOrThrow({
            where: {
              id: job.row.entityId,
              tenantId: job.row.tenantId,
              environment: job.row.environment,
            },
          })
        : await this.prisma.billingObligation.findFirstOrThrow({
            where: {
              subscriptionId: job.row.entityId,
              tenantId: job.row.tenantId,
              environment: job.row.environment,
            },
            orderBy: { createdAt: 'asc' },
          });
    const sub = await this.prisma.billingSubscription.findUniqueOrThrow({
      where: { id: obligation.subscriptionId },
    });
    if (
      job.row.kind === 'checkout' &&
      ['cancel_pending', 'canceled', 'ended'].includes(sub.status)
    )
      throw new GatewayError('BILLING_CHECKOUT_CANCELED', true);
    const order = await this.prisma.billingOrder.findUniqueOrThrow({
      where: { id: obligation.orderId },
    });
    const price = await this.prisma.billingPrice.findUniqueOrThrow({
      where: { id: sub.priceId },
    });
    const version = await this.prisma.billingPlanVersion.findUniqueOrThrow({
      where: { id: sub.planVersionId },
    });
    const binding = await this.prisma.billingPriceBinding.findUnique({
      where: {
        priceId_providerAccountId: {
          priceId: price.id,
          providerAccountId: sub.providerAccountId,
        },
      },
    });
    // Server-selected billing contact. Never accept this through a checkout DTO.
    const admin = await this.prisma.user.findFirst({
      where: {
        tenantId: sub.tenantId,
        isActive: true,
        roles: { some: { role: { code: 'admin' } } },
      },
      orderBy: { createdAt: 'asc' },
      select: { email: true },
    });
    const checkoutOperation =
      job.row.kind === 'checkout'
        ? job.row
        : await this.prisma.billingOperation.findFirst({
            where: {
              tenantId: sub.tenantId,
              providerAccountId: sub.providerAccountId,
              kind: 'checkout',
              entityId: obligation.id,
            },
          });
    return {
      operationId: checkoutOperation?.id ?? job.row.id,
      ...(checkoutOperation?.externalResourceId
        ? { knownCheckoutId: checkoutOperation.externalResourceId }
        : {}),
      reference: order.externalReference,
      tenantId: sub.tenantId,
      subscriptionId: sub.id,
      money: {
        amountMinor: obligation.amountMinor,
        currency: obligation.currency as BillingCurrency,
      },
      interval: price.interval as BillingInterval,
      mode: sub.mode as BillingMode,
      externalPriceId: binding?.externalPriceId ?? null,
      title: version.name,
      ...(admin ? { payerEmail: admin.email } : {}),
    };
  }
  async syncCommand(priceId: string) {
    const price = await this.prisma.billingPrice.findUniqueOrThrow({
      where: { id: priceId },
      include: { billingPlanVersion: true },
    });
    return {
      id: price.id,
      title: price.billingPlanVersion.name,
      money: {
        amountMinor: price.amountMinor,
        currency: price.currency as BillingCurrency,
      },
      interval: price.interval as BillingInterval,
    };
  }
  async subscription(id: string, tenantId: string, environment: string) {
    return this.prisma.billingSubscription.findFirstOrThrow({
      where: { id, tenantId, environment },
    });
  }
  async scheduleReconciliation(accountIds: string[]) {
    // One durable check per 15-minute bucket, including canceled contracts to
    // discover late payments/refunds. No debit is initiated by this scheduler.
    let cursor: string | undefined;
    while (true) {
      const subs = await this.prisma.billingSubscription.findMany({
        where: {
          providerAccountId: { in: accountIds },
          mode: 'automatic',
          NOT: {
            status: 'ended',
            externalSubscriptionId: null,
            billingObligation: { every: { status: 'void' } },
          },
        },
        orderBy: { id: 'asc' },
        take: 100,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      for (const sub of subs)
        await billingTransaction(this.prisma, async (tx) => {
          const bucket = ['canceled', 'ended'].includes(sub.status)
            ? 86400000
            : 900000;
          await this.operation(tx, {
            tenantId: sub.tenantId,
            environment: sub.environment,
            providerAccountId: sub.providerAccountId,
            kind: 'reconcile',
            entityId: sub.id,
            key: `poll.${sub.id}.${Math.floor(Date.now() / bucket)}`,
          });
        });
      if (subs.length < 100) break;
      cursor = subs.at(-1)!.id;
    }
    cursor = undefined;
    while (true) {
      const obligations: BillingObligation[] =
        await this.prisma.billingObligation.findMany({
          where: {
            providerAccountId: { in: accountIds },
            billingSubscription: { mode: 'manual' },
            status: { not: 'void' },
          },
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
      for (const o of obligations)
        await billingTransaction(this.prisma, async (tx) => {
          const bucket = o.status === 'paid' ? 86400000 : 900000;
          await this.operation(tx, {
            tenantId: o.tenantId,
            environment: o.environment,
            providerAccountId: o.providerAccountId,
            kind: 'reconcile',
            entityId: o.id,
            target: 'obligation',
            key: `poll.${o.id}.${Math.floor(Date.now() / bucket)}`,
          });
        });
      if (obligations.length < 100) break;
      cursor = obligations.at(-1)!.id;
    }
  }

  private async settle(
    tx: Prisma.TransactionClient,
    accountId: string,
    environment: BillingEnvironment,
    payment: VerifiedPayment,
  ) {
    const origin = await tx.billingOrder.findFirst({
      where: { externalReference: payment.reference, environment },
    });
    if (!origin) throw new GatewayError('BILLING_REFERENCE_UNKNOWN', true);
    await lockBillingAccount(tx, origin.tenantId);
    const sub = await tx.billingSubscription.findFirstOrThrow({
      where: {
        id: origin.subscriptionId,
        tenantId: origin.tenantId,
        environment,
        providerAccountId: accountId,
      },
    });
    const price = await tx.billingPrice.findUniqueOrThrow({
      where: { id: sub.priceId },
    });
    if (
      (payment.tenantId && payment.tenantId !== sub.tenantId) ||
      (payment.localSubscriptionId && payment.localSubscriptionId !== sub.id) ||
      (payment.interval && payment.interval !== price.interval)
    )
      throw new GatewayError('BILLING_CONTRACT_MISMATCH', true);
    if (payment.externalPriceId) {
      const binding = await tx.billingPriceBinding.findUniqueOrThrow({
        where: {
          priceId_providerAccountId: {
            priceId: price.id,
            providerAccountId: accountId,
          },
        },
      });
      if (binding.externalPriceId !== payment.externalPriceId)
        throw new GatewayError('BILLING_CONTRACT_MISMATCH', true);
    }
    if (
      payment.money.amountMinor !== price.amountMinor ||
      payment.money.currency !== price.currency
    )
      throw new GatewayError('BILLING_PAYMENT_MISMATCH', true);
    if (sub.mode === 'automatic') {
      if (
        !payment.subscriptionId ||
        !payment.cycleId ||
        !payment.period ||
        (sub.externalSubscriptionId &&
          sub.externalSubscriptionId !== payment.subscriptionId)
      )
        throw new GatewayError('BILLING_CYCLE_MISMATCH', true);
      await tx.billingSubscription.update({
        where: { id: sub.id },
        data: { externalSubscriptionId: payment.subscriptionId },
      });
    } else if (payment.subscriptionId)
      throw new GatewayError('BILLING_CYCLE_MISMATCH', true);
    let obligation = await tx.billingObligation.findFirstOrThrow({
      where: { orderId: origin.id, tenantId: origin.tenantId, environment },
    });
    let reference = origin.externalReference;
    if (payment.cycleId) {
      const cycleKey = `remote:${payment.cycleId}`;
      if (cycleKey.length > 128)
        throw new GatewayError('BILLING_CYCLE_INVALID', true);
      const same = await tx.billingObligation.findFirst({
        where: {
          subscriptionId: sub.id,
          tenantId: sub.tenantId,
          environment,
          cycleKey,
        },
      });
      if (same) {
        obligation = same;
        reference = (
          await tx.billingOrder.findUniqueOrThrow({
            where: { id: same.orderId },
          })
        ).externalReference;
      } else if (!obligation.cycleKey.startsWith('remote:')) {
        obligation = await tx.billingObligation.update({
          where: { id: obligation.id },
          data: { cycleKey },
        });
      } else {
        const order = await tx.billingOrder.create({
          data: {
            tenantId: sub.tenantId,
            environment,
            subscriptionId: sub.id,
            externalReference: randomUUID(),
          },
        });
        reference = order.externalReference;
        obligation = await tx.billingObligation.create({
          data: {
            tenantId: sub.tenantId,
            environment,
            subscriptionId: sub.id,
            orderId: order.id,
            providerAccountId: accountId,
            cycleKey,
            amountMinor: price.amountMinor,
            currency: price.currency,
          },
        });
      }
    }
    if (obligation.status === 'void') {
      if (
        ['failed', 'canceled'].includes(payment.status) &&
        payment.refundedMinor === 0n &&
        !payment.chargedBack
      )
        return;
      throw new GatewayError('BILLING_PAYMENT_AFTER_EXPIRATION', true);
    }
    const result = await this.settlements.recordObservation(
      sub.tenantId,
      environment,
      {
        tenantId: sub.tenantId,
        environment,
        obligationId: obligation.id,
        externalReference: reference,
        provider: sub.provider as BillingProvider,
        accountId,
        money: payment.money,
        paymentId: payment.id,
        status: payment.status,
        refundedMinor: payment.refundedMinor,
        chargedBack: payment.chargedBack,
      },
      {
        providerStatus: payment.providerStatus,
        paidAt: payment.paidAt,
        ...(payment.period ? { recurringPeriod: payment.period } : {}),
      },
      tx,
    );
    if (
      ['pending', 'failed'].includes(payment.status) &&
      sub.status === 'active' &&
      sub.paidThrough &&
      sub.paidThrough < new Date()
    )
      await tx.billingSubscription.update({
        where: { id: sub.id },
        data: { status: 'past_due' },
      });
    for (const adjustment of payment.adjustments)
      await tx.billingAdjustment.upsert({
        where: {
          providerAccountId_kind_externalAdjustmentId: {
            providerAccountId: accountId,
            kind: adjustment.kind,
            externalAdjustmentId: adjustment.id,
          },
        },
        create: {
          tenantId: sub.tenantId,
          environment,
          paymentId: result.payment.id,
          providerAccountId: accountId,
          kind: adjustment.kind,
          externalAdjustmentId: adjustment.id,
          amountMinor: adjustment.amountMinor,
          currency: payment.money.currency,
          providerStatus: adjustment.status,
          confirmed: adjustment.confirmed,
          observedAt: new Date(),
        },
        update: {
          providerStatus: adjustment.status,
          confirmed: adjustment.confirmed,
          observedAt: new Date(),
        },
      });
  }
}
