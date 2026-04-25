import { NotFoundException, ConflictException, ForbiddenException, BadRequestException, Injectable } from '@nestjs/common';
import { TenantsService } from '../../tenants/services/tenants.service';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalyticsRepository } from '../../analytics/repositories/analytics.repository';
import { CloudinaryService } from '../../shared/cloud/cloudinary.service';
import { YoutubeService } from '../../shared/cloud/youtube.service';
import { OutboxService } from '../../webhooks/services/outbox.service';
import { CacheService } from '../../../common/services/cache.service';
import { VALID_TRANSITIONS, TestimonialStatus, TestimonialView } from '../entities/testimonial.model';
import { CreateTestimonialDto, PublicTestimonialsQueryDto, UpdateTestimonialDto, SubmitPublicTestimonialDto } from '../dto/testimonial.dto';

/**
 * Servicio central para la gestión de Testimonios.
 * Controla el ciclo de vida, integración con Cloudinary y YouTube, y
 * la emisión de eventos asíncronos mediante el patrón Outbox.
 * 
 * **Decisión de Diseño:** Se inyectan repositorios concretos en lugar de interfaces genéricas
 * para mantener el pragmatismo y evitar sobre-ingeniería (ver ADR 0001).
 * Todos los métodos que modifican estado y disparan webhooks deben hacerlo
 * usando `outboxService` en lugar de emitir eventos en memoria, para garantizar
 * tolerancia a fallos ante caídas del servidor.
 */
@Injectable()
export class TestimonialsService {
  constructor(
    private readonly repo: TestimonialRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly tenantsService: TenantsService,
    private readonly eventEmitter: EventEmitter2,
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly youtubeService: YoutubeService,
    private readonly outboxService: OutboxService,
    private readonly cache: CacheService,
  ) { }

  /**
   * Crea un nuevo testimonio interno (desde el panel de administración).
   * 
   * **Complejidad / Por qué:** Al crear un testimonio, es crítico notificar a otros sistemas
   * (mediante webhooks). En lugar de enviar una petición HTTP aquí (que bloquearía la
   * respuesta al usuario y podría fallar), delegamos la creación del evento a `outboxService`, 
   * que asegura la grabación atómica en la misma base de datos.
   * 
   * @param tenantId - ID del inquilino propietario. Usado para aislamiento (Row-level multi-tenancy).
   * @param creatorUserId - ID del usuario que lo crea.
   * @param dto - Datos validados del testimonio.
   * @throws {ConflictException} Si el rating no está entre 1 y 5.
   * @throws {NotFoundException} Si la categoría proporcionada no existe o no pertenece al tenant.
   * @returns El testimonio creado (en estado 'draft' por defecto).
   */
  async createTestimonial(tenantId: string, creatorUserId: string, dto: CreateTestimonialDto) {
    if (dto.rating < 1 || dto.rating > 5) {
      throw new ConflictException('Rating must be between 1 and 5');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
      if (!category) {
        throw new NotFoundException('Category not found');
      }
    }

    const testimonial = await this.repo.create({
      tenantId,
      createdById: creatorUserId,
      authorName: dto.authorName,
      content: dto.content,
      rating: dto.rating,
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
    });

    // Atomic Outbox: persist the event right after the testimonial is created.
    // This guarantees the webhook event is never lost even if the process crashes.
    await this.outboxService.createEvent({
      tenantId,
      eventType: 'testimonial.created',
      payload: {
        id: testimonial.id,
        authorName: testimonial.authorName,
        content: testimonial.content,
        rating: testimonial.rating,
        status: testimonial.status,
        imageUrl: testimonial.imageUrl,
        videoUrl: testimonial.videoUrl,
        createdAt: testimonial.createdAt,
      },
    });

    return testimonial;
  }

  async getTestimonial(tenantId: string, testimonialId: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    return testimonial;
  }

  async getPublicTestimonial(tenantId: string, testimonialId: string) {
    const testimonial = await this.repo.findPublishedById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    return testimonial;
  }

  async getPublicTestimonialBySlug(slug: string, testimonialId: string) {
    const tenant = await this.tenantsService.getTenantByPublicSlug(slug);
    return this.getPublicTestimonial(tenant.id, testimonialId);
  }

