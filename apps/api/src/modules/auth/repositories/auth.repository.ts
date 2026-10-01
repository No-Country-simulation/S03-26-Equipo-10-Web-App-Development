import { ConflictError, InternalError, UnauthorizedError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import type { RoleCode } from '../../../common/interfaces/auth-context.interface';



export interface UserWithAuth {
  id: string;
  email: string;
  passwordHash: string;
  tenantId: string;
  tenantName: string;
  isActive: boolean;
  tenantIsActive: boolean;
  roles: RoleCode[];
  createdAt: Date;
}

@Injectable()
export class AuthRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findUserByEmail(email: string): Promise<UserWithAuth | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      isActive: user.isActive,
      tenantIsActive: user.tenant.isActive,
      roles: user.roles.map(entry => entry.role.code as RoleCode),
      createdAt: user.createdAt,
    };
  }

  async findUserById(userId: string): Promise<UserWithAuth | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        roles: { include: { role: true } },
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      passwordHash: user.passwordHash,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      isActive: user.isActive,
      tenantIsActive: user.tenant.isActive,
      roles: user.roles.map(entry => entry.role.code as RoleCode),
      createdAt: user.createdAt,
    };
  }

  async createTenantAndAdmin(params: {
    tenantName: string;
    email: string;
    passwordHash: string;
  }): Promise<UserWithAuth> {
    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await this.ensureCatalogsInTx(tx as unknown as PrismaClient);

      const existingTenant = await tx.tenant.findUnique({ where: { name: params.tenantName } });
      if (existingTenant) throw new ConflictError('A tenant with this name already exists');

      const existingUser = await tx.user.findUnique({ where: { email: params.email } });
      if (existingUser) throw new ConflictError('A user with this email already exists');

      const adminRole = await tx.role.findUnique({ where: { code: 'admin' } });
      if (!adminRole) throw new InternalError('Admin role is missing');

      const tenant = await tx.tenant.create({ data: { name: params.tenantName, isActive: true } });
      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: params.email,
          passwordHash: params.passwordHash,
          isActive: true,
        },
      });

      await tx.userRole.create({ data: { userId: user.id, roleId: adminRole.id } });

      const defaultFlags = await tx.featureFlag.findMany({
        where: {
          name: {
            in: ['enable_analytics', 'enable_webhooks', 'enable_scoring', 'testimonials'],
          },
        },
      });

      await Promise.all(
        defaultFlags.map((featureFlag) =>
          tx.tenantFeatureFlag.upsert({
            where: {
              tenantId_featureFlagId: {
                tenantId: tenant.id,
                featureFlagId: featureFlag.id,
              },
            },
            update: { enabled: true },
            create: {
              tenantId: tenant.id,
              featureFlagId: featureFlag.id,
              enabled: true,
            },
          }),
        ),
      );

      return {
        id: user.id,
        email: user.email,
        passwordHash: user.passwordHash,
        tenantId: tenant.id,
        tenantName: tenant.name,
        isActive: true,
        tenantIsActive: true,
        roles: ['admin'] as RoleCode[],
        createdAt: user.createdAt,
      };
    });
  }

  async upgradePasswordHash(userId: string, oldHash: string, newHash: string): Promise<void> {
    await this.prisma.user.updateMany({
      where: { id: userId, passwordHash: oldHash },
      data: { passwordHash: newHash },
    });
  }

  async createRefreshSession(userId: string, tokenHash: string, expiresAt: Date): Promise<string> {
    const family = await this.prisma.refreshSession.create({
      data: {
        userId,
        expiresAt,
        tokens: { create: { userId, tokenHash, expiresAt } },
      },
    });
    return family.id;
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<{
    id: string;
    familyId: string | null;
    familyRevokedAt: Date | null;
    familyExpiresAt: Date | null;
    revoked: boolean;
    expiresAt: Date;
    user: UserWithAuth;
  } | null> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: {
        family: true,
        user: {
          include: {
            tenant: true,
            roles: { include: { role: true } },
          },
        },
      },
    });

    if (!record) return null;

    return {
      id: record.id,
      familyId: record.familyId,
      familyRevokedAt: record.family?.revokedAt ?? null,
      familyExpiresAt: record.family?.expiresAt ?? null,
      revoked: record.revoked,
      expiresAt: record.expiresAt,
      user: {
        id: record.user.id,
        email: record.user.email,
        passwordHash: record.user.passwordHash,
        tenantId: record.user.tenantId,
        tenantName: record.user.tenant.name,
        isActive: record.user.isActive,
        tenantIsActive: record.user.tenant.isActive,
        roles: record.user.roles.map(entry => entry.role.code as RoleCode),
        createdAt: record.user.createdAt,
      },
    };
  }

  async rotateRefreshToken(oldHash: string, newHash: string, expiresAt: Date): Promise<string> {
    return this.prisma.$transaction(async tx => {
      const claimed = await tx.refreshToken.updateMany({
        where: { tokenHash: oldHash, revoked: false, expiresAt: { gt: new Date() } },
        data: { revoked: true },
      });
      if (claimed.count !== 1) {
        const replay = await tx.refreshToken.findUnique({
          where: { tokenHash: oldHash },
          select: { familyId: true, revoked: true, expiresAt: true, userId: true, user: { select: { tenantId: true } } },
        });
        if (replay?.revoked && replay.expiresAt > new Date() && replay.familyId) {
          const revoked = await tx.refreshSession.updateMany({
            where: { id: replay.familyId, revokedAt: null },
            data: { revokedAt: new Date() },
          });
          if (revoked.count) {
            await tx.auditLog.create({ data: {
              tenantId: replay.user.tenantId,
              userId: replay.userId,
              action: 'REFRESH_TOKEN_REUSE',
              resourceType: 'refresh_session',
              resourceId: replay.familyId,
            } });
          }
        }
        return null;
      }

      const old = await tx.refreshToken.findUniqueOrThrow({ where: { tokenHash: oldHash } });
      let familyId = old.familyId;
      if (!familyId) {
        // Covers tokens issued by an old replica during a rolling deployment.
        const family = await tx.refreshSession.create({ data: { userId: old.userId, expiresAt: old.expiresAt } });
        familyId = family.id;
        await tx.refreshToken.update({ where: { id: old.id }, data: { familyId } });
      }
      const family = await tx.refreshSession.findUnique({ where: { id: familyId } });
      if (!family || family.revokedAt || family.expiresAt <= new Date()) {
        return null;
      }
      await tx.refreshToken.create({ data: {
        userId: old.userId,
        familyId,
        tokenHash: newHash,
        expiresAt: new Date(Math.min(expiresAt.getTime(), family.expiresAt.getTime())),
      } });
      return familyId;
    }).then(familyId => {
      if (!familyId) throw new UnauthorizedError('Invalid or expired refresh token');
      return familyId;
    });
  }

  async revokeSessionFamilyByHash(tokenHash: string): Promise<void> {
    await this.prisma.$transaction(async tx => {
      const token = await tx.refreshToken.findUnique({ where: { tokenHash } });
      if (!token) return;
      if (token.familyId) {
        await tx.refreshSession.updateMany({
          where: { id: token.familyId, revokedAt: null }, data: { revokedAt: new Date() },
        });
        await tx.refreshToken.updateMany({ where: { familyId: token.familyId, revoked: false }, data: { revoked: true } });
      } else {
        await tx.refreshToken.updateMany({ where: { id: token.id }, data: { revoked: true } });
      }
    });
  }

  async ensureCatalogs(): Promise<void> {
    await this.ensureCatalogsInTx(this.prisma);
  }

  private async ensureCatalogsInTx(prisma: PrismaClient | Prisma.TransactionClient) {
    await prisma.role.upsert({
      where: { code: 'admin' },
      update: { description: 'Tenant administrator' },
      create: { code: 'admin', description: 'Tenant administrator' },
    });

    await prisma.role.upsert({
      where: { code: 'editor' },
      update: { description: 'Tenant editor' },
      create: { code: 'editor', description: 'Tenant editor' },
    });

    for (const [name, description] of [
      ['enable_analytics', 'Enable analytics dashboard and tracking'],
      ['enable_webhooks', 'Enable outbound webhooks'],
      ['enable_scoring', 'Enable testimonial scoring'],
      ['testimonials', 'Enable testimonials flows'],
    ] as const) {
      await prisma.featureFlag.upsert({
        where: { name },
        update: { description },
        create: { name, description },
      });
    }

    for (const code of ['draft', 'pending', 'approved', 'published', 'rejected']) {
      await prisma.testimonialStatus.upsert({ where: { code }, update: {}, create: { code } });
    }
  }
}
