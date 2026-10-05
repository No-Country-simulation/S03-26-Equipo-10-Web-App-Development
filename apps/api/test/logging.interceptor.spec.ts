import { ExecutionContext } from '@nestjs/common';
import { firstValueFrom, of, throwError } from 'rxjs';
import { ConflictError } from '../src/common/errors/application.error';
import { LoggingInterceptor } from '../src/common/interceptors/logging.interceptor';
import { runWithRequestScope, setAuthenticatedTenant } from '../src/common/request-context.storage';

describe('LoggingInterceptor', () => {
  const logger = { log: jest.fn(), warn: jest.fn() };
  const interceptor = new LoggingInterceptor(logger as any);
  const request = { method: 'PATCH', url: '/api/v1/testimonials/1', route: { path: '/testimonials/:id' } };
  const context = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => ({ statusCode: 200 }) }),
  } as unknown as ExecutionContext;

  beforeEach(() => jest.clearAllMocks());

  it('logs a parametrized route with verified tenant and correlation ID', async () => {
    await runWithRequestScope({ requestId: 'req-1', correlationId: 'trace-1' }, async () => {
      setAuthenticatedTenant('tenant-1');
      await firstValueFrom(interceptor.intercept(context, { handle: () => of('ok') }));
    });

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      traceId: 'trace-1', tenantId: 'tenant-1',
      http: expect.objectContaining({ route: '/testimonials/:id', statusCode: 200 }),
    }));
  });

  it('logs typed application errors with their HTTP status', async () => {
    await runWithRequestScope({ requestId: 'req-2', correlationId: 'trace-2' }, async () => {
      await expect(firstValueFrom(interceptor.intercept(
        context,
        { handle: () => throwError(() => new ConflictError('transition failed')) },
      ))).rejects.toThrow(ConflictError);
    });

    expect(logger.warn).toHaveBeenCalledWith(expect.objectContaining({
      traceId: 'trace-2',
      http: expect.objectContaining({ statusCode: 409 }),
    }));
    expect(JSON.stringify(logger.warn.mock.calls[0])).not.toContain('transition failed');
  });

  it('uses a fixed label when no route template is available', async () => {
    const unregisteredRequest = { method: 'GET', url: '/missing?token=private-value' };
    const unregisteredContext = {
      switchToHttp: () => ({ getRequest: () => unregisteredRequest, getResponse: () => ({ statusCode: 404 }) }),
    } as unknown as ExecutionContext;

    await firstValueFrom(interceptor.intercept(unregisteredContext, { handle: () => of('ok') }));

    expect(logger.log).toHaveBeenCalledWith(expect.objectContaining({
      http: expect.objectContaining({ route: 'unmatched' }),
    }));
    expect(JSON.stringify(logger.log.mock.calls[0])).not.toContain('private-value');
  });
});
