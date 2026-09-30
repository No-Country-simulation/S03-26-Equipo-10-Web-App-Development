import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RegisterAdminForm } from './register-admin-form';

describe('RegisterAdminForm', () => {
  it('submits tenant and admin credentials', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<RegisterAdminForm onSubmit={onSubmit} />);

    await user.clear(screen.getByLabelText(/nombre del tenant/i));
    await user.type(screen.getByLabelText(/nombre del tenant/i), 'North Studio');
    await user.clear(screen.getByLabelText(/email administrativo/i));
    await user.type(screen.getByLabelText(/email administrativo/i), 'admin@north.com');
    await user.clear(screen.getByLabelText(/contraseña/i));
    await user.type(screen.getByLabelText(/contraseña/i), 'Admin123!');
    await user.click(screen.getByRole('button', { name: /crear tenant y admin/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      tenantName: 'North Studio',
      email: 'admin@north.com',
      password: 'Admin123!',
    });
  });
});
