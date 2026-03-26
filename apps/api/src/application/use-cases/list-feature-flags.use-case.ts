import { Inject, Injectable } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from '../../core/repositories/feature-flag.repository';

@Injectable()
export class ListFeatureFlagsUseCase {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY) private readonly featureFlagRepo: IFeatureFlagRepository,
  ) {}

  async execute(tenantId: string) {
    const flags = await this.featureFlagRepo.findAll(tenantId);
    return {
      items: flags,
      meta: { total: flags.length, page: 1, limit: flags.length },
    };
  }
}
