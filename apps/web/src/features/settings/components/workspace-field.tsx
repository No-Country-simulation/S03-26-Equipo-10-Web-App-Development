'use client';

import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ActionFeedback } from '@/features/shared/feedback';
import { actionFailureCopy } from '@/features/shared/load-failure';

/** A changed server value updates clean fields, while a local draft stays intact. */
export function WorkspaceField({
  id,
  label,
  value,
  help,
  button,
  minLength,
  maxLength,
  pattern,
  save,
}: {
  id: string;
  label: string;
  value: string;
  help: string;
  button: string;
  minLength: number;
  maxLength: number;
  pattern?: string;
  save: (value: string) => Promise<void>;
}) {
  const [edit, setEdit] = useState({ base: value, draft: value });
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = edit.draft !== edit.base;
  const draft = dirty ? edit.draft : value;
  return (
    <form
      aria-label={`Editar ${label.toLowerCase()}`}
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        if (lock.current || draft === value) return;
        lock.current = true;
        setBusy(true);
        setError(null);
        setMessage(null);
        try {
          await save(draft);
          setEdit({ base: draft, draft });
          setMessage(
            `${label === 'Nombre del espacio' ? 'Nombre' : 'Enlace'} guardado.`,
          );
        } catch (failure) {
          setError(
            actionFailureCopy(failure, `el cambio de ${label.toLowerCase()}`),
          );
        } finally {
          lock.current = false;
          setBusy(false);
          requestAnimationFrame(() => {
            if (
              document.activeElement === document.body ||
              form.contains(document.activeElement)
            )
              input.current?.focus();
          });
        }
      }}
      className="max-w-2xl space-y-3 font-body"
      aria-busy={busy}
    >
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <p id={`${id}-help`} className="text-sm text-muted-foreground">
        {help}
      </p>
      <input
        ref={input}
        id={id}
        value={draft}
        required
        minLength={minLength}
        maxLength={maxLength}
        pattern={pattern}
        disabled={busy}
        aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
        aria-invalid={error ? true : undefined}
        onChange={(event) => {
          setEdit({ base: value, draft: event.target.value });
          setError(null);
          setMessage(null);
        }}
        className="min-h-11 w-full min-w-0 border bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      />
      <div className="flex flex-wrap gap-3">
        <Button type="submit" disabled={busy || draft === value}>
          {busy ? 'Guardando…' : button}
        </Button>
        {draft !== value && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setEdit({ base: value, draft: value });
              setError(null);
              setMessage(null);
            }}
          >
            Descartar cambios
          </Button>
        )}
      </div>
      {error && (
        <div id={`${id}-error`}>
          <ActionFeedback>{error}</ActionFeedback>
        </div>
      )}
      {message && <ActionFeedback kind="success">{message}</ActionFeedback>}
    </form>
  );
}
