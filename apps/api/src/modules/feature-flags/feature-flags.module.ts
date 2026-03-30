import { Module } from '@nestjs/common';

import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { FeatureFlagsService } from './services/feature-flags.service';

import { FeatureFlagRepository } from './repositories/feature-flag.repository';

@Module({
  controllers: [FeatureFlagsController],
  providers: [
    FeatureFlagRepository,
    FeatureFlagsService,
  ],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}


