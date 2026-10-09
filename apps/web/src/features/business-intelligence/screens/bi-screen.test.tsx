import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BiScreen, { InventoryTrend } from './bi-screen';
import { ApiError } from '@/lib/api';
import type { BiDashboard } from '../api';

const { load, account } = vi.hoisted(() => ({ load: vi.fn(), account: { id: 'a', tenantId: 'tenant-a' } }));
const fetchApi = vi.fn();
vi.mock('@/hooks/use-session', () => ({ useSession: () => ({ session: { user: account }, fetchApi }) }));
vi.mock('../api', () => ({ getBiDashboard: load }));
const data: BiDashboard = {
  range: { from: '2024-02-29', to: '2024-03-01', timezone: 'UTC' },
  summary: { totalTestimonials: 2, averageRating: 4.5, statuses: [{ code: 'published', count: 2 }], views: '9007199254740993', clicks: '2', plays: '1', ctr: null },
  testimonialSeries: [{ date: '2024-02-29', snapshotAt: null, total: null, averageRating: null }, { date: '2024-03-01', snapshotAt: '2024-03-01T02:00:00Z', total: 2, averageRating: 4.5 }],
  engagementSeries: [{ date: '2024-02-29', views: '9007199254740993', clicks: '0', plays: '0', ctr: null }, { date: '2024-03-01', views: '0', clicks: '2', plays: '1', ctr: null }],
  categories: [{ categoryKey: '1', name: 'Category A', count: 2, averageRating: 4.5 }],
  freshness: { status: 'stale', sourceSnapshotAt: '2024-03-01T02:00:00Z', lastPublishedAt: '2024-03-01T02:01:00Z', historyStartedAt: '2024-03-01T02:00:00Z', engagementHistoryStartedAt: '2024-02-29', dataAgeSeconds: 9000 },
};
describe('BI dashboard', () => {
  beforeEach(() => { vi.clearAllMocks(); account.id = 'a'; account.tenantId = 'tenant-a'; load.mockResolvedValue({ data }); });
  it('presents stale metadata, accurate BigInt, zero-denominator CTR and daily missing cuts', async () => {
    const user = userEvent.setup(); render(<BiScreen />);
    expect(await screen.findByText(/Datos atrasados/)).toBeInTheDocument();
    expect(screen.getAllByText('9.007.199.254.740.993')).toHaveLength(2);
    expect(screen.getAllByText('Sin datos').length).toBeGreaterThan(0);
    await user.click(screen.getByText('Ver detalle diario e interacciones'));
    expect(screen.getByText('Sin corte')).toBeInTheDocument(); expect(screen.getByText('Category A')).toBeInTheDocument();
  });
  it('shows first-load state without claiming a completed empty snapshot', async () => {
    load.mockResolvedValue({ data: { ...data, freshness: { ...data.freshness, status: 'not_loaded' } } });
    render(<BiScreen />); expect(await screen.findByText(/Esperando la primera carga/)).toBeInTheDocument();
  });
  it('handles an unavailable warehouse and supports retry', async () => {
    load.mockRejectedValueOnce(new ApiError('Unavailable', 'BI_UNAVAILABLE', 503));
    const user = userEvent.setup(); render(<BiScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent('captura y moderación siguen disponibles');
    await user.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(await screen.findByText('Category A')).toBeInTheDocument();
  });
  it.each([
    ['BI_DISABLED', 503, 'todavía no está habilitada'],
    ['FORBIDDEN', 403, 'no tiene permiso'],
  ])('explains %s without showing stale tenant data', async (code, status, message) => {
    load.mockRejectedValue(new ApiError('Request failed', code, status));
    render(<BiScreen />);
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(screen.queryByText('Category A')).not.toBeInTheDocument();
  });
  it('rejects excessive ranges and sends only from and to on valid submission', async () => {
    render(<BiScreen />); await screen.findByText('Category A');
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2000-01-01' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Rango de fechas BI' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('366 días'); expect(load).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2024-02-29' } });
    fireEvent.change(screen.getByLabelText('Hasta (UTC)'), { target: { value: '2024-03-01' } });
    fireEvent.submit(screen.getByRole('form', { name: 'Rango de fechas BI' }));
    await screen.findByText('Category A'); expect(load).toHaveBeenLastCalledWith(fetchApi, { from: '2024-02-29', to: '2024-03-01' });
  });
  it('clears old account data and ignores an obsolete response after session change', async () => {
    let complete: (value: { data: BiDashboard }) => void = () => undefined;
    load.mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const view = render(<BiScreen />);
    account.id = 'b'; account.tenantId = 'tenant-b';
    load.mockResolvedValueOnce({ data: { ...data, categories: [{ categoryKey: '2', name: 'Category B', count: 1, averageRating: 3 }] } });
    view.rerender(<BiScreen />); expect(await screen.findByText('Category B')).toBeInTheDocument();
    await act(async () => complete({ data })); expect(screen.queryByText('Category A')).not.toBeInTheDocument();
  });
  it('leaves a gap between observed days rather than joining across a missing snapshot', () => {
    const view = render(<InventoryTrend rows={[{ date: '1', total: 1, averageRating: null, snapshotAt: '1' },
      { date: '2', total: null, averageRating: null, snapshotAt: null }, { date: '3', total: 0, averageRating: null, snapshotAt: '3' }]} />);
    expect(view.container.querySelectorAll('circle')).toHaveLength(2);
    const path = view.container.querySelectorAll('path')[1]?.getAttribute('d');
    expect(path).not.toContain(' L');
  });
});
