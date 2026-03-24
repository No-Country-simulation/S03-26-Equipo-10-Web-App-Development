import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../prisma/prisma.service';
import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';

const scrypt = promisify(scryptCallback);

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(tenantId: string) {
    const users = await this.prisma.user.findMany({
      where: { tenantId },
      include: {
        roles: { include: { role: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return {
      items: users.map(user => ({
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        isActive: user.isActive,
        roles: user.roles.map(role => role.role.code),
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      meta: {
        total: users.length,
        page: 1,
        limit: users.length,
      },
    };
  }

  async getUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, tenantId },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isActive: user.isActive,
      roles: user.roles.map(role => role.role.code),
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async createUser(tenantId: string, dto: CreateUserDto) {
    const email = dto.email.trim().toLowerCase();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const user = await this.prisma.$transaction(async tx => {
      const created = await tx.user.create({
        data: {
          tenantId,
          email,
          passwordHash: await this.hashPassword(dto.password),
          isActive: true,
        },
      });

      await tx.userRole.create({
        data: {
          userId: created.id,
          roleId: role.id,
        },
      });

      return created;
    });

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isActive: user.isActive,
      roles: [role.code],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async updateUser(tenantId: string, userId: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: { passwordHash?: string; isActive?: boolean } = {};
    if (typeof dto.isActive === 'boolean') {
      updateData.isActive = dto.isActive;
    }
    if (dto.password) {
      updateData.passwordHash = await this.hashPassword(dto.password);
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    if (dto.role) {
      const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
      if (!role) {
        throw new NotFoundException('Role not found');
      }

      await this.prisma.userRole.deleteMany({ where: { userId } });
      await this.prisma.userRole.create({ data: { userId, roleId: role.id } });
    }

    return this.getUser(tenantId, updatedUser.id);
  }

  async deleteUser(tenantId: string, userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, tenantId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    return { id: userId, deleted: true };
  }

  private async hashPassword(password: string): Promise<string> {
    const salt = randomBytes(16).toString('hex');
    const derived = (await scrypt(password, salt, 64)) as Buffer;
    return `${salt}:${derived.toString('hex')}`;
  }

  private async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(':');
    if (!salt || !hash) {
      return false;
    }

    const incoming = (await scrypt(password, salt, 64)) as Buffer;
    const stored = Buffer.from(hash, 'hex');

    if (incoming.length !== stored.length) {
      return false;
    }

    return timingSafeEqual(incoming, stored);
  }

  private hashOpaque(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }
}

