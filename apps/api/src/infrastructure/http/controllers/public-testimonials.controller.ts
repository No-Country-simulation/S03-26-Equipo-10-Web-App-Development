import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { RateLimit } from '../decorators/rate-limit.decorator';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { RateLimitGuard } from '../guards/rate-limit.guard';
import { PublicTestimonialsQueryDto } from '../../../application/dtos/testimonials.dto';
import { ListPublicTestimonialsUseCase } from '../../../application/use-cases/list-public-testimonials.use-case';
import { GetPublicTestimonialUseCase } from '../../../application/use-cases/get-public-testimonial.use-case';

@Controller('public/testimonials')
@UseGuards(ApiKeyGuard, RateLimitGuard)
@RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip-api-key' })
export class PublicTestimonialsController {
  constructor(
    private readonly listPublicUseCase: ListPublicTestimonialsUseCase,
    private readonly getPublicUseCase: GetPublicTestimonialUseCase,
  ) {}

  @Get()
  list(
    @CurrentTenantId() tenantId: string,
    @Query() query: PublicTestimonialsQueryDto,
  ) {
    return this.listPublicUseCase.execute(tenantId, query);
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.getPublicUseCase.execute(tenantId, testimonialId);
  }
}
