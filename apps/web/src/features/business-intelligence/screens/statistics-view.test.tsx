import { MonthlyStatisticsChart } from '../components/statistics-charts';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError } from '@/lib/api';
import StatisticsView from './statistics-view';
import {
  statisticsFixture,
  unpublishedStatisticsFixture,
} from '../statistics-fixtures';
const envelope = (data: unknown) => ({ success: true, data });
afterEach(() => {
  vi.restoreAllMocks();
});
describe('statistics view: readable states and private refresh', () => {
  it('aligns the monthly maximum with its axis and leaves one interval before the next month', () => {
    const forecast = statisticsFixture().forecast;
    forecast.history = [
      {
        month: '2024-12',
        count: '90',
        observedDays: 31,
        calendarDays: 31,
        coverage: 1,
        partial: false,
      },
      {
        month: '2025-01',
        count: '120',
        observedDays: 22,
        calendarDays: 31,
        coverage: 1,
        partial: true,
      },
    ];
    forecast.value = 150;
    const view = render(<MonthlyStatisticsChart forecast={forecast} />);
    const points = view.container.querySelectorAll('circle');
    expect(points[0].getAttribute('cy')).toBe('78');
    expect(points[1].getAttribute('cy')).toBe('54');
    expect(points[1].getAttribute('cx')).toBe('310');
    expect(view.container.querySelector('path[transform]')).toHaveAttribute(
      'transform',
      'translate(550,30)',
    );
  });
  it('provides explicit windows, accessible tables, explanatory gaps and three independent downloads', async () => {
    const fetchApi = vi.fn().mockResolvedValue(envelope(statisticsFixture()));
    render(<StatisticsView fetchApi={fetchApi} refreshKey={0} />);
    expect(
      await screen.findByRole('heading', { name: 'Minería de patrones' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/12 meses cerrados/)).toBeInTheDocument();
    expect(
      screen.getByRole('table', { name: /Histórico de creaciones/ }),
    ).toHaveTextContent('9.007.199.254.740.993');
    expect(
      screen.getByRole('table', { name: 'Etiquetas frecuentes' }),
    ).toHaveTextContent('Respuesta rápida');
    expect(
      screen.getByRole('table', { name: /Asociaciones exploratorias/ }),
    ).toHaveTextContent('25 %');
    expect(screen.getAllByRole('button', { name: /CSV$/ })).toHaveLength(3);
    expect(screen.queryByLabelText('Desde')).not.toBeInTheDocument();
    const user = userEvent.setup();
    await user.click(
      screen.getByText('Consultar las señales y referencias de los 90 días'),
    );
    expect(
      screen.getByRole('table', {
        name: 'Señales diarias y referencia estadística',
      }),
    ).toHaveTextContent('Aumento señalado');
    expect(fetchApi).toHaveBeenCalledTimes(1);
  });
  it('shows loading, pending publication and unknown inventory without claiming zero', async () => {
    let resolve: (value: unknown) => void = () => undefined;
    const fetchApi = vi.fn().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );
    render(<StatisticsView fetchApi={fetchApi} refreshKey={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Cargando');
    const data = unpublishedStatisticsFixture();
    await act(async () => resolve(envelope(data)));
    expect(
      await screen.findByText(/Corte disponible, informe pendiente/),
    ).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /CSV$/ }))
      expect(button).toBeDisabled();
    expect(screen.getByText(/Inventario: Desconocido/)).toBeInTheDocument();
  });
  it('refreshes on return to the visible tab and blocks export after an error', async () => {
    const fetchApi = vi.fn().mockResolvedValue(envelope(statisticsFixture()));
    render(<StatisticsView fetchApi={fetchApi} refreshKey={0} />);
    await screen.findByText('Atención al cliente');
    fetchApi.mockRejectedValue(
      new ApiError('unavailable', 'BI_STATISTICS_UNAVAILABLE', 503),
    );
    fireEvent(document, new Event('visibilitychange'));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no está disponible',
    );
    expect(screen.getByText('Atención al cliente')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: /CSV$/ }))
      expect(button).toBeDisabled();
    fetchApi.mockRejectedValue(new ApiError('forbidden', 'FORBIDDEN', 403));
    fireEvent(document, new Event('visibilitychange'));
    await waitFor(() =>
      expect(screen.queryByText('Atención al cliente')).not.toBeInTheDocument(),
    );
  });
  it('shows old-data notices, missing tags and absence of qualifying pairs without implying current alerts', async () => {
    const data = statisticsFixture();
    data.publicationStatus = 'outdated';
    data.freshness.status = 'stale';
    data.forecast.reason = 'STALE_PUBLICATION';
    data.patterns.tagsAvailability = {
      status: 'unavailable',
      reason: 'TAGS_NOT_OBSERVED',
    };
    data.patterns.tags.items = [];
    data.patterns.associations = [];
    render(
      <StatisticsView
        fetchApi={vi.fn().mockResolvedValue(envelope(data))}
        refreshKey={0}
      />,
    );
    expect(
      await screen.findByText(/no representan alertas actuales/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no incluye observación de etiquetas/),
    ).toBeInTheDocument();
    expect(
      screen.getByText('No hay pares que cumplan los criterios.'),
    ).toBeInTheDocument();
  });
  it('supports keyboard access to downloads and keeps forecast visually distinct from observations', async () => {
    const data = statisticsFixture();
    data.forecast = {
      ...data.forecast,
      status: 'available',
      reason: null,
      value: 120,
      inputMonths: ['2024-10', '2024-11', '2024-12'],
      evaluation: {
        candidateMae: 0,
        baselineMae: 30,
        candidateBias: 0,
        baselineBias: 30,
        folds: Array.from({ length: 6 }, (_, i) => ({
          targetMonth: `2024-${String(i + 7).padStart(2, '0')}`,
          originAt: new Date(Date.UTC(2024, i + 5, 1)).toISOString(),
          actual: '120',
          candidate: 120,
          baseline: 150,
        })),
      },
    };
    render(
      <StatisticsView
        fetchApi={vi.fn().mockResolvedValue(envelope(data))}
        refreshKey={0}
      />,
    );
    const button = await screen.findByRole('button', {
      name: 'Pronóstico CSV',
    });
    const user = userEvent.setup();
    await user.tab();
    expect(button).toHaveFocus();
    expect(
      screen.getByRole('img', {
        name: /Histórico mensual y pronóstico diferenciado/,
      }),
    ).toBeInTheDocument();
    await user.click(screen.getByText('Evaluación histórica del pronóstico'));
    expect(
      within(
        screen.getByRole('table', { name: /Seis evaluaciones/ }),
      ).getAllByRole('row'),
    ).toHaveLength(7);
  });
});
