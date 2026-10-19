'use client';

import { useCallback, useId, useState } from 'react';
import { listCategories, listTags } from '@/features/catalog/api';
import type { SessionFetch } from '@/lib/api/validated-response';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageControls } from '@/features/shared/pagination';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { LoadingState } from '@/features/shared/feedback';
import { LoadFailure } from '@/features/shared/load-failure';

export function CatalogFilter({
  kind,
  selected,
  onChange,
  fetchApi,
  enabled,
}: {
  kind: 'categories' | 'tags';
  selected: string[];
  onChange: (ids: string[]) => void;
  fetchApi: SessionFetch;
  enabled: boolean;
}) {
  const label = kind === 'categories' ? 'Categorías' : 'Etiquetas';
  const id = useId();
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState('');
  const [q, setQ] = useState('');
  const load = useCallback(
    async () =>
      (
        await (kind === 'categories' ? listCategories : listTags)(
          fetchApi,
          page,
          10,
          q,
        )
      ).data,
    [fetchApi, kind, page, q],
  );
  const { state, reload } = useRemoteResource(load, enabled && open);
  return (
    <details
      className="min-w-0 border p-4"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="cursor-pointer font-body text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
        {label}
        {selected.length > 0
          ? ` · ${selected.length} aplicada${selected.length === 1 ? '' : 's'}`
          : ' · Todas'}
      </summary>
      <div className="mt-4 space-y-4">
        <p className="font-body text-sm text-muted-foreground">
          Cantidades de asociaciones en todo el espacio.
          {kind === 'tags' &&
            ' El testimonio debe tener todas las etiquetas elegidas.'}
        </p>
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            setQ(draft.trim());
            setPage(1);
          }}
        >
          <div className="min-w-0 flex-1">
            <label htmlFor={id} className="mb-2 block font-body text-sm">
              Buscar {label.toLowerCase()}
            </label>
            <Input
              id={id}
              maxLength={200}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />
          </div>
          <Button type="submit" variant="outline">
            Buscar en {label.toLowerCase()}
          </Button>
        </form>
        {selected.length > 0 && (
          <Button type="button" variant="outline" onClick={() => onChange([])}>
            Quitar {label.toLowerCase()} aplicadas
          </Button>
        )}
        {open &&
          (state.status === 'loading' ? (
            <LoadingState>Cargando {label.toLowerCase()}…</LoadingState>
          ) : state.status === 'error' ? (
            <LoadFailure
              error={state.error}
              resource={label.toLowerCase()}
              onRetry={reload}
            />
          ) : (
            <>
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={label}
              >
                {state.data.items.map((item) => (
                  <Button
                    key={item.id}
                    type="button"
                    variant={selected.includes(item.id) ? 'default' : 'outline'}
                    aria-pressed={selected.includes(item.id)}
                    className="h-auto min-h-11 max-w-full whitespace-normal text-left"
                    onClick={() =>
                      onChange(
                        selected.includes(item.id)
                          ? selected.filter((id) => id !== item.id)
                          : kind === 'categories'
                            ? [item.id]
                            : [...selected, item.id],
                      )
                    }
                    disabled={
                      kind === 'tags' &&
                      selected.length >= 20 &&
                      !selected.includes(item.id)
                    }
                  >
                    {item.name}
                    {item.testimonialCount !== undefined
                      ? ` (${item.testimonialCount})`
                      : ''}
                  </Button>
                ))}
              </div>
              {state.data.items.length === 0 && (
                <p className="font-body text-sm">
                  No hay coincidencias en este catálogo.
                </p>
              )}
              <PageControls
                page={page}
                total={state.data.meta.total}
                limit={10}
                onChange={setPage}
              />
            </>
          ))}
      </div>
    </details>
  );
}
