import { NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TagView } from '../entities/tag.model';
import { pageOffset, type AdminPage } from '../../../common/pagination/admin-page';

@Injectable()
export class TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: TagView[]; total: number }> {
    const [rows, total] = await Promise.all([this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      skip: pageOffset(page), take: page.limit,
    }), this.prisma.tag.count({ where: { tenantId } })]);

    return { items: rows.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    })), total };
  }

  async findById(tenantId: string, id: string): Promise<TagView | null> {
    const row = await this.prisma.tag.findFirst({
      where: { id, tenantId },
    });

    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    };
  }

  async create(tenantId: string, name: string): Promise<TagView> {
    const row = await this.prisma.tag.create({
      data: { tenantId, name },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    };
  }

  async update(tenantId: string, id: string, name: string): Promise<TagView> {
    const row = await this.prisma.tag.update({
      where: { id, tenantId },
      data: { name },
    });

    return {
      id: row.id,
      tenantId,
      name: row.name,
    };
  }

  async remove(tenantId: string, id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id, tenantId } });
  }

  async attachToTestimonial(tenantId: string, testimonialId: string, tagId: string): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const testimonial = await tx.testimonial.findFirst({ where: { id: testimonialId, tenantId }, select: { id: true } });
      const tag = await tx.tag.findFirst({ where: { id: tagId, tenantId }, select: { id: true } });
      if (!testimonial || !tag) throw new NotFoundError('Testimonial or tag not found');
      await tx.testimonialTag.upsert({
        where: { testimonialId_tagId: { testimonialId, tagId } },
        update: {},
        create: { tenantId, testimonialId, tagId },
      });
    });
  }

  async detachFromTestimonial(tenantId: string, testimonialId: string, tagId: string): Promise<void> {
    await this.prisma.testimonialTag.deleteMany({
      where: { testimonialId, tagId, testimonial: { tenantId }, tag: { tenantId } },
    });
  }
}
