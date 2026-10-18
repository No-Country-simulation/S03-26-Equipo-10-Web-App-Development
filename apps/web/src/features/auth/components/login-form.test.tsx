import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { LoginForm } from './login-form';

async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByLabelText('Email', { selector: 'input' }),
    'editor@example.invalid',
  );
  await user.type(
    screen.getByLabelText('Contraseña', { selector: 'input' }),
    'Synthetic8!',
  );
}
describe('LoginForm', () => {
  it('starts empty and never submits example credentials by omission', async () => {
    const user = userEvent.setup(),
      onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    expect(screen.getByLabelText('Email')).toHaveValue('');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('submits deliberately entered credentials without applying new-password policy to login', async () => {
    const user = userEvent.setup(),
      onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<LoginForm onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Email'), 'editor@example.invalid');
    await user.type(screen.getByLabelText('Contraseña'), 'legacy');
    await user.click(screen.getByRole('button'));
    expect(onSubmit).toHaveBeenCalledWith({
      email: 'editor@example.invalid',
      password: 'legacy',
    });
  });
  it('associates validation with fields and focuses the first invalid field', async () => {
    const user = userEvent.setup(),
      onSubmit = vi.fn();
    render(<LoginForm onSubmit={onSubmit} />);
    await user.click(screen.getByRole('button'));
    const email = screen.getByLabelText('Email');
    expect(email).toHaveAttribute('aria-invalid', 'true');
    expect(email).toHaveAccessibleDescription(/Ingresá un email válido/);
    await waitFor(() => expect(email).toHaveFocus());
    expect(onSubmit).not.toHaveBeenCalled();
  });
  it('preserves both values and explains a rejected login in Spanish', async () => {
    const user = userEvent.setup(),
      onSubmit = vi
        .fn()
        .mockRejectedValue(
          new ApiError('Invalid credentials', 'UNAUTHORIZED', 401),
        );
    render(<LoginForm onSubmit={onSubmit} />);
    await fill(user);
    await user.click(screen.getByRole('button'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Revisá tu email y contraseña',
    );
    expect(screen.getByLabelText('Email')).toHaveValue(
      'editor@example.invalid',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveValue('Synthetic8!');
    expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
      /Revisá tu email y contraseña/,
    );
  });
  it('blocks repeated submits while waiting and after a confirmed login awaits navigation', async () => {
    let finish!: () => void;
    const user = userEvent.setup(),
      onSubmit = vi.fn().mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      );
    render(<LoginForm onSubmit={onSubmit} />);
    await fill(user);
    const form = screen.getByLabelText('Email').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText('Email')).toHaveAttribute('readonly');
    await act(async () => {
      finish();
    });
    fireEvent.submit(form);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toHaveTextContent('Abriendo el panel');
  });
});
