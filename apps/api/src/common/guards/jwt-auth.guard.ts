import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../modules/database/prisma.service';
import type { AppConfig } from '../../config/app.config';
import type { ApiRequest, JwtPayload, RoleCode } from '../interfaces/auth-context.interface';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest & { cookies: Record<string, string> }>();
    
    // Extracción Híbrida: Cookie (primario) o Header Bearer (fallback)
    let token = request.cookies?.['accessToken'];
    
    if (!token) {
      const authorization = request.header('authorization');
      if (authorization?.startsWith('Bearer ')) {
        token = authorization.slice('Bearer '.length);
      }
    }

    if (!token) {
      throw new UnauthorizedException('Missing authentication token');
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.get<AppConfig>('app')!.jwt.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        tenant: true,
        roles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user || !user.isActive || !user.tenant.isActive) {
      throw new UnauthorizedException('Inactive user or tenant');
    }

    request.user = {
      userId: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenant.name,
      roles: user.roles.map((entry: any) => entry.role.code as RoleCode),
      isActive: user.isActive,
    };

    return true;
  }
}
