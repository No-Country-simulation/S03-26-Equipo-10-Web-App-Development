import { ArgumentsHost, HttpException, Logger } from '@nestjs/common';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';
import {
  ConflictError, ForbiddenError, InternalError, InvalidInputError,
  NotFoundError, RateLimitedError, UnauthorizedError,
} from '../src/common/errors/application.error';
import { runWithRequestScope } from '../src/common/request-context.storage';

describe('ApiExceptionFilter', () => {
  const filter = new ApiExceptionFilter();

  function capture(error: unknown) {
    const response = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    const request = {
      url: '/api/v1/testimonials/1', method: 'PATCH',
      header: () => undefined,
    };
    const host = {
      switchToHttp: () => ({ getResponse: () => response, getRequest: () => request }),
    } as unknown as ArgumentsHost;
    filter.catch(error, host);
    return {
      status: response.status.mock.calls[0][0] as number,
      contentType: response.header.mock.calls[0][1] as string,
      body: response.json.mock.calls[0][0] as Record<string, unknown>,
    };
  }

  it.each([
    [new InvalidInputError('invalid'), 400, 'VALIDATION_ERROR'],
    [new UnauthorizedError('invalid'), 401, 'AUTH_INVALID_TOKEN'],
    [new ForbiddenError('invalid'), 403, 'ACCESS_FORBIDDEN'],
    [new NotFoundError('invalid'), 404, 'RESOURCE_NOT_FOUND'],
    [new ConflictError('invalid'), 409, 'STATE_CONFLICT'],
    [new RateLimitedError('invalid'), 429, 'RATE_LIMITED'],
    [new RateLimitedError('invalid', 'TOO_MANY_REQUESTS'), 429, 'TOO_MANY_REQUESTS'],
  ])('keeps the public Problem Details contract for %p', (error, status, code) => {
    const result = capture(error);
    expect(result.status).toBe(status);
    expect(result.contentType).toBe('application/problem+json');
    expect(result.body).toEqual(expect.objectContaining({
      status, code, detail: 'invalid',
      instance: '/api/v1/testimonials/1',
      title: expect.any(String),
      type: expect.stringContaining('/errors/'),
      timestamp: expect.any(String),
    }));
  });

  it('keeps Nest transport errors and the request correlation ID', () => {
    runWithRequestScope({ requestId: 'request-1', correlationId: 'trace-1' }, () => {
      const result = capture(new HttpException('transport error', 422));
      expect(result.body).toEqual(expect.objectContaining({
        status: 422, code: 'UNPROCESSABLE_ENTITY', detail: 'transport error', traceId: 'trace-1',
      }));
    });
  });

  it('redacts internal errors in production', () => {
    const original = process.env.NODE_ENV;
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    process.env.NODE_ENV = 'production';
    try {
      const result = capture(new InternalError('private database details'));
      expect(result.status).toBe(500);
      expect(result.body.detail).not.toContain('private database details');
    } finally {
      process.env.NODE_ENV = original;
      logger.mockRestore();
    }
  });
});
