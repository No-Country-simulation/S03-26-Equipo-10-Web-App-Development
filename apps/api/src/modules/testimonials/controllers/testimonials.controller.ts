import { TestimonialsService } from '../services/testimonials.service';
import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Idempotent } from '../../../common/decorators/idempotent.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import type { AuthenticatedUser } from '../../../common/interfaces/auth-context.interface';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { IdempotencyService } from '../../../common/services/idempotency.service';
import {
  AttachVideoDto,
  CreateTestimonialDto,
  ModerateTestimonialDto,
  UpdateTestimonialDto,
  UploadImageDto,
} from '../dto/testimonial.dto';
import { TagsService } from '../services/tags.service';

import { FeatureFlagGuard } from '../../../common/guards/feature-flag.guard';
import { RequireFeature } from '../../../common/decorators/feature-flag.decorator';
import { parseAdminPage } from '../../../common/pagination/admin-page';

/**
 * Controlador principal de Testimonios para la gestión interna.
 * Requiere autenticación, roles de admin/editor y el Feature Flag activado.
 * Maneja el CRUD, subida de medios, transiciones de estado y asignación de etiquetas.
 */
@Controller('testimonials')
@UseGuards(JwtAuthGuard, RolesGuard, FeatureFlagGuard)
@RequireFeature('testimonials')
@Roles('admin', 'editor')
export class TestimonialsController {
  constructor(
    private readonly testimonialsService: TestimonialsService,
    private readonly tagsService: TagsService,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * Obtiene la lista completa de testimonios del tenant actual (sin filtrar por estado).
   * @param tenantId ID del tenant extraído del token del usuario.
   */
  @Get()
  list(@CurrentTenantId() tenantId: string, @Query() query: Record<string, unknown>) {
    return this.testimonialsService.listTestimonials(tenantId, parseAdminPage(query));
  }

  @Get(':testimonial_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.getTestimonial(tenantId, testimonialId);
  }

  /**
   * Crea un nuevo testimonio (estado inicial `draft`).
   * @param tenantId ID del tenant actual.
   * @param user Usuario creador.
   * @param dto Datos iniciales del testimonio.
   */
  @Post()
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  async create(
    @CurrentTenantId() tenantId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTestimonialDto,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: ApiRequest,
  ) {
    const result = await this.idempotency.execute({
      key, tenantId, principalKind: 'user', principalId: user.userId,
      method: 'POST', path: req.path, payload: { body: dto }, statusCode: 201,
    }, tx => this.testimonialsService.createTestimonial(tenantId, user.userId, dto, tx));
    return result.value;
  }

  /**
   * Actualiza el contenido, rating o categoría de un testimonio.
   * Restricciones: No se puede editar si está 'published'.
   * @param tenantId ID del tenant.
   * @param testimonialId ID del testimonio a actualizar.
   * @param user Usuario realizando la acción (valida permisos de edición si es editor).
   * @param dto Campos a actualizar.
   */
  @Patch(':testimonial_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateTestimonialDto,
  ) {
    return this.testimonialsService.updateTestimonial(tenantId, testimonialId, user, dto);
  }

  @Delete(':testimonial_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.testimonialsService.removeTestimonial(tenantId, testimonialId, user);
  }

  /**
   * Envia a moderación el testimonio (`draft` -> `pending`).
   */
  @Post(':testimonial_id/submit')
  submit(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
  ) {
    return this.testimonialsService.submitTestimonial(tenantId, testimonialId);
  }

  /**
   * Aprueba un testimonio (`pending` -> `approved`), dejándolo listo para publicar.
   */
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

  /**
   * Publica un testimonio aprobado (`approved` -> `published`), haciéndolo visible públicamente.
   */
  @Post(':testimonial_id/publish')
  @Idempotent()
  @Header('Cache-Control', 'no-store')
  async publish(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('idempotency-key') key: string | undefined,
    @Req() req: ApiRequest,
  ) {
    const result = await this.idempotency.execute({
      key, tenantId, principalKind: 'user', principalId: user.userId,
      method: 'POST', path: req.path, payload: { testimonialId }, statusCode: 201,
    }, tx => this.testimonialsService.publishTestimonial(tenantId, testimonialId, tx));
    if (key !== undefined && !result.replayed) {
      await this.testimonialsService.invalidatePublicTestimonials(tenantId);
    }
    return result.value;
  }

  @Post(':testimonial_id/image')
  uploadImage(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: UploadImageDto,
  ) {
    return this.testimonialsService.uploadImage(tenantId, testimonialId, dto.imageBase64);
  }

  @Post(':testimonial_id/video')
  attachVideo(
    @CurrentTenantId() tenantId: string,
    @Param('testimonial_id') testimonialId: string,
    @Body() dto: AttachVideoDto,
  ) {
    return this.testimonialsService.attachVideo(tenantId, testimonialId, dto.videoUrl);
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
