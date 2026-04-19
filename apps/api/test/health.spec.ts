import { Test } from '@nestjs/testing';
import { HealthCheckService } from '@nestjs/terminus';
import { HealthController } from '../src/modules/health/controllers/health.controller';
import { PrismaHealthIndicator } from '../src/modules/health/services/prisma-health.indicator';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthCheckService,
          useValue: {
            check: jest.fn().mockResolvedValue({
              status: 'ok',
              info: { database: { status: 'up' } },
              error: {},
              details: { database: { status: 'up' } },
            }),
          },
        },
        {
          provide: PrismaHealthIndicator,
          useValue: {
            isHealthy: jest.fn().mockResolvedValue({ database: { status: 'up' } }),
          },
        },
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns api health status', async () => {
    const response = await controller.getHealth();

    expect(response).toMatchObject({
      status: 'ok',
      info: { database: { status: 'up' } },
      details: { database: { status: 'up' } },
    });
  });
});
