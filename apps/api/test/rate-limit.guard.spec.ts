import { ExecutionContext } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from '../src/common/guards/rate-limit.guard';
import { RateLimitService } from '../src/common/services/rate-limit.service';

describe('RateLimitGuard', () => {
  const reflectorMock = {
    getAllAndOverride: jest.fn(),
  } as unknown as Reflector;

  const rateLimitServiceMock = {
    assertWithinLimit: jest.fn(),
  } as unknown as RateLimitService;

  const guard = new RateLimitGuard(reflectorMock, rateLimitServiceMock);

  beforeEach(() => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReset();
    (rateLimitServiceMock.assertWithinLimit as jest.Mock).mockReset();
  });

  it('uses trusted Express IP and enforces IP, tenant and key dimensions', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue({
      limit: 10,
      windowSeconds: 60,
      scope: 'ip-api-key',
    });

    const request = {
      method: 'POST',
      route: { path: '/public/analytics/events' },
      path: '/api/v1/public/analytics/events',
      header: (name: string) =>
        name.toLowerCase() === 'x-forwarded-for' ? '10.10.10.10, 10.10.10.11' : undefined,
      socket: { remoteAddress: '127.0.0.1' },
      ip: '127.0.0.1',
      apiKey: { apiKeyId: 'ak_123', tenantId: 'tenant-1', publicId: 'public-1' },
    };

    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    (rateLimitServiceMock.assertWithinLimit as jest.Mock).mockResolvedValue(undefined);
    expect(await guard.canActivate(context)).toBe(true);

    const digest = (value: string) => createHash('sha256').update(value).digest('hex');
    expect(rateLimitServiceMock.assertWithinLimit).toHaveBeenCalledWith(
      [
        `quota:v1:POST:/public/analytics/events:ip:${digest('127.0.0.1')}`,
        `quota:v1:POST:/public/analytics/events:tenant:${digest('tenant-1')}`,
        `quota:v1:POST:/public/analytics/events:key:${digest('public-1')}`,
      ],
      10,
      60,
      'Rate limit exceeded for POST /public/analytics/events',
    );
  });

  it('fails closed for a mutation when Redis cannot verify the quota', async () => {
    (reflectorMock.getAllAndOverride as jest.Mock).mockReturnValue({ limit: 1, windowSeconds: 60, scope: 'ip' });
    (rateLimitServiceMock.assertWithinLimit as jest.Mock).mockRejectedValue(new Error('Redis unavailable'));
    const context = {
      getHandler: () => undefined, getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => ({ method: 'POST', path: '/auth/login', ip: '127.0.0.1', socket: {} }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).rejects.toMatchObject({ status: 503 });
  });
});
