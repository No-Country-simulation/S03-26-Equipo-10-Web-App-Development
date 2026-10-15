'use client';
import { useRef } from 'react';
/** Controlled dialogs may be opened without a Radix Trigger (for example a table row). */
export function useDialogFocus() {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus() {
      origin.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null;
    },
    onCloseAutoFocus(event: Event) {
      const target = origin.current?.isConnected
        ? origin.current
        : document.getElementById('main-content');
      if (target) {
        event.preventDefault();
        target.focus();
      }
    },
  };
}
