import { Controller, Get } from '@nestjs/common';
import { HealthRuntimeService } from '../../../application/services/health-runtime.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthRuntimeService) {}

  @Get()
  getHealth() {
    return this.healthService.health();
  }
}
