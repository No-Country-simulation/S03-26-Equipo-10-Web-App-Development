import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TenantView {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class TenantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(tenantId: string): Promise<TenantView | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) return null;

    return {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async update(tenantId: string, name: string): Promise<TenantView> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: { name },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async nameExists(name: string, excludeTenantId: string): Promise<boolean> {
    const existing = await this.prisma.tenant.findFirst({
      where: { name, NOT: { id: excludeTenantId } },
    });
    return !!existing;
  }
}
