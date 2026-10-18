import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { useSettingsExitGuard } from './use-settings-exit-guard';
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
});
it('serializes guard removal and a new edit before the browser finishes history.back', () => {
  window.history.replaceState(
    null,
    '',
    '/admin/business-intelligence?view=settings',
  );
  const back = vi
    .spyOn(window.history, 'back')
    .mockImplementation(() => undefined);
  const push = vi.spyOn(window.history, 'pushState');
  const request = vi.fn();
  const view = renderHook(
    ({ active }) => useSettingsExitGuard(active, request),
    { initialProps: { active: true } },
  );
  expect(push).toHaveBeenCalledTimes(1);
  view.rerender({ active: false });
  expect(back).toHaveBeenCalledTimes(1);
  view.rerender({ active: true });
  expect(push).toHaveBeenCalledTimes(1);
  // The asynchronous traversal reaches the original same-URL entry.
  act(() => {
    window.history.replaceState(null, '', window.location.href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(push).toHaveBeenCalledTimes(2);
  expect(request).not.toHaveBeenCalled();
  const unload = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(unload);
  expect(unload.defaultPrevented).toBe(true);
  view.rerender({ active: false });
  act(() => {
    window.history.replaceState(null, '', window.location.href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const clean = new Event('beforeunload', { cancelable: true });
  window.dispatchEvent(clean);
  expect(clean.defaultPrevented).toBe(false);
});
it('drops a queued exit if identity change unmounts the form during history removal', () => {
  window.history.replaceState(
    null,
    '',
    '/admin/business-intelligence?view=settings',
  );
  vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
  const request = vi.fn();
  const clicked = vi.fn();
  const button = document.createElement('button');
  button.dataset.leavesPage = '';
  button.addEventListener('click', clicked);
  document.body.append(button);
  const view = renderHook(
    ({ active }) => useSettingsExitGuard(active, request),
    { initialProps: { active: true } },
  );
  view.rerender({ active: false });
  view.rerender({ active: true });
  act(() => button.click());
  expect(request).toHaveBeenCalledTimes(1);
  expect(clicked).not.toHaveBeenCalled();
  act(() => request.mock.calls[0][0]());
  view.unmount();
  act(() => {
    window.history.replaceState(null, '', window.location.href);
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  expect(clicked).not.toHaveBeenCalled();
  button.remove();
});
