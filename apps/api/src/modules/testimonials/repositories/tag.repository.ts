import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TagView } from '../entities/tag.model';

@Injectable()
export class TagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<TagView[]> {
    const rows = await this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    }));
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
      where: { id },
      data: { name },
    });

    return {
      id: row.id,
      tenantId,
      name: row.name,
    };
  }

  async remove(id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id } });
  }

  async attachToTestimonial(testimonialId: string, tagId: string): Promise<void> {
    await this.prisma.testimonialTag.upsert({
      where: { testimonialId_tagId: { testimonialId, tagId } },
      update: {},
      create: { testimonialId, tagId },
    });
  }

  async detachFromTestimonial(testimonialId: string, tagId: string): Promise<void> {
    await this.prisma.testimonialTag.deleteMany({ where: { testimonialId, tagId } });
  }
}
