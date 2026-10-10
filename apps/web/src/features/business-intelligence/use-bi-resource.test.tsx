import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api';
import { useBiResource } from './use-bi-resource';
import { useBiCommand } from './use-bi-command';
import type { SessionFetch } from '@/lib/api/validated-response';
import { requestId } from './test-fixtures';
describe('BI polling lifecycle', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
  it('polls at five seconds with no overlapping reads and ignores aborted results', async () => {
    let finish: (value: number) => void = () => undefined;
    const read = vi.fn().mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })).mockResolvedValue(2);
    const hook = renderHook(() => useBiResource<number>(read, true, 5000));
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); }); expect(read).toHaveBeenCalledTimes(1);
    await act(async () => finish(1)); await act(async () => { await vi.advanceTimersByTimeAsync(4999); }); expect(read).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(1); }); expect(read).toHaveBeenCalledTimes(2); expect(hook.result.current.data).toBe(2);
    hook.unmount(); await act(async () => { await vi.advanceTimersByTimeAsync(30000); }); expect(read).toHaveBeenCalledTimes(2);
  });
  it('stops hidden-tab reads and refreshes on visibility return', async () => {
    const read = vi.fn().mockResolvedValue(1); const hook = renderHook(() => useBiResource(read, true, 30000)); await act(async () => {});
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden'); act(() => document.dispatchEvent(new Event('visibilitychange')));
    await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(read).toHaveBeenCalledTimes(1);
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible'); await act(async () => document.dispatchEvent(new Event('visibilitychange'))); expect(read).toHaveBeenCalledTimes(2); hook.unmount();
  });
  it('clears old filter data synchronously and ignores a superseded response', async () => {
    let finish: (value: string) => void = () => undefined; const old = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })); const next = vi.fn().mockResolvedValue('new');
    const hook = renderHook(({ read }) => useBiResource<string>(read), { initialProps: { read: old } }); hook.rerender({ read: next }); await act(async () => {}); expect(hook.result.current.data).toBe('new');
    await act(async () => finish('old')); expect(hook.result.current.data).toBe('new'); hook.unmount();
  });
  it.each([['BI_OPERATIONS_DISABLED', 503], ['INVALID_RESPONSE', undefined], ['FORBIDDEN', 403], ['TOO_MANY_REQUESTS', 429]])('stops automated retries for %s', async (code, status) => {
    const read = vi.fn().mockRejectedValue(new ApiError('safe', code, status)); const hook = renderHook(() => useBiResource(read, true, 5000)); await act(async () => {}); await act(async () => { await vi.advanceTimersByTimeAsync(60000); }); expect(read).toHaveBeenCalledTimes(1); hook.unmount();
  });
  it.each([401, 403, 404])('removes retained private data after a %s response', async status => {
    const read = vi.fn().mockResolvedValueOnce('private').mockRejectedValueOnce(new ApiError('denied', 'ACCESS_DENIED', status));
    const hook = renderHook(() => useBiResource(read, true, 5000)); await act(async () => {});
    expect(hook.result.current.data).toBe('private'); await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(hook.result.current.data).toBeUndefined(); expect(hook.result.current.error).toBeDefined(); hook.unmount();
  });
  it('retains the last successful response on temporary failure and supports an explicit refresh', async () => {
    const read = vi.fn().mockResolvedValueOnce('last').mockRejectedValueOnce(new ApiError('offline', 'BI_UNAVAILABLE', 503)).mockResolvedValue('recovered');
    const hook = renderHook(() => useBiResource(read, true, 5000)); await act(async () => {}); await act(async () => { await vi.advanceTimersByTimeAsync(5000); }); expect(hook.result.current.data).toBe('last'); expect(hook.result.current.error).toBeDefined(); await act(async () => hook.result.current.reload()); expect(hook.result.current.data).toBe('recovered'); hook.unmount();
  });
});
describe('Durable-request client intent', () => {
  it('prevents double sends and retries an ambiguous response with the identical key and body', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new ApiError('lost response', 'BI_UNAVAILABLE', 503)).mockResolvedValue({ success: true, data: { id: requestId, status: 'accepted' } }); const success = vi.fn(); const settled = vi.fn();
    const hook = renderHook(() => useBiCommand(fetch as SessionFetch, success, settled));
    await act(async () => { void hook.result.current.execute({ type: 'create', input: { kind: 'manual' } }); void hook.result.current.execute({ type: 'create', input: { kind: 'manual' } }); });
    expect(fetch).toHaveBeenCalledTimes(1); expect(hook.result.current.uncertain).toBe(true); expect(success).not.toHaveBeenCalled();
    await act(async () => hook.result.current.repeat()); expect(fetch).toHaveBeenCalledTimes(2); expect(fetch.mock.calls[1]).toEqual(fetch.mock.calls[0]); expect(success).toHaveBeenCalledWith({ type: 'create', id: requestId });
  });
  it('never navigates or updates another session after unmount', async () => {
    let finish: (value: unknown) => void = () => undefined; const fetch = vi.fn().mockImplementation(() => new Promise(resolve => { finish = resolve; })); const success = vi.fn(); const settled = vi.fn(); const hook = renderHook(() => useBiCommand(fetch as SessionFetch, success, settled));
    act(() => { void hook.result.current.execute({ type: 'create', input: { kind: 'manual' } }); }); hook.unmount(); await act(async () => finish({ success: true, data: { id: requestId, status: 'accepted' } })); expect(success).not.toHaveBeenCalled(); expect(settled).not.toHaveBeenCalled();
  });
});
