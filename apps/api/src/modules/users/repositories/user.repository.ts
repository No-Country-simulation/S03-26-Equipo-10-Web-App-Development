import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { UserView } from '../entities/user.model';
import { InternalError, NotFoundError } from '../../../common/errors/application.error';
import { pageOffset, type AdminPage } from '../../../common/pagination/admin-page';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string, page: AdminPage = { page: 1, limit: 20 }): Promise<{ items: UserView[]; total: number }> {
    const [users, total] = await Promise.all([this.prisma.user.findMany({
      where: { tenantId },
      include: { roles: { include: { role: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      skip: pageOffset(page), take: page.limit,
    }), this.prisma.user.count({ where: { tenantId } })]);

    return { items: users.map((u) => this.toView(u)), total };
  }

  async findById(tenantId: string, userId: string): Promise<UserView | null> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: { roles: { include: { role: true } } },
    });

    return user ? this.toView(user) : null;
  }

  async findByEmail(email: string): Promise<UserView | null> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { roles: { include: { role: true } } },
    });

    return user ? this.toView(user) : null;
  }

  async create(params: {
    tenantId: string;
    email: string;
    passwordHash: string;
    roleCode: string;
  }): Promise<UserView> {
    const role = await this.prisma.role.findUnique({ where: { code: params.roleCode } });
    if (!role) throw new InternalError(`Role not found: ${params.roleCode}`);

    const user = await this.prisma.user.create({
      data: {
        tenantId: params.tenantId,
        email: params.email,
        passwordHash: params.passwordHash,
        isActive: true,
        roles: { create: { roleId: role.id } },
      },
      include: { roles: { include: { role: true } } },
    });

    return this.toView(user);
  }

  async update(params: {
    tenantId: string;
    userId: string;
    email?: string;
    passwordHash?: string;
    isActive?: boolean;
  }): Promise<UserView> {
    const user = await this.prisma.user.update({
      where: { id: params.userId, tenantId: params.tenantId },
      data: {
        ...(params.email !== undefined && { email: params.email }),
        ...(params.passwordHash !== undefined && { passwordHash: params.passwordHash }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
      },
      include: { roles: { include: { role: true } } },
    }).catch((error: unknown) => {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundError('User not found');
      }
      throw error;
    });

    return this.toView(user);
  }

  async remove(tenantId: string, userId: string): Promise<void> {
    await this.prisma.$transaction(async tx => {
      await tx.testimonial.updateMany({
        where: { tenantId, createdById: userId }, data: { createdById: null },
      });
      await tx.apiKey.updateMany({
        where: { tenantId, ownerId: userId }, data: { ownerId: null },
      });
      const deleted = await tx.user.deleteMany({ where: { id: userId, tenantId } });
      if (deleted.count !== 1) throw new NotFoundError('User not found');
    });
  }

  private toView(user: {
    id: string;
    tenantId: string;
    email: string;
    isActive: boolean;
    roles: Array<{ role: { code: string } }>;
    createdAt: Date;
    updatedAt: Date;
  }): UserView {
    return {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      isActive: user.isActive,
      roles: user.roles.map((r) => r.role.code),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
