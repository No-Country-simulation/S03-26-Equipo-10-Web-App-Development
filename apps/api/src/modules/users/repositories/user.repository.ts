import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface UserView {
  id: string;
  tenantId: string;
  email: string;
  isActive: boolean;
  roles: string[];
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<UserView[]> {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: { roles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u: any) => this.toView(u));
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
    if (!role) throw new Error(`Role not found: ${params.roleCode}`);

    const user = await this.prisma.user.create({
      data: {
        tenantId: params.tenantId,
        email: params.email,
        passwordHash: params.passwordHash,
        isActive: true,
      },
    });

    await this.prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    return this.findById(params.tenantId, user.id) as Promise<UserView>;
  }

  async update(params: {
    tenantId: string;
    userId: string;
    email?: string;
    passwordHash?: string;
    isActive?: boolean;
  }): Promise<UserView> {
    await this.prisma.user.updateMany({
      where: { id: params.userId, tenantId: params.tenantId },
      data: {
        ...(params.email !== undefined && { email: params.email }),
        ...(params.passwordHash !== undefined && { passwordHash: params.passwordHash }),
        ...(params.isActive !== undefined && { isActive: params.isActive }),
      },
    });

    return this.findById(params.tenantId, params.userId) as Promise<UserView>;
  }

  async remove(tenantId: string, userId: string): Promise<void> {
    await this.prisma.user.deleteMany({ where: { id: userId, tenantId } });
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
      roles: user.roles.map((r: any) => r.role.code),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
