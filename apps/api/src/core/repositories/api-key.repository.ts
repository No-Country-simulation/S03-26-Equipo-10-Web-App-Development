export const API_KEY_REPOSITORY = Symbol('IApiKeyRepository');

export interface ApiKeyView {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiKeyCreateResult {
  id: string;
  name: string;
  apiKey: string;
  createdAt: Date;
}

export interface ApiKeyRotateResult {
  id: string;
  name: string;
  apiKey: string;
  updatedAt: Date;
}

export interface IApiKeyRepository {
  findByTenant(tenantId: string): Promise<ApiKeyView[]>;
  findById(tenantId: string, apiKeyId: string): Promise<ApiKeyView | null>;
  create(tenantId: string, name: string, keyHash: string): Promise<{ id: string; name: string; createdAt: Date }>;
  rotate(apiKeyId: string, name: string, keyHash: string): Promise<{ id: string; name: string; updatedAt: Date }>;
  revoke(apiKeyId: string): Promise<void>;
}
