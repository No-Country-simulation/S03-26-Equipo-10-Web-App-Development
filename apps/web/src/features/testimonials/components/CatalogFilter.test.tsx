import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { CatalogFilter } from './CatalogFilter';

it('busca en el catálogo completo y etiqueta los conteos globales sin depender de testimonios cargados', async () => {
  const fetchApi = vi.fn().mockImplementation(async (path: string) => {
    const q = new URL(path, 'http://example.invalid').searchParams.get('q');
    return {
      success: true,
      data: [
        {
          id: 'category',
          tenantId: 'tenant',
          name: q ? 'Categoría distante' : 'Categoría inicial',
          testimonialCount: 57,
        },
      ],
      meta: { page: 1, limit: 10, total: q ? 1 : 31 },
    };
  });
  const onChange = vi.fn();
  render(
    <CatalogFilter
      kind="categories"
      selected={[]}
      onChange={onChange}
      fetchApi={fetchApi}
      enabled
    />,
  );
  expect(fetchApi).not.toHaveBeenCalled();
  const user = userEvent.setup();
  await user.click(screen.getByText('Categorías · Todas'));
  expect(
    await screen.findByRole('button', { name: 'Categoría inicial (57)' }),
  ).toBeInTheDocument();
  expect(
    screen.getByText('Cantidades de asociaciones en todo el espacio.'),
  ).toBeInTheDocument();
  await user.type(screen.getByLabelText('Buscar categorías'), 'distante');
  await user.click(
    screen.getByRole('button', { name: 'Buscar en categorías' }),
  );
  await user.click(
    await screen.findByRole('button', { name: 'Categoría distante (57)' }),
  );
  expect(onChange).toHaveBeenCalledWith(['category']);
  expect(fetchApi.mock.calls.at(-1)?.[0]).toContain('q=distante');
});
it('conserva las etiquetas elegidas al cambiar de página y combina las selecciones', async () => {
  const fetchApi = vi.fn().mockImplementation(async (path: string) => {
    const page = Number(
      new URL(path, 'http://example.invalid').searchParams.get('page'),
    );
    return {
      success: true,
      data: [
        {
          id: 'second',
          tenantId: 'tenant',
          name: `Etiqueta página ${page}`,
          testimonialCount: 80,
        },
      ],
      meta: { page, limit: 10, total: 11 },
    };
  });
  const onChange = vi.fn();
  render(
    <CatalogFilter
      kind="tags"
      selected={['first']}
      onChange={onChange}
      fetchApi={fetchApi}
      enabled
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByText('Etiquetas · 1 aplicada'));
  await screen.findByRole('button', { name: 'Etiqueta página 1 (80)' });
  await user.click(
    within(screen.getByRole('navigation', { name: 'Paginación' })).getByRole(
      'button',
      { name: 'Siguiente' },
    ),
  );
  await user.click(
    await screen.findByRole('button', { name: 'Etiqueta página 2 (80)' }),
  );
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith(['first', 'second']),
  );
  expect(
    screen.getByText(/debe tener todas las etiquetas/),
  ).toBeInTheDocument();
});
