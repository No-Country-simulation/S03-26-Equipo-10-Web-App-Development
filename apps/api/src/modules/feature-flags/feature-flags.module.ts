import { Module } from '@nestjs/common';
import { FeatureFlagsService } from './application/services/feature-flags.service';
import { FeatureFlagsController } from './presentation/controllers/feature-flags.controller';

@Module({
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
