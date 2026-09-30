import type { Response } from 'express';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { AuthService } from '../src/modules/auth/services/auth.service';

describe('AuthController session response', () => {
  const session = {
    user: {
      id: 'user-1', email: 'admin@example.com', tenantId: 'tenant-1',
      tenantName: 'Tenant', roles: ['admin'], isActive: true,
      createdAt: new Date('2026-09-29T00:00:00.000Z'),
    },
    tokens: { accessToken: 'access', refreshToken: 'refresh' },
  };

  it('returns the tokens used by the web session for login, registration and refresh', async () => {
    const service = {
      login: jest.fn().mockResolvedValue(session),
      registerAdmin: jest.fn().mockResolvedValue(session),
      refreshSession: jest.fn().mockResolvedValue(session),
    } as unknown as AuthService;
    const response = { cookie: jest.fn() } as unknown as Response;
    const controller = new AuthController(service);

    await expect(controller.login({ email: 'admin@example.com', password: 'secret' }, response))
      .resolves.toEqual(session);
    await expect(controller.registerAdmin({
      tenantName: 'Tenant', email: 'admin@example.com', password: 'secret',
    }, response)).resolves.toEqual(session);
    await expect(controller.refresh({ refreshToken: 'refresh' }, response))
      .resolves.toEqual(session);
    expect(response.cookie).toHaveBeenCalledTimes(6);
  });
});
