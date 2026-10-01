import type { Request, Response } from 'express';
import type { ConfigService } from '@nestjs/config';
import { AuthController } from '../src/modules/auth/controllers/auth.controller';
import { AuthService } from '../src/modules/auth/services/auth.service';
import { SessionCsrfService } from '../src/common/services/session-csrf.service';

describe('AuthController response modes', () => {
  const session = {
    user: { id: 'user-1', email: 'admin@example.com' },
    tokens: { accessToken: 'access', refreshToken: 'refresh' },
  };
  const service = {
    login: jest.fn().mockResolvedValue(session),
    registerAdmin: jest.fn().mockResolvedValue(session),
    refreshSession: jest.fn().mockResolvedValue(session),
    logout: jest.fn(),
  } as unknown as AuthService;
  const csrf = { tokenFor: jest.fn().mockReturnValue('csrf') } as unknown as SessionCsrfService;
  const config = { getOrThrow: jest.fn().mockReturnValue({ authLegacyStartedAt: null }) } as unknown as ConfigService;
  const controller = new AuthController(service, csrf, config);
  const res = { cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn() } as unknown as Response;
  const req = (mode?: string, cookies: Record<string, string> = {}) => ({
    header: (name: string) => name === 'x-auth-mode' ? mode : undefined,
    cookies,
  }) as unknown as Request;

  beforeEach(() => { jest.clearAllMocks(); });

  it('returns only user and HttpOnly cookies in cookie mode', async () => {
    await expect(controller.login({ email: 'admin@example.com', password: 'secret' }, req('cookie'), res))
      .resolves.toEqual({ user: session.user });
    expect(res.cookie).toHaveBeenCalledWith('refreshToken', 'refresh', expect.objectContaining({
      httpOnly: true, path: '/', sameSite: 'strict',
    }));
    await expect(controller.refresh({}, req('cookie', { refreshToken: 'old' }), res))
      .resolves.toEqual({ user: session.user });
    expect(service.refreshSession).toHaveBeenCalledWith('old');
  });

  it('keeps explicit Bearer free of response cookies', async () => {
    await expect(controller.login({ email: 'admin@example.com', password: 'secret' }, req('bearer'), res))
      .resolves.toEqual(session);
    expect(res.cookie).not.toHaveBeenCalled();
  });

  it('closes the implicit legacy mode after 30 days while preserving explicit Bearer', async () => {
    (config.getOrThrow as jest.Mock).mockReturnValueOnce({ authLegacyStartedAt: '2026-08-01T00:00:00Z' });
    await expect(controller.login({ email: 'admin@example.com', password: 'secret' }, req(), res))
      .rejects.toThrow('Legacy session migration window closed');
    await expect(controller.login({ email: 'admin@example.com', password: 'secret' }, req('bearer'), res))
      .resolves.toEqual(session);
  });

  it('clears cookies with their creation attributes on logout', async () => {
    await controller.logout({}, req('cookie', { refreshToken: 'old' }), res);
    expect(service.logout).toHaveBeenCalledWith('old');
    expect(res.clearCookie).toHaveBeenCalledWith('accessToken', expect.objectContaining({
      httpOnly: true, path: '/', sameSite: 'strict',
    }));
  });
});
