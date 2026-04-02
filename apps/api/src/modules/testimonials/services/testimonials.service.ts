import { NotFoundException, ConflictException, ForbiddenException, BadRequestException, Injectable } from '@nestjs/common';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { CategoryRepository } from '../repositories/category.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { AnalyticsRepository } from '../../analytics/repositories/analytics.repository';
import { CloudinaryService } from '../../shared/cloud/cloudinary.service';
import { YoutubeService } from '../../shared/cloud/youtube.service';
import { VALID_TRANSITIONS, TestimonialStatus, TestimonialView } from '../entities/testimonial.model';
import { CreateTestimonialDto, PublicTestimonialsQueryDto, UpdateTestimonialDto } from '../dto/testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly repo: TestimonialRepository,
    private readonly categoryRepo: CategoryRepository,
    private readonly eventEmitter: EventEmitter2,
    private readonly analyticsRepo: AnalyticsRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly youtubeService: YoutubeService,
  ) {}

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
    });

    this.eventEmitter.emit('testimonial.created', {
      tenantId,
      eventType: 'testimonial.created',
      payload: { testimonialId: testimonial.id, authorName: testimonial.authorName },
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

    this.eventEmitter.emit('testimonial.published', {
      tenantId,
      eventType: 'testimonial.published',
      payload: {
        testimonialId: updated.id,
        authorName: updated.authorName,
        score: updated.score,
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
