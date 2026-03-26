import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest, AuthenticatedUser } from '../interfaces/auth-context.interface';

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    if (!request.user) {
      throw new Error('CurrentUser decorator requires JwtAuthGuard');
    }
    return request.user;
  },
);
