import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FeatureFlagGuard } from '../src/common/guards/feature-flag.guard';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { RequestContextMiddleware } from '../src/common/middleware/request-context.middleware';
import { getRequestScope, runWithRequestScope, setAuthenticatedTenant } from '../src/common/request-context.storage';

function context(request: object): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
    getClass: () => class TestController {},
  } as unknown as ExecutionContext;
}

describe('authenticated tenant context', () => {
  it('does not evaluate a feature flag from an untrusted tenant header', async () => {
    const evaluator = { isEnabled: jest.fn().mockResolvedValue(true) };
    const reflector = { getAllAndOverride: jest.fn().mockReturnValue('testimonials') };
    const guard = new FeatureFlagGuard(reflector as any, evaluator as any);

    await expect(guard.canActivate(context({ headers: { 'x-tenant-id': 'other-tenant' } })))
      .rejects.toThrow(ForbiddenException);
    expect(evaluator.isEnabled).not.toHaveBeenCalled();

    await expect(guard.canActivate(context({ user: { tenantId: 'verified-tenant' } })))
      .resolves.toBe(true);
    expect(evaluator.isEnabled).toHaveBeenCalledWith('verified-tenant', 'testimonials');
  });

  it('rejects a signed JWT whose tenant differs from the verified user row', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', tenantId: 'other-tenant' }) };
    const credentials = { findActiveUser: jest.fn().mockResolvedValue({
      userId: 'user-1', email: 'a@example.com', tenantId: 'verified-tenant', isActive: true,
      tenantName: 'Verified', roles: [],
    }) };
    const config = { getOrThrow: () => ({ jwt: { secret: 'test-secret' } }) };
    const guard = new JwtAuthGuard(jwt as any, credentials as any, config as any);
    const request = { cookies: {}, header: (name: string) => name === 'authorization' ? 'Bearer token' : undefined };

    await runWithRequestScope({ requestId: 'req', correlationId: 'trace' }, async () => {
      await expect(guard.canActivate(context(request))).rejects.toThrow(UnauthorizedException);
      expect(getRequestScope()?.tenantId).toBeUndefined();
      expect(request).not.toHaveProperty('user');
    });
  });

  it('verifies the explicit Bearer token before an ambient access cookie', async () => {
    const jwt = { verifyAsync: jest.fn().mockResolvedValue({ sub: 'user-1', tenantId: 'tenant-1' }) };
    const credentials = { findActiveUser: jest.fn().mockResolvedValue({
      userId: 'user-1', email: 'a@example.com', tenantId: 'tenant-1', isActive: true,
      tenantName: 'Tenant', roles: [],
    }) };
    const config = { getOrThrow: () => ({ jwt: { secret: 'test-secret' } }) };
    const guard = new JwtAuthGuard(jwt as any, credentials as any, config as any);
    const request = {
      cookies: { accessToken: 'cookie-token' },
      header: (name: string) => name === 'authorization' ? 'Bearer bearer-token' : undefined,
    };

    await runWithRequestScope({ requestId: 'req', correlationId: 'trace' }, async () => {
      await expect(guard.canActivate(context(request))).resolves.toBe(true);
    });
    expect(jwt.verifyAsync).toHaveBeenCalledWith('bearer-token', { secret: 'test-secret' });
  });

  it('propagates a verified tenant and keeps concurrent request scopes separate', async () => {
    const tasks = ['tenant-a', 'tenant-b'].map(tenantId =>
      runWithRequestScope({ requestId: tenantId, correlationId: `trace-${tenantId}` }, async () => {
        setAuthenticatedTenant(tenantId);
        await Promise.resolve();
        return getRequestScope();
      }),
    );
    const [first, second] = await Promise.all(tasks);
    expect(first).toEqual({ requestId: 'tenant-a', correlationId: 'trace-tenant-a', tenantId: 'tenant-a' });
    expect(second).toEqual({ requestId: 'tenant-b', correlationId: 'trace-tenant-b', tenantId: 'tenant-b' });
  });

  it('sets tenant context from the verified API key row', async () => {
    const credentials = {
      findLegacyApiKey: jest.fn().mockResolvedValue({
        id: 'key-1', tenantId: 'verified-tenant', ownerId: null, status: 'ACTIVE',
        isActive: true, expiresAt: null, legacyValidUntil: null, tenant: { isActive: true },
      }),
      recordApiKeyUse: jest.fn().mockResolvedValue(undefined),
    };
    const crypto = { parse: jest.fn().mockReturnValue(null), isLegacy: jest.fn().mockReturnValue(true),
      legacyAllowed: jest.fn().mockReturnValue(true), legacyHash: jest.fn().mockReturnValue('hash') };
    const guard = new ApiKeyGuard(credentials as any, crypto as any);
    const request = {
      header: (name: string) => name === 'authorization' ? 'Bearer secret' : undefined,
      headers: { 'x-tenant-id': 'other-tenant' },
    };

    await runWithRequestScope({ requestId: 'req', correlationId: 'trace' }, async () => {
      await expect(guard.canActivate(context(request))).resolves.toBe(true);
      expect(getRequestScope()?.tenantId).toBe('verified-tenant');
    });
  });

  it('rejects malformed correlation headers before putting them in logs', () => {
    const middleware = new RequestContextMiddleware();
    const request = {
      header: (name: string) => name === 'x-correlation-id' ? 'invalid\nvalue' : undefined,
    };
    const response = { setHeader: jest.fn() };
    let scope = getRequestScope();
    middleware.use(request as any, response as any, () => {
      scope = getRequestScope();
    });
    expect(scope?.correlationId).toBe(scope?.requestId);
    expect(scope?.requestId).toMatch(/^[0-9a-f-]{36}$/);
  });
});
