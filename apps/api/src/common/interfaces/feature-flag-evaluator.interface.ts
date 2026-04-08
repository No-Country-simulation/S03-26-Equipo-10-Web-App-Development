/**
 * Abstract class used as a DI token so that common/guards can depend
 * on this abstraction instead of importing the concrete FeatureFlagRepository
 * from modules/feature-flags, keeping the dependency direction correct
 * (modules → common, never common → modules).
 */
export abstract class IFeatureFlagEvaluator {
  abstract isEnabled(tenantId: string, flagName: string): Promise<boolean>;
}
