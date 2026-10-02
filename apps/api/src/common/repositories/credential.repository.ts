import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../modules/database/prisma.service';
import type { AuthenticatedUser, RoleCode } from '../interfaces/auth-context.interface';

@Injectable()
export class CredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActiveUser(userId: string): Promise<AuthenticatedUser | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { tenant: true, roles: { include: { role: true } } },
    });
    if (!user || !user.isActive || !user.tenant.isActive) return null;

    return {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      roles: user.roles.map(entry => entry.role.code as RoleCode),
      isActive: user.isActive,
    };
  }

  async isActiveRefreshSession(sessionId: string, userId: string): Promise<boolean> {
    const session = await this.prisma.refreshSession.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { id: true },
    });
    return !!session;
  }

  findApiKeyCredential(publicId: string) {
    return this.prisma.apiKeyCredential.findUnique({
      where: { publicId }, include: { apiKey: { include: { tenant: true } } },
    });
  }

  findLegacyApiKey(keyHash: string) {
    return this.prisma.apiKey.findFirst({
      where: { keyHash }, include: { tenant: true },
    });
  }

  async recordApiKeyUse(apiKeyId: string, tenantId: string, publicId: string | null, legacy: boolean): Promise<void> {
    const now = new Date();
    await this.prisma.$transaction(async tx => {
      const touched = await tx.apiKey.updateMany({
        where: { id: apiKeyId, tenantId, OR: [
          { lastUsedAt: null }, { lastUsedAt: { lte: new Date(now.getTime() - 5 * 60 * 1000) } },
        ] },
        data: { lastUsedAt: now },
      });
      if (touched.count > 0) {
        await tx.auditLog.create({ data: {
          tenantId, action: legacy ? 'API_KEY_LEGACY_USED' : 'API_KEY_USED',
          resourceType: 'api_key', resourceId: apiKeyId,
          ...(publicId ? { metadata: { publicId } } : {}),
        } });
      }
    });
  }
}
