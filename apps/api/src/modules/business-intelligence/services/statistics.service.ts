import { StatisticsError, type StatisticsCode } from '../statistics.types';
import { StatisticsJobRepository } from '../repositories/statistics-job.repository';
import { StatisticsInputRepository } from '../repositories/statistics-input.repository';
import { calculateStatistics } from '../utils/statistics-engine';

export type StatisticsResult = {
  status: 'skipped' | 'succeeded' | 'superseded' | 'failed';
  code?: StatisticsCode;
};
export class StatisticsService {
  constructor(
    private readonly jobs: Pick<
      StatisticsJobRepository,
      'discover' | 'claim' | 'heartbeat' | 'publish' | 'succeeded' | 'fail'
    > &
      Partial<Pick<StatisticsJobRepository, 'defer'>>,
    private readonly inputs: Pick<StatisticsInputRepository, 'read'>,
    private readonly calculate = calculateStatistics,
    private readonly eligible: (
      tenantId: string,
    ) => Promise<boolean> = async () => true,
  ) {}

  async tick(signal: AbortSignal): Promise<StatisticsResult> {
    if (signal.aborted) return { status: 'skipped' };
    try {
      await this.jobs.discover();
      if (signal.aborted) return { status: 'skipped' };
      const lease = await this.jobs.claim();
      if (!lease) return { status: 'skipped' };
      // Once claimed, graceful shutdown drains this task; it never starts a second task in the tick.
      let lost = false;
      let heartbeat: Promise<void> | undefined;
      const timer = setInterval(() => {
        if (heartbeat) return;
        heartbeat = this.jobs
          .heartbeat(lease)
          .then((live) => {
            if (!live) lost = true;
          })
          .catch(() => {
            lost = true;
          })
          .finally(() => {
            heartbeat = undefined;
          });
      }, 20000);
      const check = () => {
        if (lost) throw new StatisticsError('BI_STATISTICS_LEASE_LOST');
        if (Date.now() >= lease.deadline)
          throw new StatisticsError('BI_STATISTICS_DEADLINE_EXCEEDED');
      };
      try {
        check();
        const permitted = async () => {
          if (await this.eligible(lease.tenantId)) return true;
          if (!this.jobs.defer || (await this.jobs.defer(lease)) !== 1)
            throw new StatisticsError('BI_STATISTICS_LEASE_LOST');
          return false;
        };
        if (!(await permitted())) return { status: 'skipped' };
        const input = await this.inputs.read(lease);
        check();
        if (!(await permitted())) return { status: 'skipped' };
        const payload = this.calculate(input);
        check();
        if (!(await permitted())) return { status: 'skipped' };
        return { status: await this.jobs.publish(lease, payload) };
      } catch (error) {
        try {
          if (await this.jobs.succeeded(lease)) return { status: 'succeeded' };
        } catch {
          /* An unreachable DW is not proof of failure after COMMIT. */
        }
        const code =
          error instanceof StatisticsError
            ? error.code
            : 'BI_STATISTICS_FAILED';
        try {
          await this.jobs.fail(lease, code);
        } catch {
          /* Leave durable reservation for bounded recovery. */
        }
        return { status: 'failed', code };
      } finally {
        clearInterval(timer);
        await heartbeat;
      }
    } catch {
      return { status: 'failed', code: 'BI_STATISTICS_FAILED' };
    }
  }
}
