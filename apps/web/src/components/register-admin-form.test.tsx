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

    await user.clear(screen.getByLabelText(/tenant/i));
    await user.type(screen.getByLabelText(/tenant/i), 'North Studio');
    await user.clear(screen.getByLabelText(/email admin/i));
    await user.type(screen.getByLabelText(/email admin/i), 'admin@north.com');
    await user.clear(screen.getByLabelText(/password/i));
    await user.type(screen.getByLabelText(/password/i), 'Admin123!');
    await user.click(screen.getByRole('button', { name: /crear tenant y admin/i }));

    expect(onSubmit).toHaveBeenCalledWith({
      tenantName: 'North Studio',
      email: 'admin@north.com',
      password: 'Admin123!',
    });
  });
});
