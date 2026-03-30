import { UnauthorizedException } from '@nestjs/common';
import { PasswordService } from '../src/modules/shared/hashing/password.service';
import { LoginAttemptsService } from '../src/modules/auth/services/login-attempts.service';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { AuthRepository } from '../src/modules/auth/repositories/auth.repository';
import { JwtTokenService } from '../src/modules/auth/services/jwt-token.service';
import type { UserWithAuth } from '../src/modules/auth/repositories/auth.repository';

function createMockAuthRepo(): jest.Mocked<AuthRepository> {
  return {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createTenantAndAdmin: jest.fn(),
    createRefreshToken: jest.fn(),
    findValidRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeRefreshTokenByHash: jest.fn(),
    ensureCatalogs: jest.fn(),
  } as unknown as jest.Mocked<AuthRepository>;
}

function createMockTokenService(): jest.Mocked<JwtTokenService> {
  return {
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('refresh-token-hex'),
    hashToken: jest.fn().mockReturnValue('hashed-token'),
    getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2026-04-01')),
  } as unknown as jest.Mocked<JwtTokenService>;
}

function createTestUser(overrides?: Partial<UserWithAuth>): UserWithAuth {
  return {
    id: 'user-1',
    email: 'admin@acme.com',
    passwordHash: '',
    tenantId: 'tenant-1',
    tenantName: 'Acme',
    isActive: true,
    tenantIsActive: true,
    roles: ['admin'],
    createdAt: new Date('2026-03-19'),
    ...overrides,
  };
}

describe('AuthService', () => {
  let authRepo: jest.Mocked<AuthRepository>;
  let tokenService: jest.Mocked<JwtTokenService>;
  let passwordService: PasswordService;
  let loginAttempts: LoginAttemptsService;
  let useCase: AuthService;

  beforeEach(() => {
    authRepo = createMockAuthRepo();
    tokenService = createMockTokenService();
    passwordService = new PasswordService();
    loginAttempts = new LoginAttemptsService();
    useCase = new AuthService(authRepo, tokenService, passwordService, loginAttempts);
  });

  it('returns tokens for valid credentials', async () => {
    const hash = await passwordService.hashPassword('Admin123!');
    authRepo.findUserByEmail.mockResolvedValue(createTestUser({ passwordHash: hash }));

    const result = await useCase.login({
      email: 'admin@acme.com',
      password: 'Admin123!',
    });

    expect(result.user.email).toBe('admin@acme.com');
    expect(result.tokens.accessToken).toBe('access-token');
    expect(authRepo.createRefreshToken).toHaveBeenCalled();
  });

  it('rejects invalid credentials', async () => {
    const hash = await passwordService.hashPassword('Admin123!');
    authRepo.findUserByEmail.mockResolvedValue(createTestUser({ passwordHash: hash }));

    await expect(
      useCase.login({ email: 'admin@acme.com', password: 'Wrong123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects if user not found', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);

    await expect(
      useCase.login({ email: 'nobody@acme.com', password: 'Admin123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects disabled accounts', async () => {
    const hash = await passwordService.hashPassword('Admin123!');
    authRepo.findUserByEmail.mockResolvedValue(createTestUser({ passwordHash: hash, isActive: false }));

    await expect(
      useCase.login({ email: 'admin@acme.com', password: 'Admin123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});

