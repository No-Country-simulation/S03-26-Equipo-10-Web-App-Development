import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminLoginPage from './login-screen';
import AdminRegisterPage from './register-screen';

const { login, registerAdmin, clearLegacySession, push } = vi.hoisted(() => ({
  login: vi.fn(),
  registerAdmin: vi.fn(),
  clearLegacySession: vi.fn(),
  push: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('../api', () => ({ login, registerAdmin }));
vi.mock('@/lib/session-store', () => ({ clearLegacySession }));

describe('authentication screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    login.mockResolvedValue({ user: { id: 'synthetic' } });
    registerAdmin.mockResolvedValue({ user: { id: 'synthetic' } });
  });
  it.each([
    ['login', AdminLoginPage, 'Iniciar sesión'],
    ['register', AdminRegisterPage, 'Crear tu espacio'],
  ] as const)(
    '%s exposes one main, a task heading and a real return link without a demo',
    (_name, Page, heading) => {
      render(<Page />);
      expect(screen.getByRole('main')).toBeInTheDocument();
      expect(
        screen.getByRole('heading', { name: heading, level: 1 }),
      ).toBeVisible();
      expect(
        screen.getByRole('link', { name: 'Volver al inicio' }),
      ).toHaveAttribute('href', '/');
      expect(screen.queryByText(/demo|LLC/)).not.toBeInTheDocument();
    },
  );
  it('navigates after an explicit cookie login and clears only legacy storage', async () => {
    const user = userEvent.setup();
    render(<AdminLoginPage />);
    await user.type(screen.getByLabelText('Email'), 'editor@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'Synthetic8!');
    await user.click(screen.getByRole('button', { name: /iniciar sesión/i }));
    await waitFor(() =>
      expect(login).toHaveBeenCalledWith({
        email: 'editor@example.invalid',
        password: 'Synthetic8!',
      }),
    );
    expect(clearLegacySession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/admin');
  });
  it('opens the same panel after creating a workspace and administrator', async () => {
    const user = userEvent.setup();
    render(<AdminRegisterPage />);
    await user.type(screen.getByLabelText(/nombre/i), 'Espacio sintético');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'Synthetic8!');
    await user.click(
      screen.getByRole('button', { name: 'Crear espacio y cuenta' }),
    );
    await waitFor(() =>
      expect(registerAdmin).toHaveBeenCalledWith({
        tenantName: 'Espacio sintético',
        email: 'admin@example.invalid',
        password: 'Synthetic8!',
      }),
    );
    expect(clearLegacySession).toHaveBeenCalled();
    expect(push).toHaveBeenCalledWith('/admin');
  });
  it('does not navigate or clear session state when registration fails', async () => {
    registerAdmin.mockRejectedValue(new Error('Synthetic failure'));
    const user = userEvent.setup();
    render(<AdminRegisterPage />);
    await user.type(screen.getByLabelText(/nombre/i), 'Espacio sintético');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'Synthetic8!');
    await user.click(
      screen.getByRole('button', { name: 'Crear espacio y cuenta' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos confirmar',
    );
    expect(push).not.toHaveBeenCalled();
    expect(clearLegacySession).not.toHaveBeenCalled();
  });
});
