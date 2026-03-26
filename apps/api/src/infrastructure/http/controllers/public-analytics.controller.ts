import { Body, Controller, Ip, Post, UseGuards } from '@nestjs/common';
import { Idempotent } from '../decorators/idempotent.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { TrackAnalyticsEventDto } from '../../../application/dtos/track-analytics-event.dto';
import { TrackEventUseCase } from '../../../application/use-cases/track-event.use-case';

@Controller('public/analytics')
@UseGuards(ApiKeyGuard, RateLimitGuard)
export class PublicAnalyticsController {
  constructor(private readonly trackEvent: TrackEventUseCase) {}

  @Post('events')
  @Idempotent()
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip-api-key' })
  track(
    @CurrentTenantId() tenantId: string,
    @Body() dto: TrackAnalyticsEventDto,
    @Ip() ip: string,
  ) {
    return this.trackEvent.execute(tenantId, dto, ip);
  }
}
