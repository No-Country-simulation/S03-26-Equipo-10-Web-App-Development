import type { RoleCode } from '../interfaces/auth-context.interface';

export const TOKEN_SERVICE = Symbol('ITokenService');

export interface TokenPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: RoleCode[];
}

export interface ITokenService {
  signAccessToken(payload: TokenPayload): Promise<string>;
  generateRefreshToken(): string;
  hashToken(token: string): string;
  getRefreshExpiresAt(): Date;
}
