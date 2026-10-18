import { render, screen } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import AnalyticsScreen from './analytics-screen';
const state = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock('@/hooks/use-session', () => ({
  useSession: () => ({
    session: { user: { id: 'a', tenantId: 'a', roles: ['editor'] } },
    fetchApi: state.fetch,
  }),
}));
const id = '11111111-1111-4111-8111-111111111111';
const instant = '2024-02-01T01:00:00Z';
const data = {
  totalViews: 80,
  totalClicks: 0,
  totalPlays: 0,
  observedAt: instant,
  period: { kind: 'all_time', from: instant, to: instant },
  recentEventsLimit: 50,
  events: Array.from({ length: 21 }, (_, index) => ({
    id: index + 1,
    testimonialId: id,
    eventType: 'view',
    createdAt: instant,
    testimonial: {
      id,
      authorName: `Autora ${index + 1}`,
      excerpt: 'Una historia con contexto.',
    },
  })),
};
beforeEach(() => {
  vi.clearAllMocks();
  state.fetch.mockResolvedValue({ success: true, data });
});
it('explains accumulated totals, observation and all 50 recent slots without hiding row 21', async () => {
  render(<AnalyticsScreen />);
  expect(await screen.findByText('Autora 21')).toHaveAttribute(
    'href',
    `/admin/testimonials?page=1&testimonial=${id}`,
  );
  expect(screen.getByText(/Acumulado desde/)).toBeInTheDocument();
  expect(screen.getByText(/Observado/)).toHaveTextContent('UTC');
  expect(screen.getByText(/hasta 50 eventos/)).toBeInTheDocument();
  expect(screen.getAllByText('Visualización')).toHaveLength(21);
  expect(state.fetch).toHaveBeenCalledTimes(1);
});
it('links an empty state to publication and distribution without inventing conversion', async () => {
  state.fetch.mockResolvedValue({
    success: true,
    data: {
      ...data,
      totalViews: 0,
      period: { ...data.period, from: null },
      events: [],
    },
  });
  render(<AnalyticsScreen />);
  expect(
    await screen.findByRole('link', {
      name: 'Revisar testimonios para publicar',
    }),
  ).toHaveAttribute('href', '/admin/testimonials?status=approved');
  expect(
    screen.getByRole('link', { name: 'Configurar el enlace público' }),
  ).toHaveAttribute('href', '/admin/settings');
});

it('does not show fabricated zeroes after a failed or malformed response', async () => {
  state.fetch.mockResolvedValue({
    success: true,
    data: { ...data, period: undefined },
  });
  render(<AnalyticsScreen />);
  expect(await screen.findByRole('alert')).toBeInTheDocument();
  expect(screen.queryByRole('definition')).not.toBeInTheDocument();
});
