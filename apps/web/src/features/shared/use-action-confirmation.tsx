'use client';

import { useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { ActionFeedback, LoadingState } from './feedback';
import { useDialogFocus } from './use-dialog-focus';
import { actionFailureCopy } from './load-failure';

type Confirmation = {
  title: string;
  description: string;
  confirmLabel: string;
  task: string;
  action: () => Promise<void>;
  destructive?: boolean;
};
/** Uses the active Radix primitive; keeps cancellation safe and errors in context. */
export function useActionConfirmation() {
  const [request, setRequest] = useState<Confirmation | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lock = useRef(false);
  const focus = useDialogFocus();
  async function execute() {
    if (!request || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(null);
    try {
      await request.action();
      setRequest(null);
    } catch (cause) {
      setError(actionFailureCopy(cause, request.task));
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function close() {
    if (!lock.current) setRequest(null);
  }
  return {
    confirm(next: Confirmation) {
      if (!lock.current) {
        setError(null);
        setRequest(next);
      }
    },
    dialog: (
      <AlertDialog
        open={request !== null}
        onOpenChange={(open) => {
          if (!open) close();
        }}
      >
        <AlertDialogContent
          {...focus}
          className="max-h-[90dvh] overflow-y-auto rounded-none font-body"
          onEscapeKeyDown={(event) => {
            if (lock.current) event.preventDefault();
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle>{request?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {request?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <ActionFeedback>{error}</ActionFeedback>}
          {busy && (
            <LoadingState>
              Procesando la acción. Esperá el resultado antes de cerrar.
            </LoadingState>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={close}
              >
                Cancelar
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              variant={
                request?.destructive === false ? 'default' : 'destructive'
              }
              disabled={busy}
              onClick={() => void execute()}
            >
              {busy ? 'Procesando…' : request?.confirmLabel}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ),
  };
}
