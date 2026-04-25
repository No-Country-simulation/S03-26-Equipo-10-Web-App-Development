import { NotFoundException, ConflictException, ForbiddenException, BadRequestException, Injectable } from '@nestjs/common';
import { TenantsService } from '../../tenants/services/tenants.service';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalyticsRepository } from '../../analytics/repositories/analytics.repository';
import { CloudinaryService } from '../../shared/cloud/cloudinary.service';
import { YoutubeService } from '../../shared/cloud/youtube.service';
import { OutboxService } from '../../webhooks/services/outbox.service';
import { VALID_TRANSITIONS, TestimonialStatus, TestimonialView } from '../entities/testimonial.model';
import { CreateTestimonialDto, PublicTestimonialsQueryDto, UpdateTestimonialDto, SubmitPublicTestimonialDto } from '../dto/testimonial.dto';

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
  ) { }

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

  async listPublicTestimonials(tenantId: string, query: PublicTestimonialsQueryDto) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));

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

  async uploadImage(tenantId: string, testimonialId: string, imageBase64: string) {
    const testimonial = await this.repo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');
    if (testimonial.status === 'published') {
      throw new ConflictException('Cannot modify media of a published testimonial');
    }

    const result = await this.cloudinaryService.uploadImage(imageBase64);
    return this.repo.updateMedia(testimonialId, { imageUrl: result.secureUrl });
  }

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

    return updated;
  }

  private assertTransition(from: TestimonialStatus, to: TestimonialStatus): void {
    const allowed = VALID_TRANSITIONS[from];
    if (!allowed.includes(to)) {
      throw new ConflictException(`Invalid status transition: ${from} → ${to}`);
    }
  }
}
