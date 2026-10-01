import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLoginPage from './login-screen';

const { login, clearLegacySession, push } = vi.hoisted(() => ({
  login: vi.fn(), clearLegacySession: vi.fn(), push: vi.fn(),
}));

vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../api', () => ({ login }));
vi.mock('@/lib/session-store', () => ({ clearLegacySession }));

describe('AdminLoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue({ user: { id: 'one' } });
  });

  it('navigates after cookie login without storing tokens', async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);

    await user.click(screen.getByRole('button', { name: 'Iniciar Sesión' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'admin@demo.com', password: 'Admin123!' }));
    expect(clearLegacySession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/admin');
  });
});
