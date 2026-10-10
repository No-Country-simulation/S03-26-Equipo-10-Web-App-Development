import { describe, expect, it, vi } from 'vitest';
import type { SessionFetch } from '@/lib/api/validated-response';
import { cancelBiRequest, createBiRequest, getBiAudit, getBiRequest, getBiRequests, getBiRun, getBiRuns, getBiSettings, getBiStatus, patchBiSettings } from './operations-api';
import { allowed, requestFixture, requestId, runFixture, runId, settingsFixture, statusFixture } from './test-fixtures';
const response = (data: unknown) => ({ success: true, data });
const filter = { from: '2024-02-29', to: '2024-03-01', page: 2, limit: 20 };
describe('BI operational HTTP adapters', () => {
  it.each([[getBiStatus, statusFixture, '/bi/status'], [getBiSettings, settingsFixture, '/bi/settings']] as const)('validates reads and forwards cancellation signals', async (read, fixture, path) => {
    const fetch = vi.fn().mockResolvedValue(response(fixture)); const signal = new AbortController().signal;
    await expect(read(fetch as SessionFetch, signal)).resolves.toMatchObject({ data: fixture }); expect(fetch).toHaveBeenCalledWith(path, { signal });
  });
  it('reads resource details only with canonical UUID paths', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ ...runFixture, actions: { retry: { ...allowed, runId } } })).mockResolvedValueOnce(response({ request: requestFixture, runs: [runFixture], actions: { cancel: { ...allowed, requestId } } }));
    await getBiRun(fetch as SessionFetch, runId); await getBiRequest(fetch as SessionFetch, requestId);
    expect(fetch.mock.calls.map(([path]) => path)).toEqual([`/bi/runs/${runId}`, `/bi/requests/${requestId}`]);
    expect(() => getBiRun(fetch as SessionFetch, '../foreign')).toThrow();
  });
  it.each([getBiRuns, getBiRequests, getBiAudit])('validates envelope pagination independently of items', async read => {
    const fetch = vi.fn().mockResolvedValue({ ...response([]), meta: { page: 2, limit: 20, total: 41 } });
    await expect(read(fetch as SessionFetch, filter)).resolves.toEqual({ items: [], meta: { page: 2, limit: 20, total: 41 } });
    fetch.mockResolvedValue({ ...response([]), meta: { page: 0, limit: 101, total: '41' } }); await expect(read(fetch as SessionFetch, filter)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('whitelists filters and preserves counts larger than Number precision', async () => {
    const fetch = vi.fn().mockResolvedValue({ ...response([{ ...runFixture, sourceCounts: { categories: '0', testimonials: '9007199254740993', events: '0' } }]), meta: { page: 2, limit: 20, total: 41 } });
    const result = await getBiRuns(fetch as SessionFetch, { ...filter, status: 'failed', origin: 'manual', tenantId: 'foreign' } as Parameters<typeof getBiRuns>[1]);
    expect(result.items[0].sourceCounts?.testimonials).toBe('9007199254740993'); expect(fetch.mock.calls[0][0]).toBe('/bi/runs?from=2024-02-29&to=2024-03-01&page=2&limit=20&status=failed&origin=manual');
  });
  it('rejects numeric or absent quantities and impossible worker contracts', async () => {
    const fetch = vi.fn().mockResolvedValue(response({ ...statusFixture, activeRun: { ...runFixture, sourceCounts: { testimonials: 12, categories: '0', events: '0' } } }));
    await expect(getBiStatus(fetch as SessionFetch)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    fetch.mockResolvedValue(response({ ...statusFixture, service: { ...statusFixture.service, heartbeatTimeoutSeconds: 99 } }));
    await expect(getBiStatus(fetch as SessionFetch)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('creates and cancels using required idempotency keys and strict bodies', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response({ id: requestId, status: 'accepted' })).mockResolvedValueOnce(response({ ...requestFixture, status: 'cancelled' }));
    await createBiRequest(fetch as SessionFetch, { kind: 'manual' }, 'stable-key'); await cancelBiRequest(fetch as SessionFetch, requestId, 'cancel-key');
    expect(fetch).toHaveBeenCalledWith('/bi/requests', { method: 'POST', headers: { 'Idempotency-Key': 'stable-key' }, body: '{"kind":"manual"}' });
    expect(fetch).toHaveBeenCalledWith(`/bi/requests/${requestId}/cancel`, { method: 'POST', headers: { 'Idempotency-Key': 'cancel-key' }, body: '{}' });
    expect(() => createBiRequest(fetch as SessionFetch, { kind: 'manual', tenantId: 'foreign' } as Parameters<typeof createBiRequest>[1], 'x')).toThrow();
    expect(() => createBiRequest(fetch as SessionFetch, { kind: 'manual' }, '')).toThrow();
  });
  it('sends only mutable settings and the expected version', async () => {
    const fetch = vi.fn().mockResolvedValue(response(settingsFixture));
    const input = { frequencyHours: 6 as const, scheduleEnabled: false, alertFailures: true, alertDelays: false, delayToleranceMinutes: 120 as const, expectedVersion: 1 };
    await patchBiSettings(fetch as SessionFetch, input); expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual(input);
    expect(() => patchBiSettings(fetch as SessionFetch, { ...input, frequencyHours: 2 } as unknown as typeof input)).toThrow();
  });
});
