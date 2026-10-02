import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { ApiKeyCryptoService } from '../src/common/services/api-key-crypto.service';
import { ApiKeyGuard } from '../src/common/guards/api-key.guard';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { ApiKeyRepository } from '../src/modules/api-keys/repositories/api-key.repository';
import { ApiKeysService } from '../src/modules/api-keys/services/api-keys.service';
import type { PrismaService } from '../src/modules/database/prisma.service';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !databaseUrl) throw new Error('TEST_DATABASE_URL is required for API key integration');
const describeWithDatabase = databaseUrl ? describe : describe.skip;

describeWithDatabase('API key lifecycle in PostgreSQL', () => {
  let prisma: PrismaClient;
  let second: PrismaClient;
  let service: ApiKeysService;
  let guard: ApiKeyGuard;
  let tenantId: string;
  let otherTenantId: string;
  let ownerId: string;
  const settings = {
    environment: 'test' as const, currentPepperVersion: 1,
    peppers: { '1': Buffer.alloc(32, 9).toString('base64url') },
    legacyStartedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  };

  const context = (raw: string) => {
    const req: Record<string, unknown> = {
      header: (name: string) => name === 'authorization' ? `Bearer ${raw}` : undefined,
      headers: { 'x-tenant-id': 'forged-tenant' },
    };
    return { req, execution: { switchToHttp: () => ({ getRequest: () => req }) } as any };
  };

  beforeAll(async () => {
    if (!databaseUrl) throw new Error('Disposable PostgreSQL required');
    prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    second = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    await Promise.all([prisma.$connect(), second.$connect()]);
    const first = await prisma.tenant.create({ data: { name: `api-key-${randomUUID()}` } });
    const other = await prisma.tenant.create({ data: { name: `api-key-${randomUUID()}` } });
    tenantId = first.id;
    otherTenantId = other.id;
    const owner = await prisma.user.create({ data: {
      tenantId, email: `api-key-${randomUUID()}@example.test`, passwordHash: 'unused',
    } });
    ownerId = owner.id;
    const crypto = new ApiKeyCryptoService({ getOrThrow: () => ({ apiKeys: settings }) } as any);
    service = new ApiKeysService(new ApiKeyRepository(prisma as PrismaService), crypto);
    guard = new ApiKeyGuard(new CredentialRepository(second as PrismaService), crypto);
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({ where: { tenantId } });
    await prisma.apiKeyCredential.deleteMany({ where: { apiKey: { tenantId } } });
    await prisma.apiKey.deleteMany({ where: { tenantId } });
    await prisma.user.delete({ where: { id: ownerId } });
    await prisma.tenant.deleteMany({ where: { id: { in: [tenantId, otherTenantId] } } });
    await Promise.all([prisma.$disconnect(), second.$disconnect()]);
  });

  it('reveals a new secret only on create, enforces tenant and rotates with 24-hour overlap', async () => {
    const created = await service.createApiKey(tenantId, ownerId, {
      name: 'Widget', scopes: ['testimonials:read'],
    } as any);
    expect(created.apiKey).toMatch(/^ak_test_[0-9a-f]{16}_[0-9a-f]{64}$/);
    const listed = await service.listApiKeys(tenantId);
    expect(listed.items[0]).toMatchObject({ id: created.id, ownerId, scopes: ['testimonials:read'] });
    expect(JSON.stringify(listed)).not.toContain(created.apiKey);
    expect(JSON.stringify(listed)).not.toContain('secretDigest');
    await expect(service.getApiKey(otherTenantId, created.id)).rejects.toThrow('API key not found');
    const original = context(created.apiKey);
    await expect(guard.canActivate(original.execution)).resolves.toBe(true);
    expect((original.req.apiKey as { tenantId: string }).tenantId).toBe(tenantId);
    const firstUsedAt = (await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } })).lastUsedAt;
    expect(firstUsedAt).not.toBeNull();

    const rotated = await service.rotateApiKey(tenantId, ownerId, created.id, {
      scopes: ['analytics:write'],
    } as any);
    expect(rotated.id).toBe(created.id);
    expect(rotated.apiKey).not.toBe(created.apiKey);
    const oldCredential = await prisma.apiKeyCredential.findUniqueOrThrow({
      where: { publicId: created.publicId! },
    });
    expect(oldCredential.status).toBe('ROTATING');
    expect(oldCredential.expiresAt!.getTime() - Date.now()).toBeGreaterThan(23 * 60 * 60 * 1000);
    const old = context(created.apiKey);
    await expect(guard.canActivate(old.execution)).resolves.toBe(true);
    expect((old.req.apiKey as { scopes: string[] }).scopes).toEqual(['testimonials:read']);
    const next = context(rotated.apiKey);
    await expect(guard.canActivate(next.execution)).resolves.toBe(true);
    expect((next.req.apiKey as { scopes: string[] }).scopes).toEqual(['analytics:write']);
    expect((await prisma.apiKey.findUniqueOrThrow({ where: { id: created.id } })).lastUsedAt).toEqual(firstUsedAt);
    expect(await prisma.auditLog.count({ where: { resourceId: created.id, action: 'API_KEY_USED' } })).toBe(1);

    await service.revokeApiKey(tenantId, ownerId, created.id);
    await expect(guard.canActivate(context(created.apiKey).execution)).rejects.toThrow('Invalid API key');
    await expect(guard.canActivate(context(rotated.apiKey).execution)).rejects.toThrow('Invalid API key');
    expect(await prisma.auditLog.count({ where: { resourceId: created.id, action: 'API_KEY_REVOKED' } })).toBe(1);
    const audit = await prisma.auditLog.findMany({ where: { resourceId: created.id } });
    const metadata = JSON.stringify(audit.map(entry => entry.metadata));
    expect(metadata).not.toContain(created.apiKey);
    expect(metadata).not.toContain(rotated.apiKey);
  });

  it('rejects an expired credential and allows only one concurrent rotation', async () => {
    const created = await service.createApiKey(tenantId, ownerId, {
      name: 'Concurrent', scopes: ['testimonials:read'],
    } as any);
    await prisma.apiKeyCredential.update({
      where: { publicId: created.publicId! }, data: { expiresAt: new Date(0) },
    });
    await expect(guard.canActivate(context(created.apiKey).execution)).rejects.toThrow('Invalid API key');

    const secondService = new ApiKeysService(new ApiKeyRepository(second as PrismaService),
      new ApiKeyCryptoService({ getOrThrow: () => ({ apiKeys: settings }) } as any));
    const results = await Promise.allSettled([
      service.rotateApiKey(tenantId, ownerId, created.id, {} as any),
      secondService.rotateApiKey(tenantId, ownerId, created.id, {} as any),
    ]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const credentials = await prisma.apiKeyCredential.findMany({ where: { apiKeyId: created.id } });
    expect(credentials).toHaveLength(2);
    expect(credentials.filter(credential => credential.status === 'ACTIVE')).toHaveLength(1);
  });

  it('does not extend an old credential past its original expiration', async () => {
    const originalExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const created = await service.createApiKey(tenantId, ownerId, {
      name: 'Expiring', scopes: ['testimonials:read'], expiresAt: originalExpiry.toISOString(),
    } as any);
    await service.rotateApiKey(tenantId, ownerId, created.id, {
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    const old = await prisma.apiKeyCredential.findUniqueOrThrow({ where: { publicId: created.publicId! } });
    expect(old.expiresAt).toEqual(originalExpiry);
  });

  it('accepts a legacy tms_ key during migration, then cuts it off after rotation', async () => {
    const raw = `tms_${'a'.repeat(48)}`;
    const crypto = new ApiKeyCryptoService({ getOrThrow: () => ({ apiKeys: settings }) } as any);
    const originalExpiry = new Date(Date.now() + 60 * 60 * 1000);
    const key = await prisma.apiKey.create({ data: {
      tenantId, name: 'Legacy', keyHash: crypto.legacyHash(raw), isActive: true,
      expiresAt: originalExpiry,
    } });
    const legacy = context(raw);
    await expect(guard.canActivate(legacy.execution)).resolves.toBe(true);
    expect((legacy.req.apiKey as { scopes: string[] }).scopes).toEqual(['testimonials:read', 'analytics:write']);
    const rotated = await service.rotateApiKey(tenantId, ownerId, key.id, {
      expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    } as any);
    expect(rotated.apiKey).toMatch(/^ak_test_/);
    expect((await prisma.apiKey.findUniqueOrThrow({ where: { id: key.id } })).legacyValidUntil).toEqual(originalExpiry);
    await prisma.apiKey.update({ where: { id: key.id }, data: { legacyValidUntil: new Date(0) } });
    await expect(guard.canActivate(context(raw).execution)).rejects.toThrow('Invalid API key');
    await expect(guard.canActivate(context(rotated.apiKey).execution)).resolves.toBe(true);
  });
});
