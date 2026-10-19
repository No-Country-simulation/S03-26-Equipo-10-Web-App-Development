import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import WebhooksPage from './webhooks-screen';
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { id: 'admin', tenantId: 'tenant', roles: ['admin'] } },
    fetchApi,
  }),
}));
const date = '2026-10-18T00:00:00Z';
const a = {
  id: 'a',
  tenantId: 'tenant',
  url: 'https://a.example.invalid/hooks',
  eventCode: 'testimonial.published',
  isActive: true,
  createdAt: date,
  updatedAt: date,
  deletedAt: null,
  hasSignature: true,
  signatureGraceUntil: null,
};
const b = {
  ...a,
  id: 'b',
  url: 'https://b.example.invalid/hooks',
  eventCode: 'testimonial.created',
};
const dead = {
  id: 'delivery',
  webhookId: 'a',
  outboxEventId: 'event',
  status: 'dead',
  attempts: 2,
  responseCode: 503,
  errorMessage: 'Synthetic receiver unavailable',
  createdAt: date,
  updatedAt: date,
  attemptHistory: [
    {
      attemptNo: 2,
      status: 'failed',
      responseCode: 503,
      errorMessage: 'Synthetic receiver unavailable',
      startedAt: date,
      completedAt: date,
    },
  ],
};
const envelope = (data: unknown, total?: number, page = 1) => ({
  success: true,
  data,
  ...(total === undefined ? {} : { meta: { page, limit: 20, total } }),
});
const displayOnly = 'synthetic-display-only';
beforeEach(() => {
  fetchApi.mockReset();
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path === '/webhooks?page=1&limit=20') return envelope([a, b], 2);
    if (path.includes('/deliveries?'))
      return envelope(
        path.includes('/a/')
          ? [dead]
          : [{ ...dead, id: 'delivery-b', webhookId: 'b' }],
        21,
        Number(
          new URL(path, 'https://example.invalid').searchParams.get('page'),
        ),
      );
    if (path.endsWith('/rotate-secret'))
      return envelope({ ...a, signingSecret: displayOnly });
    if (path.endsWith('/test'))
      return envelope({ id: 'event', status: 'accepted' });
    if (path.endsWith('/replay'))
      return envelope({ id: 'delivery', status: 'pending' });
    if (init?.method === 'PATCH')
      return envelope({ ...a, ...JSON.parse(String(init.body)) });
    throw new Error('Unexpected request');
  });
});
async function setup() {
  const user = userEvent.setup();
  render(<WebhooksPage />);
  await screen.findByRole('region', { name: 'Tabla de webhooks' });
  return user;
}
function webhookRow(target = a) {
  return screen
    .getAllByRole('row')
    .find((el) => el.textContent?.includes(target.url))!;
}
it('no superpone pruebas del mismo destino y deja operar otro destino', async () => {
  await setup();
  let resolve!: (value: unknown) => void;
  fetchApi.mockImplementation((path: string) =>
    path.endsWith('/test')
      ? new Promise((r) => {
          resolve = r;
        })
      : Promise.resolve(envelope([a, b], 2)),
  );
  const first = screen.getByRole('button', { name: `Probar webhook ${a.url}` });
  fireEvent.click(first);
  fireEvent.click(first);
  expect(
    fetchApi.mock.calls.filter(([path]) => path === '/webhooks/a/test'),
  ).toHaveLength(1);
  expect(
    screen.getByRole('button', { name: `Probar webhook ${b.url}` }),
  ).not.toBeDisabled();
  await act(async () => resolve(envelope({ id: 'event', status: 'accepted' })));
  expect(await screen.findByText(/Prueba encolada/)).toHaveTextContent(
    /a.example.invalid/,
  );
});
it('actualizar el historial conserva destino y página', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Historial' }),
  );
  const history = await screen.findByRole('region', {
    name: 'Historial de entregas',
  });
  await user.click(within(history).getByRole('button', { name: 'Siguiente' }));
  await within(history).findByText('Página 2 de 2 · 21 registros');
  await user.click(within(history).getByRole('button', { name: /Actualizar/ }));
  await waitFor(() =>
    expect(fetchApi.mock.calls.at(-1)?.[0]).toBe(
      '/webhooks/a/deliveries?page=2&limit=20',
    ),
  );
});
it('la revelación identifica URL y evento y el secreto no forma parte de un anuncio', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Rotar secreto',
    }),
  );
  const value = await screen.findByText(displayOnly);
  const region = value.closest('section') ?? value.closest('[role="status"]')!;
  expect(region).toHaveTextContent(a.url);
  expect(region).toHaveTextContent('Testimonio publicado');
  for (const status of screen.getAllByRole('status'))
    expect(status).not.toHaveTextContent(displayOnly);
});
it('expone estados traducidos e intentos mediante expansión accesible', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Historial' }),
  );
  const history = await screen.findByRole('region', {
    name: 'Historial de entregas',
  });
  expect(await within(history).findByText('Sin entrega')).toBeInTheDocument();
  await user.click(within(history).getByText(/Ver intentos/));
  expect(within(history).getByText('Fallido')).toBeVisible();
  expect(
    within(history).getByText('Synthetic receiver unavailable'),
  ).toBeVisible();
});
it('una respuesta tardía de reenvío no cambia el historial elegido después', async () => {
  const user = await setup();
  let resolve!: (value: unknown) => void;
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Historial' }),
  );
  await screen.findByText('Página 1 de 2 · 21 registros');
  const original = fetchApi.getMockImplementation()!;
  fetchApi.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith('/replay')
      ? new Promise((r) => {
          resolve = r;
        })
      : original(path, init),
  );
  await user.click(
    within(
      screen.getByRole('region', { name: 'Historial de entregas' }),
    ).getByRole('button', { name: 'Reenviar' }),
  );
  // A confirmation is optional in this scenario; confirm if the UI protects replay.
  if (screen.queryByRole('alertdialog'))
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Reenviar entrega',
      }),
    );
  await user.click(
    within(webhookRow(b)).getByRole('button', { name: 'Historial' }),
  );
  await waitFor(() =>
    expect(
      fetchApi.mock.calls.some(([path]) =>
        path.startsWith('/webhooks/b/deliveries'),
      ),
    ).toBe(true),
  );
  const prior = fetchApi.mock.calls.filter(([path]) =>
    path.startsWith('/webhooks/a/deliveries?'),
  ).length;
  await act(async () =>
    resolve(envelope({ id: 'delivery', status: 'pending' })),
  );
  expect(
    fetchApi.mock.calls.filter(([path]) =>
      path.startsWith('/webhooks/a/deliveries?'),
    ),
  ).toHaveLength(prior);
});
it('integra edición HTTPS y conserva el formulario si PATCH falla', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Editar' }),
  );
  const url = screen.getByLabelText('URL de destino');
  await user.clear(url);
  await user.type(url, 'https://new.example.invalid/hooks');
  fetchApi.mockRejectedValueOnce(new ApiError('Conflict', 'CONFLICT', 409));
  await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/conflicto/);
  expect(url).toHaveValue('https://new.example.invalid/hooks');
});

