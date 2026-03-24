import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../../../prisma/prisma.service';
import { CreateApiKeyDto, RotateApiKeyDto } from '../dto/api-key.dto';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: keys.map(key => ({
        id: key.id,
        tenantId: key.tenantId,
        name: key.name,
        isActive: key.isActive,
        lastUsedAt: key.lastUsedAt,
        createdAt: key.createdAt,
        updatedAt: key.updatedAt,
      })),
      meta: {
        total: keys.length,
        page: 1,
        limit: keys.length,
      },
    };
  }

  async create(tenantId: string, dto: CreateApiKeyDto) {
    const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
    const created = await this.prisma.apiKey.create({
      data: {
        tenantId,
        name: dto.name,
        keyHash: this.hash(rawApiKey),
        isActive: true,
      },
    });

    return {
      id: created.id,
      name: created.name,
      apiKey: rawApiKey,
      createdAt: created.createdAt,
    };
  }

  async rotate(tenantId: string, apiKeyId: string, dto: RotateApiKeyDto) {
    const current = await this.prisma.apiKey.findFirst({ where: { id: apiKeyId, tenantId } });
    if (!current) {
      throw new NotFoundException('API key not found');
    }

    const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;

    const updated = await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        name: dto.name,
        keyHash: this.hash(rawApiKey),
        isActive: true,
        lastUsedAt: null,
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      apiKey: rawApiKey,
      updatedAt: updated.updatedAt,
    };
  }

  async revoke(tenantId: string, apiKeyId: string) {
    const current = await this.prisma.apiKey.findFirst({ where: { id: apiKeyId, tenantId } });
    if (!current) {
      throw new NotFoundException('API key not found');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKeyId },
      data: {
        isActive: false,
      },
    });

    return { id: apiKeyId, revoked: true };
  }

  private hash(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

