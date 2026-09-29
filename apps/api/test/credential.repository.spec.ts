import { CredentialRepository } from '../src/common/repositories/credential.repository';

describe('CredentialRepository', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    apiKey: { findFirst: jest.fn(), update: jest.fn() },
  };
  const repository = new CredentialRepository(prisma as any);

  beforeEach(() => jest.clearAllMocks());

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

  it('returns the tenant from a verified API key row and records usage', async () => {
    prisma.apiKey.findFirst.mockResolvedValue({ id: 'key-1', tenantId: 'tenant-1' });
    prisma.apiKey.update.mockResolvedValue({});
    await expect(repository.findActiveApiKeyByHash('hash')).resolves.toEqual({
      apiKeyId: 'key-1', tenantId: 'tenant-1',
    });
    expect(prisma.apiKey.findFirst).toHaveBeenCalledWith({
      where: { keyHash: 'hash', isActive: true, tenant: { isActive: true } },
    });
    expect(prisma.apiKey.update).toHaveBeenCalledWith({
      where: { id: 'key-1' }, data: { lastUsedAt: expect.any(Date) },
    });
  });
});
