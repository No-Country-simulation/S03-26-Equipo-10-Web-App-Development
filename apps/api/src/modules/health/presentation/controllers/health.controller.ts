import { Controller, Get } from '@nestjs/common';
import { HealthRuntimeService } from '../../application/services/health-runtime.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthRuntimeService) {}

  @Get()
  health() {
    return this.healthService.health();
  }

  @Get('ready')
  ready() {
    return this.healthService.ready();
  }

  @Get('live')
  live() {
    return this.healthService.live();
  }
}
