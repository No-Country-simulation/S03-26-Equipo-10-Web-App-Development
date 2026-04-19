import { AnalyticsService } from '../services/analytics.service';
import { Body, Controller, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { TrackAnalyticsEventDto } from '../dto/track-analytics-event.dto';

@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @UseGuards(ApiKeyGuard, RateLimitGuard)
  @Idempotent()
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip-api-key' })
  track(
    @CurrentTenantId() tenantId: string,
    @Body() dto: TrackAnalyticsEventDto,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackEvent(tenantId, dto, ip);
  }

  @Post('tenants/:slug/events')
  @UseGuards(RateLimitGuard)
  @Idempotent()
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip' })
  trackBySlug(
    @Param('slug') slug: string,
    @Body() dto: TrackAnalyticsEventDto,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackPublicEventBySlug(slug, dto, ip);
  }
}
