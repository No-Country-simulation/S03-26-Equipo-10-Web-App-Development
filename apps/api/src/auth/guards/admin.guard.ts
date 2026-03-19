import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';
import { RequestWithUser } from '../auth.types';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request>();
    const user = this.authService.resolveUserFromRequest(request);

    if (!user || user.role !== 'ADMIN') {
      throw new UnauthorizedException(
        'Missing admin session. Use x-admin-preview: true during scaffolding.',
      );
    }

    (request as RequestWithUser).user = user;
    return true;
  }
}
