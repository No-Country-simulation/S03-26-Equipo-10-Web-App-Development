import { HttpException, HttpStatus } from '@nestjs/common';
import { RateLimitService } from '../src/common/services/rate-limit.service';

describe('RateLimitService', () => {
  let service: RateLimitService;

  beforeEach(() => {
    service = new RateLimitService();
  });

  it('allows requests within configured window', () => {
    expect(() => service.assertWithinLimit('ip:1', 2, 60)).not.toThrow();
    expect(() => service.assertWithinLimit('ip:1', 2, 60)).not.toThrow();
  });

  it('throws 429 when limit is exceeded', () => {
    service.assertWithinLimit('ip:2', 1, 60);

    try {
      service.assertWithinLimit('ip:2', 1, 60, 'Custom limit reached');
      fail('Expected service to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      const exception = error as HttpException;
      expect(exception.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(exception.getResponse()).toEqual(
        expect.objectContaining({
          code: 'TOO_MANY_REQUESTS',
          message: 'Custom limit reached',
        }),
      );
    }
  });
});

