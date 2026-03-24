import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ApiRequest } from '../interfaces/auth-context.interface';

export const CurrentTenantId = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const request = context.switchToHttp().getRequest<ApiRequest>();
    return request.user?.tenantId ?? request.apiKey?.tenantId ?? '';
  },
);
