import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CategoryView } from '../entities/category.model';

@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<CategoryView[]> {
    const rows = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map(row => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
    }));
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

  async update(tenantId: string, id: string, name: string): Promise<CategoryView> {
    const row = await this.prisma.category.update({
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
    await this.prisma.category.delete({ where: { id } });
  }
}
