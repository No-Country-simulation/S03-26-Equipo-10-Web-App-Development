import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(currentUser: AuthenticatedUser) {
    const testimonials = await this.prisma.testimonial.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        status: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: testimonials.map(testimonial => ({
        id: testimonial.id,
        authorName: testimonial.authorName,
        content: testimonial.content,
        rating: testimonial.rating,
        status: testimonial.status.code,
        score: Number(testimonial.score),
        createdAt: testimonial.createdAt,
        publishedAt: testimonial.publishedAt,
      })),
      meta: {
        total: testimonials.length,
        page: 1,
        limit: testimonials.length,
      },
    };
  }

  async create(dto: CreateTestimonialDto, currentUser: AuthenticatedUser) {
    const draftStatus = await this.prisma.testimonialStatus.findUnique({
      where: { code: 'draft' },
    });

    if (!draftStatus) {
      throw new InternalServerErrorException('Draft status is missing');
    }

    const testimonial = await this.prisma.testimonial.create({
      data: {
        tenantId: currentUser.tenantId,
        authorName: dto.authorName,
        content: dto.content,
        rating: dto.rating,
        statusId: draftStatus.id,
      },
      include: {
        status: true,
      },
    });

    return {
      id: testimonial.id,
      authorName: testimonial.authorName,
      content: testimonial.content,
      rating: testimonial.rating,
      status: testimonial.status.code,
      score: Number(testimonial.score),
      createdAt: testimonial.createdAt,
      publishedAt: testimonial.publishedAt,
    };
  }
}
