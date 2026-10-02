import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CredentialRepository } from '../repositories/credential.repository';
import { ApiKeyCryptoService, type ApiKeyScope } from '../services/api-key-crypto.service';
import type { ApiRequest } from '../interfaces/auth-context.interface';
import { setAuthenticatedTenant } from '../request-context.storage';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly credentials: CredentialRepository,
    private readonly crypto: ApiKeyCryptoService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    const authorization = request.header('authorization');

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing API key');
    }

    const raw = authorization.slice('Bearer '.length).trim();
    const now = new Date();
    const parsed = this.crypto.parse(raw);
    if (parsed) {
      if (parsed.environment !== this.crypto.environment()) throw new UnauthorizedException('Invalid API key');
      const credential = await this.credentials.findApiKeyCredential(parsed.publicId);
      if (!credential || credential.environment !== parsed.environment ||
        !this.crypto.verify(parsed.secret, credential.pepperVersion, credential.secretDigest) ||
        !['ACTIVE', 'ROTATING'].includes(credential.status) ||
        (credential.expiresAt && credential.expiresAt <= now) ||
        credential.apiKey.status !== 'ACTIVE' || !credential.apiKey.isActive ||
        (credential.apiKey.expiresAt && credential.apiKey.expiresAt <= now) ||
        !credential.apiKey.tenant.isActive) throw new UnauthorizedException('Invalid API key');
      const key = credential.apiKey;
      request.apiKey = {
        apiKeyId: key.id, tenantId: key.tenantId, ownerId: key.ownerId,
        publicId: credential.publicId, scopes: credential.scopes as ApiKeyScope[],
        environment: parsed.environment, legacy: false,
      };
    } else if (this.crypto.isLegacy(raw) && this.crypto.legacyAllowed(now)) {
      const key = await this.credentials.findLegacyApiKey(this.crypto.legacyHash(raw));
      if (!key || !key.isActive || key.status !== 'ACTIVE' || !key.tenant.isActive ||
        (key.expiresAt && key.expiresAt <= now) ||
        (key.legacyValidUntil && key.legacyValidUntil <= now)) {
        throw new UnauthorizedException('Invalid API key');
      }
      request.apiKey = {
        apiKeyId: key.id, tenantId: key.tenantId, ownerId: key.ownerId,
        scopes: ['testimonials:read', 'analytics:write'], environment: 'legacy', legacy: true,
      };
    } else {
      throw new UnauthorizedException('Invalid API key');
    }

    const principal = request.apiKey;
    setAuthenticatedTenant(principal.tenantId);
    await this.credentials.recordApiKeyUse(principal.apiKeyId, principal.tenantId,
      principal.publicId ?? null, principal.legacy);

    return true;
  }
}
