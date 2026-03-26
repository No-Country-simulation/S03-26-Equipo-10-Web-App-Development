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

export interface ApiKeyContext {
  apiKeyId: string;
  tenantId: string;
}

export interface RequestContext {
  requestId: string;
  correlationId: string;
}

export interface ApiRequest extends Request {
  user?: AuthenticatedUser;
  apiKey?: ApiKeyContext;
  requestContext?: RequestContext;
}

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: RoleCode[];
}
