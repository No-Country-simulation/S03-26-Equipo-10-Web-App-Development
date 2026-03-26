import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IFeatureFlagRepository, FeatureFlagView, FeatureFlagSetResult } from '../../../core/repositories/feature-flag.repository';

@Injectable()
export class PrismaFeatureFlagRepository implements IFeatureFlagRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(tenantId: string): Promise<FeatureFlagView[]> {
    const flags = await this.prisma.featureFlag.findMany({
      include: {
        tenants: { where: { tenantId } },
      },
      orderBy: { name: 'asc' },
    });

    return flags.map(flag => ({
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.tenants[0]?.enabled ?? false,
    }));
  }

  async setFlag(tenantId: string, flagName: string, enabled: boolean): Promise<FeatureFlagSetResult> {
    const flag = await this.prisma.featureFlag.findUnique({ where: { name: flagName } });
    if (!flag) throw new NotFoundException('Feature flag not found');

    const assignment = await this.prisma.tenantFeatureFlag.upsert({
      where: {
        tenantId_featureFlagId: { tenantId, featureFlagId: flag.id },
      },
      update: { enabled },
      create: { tenantId, featureFlagId: flag.id, enabled },
    });

    return {
      flagName,
      enabled: assignment.enabled,
      tenantId,
      updatedAt: assignment.updatedAt,
    };
  }
}
