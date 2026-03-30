import { Module } from '@nestjs/common';

import { HealthController } from './controllers/health.controller';
import { HealthRuntimeService } from './services/health-runtime.service';

@Module({
  controllers: [HealthController],
  providers: [HealthRuntimeService],
  exports: [HealthRuntimeService],
})
export class HealthModule {}


