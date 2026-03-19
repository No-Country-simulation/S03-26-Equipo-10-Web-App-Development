import { Injectable } from '@nestjs/common';
import { TestimonialStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/auth.types';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialStatusDto } from './dto/update-testimonial-status.dto';

@Injectable()
export class TestimonialsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.testimonial.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  findPublished() {
    return this.prisma.testimonial.findMany({
      where: { status: TestimonialStatus.PUBLISHED },
      orderBy: { publishedAt: 'desc' },
    });
  }

  create(dto: CreateTestimonialDto, user?: AuthUser) {
    const status = dto.status ?? 'DRAFT';

    return this.prisma.testimonial.create({
      data: {
        authorName: dto.authorName,
        authorRole: dto.authorRole,
        company: dto.company,
        content: dto.content,
        status,
        publishedAt: status === 'PUBLISHED' ? new Date() : null,
        createdById: user?.id,
      },
    });
  }

  updateStatus(id: string, dto: UpdateTestimonialStatusDto) {
    return this.prisma.testimonial.update({
      where: { id },
      data: {
        status: dto.status,
        publishedAt: dto.status === 'PUBLISHED' ? new Date() : null,
      },
    });
  }
}
