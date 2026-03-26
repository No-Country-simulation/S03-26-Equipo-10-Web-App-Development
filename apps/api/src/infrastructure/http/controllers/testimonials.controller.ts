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
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { CurrentUser } from '../decorators/current-user.decorator';
import { Idempotent } from '../decorators/idempotent.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import type { AuthenticatedUser } from '../../../application/interfaces/auth-context.interface';
import {
  CreateTestimonialDto,
  ModerateTestimonialDto,
  UpdateTestimonialDto,
} from '../../../application/dtos/testimonials.dto';
import { CreateTestimonialUseCase } from '../../../application/use-cases/create-testimonial.use-case';
import { UpdateTestimonialUseCase } from '../../../application/use-cases/update-testimonial.use-case';
import { GetTestimonialUseCase } from '../../../application/use-cases/get-testimonial.use-case';
import { ListTestimonialsUseCase } from '../../../application/use-cases/list-testimonials.use-case';
import { RemoveTestimonialUseCase } from '../../../application/use-cases/remove-testimonial.use-case';
import { SubmitTestimonialUseCase } from '../../../application/use-cases/submit-testimonial.use-case';
import { ApproveTestimonialUseCase } from '../../../application/use-cases/approve-testimonial.use-case';
import { RejectTestimonialUseCase } from '../../../application/use-cases/reject-testimonial.use-case';
import { PublishTestimonialUseCase } from '../../../application/use-cases/publish-testimonial.use-case';
import { TagsService } from '../../../application/services/tags.service';

@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class TestimonialsController {
  constructor(
    private readonly createUseCase: CreateTestimonialUseCase,
    private readonly updateUseCase: UpdateTestimonialUseCase,
    private readonly getUseCase: GetTestimonialUseCase,
    private readonly listUseCase: ListTestimonialsUseCase,
    private readonly removeUseCase: RemoveTestimonialUseCase,
    private readonly submitUseCase: SubmitTestimonialUseCase,
    private readonly approveUseCase: ApproveTestimonialUseCase,
    private readonly rejectUseCase: RejectTestimonialUseCase,
    private readonly publishUseCase: PublishTestimonialUseCase,
    private readonly tagsService: TagsService,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.listUseCase.execute(tenantId);
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.getUseCase.execute(tenantId, testimonialId);
  }

  @Post()
  @Idempotent()
  create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestimonialDto,
  ) {
    return this.createUseCase.execute(tenantId, user.userId, dto);
  }

  @Patch(':testimonial_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.updateUseCase.execute(tenantId, testimonialId, dto);
  }

  @Delete(':testimonial_id')
  @Roles('admin')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.removeUseCase.execute(tenantId, testimonialId);
  }

  @Post(':testimonial_id/submit')
  submit(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.submitUseCase.execute(tenantId, testimonialId);
  }

  @Post(':testimonial_id/approve')
  approve(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.approveUseCase.execute(tenantId, testimonialId);
  }

  @Post(':testimonial_id/reject')
  reject(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: ModerateTestimonialDto,
  ) {
    return this.rejectUseCase.execute(tenantId, testimonialId, dto.reason);
  }

  @Post(':testimonial_id/publish')
  @Idempotent()
  publish(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.publishUseCase.execute(tenantId, testimonialId);
  }

  @Post(':testimonial_id/tags/:tag_id')
  async attachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    await this.tagsService.attach(tenantId, testimonialId, tagId);
    return this.getUseCase.execute(tenantId, testimonialId);
  }

  @Delete(':testimonial_id/tags/:tag_id')
  async detachTag(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Param('tag_id') tagId: string,
  ) {
    await this.tagsService.detach(tenantId, testimonialId, tagId);
    return this.getUseCase.execute(tenantId, testimonialId);
  }
}
