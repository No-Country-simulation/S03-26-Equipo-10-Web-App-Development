import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../database/prisma/prisma.service';
import type { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

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
    const apiKey = await this.prisma.apiKey.findFirst({
      where: {
        keyHash,
        isActive: true,
      },
    });

    if (!apiKey) {
      throw new UnauthorizedException('Invalid API key');
    }

    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

    request.apiKey = {
      apiKeyId: apiKey.id,
      tenantId: apiKey.tenantId,
    };

    return true;
  }
}
