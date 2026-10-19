import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import ApiKeysPage from './api-keys-screen';

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { id: 'admin', roles: ['admin'] } },
    fetchApi,
  }),
}));
const key = {
  id: 'synthetic-key',
  tenantId: 'synthetic',
  name: 'Integración de prueba',
  isActive: true,
  status: 'ACTIVE',
  publicId: 'public-id',
  scopes: ['testimonials:read'],
  legacy: false,
  expiresAt: '2099-10-20T15:32:45.123Z',
  legacyDeadline: null,
  lastUsedAt: null,
  createdAt: '2026-10-15T00:00:00Z',
  updatedAt: '2026-10-15T00:00:00Z',
};
// Deliberately not a usable credential or a credential-shaped fixture.
const revelation = 'synthetic-display-only';
beforeEach(() => {
  fetchApi.mockReset();
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? {
          success: true,
          data: { id: key.id, name: key.name, apiKey: revelation },
        }
      : { success: true, data: [key], meta: { page: 1, limit: 20, total: 1 } },
  );
});
async function openRotation() {
  const user = userEvent.setup();
  render(<ApiKeysPage />);
  await user.click(await screen.findByRole('button', { name: 'Rotar' }));
  return user;
}
it('preserva segundos y milisegundos omitiendo el vencimiento que no se editó', async () => {
  const user = await openRotation();
  await user.click(screen.getByRole('button', { name: /Rotar API [Kk]ey/ }));
  await waitFor(() =>
    expect(
      fetchApi.mock.calls.some(([, init]) => init?.method === 'POST'),
    ).toBe(true),
  );
  const [, init] = fetchApi.mock.calls.find(
    ([, init]) => init?.method === 'POST',
  )!;
  expect(JSON.parse(init.body)).not.toHaveProperty('expiresAt');
});
it('distingue vencimiento y revocación y no ofrece rotar una clave vencida', async () => {
  fetchApi.mockResolvedValue({
    success: true,
    data: [{ ...key, status: 'EXPIRED', isActive: false }],
    meta: { page: 1, limit: 20, total: 1 },
  });
  render(<ApiKeysPage />);
  expect(await screen.findByText('Vencida')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Rotar' }),
  ).not.toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Crear reemplazo' }),
  ).toBeInTheDocument();
});
it('conserva la revelación vigente si una generación posterior falla', async () => {
  const user = await openRotation();
  await user.click(screen.getByRole('button', { name: /Rotar API [Kk]ey/ }));
  await screen.findByText(revelation);
  await user.click(
    screen.getByRole('button', { name: /Generar Token|Nueva API key/ }),
  );
  await user.type(
    screen.getByLabelText(/Nombre [Dd]escriptivo|Nombre de la integración/),
    'Segunda integración',
  );
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'POST') throw new Error('Unavailable');
    return {
      success: true,
      data: [key],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  await user.click(screen.getByRole('button', { name: /Crear API [Kk]ey/ }));
  expect(screen.getByText(revelation)).toBeInTheDocument();
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Generar y reemplazar',
    }),
  );
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByText(revelation)).toBeInTheDocument();
  expect(screen.getByLabelText(/Nombre de la integración/)).toHaveValue(
    'Segunda integración',
  );
});
it('bloquea dos envíos sin esperar al próximo render', async () => {
  await openRotation();
  fetchApi.mockImplementation((_path: string, init?: RequestInit) =>
    init?.method === 'POST'
      ? new Promise(() => {})
      : Promise.resolve({
          success: true,
          data: [key],
          meta: { page: 1, limit: 20, total: 1 },
        }),
  );
  const form = screen
    .getByRole('button', { name: /Rotar API [Kk]ey/ })
    .closest('form')!;
  fireEvent.submit(form);
  fireEvent.submit(form);
  expect(
    fetchApi.mock.calls.filter(([, init]) => init?.method === 'POST'),
  ).toHaveLength(1);
});
it('permite copia manual con foco y selección si clipboard falla; ocultar requiere confirmación', async () => {
  const user = await openRotation();
  await user.click(screen.getByRole('button', { name: 'Rotar API key' }));
  const field = await screen.findByLabelText('Clave completa para copiar');
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
    new Error('Denied'),
  );
  await user.click(screen.getByRole('button', { name: 'Copiar API key' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Ctrl/Cmd+C');
  expect(field).toHaveFocus();
  expect((field as HTMLTextAreaElement).selectionEnd).toBe(revelation.length);
  await user.click(screen.getByRole('button', { name: 'Ocultar API key' }));
  expect(screen.getByRole('alertdialog')).toHaveTextContent(key.name);
  await user.keyboard('{Escape}');
  expect(field).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ocultar API key' }));
  await user.click(
    screen.getByRole('button', { name: 'Ya la guardé, ocultar' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByLabelText('Clave completa para copiar'),
    ).not.toBeInTheDocument(),
  );
});
it('identifica la integración y explica los límites de la gracia, sin incluir secretos en anuncios', async () => {
  const user = await openRotation();
  expect(
    screen.getByRole('group', { name: `Rotar «${key.name}»` }),
  ).toHaveTextContent('hasta 24 horas');
  await user.click(screen.getByRole('button', { name: 'Rotar API key' }));
  expect(
    await screen.findByRole('heading', { name: `API key de «${key.name}»` }),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/La anterior conserva sus permisos/),
  ).toHaveTextContent('vencimiento previo');
  for (const status of screen.getAllByRole('status'))
    expect(status).not.toHaveTextContent(revelation);
  expect(JSON.stringify(window.history.state)).not.toContain(revelation);
  const event = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
});
it('conserva el nombre y muestra error sin revelación falsa cuando la rotación falla', async () => {
  const user = await openRotation();
  fetchApi.mockRejectedValueOnce(new Error('Conflict'));
  await user.click(screen.getByRole('button', { name: 'Rotar API key' }));
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.getByLabelText('Nombre de la integración')).toHaveValue(
    key.name,
  );
  expect(
    screen.queryByLabelText('Clave completa para copiar'),
  ).not.toBeInTheDocument();
});

it('intercepta navegación por enlaces y cancelar conserva la revelación', async () => {
  const user = userEvent.setup();
  render(
    <>
      <a href="/admin/users">Ir a usuarios</a>
      <ApiKeysPage />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: 'Rotar' }));
  await user.click(screen.getByRole('button', { name: 'Rotar API key' }));
  await screen.findByLabelText('Clave completa para copiar');
  const link = screen.getByRole('link', { name: 'Ir a usuarios' });
  expect(fireEvent.click(link)).toBe(false);
  expect(screen.getByRole('alertdialog')).toHaveTextContent(key.name);
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByLabelText('Clave completa para copiar')).toHaveValue(
    revelation,
  );
});

