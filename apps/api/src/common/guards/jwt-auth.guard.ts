import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { CredentialRepository } from '../repositories/credential.repository';
import type { AppConfig } from '../../config/app.config';
import type { ApiRequest, JwtPayload } from '../interfaces/auth-context.interface';
import { setAuthenticatedTenant } from '../request-context.storage';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly credentials: CredentialRepository,
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
        secret: this.configService.getOrThrow<AppConfig>('app').jwt.secret,
      });
    } catch {
      throw new UnauthorizedException('Invalid access token');
    }

    const user = await this.credentials.findActiveUser(payload.sub);

    if (!user || user.tenantId !== payload.tenantId) {
      throw new UnauthorizedException('Inactive user or tenant');
    }

    request.user = user;

    setAuthenticatedTenant(user.tenantId);

    return true;
  }
}
