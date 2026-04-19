import { TestimonialsService } from '../services/testimonials.service';
import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Res } from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { RateLimit } from '../../../common/decorators/rate-limit.decorator';
import { ApiKeyGuard } from '../../../common/guards/api-key.guard';
import { RateLimitGuard } from '../../../common/guards/rate-limit.guard';
import { PublicTestimonialsQueryDto, SubmitPublicTestimonialDto } from '../dto/testimonial.dto';
import { Request, Response } from 'express';

import { FeatureFlagGuard } from '../../../common/guards/feature-flag.guard';
import { RequireFeature } from '../../../common/decorators/feature-flag.decorator';

@Controller('public/testimonials')
export class PublicTestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  @UseGuards(ApiKeyGuard, RateLimitGuard, FeatureFlagGuard)
  @RequireFeature('testimonials')
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip-api-key' })
  list(
    @CurrentTenantId() tenantId: string,
    @Query() query: PublicTestimonialsQueryDto,
  ) {
    return this.testimonialsService.listPublicTestimonials(tenantId, query);
  }

  @Get('tenants/:slug')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip' })
  listBySlug(
    @Param('slug') slug: string,
    @Query() query: PublicTestimonialsQueryDto,
  ) {
    return this.testimonialsService.listPublicTestimonialsBySlug(slug, query);
  }

  @Get(':testimonial_id')
  @UseGuards(ApiKeyGuard, RateLimitGuard, FeatureFlagGuard)
  @RequireFeature('testimonials')
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip-api-key' })
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getPublicTestimonial(tenantId, testimonialId);
  }

  @Get('tenants/:slug/:testimonial_id')
  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip' })
  getOneBySlug(
    @Param('slug') slug: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getPublicTestimonialBySlug(slug, testimonialId);
  }

  @Post(':slug/submit')
  @UseGuards(RateLimitGuard) // No ApiKeyGuard since it's truly public via slug
  @RateLimit({ limit: 3, windowSeconds: 86400, scope: 'ip' }) // 3 submits per 24 hours per IP
  async submit(
    @Param('slug') slug: string,
    @Body() dto: SubmitPublicTestimonialDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // 1. Anti-spam via HTTPOnly Cookier
    const submissionCookieKey = `ts_submitted_${slug}`;
    const cookiesHeader = req.headers.cookie || '';
    if (cookiesHeader.includes(`${submissionCookieKey}=true`)) {
      // Respond identically to a successful submission to slow down scrapers/bots
      return { status: 'received' }; 
    }

    const result = await this.testimonialsService.submitPublicTestimonial(slug, dto);

    // 2. Set strict cookie (30 days) to deter simple repetitive forms
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30);
    
    res.cookie(submissionCookieKey, 'true', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      expires: expiryDate,
    });

    return { status: 'success', id: result.id };
  }

  @Get(':slug/form-info')
  @UseGuards(RateLimitGuard) // No ApiKeyGuard
  @RateLimit({ limit: 120, windowSeconds: 60, scope: 'ip' })
  async getFormInfo(@Param('slug') slug: string) {
    return this.testimonialsService.getPublicFormInfo(slug);
  }
}
