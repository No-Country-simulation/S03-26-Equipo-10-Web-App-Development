import type { RoleCode } from '../../../common/interfaces/auth-context.interface';

export const AUTH_REPOSITORY = Symbol('IAuthRepository');

export interface UserWithAuth {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  tenantName: string;
  isActive: boolean;
  tenantIsActive: boolean;
  roles: RoleCode[];
  createdAt: Date;
}

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<UserWithAuth | null>;
  findUserById(userId: string): Promise<UserWithAuth | null>;
  createTenantAndAdmin(params: {
    tenantName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserWithAuth>;
  createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findValidRefreshToken(tokenHash: string): Promise<{
    id: string;
    user: UserWithAuth;
  } | null>;
  revokeRefreshToken(tokenId: string): Promise<void>;
  revokeRefreshTokenByHash(tokenHash: string): Promise<void>;
  ensureCatalogs(): Promise<void>;
}
