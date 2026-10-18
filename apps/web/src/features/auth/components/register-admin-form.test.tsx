import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { RegisterAdminForm } from './register-admin-form';

describe('RegisterAdminForm', () => {
  it('starts every field empty and prevents accidental registration', async () => {
    const user = userEvent.setup(),
      onSubmit = vi.fn();
    render(<RegisterAdminForm onSubmit={onSubmit} />);
    for (const input of document.querySelectorAll('input'))
      expect(input).toHaveValue('');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('explains and validates the actual password requirements before sending', async () => {
    const user = userEvent.setup(),
      onSubmit = vi.fn();
    render(<RegisterAdminForm onSubmit={onSubmit} />);
    expect(screen.getByText(/8 a 72 caracteres/)).toBeInTheDocument();
    await user.type(screen.getByLabelText(/nombre/i), 'Estudio sintético');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'short');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      /mayúscula.*minúscula.*número/,
    );
  });
  it('preserves a complete draft on conflict and sends only one request per attempt', async () => {
    const user = userEvent.setup(),
      onSubmit = vi
        .fn()
        .mockRejectedValueOnce(new ApiError('Already exists', 'CONFLICT', 409))
        .mockResolvedValue(undefined);
    render(<RegisterAdminForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Estudio sintético');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'Synthetic8!');
    await user.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El nombre del espacio o el email ya está en uso',
    );
    expect(screen.getByLabelText(/nombre/i)).toHaveValue('Estudio sintético');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('Synthetic8!');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenLastCalledWith({
      tenantName: 'Estudio sintético',
      email: 'admin@example.invalid',
      password: 'Synthetic8!',
    });
  });
  it('blocks parallel registration and suggests checking login after an uncertain result', async () => {
    let fail!: (error: unknown) => void;
    const user = userEvent.setup(),
      onSubmit = vi.fn().mockImplementation(
        () =>
          new Promise<void>((_resolve, reject) => {
            fail = reject;
          }),
      );
    render(<RegisterAdminForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText(/nombre/i), 'Estudio sintético');
    await user.type(screen.getByLabelText(/email/i), 'admin@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'Synthetic8!');
    const form = screen.getByLabelText(/nombre/i).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => {
      fail(new Error('Synthetic network failure'));
    });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Probá ingresar',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('Synthetic8!');
  });
});
