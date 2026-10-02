import type { Request } from 'express';
import type { ApiKeyEnvironment, ApiKeyScope } from '../services/api-key-crypto.service';

export type RoleCode = 'admin' | 'editor';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  roles: RoleCode[];
  sid?: string;
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

export interface RequestContext {
  readonly requestId: string;
  readonly correlationId: string;
}

export interface ApiRequest extends Request {
  tenantId?: string;
  user?: AuthenticatedUser;
  apiKey?: {
    apiKeyId: string;
    tenantId: string;
    ownerId: string | null;
    publicId?: string;
    scopes: ApiKeyScope[];
    environment: ApiKeyEnvironment | 'legacy';
    legacy: boolean;
  };
  requestContext?: RequestContext;
}
