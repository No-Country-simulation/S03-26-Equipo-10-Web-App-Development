import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateTagDto, UpdateTagDto } from '../../application/dto/testimonials.dto';
import { TestimonialsService } from '../../application/services/testimonials.service';

@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class TagsController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.testimonialsService.listTags(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.testimonialsService.createTag(tenantId, dto);
  }

  @Patch(':tag_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('tag_id') tagId: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.testimonialsService.updateTag(tenantId, tagId, dto);
  }

  @Delete(':tag_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('tag_id') tagId: string,
  ) {
    return this.testimonialsService.deleteTag(tenantId, tagId);
  }
}
