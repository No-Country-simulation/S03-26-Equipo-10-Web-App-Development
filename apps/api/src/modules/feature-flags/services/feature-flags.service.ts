import { Injectable, Inject } from "@nestjs/common";
import { FEATURE_FLAG_REPOSITORY, IFeatureFlagRepository } from "../repositories/feature-flag.repository";

@Injectable()
export class FeatureFlagsService {
    async listFeatureFlags(tenantId: string) {
        const flags = await this.featureFlagRepo.findAll(tenantId);
        return {
          items: flags,
          meta: { total: flags.length, page: 1, limit: flags.length },
        };
    }

    async setFeatureFlag(tenantId: string, flagName: string, enabled: boolean) {
        return this.featureFlagRepo.setFlag(tenantId, flagName, enabled);
    }

    constructor(@Inject(FEATURE_FLAG_REPOSITORY) private readonly featureFlagRepo: IFeatureFlagRepository) {
    }
}
