import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestimonialsScreen } from './testimonials-screen';
import { ApiError } from '@/lib/api';

const { fetchApi, session } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  session: {
    user: { id: 'admin', roles: ['admin'], email: 'admin@example.invalid' },
  },
}));

vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session, fetchApi, isAdmin: true }),
}));

const navigation = vi.hoisted(() => {
  const listeners = new Set<() => void>();
  const store = {
    url: '',
    listeners,
    move: vi.fn((href: string) => {
      store.url = href.split('?')[1] ?? '';
      for (const notify of listeners) notify();
    }),
  };
  return store;
});
vi.mock('next/navigation', async () => {
  const { useSyncExternalStore } = await import('react');
  const router = { push: navigation.move, replace: navigation.move };
  return {
    useRouter: () => router,
    useSearchParams: () =>
      new URLSearchParams(
        useSyncExternalStore(
          (notify: () => void) => {
            navigation.listeners.add(notify);
            return () => navigation.listeners.delete(notify);
          },
          () => navigation.url,
        ),
      ),
  };
});
beforeEach(() => {
  navigation.url = '';
  navigation.move.mockClear();
});

const records = [
  {
    id: '00000000-0000-4000-8000-000000000001',
    authorName: 'Ana',
    createdById: 'admin',
    content: 'Excelente servicio',
    rating: 5,
    status: 'draft',
    score: 0,
    createdAt: '2026-09-28',
  },
  {
    id: '00000000-0000-4000-8000-000000000002',
    authorName: 'Beto',
    createdById: null,
    content: 'Muy buena atención',
    rating: 4,
    status: 'pending',
    score: 0,
    createdAt: '2026-09-28',
  },
];

describe('TestimonialsScreen', () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/testimonials' && init?.method === 'POST')
        return { success: true, data: records[0] };
      if (path.startsWith('/testimonials?page='))
        return {
          success: true,
          data: records.filter((record) =>
            record.authorName
              .toLowerCase()
              .includes(
                new URL(path, 'http://example.invalid').searchParams
                  .get('q')
                  ?.toLowerCase() ?? '',
              ),
          ),
          meta: {
            page: 1,
            limit: 20,
            total: records.filter((record) =>
              record.authorName
                .toLowerCase()
                .includes(
                  new URL(path, 'http://example.invalid').searchParams
                    .get('q')
                    ?.toLowerCase() ?? '',
                ),
            ).length,
          },
        };
      if (records.some((record) => path === `/testimonials/${record.id}`))
        return {
          success: true,
          data: records.find((record) => path.endsWith(record.id)),
        };
      if (path.endsWith('/approve')) return { success: true, data: records[1] };
      if (
        path.startsWith('/categories?page=') ||
        path.startsWith('/tags?page=')
      )
        return {
          success: true,
          data: [],
          meta: { page: 1, limit: 100, total: 0 },
        };
      return { success: true, data: {} };
    });
  });

  it('preserves listing, search, creation and moderation through the active feature', async () => {
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    expect(await screen.findByRole('row', { name: /Ana/ })).toBeInTheDocument();
    const search = screen.getByPlaceholderText(
      'Buscar por autor o contenido...',
    );
    await user.type(search, 'Beto{Enter}');
    await waitFor(() => expect(navigation.url).toContain('q=Beto'));
    expect(screen.queryByRole('row', { name: /Ana/ })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Beto/ })).toBeInTheDocument();

    await user.clear(search);
    await user.keyboard('{Enter}');
    await user.click(screen.getByRole('button', { name: /Nuevo/ }));
    await user.type(
      screen.getByPlaceholderText('Nombre completo del cliente'),
      'Caro',
    );
    await user.type(
      screen.getByPlaceholderText(/Escribe aquí la experiencia/),
      'Excelente atención del equipo',
    );
    await user.click(
      screen.getByRole('button', { name: 'Registrar Testimonio' }),
    );
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith(
        '/testimonials',
        expect.objectContaining({ method: 'POST' }),
      ),
    );

    const betoRow = screen.getByRole('row', { name: /Beto/ });
    await user.click(
      within(betoRow).getByRole('button', { name: /Abrir Testimonio/ }),
    );
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await waitFor(() =>
      expect(fetchApi).toHaveBeenCalledWith(
        '/testimonials/00000000-0000-4000-8000-000000000002/approve',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('shows a recoverable load failure instead of an empty list', async () => {
    fetchApi.mockRejectedValueOnce(new Error('network unavailable'));
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo cargar',
    );
    expect(screen.queryByText(/No hay testimonios/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('row', { name: /Ana/ })).toBeInTheDocument();
  });

  it('keeps the moderation decision visible when the API reports a conflict', async () => {
    fetchApi.mockImplementation(async (path: string) => {
      if (records.some((record) => path === `/testimonials/${record.id}`))
        return {
          success: true,
          data: records.find((record) => path.endsWith(record.id)),
        };
      if (path.endsWith('/approve'))
        throw new ApiError('conflict', 'TESTIMONIAL_CONFLICT', 409);
      if (path.startsWith('/testimonials?page='))
        return {
          success: true,
          data: records,
          meta: { page: 1, limit: 20, total: records.length },
        };
      return {
        success: true,
        data: [],
        meta: { page: 1, limit: 100, total: 0 },
      };
    });
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    const row = await screen.findByRole('row', { name: /Beto/ });
    await user.click(
      within(row).getByRole('button', { name: /Abrir Testimonio/ }),
    );
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El recurso cambió o hay un conflicto',
    );
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
  });
});

