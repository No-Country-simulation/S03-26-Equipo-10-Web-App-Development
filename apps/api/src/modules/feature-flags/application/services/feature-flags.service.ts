import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const flags = await this.prisma.featureFlag.findMany({
      include: {
        tenants: {
          where: { tenantId },
        },
      },
      orderBy: { name: 'asc' },
    });

    return {
      items: flags.map(flag => ({
        id: flag.id,
        name: flag.name,
        description: flag.description,
        enabled: flag.tenants[0]?.enabled ?? false,
      })),
      meta: {
        total: flags.length,
        page: 1,
        limit: flags.length,
      },
    };
  }

  async set(tenantId: string, flagName: string, enabled: boolean) {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: flagName } });
    if (!flag) {
      throw new NotFoundException('Feature flag not found');
    }

    const assignment = await this.prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_featureFlagId: {
          tenantId,
          featureFlagId: flag.id,
        },
      },
      update: { enabled },
      create: {
        tenantId,
        featureFlagId: flag.id,
        enabled,
      },
    });

    return {
      flagName,
      enabled: assignment.enabled,
      tenantId,
      updatedAt: assignment.updatedAt,
    };
  }
}

