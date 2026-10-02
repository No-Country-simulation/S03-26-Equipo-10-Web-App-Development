import { CredentialRepository } from '../src/common/repositories/credential.repository';

describe('CredentialRepository', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    apiKey: { findFirst: jest.fn(), updateMany: jest.fn() },
    apiKeyCredential: { findUnique: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const repository = new CredentialRepository(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((run: (tx: typeof prisma) => Promise<unknown>) => run(prisma));
  });

  it('returns only active users from active tenants', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-1', email: 'user@example.com', tenantId: 'tenant-1', isActive: true,
      tenant: { isActive: true, name: 'Tenant' }, roles: [{ role: { code: 'admin' } }],
    });
    await expect(repository.findActiveUser('user-1')).resolves.toEqual({
      userId: 'user-1', email: 'user@example.com', tenantId: 'tenant-1',
      tenantName: 'Tenant', roles: ['admin'], isActive: true,
    });

    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'user-2', isActive: true, tenant: { isActive: false }, roles: [],
    });
    await expect(repository.findActiveUser('user-2')).resolves.toBeNull();
  });

  it('looks up legacy credentials without caching and debounces usage in the database', async () => {
    prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', tenantId: 'tenant-1' });
    prisma.apiKey.updateMany.mockResolvedValue({ count: 1 });
    await expect(repository.findLegacyApiKey('hash')).resolves.toEqual({ id: 'key-1', tenantId: 'tenant-1' });
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { keyHash: 'hash' }, include: { tenant: true },
    });
    await repository.recordApiKeyUse('key-1', 'tenant-1', null, true);
    expect(prisma.apiKey.updateMany).toHaveBeenCalledWith({
      where: { id: 'key-1', tenantId: 'tenant-1', OR: [
        { lastUsedAt: null }, { lastUsedAt: { lte: expect.any(Date) } },
      ] }, data: { lastUsedAt: expect.any(Date) },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: 'API_KEY_LEGACY_USED', tenantId: 'tenant-1', resourceId: 'key-1',
    }) });
    prisma.apiKey.updateMany.mockResolvedValue({ count: 0 });
    await repository.recordApiKeyUse('key-1', 'tenant-1', null, true);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
