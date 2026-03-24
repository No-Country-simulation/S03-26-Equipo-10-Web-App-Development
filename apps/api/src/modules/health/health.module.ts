import { Module } from '@nestjs/common';
import { HealthRuntimeService } from './application/services/health-runtime.service';
import { HealthController } from './presentation/controllers/health.controller';

@Module({
  providers: [HealthRuntimeService],
  controllers: [HealthController],
  exports: [HealthRuntimeService],
})
export class HealthModule {}
