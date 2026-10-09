import { PrismaClient } from '@prisma/client';
import { ConsoleLogger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { randomUUID } from 'node:crypto';
import { etlConfig } from './etl.config';
import { EtlError } from './etl.types';
import { SourceRepository } from './repositories/source.repository';
import { ManagedWarehouseRepository } from './repositories/managed-warehouse.repository';
import { WorkerControlRepository } from './repositories/worker-control.repository';
import { EtlService } from './services/etl.service';
import { EtlScheduler, ETL_POLL_MS, WORKER_HEARTBEAT_MS } from './services/etl-scheduler';

export async function main(args = process.argv.slice(2)): Promise<void> {
  const logger = new ConsoleLogger('BusinessIntelligenceETL', { json: true });
  if (args.some(arg => arg !== '--once')) throw new EtlError('BI_CONFIGURATION_INVALID');
  const config = etlConfig();
  const source = new PrismaClient({ datasources: { db: { url: config.sourceUrl } }, log: [] });
  const target = new PrismaClient({ datasources: { db: { url: config.warehouseUrl } }, log: [] });
  const inventory = new SourceRepository(source, config.pageSize);
  const control = new WorkerControlRepository(target);
  const service = new EtlService(inventory, new ManagedWarehouseRepository(target),
    phase => logger.log({ event: 'bi.etl_phase_finished', ...phase }));
  const scheduler = new EtlScheduler(inventory, control, service);
  const workerId = randomUUID();
  let heartbeat: Promise<void> | undefined;
  let timer: ReturnType<typeof setInterval> | undefined;
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  try {
    await control.ready(); // No implicit DDL; refuse the old schema before claiming any tenant.
    await control.heartbeat(workerId);
    timer = setInterval(() => {
      if (heartbeat) return;
      heartbeat = control.heartbeat(workerId).catch(() => {
        logger.warn({ event: 'bi.worker_heartbeat_failed', code: 'BI_UNAVAILABLE' });
      }).finally(() => { heartbeat = undefined; });
    }, WORKER_HEARTBEAT_MS);
    do {
      const started = Date.now();
      let failed = false;
      try {
        for await (const result of scheduler.tick(controller.signal, args.includes('--once') ? 'cli' : 'scheduled')) {
          failed ||= result.status === 'failed';
          logger.log({ event: 'scope' in result ? 'bi.etl_inventory_failed' : 'bi.etl_tenant_finished', ...result });
        }
      } catch {
        failed = true;
        logger.warn({ event: 'bi.etl_poll_failed', code: 'BI_UNAVAILABLE' });
      }
      logger.log({ event: 'bi.etl_cycle_finished', durationMs: Date.now() - started, failed });
      if (args.includes('--once')) { if (failed) process.exitCode = 1; break; }
      await delay(Math.max(1, ETL_POLL_MS - (Date.now() - started)), undefined, { signal: controller.signal }).catch(() => undefined);
    } while (!controller.signal.aborted);
  } finally {
    controller.abort();
    if (timer) clearInterval(timer);
    await heartbeat;
    if (timer) await control.heartbeat(workerId, true).catch(() => {
      logger.warn({ event: 'bi.worker_stop_not_recorded', code: 'BI_UNAVAILABLE' });
    });
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
    await Promise.allSettled([source.$disconnect(), target.$disconnect()]);
  }
}

if (require.main === module) {
  void main().catch(error => {
    new ConsoleLogger('BusinessIntelligenceETL', { json: true }).error({ event: 'bi.etl_stopped',
      code: error instanceof EtlError ? error.code : 'BI_ETL_FAILED' });
    process.exitCode = 1;
  });
}
