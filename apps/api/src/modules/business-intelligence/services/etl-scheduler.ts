import { SourceRepository } from '../repositories/source.repository';
import { WorkerControlRepository } from '../repositories/worker-control.repository';
import { type EtlResult } from '../etl.types';
import { EtlService } from './etl.service';

export const ETL_POLL_MS = 15000;
export const WORKER_HEARTBEAT_MS = 20000;
export const WORKER_STALE_MS = 60000;
export type SchedulerResult = EtlResult | { scope: 'inventory'; status: 'failed'; code: 'BI_INVENTORY_UNAVAILABLE' };

export class EtlScheduler {
  private inventoryRefreshAt = -Infinity;
  constructor(private readonly source: Pick<SourceRepository, 'tenantIds'>,
    private readonly control: Pick<WorkerControlRepository, 'provision' | 'candidates'>,
    private readonly etl: Pick<EtlService, 'runTenant'>, private readonly clock = Date.now) {}

  async *tick(signal: AbortSignal, origin: 'scheduled' | 'cli' = 'scheduled'): AsyncGenerator<SchedulerResult> {
    if (signal.aborted) return;
    if (this.clock() - this.inventoryRefreshAt >= 60000) {
      // Mark the attempt before I/O: an unavailable source is not polled at every 15s tick.
      this.inventoryRefreshAt = this.clock();
      let after: string | null = null;
      try {
        while (!signal.aborted) {
          const ids = await this.source.tenantIds(after);
          if (!ids.length) break;
          await this.control.provision(ids);
          after = ids.at(-1)!;
        }
      } catch {
        // Already provisioned tenants/requests still get attempts and durable errors during source outages.
        yield { scope: 'inventory', status: 'failed', code: 'BI_INVENTORY_UNAVAILABLE' };
      }
    }
    let after: string | null = null;
    while (!signal.aborted) {
      const ids = await this.control.candidates(after);
      if (!ids.length) return;
      for (const tenantId of ids) {
        if (signal.aborted) return;
        try { yield await this.etl.runTenant(tenantId, signal, origin); }
        catch { yield { tenantId, status: 'failed', code: 'BI_ETL_FAILED' }; }
      }
      after = ids.at(-1)!;
    }
  }
}
