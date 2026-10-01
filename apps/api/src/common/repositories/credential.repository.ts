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

  async findActiveApiKeyByHash(keyHash: string): Promise<{ apiKeyId: string; tenantId: string } | null> {
    const key = await this.prisma.apiKey.findFirst({
      where: { keyHash, isActive: true, tenant: { isActive: true } },
    });
    if (!key) return null;
    await this.prisma.apiKey.update({ where: { id: key.id }, data: { lastUsedAt: new Date() } });
    return { apiKeyId: key.id, tenantId: key.tenantId };
  }
}
