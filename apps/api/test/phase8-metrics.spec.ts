import { MetricsService } from '../src/common/observability/metrics.service';
import { MetricsController } from '../src/common/observability/metrics.controller';

describe('protected RED and outbox metrics', () => {
  const prisma = {
    outboxEvent: { findFirst: jest.fn().mockResolvedValue({ createdAt: new Date(Date.now() - 360_000) }) },
    webhookDelivery: { count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1) },
  };

  it('exports bounded route labels, lag, pending age and dead deliveries', async () => {
    const metrics = new MetricsService(prisma as any);
    metrics.recordHttp('GET', '/testimonials/:id', 200, 25);
    metrics.recordWebhookAttempt(503);
    const rendered = await metrics.render();
    expect(rendered).toContain('tms_http_requests_total');
    expect(rendered).toContain('route="/testimonials/:id"');
    expect(rendered).toContain('tms_outbox_oldest_pending_age_seconds');
    expect(rendered).toContain('tms_webhook_deliveries_dead 1');
    expect(rendered).toContain('tms_webhook_attempts_total{result="server_error"} 1');
    expect(rendered).toContain('tms_nodejs_eventloop_lag_seconds');
    metrics.onModuleDestroy();
  });

  it('does not expose the metrics endpoint without its secret', async () => {
    const metrics = { registry: { contentType: 'text/plain' }, render: jest.fn().mockResolvedValue('ok') };
    const controller = new MetricsController(metrics as any,
      { getOrThrow: () => ({ metricsToken: 'long-synthetic-token' }) } as any);
    const response = { sendStatus: jest.fn(), type: jest.fn(), send: jest.fn() };
    response.type.mockReturnValue(response);
    await controller.scrape({ header: () => 'wrong' } as any, response as any);
    expect(response.sendStatus).toHaveBeenCalledWith(404);
    expect(metrics.render).not.toHaveBeenCalled();
    await controller.scrape({ header: () => 'long-synthetic-token' } as any, response as any);
    expect(metrics.render).toHaveBeenCalledTimes(1);
    expect(response.send).toHaveBeenCalledWith('ok');
  });
});
