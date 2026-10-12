import { Test, type TestingModule } from '@nestjs/testing';
import { TerminusModule } from '@nestjs/terminus';
import { HealthController } from '../src/modules/health/controllers/health.controller';
import { PrismaHealthIndicator } from '../src/modules/health/services/prisma-health.indicator';
import { PrismaService } from '../src/modules/database/prisma.service';

describe('Health boundaries with real Terminus indicators', () => {
  let module: TestingModule;
  let controller: HealthController;
  const query = jest.fn();

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
      providers: [
        PrismaHealthIndicator,
        { provide: PrismaService, useValue: { $queryRaw: query } },
      ],
    }).compile();
    controller = module.get(HealthController);
  });
  afterAll(async () => {
    await module.close();
  });
  afterEach(() => {
    jest.restoreAllMocks();
    query.mockReset();
  });

  function heap(bytes: number) {
    const actual = process.memoryUsage();
    jest
      .spyOn(process, 'memoryUsage')
      .mockReturnValue({ ...actual, heapUsed: bytes });
  }

  it('keeps liveness up at the 300 MiB boundary without querying PostgreSQL', async () => {
    heap(300 * 1024 * 1024);
    query.mockRejectedValue(new Error('Synthetic OLTP outage'));
    await expect(controller.checkLiveness()).resolves.toMatchObject({
      status: 'ok',
      details: { memory_heap: { status: 'up' } },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects liveness above the heap boundary even when PostgreSQL is healthy', async () => {
    heap(300 * 1024 * 1024 + 1);
    query.mockResolvedValue([{ value: 1 }]);
    await expect(controller.checkLiveness()).rejects.toMatchObject({
      status: 503,
      response: { details: { memory_heap: { status: 'down' } } },
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('rejects readiness for an OLTP outage independently of a healthy heap', async () => {
    heap(10 * 1024 * 1024);
    query.mockRejectedValue(new Error('Synthetic OLTP outage'));
    await expect(controller.checkReadiness()).rejects.toMatchObject({
      status: 503,
      response: { details: { database: { status: 'down' } } },
    });
    expect(query).toHaveBeenCalledTimes(1);
  });
});
