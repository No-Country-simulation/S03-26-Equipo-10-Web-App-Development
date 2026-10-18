'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw } from 'lucide-react';
import {
  createCategory,
  createTag,
  deleteCategory,
  deleteTag,
  listCategories,
  listTags,
  renameCategory,
  renameTag,
} from '../api';
import { PageControls } from '@/features/shared/pagination';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';

type Item = {
  id: string;
  name: string;
  tenantId: string;
  testimonialCount?: number;
};
type Editor = { id?: string; name: string; originalName: string };
const operations = {
  categories: {
    list: listCategories,
    create: createCategory,
    rename: renameCategory,
    remove: deleteCategory,
    title: 'Categorías',
    singular: 'categoría',
  },
  tags: {
    list: listTags,
    create: createTag,
    rename: renameTag,
    remove: deleteTag,
    title: 'Etiquetas',
    singular: 'etiqueta',
  },
};

export function CatalogScreen({ kind }: { kind: 'categories' | 'tags' }) {
  const { session, fetchApi } = useSession();
  const config = operations[kind];
  const allowed =
    session?.user.roles.some((role) => role === 'admin' || role === 'editor') ??
    false;
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const confirmation = useActionConfirmation();
  const load = useCallback(
    async () => (await config.list(fetchApi, page, 20, q)).data,
    [config, fetchApi, page, q],
  );
  const { state, reload } = useRemoteResource(load, allowed);
  useEffect(() => {
    if (state.status === 'success') {
      const last = Math.max(1, Math.ceil(state.data.meta.total / 20));
      if (page > last) setPage(last);
    }
  }, [state, page]);
  const editingId = editor?.id;
  const editingOpen = editor !== null;
  useEffect(() => {
    if (editingOpen) nameRef.current?.focus();
  }, [editingOpen, editingId]);
  function chooseEditor(next: Editor | null) {
    if (lock.current) return;
    const change = () => {
      setEditor(next);
      setError(null);
    };
    if (editor && editor.name !== editor.originalName) {
      confirmation.confirm({
        title: 'Descartar cambios del nombre',
        description: 'Los cambios que todavía no guardaste se perderán.',
        confirmLabel: 'Descartar cambios',
        task: 'el cierre de la edición',
        destructive: false,
        action: async () => change(),
      });
    } else change();
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor || lock.current) return;
    const name = editor.name.trim();
    if (name.length < 2 || name.length > 80) {
      setError('Usá un nombre de 2 a 80 caracteres.');
      return;
    }
    lock.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const response = editor.id
        ? await config.rename(fetchApi, editor.id, name)
        : await config.create(fetchApi, name);
      setNotice(
        `${editor.id ? 'Nombre guardado' : config.singular === 'categoría' ? 'Categoría creada' : 'Etiqueta creada'}: ${response.data.name}.`,
      );
      if (!editor.id) setPage(1);
      setEditor(null);
      reload();
    } catch (cause) {
      setError(
        actionFailureCopy(cause, `el guardado de la ${config.singular}`),
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function remove(item: Item) {
    if (lock.current || editor) return;
    confirmation.confirm({
      title: `Eliminar ${config.singular} ${item.name}`,
      confirmLabel: `Eliminar ${config.singular}`,
      task: `la eliminación de la ${config.singular}`,
      description: `${item.testimonialCount === undefined ? 'Se quitará esta clasificación de los testimonios asociados.' : `Tiene ${item.testimonialCount} ${item.testimonialCount === 1 ? 'asociación' : 'asociaciones'} en todo el espacio.`} ${kind === 'categories' ? 'Los testimonios se conservan y quedan sin esta categoría.' : 'Los testimonios se conservan; sólo se quita esta etiqueta.'} Esta acción no se puede deshacer.`,
      action: async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        setError(null);
        setNotice(null);
        try {
          await config.remove(fetchApi, item.id);
          setNotice(
            `${kind === 'categories' ? 'Categoría eliminada' : 'Etiqueta eliminada'}: ${item.name}. Los testimonios se conservaron.`,
          );
          reload();
        } finally {
          lock.current = false;
          setBusy(false);
        }
      },
    });
  }
  if (session && !allowed)
    return (
      <ActionFeedback>
        No tenés permiso para gestionar este catálogo.
      </ActionFeedback>
    );
  return (
    <>
      <DashboardHeader
        title={config.title}
        description={
          kind === 'categories'
            ? 'Organizá cada testimonio con una categoría principal.'
            : 'Combiná etiquetas para encontrar testimonios por distintos temas.'
        }
      >
        <Button
          type="button"
          disabled={busy}
          onClick={() =>
            chooseEditor(editor ? null : { name: '', originalName: '' })
          }
        >
          <Plus aria-hidden="true" className="mr-2 h-4 w-4" />
          {editor ? 'Cerrar formulario' : 'Nueva'}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={reload}
        >
          <RefreshCw aria-hidden="true" className="mr-2 h-4 w-4" />
          Refrescar
        </Button>
      </DashboardHeader>
      {notice && <ActionFeedback kind="success">{notice}</ActionFeedback>}
      {error && (
        <ActionFeedback>
          <p id={`${kind}-error`}>{error}</p>
        </ActionFeedback>
      )}
      {editor && (
        <form
          onSubmit={(event) => void save(event)}
          className="mb-8 space-y-4 border bg-card p-6"
          aria-busy={busy}
        >
          <h2 className="font-body text-base font-medium">
            {editor.id
              ? `Renombrar ${config.singular}`
              : `Crear ${config.singular}`}
          </h2>
          <fieldset
            disabled={busy}
            className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-end"
          >
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <Label htmlFor={`${kind}-name`}>Nombre</Label>
              <Input
                ref={nameRef}
                id={`${kind}-name`}
                name="name"
                minLength={2}
                maxLength={80}
                required
                value={editor.name}
                onChange={(event) =>
                  setEditor({ ...editor, name: event.target.value })
                }
                aria-describedby={`${kind}-name-help${error ? ` ${kind}-error` : ''}`}
                className="mt-2"
              />
              <p
                id={`${kind}-name-help`}
                className="mt-2 font-body text-sm text-muted-foreground"
              >
                De 2 a 80 caracteres. Renombrar conserva las asociaciones.
              </p>
            </div>
            <Button type="submit">
              {busy ? 'Guardando…' : editor.id ? 'Guardar nombre' : 'Crear'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => chooseEditor(null)}
            >
              Cancelar
            </Button>
          </fieldset>
        </form>
      )}
      <form
        className="mb-6 grid grid-cols-2 items-end gap-3 sm:flex sm:flex-wrap"
        onSubmit={(event) => {
          event.preventDefault();
          setQ(search.trim());
          setPage(1);
        }}
      >
        <div className="col-span-2 min-w-0 sm:flex-1">
          <Label htmlFor={`${kind}-search`}>
            Buscar {config.title.toLowerCase()}
          </Label>
          <Input
            id={`${kind}-search`}
            value={search}
            maxLength={200}
            onChange={(event) => setSearch(event.target.value)}
            className="mt-2"
          />
        </div>
        <Button
          type="submit"
          variant="outline"
          disabled={busy}
          className={q ? undefined : 'col-span-2 sm:col-span-1'}
        >
          Buscar
        </Button>
        {q && (
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setSearch('');
              setQ('');
              setPage(1);
            }}
          >
            Limpiar búsqueda
          </Button>
        )}
      </form>
      <p className="mb-4 font-body text-sm text-muted-foreground">
        Las cantidades representan asociaciones en todo el espacio, en cualquier
        estado.
      </p>
      {state.status === 'loading' ? (
        <LoadingState>Cargando {config.title.toLowerCase()}…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource={`las ${config.title.toLowerCase()}`}
          onRetry={reload}
        />
      ) : state.data.items.length === 0 ? (
        <div className="border border-dashed p-8 font-body text-sm">
          {q
            ? 'No hay coincidencias. Probá otro nombre o limpiá la búsqueda.'
            : `Todavía no hay ${config.title.toLowerCase()}. Creá la primera para clasificar tus testimonios.`}
        </div>
      ) : (
        <ul className="divide-y border-y">
          {state.data.items.map((item) => (
            <li
              key={item.id}
              className="flex flex-col items-stretch gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <h2 className="break-words font-body text-base font-medium">
                  {item.name}
                </h2>
                <p className="mt-1 font-body text-sm text-muted-foreground tabular-nums">
                  {item.testimonialCount === undefined
                    ? 'Cantidad no disponible'
                    : `${item.testimonialCount} ${item.testimonialCount === 1 ? 'testimonio asociado' : 'testimonios asociados'}`}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  aria-label={`Renombrar ${config.singular} ${item.name}`}
                  onClick={() =>
                    chooseEditor({
                      id: item.id,
                      name: item.name,
                      originalName: item.name,
                    })
                  }
                >
                  Renombrar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="text-destructive"
                  disabled={busy || Boolean(editor)}
                  aria-label={`Eliminar ${config.singular} ${item.name}`}
                  onClick={() => remove(item)}
                >
                  Eliminar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'success' && (
        <fieldset disabled={busy} className="min-w-0">
          <PageControls
            page={page}
            total={state.data.meta.total}
            limit={20}
            onChange={setPage}
          />
        </fieldset>
      )}
      {confirmation.dialog}
    </>
  );
}
