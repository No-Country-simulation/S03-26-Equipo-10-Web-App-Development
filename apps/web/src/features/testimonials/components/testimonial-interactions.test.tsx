import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { CreateTestimonialModal } from './CreateTestimonialModal';
import { TestimonialModal } from './TestimonialModal';

const { fetchApi, identity } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  identity: { id: 'editor-1', roles: ['editor'] },
}));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    fetchApi,
    session: { user: identity },
    isAdmin: identity.roles.includes('admin'),
    hasRole: (role: string) => identity.roles.includes(role),
  }),
}));
const record = {
  id: 'record-1',
  createdById: 'someone-else',
  authorName: 'Cliente sintético',
  content: 'Una experiencia de prueba satisfactoria',
  rating: 4,
  status: 'pending',
  score: 0,
  createdAt: '2026-10-14T12:00:00Z',
};
const page = (name: string, n = 1) => ({
  success: true,
  data: [
    { id: `${name}-${n}`, name: `${name} ${n}`, tenantId: 'tenant-synthetic' },
  ],
  meta: { total: 21, page: n, limit: 20 },
});

beforeEach(() => {
  identity.roles = ['editor'];
  fetchApi.mockReset();
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (path.startsWith('/categories?'))
      return page(
        'Categoría',
        Number(new URLSearchParams(path.split('?')[1]).get('page')),
      );
    if (path.startsWith('/tags?'))
      return page(
        'Etiqueta',
        Number(new URLSearchParams(path.split('?')[1]).get('page')),
      );
    if (init?.method) return { success: true, data: record };
    throw new Error('Unexpected test request');
  });
});

async function fillCreate() {
  const user = userEvent.setup();
  await user.type(
    screen.getByLabelText('Autor del testimonio'),
    'Autor sintético',
  );
  await user.type(
    screen.getByLabelText('Contenido del testimonio'),
    'Un borrador que debe conservarse',
  );
  return user;
}

