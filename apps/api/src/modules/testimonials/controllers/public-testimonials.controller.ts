import { TestimonialsService } from '../services/testimonials.service';
import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { PublicTestimonialsQueryDto } from '../dto/testimonials.dto';

@Controller('public/testimonials')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip-api-key' })
export class PublicTestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(
    @CurrentTenantId() tenantId: string,
    @Query() query: PublicTestimonialsQueryDto,
  ) {
    return this.testimonialsService.listPublicTestimonials(tenantId, query);
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getPublicTestimonial(tenantId, testimonialId);
  }
}
