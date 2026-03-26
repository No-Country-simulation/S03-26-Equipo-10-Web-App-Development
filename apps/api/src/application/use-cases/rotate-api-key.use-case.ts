import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { API_KEY_REPOSITORY, IApiKeyRepository } from '../../core/repositories/api-key.repository';
import { RotateApiKeyDto } from '../dtos/api-key.dto';

@Injectable()
export class RotateApiKeyUseCase {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly apiKeyRepo: IApiKeyRepository,
  ) {}

  async execute(tenantId: string, apiKeyId: string, dto: RotateApiKeyDto) {
    const current = await this.apiKeyRepo.findById(tenantId, apiKeyId);
    if (!current) throw new NotFoundException('API key not found');

    const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
    const keyHash = createHash('sha256').update(rawApiKey).digest('hex');

    const result = await this.apiKeyRepo.rotate(apiKeyId, dto.name ?? current.name, keyHash);
    return { ...result, apiKey: rawApiKey };
  }
}
