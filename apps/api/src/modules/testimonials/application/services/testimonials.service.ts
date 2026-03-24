import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { OutboxService } from '../../../../infrastructure/outbox/outbox.service';
import {
  CreateCategoryDto,
  CreateTagDto,
  CreateTestimonialDto,
  PublicTestimonialsQueryDto,
  UpdateCategoryDto,
  UpdateTagDto,
  UpdateTestimonialDto,
} from '../dto/testimonials.dto';

@Injectable()
export class TestimonialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async list(tenantId: string) {
    const testimonials = await this.prisma.testimonial.findMany({
      where: { tenantId },
      include: {
        status: true,
        category: true,
        tags: {
          include: { tag: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: testimonials.map(testimonial => this.toView(testimonial)),
      meta: {
        total: testimonials.length,
        page: 1,
        limit: testimonials.length,
      },
    };
  }

  async get(tenantId: string, testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, tenantId },
      include: {
        status: true,
        category: true,
        tags: { include: { tag: true } },
      },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return this.toView(testimonial);
  }

  async create(tenantId: string, creatorUserId: string, dto: CreateTestimonialDto) {
    const draftStatus = await this.statusId('draft');

    if (dto.categoryId) {
      await this.assertCategoryBelongsToTenant(tenantId, dto.categoryId);
    }

    const testimonial = await this.prisma.testimonial.create({
      data: {
        tenantId,
        createdById: creatorUserId,
        authorName: dto.authorName,
        content: dto.content,
        rating: dto.rating,
        categoryId: dto.categoryId,
        statusId: draftStatus,
      },
      include: {
        status: true,
        category: true,
        tags: { include: { tag: true } },
      },
    });

    await this.outbox.createEvent({
      tenantId,
      eventType: 'testimonial.created',
      payload: {
        testimonialId: testimonial.id,
        authorName: testimonial.authorName,
      },
    });

    return this.toView(testimonial);
  }

  async update(tenantId: string, testimonialId: string, dto: UpdateTestimonialDto) {
    const existing = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, tenantId },
      include: { status: true },
    });

    if (!existing) {
      throw new NotFoundException('Testimonial not found');
    }

    if (existing.status.code === 'published') {
      throw new ConflictException('Published testimonial cannot be edited');
    }

    if (dto.categoryId) {
      await this.assertCategoryBelongsToTenant(tenantId, dto.categoryId);
    }

    const testimonial = await this.prisma.testimonial.update({
      where: { id: testimonialId },
      data: {
        authorName: dto.authorName,
        content: dto.content,
        rating: dto.rating,
        categoryId: dto.categoryId,
      },
      include: {
        status: true,
        category: true,
        tags: { include: { tag: true } },
      },
    });

