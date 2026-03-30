import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { IAuthRepository, UserWithAuth } from './auth.repository';
import type { RoleCode } from '../../../common/interfaces/auth-context.interface';

@Injectable()
export class PrismaAuthRepository implements IAuthRepository {
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
      if (existingTenant) throw new Error('TENANT_NAME_EXISTS');

      const existingUser = await tx.user.findUnique({ where: { email: params.email } });
      if (existingUser) throw new Error('EMAIL_EXISTS');

      const adminRole = await tx.role.findUnique({ where: { code: 'admin' } });
      if (!adminRole) throw new InternalServerErrorException('Admin role is missing');

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

  async createRefreshToken(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    await this.prisma.refreshToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  async findValidRefreshToken(tokenHash: string): Promise<{
    id: string;
    user: UserWithAuth;
  } | null> {
    const record = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
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

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.prisma.refreshToken.update({
      where: { id: tokenId },
      data: { revoked: true },
    });
  }

  async revokeRefreshTokenByHash(tokenHash: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revoked: false },
      data: { revoked: true },
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

    for (const code of ['draft', 'pending', 'approved', 'published', 'rejected']) {
      await prisma.testimonialStatus.upsert({ where: { code }, update: {}, create: { code } });
    }
  }
}
