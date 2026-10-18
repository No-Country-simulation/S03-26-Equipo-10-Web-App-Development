import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import UsersPage from './users-screen';
const { fetchApi, identity } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  identity: { id: 'self', roles: ['admin'] },
}));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session: { user: identity }, fetchApi }),
}));
const record = {
  id: 'other',
  tenantId: 'tenant',
  email: 'editor@example.invalid',
  roles: ['editor'],
  isActive: true,
  createdAt: '2026-10-17',
  updatedAt: '2026-10-17',
};
beforeEach(() => {
  identity.roles = ['admin'];
  fetchApi.mockReset();
  fetchApi.mockResolvedValue({
    success: true,
    data: [record, { ...record, id: 'self', email: 'self@example.invalid' }],
    meta: { page: 1, limit: 20, total: 2 },
  });
});
it('explica creación directa y contraseña antes de enviar', async () => {
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Nuevo usuario/i }));
  expect(
    screen.queryByRole('button', { name: 'Invitar' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Crear usuario' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/No se envía una invitación/)).toBeInTheDocument();
  expect(screen.getByText(/8 a 72 caracteres/)).toBeInTheDocument();
});
it('confirma desactivación de otra cuenta sin ofrecerla para la propia', async () => {
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) =>
    init?.method === 'PATCH'
      ? { success: true, data: { ...record, isActive: false } }
      : {
          success: true,
          data: [
            record,
            { ...record, id: 'self', email: 'self@example.invalid' },
          ],
          meta: { page: 1, limit: 20, total: 2 },
        },
  );
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Desactivar usuario editor@example.invalid',
    }),
  );
  const dialog = screen.getByRole('alertdialog');
  expect(dialog).toHaveTextContent('editor@example.invalid');
  await user.click(
    within(dialog).getByRole('button', { name: 'Desactivar usuario' }),
  );
  await waitFor(() =>
    expect(fetchApi).toHaveBeenCalledWith(
      '/users/other',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      }),
    ),
  );
  expect(
    screen.queryByRole('button', {
      name: 'Desactivar usuario self@example.invalid',
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: 'Eliminar usuario self@example.invalid',
    }),
  ).not.toBeInTheDocument();
});

it('un editor no consulta usuarios ni recibe controles administrativos', () => {
  identity.roles = ['editor'];
  render(<UsersPage />);
  expect(screen.getByRole('alert')).toHaveTextContent('Acceso denegado');
  expect(fetchApi).not.toHaveBeenCalled();
});
it('conserva datos y contraseña en memoria ante un error de creación', async () => {
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'POST') throw new Error('network');
    return {
      success: true,
      data: [record],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
  const password = `A${'b'.repeat(6)}7!`;
  await user.type(screen.getByLabelText('Email'), 'new@example.invalid');
  await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No pudimos confirmar',
  );
  expect(screen.getByLabelText('Email')).toHaveValue('new@example.invalid');
  expect(screen.getByLabelText('Contraseña')).toHaveValue(password);
});
it('permite cancelar y confirmar la activación de una cuenta desactivada', async () => {
  let active = false;
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      active = true;
      return { success: true, data: { ...record, isActive: active } };
    }
    return {
      success: true,
      data: [{ ...record, isActive: active }],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Activar usuario editor@example.invalid',
    }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Cancelar',
    }),
  );
  expect(fetchApi.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
    false,
  );
  await user.click(
    screen.getByRole('button', {
      name: 'Activar usuario editor@example.invalid',
    }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Activar usuario',
    }),
  );
  expect(
    await screen.findByRole('button', {
      name: 'Desactivar usuario editor@example.invalid',
    }),
  ).toBeInTheDocument();
});
it('regresa a una página válida tras eliminar el último usuario de la página', async () => {
  let removed = false;
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      removed = true;
      return { success: true, data: { id: record.id, deleted: true } };
    }
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page'),
    );
    return {
      success: true,
      data:
        page === 2
          ? removed
            ? []
            : [record]
          : [{ ...record, id: 'self', email: 'self@example.invalid' }],
      meta: { page, limit: 20, total: removed ? 20 : 21 },
    };
  });
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
  await user.click(
    await screen.findByRole('button', {
      name: 'Eliminar usuario editor@example.invalid',
    }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Eliminar usuario',
    }),
  );
  expect(
    await screen.findByText('Página 1 de 1 · 20 registros'),
  ).toBeInTheDocument();
});

it('vuelve a la primera página después de crear una cuenta', async () => {
  let created = false;
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      created = true;
      return {
        success: true,
        data: { ...record, id: 'new', email: 'new@example.invalid' },
      };
    }
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page'),
    );
    return {
      success: true,
      data: [
        {
          ...record,
          id: created ? 'new' : page === 1 ? 'self' : 'other',
          email: created ? 'new@example.invalid' : record.email,
        },
      ],
      meta: { page, limit: 20, total: created ? 22 : 21 },
    };
  });
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 2 de 2 · 21 registros');
  await user.click(screen.getByRole('button', { name: 'Nuevo usuario' }));
  await user.type(screen.getByLabelText('Email'), 'new@example.invalid');
  await user.type(screen.getByLabelText('Contraseña'), `A${'b'.repeat(6)}7!`);
  await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
  expect(
    await screen.findByText('Página 1 de 2 · 22 registros'),
  ).toBeInTheDocument();
  expect(
    screen.getByText('new@example.invalid', { exact: true }),
  ).toBeInTheDocument();
});

it('explica que una cuenta con historial puede desactivarse y no anuncia eliminación', async () => {
  const { ApiError } = await import('@/lib/api');
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'DELETE')
      throw new ApiError('history', 'USER_HAS_HISTORY', 409);
    return {
      success: true,
      data: [record],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<UsersPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Eliminar usuario editor@example.invalid',
    }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Eliminar usuario',
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Podés desactivarla',
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Cancelar',
    }),
  );
  expect(
    screen.getByRole('button', {
      name: 'Desactivar usuario editor@example.invalid',
    }),
  ).toBeInTheDocument();
  expect(screen.queryByText('Usuario eliminado.')).not.toBeInTheDocument();
});
