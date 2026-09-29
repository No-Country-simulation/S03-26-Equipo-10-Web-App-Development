import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { CredentialRepository } from '../repositories/credential.repository';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { setAuthenticatedTenant } from '../request-context.storage';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly credentials: CredentialRepository) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const authorization = request.header('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const rawApiKey = authorization.slice('Bearer '.length).trim();
    if (!rawApiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    const keyHash = createHash('sha256').update(rawApiKey).digest('hex');
    const apiKey = await this.credentials.findActiveApiKeyByHash(keyHash);

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    request.apiKey = apiKey;

    setAuthenticatedTenant(apiKey.tenantId);

    return true;
  }
}
