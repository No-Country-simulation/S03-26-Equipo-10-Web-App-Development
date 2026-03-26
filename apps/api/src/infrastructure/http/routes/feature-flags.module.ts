import { Module } from '@nestjs/common';
import { FEATURE_FLAG_REPOSITORY } from '../../../core/repositories/feature-flag.repository';
import { PrismaFeatureFlagRepository } from '../../database/repositories/prisma-feature-flag.repository';
import { ListFeatureFlagsUseCase } from '../../../application/use-cases/list-feature-flags.use-case';
import { SetFeatureFlagUseCase } from '../../../application/use-cases/set-feature-flag.use-case';
import { FeatureFlagsController } from '../controllers/feature-flags.controller';

@Module({
  controllers: [FeatureFlagsController],
  providers: [
    { provide: FEATURE_FLAG_REPOSITORY, useClass: PrismaFeatureFlagRepository },
    ListFeatureFlagsUseCase,
    SetFeatureFlagUseCase,
  ],
  exports: [ListFeatureFlagsUseCase],
})
export class FeatureFlagsModule {}
