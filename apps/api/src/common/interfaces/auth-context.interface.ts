import type { Request } from 'express';

export type RoleCode = 'admin' | 'editor';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: RoleCode[];
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  userId: string;
  email: string;
  tenantId: string;
  tenantName: string;
  roles: RoleCode[];
  isActive: boolean;
}

export interface ApiRequest extends Request {
  tenantId?: string;
  user?: AuthenticatedUser;
  apiKey?: { apiKeyId: string; tenantId: string };
  requestContext?: unknown;
}
