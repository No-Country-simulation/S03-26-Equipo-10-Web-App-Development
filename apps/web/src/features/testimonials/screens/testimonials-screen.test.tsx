import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TestimonialsScreen } from './testimonials-screen';

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));

vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({ session: { user: { id: 'admin' } }, fetchApi, isAdmin: true }),
}));

const records = [
  { id: 'ana-1', authorName: 'Ana', content: 'Excelente servicio', rating: 5, status: 'draft', score: 0, createdAt: '2026-09-28' },
  { id: 'beto-1', authorName: 'Beto', content: 'Muy buena atención', rating: 4, status: 'pending', score: 0, createdAt: '2026-09-28' },
];

describe('TestimonialsScreen', () => {
  beforeEach(() => {
    fetchApi.mockReset();
    fetchApi.mockImplementation(async (path: string) => {
      if (path === '/testimonials') return { data: records };
      if (path === '/categories' || path === '/tags') return { data: [] };
      return { data: {} };
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
});
