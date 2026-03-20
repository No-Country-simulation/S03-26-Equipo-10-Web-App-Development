import {
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterAdminDto } from './dto/register-admin.dto';
import { RoleCode } from './auth.types';
import { PasswordService } from './password.service';
import { LoginAttemptsService } from './login-attempts.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly loginAttemptsService: LoginAttemptsService,
  ) {}

  async registerAdmin(dto: RegisterAdminDto) {
    const email = this.normalizeEmail(dto.email);
    const tenantName = dto.tenantName.trim();

    const result = await this.prisma.$transaction(async tx => {
      await this.ensureCatalogs(tx);

      const existingTenant = await tx.tenant.findUnique({
        where: { name: tenantName },
      });
      if (existingTenant) {
        throw new ConflictException('Tenant name already exists');
      }

      const existingUser = await tx.user.findUnique({ where: { email } });
      if (existingUser) {
        throw new ConflictException('Email already exists');
      }

      const adminRole = await tx.role.findUnique({ where: { code: 'admin' } });
      if (!adminRole) {
        throw new InternalServerErrorException('Admin role is missing');
      }

      const passwordHash = await this.passwordService.hashPassword(dto.password);
      const tenant = await tx.tenant.create({
        data: {
          name: tenantName,
        },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email,
          passwordHash,
        },
      });

      await tx.userRole.create({
        data: {
          userId: user.id,
          roleId: adminRole.id,
        },
      });

      return {
        id: user.id,
        email: user.email,
        tenantId: tenant.id,
        tenantName: tenant.name,
        roles: ['admin'] as RoleCode[],
        isActive: true,
        createdAt: user.createdAt,
      };
    });

    return this.issueSession(result);
  }

  async login(dto: LoginDto) {
    const email = this.normalizeEmail(dto.email);
    this.loginAttemptsService.assertNotBlocked(email);

    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        tenant: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      this.loginAttemptsService.registerFailure(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await this.passwordService.verifyPassword(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      this.loginAttemptsService.registerFailure(email);
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive || !user.tenant.isActive) {
      throw new ForbiddenException('Inactive user or tenant');
    }

    this.loginAttemptsService.clear(email);

    return this.issueSession({
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      roles: user.roles.map(entry => entry.role.code as RoleCode),
      isActive: user.isActive,
      createdAt: user.createdAt,
    });
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.passwordService.hashOpaqueToken(refreshToken);
    const tokenRecord = await this.prisma.refreshToken.findFirst({
      where: {
        tokenHash,
        revoked: false,
        expiresAt: { gt: new Date() },
      },
      include: {
        user: {
          include: {
            tenant: true,
            roles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!tokenRecord) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!tokenRecord.user.isActive || !tokenRecord.user.tenant.isActive) {
      throw new ForbiddenException('Inactive user or tenant');
    }

    await this.prisma.refreshToken.update({
      where: { id: tokenRecord.id },
      data: { revoked: true },
    });

    return this.issueSession({
      id: tokenRecord.user.id,
      email: tokenRecord.user.email,
      tenantId: tokenRecord.user.tenantId,
      tenantName: tokenRecord.user.tenant.name,
      roles: tokenRecord.user.roles.map(entry => entry.role.code as RoleCode),
      isActive: tokenRecord.user.isActive,
      createdAt: tokenRecord.user.createdAt,
    });
  }

  async logout(refreshToken: string) {
    const tokenHash = this.passwordService.hashOpaqueToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: {
        tokenHash,
        revoked: false,
      },
      data: {
        revoked: true,
      },
    });
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        tenant: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      roles: user.roles.map(entry => entry.role.code as RoleCode),
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  private async issueSession(user: {
    id: string;
    email: string;
    tenantId: string;
    tenantName: string;
    roles: RoleCode[];
    isActive: boolean;
    createdAt: Date;
  }) {
    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        email: user.email,
        tenantId: user.tenantId,
        roles: user.roles,
      },
      {
        secret: process.env.JWT_SECRET,
        expiresIn: this.parseDurationSeconds(
          process.env.JWT_ACCESS_EXPIRES_IN ?? '15m',
        ),
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: this.passwordService.hashOpaqueToken(refreshToken),
        expiresAt: new Date(
          Date.now() + this.parseDurationMs(process.env.JWT_REFRESH_EXPIRES_IN ?? '7d'),
        ),
      },
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        tenantId: user.tenantId,
        tenantName: user.tenantName,
        roles: user.roles,
        isActive: user.isActive,
        createdAt: user.createdAt,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private parseDurationSeconds(value: string): number {
    return Math.floor(this.parseDurationMs(value) / 1000);
  }

  private parseDurationMs(value: string): number {
    const match = value.match(/^(\d+)([mhd])$/i);
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000;
    }

    const amount = Number(match[1]);
    const unit = match[2].toLowerCase();

    switch (unit) {
      case 'm':
        return amount * 60 * 1000;
      case 'h':
        return amount * 60 * 60 * 1000;
      case 'd':
      default:
        return amount * 24 * 60 * 60 * 1000;
    }
  }

  private async ensureCatalogs(prisma: PrismaClient | Prisma.TransactionClient) {
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

    const permissions = [
      { code: 'create:testimonial', description: 'Create testimonials' },
      { code: 'approve:testimonial', description: 'Approve testimonials' },
      { code: 'publish:testimonial', description: 'Publish testimonials' },
      { code: 'manage:users', description: 'Manage tenant users' },
    ];

    for (const permission of permissions) {
      await prisma.permission.upsert({
        where: { code: permission.code },
        update: { description: permission.description },
        create: permission,
      });
    }

    for (const code of ['draft', 'pending', 'approved', 'published', 'rejected']) {
      await prisma.testimonialStatus.upsert({
        where: { code },
        update: {},
        create: { code },
      });
    }
  }
}
