import { NotFoundException, Injectable, Inject } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { ApiKeyRepository } from "../repositories/api-key.repository";
import { CreateApiKeyDto, RotateApiKeyDto } from "../dto/api-key.dto";

@Injectable()
export class ApiKeysService {
    async createApiKey(tenantId: string, dto: CreateApiKeyDto) {
        const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
        const keyHash = createHash('sha256').update(rawApiKey).digest('hex');

        const result = await this.apiKeyRepo.create(tenantId, dto.name, keyHash);
        return { ...result, apiKey: rawApiKey };
    }

    async listApiKeys(tenantId: string) {
        const keys = await this.apiKeyRepo.findByTenant(tenantId);
        return {
          items: keys,
          meta: { total: keys.length, page: 1, limit: keys.length },
        };
    }

    async revokeApiKey(tenantId: string, apiKeyId: string) {
        const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
        if (!current) throw new NotFoundException('API key not found');

        await this.apiKeyRepo.revoke(apiKeyId);
        return { id: apiKeyId, revoked: true };
    }

    async rotateApiKey(tenantId: string, apiKeyId: string, dto: RotateApiKeyDto) {
        const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
        if (!current) throw new NotFoundException('API key not found');

        const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
        const keyHash = createHash('sha256').update(rawApiKey).digest('hex');

        const result = await this.apiKeyRepo.rotate(apiKeyId, dto.name ?? current.name, keyHash);
        return { ...result, apiKey: rawApiKey };
    }

    constructor(private readonly apiKeyRepo: ApiKeyRepository) {
    }
}
