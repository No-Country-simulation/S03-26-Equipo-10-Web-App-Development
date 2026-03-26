import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { API_KEY_REPOSITORY, IApiKeyRepository } from '../../core/repositories/api-key.repository';

@Injectable()
export class RevokeApiKeyUseCase {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly apiKeyRepo: IApiKeyRepository,
  ) {}

  async execute(tenantId: string, apiKeyId: string) {
    const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
    if (!current) throw new NotFoundException('API key not found');

    await this.apiKeyRepo.revoke(apiKeyId);
    return { id: apiKeyId, revoked: true };
  }
}
