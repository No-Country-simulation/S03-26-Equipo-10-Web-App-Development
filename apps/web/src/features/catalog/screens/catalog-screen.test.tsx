import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import CategoriesPage from './categories-screen';
import TagsPage from './tags-screen';
const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { id: 'admin', roles: ['admin'] } },
    fetchApi,
  }),
}));
beforeEach(() => {
  fetchApi.mockReset();
});
it.each([
  ['categories', CategoriesPage, 'categoría'],
  ['tags', TagsPage, 'etiqueta'],
] as const)(
  'confirma la eliminación de %s explicando el efecto sobre los testimonios',
  async (kind, Screen, singular) => {
    fetchApi.mockResolvedValue({
      success: true,
      data: [
        {
          id: 'item',
          tenantId: 'tenant',
          name: 'Clasificación sintética',
          testimonialCount: 27,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    });
    render(<Screen />);
    const user = userEvent.setup();
    await user.click(
      await screen.findByRole('button', {
        name: `Eliminar ${singular} Clasificación sintética`,
      }),
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('27');
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Los testimonios se conservan',
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    );
    expect(
      fetchApi.mock.calls.some(([, init]) => init?.method === 'DELETE'),
    ).toBe(false);
  },
);
it('busca en el servidor y permite renombrar conservando el borrador ante un error', async () => {
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') throw new Error('network');
    return {
      success: true,
      data: [
        {
          id: 'item',
          tenantId: 'tenant',
          name: 'Nombre inicial',
          testimonialCount: 8,
        },
      ],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<CategoriesPage />);
  const user = userEvent.setup();
  await user.type(
    await screen.findByLabelText('Buscar categorías'),
    'distante{Enter}',
  );
  await waitFor(() =>
    expect(
      fetchApi.mock.calls.some(([path]) => path.includes('q=distante')),
    ).toBe(true),
  );
  await user.click(
    screen.getByRole('button', { name: 'Renombrar categoría Nombre inicial' }),
  );
  const input = screen.getByLabelText('Nombre');
  await user.clear(input);
  await user.type(input, 'Nuevo nombre');
  await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No pudimos confirmar',
  );
  expect(input).toHaveValue('Nuevo nombre');
});

it.each([
  ['categories', CategoriesPage, 'categoría'],
  ['tags', TagsPage, 'etiqueta'],
] as const)(
  'corrige la última página de %s después de eliminar, conservando los testimonios',
  async (kind, Screen, singular) => {
    let removed = false;
    const item = {
      id: 'last',
      tenantId: 'tenant',
      name: 'Última clasificación',
      testimonialCount: 1,
    };
    fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'DELETE') {
        removed = true;
        return { success: true, data: { id: 'last', deleted: true } };
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
              : [item]
            : Array.from({ length: 20 }, (_, index) => ({
                ...item,
                id: `item-${index}`,
                name: `Clasificación ${index}`,
              })),
        meta: { page, limit: 20, total: removed ? 20 : 21 },
      };
    });
    render(<Screen />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
    await user.click(
      await screen.findByRole('button', {
        name: `Eliminar ${singular} Última clasificación`,
      }),
    );
    await user.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: `Eliminar ${singular}`,
      }),
    );
    expect(
      await screen.findByText('Página 1 de 1 · 20 registros'),
    ).toBeInTheDocument();
    expect(
      fetchApi.mock.calls.filter(([, init]) => init?.method === 'DELETE'),
    ).toHaveLength(1);
  },
);
it('renombra una etiqueta y conserva la cantidad de asociaciones', async () => {
  let name = 'Nombre inicial';
  fetchApi.mockImplementation(async (_path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH') {
      name = JSON.parse(String(init.body)).name;
      return { success: true, data: { id: 'item', tenantId: 'tenant', name } };
    }
    return {
      success: true,
      data: [{ id: 'item', tenantId: 'tenant', name, testimonialCount: 12 }],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<TagsPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Renombrar etiqueta Nombre inicial',
    }),
  );
  const input = screen.getByLabelText('Nombre');
  await user.clear(input);
  await user.type(input, 'Nombre nuevo');
  await user.click(screen.getByRole('button', { name: 'Guardar nombre' }));
  expect(
    await screen.findByRole('heading', { name: 'Nombre nuevo' }),
  ).toBeInTheDocument();
  expect(screen.getByText('12 testimonios asociados')).toBeInTheDocument();
  expect(fetchApi).toHaveBeenCalledWith(
    '/tags/item',
    expect.objectContaining({
      method: 'PATCH',
      body: JSON.stringify({ name: 'Nombre nuevo' }),
    }),
  );
});

it('vuelve a una página válida después de crear una categoría', async () => {
  let created = false;
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'POST') {
      created = true;
      return {
        success: true,
        data: { id: 'new', tenantId: 'tenant', name: 'A Nueva' },
      };
    }
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page'),
    );
    return {
      success: true,
      data: [
        {
          id: created ? 'new' : 'old',
          tenantId: 'tenant',
          name: created ? 'A Nueva' : 'Existente',
          testimonialCount: 0,
        },
      ],
      meta: { page, limit: 20, total: created ? 22 : 21 },
    };
  });
  render(<CategoriesPage />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: 'Siguiente' }));
  await screen.findByText('Página 2 de 2 · 21 registros');
  await user.click(screen.getByRole('button', { name: 'Nueva' }));
  await user.type(screen.getByLabelText('Nombre'), 'A Nueva');
  await user.click(screen.getByRole('button', { name: 'Crear' }));
  expect(
    await screen.findByText('Página 1 de 2 · 22 registros'),
  ).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'A Nueva' })).toBeInTheDocument();
});