describe('Creación y borradores', () => {
  it('pagina categorías y etiquetas con campos válidos sin crear registros', async () => {
    render(
      <CreateTestimonialModal
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    await screen.findByRole('option', { name: 'Categoría 1' });
    const user = await fillCreate();
    await user.click(screen.getAllByRole('button', { name: 'Siguiente' })[0]);
    await screen.findByRole('option', { name: 'Categoría 2' });
    await user.click(screen.getAllByRole('button', { name: 'Siguiente' })[1]);
    await screen.findByRole('button', { name: 'Etiqueta 2' });
    expect(
      fetchApi.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(0);
    expect(screen.getByLabelText('Contenido del testimonio')).toHaveValue(
      'Un borrador que debe conservarse',
    );
  });

  it('reintenta metadatos sin cerrar ni borrar el borrador', async () => {
    fetchApi.mockRejectedValueOnce(new Error('temporary'));
    render(
      <CreateTestimonialModal
        open
        onOpenChange={vi.fn()}
        onCreated={vi.fn()}
      />,
    );
    const user = await fillCreate();
    await user.click(
      screen.getByRole('button', { name: 'Reintentar categorías y etiquetas' }),
    );
    await screen.findByRole('option', { name: 'Categoría 1' });
    expect(screen.getByLabelText('Autor del testimonio')).toHaveValue(
      'Autor sintético',
    );
    expect(screen.getByLabelText('Contenido del testimonio')).toHaveValue(
      'Un borrador que debe conservarse',
    );
  });

  it('protege Escape, cancelar y cierre; descartar requiere una elección explícita', async () => {
    const onOpenChange = vi.fn();
    render(
      <CreateTestimonialModal
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    const user = await fillCreate();
    await user.keyboard('{Escape}');
    expect(await screen.findByRole('alertdialog')).toHaveTextContent(
      'Descartar borrador',
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.getByLabelText('Autor del testimonio')).toHaveValue(
      'Autor sintético',
    );
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(
      screen.getByRole('button', { name: 'Descartar borrador' }),
    );
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('bloquea submits repetidos y cierre mientras espera; conserva texto ante error', async () => {
    let reject!: (reason: Error) => void;
    const pending = new Promise((_, fail) => {
      reject = fail;
    });
    fetchApi.mockImplementation((path: string, init?: RequestInit) => {
      if (init?.method === 'POST') return pending;
      return Promise.resolve(
        page(path.startsWith('/tags') ? 'Etiqueta' : 'Categoría'),
      );
    });
    const onOpenChange = vi.fn();
    render(
      <CreateTestimonialModal
        open
        onOpenChange={onOpenChange}
        onCreated={vi.fn()}
      />,
    );
    const user = await fillCreate();
    const form = screen.getByLabelText('Autor del testimonio').closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(
      fetchApi.mock.calls.filter(([, init]) => init?.method === 'POST'),
    ).toHaveLength(1);
    reject(new Error('unavailable'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos confirmar si se completó',
    );
    expect(screen.getByLabelText('Contenido del testimonio')).toHaveValue(
      'Un borrador que debe conservarse',
    );
  });
});

describe('Permisos, mutaciones y detalle', () => {
  it('editor modera contenido ajeno sin permiso de edición y entrega el registro confirmado', async () => {
    const approved = { ...record, status: 'approved' };
    fetchApi.mockImplementation(async (path: string) =>
      path.endsWith('/approve')
        ? { success: true, data: approved }
        : page('Catálogo'),
    );
    const onUpdated = vi.fn();
    render(
      <TestimonialModal
        testimonial={record}
        open
        onOpenChange={vi.fn()}
        onUpdated={onUpdated}
      />,
    );
    expect(
      screen.queryByRole('button', { name: /Editar Testimonio/ }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(approved));
  });

  it.each(['admin', 'editor'])(
    '%s no puede editar ni adjuntar sobre un publicado',
    async (role) => {
      identity.roles = [role];
      render(
        <TestimonialModal
          testimonial={{
            ...record,
            createdById: identity.id,
            status: 'published',
          }}
          open
          onOpenChange={vi.fn()}
          onUpdated={vi.fn()}
        />,
      );
      expect(
        screen.queryByRole('button', { name: /Editar Testimonio/ }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('Imagen del testimonio'),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByLabelText('URL del video de YouTube'),
      ).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Ocultar' })).toBeEnabled();
    },
  );

  it('editor edita contenido propio; retry conserva cambios y Escape protege el borrador', async () => {
    const user = userEvent.setup();
    render(
      <TestimonialModal
        testimonial={{ ...record, createdById: identity.id }}
        open
        onOpenChange={vi.fn()}
        onUpdated={vi.fn()}
      />,
    );
    fetchApi.mockRejectedValueOnce(new Error('metadata unavailable'));
    await user.click(screen.getByRole('button', { name: /Editar Testimonio/ }));
    await screen.findByRole('alert');
    const content = screen.getByLabelText('Contenido');
    await user.type(content, ' con cambios pendientes');
    await user.click(
      screen.getByRole('button', { name: 'Reintentar categorías y etiquetas' }),
    );
    await screen.findByRole('option', { name: 'Categoría 1' });
    await user.keyboard('{Escape}');
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Seguir editando',
      }),
    );
    expect(content).toHaveValue(record.content + ' con cambios pendientes');
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(content).toHaveValue(record.content + ' con cambios pendientes');
  });
});

describe('Guardado y adjuntos', () => {
  it('bloquea moderación concurrente y cierre hasta recibir el resultado', async () => {
    identity.roles = ['admin'];
    let complete!: (value: unknown) => void;
    const pending = new Promise((resolve) => {
      complete = resolve;
    });
    fetchApi.mockImplementation((path: string) =>
      path.endsWith('/approve') ? pending : Promise.resolve(page('Catálogo')),
    );
    const onOpenChange = vi.fn();
    const onUpdated = vi.fn();
    render(
      <TestimonialModal
        testimonial={record}
        open
        onOpenChange={onOpenChange}
        onUpdated={onUpdated}
      />,
    );
    const user = userEvent.setup();
    await user.dblClick(screen.getByRole('button', { name: 'Aprobar' }));
    await user.keyboard('{Escape}');
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeDisabled();
    expect(
      fetchApi.mock.calls.filter(([path]) => path.endsWith('/approve')),
    ).toHaveLength(1);
    complete({ success: true, data: { ...record, status: 'approved' } });
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'approved' }),
      ),
    );
  });

  it('el guardado y el video propagan el registro completo y preservan entrada ante fallo', async () => {
    identity.roles = ['admin'];
    const onUpdated = vi.fn();
    const updated = {
      ...record,
      content: 'Contenido confirmado por el servidor',
    };
    fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return { success: true, data: updated };
      if (path.endsWith('/video'))
        return {
          success: true,
          data: { ...updated, videoUrl: 'https://youtu.be/abcdefghijk' },
        };
      return page('Catálogo');
    });
    render(
      <TestimonialModal
        testimonial={record}
        open
        onOpenChange={vi.fn()}
        onUpdated={onUpdated}
      />,
    );
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Editar Testimonio/ }));
    await user.clear(screen.getByLabelText('Contenido'));
    await user.type(screen.getByLabelText('Contenido'), updated.content);
    await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(updated));
    await user.type(
      screen.getByLabelText('URL del video de YouTube'),
      'https://youtu.be/abcdefghijk',
    );
    await user.click(screen.getByRole('button', { name: 'Vincular' }));
    await waitFor(() =>
      expect(onUpdated).toHaveBeenCalledWith(
        expect.objectContaining({ videoUrl: 'https://youtu.be/abcdefghijk' }),
      ),
    );
  });
});

