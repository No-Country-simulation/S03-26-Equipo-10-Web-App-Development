import { SetMetadata } from '@nestjs/common';

export const REQUIRE_FEATURE_KEY = 'requireFeature';
export const RequireFeature = (featureName: string) => SetMetadata(REQUIRE_FEATURE_KEY, featureName);
