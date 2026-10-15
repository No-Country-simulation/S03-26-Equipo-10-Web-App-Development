import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import AdminOverviewPage from './overview-screen';

const { fetchApi } = vi.hoisted(() => ({ fetchApi: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: {
      user: {
        id: 'editor-1',
        email: 'editor@example.invalid',
        roles: ['editor'],
        tenantName: 'Espacio sintético',
      },
    },
    isAdmin: false,
    fetchApi,
  }),
}));

it('reconcilia inicio y detalle al moderar como editor, sin consultas administrativas', async () => {
  let status = 'pending';
  const record = () => ({
    id: 'record-1',
    createdById: null,
    authorName: 'Autor sintético',
    content: 'Comentario sintético para revisar',
    rating: 4,
    status,
    score: 0,
    createdAt: '2026-10-14T12:00:00Z',
  });
  fetchApi.mockImplementation(async (path: string) => {
    if (path.endsWith('/approve')) {
      status = 'approved';
      return { success: true, data: record() };
    }
    if (path.startsWith('/testimonials?page='))
      return {
        success: true,
        data: [record()],
        meta: { page: 1, limit: 20, total: 1 },
      };
    throw new Error('Unexpected administrative request');
  });
  render(<AdminOverviewPage />);
  const user = userEvent.setup();
  await user.click(
    await screen.findByRole('button', { name: /Autor sintético/ }),
  );
  await user.click(screen.getByRole('button', { name: 'Aprobar' }));
  expect(
    await screen.findByRole('button', { name: 'Publicar Ahora' }),
  ).toBeEnabled();
  expect(
    within(screen.getByRole('dialog')).getByText('Aprobado'),
  ).toBeInTheDocument();
  await user.keyboard('{Escape}');
  expect(
    await screen.findByRole('button', { name: /Autor sintético Aprobado/ }),
  ).toBeInTheDocument();
  expect(fetchApi.mock.calls.some(([path]) => path.startsWith('/users'))).toBe(
    false,
  );
});
