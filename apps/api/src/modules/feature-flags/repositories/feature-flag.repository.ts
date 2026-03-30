export const FEATURE_FLAG_REPOSITORY = Symbol('IFeatureFlagRepository');

export interface FeatureFlagView {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

export interface FeatureFlagSetResult {
  flagName: string;
  enabled: boolean;
  tenantId: string;
  updatedAt: Date;
}

export interface IFeatureFlagRepository {
  findAll(tenantId: string): Promise<FeatureFlagView[]>;
  setFlag(tenantId: string, flagName: string, enabled: boolean): Promise<FeatureFlagSetResult>;
}