// The response is authoritative even if refreshing the collection fails.
it('reconciles an open detail from the mutation without reopening after a list failure', async () => {
  let reads = 0;
  fetchApi.mockImplementation(async (path: string) => {
    if (records.some((record) => path === `/testimonials/${record.id}`))
      return {
        success: true,
        data: records.find((record) => path.endsWith(record.id)),
      };
    if (path.endsWith('/approve'))
      return { success: true, data: { ...records[1], status: 'approved' } };
    if (path.startsWith('/testimonials?page=')) {
      if (reads++ > 0) throw new Error('refresh failed');
      return {
        success: true,
        data: records,
        meta: { page: 1, limit: 20, total: 2 },
      };
    }
    return { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } };
  });
  render(<TestimonialsScreen />);
  const user = userEvent.setup();
  await user.click(
    within(await screen.findByRole('row', { name: /Beto/ })).getByRole(
      'button',
      { name: /Abrir Testimonio/ },
    ),
  );
  await user.click(screen.getByRole('button', { name: 'Aprobar' }));
  expect(
    await screen.findByRole('button', { name: 'Publicar Ahora' }),
  ).toBeEnabled();
  expect(
    within(screen.getByRole('dialog')).getByText('Aprobado'),
  ).toBeInTheDocument();
});

it('abre un identificador autorizado fuera de la página y mantiene el contexto de URL', async () => {
  const external = {
    ...records[0],
    id: '00000000-0000-4000-8000-000000000099',
    authorName: 'Fuera de página',
  };
  navigation.url = `q=consulta&testimonial=${external.id}`;
  fetchApi.mockImplementation(async (path: string) =>
    path === `/testimonials/${external.id}`
      ? { success: true, data: external }
      : { success: true, data: [], meta: { page: 1, limit: 20, total: 0 } },
  );
  render(<TestimonialsScreen />);
  expect(
    await screen.findByRole('dialog', {
      name: 'Testimonio de Fuera de página',
    }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Este testimonio está fuera de los resultados actuales.'),
  ).toBeInTheDocument();
  await userEvent.setup().keyboard('{Escape}');
  await waitFor(() => expect(navigation.url).toContain('q=consulta'));
  expect(navigation.url).not.toContain('testimonial=');
});
it.each([403, 404])(
  'explica un detalle %s sin tratarlo como una lista vacía',
  async (status) => {
    navigation.url = `testimonial=${records[0].id}`;
    fetchApi.mockImplementation(async (path: string) => {
      if (path === `/testimonials/${records[0].id}`)
        throw new ApiError('unavailable', 'UNAVAILABLE', status);
      return {
        success: true,
        data: records,
        meta: { page: 1, limit: 20, total: 2 },
      };
    });
    render(<TestimonialsScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      status === 403 ? 'Acceso denegado' : 'No encontrado',
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  },
);
it('rechaza identificadores inválidos antes de consultar la API', async () => {
  navigation.url = 'testimonial=invalid';
  fetchApi.mockReset();
  render(<TestimonialsScreen />);
  expect(screen.getByRole('alert')).toHaveTextContent('identificador inválido');
  expect(fetchApi).not.toHaveBeenCalled();
});

it('confirma el borrado una sola vez y corrige la última página sin perder filtros', async () => {
  const last = {
    ...records[1],
    id: '00000000-0000-4000-8000-000000000021',
    createdById: 'admin',
    authorName: 'Último resultado',
  };
  navigation.url = `page=2&status=pending&testimonial=${last.id}`;
  let removed = false;
  let complete: () => void = () => {};
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'DELETE') {
      await new Promise<void>((resolve) => {
        complete = resolve;
      });
      removed = true;
      return { success: true, data: { id: last.id, deleted: true } };
    }
    if (path === `/testimonials/${last.id}`)
      return { success: true, data: last };
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page') ?? '1',
    );
    return {
      success: true,
      data:
        page === 2
          ? removed
            ? []
            : [last]
          : Array.from({ length: 20 }, (_, index) => ({
              ...last,
              id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
            })),
      meta: { page, limit: 20, total: removed ? 20 : 21 },
    };
  });
  render(<TestimonialsScreen />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Eliminar testimonio' }),
  );
  await user.dblClick(
    screen.getByRole('button', { name: 'Eliminar definitivamente' }),
  );
  expect(screen.getByRole('button', { name: 'Procesando…' })).toBeDisabled();
  expect(
    fetchApi.mock.calls.filter(([, init]) => init?.method === 'DELETE'),
  ).toHaveLength(1);
  await act(async () => {
    complete();
  });
  await waitFor(() => expect(navigation.url).toBe('page=1&status=pending'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    await screen.findByText('Página 1 de 1 · 20 registros'),
  ).toBeInTheDocument();
});
it('revisa siguiente y anterior entre páginas dentro de la consulta', async () => {
  const all = Array.from({ length: 21 }, (_, index) => ({
    ...records[1],
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
    authorName: `Resultado ${index + 1}`,
  }));
  navigation.url = `status=pending&testimonial=${all[19].id}`;
  fetchApi.mockImplementation(async (path: string) => {
    if (!path.includes('?'))
      return {
        success: true,
        data: all.find((record) => path.endsWith(record.id)),
      };
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page') ?? '1',
    );
    return {
      success: true,
      data: all.slice((page - 1) * 20, page * 20),
      meta: { page, limit: 20, total: 21 },
    };
  });
  render(<TestimonialsScreen />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: 'Testimonio siguiente' }),
  );
  expect(
    await screen.findByRole('dialog', { name: 'Testimonio de Resultado 21' }),
  ).toBeInTheDocument();
  expect(navigation.url).toContain('page=2&status=pending');
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Testimonio anterior' }),
    ).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Testimonio anterior' }));
  expect(
    await screen.findByRole('dialog', { name: 'Testimonio de Resultado 20' }),
  ).toBeInTheDocument();
  expect(navigation.url).toContain('page=1&status=pending');
});
it('descarta la respuesta de una búsqueda anterior que termina más tarde', async () => {
  let complete: (value: unknown) => void = () => {};
  fetchApi.mockImplementation(async (path: string) => {
    const q = new URL(path, 'http://example.invalid').searchParams.get('q');
    if (!q)
      return new Promise((resolve) => {
        complete = resolve;
      });
    return {
      success: true,
      data: [records[1]],
      meta: { page: 1, limit: 20, total: 1 },
    };
  });
  render(<TestimonialsScreen />);
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Buscar por autor o contenido'),
    'Beto{Enter}',
  );
  expect(await screen.findByRole('row', { name: /Beto/ })).toBeInTheDocument();
  await act(async () => {
    complete({
      success: true,
      data: [records[0]],
      meta: { page: 1, limit: 20, total: 1 },
    });
  });
  expect(screen.queryByRole('row', { name: /Ana/ })).not.toBeInTheDocument();
});
