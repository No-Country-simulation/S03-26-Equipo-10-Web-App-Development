import { CanActivate, ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'node:crypto';
import { RateLimitedError } from '../errors/application.error';
import { RATE_LIMIT_KEY, type RateLimitConfig } from '../decorators/rate-limit.decorator';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { RateLimitService } from '../services/rate-limit.service';

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimitService: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const config =
      this.reflector.getAllAndOverride<RateLimitConfig>(RATE_LIMIT_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? { limit: 120, windowSeconds: 60, scope: 'ip' as const };

    const request = context.switchToHttp().getRequest<ApiRequest>();
    // Express calcula request.ip con la política de proxies confiables del servidor.
    const ip = request.ip ?? request.socket.remoteAddress ?? 'unknown';
    const route = request.route?.path ?? request.path;
    const prefix = `quota:v1:${request.method}:${route}`;
    const opaque = (value: string) => createHash('sha256').update(value).digest('hex');
    const keys = [`${prefix}:ip:${opaque(ip)}`];
    const tenant = request.apiKey?.tenantId ?? request.user?.tenantId ?? request.tenantId;
    const publicTenant = request.params?.slug;
    if (tenant) keys.push(`${prefix}:tenant:${opaque(tenant)}`);
    else if (typeof publicTenant === 'string') keys.push(`${prefix}:slug:${opaque(publicTenant)}`);
    if (config.scope === 'ip-api-key' && request.apiKey) {
      keys.push(`${prefix}:key:${opaque(request.apiKey.publicId ?? request.apiKey.apiKeyId)}`);
    }
    try {
      await this.rateLimitService.assertWithinLimit(keys, config.limit, config.windowSeconds,
        `Rate limit exceeded for ${request.method} ${route}`);
    } catch (error) {
      if (error instanceof RateLimitedError) throw error;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
        throw new ServiceUnavailableException('Request quota unavailable');
      }
    }

    return true;
  }
}
