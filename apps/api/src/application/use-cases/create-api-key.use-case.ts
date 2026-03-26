import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { API_KEY_REPOSITORY, IApiKeyRepository } from '../../core/repositories/api-key.repository';
import { CreateApiKeyDto } from '../dtos/api-key.dto';

@Injectable()
export class CreateApiKeyUseCase {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly apiKeyRepo: IApiKeyRepository,
  ) {}

  async execute(tenantId: string, dto: CreateApiKeyDto) {
    const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawApiKey).digest('hex');

    const result = await this.apiKeyRepo.create(tenantId, dto.name, keyHash);
    return { ...result, apiKey: rawApiKey };
  }
}
