import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RATE_LIMIT_KEY, type RateLimitConfig } from '../decorators/rate-limit.decorator';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const config =
      this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? { limit: 120, windowSeconds: 60, scope: 'ip' as const };

    const request = context.switchToHttp().getRequest<ApiRequest>();
    const ip = this.resolveIp(request);
    const key =
      config.scope === 'ip-api-key'
        ? `${ip}:${request.apiKey?.apiKeyId ?? 'anon'}`
        : ip;

    const route = request.route?.path ?? request.path;
    this.rateLimitService.assertWithinLimit(
      `${request.method}:${route}:${key}`,
      config.limit,
      config.windowSeconds,
      `Rate limit exceeded for ${request.method} ${route}`,
    );

    return true;
  }

  private resolveIp(request: ApiRequest): string {
    const forwarded = request.header('x-forwarded-for');
    if (forwarded) {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }

    return request.socket.remoteAddress ?? request.ip ?? 'unknown';
  }
}
