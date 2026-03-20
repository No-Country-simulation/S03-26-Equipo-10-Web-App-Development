import type { Request } from 'express';

export type RoleCode = 'admin' | 'editor';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: RoleCode[];
  isActive: boolean;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: RoleCode[];
}

export interface RequestWithUser extends Request {
  user: AuthenticatedUser;
}