    return this.toView(testimonial);
  }

  async remove(tenantId: string, testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, tenantId },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    await this.prisma.testimonial.delete({ where: { id: testimonialId } });
    return { id: testimonialId, deleted: true };
  }

  async submit(tenantId: string, testimonialId: string) {
    return this.transition(tenantId, testimonialId, 'draft', 'pending');
  }

  async approve(tenantId: string, testimonialId: string) {
    return this.transition(tenantId, testimonialId, 'pending', 'approved');
  }

  async reject(tenantId: string, testimonialId: string, reason?: string) {
    const rejectedStatus = await this.statusId('rejected');
    const pendingStatus = await this.statusId('pending');

    const result = await this.prisma.testimonial.updateMany({
      where: {
        id: testimonialId,
        tenantId,
        statusId: pendingStatus,
      },
      data: {
        statusId: rejectedStatus,
        moderationNotes: reason,
      },
    });

    if (!result.count) {
      throw new ConflictException('Invalid status transition');
    }

    return this.get(tenantId, testimonialId);
  }

  async publish(tenantId: string, testimonialId: string) {
    const approvedStatus = await this.statusId('approved');
    const publishedStatus = await this.statusId('published');

    const result = await this.prisma.testimonial.updateMany({
      where: {
        id: testimonialId,
        tenantId,
        statusId: approvedStatus,
      },
      data: {
        statusId: publishedStatus,
        publishedAt: new Date(),
      },
    });

    if (!result.count) {
      throw new ConflictException('Invalid status transition');
    }

    const testimonial = await this.get(tenantId, testimonialId);

    await this.outbox.createEvent({
      tenantId,
      eventType: 'testimonial.published',
      payload: {
        testimonialId,
        authorName: testimonial.authorName,
        score: testimonial.score,
      },
    });

    return testimonial;
  }

  async listPublic(tenantId: string, query: PublicTestimonialsQueryDto) {
    const publishedStatus = await this.statusId('published');

    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const skip = (page - 1) * limit;

    const where: {
      tenantId: string;
      statusId: number;
      content?: { contains: string; mode: 'insensitive' };
      category?: { name: string };
      tags?: { some: { tag: { name: string } } };
    } = {
      tenantId,
      statusId: publishedStatus,
    };

    if (query.q) {
      where.content = { contains: query.q, mode: 'insensitive' };
    }

    if (query.category) {
      where.category = { name: query.category };
    }

    if (query.tag) {
      where.tags = { some: { tag: { name: query.tag } } };
    }

    const [items, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        include: {
          status: true,
          category: true,
          tags: { include: { tag: true } },
        },
        orderBy: query.sort === 'publishedAt:desc' ? { publishedAt: 'desc' } : { score: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.testimonial.count({ where }),
    ]);

    return {
      items: items.map(testimonial => this.toView(testimonial)),
      meta: {
        total,
        page,
        limit,
      },
    };
  }

  async getPublicById(tenantId: string, testimonialId: string) {
    const publishedStatus = await this.statusId('published');
    const testimonial = await this.prisma.testimonial.findFirst({
      where: {
        id: testimonialId,
        tenantId,
        statusId: publishedStatus,
      },
      include: {
        status: true,
        category: true,
        tags: { include: { tag: true } },
      },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }

    return this.toView(testimonial);
  }

  async listTags(tenantId: string) {
    const tags = await this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return {
      items: tags,
      meta: {
        total: tags.length,
        page: 1,
        limit: tags.length,
      },
    };
  }

  async createTag(tenantId: string, dto: CreateTagDto) {
    return this.prisma.tag.create({
      data: {
        tenantId,
        name: dto.name,
      },
    });
  }

  async updateTag(tenantId: string, tagId: string, dto: UpdateTagDto) {
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, tenantId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return this.prisma.tag.update({
      where: { id: tagId },
      data: { name: dto.name },
    });
  }

  async deleteTag(tenantId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, tenantId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    await this.prisma.tag.delete({ where: { id: tagId } });
    return { id: tagId, deleted: true };
  }

  async attachTag(tenantId: string, testimonialId: string, tagId: string) {
    await this.assertTestimonialBelongsToTenant(tenantId, testimonialId);
    await this.assertTagBelongsToTenant(tenantId, tagId);

    await this.prisma.testimonialTag.upsert({
      where: {
        testimonialId_tagId: {
          testimonialId,
          tagId,
        },
      },
      update: {},
      create: {
        testimonialId,
        tagId,
      },
    });

    return this.get(tenantId, testimonialId);
  }

  async detachTag(tenantId: string, testimonialId: string, tagId: string) {
    await this.assertTestimonialBelongsToTenant(tenantId, testimonialId);
    await this.assertTagBelongsToTenant(tenantId, tagId);

    await this.prisma.testimonialTag.deleteMany({
      where: {
        testimonialId,
        tagId,
      },
    });

    return this.get(tenantId, testimonialId);
  }

  async listCategories(tenantId: string) {
    const categories = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return {
      items: categories,
      meta: {
        total: categories.length,
        page: 1,
        limit: categories.length,
      },
    };
  }

  async createCategory(tenantId: string, dto: CreateCategoryDto) {
    return this.prisma.category.create({
      data: {
        tenantId,
        name: dto.name,
      },
    });
  }

  async updateCategory(tenantId: string, categoryId: string, dto: UpdateCategoryDto) {
    await this.assertCategoryBelongsToTenant(tenantId, categoryId);
    return this.prisma.category.update({
      where: { id: categoryId },
      data: { name: dto.name },
    });
  }

  async deleteCategory(tenantId: string, categoryId: string) {
    await this.assertCategoryBelongsToTenant(tenantId, categoryId);

    await this.prisma.category.delete({ where: { id: categoryId } });
    return { id: categoryId, deleted: true };
  }

  private async transition(
    tenantId: string,
    testimonialId: string,
    from: 'draft' | 'pending' | 'approved',
    to: 'pending' | 'approved',
  ) {
    const fromStatus = await this.statusId(from);
    const toStatus = await this.statusId(to);

    const result = await this.prisma.testimonial.updateMany({
      where: {
        id: testimonialId,
        tenantId,
        statusId: fromStatus,
      },
      data: {
        statusId: toStatus,
      },
    });

    if (!result.count) {
      throw new ConflictException('Invalid status transition');
    }

    return this.get(tenantId, testimonialId);
  }

  private async statusId(code: 'draft' | 'pending' | 'approved' | 'published' | 'rejected') {
    const status = await this.prisma.testimonialStatus.findUnique({ where: { code } });
    if (!status) {
      throw new BadRequestException(`Missing testimonial status ${code}`);
    }
    return status.id;
  }

  private async assertTestimonialBelongsToTenant(tenantId: string, testimonialId: string) {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id: testimonialId, tenantId },
    });

    if (!testimonial) {
      throw new NotFoundException('Testimonial not found');
    }
  }

  private async assertTagBelongsToTenant(tenantId: string, tagId: string) {
    const tag = await this.prisma.tag.findFirst({ where: { id: tagId, tenantId } });
    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
  }

  private async assertCategoryBelongsToTenant(tenantId: string, categoryId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, tenantId } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
  }

  private toView(testimonial: {
    id: string;
    authorName: string;
    content: string;
    rating: number;
    status: { code: string };
    score: number | { toString(): string };
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
    category: { id: string; name: string } | null;
    tags: Array<{ tag: { id: string; name: string } }>;
    moderationNotes?: string | null;
  }) {
    return {
      id: testimonial.id,
      authorName: testimonial.authorName,
      content: testimonial.content,
      rating: testimonial.rating,
      status: testimonial.status.code,
      score: Number(testimonial.score),
      category: testimonial.category,
      tags: testimonial.tags.map(entry => entry.tag),
      moderationNotes: testimonial.moderationNotes,
      createdAt: testimonial.createdAt,
      updatedAt: testimonial.updatedAt,
      publishedAt: testimonial.publishedAt,
    };
  }
}

