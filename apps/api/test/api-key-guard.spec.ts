import { UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { ApiKeyScopesGuard } from '../src/common/guards/api-key-scopes.guard';
import { ApiKeyCryptoService } from '../src/common/services/api-key-crypto.service';

describe('API key authentication and scopes', () => {
  const settings = {
    environment: 'test' as const, currentPepperVersion: 1,
    peppers: { '1': Buffer.alloc(32, 3).toString('base64url') },
    legacyStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };
  const crypto = new ApiKeyCryptoService({ getOrThrow: () => ({ apiKeys: settings }) } as any);
  const issued = crypto.issue();
  const key = {
    id: 'key-1', tenantId: 'tenant-verified', ownerId: 'owner-1',
    scopes: ['testimonials:read'], status: 'ACTIVE', isActive: true,
    expiresAt: null, legacyValidUntil: null, tenant: { isActive: true },
  };
  const credentials = {
    findApiKeyCredential: jest.fn(), findLegacyApiKey: jest.fn(),
    recordApiKeyUse: jest.fn().mockResolvedValue(undefined),
  };
  const guard = new ApiKeyGuard(credentials as any, crypto);
  const context = (raw: string, request: Record<string, unknown> = {}) => {
    const req = { header: (name: string) => name === 'authorization' ? `Bearer ${raw}` : undefined,
      headers: { 'x-tenant-id': 'tenant-forged' }, ...request };
    return { switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => undefined, getClass: () => undefined } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    credentials.findApiKeyCredential.mockResolvedValue({
      publicId: issued.publicId, secretDigest: issued.digest, pepperVersion: 1,
      environment: 'test', status: 'ACTIVE', scopes: ['testimonials:read'], expiresAt: null, apiKey: key,
    });
  });

  it('derives tenant and scopes from the verified database record on every request', async () => {
    const ctx = context(issued.raw);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().apiKey).toMatchObject({
      apiKeyId: 'key-1', tenantId: 'tenant-verified', publicId: issued.publicId,
      scopes: ['testimonials:read'], legacy: false,
    });
    await guard.canActivate(context(issued.raw));
    expect(credentials.findApiKeyCredential).toHaveBeenCalledTimes(2);
  });

  it('rejects tampering, expiry, revocation and environment mismatch', async () => {
    const changed = issued.raw.slice(0, -1) + (issued.raw.endsWith('0') ? '1' : '0');
    await expect(guard.canActivate(context(changed))).rejects.toBeInstanceOf(UnauthorizedException);
    credentials.findApiKeyCredential.mockResolvedValueOnce({
      publicId: issued.publicId, secretDigest: issued.digest, pepperVersion: 1,
      environment: 'test', status: 'ACTIVE', expiresAt: new Date(0), apiKey: key,
    });
    await expect(guard.canActivate(context(issued.raw))).rejects.toBeInstanceOf(UnauthorizedException);
    credentials.findApiKeyCredential.mockResolvedValueOnce({
      publicId: issued.publicId, secretDigest: issued.digest, pepperVersion: 1,
      environment: 'test', status: 'ACTIVE', expiresAt: null,
      apiKey: { ...key, status: 'REVOKED' },
    });
    await expect(guard.canActivate(context(issued.raw))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(context(issued.raw.replace('ak_test_', 'ak_live_'))))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('preserves legacy permissions until the deadline and its per-key grace cutoff', async () => {
    const legacy = `tms_${'a'.repeat(48)}`;
    credentials.findLegacyApiKey.mockResolvedValueOnce({ ...key, keyHash: crypto.legacyHash(legacy) });
    const ctx = context(legacy);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(ctx.switchToHttp().getRequest().apiKey.scopes).toEqual(['testimonials:read', 'analytics:write']);
    credentials.findLegacyApiKey.mockResolvedValueOnce({ ...key, legacyValidUntil: new Date(0) });
    await expect(guard.canActivate(context(legacy))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('enforces endpoint scopes after authentication', () => {
    const scopes = new ApiKeyScopesGuard({ getAllAndOverride: () => ['analytics:write'] } as any);
    const ctx = context(issued.raw, { apiKey: { scopes: ['testimonials:read'] } });
    expect(() => scopes.canActivate(ctx)).toThrow('API key lacks required scope');
    ctx.switchToHttp().getRequest().apiKey.scopes.push('analytics:write');
    expect(scopes.canActivate(ctx)).toBe(true);
  });
});
