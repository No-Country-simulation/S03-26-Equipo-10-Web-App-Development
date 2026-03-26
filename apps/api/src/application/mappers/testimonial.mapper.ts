import { Injectable } from '@nestjs/common';
import { Testimonial } from '../../core/entities/testimonial.entity';
import { PrismaService } from '../../infrastructure/database/prisma/prisma.service';

export interface TestimonialView {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  status: string;
  score: number;
  category: { id: string; name: string } | null;
  tags: Array<{ id: string; name: string }>;
  moderationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

@Injectable()
export class TestimonialMapper {
  constructor(private readonly prisma: PrismaService) {}

  toView(entity: Testimonial): Omit<TestimonialView, 'category' | 'tags'> {
    return {
      id: entity.id,
      authorName: entity.authorName,
      content: entity.content,
      rating: entity.rating,
      status: entity.status,
      score: entity.score,
      moderationNotes: entity.moderationNotes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      publishedAt: entity.publishedAt,
    };
  }

  async toFullView(entity: Testimonial): Promise<TestimonialView> {
    const row = await this.prisma.testimonial.findUnique({
      where: { id: entity.id },
      include: {
        category: true,
        tags: { include: { tag: true } },
      },
    });

    return {
      ...this.toView(entity),
      category: row?.category ?? null,
      tags: row?.tags.map(entry => entry.tag) ?? [],
    };
  }
}
