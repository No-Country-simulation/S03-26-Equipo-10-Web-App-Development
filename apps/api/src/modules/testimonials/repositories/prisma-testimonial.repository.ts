import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Testimonial, TestimonialStatus } from '../entities/testimonial.model';
import {
  ITestimonialRepository,
  PaginatedResult,
  PublishedFilters,
} from './testimonial.repository';

@Injectable()
export class PrismaTestimonialRepository implements ITestimonialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string, id: string): Promise<Testimonial | null> {
    const row = await this.prisma.testimonial.findFirst({
      where: { id, tenantId },
      include: { status: true },
    });

    return row ? this.toDomain(row) : null;
  }

  async save(entity: Testimonial): Promise<void> {
    const statusId = await this.resolveStatusId(entity.status);

    await this.prisma.testimonial.upsert({
      where: { id: entity.id },
      update: {
        authorName: entity.authorName,
        content: entity.content,
        rating: entity.rating,
        statusId,
        score: entity.score,
        categoryId: entity.categoryId,
        moderationNotes: entity.moderationNotes,
        publishedAt: entity.publishedAt,
        updatedAt: entity.updatedAt,
      },
      create: {
        id: entity.id,
        tenantId: entity.tenantId,
        createdById: entity.createdById,
        authorName: entity.authorName,
        content: entity.content,
        rating: entity.rating,
        statusId,
        score: entity.score,
        categoryId: entity.categoryId,
        moderationNotes: entity.moderationNotes,
        createdAt: entity.createdAt,
        updatedAt: entity.updatedAt,
        publishedAt: entity.publishedAt,
      },
    });
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.prisma.testimonial.deleteMany({ where: { id, tenantId } });
  }

  async findByTenant(tenantId: string): Promise<Testimonial[]> {
    const rows = await this.prisma.testimonial.findMany({
      where: { tenantId },
      include: { status: true },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map(row => this.toDomain(row));
  }

  async findPublished(
    tenantId: string,
    filters: PublishedFilters,
  ): Promise<PaginatedResult<Testimonial>> {
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
      items: rows.map(row => this.toDomain(row)),
      total,
    };
  }

  async findPublishedById(
    tenantId: string,
    id: string,
  ): Promise<Testimonial | null> {
    const publishedStatusId = await this.resolveStatusId('published');
    const row = await this.prisma.testimonial.findFirst({
      where: { id, tenantId, statusId: publishedStatusId },
      include: { status: true },
    });

    return row ? this.toDomain(row) : null;
  }

  async resolveStatusId(code: TestimonialStatus): Promise<number> {
    const status = await this.prisma.testimonialStatus.findUnique({
      where: { code },
    });
    if (!status) {
      throw new Error(`Missing testimonial status: ${code}`);
    }
    return status.id;
  }

  private toDomain(row: {
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
    createdAt: Date;
    updatedAt: Date;
    publishedAt: Date | null;
  }): Testimonial {
    return Testimonial.reconstitute({
      id: row.id,
      tenantId: row.tenantId,
      createdById: row.createdById,
      authorName: row.authorName,
      content: row.content,
      rating: row.rating,
      statusCode: row.status.code as TestimonialStatus,
      score: Number(row.score),
      categoryId: row.categoryId,
      moderationNotes: row.moderationNotes,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    });
  }
}