it('pausa y reactiva sólo después de confirmar, mediante PATCH y sin cambiar URL/evento', async () => {
  const user = await setup();
  const original = fetchApi.getMockImplementation()!;
  let current = { ...a };
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      current = { ...current, ...JSON.parse(String(init.body)) };
      return envelope(current);
    }
    if (path === '/webhooks?page=1&limit=20') return envelope([current, b], 2);
    return original(path, init);
  });
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Pausar' }),
  );
  expect(screen.getByRole('alertdialog')).toHaveTextContent(
    'ya encoladas pueden continuar',
  );
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(fetchApi.mock.calls.some(([, init]) => init?.method === 'PATCH')).toBe(
    false,
  );
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Pausar' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Pausar webhook',
    }),
  );
  await waitFor(() =>
    expect(
      within(webhookRow()).getByRole('button', { name: 'Reactivar' }),
    ).toBeEnabled(),
  );
  expect(
    within(webhookRow()).getByRole('button', {
      name: `Probar webhook ${a.url}`,
    }),
  ).toBeDisabled();
  expect(
    JSON.parse(
      fetchApi.mock.calls.find(([, init]) => init?.method === 'PATCH')![1].body,
    ),
  ).toEqual({ isActive: false });
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Reactivar' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Reactivar webhook',
    }),
  );
  await waitFor(() =>
    expect(
      within(webhookRow()).getByRole('button', { name: 'Pausar' }),
    ).toBeEnabled(),
  );
});
it('gracia vigente bloquea otra rotación y un destino legado bloqueado exige reparar HTTPS/firma antes de reactivar', async () => {
  fetchApi.mockResolvedValue(
    envelope(
      [
        { ...a, signatureGraceUntil: '2099-10-20T15:32:45.123Z' },
        {
          ...b,
          isActive: false,
          hasSignature: false,
          legacyHttp: { deadlineAt: date, canDeliver: false },
          legacyUnsigned: { deadlineAt: date, canDeliver: false },
        },
      ],
      2,
    ),
  );
  await setup();
  expect(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  ).toBeDisabled();
  expect(
    within(webhookRow(b)).getByRole('button', { name: 'Reactivar' }),
  ).toBeDisabled();
  expect(
    within(webhookRow(b)).getByRole('button', { name: 'Editar' }),
  ).toBeEnabled();
  expect(
    within(webhookRow(b)).getByRole('button', { name: 'Rotar secreto' }),
  ).toBeEnabled();
  expect(within(webhookRow(b)).getByText(/editá la URL/)).toBeInTheDocument();
  expect(
    within(webhookRow(b)).getByText(/rotá el secreto antes/),
  ).toBeInTheDocument();
});
it('un 409 de rotación conserva el contexto y explica actualizar/gracia sin anunciar éxito', async () => {
  const user = await setup();
  fetchApi.mockRejectedValueOnce(new ApiError('Conflict', 'CONFLICT', 409));
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  const dialog = screen.getByRole('alertdialog');
  await user.click(
    within(dialog).getByRole('button', { name: 'Rotar secreto' }),
  );
  expect(await within(dialog).findByRole('alert')).toHaveTextContent(
    /conflicto/,
  );
  expect(dialog).toHaveTextContent(a.url);
  expect(dialog).toHaveTextContent('gracia');
  expect(
    screen.queryByLabelText('Secreto completo para copiar'),
  ).not.toBeInTheDocument();
});
it('la copia manual conserva el secreto y ocultarlo exige una decisión explícita', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Rotar secreto',
    }),
  );
  const field = await screen.findByLabelText('Secreto completo para copiar');
  vi.spyOn(navigator.clipboard, 'writeText').mockRejectedValue(
    new Error('Denied'),
  );
  await user.click(
    screen.getByRole('button', { name: 'Copiar secreto de firma' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent('Ctrl/Cmd+C');
  expect(field).toHaveFocus();
  expect((field as HTMLTextAreaElement).selectionEnd).toBe(displayOnly.length);
  await user.click(screen.getByRole('button', { name: 'Ocultar secreto' }));
  await user.keyboard('{Escape}');
  expect(field).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ocultar secreto' }));
  await user.click(
    screen.getByRole('button', { name: 'Ya lo guardé, ocultar' }),
  );
  await waitFor(() =>
    expect(
      screen.queryByLabelText('Secreto completo para copiar'),
    ).not.toBeInTheDocument(),
  );
});
it('una generación posterior fallida conserva el secreto anterior y los datos del formulario', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Rotar secreto',
    }),
  );
  await screen.findByLabelText('Secreto completo para copiar');
  await user.click(screen.getByRole('button', { name: 'Nuevo webhook' }));
  await user.type(
    screen.getByLabelText('URL de destino'),
    'https://new.example.invalid/events',
  );
  fetchApi.mockRejectedValueOnce(new Error('Unavailable'));
  await user.click(screen.getByRole('button', { name: 'Crear webhook' }));
  await user.click(screen.getByRole('button', { name: 'Crear y reemplazar' }));
  await within(screen.getByRole('alertdialog')).findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  expect(screen.getByLabelText('Secreto completo para copiar')).toHaveValue(
    displayOnly,
  );
  expect(screen.getByLabelText('URL de destino')).toHaveValue(
    'https://new.example.invalid/events',
  );
});
it('una respuesta de historial obsoleta no cambia la selección más reciente', async () => {
  const user = await setup();
  let resolve!: (value: unknown) => void;
  const original = fetchApi.getMockImplementation()!;
  fetchApi.mockImplementation((path: string, init?: RequestInit) =>
    path.startsWith('/webhooks/a/deliveries?')
      ? new Promise((r) => {
          resolve = r;
        })
      : original(path, init),
  );
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Historial' }),
  );
  await user.click(
    within(webhookRow(b)).getByRole('button', { name: 'Historial' }),
  );
  const region = screen.getByRole('region', { name: 'Historial de entregas' });
  await within(region).findByText(/delivery-b/);
  await act(async () => resolve(envelope([dead], 1)));
  expect(region).toHaveTextContent(b.url);
  expect(region).toHaveTextContent('delivery-b');
  expect(region).not.toHaveTextContent('Entrega: delivery ·');
});

