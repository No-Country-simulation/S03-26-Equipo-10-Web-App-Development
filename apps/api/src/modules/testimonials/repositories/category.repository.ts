import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CategoryView } from '../entities/category.model';
import { pageOffset } from '../../../common/pagination/admin-page';

import type { CatalogQuery } from '../dto/admin-query';
import type { Prisma } from '@prisma/client';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(
    tenantId: string,
    page: CatalogQuery = { page: 1, limit: 20 },
  ): Promise<{ items: CategoryView[]; total: number }> {
    const where: Prisma.CategoryWhereInput = {
      tenantId,
      ...(page.q && { name: { contains: page.q, mode: 'insensitive' } }),
    };
    const [rows, total] = await Promise.all([
      this.prisma.category.findMany({
        where,
        include: {
          _count: { select: { testimonials: { where: { tenantId } } } },
        },
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip: pageOffset(page),
        take: page.limit,
      }),
      this.prisma.category.count({ where }),
    ]);

    return {
      items: rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        name: row.name,
        testimonialCount: row._count.testimonials,
      })),
      total,
    };
  }

  async findById(tenantId: string, id: string): Promise<CategoryView | null> {
    const row = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });

    if (!row) return null;

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    };
  }

  async create(tenantId: string, name: string): Promise<CategoryView> {
    const row = await this.prisma.category.create({
      data: { tenantId, name },
    });

    return {
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    };
  }

  async update(
    tenantId: string,
    id: string,
    name: string,
  ): Promise<CategoryView> {
    const row = await this.prisma.category.update({
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
    await this.prisma.$transaction(async (tx) => {
      await tx.testimonial.updateMany({
        where: { tenantId, categoryId: id },
        data: { categoryId: null },
      });
      await tx.category.delete({ where: { id, tenantId } });
    });
  }
}
