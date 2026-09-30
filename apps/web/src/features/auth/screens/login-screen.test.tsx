import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLoginPage from './login-screen';

const { login, saveSession, push } = vi.hoisted(() => ({
  login: vi.fn(), saveSession: vi.fn(), push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../api', () => ({ login }));
vi.mock('@/lib/session-store', () => ({ saveSession }));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue({ user: { id: 'one' }, tokens: { accessToken: 'token', refreshToken: 'refresh' } });
  });

  it('keeps login, session storage and dashboard navigation', async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'admin@demo.com', password: 'Admin123!' }));
    expect(saveSession).toHaveBeenCalledWith(expect.objectContaining({ tokens: expect.any(Object) }));
    expect(push).toHaveBeenCalledWith('/admin');
  });
});