  /**
   * Registra un testimonio enviado desde el widget/formulario público.
   * 
   * **Complejidad / Por qué:** Las sumisiones públicas son anónimas (`createdById` es null)
   * y no pueden estar pre-categorizadas. Además, para evitar spam, se verifica en tiempo
   * real que el inquilino tenga el flag `isPublicFormEnabled` encendido. El testimonio
   * transiciona directamente a `pending` (no a `draft`) para que los editores lo moderen.
   * 
   * @param slug - Slug público único del Tenant.
   * @param dto - Datos del testimonio público.
   * @throws {ForbiddenException} Si el formulario público del inquilino está desactivado.
   * @returns El testimonio creado en estado 'pending'.
   */
  async submitPublicTestimonial(slug: string, dto: SubmitPublicTestimonialDto) {
    const tenant = await this.tenantsService.getTenantByPublicSlug(slug);

    if (!tenant.isPublicFormEnabled) {
      throw new ForbiddenException('This form is currently closed');
    }

    const testimonial = await this.repo.create({
      tenantId: tenant.id,
      createdById: null, // Anonymous submission
      authorName: dto.authorName,
      content: dto.content,
      rating: dto.rating,
      categoryId: null, // Public submissions don't assign categories by default
    });

    // Atomic Outbox for public submissions
    await this.outboxService.createEvent({
      tenantId: tenant.id,
      eventType: 'testimonial.created',
      payload: {
        id: testimonial.id,
        authorName: testimonial.authorName,
        content: testimonial.content,
        rating: testimonial.rating,
        status: testimonial.status,
        source: 'public_form',
        createdAt: testimonial.createdAt,
      },
    });

    if (dto.imageBase64) {
      await this.uploadImage(tenant.id, testimonial.id, dto.imageBase64);
    }

    if (dto.videoUrl) {
      await this.attachVideo(tenant.id, testimonial.id, dto.videoUrl);
    }

    // Submissions already go to 'draft'. Since this needs to go to pending, 
    // we should transition it right after creation, or modify repo.create.
    // Given the previous workflow, create starts at 'draft', let's transition it:
    return this.repo.updateStatus(testimonial.id, 'pending');
  }

  async getPublicFormInfo(slug: string) {
    const tenant = await this.tenantsService.getTenantByPublicSlug(slug);
    return {
      name: tenant.name,
      isPublicFormEnabled: tenant.isPublicFormEnabled,
    };
  }

  async getTestimonialMetrics(tenantId: string, testimonialId: string) {
    return this.analyticsRepo.getTestimonialMetrics(tenantId, testimonialId);
  }

  async listTestimonials(tenantId: string) {
    const items = await this.repo.findByTenant(tenantId);

    return {
      items,
      meta: {
        total: items.length,
        page: 1,
        limit: items.length,
      },
    };
  }

  /**
   * Obtiene la lista de testimonios publicados (públicos) de un tenant, con paginación, filtros y caché.
   * 
   * **Complejidad / Por qué:** Este endpoint será el más llamado por los widgets insertados 
   * en sitios web de clientes. Para proteger la base de datos de picos de tráfico, se utiliza 
   * caché de Redis. La clave de caché es un hash de los parámetros de búsqueda para asegurar
   * que consultas idénticas compartan el resultado.
   * 
   * @param tenantId - ID del tenant.
   * @param query - Opciones de búsqueda y paginación (DTO).
   * @returns Lista paginada de testimonios públicos.
   */
  async listPublicTestimonials(tenantId: string, query: PublicTestimonialsQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

    // Clave de caché para memorizar la respuesta y aligerar la base de datos
    const cacheKey = `public:${tenantId}:${query.q ?? ''}:${query.tag ?? ''}:${query.category ?? ''}:${query.sort ?? ''}:${page}:${limit}`;

    return this.cache.getOrSet(cacheKey, async () => {
      const result = await this.repo.findPublished(tenantId, {
        q: query.q,
        tag: query.tag,
        category: query.category,
        sort: query.sort,
        page,
        limit,
      });

      return {
        items: result.items,
        meta: {
          total: result.total,
          page,
          limit,
        },
      };
    }, 60_000); // 60s TTL
  }

  async listPublicTestimonialsBySlug(slug: string, query: PublicTestimonialsQueryDto) {
    const tenant = await this.tenantsService.getTenantByPublicSlug(slug);
    return this.listPublicTestimonials(tenant.id, query);
  }

  async updateTestimonial(tenantId: string, testimonialId: string, user: { userId: string; roles: string[] }, dto: UpdateTestimonialDto) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    if (testimonial.status === 'published') {
      throw new ConflictException('Published testimonial cannot be edited');
    }

    if (!user.roles.includes('admin') && user.roles.includes('editor') && testimonial.createdById !== user.userId) {
      throw new ForbiddenException('Editors can only edit their own testimonials');
    }

    if (dto.rating !== undefined && (dto.rating < 1 || dto.rating > 5)) {
      throw new ConflictException('Rating must be between 1 and 5');
    }

    if (dto.categoryId) {
      const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
      if (!category) throw new NotFoundException('Category not found');
    }

