import { Inject, Injectable } from '@nestjs/common';
import { API_KEY_REPOSITORY, IApiKeyRepository } from '../../core/repositories/api-key.repository';

@Injectable()
export class ListApiKeysUseCase {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly apiKeyRepo: IApiKeyRepository,
  ) {}

  async execute(tenantId: string) {
    const keys = await this.apiKeyRepo.findByTenant(tenantId);
    return {
      items: keys,
      meta: { total: keys.length, page: 1, limit: keys.length },
    };
  }
}
