import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Tag } from '../entities/tag.model';
import {  ITagRepository } from './tag.repository';

@Injectable()
export class PrismaTagRepository implements ITagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<Tag[]> {
    const rows = await this.prisma.tag.findMany({
      where: { tenantId },
      orderBy: { name: 'asc' },
    });

    return rows.map(row => Tag.create(row));
  }

  async findById(tenantId: string, id: string): Promise<Tag | null> {
    const row = await this.prisma.tag.findFirst({
      where: { id, tenantId },
    });

    return row ? Tag.create(row) : null;
  }

  async create(tenantId: string, name: string): Promise<Tag> {
    const row = await this.prisma.tag.create({
      data: { tenantId, name },
    });

    return Tag.create(row);
  }

  async update(tenantId: string, id: string, name: string): Promise<Tag> {
    const row = await this.prisma.tag.update({
      where: { id },
      data: { name },
    });

    return Tag.create({ ...row, tenantId });
  }

  async remove(id: string): Promise<void> {
    await this.prisma.tag.delete({ where: { id } });
  }
}
