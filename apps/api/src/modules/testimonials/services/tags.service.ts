import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { TagRepository } from '../repositories/tag.repository';
import { TestimonialRepository } from '../repositories/testimonial.repository';
import { CreateTagDto, UpdateTagDto } from '../dto/testimonials.dto';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TagsService {
  constructor(
    private readonly tagRepo: TagRepository,
    private readonly testimonialRepo: TestimonialRepository,
    private readonly prisma: PrismaService,
  ) {}

  async list(tenantId: string) {
    const tags = await this.tagRepo.findByTenant(tenantId);
    return {
      items: tags,
      meta: { total: tags.length, page: 1, limit: tags.length },
    };
  }

  async create(tenantId: string, dto: CreateTagDto) {
    return this.tagRepo.create(tenantId, dto.name);
  }

  async update(tenantId: string, tagId: string, dto: UpdateTagDto) {
    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundException('Tag not found');
    return this.tagRepo.update(tenantId, tagId, dto.name);
  }

  async remove(tenantId: string, tagId: string) {
    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundException('Tag not found');
    await this.tagRepo.remove(tagId);
    return { id: tagId, deleted: true };
  }

  async attach(tenantId: string, testimonialId: string, tagId: string) {
    const testimonial = await this.testimonialRepo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.testimonialTag.upsert({
      where: { testimonialId_tagId: { testimonialId, tagId } },
      update: {},
      create: { testimonialId, tagId },
    });
  }

  async detach(tenantId: string, testimonialId: string, tagId: string) {
    const testimonial = await this.testimonialRepo.findById(tenantId, testimonialId);
    if (!testimonial) throw new NotFoundException('Testimonial not found');

    const tag = await this.tagRepo.findById(tenantId, tagId);
    if (!tag) throw new NotFoundException('Tag not found');

    await this.prisma.testimonialTag.deleteMany({ where: { testimonialId, tagId } });
  }
}
