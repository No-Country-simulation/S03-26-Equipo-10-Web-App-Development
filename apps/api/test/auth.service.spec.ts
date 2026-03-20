import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from '../src/auth/auth.service';
import { LoginAttemptsService } from '../src/auth/login-attempts.service';
import { PasswordService } from '../src/auth/password.service';

function createPrismaMock() {
  const prisma: Record<string, any> = {
    $transaction: jest.fn(async callback => callback(prisma)),
    role: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
    permission: {
      upsert: jest.fn(),
    },
    testimonialStatus: {
      upsert: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    userRole: {
      create: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  return prisma;
}

describe('AuthService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let jwtService: Pick<JwtService, 'signAsync'>;
  let passwordService: PasswordService;
  let loginAttemptsService: LoginAttemptsService;
  let service: AuthService;

  beforeEach(() => {
    prisma = createPrismaMock();
    jwtService = {
      signAsync: jest.fn().mockResolvedValue('access-token'),
    };
    passwordService = new PasswordService();
    loginAttemptsService = new LoginAttemptsService();
    service = new AuthService(
      prisma as never,
      jwtService as JwtService,
      passwordService,
      loginAttemptsService,
    );
  });

  it('registers the first admin with tenant and returns tokens', async () => {
    prisma.tenant.findUnique.mockResolvedValue(null);
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.role.findUnique.mockResolvedValue({ id: 1, code: 'admin' });
    prisma.tenant.create.mockResolvedValue({ id: 'tenant-1', name: 'Acme' });
    prisma.user.create.mockResolvedValue({
      id: 'user-1',
      email: 'admin@acme.com',
      tenantId: 'tenant-1',
      isActive: true,
      createdAt: new Date('2026-03-19T00:00:00.000Z'),
    });
    prisma.refreshToken.create.mockResolvedValue({ id: 'refresh-1' });

    const session = await service.registerAdmin({
      tenantName: 'Acme',
      email: 'admin@acme.com',
      password: 'Admin123!',
    });

    expect(session.user.email).toBe('admin@acme.com');
    expect(session.user.roles).toEqual(['admin']);
    expect(session.tokens.accessToken).toBe('access-token');
    expect(prisma.userRole.create).toHaveBeenCalled();
  });

  it('rejects duplicated tenant names when registering admin', async () => {
    prisma.tenant.findUnique.mockResolvedValue({ id: 'tenant-1' });

    await expect(
      service.registerAdmin({
        tenantName: 'Acme',
        email: 'admin@acme.com',
        password: 'Admin123!',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('rejects invalid credentials on login', async () => {
    const passwordHash = await passwordService.hashPassword('Admin123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'admin@acme.com',
      tenantId: 'tenant-1',
      passwordHash,
      isActive: true,
      createdAt: new Date(),
      tenant: {
        id: 'tenant-1',
        name: 'Acme',
        isActive: true,
      },
      roles: [{ role: { code: 'admin' } }],
    });

    await expect(
      service.login({
        email: 'admin@acme.com',
        password: 'Wrong123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
