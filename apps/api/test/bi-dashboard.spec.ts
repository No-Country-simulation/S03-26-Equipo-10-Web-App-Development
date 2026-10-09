import { DashboardQueryDto, dateRange } from '../src/modules/business-intelligence/dtos/dashboard-query.dto';
import { ctr, safeCount } from '../src/modules/business-intelligence/repositories/dashboard.repository';
import { BiConnection } from '../src/modules/business-intelligence/repositories/bi-connection';

describe('BI range and arithmetic contracts', () => {
  const now = new Date('2024-03-01T23:59:59Z');
  it('defaults to 30 UTC days and supports each single date parameter', () => {
    expect(dateRange({}, now)).toEqual({ from: '2024-02-01', to: '2024-03-01', timezone: 'UTC' });
    expect(dateRange({ to: '2024-02-29' }, now).from).toBe('2024-01-31');
    expect(dateRange({ from: '2024-02-29' }, now).to).toBe('2024-03-01');
  });
  it('rejects invalid calendar dates, unknown tenant inputs, reversed, future and excessive ranges', () => {
    for (const input of [{ from: '2023-02-29' }, { to: '2024-13-01' }, { to: ['2024-03-01'] }, { tenantId: 'foreign' }, { from: '2024-3-01' }]) {
      expect(DashboardQueryDto.schema.safeParse(input).success).toBe(false);
    }
    for (const input of [{ from: '2024-03-02' }, { to: '2024-03-02' }, { from: '2022-01-01' }]) expect(() => dateRange(input, now)).toThrow();
    expect(dateRange({ from: '2023-03-02', to: '2024-03-01' }, now)).toBeDefined();
  });
  it('preserves BigInt, decimal CTR and zero denominators', () => {
    expect(ctr(0n, 7n)).toBeNull(); expect(ctr(3n, 1n)).toBe(33.33); expect(ctr(1n, 2n)).toBe(200);
    expect(ctr(9007199254740993n, 9007199254740993n)).toBe(100);
    expect(() => safeCount(9007199254740993n)).toThrow();
  });
  it('disables BI without a database and reports invalid configuration only on a BI request', async () => {
    const enabled = process.env.BI_ENABLED; const url = process.env.BI_DATABASE_URL;
    const work = jest.fn();
    try {
      delete process.env.BI_ENABLED;
      const disabled = new BiConnection();
      await expect(disabled.read(work)).rejects.toMatchObject({ code: 'BI_DISABLED' });
      await disabled.onModuleDestroy();
      process.env.BI_ENABLED = 'true'; process.env.BI_DATABASE_URL = 'invalid-synthetic';
      const invalid = new BiConnection();
      await expect(invalid.read(work)).rejects.toMatchObject({ code: 'BI_UNAVAILABLE' });
      await invalid.onModuleDestroy(); expect(work).not.toHaveBeenCalled();
    } finally {
      if (enabled === undefined) delete process.env.BI_ENABLED; else process.env.BI_ENABLED = enabled;
      if (url === undefined) delete process.env.BI_DATABASE_URL; else process.env.BI_DATABASE_URL = url;
    }
  });
});
