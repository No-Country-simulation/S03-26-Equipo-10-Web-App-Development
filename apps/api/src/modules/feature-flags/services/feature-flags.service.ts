import { Injectable, NotFoundException } from "@nestjs/common";
import { FeatureFlagRepository } from "../repositories/feature-flag.repository";

@Injectable()
export class FeatureFlagsService {
    async listFeatureFlags(tenantId: string) {
        const flags = await this.featureFlagRepo.findAll(tenantId);
        return {
          items: flags,
          meta: { total: flags.length, page: 1, limit: flags.length },
        };
    }

    async getFeatureFlag(tenantId: string, flagName: string) {
        const flag = await this.featureFlagRepo.findByName(tenantId, flagName);
        if (!flag) {
            throw new NotFoundException(`Feature flag '${flagName}' not found`);
        }
        return flag;
    }

    async setFeatureFlag(tenantId: string, flagName: string, enabled: boolean) {
        return this.featureFlagRepo.setFlag(tenantId, flagName, enabled);
    }

    constructor(private readonly featureFlagRepo: FeatureFlagRepository) {
    }
}
