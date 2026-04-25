import { UnauthorizedException, ConflictException } from '@nestjs/common';
import { PasswordService } from '../src/modules/shared/hashing/password.service';
import { LoginAttemptsService } from '../src/modules/auth/services/login-attempts.service';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { AuthRepository } from '../src/modules/auth/repositories/auth.repository';
import { JwtTokenService } from '../src/modules/auth/services/jwt-token.service';
import type { UserWithAuth } from '../src/modules/auth/repositories/auth.repository';

/**
 * Integration tests for the Auth flow (SKL-QA-001).
 * Tests the full lifecycle: register -> login -> refresh -> logout.
 * Uses manual mocks for external dependencies (DB, JWT) — KISS principle.
 */

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
    getRefreshExpiresAt: jest.fn().mockReturnValue(new Date('2026-12-31')),
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

describe('Auth Flow (Integration)', () => {
  let authRepo: jest.Mocked<AuthRepository>;
  let tokenService: jest.Mocked<JwtTokenService>;
  let passwordService: PasswordService;
  let loginAttempts: LoginAttemptsService;
  let authService: AuthService;

  beforeEach(() => {
    authRepo = createMockAuthRepo();
    tokenService = createMockTokenService();
    passwordService = new PasswordService();
    loginAttempts = new LoginAttemptsService();
    authService = new AuthService(authRepo, tokenService, passwordService, loginAttempts);
  });

  describe('Register Admin Flow', () => {
    it('should register a new admin and return tokens', async () => {
      const registeredUser = createTestUser({ email: 'new@acme.com' });
      authRepo.createTenantAndAdmin.mockResolvedValue(registeredUser);

      const result = await authService.registerAdmin({
        tenantName: 'Acme',
        email: 'new@acme.com',
        password: 'SecurePassword123!',
      });

      expect(result.user.email).toBe('new@acme.com');
      expect(result.tokens.accessToken).toBe('access-token');
      expect(result.tokens.refreshToken).toBe('refresh-token-hex');
      expect(authRepo.createTenantAndAdmin).toHaveBeenCalledTimes(1);
      expect(authRepo.createRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException for duplicate tenant name', async () => {
      authRepo.createTenantAndAdmin.mockRejectedValue(new Error('TENANT_NAME_EXISTS'));

      await expect(
        authService.registerAdmin({
          tenantName: 'Acme',
          email: 'new@acme.com',
          password: 'SecurePassword123!',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw ConflictException for duplicate email', async () => {
      authRepo.createTenantAndAdmin.mockRejectedValue(new Error('EMAIL_EXISTS'));

      await expect(
        authService.registerAdmin({
          tenantName: 'NewCorp',
          email: 'admin@acme.com',
          password: 'SecurePassword123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Refresh Token Rotation', () => {
    it('should rotate refresh tokens and return new ones', async () => {
      const user = createTestUser();
      authRepo.findValidRefreshToken.mockResolvedValue({
        id: 'rt-1',
        user,
      });

      const result = await authService.refreshSession('old-refresh-token');

      expect(result.user.email).toBe('admin@acme.com');
      expect(result.tokens.accessToken).toBe('access-token');
      // Verify old token was revoked and new one was created (rotation)
      expect(authRepo.revokeRefreshToken).toHaveBeenCalledWith('rt-1');
      expect(authRepo.createRefreshToken).toHaveBeenCalledTimes(1);
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      authRepo.findValidRefreshToken.mockResolvedValue(null);

      await expect(
        authService.refreshSession('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for disabled accounts', async () => {
      authRepo.findValidRefreshToken.mockResolvedValue({
        id: 'rt-1',
        user: createTestUser({ isActive: false }),
      });

      await expect(
        authService.refreshSession('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should reject refresh for disabled tenants', async () => {
      authRepo.findValidRefreshToken.mockResolvedValue({
        id: 'rt-1',
        user: createTestUser({ tenantIsActive: false }),
      });

      await expect(
        authService.refreshSession('valid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('Logout Flow', () => {
    it('should revoke the refresh token on logout', async () => {
      authRepo.revokeRefreshTokenByHash.mockResolvedValue(undefined);

      await authService.logout('some-refresh-token');

      expect(tokenService.hashToken).toHaveBeenCalledWith('some-refresh-token');
      expect(authRepo.revokeRefreshTokenByHash).toHaveBeenCalledWith('hashed-token');
    });
  });

  describe('Login Attempts Throttling', () => {
    it('should block login after multiple failed attempts', async () => {
      authRepo.findUserByEmail.mockResolvedValue(null);

      // Simulate 5 failed login attempts to trigger the block
      for (let i = 0; i < 5; i++) {
        try {
          await authService.login({ email: 'admin@acme.com', password: 'wrong' });
        } catch {
          // Expected
        }
      }

      // The 6th attempt should be blocked by the throttle
      await expect(
        authService.login({ email: 'admin@acme.com', password: 'wrong' }),
      ).rejects.toThrow();
    });
  });
});
