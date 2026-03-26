import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateCategoryDto, UpdateCategoryDto } from '../../../application/dtos/testimonials.dto';
import { CategoriesService } from '../../../application/services/categories.service';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.categoriesService.list(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.categoriesService.create(tenantId, dto);
  }

  @Patch(':category_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('category_id') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categoriesService.update(tenantId, categoryId, dto);
  }

  @Delete(':category_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('category_id') categoryId: string,
  ) {
    return this.categoriesService.remove(tenantId, categoryId);
  }
}
