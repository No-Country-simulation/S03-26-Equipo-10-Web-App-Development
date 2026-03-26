import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IApiKeyRepository, ApiKeyView } from '../../../core/repositories/api-key.repository';

@Injectable()
export class PrismaApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<ApiKeyView[]> {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return keys.map(key => ({
      id: key.id,
      tenantId: key.tenantId,
      name: key.name,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    }));
  }

  async findById(tenantId: string, apiKeyId: string): Promise<ApiKeyView | null> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, tenantId },
    });

    if (!key) return null;

    return {
      id: key.id,
      tenantId: key.tenantId,
      name: key.name,
      isActive: key.isActive,
      lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt,
      updatedAt: key.updatedAt,
    };
  }

  async create(tenantId: string, name: string, keyHash: string) {
    const created = await this.prisma.apiKey.create({
      data: { tenantId, name, keyHash, isActive: true },
    });
    return { id: created.id, name: created.name, createdAt: created.createdAt };
  }

  async rotate(apiKeyId: string, name: string, keyHash: string) {
    const updated = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { name, keyHash, isActive: true, lastUsedAt: null },
    });
    return { id: updated.id, name: updated.name, updatedAt: updated.updatedAt };
  }

  async revoke(apiKeyId: string): Promise<void> {
    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: { isActive: false },
    });
  }
}
