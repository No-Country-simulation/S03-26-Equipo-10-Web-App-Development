import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../../common/errors/application.error';
import { ApiKeyCryptoService, type ApiKeyScope } from '../../../common/services/api-key-crypto.service';
import { ApiKeyRepository } from '../repositories/api-key.repository';
import { CreateApiKeyDto, RotateApiKeyDto } from '../dto/api-key.dto';
import type { AdminPage } from '../../../common/pagination/admin-page';

@Injectable()
export class ApiKeysService {
  constructor(
    private readonly apiKeyRepo: ApiKeyRepository,
    private readonly crypto: ApiKeyCryptoService,
  ) {}

  async createApiKey(tenantId: string, ownerId: string, dto: CreateApiKeyDto) {
    const issued = this.crypto.issue();
    const result = await this.apiKeyRepo.create({
      tenantId, ownerId, name: dto.name, scopes: dto.scopes as ApiKeyScope[],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null, issued,
    });
    return { ...result, apiKey: issued.raw };
  }

  async listApiKeys(tenantId: string, page: AdminPage = { page: 1, limit: 20 }) {
    const { items, total } = await this.apiKeyRepo.findByTenant(tenantId, page);
    return {
      items: items.map(key => ({ ...key, legacyDeadline: this.crypto.legacyDeadline() })),
      meta: { total, page: page.page, limit: page.limit },
    };
  }

  async getApiKey(tenantId: string, apiKeyId: string) {
    const key = await this.apiKeyRepo.findById(tenantId, apiKeyId);
    if (!key) throw new NotFoundError('API key not found');
    return { ...key, legacyDeadline: this.crypto.legacyDeadline() };
  }

  async revokeApiKey(tenantId: string, actorId: string, apiKeyId: string) {
    const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
    if (!current) throw new NotFoundError('API key not found');

    await this.apiKeyRepo.revoke(tenantId, actorId, apiKeyId);
    return { id: apiKeyId, revoked: true };
  }

  async rotateApiKey(tenantId: string, actorId: string, apiKeyId: string, dto: RotateApiKeyDto) {
    const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
    if (!current) throw new NotFoundError('API key not found');

    const issued = this.crypto.issue();
    const existingScopes: ApiKeyScope[] = current.legacy && current.scopes.length === 0
      ? ['testimonials:read', 'analytics:write'] : current.scopes;
    const result = await this.apiKeyRepo.rotate({
      tenantId, actorId, apiKeyId, name: dto.name ?? current.name,
      scopes: (dto.scopes ?? existingScopes) as ApiKeyScope[],
      expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : current.expiresAt,
      issued,
    });
    return { ...result, apiKey: issued.raw };
  }
}
