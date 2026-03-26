import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { ApiRequest } from '../../../application/interfaces/auth-context.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<ApiRequest>();

    if (!request.user?.roles.includes('admin')) {
      throw new ForbiddenException('Admin role is required');
    }

    return true;
  }
}
