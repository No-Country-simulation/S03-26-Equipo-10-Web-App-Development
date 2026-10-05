import { AnalyticsService } from '../services/analytics.service';
import { Body, Controller, Ip, Param, Post, UseGuards } from '@nestjs/common';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { CsrfMode } from '../../../common/decorators/csrf-mode.decorator';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { ApiKeyScopesGuard } from '../../../common/guards/api-key-scopes.guard';
import { RequireApiKeyScopes } from '../../../common/decorators/require-api-key-scopes.decorator';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { TrackAnalyticsEventDto } from '../dto/track-analytics-event.dto';

@Controller('public/analytics')
export class PublicAnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Post('events')
  @CsrfMode('api-key')
  @UseGuards(ApiKeyGuard, ApiKeyScopesGuard, RateLimitGuard)
  @RequireApiKeyScopes('analytics:write')
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip-api-key' })
  track(
    @CurrentTenantId() tenantId: string,
    @Body() dto: TrackAnalyticsEventDto,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackEvent(tenantId, {
      eventType: dto.eventType,
      testimonialId: dto.testimonialId,
      ...(dto.source !== undefined && { source: dto.source }),
    }, ip);
  }

  @Post('tenants/:slug/events')
  @CsrfMode('origin')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 60, windowSeconds: 60, scope: 'ip' })
  trackBySlug(
    @Param('slug') slug: string,
    @Body() dto: TrackAnalyticsEventDto,
    @Ip() ip: string,
  ) {
    return this.analyticsService.trackPublicEventBySlug(slug, {
      eventType: dto.eventType,
      testimonialId: dto.testimonialId,
      ...(dto.source !== undefined && { source: dto.source }),
    }, ip);
  }
}
