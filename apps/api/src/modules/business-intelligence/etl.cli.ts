import { PrismaClient } from '@prisma/client';
import { ConsoleLogger } from '@nestjs/common';
import { setTimeout as delay } from 'node:timers/promises';
import { etlConfig } from './etl.config';
import { EtlError } from './etl.types';
import { SourceRepository } from './repositories/source.repository';
import { WarehouseRepository } from './repositories/warehouse.repository';
import { EtlService } from './services/etl.service';

export async function main(args = process.argv.slice(2)): Promise<void> {
  const logger = new ConsoleLogger('BusinessIntelligenceETL', { json: true });
  if (args.some(arg => arg !== '--once')) throw new EtlError('BI_CONFIGURATION_INVALID');
  const config = etlConfig();
  const source = new PrismaClient({ datasources: { db: { url: config.sourceUrl } }, log: [] });
  const target = new PrismaClient({ datasources: { db: { url: config.warehouseUrl } }, log: [] });
  const service = new EtlService(new SourceRepository(source, config.pageSize), new WarehouseRepository(target),
    phase => logger.log({ event: 'bi.etl_phase_finished', ...phase }));
  const controller = new AbortController();
  const shutdown = () => controller.abort();
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  try {
    do {
      const started = Date.now();
      let failed = false;
      for await (const result of service.cycle(controller.signal)) {
        failed ||= result.status === 'failed';
        logger.log({ event: 'bi.etl_tenant_finished', ...result });
      }
      logger.log({ event: 'bi.etl_cycle_finished', durationMs: Date.now() - started, failed });
      if (args.includes('--once')) { if (failed) process.exitCode = 1; break; }
      const untilNextHour = 3_600_000 - Date.now() % 3_600_000;
      await delay(untilNextHour, undefined, { signal: controller.signal }).catch(() => undefined);
    } while (!controller.signal.aborted);
  } finally {
    controller.abort();
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
