import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { TagRepository } from '../repositories/tag.repository';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { CreateTagDto, UpdateTagDto } from '../dto/tag.dto';
import type { CatalogQuery } from '../dto/admin-query';

import { CacheService } from '../../../common/services/cache.service';

@Injectable()
export class TagsService {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly testimonialRepo: TestimonialRepository,
    private readonly cache: CacheService,
  ) {}

  async list(tenantId: string, page: CatalogQuery = { page: 1, limit: 20 }) {
    const tags = await this.tagRepo.findByTenant(tenantId, page);
    return {
      items: tags.items,
      meta: { total: tags.total, page: page.page, limit: page.limit },
    };
  }

  async getTag(tenantId: string, tagId: string) {
    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundError('Tag not found');
    return tag;
  }

  async create(tenantId: string, dto: CreateTagDto) {
    return this.tagRepo.create(tenantId, dto.name);
  }

  async update(tenantId: string, tagId: string, dto: UpdateTagDto) {
    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundError('Tag not found');
    const updated = await this.tagRepo.update(tenantId, tagId, dto.name);
    await this.cache.invalidateTenantPublic(tenantId);
    return updated;
  }

  async remove(tenantId: string, tagId: string) {
    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundError('Tag not found');
    await this.tagRepo.remove(tenantId, tagId);
    await this.cache.invalidateTenantPublic(tenantId);
    return { id: tagId, deleted: true };
  }

  async attach(tenantId: string, testimonialId: string, tagId: string) {
    const testimonial = await this.testimonialRepo.findById(
      tenantId,
      testimonialId,
    );
    if (!testimonial) throw new NotFoundError('Testimonial not found');

    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundError('Tag not found');

    await this.tagRepo.attachToTestimonial(tenantId, testimonialId, tagId);
    await this.cache.invalidateTenantPublic(tenantId);
  }

  async detach(tenantId: string, testimonialId: string, tagId: string) {
    const testimonial = await this.testimonialRepo.findById(
      tenantId,
      testimonialId,
    );
    if (!testimonial) throw new NotFoundError('Testimonial not found');

    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundError('Tag not found');

    await this.tagRepo.detachFromTestimonial(tenantId, testimonialId, tagId);
    await this.cache.invalidateTenantPublic(tenantId);
  }
}
