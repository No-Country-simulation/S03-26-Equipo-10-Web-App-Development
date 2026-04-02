import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TestimonialStatus, TestimonialView } from '../entities/testimonial.model';

export interface PublishedFilters {
  q?: string;
  tag?: string;
  category?: string;
  sort?: 'score:desc' | 'publishedAt:desc';
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
}

@Injectable()
export class TestimonialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string, id: string): Promise<TestimonialView | null> {
    const row = await this.prisma.testimonial.findFirst({
      where: { id, tenantId },
      include: { status: true },
    });

    return row ? this.toView(row) : null;
  }

  async create(data: {
    tenantId: string;
    createdById: string | null;
    authorName: string;
    content: string;
    rating: number;
    categoryId?: string | null;
  }): Promise<TestimonialView> {
    const statusId = await this.resolveStatusId('draft');

    const created = await this.prisma.testimonial.create({
      data: {
        tenantId: data.tenantId,
        createdById: data.createdById,
        authorName: data.authorName,
        content: data.content,
        rating: data.rating,
        statusId,
        score: 0,
        categoryId: data.categoryId ?? null,
      },
      include: { status: true },
    });

    return this.toView(created);
  }

  async updateFields(
    tenantId: string,
    id: string,
    data: {
      authorName?: string;
      content?: string;
      rating?: number;
      categoryId?: string | null;
    },
  ): Promise<TestimonialView> {
    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(data.authorName !== undefined && { authorName: data.authorName }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        updatedAt: new Date(),
      },
      include: { status: true },
    });

    return this.toView(updated);
  }

  async updateStatus(
    id: string,
    status: TestimonialStatus,
    extra?: { moderationNotes?: string | null; publishedAt?: Date | null },
  ): Promise<TestimonialView> {
    const statusId = await this.resolveStatusId(status);

    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        statusId,
        updatedAt: new Date(),
        ...(extra?.moderationNotes !== undefined && { moderationNotes: extra.moderationNotes }),
        ...(extra?.publishedAt !== undefined && { publishedAt: extra.publishedAt }),
      },
      include: { status: true },
    });

    return this.toView(updated);
  }

  async updateMedia(
    id: string,
    data: {
      imageUrl?: string | null;
      videoUrl?: string | null;
      videoTitle?: string | null;
      videoThumbnailUrl?: string | null;
    },
  ): Promise<TestimonialView> {
    const updated = await this.prisma.testimonial.update({
      where: { id },
      data: {
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.videoTitle !== undefined && { videoTitle: data.videoTitle }),
        ...(data.videoThumbnailUrl !== undefined && { videoThumbnailUrl: data.videoThumbnailUrl }),
        updatedAt: new Date(),
      },
      include: { status: true },
    });

    return this.toView(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.prisma.testimonial.deleteMany({ where: { id, tenantId } });
  }

  async findByTenant(tenantId: string): Promise<TestimonialView[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: { tenantId },
      include: { status: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(row => this.toView(row));
  }

  async findPublished(
    tenantId: string,
    filters: PublishedFilters,
  ): Promise<PaginatedResult<TestimonialView>> {
    const publishedStatusId = await this.resolveStatusId('published');
    const skip = (filters.page - 1) * filters.limit;

    const where: Record<string, unknown> = {
      tenantId,
      statusId: publishedStatusId,
    };

    if (filters.q) {
      where['content'] = { contains: filters.q, mode: 'insensitive' };
    }
    if (filters.category) {
      where['category'] = { name: filters.category };
    }
    if (filters.tag) {
      where['tags'] = { some: { tag: { name: filters.tag } } };
    }

    const [rows, total] = await Promise.all([
      this.prisma.testimonial.findMany({
        where,
        include: { status: true },
        orderBy:
          filters.sort === 'publishedAt:desc'
            ? { publishedAt: 'desc' }
            : { score: 'desc' },
        skip,
        take: filters.limit,
      }),
      this.prisma.testimonial.count({ where }),
    ]);

    return {
      items: rows.map(row => this.toView(row)),
      total,
    };
  }

  async findPublishedById(
    tenantId: string,
    id: string,
  ): Promise<TestimonialView | null> {
    const publishedStatusId = await this.resolveStatusId('published');
    const row = await this.prisma.testimonial.findFirst({
      where: { id, tenantId, statusId: publishedStatusId },
      include: { status: true },
    });

    return row ? this.toView(row) : null;
  }

  async findAllPublishedForScoring(): Promise<Array<{ id: string; rating: number; publishedAt: Date | null }>> {
    const publishedStatusId = await this.resolveStatusId('published');
    return this.prisma.testimonial.findMany({
      where: { statusId: publishedStatusId },
      select: { id: true, rating: true, publishedAt: true },
    });
  }

  async updateScores(updates: { id: string; score: number }[]): Promise<void> {
    if (updates.length === 0) return;

    // Use a transaction since Prisma doesn't have a native upsert/updateMany with distinct values per row
    await this.prisma.$transaction(
      updates.map(({ id, score }) =>
        this.prisma.testimonial.update({
          where: { id },
          data: { score },
        }),
      ),
    );
  }

  private async resolveStatusId(code: TestimonialStatus): Promise<number> {
    const status = await this.prisma.testimonialStatus.findUnique({
      where: { code },
    });
    if (!status) {
      throw new Error(`Missing testimonial status: ${code}`);
    }
    return status.id;
  }

  private toView(row: {
    id: string;
    tenantId: string;
    createdById: string | null;
    authorName: string;
    content: string;
    rating: number;
    status: { code: string };
    score: number | { toString(): string };
    categoryId: string | null;
    moderationNotes: string | null;
    imageUrl: string | null;
    videoUrl: string | null;
    videoTitle: string | null;
    videoThumbnailUrl: string | null;
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
  }): TestimonialView {
    return {
      id: row.id,
      tenantId: row.tenantId,
      createdById: row.createdById,
      authorName: row.authorName,
      content: row.content,
      rating: row.rating,
      status: row.status.code as TestimonialStatus,
      score: Number(row.score),
      categoryId: row.categoryId,
      moderationNotes: row.moderationNotes,
      imageUrl: row.imageUrl,
      videoUrl: row.videoUrl,
      videoTitle: row.videoTitle,
      videoThumbnailUrl: row.videoThumbnailUrl,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  }
}
