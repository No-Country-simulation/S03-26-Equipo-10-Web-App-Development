import { ConflictError, InternalError, NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { enqueueWebhookEvent } from '../../webhooks';
import { TestimonialStatus, TestimonialView } from '../entities/testimonial.model';
import { pageOffset, type AdminPage } from '../../../common/pagination/admin-page';

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

type CreateData = {
  tenantId: string;
  createdById: string | null;
  authorName: string;
  content: string;
  rating: number;
  categoryId?: string | null;
  tagIds?: string[];
};

type EventFactory = {
  eventType: string;
  payload: (view: TestimonialView) => Record<string, unknown>;
};

const testimonialInclude = {
  status: true,
  category: true,
  tags: { include: { tag: true } },
} as const;

@Injectable()
export class TestimonialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string, id: string, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<TestimonialView | null> {
    const row = await client.testimonial.findFirst({
      where: { id, tenantId },
      include: { 
        status: true,
        category: true,
        tags: { include: { tag: true } }
      },
    });

    return row ? this.toView(row) : null;
  }

  async createWithEvent(
    data: CreateData, status: 'draft' | 'pending', event: EventFactory,
    client?: Prisma.TransactionClient,
  ): Promise<TestimonialView> {
    const write = async (tx: Prisma.TransactionClient) => {
      await this.assertReferencesBelongToTenant(tx, data.tenantId, data.categoryId, data.tagIds);
      const statusId = await this.resolveStatusId(status, tx);
      const created = await tx.testimonial.create({
        data: {
          tenantId: data.tenantId,
          createdById: data.createdById,
          authorName: data.authorName,
          content: data.content,
          rating: data.rating,
          statusId,
          score: 0,
          categoryId: data.categoryId ?? null,
          ...(data.tagIds !== undefined && {
            tags: { create: data.tagIds.map(tagId => ({ tenantId: data.tenantId, tagId })) },
          }),
        },
        include: testimonialInclude,
      });
      const view = this.toView(created);
      await enqueueWebhookEvent(tx, {
        tenantId: data.tenantId,
        eventType: event.eventType,
        payload: this.toJsonPayload(event.payload(view)) as Record<string, unknown>,
      });
      return view;
    };
    return client ? write(client) : this.prisma.$transaction(write);
  }

  async updateFields(
    tenantId: string,
    id: string,
    data: {
      authorName?: string;
      content?: string;
      rating?: number;
      categoryId?: string | null;
      tagIds?: string[];
    },
    expectedStatus: TestimonialStatus,
  ): Promise<TestimonialView> {
    await this.assertReferencesBelongToTenant(this.prisma, tenantId, data.categoryId, data.tagIds);
    const expectedStatusId = await this.resolveStatusId(expectedStatus);
    const updated = await this.prisma.testimonial.update({
      where: { id, tenantId, statusId: expectedStatusId },
      data: {
        ...(data.authorName !== undefined && { authorName: data.authorName }),
        ...(data.content !== undefined && { content: data.content }),
        ...(data.rating !== undefined && { rating: data.rating }),
        ...(data.categoryId !== undefined && { categoryId: data.categoryId }),
        ...(data.tagIds !== undefined && {
          tags: {
            deleteMany: {},
            create: data.tagIds.map(tagId => ({ tenantId, tagId }))
          }
        }),
        updatedAt: new Date(),
      },
      include: { 
        status: true,
        category: true,
        tags: { include: { tag: true } }
      },
    }).catch(this.rethrowConditionalWriteConflict);

    return this.toView(updated);
  }

  async updateStatus(
    tenantId: string,
    id: string,
    expectedStatus: TestimonialStatus,
    status: TestimonialStatus,
    extra?: { moderationNotes?: string | null; publishedAt?: Date | null },
    event?: EventFactory,
    client?: Prisma.TransactionClient,
  ): Promise<TestimonialView> {
    const write = async (tx: Prisma.TransactionClient) => {
      const expectedStatusId = await this.resolveStatusId(expectedStatus, tx);
      const statusId = await this.resolveStatusId(status, tx);
      const updated = await tx.testimonial.updateMany({
        where: { id, tenantId, statusId: expectedStatusId },
        data: {
          statusId,
          updatedAt: new Date(),
          ...(extra?.moderationNotes !== undefined && { moderationNotes: extra.moderationNotes }),
          ...(extra?.publishedAt !== undefined && { publishedAt: extra.publishedAt }),
        },
      });
      if (updated.count !== 1) {
        throw new ConflictError('Testimonial status changed before this transition');
      }
      const row = await tx.testimonial.findFirstOrThrow({
        where: { id, tenantId, statusId },
        include: testimonialInclude,
      });
      const view = this.toView(row);
      if (event) {
        await enqueueWebhookEvent(tx, {
          tenantId,
          eventType: event.eventType,
          payload: this.toJsonPayload(event.payload(view)) as Record<string, unknown>,
        });
      }
      return view;
    };
    return client ? write(client) : this.prisma.$transaction(write);
  }

  async updateMedia(
    tenantId: string,
    id: string,
    expectedStatus: TestimonialStatus,
    data: {
      imageUrl?: string | null;
      videoUrl?: string | null;
      videoTitle?: string | null;
      videoThumbnailUrl?: string | null;
    },
  ): Promise<TestimonialView> {
    const expectedStatusId = await this.resolveStatusId(expectedStatus);
    const updated = await this.prisma.testimonial.update({
      where: { id, tenantId, statusId: expectedStatusId },
      data: {
        ...(data.imageUrl !== undefined && { imageUrl: data.imageUrl }),
        ...(data.videoUrl !== undefined && { videoUrl: data.videoUrl }),
        ...(data.videoTitle !== undefined && { videoTitle: data.videoTitle }),
        ...(data.videoThumbnailUrl !== undefined && { videoThumbnailUrl: data.videoThumbnailUrl }),
        updatedAt: new Date(),
      },
      include: { status: true },
    }).catch(this.rethrowConditionalWriteConflict);

    return this.toView(updated);
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.prisma.testimonial.deleteMany({ where: { id, tenantId } });
  }

  async findByTenant(tenantId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: TestimonialView[]; total: number }> {
    const [rows, total] = await Promise.all([this.prisma.testimonial.findMany({
      where: { tenantId },
      include: { 
        status: true,
        category: true,
        tags: { include: { tag: true } }
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pageOffset(page), take: page.limit,
    }), this.prisma.testimonial.count({ where: { tenantId } })]);

    return { items: rows.map(row => this.toView(row)), total };
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
        include: { 
          status: true,
          category: true,
          tags: { include: { tag: true } }
        },
        orderBy:
          filters.sort === 'publishedAt:desc'
            ? [{ publishedAt: 'desc' as const }, { id: 'desc' as const }]
            : [{ score: 'desc' as const }, { id: 'desc' as const }],
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
      include: { 
        status: true,
        category: true,
        tags: { include: { tag: true } }
      },
    });

    return row ? this.toView(row) : null;
  }

  async findAllPublishedForScoring(): Promise<Array<{ id: string; rating: number; publishedAt: Date | null }>> {
    const publishedStatusId = await this.resolveStatusId('published');
    return this.prisma.testimonial.findMany({
      where: {
        statusId: publishedStatusId,
        tenant: {
          tenantFeatureFlags: {
            some: {
              featureFlag: { name: 'enable_scoring' },
              enabled: true,
            },
          },
        },
      },
      select: { id: true, rating: true, publishedAt: true },
    });
  }

  async updateScores(updates: { id: string; score: number }[]): Promise<void> {
    if (updates.length === 0) return;

    // Use withRetry to handle transient deadlocks during batch score updates (R-1)
    await this.prisma.withRetry(async (tx) => {
      for (const { id, score } of updates) {
        await tx.testimonial.update({
          where: { id },
          data: { score },
        });
      }
    });
  }

  private toJsonPayload(payload: Record<string, unknown>): Prisma.InputJsonValue {
    // Un payload no JSON (por ejemplo BigInt) debe abortar la misma transacción
    // que escribe el testimonio: nunca confirmar el dato sin evento durable.
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  }

  private async resolveStatusId(code: TestimonialStatus, client: Prisma.TransactionClient | PrismaService = this.prisma): Promise<number> {
    const status = await client.testimonialStatus.findUnique({
      where: { code },
    });
    if (!status) {
      throw new InternalError(`Missing testimonial status: ${code}`);
    }
    return status.id;
  }

  private async assertReferencesBelongToTenant(
    client: Prisma.TransactionClient | PrismaService,
    tenantId: string,
    categoryId?: string | null,
    tagIds?: string[],
  ): Promise<void> {
    if (categoryId) {
      const category = await client.category.findFirst({ where: { id: categoryId, tenantId }, select: { id: true } });
      if (!category) throw new NotFoundError('Category not found');
    }
    if (tagIds) {
      const uniqueIds = [...new Set(tagIds)];
      const count = await client.tag.count({ where: { id: { in: uniqueIds }, tenantId } });
      if (count !== uniqueIds.length) throw new NotFoundError('Tag not found');
    }
  }

  private rethrowConditionalWriteConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      throw new ConflictError('Testimonial changed before this update');
    }
    throw error;
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
    category?: { id: string; name: string } | null;
    tags?: { tag: { id: string; name: string } }[];
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
      category: row.category ? { id: row.category.id, name: row.category.name } : null,
      tags: row.tags ? row.tags.map(t => ({ id: t.tag.id, name: t.tag.name })) : [],
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
