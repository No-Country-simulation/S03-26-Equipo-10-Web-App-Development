import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser, RoleCode } from '../auth/auth.types';
import { PasswordService } from '../auth/password.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  async listUsers(currentUser: AuthenticatedUser) {
    const users = await this.prisma.user.findMany({
      where: {
        tenantId: currentUser.tenantId,
      },
      include: {
        roles: {
          include: {
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      items: users.map(user => ({
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        isActive: user.isActive,
        createdAt: user.createdAt,
        roles: user.roles.map(entry => entry.role.code as RoleCode),
      })),
      meta: {
        total: users.length,
        page: 1,
        limit: users.length,
      },
    };
  }

  async createUser(dto: CreateUserDto, currentUser: AuthenticatedUser) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const role = await this.prisma.role.findUnique({ where: { code: dto.role } });
    if (!role) {
      throw new InternalServerErrorException('Role catalog is missing');
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { id: currentUser.tenantId },
    });
    if (!tenant || !tenant.isActive) {
      throw new NotFoundException('Tenant not found');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.prisma.$transaction(async tx => {
      const createdUser = await tx.user.create({
        data: {
          tenantId: currentUser.tenantId,
          email,
          passwordHash,
        },
      });

      await tx.userRole.create({
        data: {
          userId: createdUser.id,
          roleId: role.id,
        },
      });

      return createdUser;
    });

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      isActive: user.isActive,
      createdAt: user.createdAt,
      roles: [role.code as RoleCode],
    };
  }
}
