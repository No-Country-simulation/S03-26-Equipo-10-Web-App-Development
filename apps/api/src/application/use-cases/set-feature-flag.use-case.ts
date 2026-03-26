import { Inject, Injectable } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from '../../core/repositories/feature-flag.repository';

@Injectable()
export class SetFeatureFlagUseCase {
  constructor(
    @Inject(FEATURE_FLAG_REPOSITORY) private readonly featureFlagRepo: IFeatureFlagRepository,
  ) {}

  async execute(tenantId: string, flagName: string, enabled: boolean) {
    return this.featureFlagRepo.setFlag(tenantId, flagName, enabled);
  }
}