it('rotar una clave ya migrada conserva sus scopes aunque aún tenga hash legado durante la gracia', async () => {
  fetchApi.mockResolvedValue({
    success: true,
    data: [{ ...key, legacy: true }],
    meta: { page: 1, limit: 20, total: 1 },
  });
  await openRotation();
  expect(
    screen.getByRole('checkbox', { name: 'Leer testimonios publicados' }),
  ).toBeChecked();
  expect(
    screen.getByRole('checkbox', { name: 'Registrar vistas y clics' }),
  ).not.toBeChecked();
  expect(screen.queryByText(/Clave legada: migrá/)).not.toBeInTheDocument();
});

it('protege el cierre de sesión del shell hasta confirmar la pérdida de la revelación', async () => {
  const logout = vi.fn();
  const user = userEvent.setup();
  render(
    <>
      <button type="button" data-leaves-page onClick={logout}>
        Cerrar sesión
      </button>
      <ApiKeysPage />
    </>,
  );
  await user.click(await screen.findByRole('button', { name: 'Rotar' }));
  await user.click(screen.getByRole('button', { name: 'Rotar API key' }));
  await screen.findByLabelText('Clave completa para copiar');
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  expect(logout).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByLabelText('Clave completa para copiar')).toHaveValue(
    revelation,
  );
  await user.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
  await user.click(screen.getByRole('button', { name: 'Ocultar y salir' }));
  expect(logout).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByLabelText('Clave completa para copiar'),
  ).not.toBeInTheDocument();
});
