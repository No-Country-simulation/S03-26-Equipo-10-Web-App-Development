import { Injectable } from '@nestjs/common';
import { Testimonial } from '../entities/testimonial.model';

export interface TestimonialView {
  id: string;
  tenantId: string;
  authorName: string;
  content: string;
  rating: number;
  status: string;
  score: number;
  categoryId: string | null;
  moderationNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
  publishedAt: Date | null;
}

@Injectable()
export class TestimonialMapper {
  toFullView(entity: Testimonial): TestimonialView {
    return {
      id: entity.id,
      tenantId: entity.tenantId,
      authorName: entity.authorName,
      content: entity.content,
      rating: entity.rating,
      status: entity.status,
      score: Number(entity.score),
      categoryId: entity.categoryId,
      moderationNotes: entity.moderationNotes,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
      publishedAt: entity.publishedAt,
    };
  }
}
