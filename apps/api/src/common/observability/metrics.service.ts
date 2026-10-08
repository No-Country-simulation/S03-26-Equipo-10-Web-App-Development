import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { collectDefaultMetrics, Counter, Gauge, Histogram, Registry } from '@prometheus-io/client';
import { PrismaService } from '../../modules/database/prisma.service';

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsService.name);
  private readonly lag = monitorEventLoopDelay({ resolution: 20 });
  private timer?: NodeJS.Timeout;
  private sampling = false;
  readonly registry = new Registry();
  private readonly requests = new Counter({ name: 'tms_http_requests_total',
    help: 'API requests by method, route and status', labelNames: ['method', 'route', 'status'],
    registers: [this.registry] });
  private readonly requestDuration = new Histogram({ name: 'tms_http_request_duration_seconds',
    help: 'API request latency in seconds', labelNames: ['method', 'route'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry] });
  private readonly attempts = new Counter({ name: 'tms_webhook_attempts_total',
    help: 'Webhook delivery attempts by result', labelNames: ['result'], registers: [this.registry] });
  private readonly pendingAge = new Gauge({ name: 'tms_outbox_oldest_pending_age_seconds',
    help: 'Age of the oldest pending outbox event', registers: [this.registry] });
  private readonly pendingDeliveries = new Gauge({ name: 'tms_webhook_deliveries_pending',
    help: 'Pending webhook deliveries', registers: [this.registry] });
  private readonly deadDeliveries = new Gauge({ name: 'tms_webhook_deliveries_dead',
    help: 'Dead webhook deliveries requiring administrative action', registers: [this.registry] });
  private readonly outboxPollFailures = new Counter({ name: 'tms_outbox_poll_failures_total',
    help: 'Failed outbox polling cycles', registers: [this.registry] });
  private readonly logoCleanups = new Counter({ name: 'tms_tenant_logo_cleanup_total',
    help: 'Tenant logo cleanup results', labelNames: ['result'], registers: [this.registry] });
  private readonly deadLogoCleanups = new Gauge({ name: 'tms_tenant_logo_cleanup_dead',
    help: 'Dead tenant logo cleanup jobs, including expired final leases', registers: [this.registry] });

  constructor(private readonly prisma: PrismaService) {
    collectDefaultMetrics({ register: this.registry, prefix: 'tms_' });
  }

  onModuleInit(): void {
    this.lag.enable();
    this.timer = setInterval(() => { void this.logOutboxHealth(); }, 30_000);
  }

  recordHttp(method: string, route: string, statusCode: number, durationMs: number): void {
    const labels = { method, route, status: String(statusCode) };
    this.requests.inc(labels);
    this.requestDuration.observe({ method, route }, durationMs / 1000);
  }

  recordWebhookAttempt(status: number | null): void {
    const result = status === null ? 'network' : status >= 200 && status < 300 ? 'success'
      : status >= 500 ? 'server_error' : status === 429 ? 'rate_limited' : 'other_failure';
    this.attempts.inc({ result });
  }

  recordOutboxPollFailure(): void { this.outboxPollFailures.inc(); }

  recordLogoCleanup(result: 'completed' | 'retry' | 'dead'): void { this.logoCleanups.inc({ result }); }

  private async snapshotOutbox(): Promise<{ oldestPendingAgeSeconds: number; pendingDeliveries: number; deadDeliveries: number }> {
    const [oldest, pending, dead] = await Promise.all([
      this.prisma.outboxEvent.findFirst({ where: { status: 'pending' },
        orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
      this.prisma.webhookDelivery.count({ where: { status: 'pending' } }),
      this.prisma.webhookDelivery.count({ where: { status: 'dead' } }),
    ]);
    return { oldestPendingAgeSeconds: oldest ? Math.max(0, (Date.now() - oldest.createdAt.getTime()) / 1000) : 0,
      pendingDeliveries: pending, deadDeliveries: dead };
  }

  private async logOutboxHealth(): Promise<void> {
    if (this.sampling) return;
    this.sampling = true;
    try {
      const snapshot = await this.snapshotOutbox();
      this.logger.log({ event: 'outbox.health', ...snapshot,
        eventLoopLagSeconds: Number.isFinite(this.lag.mean) ? this.lag.mean / 1e9 : 0 });
      this.lag.reset();
    } catch {
      this.logger.warn({ event: 'outbox.health_unavailable' }, 'Outbox health snapshot unavailable');
    } finally {
      this.sampling = false;
    }
  }

  async render(): Promise<string> {
    const [{ oldestPendingAgeSeconds, pendingDeliveries, deadDeliveries }, deadLogos] = await Promise.all([
      this.snapshotOutbox(), this.prisma.tenantLogoCleanupJob.count({ where: { status: 'dead' } }),
    ]);
    this.pendingAge.set(oldestPendingAgeSeconds);
    this.pendingDeliveries.set(pendingDeliveries);
    this.deadDeliveries.set(deadDeliveries);
    this.deadLogoCleanups.set(deadLogos);
    return this.registry.metrics();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
    this.lag.disable();
    this.registry.clear();
  }
}
