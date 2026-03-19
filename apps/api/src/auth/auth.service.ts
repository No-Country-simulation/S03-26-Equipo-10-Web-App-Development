import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AuthUser } from './auth.types';

@Injectable()
export class AuthService {
  getSessionState(request: Request) {
    const user = this.resolveUserFromRequest(request);

    return {
      ready: false,
      strategy: 'placeholder-header',
      authenticated: Boolean(user),
      user,
      message:
        'Auth real pendiente. Para rutas protegidas de desarrollo usá x-admin-preview: true.',
    };
  }

  resolveUserFromRequest(request: Request): AuthUser | null {
    const previewHeader = request.header('x-admin-preview');

    if (previewHeader !== 'true') {
      return null;
    }

    return {
      id: 'dev-admin',
      email: request.header('x-admin-email') ?? 'admin@testimonial.local',
      name: 'Admin Preview',
      role: 'ADMIN',
    };
  }
}
