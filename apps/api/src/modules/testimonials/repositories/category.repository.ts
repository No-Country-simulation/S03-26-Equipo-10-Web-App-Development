import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Category } from '../entities/category.model';


@Injectable()
export class CategoryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map(row => Category.create(row));
  }

  async findById(tenantId: string, id: string): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({
      where: { id, tenantId },
    });

    return row ? Category.create(row) : null;
  }

  async create(tenantId: string, name: string): Promise<Category> {
    const row = await this.prisma.category.create({
      data: { tenantId, name },
    });

    return Category.create(row);
  }

  async update(tenantId: string, id: string, name: string): Promise<Category> {
    const row = await this.prisma.category.update({
      where: { id },
      data: { name },
    });

    return Category.create({ ...row, tenantId });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.category.delete({ where: { id } });
  }
}
