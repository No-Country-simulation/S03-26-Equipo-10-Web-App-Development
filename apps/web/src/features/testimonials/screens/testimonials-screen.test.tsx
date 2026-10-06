import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestimonialsScreen } from './testimonials-screen';
import { ApiError } from '@/lib/api';

const { fetchApi, session } = vi.hoisted(() => ({
  fetchApi: vi.fn(),
  session: { user: { id: 'admin' } },
}));

vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session, fetchApi, isAdmin: true }),
}));

const records = [
  { id: 'ana-1', authorName: 'Ana', content: 'Excelente servicio', rating: 5, status: 'draft', score: 0, createdAt: '2026-09-28' },
  { id: 'beto-1', authorName: 'Beto', content: 'Muy buena atención', rating: 4, status: 'pending', score: 0, createdAt: '2026-09-28' },
];

describe('TestimonialsScreen', () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === '/testimonials' && init?.method === 'POST') return { success: true, data: records[0] };
      if (path.startsWith('/testimonials?page=')) return { success: true,
        data: { items: records, meta: { page: 1, limit: 20, total: records.length } } };
      if (path.endsWith('/approve')) return { success: true, data: records[1] };
      if (path.startsWith('/categories?page=') || path.startsWith('/tags?page=')) return { success: true,
        data: { items: [], meta: { page: 1, limit: 100, total: 0 } } };
      return { success: true, data: {} };
    });
  });

  it('preserves listing, search, creation and moderation through the active feature', async () => {
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    expect(await screen.findByRole('row', { name: /Ana/ })).toBeInTheDocument();
    const search = screen.getByPlaceholderText('Buscar por autor o contenido...');
    await user.type(search, 'Beto');
    expect(screen.queryByRole('row', { name: /Ana/ })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Beto/ })).toBeInTheDocument();

    await user.clear(search);
    await user.click(screen.getByRole('button', { name: /Nuevo/ }));
    await user.type(screen.getByPlaceholderText('Nombre completo del cliente'), 'Caro');
    await user.type(screen.getByPlaceholderText(/Escribe aquí la experiencia/), 'Excelente atención del equipo');
    await user.click(screen.getByRole('button', { name: 'Registrar Testimonio' }));
    await waitFor(() => expect(fetchApi).toHaveBeenCalledWith('/testimonials', expect.objectContaining({ method: 'POST' })));

    const betoRow = screen.getByRole('row', { name: /Beto/ });
    await user.click(within(betoRow).getByRole('button', { name: /Abrir Testimonio/ }));
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));
    await waitFor(() => expect(fetchApi).toHaveBeenCalledWith('/testimonials/beto-1/approve', expect.objectContaining({ method: 'POST' })));
  });

  it('shows a recoverable load failure instead of an empty list', async () => {
    fetchApi.mockRejectedValueOnce(new Error('network unavailable'));
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo cargar');
    expect(screen.queryByText(/No hay testimonios/)).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByRole('row', { name: /Ana/ })).toBeInTheDocument();
  });

  it('keeps the moderation decision visible when the API reports a conflict', async () => {
    fetchApi.mockImplementation(async (path: string) => {
      if (path.endsWith('/approve')) throw new ApiError('conflict', 'TESTIMONIAL_CONFLICT', 409);
      if (path.startsWith('/testimonials?page=')) return { success: true,
        data: { items: records, meta: { page: 1, limit: 20, total: records.length } } };
      return { success: true, data: { items: [], meta: { page: 1, limit: 100, total: 0 } } };
    });
    const user = userEvent.setup();
    render(<TestimonialsScreen />);

    const row = await screen.findByRole('row', { name: /Beto/ });
    await user.click(within(row).getByRole('button', { name: /Abrir Testimonio/ }));
    await user.click(await screen.findByRole('button', { name: 'Aprobar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('El recurso cambió o hay un conflicto');
    expect(screen.getByRole('button', { name: 'Aprobar' })).toBeEnabled();
  });
});
