import { EtlScheduler, ETL_POLL_MS, WORKER_HEARTBEAT_MS, WORKER_STALE_MS } from '../src/modules/business-intelligence/services/etl-scheduler';

describe('ETL bounded scheduling and inventory refresh', () => {
  let now = 0;
  const source = { tenantIds: jest.fn<Promise<string[]>, [string | null]>() };
  const control = { provision: jest.fn<Promise<void>, [string[]]>(), candidates: jest.fn<Promise<string[]>, [string | null]>() };
  const etl = { runTenant: jest.fn() };
  beforeEach(() => { now = 0; jest.resetAllMocks(); source.tenantIds.mockResolvedValue([]); control.candidates.mockResolvedValue([]); });
  async function drain(scheduler: EtlScheduler, signal = new AbortController().signal) {
    const results = []; for await (const result of scheduler.tick(signal)) results.push(result); return results;
  }
  it('uses 15s polling and an independent 20s heartbeat with a 60s stale threshold', () => {
    expect([ETL_POLL_MS, WORKER_HEARTBEAT_MS, WORKER_STALE_MS]).toEqual([15000, 20000, 60000]);
  });
  it('refreshes paged inventory no more than once per minute and never overwrites a complete in-memory tenant list', async () => {
    const scheduler = new EtlScheduler(source, control, etl, () => now);
    source.tenantIds.mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce(['c']).mockResolvedValueOnce([]);
    await drain(scheduler); expect(source.tenantIds.mock.calls).toEqual([[null], ['b'], ['c']]);
    expect(control.provision.mock.calls).toEqual([[['a', 'b']], [['c']]]);
    now = 15000; await drain(scheduler); now = 59999; await drain(scheduler); expect(source.tenantIds).toHaveBeenCalledTimes(3);
    now = 60000; await drain(scheduler); expect(source.tenantIds).toHaveBeenCalledTimes(4);
  });
  it('continues durable work during source inventory failure while bounding repeated inventory attempts', async () => {
    const scheduler = new EtlScheduler(source, control, etl, () => now); source.tenantIds.mockRejectedValue(new Error('synthetic unavailable source'));
    control.candidates.mockResolvedValueOnce(['tenant']).mockResolvedValue([]); etl.runTenant.mockResolvedValue({ tenantId: 'tenant', status: 'failed' });
    expect(await drain(scheduler)).toEqual([{ scope: 'inventory', status: 'failed', code: 'BI_INVENTORY_UNAVAILABLE' }, { tenantId: 'tenant', status: 'failed' }]);
    now = 15000; await drain(scheduler); expect(source.tenantIds).toHaveBeenCalledTimes(1);
  });
  it('runs one tenant at a time and stops new claims after shutdown while draining the current task', async () => {
    const controller = new AbortController(); const scheduler = new EtlScheduler(source, control, etl);
    control.candidates.mockResolvedValueOnce(['a', 'b']);
    etl.runTenant.mockImplementation(async (tenantId: string) => { controller.abort(); return { tenantId, status: 'succeeded' }; });
    expect(await drain(scheduler, controller.signal)).toEqual([{ tenantId: 'a', status: 'succeeded' }]);
    expect(etl.runTenant).toHaveBeenCalledTimes(1);
    expect(await drain(scheduler, controller.signal)).toEqual([]);
  });
  it('preserves progress when one tenant fails without suppressing other companies', async () => {
    const scheduler = new EtlScheduler(source, control, etl);
    control.candidates.mockResolvedValueOnce(['a', 'b']).mockResolvedValueOnce([]);
    etl.runTenant.mockRejectedValueOnce(new Error('synthetic')).mockResolvedValueOnce({ tenantId: 'b', status: 'succeeded' });
    expect(await drain(scheduler)).toEqual([{ tenantId: 'a', status: 'failed', code: 'BI_ETL_FAILED' }, { tenantId: 'b', status: 'succeeded' }]);
    expect(control.candidates.mock.calls).toEqual([[null], ['b']]);
  });
});
