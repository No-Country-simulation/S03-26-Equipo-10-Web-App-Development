import { ExecutionContext } from '@nestjs/common';
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

  it('uses x-forwarded-for and api key in ip-api-key scope', () => {
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
      apiKey: { apiKeyId: 'ak_123' },
    };

    const context = {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;

    expect(guard.canActivate(context)).toBe(true);

    expect(rateLimitServiceMock.assertWithinLimit).toHaveBeenCalledWith(
      'POST:/public/analytics/events:10.10.10.10:ak_123',
      10,
      60,
      'Rate limit exceeded for POST /public/analytics/events',
    );
  });
});