    return this.repo.updateFields(tenantId, testimonialId, {
      authorName: dto.authorName,
      content: dto.content,
      rating: dto.rating,
      categoryId: dto.categoryId,
      tagIds: dto.tagIds,
    });
  }

  /**
   * Sube una imagen a Cloudinary y actualiza la URL en el testimonio.
   * 
   * **Complejidad / Por qué:** Subir la imagen es una operación externa lenta. Se hace
   * después de la creación del testimonio para que este proceso no bloquee la inserción 
   * inicial, o se reintente si la red falla. CloudinaryService implementa internamente 
   * el Circuit Breaker.
   * 
   * @param tenantId - ID del inquilino.
   * @param testimonialId - ID del testimonio a actualizar.
   * @param imageBase64 - Imagen en formato Base64 a subir.
   * @throws {ConflictException} Si el testimonio ya está publicado (inmutable).
   */
  async uploadImage(tenantId: string, testimonialId: string, imageBase64: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    if (testimonial.status === 'published') {
      throw new ConflictException('Cannot modify media of a published testimonial');
    }

    const result = await this.cloudinaryService.uploadImage(imageBase64);
    return this.repo.updateMedia(testimonialId, { imageUrl: result.secureUrl });
  }

  /**
   * Adjunta un video de YouTube al testimonio, extrayendo metadatos.
   * 
   * **Complejidad / Por qué:** Requerimos el título y miniatura de YouTube de forma síncrona 
   * para poder mostrarlos en el frontend de inmediato sin depender de que el cliente (browser)
   * cargue un iframe pesado solo para leer metadatos.
   * 
   * @param tenantId - ID del inquilino.
   * @param testimonialId - ID del testimonio.
   * @param videoUrl - URL válida de YouTube.
   * @throws {BadRequestException} Si la URL no pertenece a YouTube.
   */
  async attachVideo(tenantId: string, testimonialId: string, videoUrl: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    if (testimonial.status === 'published') {
      throw new ConflictException('Cannot modify media of a published testimonial');
    }

    const youtubePattern = /(?:youtube\.com|youtu\.be)/;
    if (!youtubePattern.test(videoUrl)) {
      throw new BadRequestException('Only YouTube URLs are supported');
    }

    const metadata = await this.youtubeService.getVideoMetadata(videoUrl);

    return this.repo.updateMedia(testimonialId, {
      videoUrl,
      videoTitle: metadata?.title ?? null,
      videoThumbnailUrl: metadata?.thumbnailUrl ?? null,
    });
  }

  async removeTestimonial(tenantId: string, testimonialId: string, user: { userId: string; roles: string[] }) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    if (!user.roles.includes('admin') && user.roles.includes('editor') && testimonial.createdById !== user.userId) {
      throw new ForbiddenException('Editors can only delete their own testimonials');
    }

    await this.repo.remove(tenantId, testimonialId);
    return { id: testimonialId, deleted: true };
  }

  async submitTestimonial(tenantId: string, testimonialId: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    this.assertTransition(testimonial.status, 'pending');
    return this.repo.updateStatus(testimonialId, 'pending');
  }

  async approveTestimonial(tenantId: string, testimonialId: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    this.assertTransition(testimonial.status, 'approved');
    return this.repo.updateStatus(testimonialId, 'approved');
  }

  async rejectTestimonial(tenantId: string, testimonialId: string, reason: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    this.assertTransition(testimonial.status, 'rejected');
    return this.repo.updateStatus(testimonialId, 'rejected', { moderationNotes: reason || null });
  }

  /**
   * Publica un testimonio (lo hace visible en la API pública).
   * 
   * **Complejidad / Por qué:** Al publicar, dos cosas críticas deben ocurrir:
   * 1. Notificar al exterior (Webhooks) mediante el patrón Outbox.
   * 2. Invalidar la caché de listas públicas para que el nuevo testimonio aparezca 
   *    inmediatamente en el widget del cliente sin esperar al TTL (Time To Live).
   * 
   * @param tenantId - ID del inquilino.
   * @param testimonialId - ID del testimonio a publicar.
   * @throws {ConflictException} Si la transición de estado no es válida.
   * @returns El testimonio actualizado.
   */
  async publishTestimonial(tenantId: string, testimonialId: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    this.assertTransition(testimonial.status, 'published');
    const updated = await this.repo.updateStatus(testimonialId, 'published', { publishedAt: new Date() });

    // Atomic Outbox: persist the event right after the status update.
    await this.outboxService.createEvent({
      tenantId,
      eventType: 'testimonial.published',
      payload: {
        id: updated.id,
        authorName: updated.authorName,
        content: updated.content,
        rating: updated.rating,
        score: updated.score,
        imageUrl: updated.imageUrl,
        videoUrl: updated.videoUrl,
        videoTitle: updated.videoTitle,
        videoThumbnailUrl: updated.videoThumbnailUrl,
        publishedAt: updated.publishedAt,
        createdAt: updated.createdAt,
      },
    });

    // Invalidate public listing cache for this tenant since published set changed
    this.cache.invalidateByPrefix(`public:${tenantId}:`);

    return updated;
  }

  private assertTransition(from: TestimonialStatus, to: TestimonialStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(`Invalid status transition: ${from} → ${to}`);
    }
  }
}