it('la imagen adjuntada actualiza el detalle con la respuesta confirmada', async () => {
  const onUpdated = vi.fn();
  fetchApi.mockResolvedValue({
    success: true,
    data: { ...record, imageUrl: 'https://media.example.invalid/image.webp' },
  });
  render(
    <TestimonialModal
      testimonial={record}
      open
      onOpenChange={vi.fn()}
      onUpdated={onUpdated}
    />,
  );
  await userEvent.upload(
    screen.getByLabelText('Imagen del testimonio'),
    new File(['synthetic image'], 'fixture.webp', { type: 'image/webp' }),
  );
  await waitFor(() =>
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        imageUrl: 'https://media.example.invalid/image.webp',
      }),
    ),
  );
});

it('sin rol de moderación mantiene el detalle en lectura', async () => {
  identity.roles = [];
  render(
    <TestimonialModal
      testimonial={{ ...record, createdById: identity.id }}
      open
      onOpenChange={vi.fn()}
      onUpdated={vi.fn()}
    />,
  );
  expect(await screen.findByText('Modo Lectura')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', {
      name: /Editar Testimonio|Aprobar|Rechazar/,
    }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByLabelText('Imagen del testimonio'),
  ).not.toBeInTheDocument();
});

it('conserva la edición rechazada por la API y el video con resultado incierto', async () => {
  identity.roles = ['admin'];
  fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
    if (init?.method === 'PATCH')
      throw new ApiError('invalid', 'VALIDATION_ERROR', 400);
    if (path.endsWith('/video')) throw new Error('network unavailable');
    return page('Catálogo');
  });
  render(
    <TestimonialModal
      testimonial={record}
      open
      onOpenChange={vi.fn()}
      onUpdated={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: /Editar Testimonio/ }));
  await user.type(screen.getByLabelText('Contenido'), ' con un cambio');
  await user.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Revisá los datos',
  );
  expect(screen.getByLabelText('Contenido')).toHaveValue(
    record.content + ' con un cambio',
  );
  await user.click(screen.getByRole('button', { name: 'Cancelar' }));
  await user.click(screen.getByRole('button', { name: 'Descartar cambios' }));
  await user.type(
    screen.getByLabelText('URL del video de YouTube'),
    'https://youtu.be/abcdefghijk',
  );
  await user.click(screen.getByRole('button', { name: 'Vincular' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No pudimos confirmar',
  );
  expect(screen.getByLabelText('URL del video de YouTube')).toHaveValue(
    'https://youtu.be/abcdefghijk',
  );
});

it('protege las notas de rechazo y no las descarta al aprobar accidentalmente', async () => {
  render(
    <TestimonialModal
      testimonial={record}
      open
      onOpenChange={vi.fn()}
      onUpdated={vi.fn()}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'Rechazar' }));
  await user.type(
    screen.getByLabelText('Motivo del rechazo'),
    'Una nota pendiente',
  );
  expect(screen.getByRole('button', { name: 'Aprobar' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Cancelar rechazo' }));
  await user.click(screen.getByRole('button', { name: 'Seguir editando' }));
  expect(screen.getByLabelText('Motivo del rechazo')).toHaveValue(
    'Una nota pendiente',
  );
  expect(fetchApi.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
    false,
  );
});
