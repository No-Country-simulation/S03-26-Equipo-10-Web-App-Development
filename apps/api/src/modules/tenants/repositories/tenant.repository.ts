import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TenantView {
  id: string;
  name: string;
  publicSlug: string | null;
  isPublicFormEnabled: boolean;
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
      publicSlug: tenant.publicSlug,
      isPublicFormEnabled: tenant.isPublicFormEnabled,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async update(tenantId: string, data: { name?: string; publicSlug?: string | null; isPublicFormEnabled?: boolean }): Promise<TenantView> {
    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });

    return {
      id: tenant.id,
      name: tenant.name,
      publicSlug: tenant.publicSlug,
      isPublicFormEnabled: tenant.isPublicFormEnabled,
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

  async slugExists(publicSlug: string, excludeTenantId: string): Promise<boolean> {
    const existing = await this.prisma.tenant.findFirst({
      where: { publicSlug, NOT: { id: excludeTenantId } },
    });
    return !!existing;
  }

  async findByPublicSlug(publicSlug: string): Promise<TenantView | null> {
    const tenant = await this.prisma.tenant.findUnique({ where: { publicSlug } });
    if (!tenant) return null;

    return {
      id: tenant.id,
      name: tenant.name,
      publicSlug: tenant.publicSlug,
      isPublicFormEnabled: tenant.isPublicFormEnabled,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}
