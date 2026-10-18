'use client';

import { useEffect, useRef } from 'react';

/** A same-URL sentinel lets Back ask before React unmounts an edited form.
 * Arming/removal is serialized: a new edit cannot race a pending history.back().
 * Only a boolean enters history. Preferences remain in React memory.
 */
export function useSettingsExitGuard(
  active: boolean,
  requestExit: (leave: () => void) => void,
) {
  const current = useRef({ active, requestExit });
  current.current = { active, requestExit };
  const synchronize = useRef<() => void>(() => undefined);
  useEffect(() => {
    const url = window.location.href;
    const original = window.history.state;
    const marker = '__biSettingsExitGuard';
    let armed = false;
    let removing = false;
    let leaving = false;
    let disposed = false;
    let pendingExit: (() => void) | undefined;
    function sync() {
      if (disposed || leaving || removing) return;
      if (current.current.active && !armed) {
        window.history.pushState({ ...original, [marker]: true }, '', url);
        armed = true;
      } else if (
        !current.current.active &&
        armed &&
        window.history.state?.[marker]
      ) {
        removing = true;
        window.history.replaceState(original, '', url);
        window.history.back();
      }
    }
    synchronize.current = sync;
    function leave(task: () => void) {
      const run = () => {
        leaving = true;
        task();
      };
      if (removing) pendingExit = run;
      else run();
    }
    function beforeUnload(event: BeforeUnloadEvent) {
      if (leaving || !current.current.active) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function click(event: MouseEvent) {
      if (leaving || !current.current.active || event.button !== 0) return;
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest('button[data-leaves-page]');
      if (button instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        current.current.requestExit(() => leave(() => button.click()));
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor = target?.closest('a[href]');
      if (
        !(anchor instanceof HTMLAnchorElement) ||
        anchor.target === '_blank' ||
        anchor.hasAttribute('download')
      )
        return;
      const destination = new URL(anchor.href, url);
      if (
        !['http:', 'https:'].includes(destination.protocol) ||
        destination.href.split('#')[0] === url.split('#')[0]
      )
        return;
      event.preventDefault();
      event.stopPropagation();
      current.current.requestExit(() =>
        leave(() => window.location.replace(destination.href)),
      );
    }
    function pop(event: PopStateEvent) {
      if (removing) {
        event.stopImmediatePropagation();
        removing = false;
        armed = false;
        if (disposed) {
          pendingExit = undefined;
          window.removeEventListener('popstate', pop, true);
          return;
        }
        if (pendingExit) {
          const task = pendingExit;
          pendingExit = undefined;
          task();
        } else sync();
        return;
      }
      if (leaving || !armed) return;
      event.stopImmediatePropagation();
      if (!current.current.active) {
        armed = false;
        leaving = true;
        window.history.back();
        return;
      }
      window.history.pushState({ ...original, [marker]: true }, '', url);
      current.current.requestExit(() => leave(() => window.history.go(-2)));
    }
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop, true);
    window.addEventListener('beforeunload', beforeUnload);
    sync();
    return () => {
      disposed = true;
      synchronize.current = () => undefined;
      document.removeEventListener('click', click, true);
      window.removeEventListener('beforeunload', beforeUnload);
      if (
        !leaving &&
        armed &&
        window.location.href === url &&
        window.history.state?.[marker] &&
        !removing
      ) {
        removing = true;
        window.history.replaceState(original, '', url);
        window.history.back();
      }
      if (!removing) window.removeEventListener('popstate', pop, true);
    };
  }, []);
  useEffect(() => {
    synchronize.current();
  }, [active]);
}
