import { Injectable } from '@nestjs/common';
import { ConflictError, ForbiddenError } from '../../../common/errors/application.error';
import type { ApiKeyScope, IssuedApiKey } from '../../../common/services/api-key-crypto.service';
import { PrismaService } from '../../database/prisma.service';
import { pageOffset, type AdminPage } from '../../../common/pagination/admin-page';

export interface ApiKeyView {
  id: string;
  tenantId: string;
  ownerId: string | null;
  name: string;
  publicId: string | null;
  environment: string | null;
  scopes: ApiKeyScope[];
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  isActive: boolean;
  legacy: boolean;
  expiresAt: Date | null;
  legacyValidUntil: Date | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface IssueInput {
  tenantId: string;
  ownerId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
  issued: IssuedApiKey;
}

interface RotateInput {
  tenantId: string;
  actorId: string;
  apiKeyId: string;
  name: string;
  scopes: ApiKeyScope[];
  expiresAt: Date | null;
  issued: IssuedApiKey;
}

@Injectable()
export class ApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  private view(key: {
    id: string; tenantId: string; ownerId: string | null; name: string; keyHash: string | null;
    status: string; isActive: boolean; scopes: string[]; expiresAt: Date | null;
    legacyValidUntil: Date | null; lastUsedAt: Date | null; createdAt: Date; updatedAt: Date;
    credentials: { publicId: string; environment: string }[];
  }): ApiKeyView {
    const status = key.status === 'REVOKED' || !key.isActive ? 'REVOKED'
      : key.expiresAt && key.expiresAt <= new Date() ? 'EXPIRED' : 'ACTIVE';
    return {
      id: key.id, tenantId: key.tenantId, ownerId: key.ownerId, name: key.name,
      publicId: key.credentials[0]?.publicId ?? null,
      environment: key.credentials[0]?.environment ?? null,
      scopes: key.scopes as ApiKeyScope[], status, isActive: status === 'ACTIVE',
      legacy: key.keyHash !== null, expiresAt: key.expiresAt,
      legacyValidUntil: key.legacyValidUntil, lastUsedAt: key.lastUsedAt,
      createdAt: key.createdAt, updatedAt: key.updatedAt,
    };
  }

  async findByTenant(tenantId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: ApiKeyView[]; total: number }> {
    const [keys, total] = await Promise.all([this.prisma.apiKey.findMany({
      where: { tenantId }, orderBy: { createdAt: 'desc' },
      skip: pageOffset(page), take: page.limit,
      include: { credentials: { orderBy: { createdAt: 'desc' }, take: 1,
        select: { publicId: true, environment: true } } },
    }), this.prisma.apiKey.count({ where: { tenantId } })]);
    return { items: keys.map(key => this.view(key)), total };
  }

  async findById(tenantId: string, apiKeyId: string): Promise<ApiKeyView | null> {
    const key = await this.prisma.apiKey.findFirst({
      where: { id: apiKeyId, tenantId },
      include: { credentials: { orderBy: { createdAt: 'desc' }, take: 1,
        select: { publicId: true, environment: true } } },
    });
    return key ? this.view(key) : null;
  }

  async create(input: IssueInput): Promise<ApiKeyView> {
    return this.prisma.$transaction(async tx => {
      const owner = await tx.user.findFirst({
        where: { id: input.ownerId, tenantId: input.tenantId, isActive: true }, select: { id: true },
      });
      if (!owner) throw new ForbiddenError('API key owner is not in tenant');
      const key = await tx.apiKey.create({ data: {
        tenantId: input.tenantId, ownerId: input.ownerId, name: input.name,
        keyHash: null, status: 'ACTIVE', isActive: true, scopes: input.scopes,
        expiresAt: input.expiresAt,
      } });
      await tx.apiKeyCredential.create({ data: {
        apiKeyId: key.id, publicId: input.issued.publicId,
        secretDigest: input.issued.digest, pepperVersion: input.issued.pepperVersion,
        environment: input.issued.environment, scopes: input.scopes,
      } });
      await tx.auditLog.create({ data: {
        tenantId: input.tenantId, userId: input.ownerId,
        action: 'API_KEY_CREATED', resourceType: 'api_key', resourceId: key.id,
        metadata: { publicId: input.issued.publicId, scopes: input.scopes },
      } });
      return this.view({ ...key, credentials: [{
        publicId: input.issued.publicId, environment: input.issued.environment,
      }] });
    });
  }

  async rotate(input: RotateInput): Promise<ApiKeyView> {
    const now = new Date();
    const graceUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const earliest = (...dates: Array<Date | null>): Date => dates.reduce<Date>((cutoff, date) =>
      date && date < cutoff ? date : cutoff, graceUntil);
    return this.prisma.$transaction(async tx => {
      const current = await tx.apiKey.findFirst({
        where: { id: input.apiKeyId, tenantId: input.tenantId },
        include: { credentials: { where: { status: 'ACTIVE' } } },
      });
      if (!current || current.status !== 'ACTIVE' || !current.isActive ||
        (current.expiresAt && current.expiresAt <= now)) {
        throw new ConflictError('API key is not active');
      }
      const changed = await tx.apiKey.updateMany({
        where: { id: current.id, tenantId: input.tenantId,
          rotationVersion: current.rotationVersion, status: 'ACTIVE' },
        data: { name: input.name, scopes: input.scopes, expiresAt: input.expiresAt,
          rotationVersion: { increment: 1 },
          ...(current.keyHash ? {
            legacyValidUntil: earliest(current.legacyValidUntil, current.expiresAt),
          } : {}) },
      });
      if (changed.count !== 1) throw new ConflictError('API key changed during rotation');
      for (const credential of current.credentials) {
        const expiresAt = earliest(credential.expiresAt, current.expiresAt);
        await tx.apiKeyCredential.update({
          where: { id: credential.id }, data: { status: 'ROTATING', expiresAt },
        });
      }
      await tx.apiKeyCredential.create({ data: {
        apiKeyId: current.id, publicId: input.issued.publicId,
        secretDigest: input.issued.digest, pepperVersion: input.issued.pepperVersion,
        environment: input.issued.environment, scopes: input.scopes,
      } });
      await tx.auditLog.create({ data: {
        tenantId: input.tenantId, userId: input.actorId, action: 'API_KEY_ROTATED',
        resourceType: 'api_key', resourceId: current.id,
        metadata: { publicId: input.issued.publicId, graceUntil: graceUntil.toISOString() },
      } });
      const updated = await tx.apiKey.findUniqueOrThrow({ where: { id: current.id } });
      return this.view({ ...updated, credentials: [{
        publicId: input.issued.publicId, environment: input.issued.environment,
      }] });
    });
  }

  async revoke(tenantId: string, actorId: string, apiKeyId: string): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const changed = await tx.apiKey.updateMany({
        where: { id: apiKeyId, tenantId, status: 'ACTIVE' },
        data: { status: 'REVOKED', isActive: false, revokedAt: new Date(), legacyValidUntil: new Date() },
      });
      if (changed.count) {
        await tx.auditLog.create({ data: {
          tenantId, userId: actorId, action: 'API_KEY_REVOKED',
          resourceType: 'api_key', resourceId: apiKeyId,
        } });
      }
    });
  }
}
