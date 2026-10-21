import { calculateStatistics } from '../src/modules/business-intelligence/utils/statistics-engine';
import { StatisticsService } from '../src/modules/business-intelligence/services/statistics.service';
import { statisticsEngineReady } from '../src/modules/business-intelligence/repositories/statistics-engine-preflight';
import type { StatisticsInputs } from '../src/modules/business-intelligence/statistics.types';
import type { PrismaClient } from '@prisma/client';

const input: StatisticsInputs = { forecast: { at: new Date('2025-01-22Z'), historyStartedAt: new Date('2025-01-01Z'), months: [], origins: [] },
  patterns: { total: 0n, tagsObserved: true, withoutCategory: 0n, withoutTags: 0n, categories: { items: [], totalGroups: 0n },
    tags: { items: [], totalGroups: 0n }, segments: { items: [], totalGroups: 0n }, pairs: [] }, daily: [] };
describe('one recoverable statistical task after ETL', () => {
  const jobs = { discover: jest.fn(), claim: jest.fn(), heartbeat: jest.fn(), publish: jest.fn(), succeeded: jest.fn(), fail: jest.fn(),defer:jest.fn() };
  const inputs = { read: jest.fn() }; const calculate = jest.fn(calculateStatistics);
  const eligible=jest.fn<Promise<boolean>,[string]>();
  const service = new StatisticsService(jobs, inputs, calculate,eligible);
  const lease = () => ({ tenantId: 'synthetic', sourceRunId: 'run', sourceSnapshotAt: input.forecast.at, token: 'token', deadline: Date.now() + 60000 });
  beforeEach(() => {
    jest.useRealTimers(); jest.clearAllMocks(); eligible.mockReset().mockResolvedValue(true); jobs.defer.mockResolvedValue(1); jobs.discover.mockResolvedValue(1); jobs.claim.mockResolvedValue(lease());
    jobs.heartbeat.mockResolvedValue(true); jobs.publish.mockResolvedValue('succeeded'); jobs.succeeded.mockResolvedValue(false);
    jobs.fail.mockResolvedValue(1); inputs.read.mockResolvedValue(input); calculate.mockImplementation(calculateStatistics);
  });
  afterEach(() => jest.useRealTimers());
  it('does no work after shutdown and opens no disabled engine connection', async () => {
    const signal = new AbortController(); signal.abort(); expect(await service.tick(signal.signal)).toEqual({ status: 'skipped' });
    expect(jobs.discover).not.toHaveBeenCalled();
    const query = jest.fn(); expect(await statisticsEngineReady({ $queryRaw: query } as unknown as PrismaClient, false)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
  it('defers a queued task before reading or computing when the commercial plan is suspended',async()=>{
    eligible.mockResolvedValue(false);
    expect(await service.tick(new AbortController().signal)).toEqual({status:'skipped'});
    expect(jobs.defer).toHaveBeenCalledWith(expect.objectContaining({tenantId:'synthetic'}));
    expect(inputs.read).not.toHaveBeenCalled();expect(calculate).not.toHaveBeenCalled();expect(jobs.publish).not.toHaveBeenCalled();expect(jobs.fail).not.toHaveBeenCalled();
  });
  it('rechecks eligibility after reading and pauses without publishing or consuming another attempt',async()=>{
    eligible.mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await service.tick(new AbortController().signal)).toEqual({status:'skipped'});expect(inputs.read).toHaveBeenCalledTimes(1);expect(calculate).not.toHaveBeenCalled();expect(jobs.defer).toHaveBeenCalledTimes(1);expect(jobs.fail).not.toHaveBeenCalled();
  });
  it('discards a calculation when permission is withdrawn before publication and resumes later',async()=>{
    eligible.mockResolvedValueOnce(true).mockResolvedValueOnce(true).mockResolvedValue(false);
    expect(await service.tick(new AbortController().signal)).toEqual({status:'skipped'});expect(calculate).toHaveBeenCalledTimes(1);expect(jobs.publish).not.toHaveBeenCalled();expect(jobs.defer).toHaveBeenCalledTimes(1);
    eligible.mockResolvedValue(true);expect(await service.tick(new AbortController().signal)).toEqual({status:'succeeded'});expect(jobs.publish).toHaveBeenCalledTimes(1);
  });
  it('claims once, reads before computing, and drains a claimed task after shutdown', async () => {
    const signal = new AbortController(); inputs.read.mockImplementation(async () => { signal.abort(); return input; });
    expect(await service.tick(signal.signal)).toEqual({ status: 'succeeded' });
    expect(jobs.claim).toHaveBeenCalledTimes(1); expect(calculate).toHaveBeenCalledWith(input);
    expect(jobs.publish).toHaveBeenCalledTimes(1);
  });
  it('recovers a lost response after COMMIT without marking success as failed', async () => {
    jobs.publish.mockRejectedValue(new Error('Synthetic commit response lost')); jobs.succeeded.mockResolvedValue(true);
    expect(await service.tick(new AbortController().signal)).toEqual({ status: 'succeeded' });
    expect(jobs.fail).not.toHaveBeenCalled(); expect(jobs.claim).toHaveBeenCalledTimes(1);
  });
  it('records safe failure codes and preserves reservation recovery when DW is unreachable', async () => {
    inputs.read.mockRejectedValue(new Error('Synthetic private driver payload'));
    jobs.succeeded.mockRejectedValue(new Error('Unavailable')); jobs.fail.mockRejectedValue(new Error('Unavailable'));
    expect(await service.tick(new AbortController().signal)).toEqual({ status: 'failed', code: 'BI_STATISTICS_FAILED' });
    expect(jobs.fail).toHaveBeenCalledWith(expect.any(Object), 'BI_STATISTICS_FAILED'); expect(calculate).not.toHaveBeenCalled();
  });
  it('enforces the deadline before starting calculations', async () => {
    jobs.claim.mockResolvedValue({ ...lease(), deadline: Date.now() - 1 });
    expect(await service.tick(new AbortController().signal)).toEqual({ status: 'failed', code: 'BI_STATISTICS_DEADLINE_EXCEEDED' });
    expect(inputs.read).not.toHaveBeenCalled();
  });
  it('checks a lost heartbeat before calculating or publishing', async () => {
    jest.useFakeTimers(); jobs.claim.mockResolvedValue(lease()); jobs.heartbeat.mockResolvedValue(false);
    let resume!: (value: StatisticsInputs) => void;
    inputs.read.mockImplementation(() => new Promise<StatisticsInputs>(resolve => { resume = resolve; }));
    const pending = service.tick(new AbortController().signal);
    await jest.advanceTimersByTimeAsync(20000); resume(input);
    expect(await pending).toEqual({ status: 'failed', code: 'BI_STATISTICS_LEASE_LOST' });
    expect(jobs.publish).not.toHaveBeenCalled(); expect(calculate).not.toHaveBeenCalled();
  });
});