it('la rotación bloquea los controles del destino y no se duplica mientras espera', async () => {
  const user = await setup();
  let resolve!: (value: unknown) => void;
  const edit = within(webhookRow()).getByRole('button', { name: 'Editar' });
  const original = fetchApi.getMockImplementation()!;
  fetchApi.mockImplementation((path: string, init?: RequestInit) =>
    path.endsWith('/rotate-secret')
      ? new Promise((r) => {
          resolve = r;
        })
      : original(path, init),
  );
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  const dialog = screen.getByRole('alertdialog'),
    confirm = within(dialog).getByRole('button', { name: 'Rotar secreto' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  expect(
    fetchApi.mock.calls.filter(([path]) => path.endsWith('/rotate-secret')),
  ).toHaveLength(1);
  expect(edit).toBeDisabled();
  expect(
    within(dialog).getByRole('button', { name: 'Cancelar' }),
  ).toBeDisabled();
  await act(async () =>
    resolve(envelope({ ...a, signingSecret: displayOnly })),
  );
  expect(
    await screen.findByLabelText('Secreto completo para copiar'),
  ).toHaveValue(displayOnly);
});

it('anuncia una copia correcta sin incluir el secreto en el anuncio', async () => {
  const user = await setup();
  await user.click(
    within(webhookRow()).getByRole('button', { name: 'Rotar secreto' }),
  );
  await user.click(
    within(screen.getByRole('alertdialog')).getByRole('button', {
      name: 'Rotar secreto',
    }),
  );
  await screen.findByLabelText('Secreto completo para copiar');
  const copy = vi
    .spyOn(navigator.clipboard, 'writeText')
    .mockResolvedValue(undefined);
  await user.click(
    screen.getByRole('button', { name: 'Copiar secreto de firma' }),
  );
  expect(
    await screen.findByText('Secreto copiado al portapapeles.'),
  ).toHaveAttribute('role', 'status');
  expect(copy).toHaveBeenCalledWith(displayOnly);
  for (const status of screen.getAllByRole('status'))
    expect(status).not.toHaveTextContent(displayOnly);
});
