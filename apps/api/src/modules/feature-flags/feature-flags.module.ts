import { Module } from '@nestjs/common';

import { FeatureFlagsController } from './controllers/feature-flags.controller';
import { FeatureFlagsService } from './services/feature-flags.service';

import { FEATURE_FLAG_REPOSITORY } from './repositories/feature-flag.repository';
import { PrismaFeatureFlagRepository } from './repositories/prisma-feature-flag.repository';

@Module({
  controllers: [FeatureFlagsController],
  providers: [
    { provide: FEATURE_FLAG_REPOSITORY, useClass: PrismaFeatureFlagRepository },
    FeatureFlagsService,
  ],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
