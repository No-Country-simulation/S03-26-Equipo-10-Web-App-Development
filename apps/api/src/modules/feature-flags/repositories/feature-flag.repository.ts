import { NotFoundError } from '../../../common/errors/application.error';
import { BillingAccessRepository } from '../../billing/access';
import type { BillingFeature } from '../../billing/domain/billing.types';
import { Optional, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { IFeatureFlagEvaluator } from '../../../common/interfaces/feature-flag-evaluator.interface';

export interface FeatureFlagView {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
}

export interface FeatureFlagSetResult {
  flagName: string;
  enabled: boolean;
  tenantId: string;
  updatedAt: Date;
}

@Injectable()
export class FeatureFlagRepository implements IFeatureFlagEvaluator {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly commercial?: BillingAccessRepository,
  ) {}

  async findAll(tenantId: string): Promise<FeatureFlagView[]> {
    const flags = await this.prisma.featureFlag.findMany({
      include: {
        tenants: { where: { tenantId } },
      },
      orderBy: { name: 'asc' },
    });

    return flags.map((flag) => ({
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.tenants[0]?.enabled ?? false,
    }));
  }

  async findByName(
    tenantId: string,
    flagName: string,
  ): Promise<FeatureFlagView | null> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
      include: {
        tenants: { where: { tenantId } },
      },
    });
    if (!flag) return null;
    return {
      id: flag.id,
      name: flag.name,
      description: flag.description,
      enabled: flag.tenants[0]?.enabled ?? false,
    };
  }

  async isEnabled(tenantId: string, flagName: string): Promise<boolean> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
      include: {
        tenants: { where: { tenantId } },
      },
    });

    if (!flag) return false;
    const enabled = flag.tenants[0]?.enabled ?? false;
    const features = new Map<string, BillingFeature>([
      ['enable_analytics', 'analytics'],
      ['enable_scoring', 'scoring'],
      ['enable_webhooks', 'webhooks'],
      ['business_intelligence', 'business_intelligence'],
      ['bi_statistics', 'bi_statistics'],
    ]);
    const feature = features.get(flagName);
    return (
      enabled &&
      (!feature ||
        !this.commercial ||
        (await this.commercial.canFeature(tenantId, feature)))
    );
  }

  async setFlag(
    tenantId: string,
    flagName: string,
    enabled: boolean,
  ): Promise<FeatureFlagSetResult> {
    const flag = await this.prisma.featureFlag.findUnique({
      where: { name: flagName },
    });
    if (!flag) throw new NotFoundError('Feature flag not found');

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
