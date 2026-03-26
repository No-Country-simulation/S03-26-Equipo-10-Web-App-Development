import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateTagDto, UpdateTagDto } from '../../../application/dtos/testimonials.dto';
import { TagsService } from '../../../application/services/tags.service';

@Controller('tags')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class TagsController {
  constructor(private readonly tagsService: TagsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.tagsService.list(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.tagsService.create(tenantId, dto);
  }

  @Patch(':tag_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('tag_id') tagId: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.tagsService.update(tenantId, tagId, dto);
  }

  @Delete(':tag_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('tag_id') tagId: string,
  ) {
    return this.tagsService.remove(tenantId, tagId);
  }
}
