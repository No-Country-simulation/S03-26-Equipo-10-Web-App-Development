'use client';

import { useEffect, useRef } from 'react';

/** A same-URL history entry makes ordinary Back a guarded exit, also in App Router.
 * Only a boolean is put in history; the credential always stays in React memory.
 */
export function useKeyExitGuard(
  active: boolean,
  requestExit: (leave: () => void) => void,
) {
  const request = useRef(requestExit);
  request.current = requestExit;
  useEffect(() => {
    if (!active) return;
    const url = window.location.href;
    const original = window.history.state;
    const marker = '__apiKeyExitGuard';
    let leaving = false;
    window.history.pushState({ ...original, [marker]: true }, '', url);
    function beforeUnload(event: BeforeUnloadEvent) {
      if (leaving) return;
      event.preventDefault();
      event.returnValue = '';
    }
    function click(event: MouseEvent) {
      if (leaving || event.button !== 0) return;
      const exitButton =
        event.target instanceof Element
          ? event.target.closest('button[data-leaves-page]')
          : null;
      if (exitButton instanceof HTMLButtonElement) {
        event.preventDefault();
        event.stopPropagation();
        request.current(() => {
          leaving = true;
          exitButton.click();
        });
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return;
      const anchor =
        event.target instanceof Element
          ? event.target.closest('a[href]')
          : null;
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
      request.current(() => {
        leaving = true;
        // Replace the guard entry: Back still returns to this screen exactly once.
        window.location.replace(destination.href);
      });
    }
    function pop(event: PopStateEvent) {
      if (leaving) return;
      event.stopImmediatePropagation();
      window.history.pushState({ ...original, [marker]: true }, '', url);
      request.current(() => {
        leaving = true;
        window.history.go(-2);
      });
    }
    document.addEventListener('click', click, true);
    window.addEventListener('popstate', pop, true);
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      document.removeEventListener('click', click, true);
      window.removeEventListener('popstate', pop, true);
      window.removeEventListener('beforeunload', beforeUnload);
      if (
        !leaving &&
        window.location.href === url &&
        window.history.state?.[marker]
      ) {
        window.history.replaceState(original, '', url);
        window.history.back();
      }
    };
  }, [active]);
}
