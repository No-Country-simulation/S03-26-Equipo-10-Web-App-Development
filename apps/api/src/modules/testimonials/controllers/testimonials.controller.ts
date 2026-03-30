import { TestimonialsService } from '../services/testimonials.service';
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
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import {
  CreateTestimonialDto,
  ModerateTestimonialDto,
  UpdateTestimonialDto,
} from '../dto/testimonials.dto';
import { TagsService } from '../services/tags.service';

@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class TestimonialsController {
  constructor(
    private readonly testimonialsService: TestimonialsService,
    private readonly tagsService: TagsService,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.testimonialsService.listTestimonials(tenantId);
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getTestimonial(tenantId, testimonialId);
  }

  @Post()
  @Idempotent()
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestimonialDto,
  ) {
    return this.testimonialsService.createTestimonial(tenantId, user.userId, dto);
  }

  @Patch(':testimonial_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.updateTestimonial(tenantId, testimonialId, dto);
  }

  @Delete(':testimonial_id')
  @Roles('admin')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.removeTestimonial(tenantId, testimonialId);
  }

  @Post(':testimonial_id/submit')
  submit(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.submitTestimonial(tenantId, testimonialId);
  }

  @Post(':testimonial_id/approve')
  approve(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.approveTestimonial(tenantId, testimonialId);
  }

  @Post(':testimonial_id/reject')
  reject(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: ModerateTestimonialDto,
  ) {
    return this.testimonialsService.rejectTestimonial(tenantId, testimonialId, dto.reason ?? '');
  }

  @Post(':testimonial_id/publish')
  @Idempotent()
  publish(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.publishTestimonial(tenantId, testimonialId);
  }

  @Post(':testimonial_id/tags/:tag_id')
  async attachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    await this.tagsService.attach(tenantId, testimonialId, tagId);
    return this.testimonialsService.getTestimonial(tenantId, testimonialId);
  }

  @Delete(':testimonial_id/tags/:tag_id')
  async detachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    await this.tagsService.detach(tenantId, testimonialId, tagId);
    return this.testimonialsService.getTestimonial(tenantId, testimonialId);
  }
}
