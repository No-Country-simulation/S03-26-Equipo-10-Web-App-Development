import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import {
  DELIVERY_BUDGET_MS, DELIVERY_LEASE_MS, MAX_DELIVERY_ATTEMPTS,
  hasDeliveryBudget, isRetryableDelivery, retryDelayMs,
} from '../services/delivery-retry-policy';
import { redactDeliveryText } from '../utils/redact-delivery-text';

export interface OutboxEventInput {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
  targetWebhookId?: string;
}

export interface ClaimedDelivery {
  id: string;
  leaseToken: string;
  attemptNo: number;
  webhookId: string;
  outboxEventId: string;
  retryBudgetAttempts: number;
  retryBudgetStartedAt: Date;
}

export interface DeliveryResult {
  status: number | null;
  body?: string;
  errorMessage?: string;
}

/** Congela los destinatarios dentro de la transacción que crea el evento. */
export async function enqueueWebhookEvent(tx: Prisma.TransactionClient, event: OutboxEventInput): Promise<string> {
  const created = await tx.outboxEvent.create({
    data: {
      tenantId: event.tenantId,
      eventType: event.eventType,
      payload: event.payload as Prisma.InputJsonValue,
      status: 'pending',
      ...(event.targetWebhookId && { targetWebhookId: event.targetWebhookId }),
    },
    select: { id: true },
  });
  await tx.$executeRaw`
    INSERT INTO "webhook_deliveries"
      (id, "tenant_id", "webhook_id", "destination_url", "outbox_event_id", status, attempts, "retry_budget_attempts",
       "retry_budget_started_at", "created_at", "updated_at")
    SELECT gen_random_uuid(), e."tenant_id", w.id, w.url, e.id, 'pending', 0, 0, now(), now(), now()
    FROM "outbox_events" e
    JOIN "webhooks" w ON w."tenant_id" = e."tenant_id"
    JOIN "webhook_events" we ON we.id = w."event_id" AND we.code = e."event_type"
    WHERE e.id = ${created.id}::uuid
      AND (e."target_webhook_id" IS NULL OR e."target_webhook_id" = w.id)
      AND ((w."is_active" AND w."deleted_at" IS NULL) OR e."target_webhook_id" = w.id)
    ON CONFLICT ("outbox_event_id", "webhook_id") DO NOTHING
  `;
  await tx.$executeRaw`
    UPDATE "outbox_events" e
    SET "deliveries_initialized_at" = now(),
        status = CASE WHEN EXISTS (
          SELECT 1 FROM "webhook_deliveries" d
          WHERE d."outbox_event_id" = e.id AND d.status NOT IN ('success', 'dead')
        ) THEN 'pending' ELSE 'processed' END,
        "processed_at" = CASE WHEN EXISTS (
          SELECT 1 FROM "webhook_deliveries" d
          WHERE d."outbox_event_id" = e.id AND d.status NOT IN ('success', 'dead')
        ) THEN NULL ELSE now() END,
        "updated_at" = now()
    WHERE e.id = ${created.id}::uuid
  `;
  return created.id;
}

