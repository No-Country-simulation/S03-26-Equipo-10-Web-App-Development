import { UnauthorizedException } from '@nestjs/common';
import { PasswordService } from '../src/common/hashing/password.service';
import { LoginAttemptsService } from '../src/application/services/login-attempts.service';
import { LoginUseCase } from '../src/application/use-cases/login.use-case';
import type { IAuthRepository, UserWithAuth } from '../src/core/repositories/auth.repository';
import type { ITokenService } from '../src/application/ports/token.port';

function createMockAuthRepo(): jest.Mocked<IAuthRepository> {
  return {
    findUserByEmail: jest.fn(),
    findUserById: jest.fn(),
    createTenantAndAdmin: jest.fn(),
    createRefreshToken: jest.fn(),
    findValidRefreshToken: jest.fn(),
    revokeRefreshToken: jest.fn(),
    revokeRefreshTokenByHash: jest.fn(),
    ensureCatalogs: jest.fn(),
  };
}

function createMockTokenService(): jest.Mocked<ITokenService> {
  return {
    signAccessToken: jest.fn().mockResolvedValue('access-token'),
    generateRefreshToken: jest.fn().mockReturnValue('refresh-token-hex'),
    hashToken: jest.fn().mockReturnValue('hashed-token'),
    getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2026-04-01')),
  };
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

describe('LoginUseCase', () => {
  let authRepo: jest.Mocked<IAuthRepository>;
  let tokenService: jest.Mocked<ITokenService>;
  let passwordService: PasswordService;
  let loginAttempts: LoginAttemptsService;
  let useCase: LoginUseCase;

  beforeEach(() => {
    authRepo = createMockAuthRepo();
    tokenService = createMockTokenService();
    passwordService = new PasswordService();
    loginAttempts = new LoginAttemptsService();
    useCase = new LoginUseCase(authRepo, tokenService, passwordService, loginAttempts);
  });

  it('returns tokens for valid credentials', async () => {
    const hash = await passwordService.hashPassword('Admin123!');
    authRepo.findUserByEmail.mockResolvedValue(createTestUser({ passwordHash: hash }));

    const result = await useCase.execute({
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
      useCase.execute({ email: 'admin@acme.com', password: 'Wrong123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects if user not found', async () => {
    authRepo.findUserByEmail.mockResolvedValue(null);

    await expect(
      useCase.execute({ email: 'nobody@acme.com', password: 'Admin123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejects disabled accounts', async () => {
    const hash = await passwordService.hashPassword('Admin123!');
    authRepo.findUserByEmail.mockResolvedValue(createTestUser({ passwordHash: hash, isActive: false }));

    await expect(
      useCase.execute({ email: 'admin@acme.com', password: 'Admin123!' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});
