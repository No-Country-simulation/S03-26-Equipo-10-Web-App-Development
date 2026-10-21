import { z } from 'zod';
import {
  Injectable,
  Logger,
  type OnModuleInit,
  type OnModuleDestroy,
} from '@nestjs/common';
import {
  BillingLedgerRepository,
  type LedgerJob,
} from '../repositories/billing-ledger.repository';
import { BillingGateways } from './billing-gateways.service';
import { GatewayError } from '../ports/financial-gateway.port';

@Injectable()
export class BillingProcessor implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setTimeout>;
  private running: Promise<void> | null = null;
  private stopped = false;
  private lastSchedule = 0;
  private readonly logger = new Logger(BillingProcessor.name);
  constructor(
    private readonly ledger: BillingLedgerRepository,
    private readonly gateways: BillingGateways,
  ) {}
  onModuleInit() {
    if (this.gateways.config.mode === 'sandbox') this.schedule();
  }
  private schedule() {
    if (!this.stopped) {
      this.timer = setTimeout(() => {
        this.running = this.tick()
          .catch(() => {
            this.logger.warn('BILLING_POLL_FAILED');
          })
          .finally(() => {
            this.running = null;
            this.schedule();
          });
      }, 3000);
      this.timer.unref();
    }
  }
  async onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    await this.running;
  }
  async tick(accountIds = this.gateways.accountIds()) {
    if (this.gateways.config.mode === 'disabled') return;
    if (Date.now() - this.lastSchedule > 60000) {
      await this.ledger.scheduleReconciliation(accountIds);
      this.lastSchedule = Date.now();
    }
    // Bounded concurrency and batch; each claim uses SKIP LOCKED.
    await Promise.all([this.batch(accountIds), this.batch(accountIds)]);
  }
  private async batch(accountIds: string[]) {
    for (let i = 0; i < 5; i++) {
      const job = await this.ledger.claim(
        accountIds,
        i % 2 ? 'inbox' : 'operation',
      );
      if (job) await this.process(job);
    }
  }
  async process(job: LedgerJob) {
    if (job.row.attempts > 10) {
      await this.ledger.fail(job, 'BILLING_RETRY_EXHAUSTED', true);
      return;
    }
    let leaseLost = false;
    const heartbeat = setInterval(() => {
      void this.ledger
        .heartbeat(job)
        .then((ok) => {
          if (!ok) leaseLost = true;
        })
        .catch(() => {
          leaseLost = true;
        });
    }, 20000);
    heartbeat.unref();
    try {
      const gateway = await this.gateways.get(job.row.providerAccountId);
      await gateway.assertAccount();
      if (job.kind === 'inbox') {
        const snapshot = await gateway.read(job.row.topic, job.row.resourceId);
        if (leaseLost) throw new GatewayError('BILLING_LEASE_LOST', true);
        await this.ledger.finish(job, { snapshot });
        return;
      }
      if (job.row.kind === 'sync_catalog') {
        const binding = await gateway.syncPrice(
          await this.ledger.syncCommand(job.row.entityId),
        );
        await this.ledger.finish(job, { binding });
        return;
      }
      const command = await this.ledger.command(job);
      if (job.row.kind === 'checkout') {
        const checkout = job.recovering
          ? await gateway.findCheckout(
              command,
              job.row.externalResourceId ?? undefined,
            )
          : await gateway.createCheckout(command);
        if (!checkout) throw new GatewayError('BILLING_CHECKOUT_UNCERTAIN');
        await this.ledger.finish(job, { externalId: checkout.id });
        return;
      }
      const sub = await this.ledger.subscription(
        command.subscriptionId,
        job.row.tenantId!,
        job.row.environment,
      );
      if (job.row.kind === 'stop_renewal') {
        if (sub.mode === 'manual') {
          await this.ledger.finish(job, { canceled: true });
          return;
        }
        let externalId = sub.externalSubscriptionId;
        if (!externalId) {
          const snapshot = await gateway.reconcile(
            command,
            command.knownCheckoutId,
          );
          externalId = snapshot.subscription?.id ?? null;
        }
        if (!externalId || !(await gateway.stopRenewal(externalId, job.row.id)))
          throw new GatewayError('BILLING_CANCELLATION_UNCERTAIN');
        const snapshot = await gateway.reconcile(command, externalId);
        await this.ledger.finish(job, { canceled: true, snapshot });
        return;
      }
      const snapshot = await gateway.reconcile(
        command,
        sub.externalSubscriptionId ?? command.knownCheckoutId,
      );
      await this.ledger.finish(job, { snapshot });
    } catch (error) {
      const code =
        error instanceof GatewayError
          ? error.code
          : 'BILLING_PROVIDER_UNAVAILABLE';
      const retry =
        error instanceof GatewayError
          ? error.retryAfterMs
          : this.retryDelay(error);
      await this.ledger.fail(
        job,
        code,
        (error instanceof GatewayError && error.permanent) ||
          error instanceof z.ZodError,
        retry,
      );
      this.logger.warn({ code, jobId: job.row.id, kind: job.kind });
    } finally {
      clearInterval(heartbeat);
    }
  }
  private retryDelay(error: unknown): number {
    const parsed = z
      .object({ headers: z.record(z.string(), z.unknown()).optional() })
      .safeParse(error);
    const value = parsed.success ? parsed.data.headers?.['retry-after'] : null;
    if (typeof value !== 'string') return 0;
    const result = /^\d+$/.test(value)
      ? Number(value) * 1000
      : Date.parse(value) - Date.now();
    return Number.isFinite(result) ? Math.max(0, result) : 0;
  }
}
