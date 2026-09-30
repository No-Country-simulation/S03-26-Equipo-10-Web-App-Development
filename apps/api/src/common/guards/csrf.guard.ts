import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import type { AppConfig } from '../../config/app.config';
import { CSRF_MODE_KEY, type CsrfMode } from '../decorators/csrf-mode.decorator';

@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const mode = this.reflector.getAllAndOverride<CsrfMode>(CSRF_MODE_KEY, [
      context.getHandler(), context.getClass(),
    ]);
    if (mode === 'origin') {
      this.assertAllowedOrigin(request);
      return true;
    }
    if (mode === 'api-key') return true;

    // El guard JWT usa primero el Bearer explícito. No hay credencial ambiental
    // que un sitio ajeno pueda adjuntar por sí solo a este tipo de petición.
    const authorization = request.header('authorization');
    if (authorization?.startsWith('Bearer ')) return true;

    // Sin cookie de acceso, el guard de autenticación responderá 401.
    if (!request.cookies?.['accessToken']) return true;

    this.assertAllowedOrigin(request);
    const csrfCookie = request.cookies['csrfToken'];
    const csrfHeader = request.header('x-csrf-token');

    if (!csrfCookie || !csrfHeader) {
      throw new ForbiddenException('Missing CSRF token');
    }

    const cookieBytes = Buffer.from(csrfCookie);
    const headerBytes = Buffer.from(csrfHeader);
    if (cookieBytes.length !== headerBytes.length || !timingSafeEqual(cookieBytes, headerBytes)) {
      throw new ForbiddenException('Invalid CSRF token');
    }

    return true;
  }

  private assertAllowedOrigin(request: Request): void {
    const origin = request.header('origin');
    // Clientes no navegador no envían Origin. Fetch Metadata impide que un
    // navegador omita Origin y entre como si fuera un cliente de servidor.
    if (!origin) {
      const fetchSite = request.header('sec-fetch-site');
      if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
        throw new ForbiddenException('Origin required');
      }
      return;
    }
    const allowed = new URL(this.configService.getOrThrow<AppConfig>('app').corsOrigin).origin;
    const host = request.header('host');
    const sameOrigin = host ? `${request.protocol}://${host}` : null;
    if (origin !== allowed && origin !== sameOrigin) {
      throw new ForbiddenException('Origin not allowed');
    }
  }
}
