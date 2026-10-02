import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_KEY_SCOPES_KEY } from '../decorators/require-api-key-scopes.decorator';
import type { ApiKeyScope } from '../services/api-key-crypto.service';
import type { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class ApiKeyScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<ApiKeyScope[]>(API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()]) ?? [];
    if (required.length === 0) return true;
    const principal = context.switchToHttp().getRequest<ApiRequest>().apiKey;
    if (!principal || !required.every(scope => principal.scopes.includes(scope))) {
      throw new ForbiddenException('API key lacks required scope');
    }
    return true;
  }
}
