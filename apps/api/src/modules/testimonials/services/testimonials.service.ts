import { NotFoundException, ConflictException, Injectable, Inject } from "@nestjs/common";
import { TESTIMONIAL_REPOSITORY, ITestimonialRepository } from "../repositories/testimonial.repository";
import { TestimonialMapper } from "../mappers/testimonial.mapper";
import { randomUUID } from "node:crypto";
import { Testimonial } from "../entities/testimonial.model";
import { CATEGORY_REPOSITORY, ICategoryRepository } from "../repositories/category.repository";
import { OUTBOX_PORT, IOutboxPort } from "../../webhooks/interfaces/outbox.port";
import { CreateTestimonialDto, PublicTestimonialsQueryDto, UpdateTestimonialDto } from "../dto/testimonials.dto";
import { ANALYTICS_REPOSITORY, IAnalyticsRepository } from "../../analytics/repositories/analytics-event.repository";

@Injectable()
export class TestimonialsService {
    async approveTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        try {
          entity.approve();
        } catch {
          throw new ConflictException('Invalid status transition');
        }

        await this.repo.save(entity);
        return this.mapper.toFullView(entity);
    }

    async createTestimonial(tenantId: string, creatorUserId: string, dto: CreateTestimonialDto) {
        if (dto.categoryId) {
          const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
          if (!category) {
            throw new Error('Category not found');
          }
        }

        const entity = Testimonial.create({
          id: randomUUID(),
          tenantId,
          createdById: creatorUserId,
          authorName: dto.authorName,
          content: dto.content,
          rating: dto.rating,
          categoryId: dto.categoryId,
        });

        await this.repo.save(entity);

        await this.outbox.emit({
          tenantId,
          eventType: 'testimonial.created',
          payload: { testimonialId: entity.id, authorName: entity.authorName },
        });

        return this.mapper.toFullView(entity);
    }

    async getPublicTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findPublishedById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');
        return this.mapper.toFullView(entity);
    }

    async getTestimonialMetrics(tenantId: string, testimonialId: string) {
        return this.analyticsRepo.getTestimonialMetrics(tenantId, testimonialId);
    }

    async getTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');
        return this.mapper.toFullView(entity);
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
          items: await Promise.all(result.items.map((e: any) => this.mapper.toFullView(e))),
          meta: {
            total: result.total,
            page,
            limit,
          },
        };
    }

    async listTestimonials(tenantId: string) {
        const entities = await this.repo.findByTenant(tenantId);

        return {
          items: await Promise.all(entities.map((e: any) => this.mapper.toFullView(e))),
          meta: {
            total: entities.length,
            page: 1,
            limit: entities.length,
          },
        };
    }

    async publishTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        try {
          entity.publish();
        } catch {
          throw new ConflictException('Invalid status transition');
        }

        await this.repo.save(entity);

        await this.outbox.emit({
          tenantId,
          eventType: 'testimonial.published',
          payload: {
            testimonialId: entity.id,
            authorName: entity.authorName,
            score: entity.score,
          },
        });

        return this.mapper.toFullView(entity);
    }

    async rejectTestimonial(tenantId: string, testimonialId: string, reason: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        try {
          entity.reject(reason);
        } catch {
          throw new ConflictException('Invalid status transition');
        }

        await this.repo.save(entity);
        return this.mapper.toFullView(entity);
    }

    async removeTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        await this.repo.remove(tenantId, testimonialId);
        return { id: testimonialId, deleted: true };
    }

    async submitTestimonial(tenantId: string, testimonialId: string) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        try {
          entity.submit();
        } catch {
          throw new ConflictException('Invalid status transition');
        }

        await this.repo.save(entity);
        return this.mapper.toFullView(entity);
    }

    async updateTestimonial(tenantId: string, testimonialId: string, dto: UpdateTestimonialDto) {
        const entity = await this.repo.findById(tenantId, testimonialId);
        if (!entity) throw new NotFoundException('Testimonial not found');

        if (dto.categoryId) {
          const category = await this.categoryRepo.findById(tenantId, dto.categoryId);
          if (!category) throw new NotFoundException('Category not found');
        }

        try {
          entity.update({
            authorName: dto.authorName,
            content: dto.content,
            rating: dto.rating,
            categoryId: dto.categoryId,
          });
        } catch {
          throw new ConflictException('Published testimonial cannot be edited');
        }

        await this.repo.save(entity);
        return this.mapper.toFullView(entity);
    }

    constructor(@Inject(TESTIMONIAL_REPOSITORY) private readonly repo: ITestimonialRepository, private readonly mapper: TestimonialMapper, @Inject(CATEGORY_REPOSITORY) private readonly categoryRepo: ICategoryRepository, @Inject(OUTBOX_PORT) private readonly outbox: IOutboxPort, @Inject(ANALYTICS_REPOSITORY) private readonly analyticsRepo: IAnalyticsRepository) {
    }
}
