import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMe(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id: tenantId } });
    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }

  async updateMe(tenantId: string, payload: { name?: string }) {
    if (payload.name) {
      const existing = await this.prisma.tenant.findFirst({
        where: {
          name: payload.name,
          NOT: { id: tenantId },
        },
      });

      if (existing) {
        throw new ConflictException('Tenant name already exists');
      }
    }

    const tenant = await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        name: payload.name,
      },
    });

    return {
      id: tenant.id,
      name: tenant.name,
      isActive: tenant.isActive,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
    };
  }
}

