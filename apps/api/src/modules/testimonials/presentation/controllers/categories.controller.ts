import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateCategoryDto, UpdateCategoryDto } from '../../application/dto/testimonials.dto';
import { TestimonialsService } from '../../application/services/testimonials.service';

@Controller('categories')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin', 'editor')
export class CategoriesController {
  constructor(private readonly testimonialsService: TestimonialsService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.testimonialsService.listCategories(tenantId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.testimonialsService.createCategory(tenantId, dto);
  }

  @Patch(':category_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('category_id') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.testimonialsService.updateCategory(tenantId, categoryId, dto);
  }

  @Delete(':category_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('category_id') categoryId: string,
  ) {
    return this.testimonialsService.deleteCategory(tenantId, categoryId);
  }
}
