import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../../common/decorators/current-user.decorator';
import { Idempotent } from '../../../../common/decorators/idempotent.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../../../common/interfaces/auth-context.interface';
import {
  CreateTestimonialDto,
  ModerateTestimonialDto,
  UpdateTestimonialDto,
} from '../../application/dto/testimonials.dto';
import { TestimonialsService } from '../../application/services/testimonials.service';

@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class TestimonialsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.testimonialsService.list(tenantId);
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.get(tenantId, testimonialId);
  }

  @Post()
  @Idempotent()
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestimonialDto,
  ) {
    return this.testimonialsService.create(tenantId, user.userId, dto);
  }

  @Patch(':testimonial_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.update(tenantId, testimonialId, dto);
  }

  @Delete(':testimonial_id')
  @Roles('admin')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.remove(tenantId, testimonialId);
  }

  @Post(':testimonial_id/submit')
  submit(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.submit(tenantId, testimonialId);
  }

  @Post(':testimonial_id/approve')
  approve(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.approve(tenantId, testimonialId);
  }

  @Post(':testimonial_id/reject')
  reject(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: ModerateTestimonialDto,
  ) {
    return this.testimonialsService.reject(tenantId, testimonialId, dto.reason);
  }

  @Post(':testimonial_id/publish')
  @Idempotent()
  publish(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.publish(tenantId, testimonialId);
  }

  @Post(':testimonial_id/tags/:tag_id')
  attachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    return this.testimonialsService.attachTag(tenantId, testimonialId, tagId);
  }

  @Delete(':testimonial_id/tags/:tag_id')
  detachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    return this.testimonialsService.detachTag(tenantId, testimonialId, tagId);
  }
}

