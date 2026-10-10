import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import BiScreen, { InventoryTrend } from './bi-screen';
import { ApiError } from '@/lib/api';
import { actorId, allowed, dashboardFixture as data, denied, requestFixture, requestId, runFixture, runId, settingsFixture, statusFixture } from '../test-fixtures';

const state = vi.hoisted(() => ({ url: 'view=summary&from=2024-02-29&to=2024-03-01', push: vi.fn(), fetch: vi.fn(), user: { id: 'account-a', tenantId: 'tenant-a', tenantName: 'Empresa A', roles: ['admin'] }, loggedIn: true }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: state.push }), useSearchParams: () => new URLSearchParams(state.url) }));
vi.mock('@/hooks/use-session', () => ({ useSession: () => ({ session: state.loggedIn ? { user: state.user } : null, fetchApi: state.fetch, loading: false }) }));
function envelope(value: unknown) { return { success: true, data: value }; }
function mockNetwork(path: string, init?: RequestInit) {
  const route = path.split('?')[0];
  if (route === '/bi/dashboard') return Promise.resolve(envelope(data));
  if (route === '/bi/status') return Promise.resolve(envelope(statusFixture));
  if (route === '/bi/settings') return Promise.resolve(envelope(settingsFixture));
  if (route === '/bi/requests' && init?.method === 'POST') return Promise.resolve(envelope({ id: requestId, status: 'accepted' }));
  if (route === `/bi/requests/${requestId}`) return Promise.resolve(envelope({ request: requestFixture, runs: [], actions: { cancel: { ...allowed, requestId } } }));
  if (route === `/bi/runs/${runId}`) return Promise.resolve(envelope({ ...runFixture, actions: { retry: { ...allowed, runId } } }));
  if (route === '/bi/requests' || route === '/bi/runs' || route === '/bi/audit') return Promise.resolve({ ...envelope(route === '/bi/runs' ? [runFixture] : route === '/bi/requests' ? [requestFixture] : [{ id: runId, actorId, action: 'settings_updated', requestId: null, settingsBefore: null, settingsAfter: settingsFixture, createdAt: runFixture.startedAt }]), meta: { page: 1, limit: 20, total: 1 } });
  return Promise.reject(new Error(`Unexpected fixture route ${route}`));
}
describe('BI interfaces with validated contracts', () => {
  beforeEach(() => { vi.clearAllMocks(); state.url = 'view=summary&from=2024-02-29&to=2024-03-01'; state.loggedIn = true; state.user = { id: 'account-a', tenantId: 'tenant-a', tenantName: 'Empresa A', roles: ['admin'] }; state.fetch.mockImplementation(mockNetwork); });
  it('presents freshness, exact decimals, null CTR, missing cuts and four CSV exports', async () => {
    render(<BiScreen />); expect(await screen.findByText(/Datos atrasados/)).toBeInTheDocument();
    expect(screen.getAllByText('9.007.199.254.740.993')).toHaveLength(2);
    expect(screen.getByText('Sin corte')).toBeInTheDocument(); expect(screen.getByText('Category A')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /CSV$/ })).toHaveLength(4);
    expect(screen.getByRole('navigation', { name: 'Vistas de inteligencia de negocio' })).toBeInTheDocument();
  });
  it('refreshes reads without creating a load', async () => {
    const user = userEvent.setup(); render(<BiScreen />); await screen.findByText('Category A');
    await user.click(screen.getByRole('button', { name: 'Actualizar vista' }));
    await waitFor(() => expect(state.fetch.mock.calls.filter(([path]) => path.startsWith('/bi/dashboard'))).toHaveLength(2));
    expect(state.fetch.mock.calls.every(([, init]) => !init?.method)).toBe(true);
  });
  it('keeps the summary available when operational controls are disabled', async () => {
    state.fetch.mockImplementation((path: string) => path === '/bi/status' ? Promise.reject(new ApiError('disabled', 'BI_OPERATIONS_DISABLED', 503)) : mockNetwork(path));
    render(<BiScreen />); expect(await screen.findByText('Category A')).toBeInTheDocument(); expect(screen.getByRole('alert')).toHaveTextContent('controles');
  });
  it('shows first-load state without claiming an empty snapshot succeeded', async () => {
    state.fetch.mockImplementation((path: string) => path.startsWith('/bi/dashboard') ? Promise.resolve(envelope({ ...data, freshness: { ...data.freshness, status: 'not_loaded' } })) : mockNetwork(path));
    render(<BiScreen />); expect(await screen.findByText(/Esperando la primera carga/)).toBeInTheDocument();
  });
  it('shows explicit pause and suppresses the delay banner', async () => {
    state.fetch.mockImplementation((path: string) => path.startsWith('/bi/dashboard') ? Promise.resolve(envelope({ ...data, freshness: { ...data.freshness, schedulePaused: true } })) : mockNetwork(path));
    render(<BiScreen />); await screen.findByText('Category A'); expect(screen.getByText(/Programación pausada. Las cargas manuales/)).toBeInTheDocument(); expect(screen.queryByText(/Datos atrasados/)).not.toBeInTheDocument();
  });
  it.each([['BI_DISABLED', 503, 'todavía no está habilitada'], ['FORBIDDEN', 403, 'no tiene permiso'], ['BI_UNAVAILABLE', 503, 'captura y moderación siguen disponibles']])('handles %s safely', async (code, status, message) => {
    state.fetch.mockImplementation((path: string) => path.startsWith('/bi/dashboard') ? Promise.reject(new ApiError('raw secret driver text', code, status)) : mockNetwork(path));
    render(<BiScreen />); expect(await screen.findByRole('alert')).toHaveTextContent(message); expect(screen.queryByText(/raw secret/)).not.toBeInTheDocument(); expect(screen.queryByText('Category A')).not.toBeInTheDocument();
  });
  it('validates range and preserves filters in the URL without a tenant parameter', async () => {
    render(<BiScreen />); await screen.findByText('Category A');
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2000-01-01' } }); fireEvent.submit(screen.getByRole('form'));
    expect(await screen.findByRole('alert')).toHaveTextContent('366 días'); expect(state.push).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText('Desde (UTC)'), { target: { value: '2024-03-01' } }); fireEvent.submit(screen.getByRole('form'));
    expect(state.push).toHaveBeenCalledWith(expect.stringContaining('from=2024-03-01'), { scroll: false }); expect(state.push.mock.calls[0][0]).not.toContain('tenant');
  });
  it('does not query invalid URL filters', () => {
    state.url = 'view=runs&page=0'; render(<BiScreen />); expect(screen.getByRole('alert')).toHaveTextContent('filtros'); expect(state.fetch).not.toHaveBeenCalled();
  });
  it('clears old tenant data and ignores a delayed response after identity change', async () => {
    let complete: (value: unknown) => void = () => undefined;
    state.fetch.mockImplementationOnce(() => Promise.resolve(envelope(statusFixture))).mockImplementationOnce(() => new Promise(resolve => { complete = resolve; }));
    const view = render(<BiScreen />); state.user = { ...state.user, id: 'account-b', tenantId: 'tenant-b', tenantName: 'Empresa B' };
    state.fetch.mockImplementation((path: string) => path.startsWith('/bi/dashboard') ? Promise.resolve(envelope({ ...data, categories: [{ categoryKey: '2', name: 'Category B', count: 1, averageRating: 3 }] })) : mockNetwork(path));
    view.rerender(<BiScreen />); expect(await screen.findByText('Category B')).toBeInTheDocument(); await act(async () => complete(envelope(data))); expect(screen.queryByText('Category A')).not.toBeInTheDocument();
  });
  it('clears data at logout', async () => {
    const view = render(<BiScreen />); await screen.findByText('Category A'); state.loggedIn = false; view.rerender(<BiScreen />); expect(screen.queryByText('Category A')).not.toBeInTheDocument(); expect(screen.getByRole('alert')).toHaveTextContent('Iniciá sesión');
  });
  it('allows editors to read/export but hides administrative navigation and controls', async () => {
    state.user.roles = ['editor']; const view = render(<BiScreen />); await screen.findByText('Category A'); expect(screen.getAllByRole('button', { name: /CSV$/ })).toHaveLength(4); expect(screen.queryByRole('link', { name: 'Auditoría' })).not.toBeInTheDocument();
    state.url = 'view=operation'; view.rerender(<BiScreen />); expect(await screen.findByText(/La operación está reservada/)).toBeInTheDocument(); expect(screen.queryByRole('button', { name: 'Ejecutar ahora' })).not.toBeInTheDocument();
  });
  it('denies direct editor audit access without fetching it', () => {
    state.user.roles = ['editor']; state.url = 'view=audit'; render(<BiScreen />); expect(screen.getByRole('alert')).toHaveTextContent('reservada'); expect(state.fetch).not.toHaveBeenCalled();
  });
  it('shows server block reasons and prevents a request', async () => {
    state.url = 'view=operation'; state.fetch.mockImplementation((path: string) => path === '/bi/status' ? Promise.resolve(envelope({ ...statusFixture, actions: { ...statusFixture.actions, runNow: denied } })) : mockNetwork(path));
    render(<BiScreen />); expect(await screen.findByRole('button', { name: 'Ejecutar ahora' })).toBeDisabled(); expect(screen.getAllByText(denied.message).length).toBeGreaterThan(0);
  });
  it('accepts a request as pending and links to its durable result', async () => {
    state.url = 'view=operation'; const user = userEvent.setup(); const view = render(<BiScreen />); await user.click(await screen.findByRole('button', { name: 'Ejecutar ahora' }));
    expect(await screen.findByText(/Solicitud aceptada/)).toHaveTextContent('Consultá su estado en el detalle');
    const post = state.fetch.mock.calls.find(([, init]) => init?.method === 'POST'); expect(post?.[1].headers).toHaveProperty('Idempotency-Key');
    expect(state.push).toHaveBeenCalledWith(expect.stringContaining(`request=${requestId}`), { scroll: false });
    state.url = `view=runs&request=${requestId}`; view.rerender(<BiScreen />); expect(await screen.findByText('Estado: Pendiente')).toBeInTheDocument(); expect(screen.queryByText('Carga completada')).not.toBeInTheDocument();
  });
  it('shows history filters, pagination and current observation retry detail with unknown counts', async () => {
    state.url = 'view=runs&from=2024-02-29&to=2024-03-01&status=failed&origin=scheduled'; const view = render(<BiScreen />);
    expect(await screen.findByRole('table', { name: 'Solicitudes de carga de tu empresa' })).toBeInTheDocument(); expect(screen.getByLabelText('Estado de ejecución')).toHaveValue('failed');
    expect(state.fetch.mock.calls.some(([path]) => path.includes('status=failed&origin=scheduled'))).toBe(true);
    expect(screen.getByRole('navigation', { name: 'Paginación de ejecuciones' })).toBeInTheDocument();
    state.url = `view=runs&run=${runId}`; view.rerender(<BiScreen />); expect(await screen.findByText(/Desconocidas: la extracción/)).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Solicitar reintento actual' })).toBeEnabled();
  });
  it('cancels a pending request through the durable command and refreshes its result', async () => {
    state.url = `view=runs&request=${requestId}`; let cancelled = false;
    state.fetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === `/bi/requests/${requestId}/cancel`) { cancelled = true; return Promise.resolve(envelope({ ...requestFixture, status: 'cancelled' })); }
      if (path === `/bi/requests/${requestId}` && cancelled) return Promise.resolve(envelope({ request: { ...requestFixture, status: 'cancelled' }, runs: [], actions: { cancel: { ...denied, requestId } } }));
      return mockNetwork(path, init);
    });
    const user = userEvent.setup(); render(<BiScreen />); await screen.findByText('Estado: Pendiente');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancelar solicitud pendiente' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Cancelar solicitud pendiente' }));
    expect(await screen.findByText('Estado: Cancelada')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Cancelar solicitud pendiente' })).toBeDisabled();
    expect(state.fetch.mock.calls.find(([path]) => path.endsWith('/cancel'))?.[1].method).toBe('POST');
  });
  it('does not offer cancellation of a running request', async () => {
    state.url = `view=runs&request=${requestId}`; state.fetch.mockImplementation((path: string) => path === `/bi/requests/${requestId}` ? Promise.resolve(envelope({ request: { ...requestFixture, status: 'running' }, runs: [], actions: { cancel: { ...denied, requestId } } })) : mockNetwork(path));
    render(<BiScreen />); expect(await screen.findByText('Estado: En ejecución')).toBeInTheDocument(); expect(screen.getByRole('button', { name: 'Cancelar solicitud pendiente' })).toBeDisabled();
  });
  it('presents administrative audit from the authorized endpoint', async () => {
    state.url = 'view=audit'; render(<BiScreen />); expect(await screen.findByText('Configuración modificada')).toBeInTheDocument(); expect(screen.getByText(`Actor técnico: ${actorId}`)).toBeInTheDocument();
  });
  it('keeps settings read-only for an editor', async () => {
    state.url = 'view=settings'; state.user.roles = ['editor']; render(<BiScreen />); expect(await screen.findByLabelText('Frecuencia')).toBeDisabled(); expect(screen.queryByRole('button', { name: 'Guardar configuración' })).not.toBeInTheDocument();
  });
  it('keeps edits after 409 and requires review of the latest version before saving', async () => {
    state.url = 'view=settings'; let writes = 0;
    state.fetch.mockImplementation((path: string, init?: RequestInit) => {
      if (path === '/bi/settings' && init?.method === 'PATCH') { writes++; return writes === 1 ? Promise.reject(new ApiError('conflict', 'BI_SETTINGS_CONFLICT', 409)) : Promise.resolve(envelope({ ...settingsFixture, frequencyHours: 6, delayToleranceMinutes: 120, version: 3 })); }
      if (path === '/bi/settings' && writes) return Promise.resolve(envelope({ ...settingsFixture, version: 2, delayToleranceMinutes: 120 }));
      return mockNetwork(path, init);
    });
    const user = userEvent.setup(); render(<BiScreen />); await screen.findByLabelText('Frecuencia'); await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeEnabled());
    await user.selectOptions(screen.getByLabelText('Frecuencia'), '6'); await user.click(screen.getByRole('button', { name: 'Guardar configuración' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Tus cambios se conservaron'); expect(screen.getByLabelText('Frecuencia')).toHaveValue('6'); expect(screen.getByRole('button', { name: 'Guardar configuración' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cargar versión vigente' })); await screen.findByText(/Versión vigente: 2/); await user.click(screen.getByRole('button', { name: 'Conservar mis cambios sobre esta versión' }));
    await user.click(screen.getByRole('button', { name: 'Guardar configuración' })); expect(await screen.findByText('Configuración guardada.')).toBeInTheDocument();
    const last = state.fetch.mock.calls.filter(([, init]) => init?.method === 'PATCH').at(-1); expect(JSON.parse(last?.[1].body)).toMatchObject({ expectedVersion: 2, frequencyHours: 6, delayToleranceMinutes: 120 });
  });
  it('provides keyboard focus and labels for the range and navigation', async () => {
    const user = userEvent.setup(); render(<BiScreen />); await screen.findByText('Category A'); await user.tab(); expect(screen.getByRole('button', { name: 'Actualizar vista' })).toHaveFocus();
    await user.tab(); expect(within(screen.getByRole('navigation', { name: 'Vistas de inteligencia de negocio' })).getByRole('link', { name: 'Resumen' })).toHaveFocus();
  });
  it('leaves gaps instead of joining through missing observations', () => {
    const view = render(<InventoryTrend rows={[{ date: '1', total: 1, averageRating: null, snapshotAt: '1' }, { date: '2', total: null, averageRating: null, snapshotAt: null }, { date: '3', total: 0, averageRating: null, snapshotAt: '3' }]} />);
    expect(view.container.querySelectorAll('circle')).toHaveLength(2); expect(view.container.querySelectorAll('path')[1]?.getAttribute('d')).not.toContain(' L');
  });
});
