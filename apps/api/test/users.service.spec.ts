import { ConflictException, NotFoundException } from '@nestjs/common';
import { PasswordService } from '../src/auth/password.service';
import { UsersService } from '../src/users/users.service';

function createPrismaMock() {
  const prisma: Record<string, any> = {
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
    },
    role: {
      findUnique: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    $transaction: jest.fn(async callback => callback(prisma)),
  };

  return prisma;
}

describe('UsersService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: UsersService;

  const currentUser = {
    userId: 'admin-1',
    email: 'admin@demo.com',
    tenantId: 'tenant-1',
    tenantName: 'Demo Tenant',
    roles: ['admin'] as const,
    isActive: true,
  };

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UsersService(prisma as never, new PasswordService());
  });

  it('creates a tenant user with selected role', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 2, code: 'editor' });
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: true });
    prisma.user.create.mockResolvedValue({
      id: 'user-2',
      email: 'editor@demo.com',
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
    });

    const result = await service.createUser(
      {
        email: 'editor@demo.com',
        password: 'Editor123!',
        role: 'editor',
      },
      currentUser,
    );

    expect(result.email).toBe('editor@demo.com');
    expect(result.roles).toEqual(['editor']);
  });

  it('rejects duplicate emails', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    await expect(
      service.createUser(
        {
          email: 'editor@demo.com',
          password: 'Editor123!',
          role: 'editor',
        },
        currentUser,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('fails when tenant is inactive', async () => {
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 2, code: 'editor' });
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1', isActive: false });

    await expect(
      service.createUser(
        {
          email: 'editor@demo.com',
          password: 'Editor123!',
          role: 'editor',
        },
        currentUser,
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
