import { HealthCheckError } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../src/modules/health/services/prisma-health.indicator';

describe('PrismaHealthIndicator', () => {
  it('returns a generic failure without the database error message', async () => {
    const prisma = { $queryRaw: jest.fn().mockRejectedValue(new Error('password=private-value')) };
    const indicator = new PrismaHealthIndicator(prisma as any);

    await expect(indicator.isHealthy('database')).rejects.toMatchObject({
      causes: { database: { status: 'down', message: 'Database unavailable' } },
    } satisfies Partial<HealthCheckError>);
  });
});