@Injectable()
export class OutboxRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(event: OutboxEventInput): Promise<string> {
    return this.prisma.$transaction(tx => enqueueWebhookEvent(tx, event));
  }

  /** Inicialización transaccional y repetible; incluye eventos legados. */
  async initializePending(limit = 25): Promise<number> {
    const batchSize = Math.min(Math.max(limit, 1), 100);
    return this.prisma.$transaction(async tx => {
      const events = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "outbox_events"
        WHERE status = 'pending' AND "deliveries_initialized_at" IS NULL
        ORDER BY "created_at", id
        FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
      `;
      for (const event of events) {
        await tx.$executeRaw`
          INSERT INTO "webhook_deliveries"
            (id, "tenant_id", "webhook_id", "destination_url", "outbox_event_id", status, attempts, "retry_budget_attempts",
             "retry_budget_started_at", "created_at", "updated_at")
          SELECT gen_random_uuid(), e."tenant_id", w.id, w.url, e.id, 'pending', 0, 0, now(), now(), now()
          FROM "outbox_events" e
          JOIN "webhooks" w ON w."tenant_id" = e."tenant_id"
          JOIN "webhook_events" we ON we.id = w."event_id" AND we.code = e."event_type"
          WHERE e.id = ${event.id}::uuid
            AND (e."target_webhook_id" IS NULL OR e."target_webhook_id" = w.id)
            AND ((w."is_active" AND w."deleted_at" IS NULL) OR e."target_webhook_id" = w.id)
          ON CONFLICT ("outbox_event_id", "webhook_id") DO NOTHING
        `;
        await tx.$executeRaw`
          UPDATE "outbox_events" e
          SET "deliveries_initialized_at" = now(),
              status = CASE WHEN EXISTS (
                SELECT 1 FROM "webhook_deliveries" d
                WHERE d."outbox_event_id" = e.id AND d.status NOT IN ('success', 'dead')
              ) THEN 'pending' ELSE 'processed' END,
              "processed_at" = CASE WHEN EXISTS (
                SELECT 1 FROM "webhook_deliveries" d
                WHERE d."outbox_event_id" = e.id AND d.status NOT IN ('success', 'dead')
              ) THEN NULL ELSE now() END,
              "updated_at" = now()
          WHERE e.id = ${event.id}::uuid
        `;
      }
      return events.length;
    });
  }

  /** Un lease vencido se recupera sin borrar el intento interrumpido. */
  async recoverExpired(limit = 25): Promise<number> {
    const batchSize = Math.min(Math.max(limit, 1), 100);
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{
        id: string; status: string; leaseToken: string | null;
        retryBudgetAttempts: number; retryBudgetStartedAt: Date; outboxEventId: string | null; dbNow: Date;
      }>>`
        SELECT id, status, "lease_token" AS "leaseToken",
               "retry_budget_attempts" AS "retryBudgetAttempts",
               "retry_budget_started_at" AS "retryBudgetStartedAt",
               "outbox_event_id" AS "outboxEventId", now() AS "dbNow"
        FROM "webhook_deliveries"
        WHERE (status = 'processing' AND "lease_until" <= now())
           OR (status = 'pending' AND (
             "retry_budget_attempts" >= ${MAX_DELIVERY_ATTEMPTS}
             OR "retry_budget_started_at" <= now() - (${DELIVERY_BUDGET_MS} * interval '1 millisecond')
           ))
        ORDER BY "created_at", id
        FOR UPDATE SKIP LOCKED LIMIT ${batchSize}
      `;
      for (const row of rows) {
        if (row.status === 'processing' && row.leaseToken) {
          await tx.webhookDeliveryAttempt.updateMany({
            where: { deliveryId: row.id, leaseToken: row.leaseToken, status: 'processing' },
            data: { status: 'interrupted', completedAt: row.dbNow, errorMessage: 'Delivery lease expired' },
          });
        }
        const now = row.dbNow;
        const retry = hasDeliveryBudget(row.retryBudgetAttempts, row.retryBudgetStartedAt, now);
        await tx.webhookDelivery.update({
          where: { id: row.id },
          data: {
            status: retry ? 'pending' : 'dead',
            nextRetryAt: retry ? new Date(now.getTime() + retryDelayMs(row.retryBudgetAttempts)) : null,
            leaseUntil: null, leaseToken: null, finishedAt: retry ? null : now,
            errorMessage: row.status === 'processing' ? 'Delivery lease expired' : 'Delivery budget exhausted',
          },
        });
        if (!retry && row.outboxEventId) await this.finalizeEvent(tx, row.outboxEventId);
      }
      return rows.length;
    });
  }

  /** SKIP LOCKED evita que dos réplicas adquieran la misma entrega. */
  async claimDue(limit = 5): Promise<ClaimedDelivery[]> {
    const batchSize = Math.min(Math.max(limit, 1), 25);
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{
        id: string; webhookId: string; outboxEventId: string;
        attempts: number; retryBudgetAttempts: number; retryBudgetStartedAt: Date;
      }>>`
        SELECT d.id, d."webhook_id" AS "webhookId", d."outbox_event_id" AS "outboxEventId",
               d.attempts, d."retry_budget_attempts" AS "retryBudgetAttempts",
               d."retry_budget_started_at" AS "retryBudgetStartedAt"
        FROM "webhook_deliveries" d
        JOIN "outbox_events" e ON e.id = d."outbox_event_id"
        WHERE d.status = 'pending' AND e.status = 'pending'
          AND e."deliveries_initialized_at" IS NOT NULL
          AND (d."next_retry_at" IS NULL OR d."next_retry_at" <= now())
          AND d."retry_budget_attempts" < ${MAX_DELIVERY_ATTEMPTS}
          AND d."retry_budget_started_at" > now() - (${DELIVERY_BUDGET_MS} * interval '1 millisecond')
        ORDER BY d."created_at", d.id
        FOR UPDATE OF d SKIP LOCKED LIMIT ${batchSize}
      `;
      const claimed: ClaimedDelivery[] = [];
      for (const row of rows) {
        const leaseToken = randomUUID();
        const attemptNo = row.attempts + 1;
        await tx.$executeRaw`
          UPDATE "webhook_deliveries"
          SET status = 'processing', attempts = attempts + 1,
              "retry_budget_attempts" = "retry_budget_attempts" + 1,
              "lease_token" = ${leaseToken}::uuid,
              "lease_until" = now() + (${DELIVERY_LEASE_MS} * interval '1 millisecond'),
              "next_retry_at" = NULL, "updated_at" = now()
          WHERE id = ${row.id}::uuid
        `;
        await tx.webhookDeliveryAttempt.create({
          data: { deliveryId: row.id, attemptNo, leaseToken, status: 'processing' },
        });
        claimed.push({
          id: row.id, webhookId: row.webhookId, outboxEventId: row.outboxEventId,
          attemptNo, leaseToken, retryBudgetAttempts: row.retryBudgetAttempts + 1,
          retryBudgetStartedAt: row.retryBudgetStartedAt,
        });
      }
      return claimed;
    });
  }

  async getDeliveryContext(deliveryId: string) {
    return this.prisma.webhookDelivery.findUnique({
      where: { id: deliveryId },
      include: { webhook: { include: { event: true } }, outboxEvent: true },
    });
  }

  /** El token del lease impide que un worker tardío sobrescriba el resultado. */
  async completeAttempt(claim: ClaimedDelivery, result: DeliveryResult): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      const clock = await tx.$queryRaw<Array<{ dbNow: Date }>>`SELECT now() AS "dbNow"`;
      const now = clock[0]!.dbNow;
      const success = result.status !== null && result.status >= 200 && result.status < 300;
      const retryable = !success && isRetryableDelivery(result.status);
      const retry = retryable && hasDeliveryBudget(claim.retryBudgetAttempts, claim.retryBudgetStartedAt, now);
      const status = success ? 'success' : retry ? 'pending' : 'dead';
      const updated = await tx.webhookDelivery.updateMany({
        where: { id: claim.id, leaseToken: claim.leaseToken, status: 'processing' },
        data: {
          status, leaseToken: null, leaseUntil: null,
          nextRetryAt: retry ? new Date(now.getTime() + retryDelayMs(claim.retryBudgetAttempts)) : null,
          finishedAt: retry ? null : now,
          responseCode: result.status,
          responseBody: redactDeliveryText(result.body) ?? null,
          errorMessage: redactDeliveryText(result.errorMessage) ?? null,
        },
      });
      if (updated.count !== 1) return false;
      await tx.webhookDeliveryAttempt.update({
        where: { deliveryId_attemptNo: { deliveryId: claim.id, attemptNo: claim.attemptNo } },
        data: {
          status: success ? 'success' : 'failed',
          responseCode: result.status,
          responseBody: redactDeliveryText(result.body) ?? null,
          errorMessage: redactDeliveryText(result.errorMessage) ?? null,
          completedAt: now,
        },
      });
      if (status !== 'pending') await this.finalizeEvent(tx, claim.outboxEventId);
      return true;
    });
  }

  async replayDead(tenantId: string, webhookId: string, deliveryId: string): Promise<boolean> {
    return this.prisma.$transaction(async tx => {
      const rows = await tx.$queryRaw<Array<{ outboxEventId: string }>>`
        SELECT d."outbox_event_id" AS "outboxEventId"
        FROM "webhook_deliveries" d JOIN "webhooks" w ON w.id = d."webhook_id"
        WHERE d.id = ${deliveryId}::uuid AND d."webhook_id" = ${webhookId}::uuid
          AND w."tenant_id" = ${tenantId}::uuid AND d.status = 'dead'
          AND d."outbox_event_id" IS NOT NULL
        FOR UPDATE OF d
      `;
      const row = rows[0];
      if (!row) return false;
      await tx.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'pending', retryBudgetAttempts: 0, retryBudgetStartedAt: new Date(),
          nextRetryAt: null, finishedAt: null, leaseToken: null, leaseUntil: null,
        },
      });
      await tx.outboxEvent.update({
        where: { id: row.outboxEventId },
        data: { status: 'pending', processedAt: null },
      });
      return true;
    });
  }

  private async finalizeEvent(tx: Prisma.TransactionClient, eventId: string): Promise<void> {
    // Serializa cierres de destinos distintos del mismo evento. Sin este lock,
    // ambos podrían observar al otro intento sin commit y dejar el outbox pending.
    await tx.$queryRaw`SELECT id FROM "outbox_events" WHERE id = ${eventId}::uuid FOR UPDATE`;
    await tx.$executeRaw`
      UPDATE "outbox_events" e
      SET status = 'processed', "processed_at" = now(), "updated_at" = now()
      WHERE e.id = ${eventId}::uuid AND e."deliveries_initialized_at" IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM "webhook_deliveries" d
          WHERE d."outbox_event_id" = e.id AND d.status NOT IN ('success', 'dead')
        )
    `;
  }
}
