import { Module } from '@nestjs/common';

import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { FeatureFlagsService } from './services/feature-flags.service';

import { FeatureFlagRepository } from './repositories/feature-flag.repository';
import { IFeatureFlagEvaluator } from '../../common/interfaces/feature-flag-evaluator.interface';

@Module({
  controllers: [FeatureFlagsController],
  providers: [
    FeatureFlagRepository,
    FeatureFlagsService,
    { provide: IFeatureFlagEvaluator, useExisting: FeatureFlagRepository },
  ],
  exports: [FeatureFlagsService, FeatureFlagRepository, IFeatureFlagEvaluator],
})
export class FeatureFlagsModule {}


