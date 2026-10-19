import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { GettingStarted } from './getting-started';
import type { SessionFetch } from '@/lib/api/validated-response';

it('derives optional next actions from metadata and counts without recording invented completion', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: 'synthetic',
      name: 'Espacio sintético',
      publicSlug: 'espacio',
      isPublicFormEnabled: false,
      isActive: true,
      createdAt: '2026-10-18T00:00:00Z',
      logoUrl: null,
    },
  });
  render(
    <GettingStarted
      fetchApi={fetchApi as SessionFetch}
      summary={{
        total: 0,
        byStatus: {
          draft: 0,
          pending: 0,
          approved: 0,
          published: 0,
          rejected: 0,
        },
      }}
    />,
  );
  expect(
    await screen.findByText(/Recepción cerrada: no acepta nuevos envíos/),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/0 aprobados sin publicar · 0 publicados/),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Configurar y copiar enlace' }),
  ).toHaveAttribute('href', '/admin/settings#capture');
  expect(
    screen.getByRole('link', { name: 'Ver galería pública' }),
  ).toHaveAttribute('href', '/t/espacio');
  await userEvent
    .setup()
    .click(screen.getByText('Primeros pasos con tu espacio (opcional)'));
  expect(
    screen.getByText('Primeros pasos con tu espacio (opcional)').parentElement,
  ).not.toHaveAttribute('open');
});
