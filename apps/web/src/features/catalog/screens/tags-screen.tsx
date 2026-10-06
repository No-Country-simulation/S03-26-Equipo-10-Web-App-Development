'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { createTag, deleteTag, listTags } from '../api';
import { PageControls } from '@/features/shared/pagination';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

interface TagRecord {
  id: string;
  name: string;
  tenantId: string;
}

export default function TagsPage() {
  const { session, fetchApi } = useSession();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mutationError, setMutationError] = useState<string | null>(null);

  const load = useCallback(async () => (await listTags(fetchApi, page)).data, [fetchApi, page]);
  const { state, reload } = useRemoteResource(load, Boolean(session));
  const items: TagRecord[] = state.status === 'success' ? state.data.items : [];
  const total = state.status === 'success' ? state.data.meta.total : 0;

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setSaving(true);
    setMutationError(null);
    try {
      await createTag(fetchApi, String(fd.get('name') ?? '').trim());
      setShowForm(false);
      reload();
    } catch (error) {
      setMutationError(actionFailureCopy(error, 'la creación de la etiqueta'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setMutationError(null);
    try {
      await deleteTag(fetchApi, id);
      reload();
    } catch (error) {
      setMutationError(actionFailureCopy(error, 'la eliminación de la etiqueta'));
    }
  }

  return (
    <>
      <DashboardHeader title="Etiquetas" description="Etiquetas para clasificar testimonios.">
        <Button onClick={() => setShowForm(!showForm)} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nueva
        </Button>
        <Button variant="ghost" onClick={reload} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {mutationError && <p role="alert" className="mb-6 border border-destructive p-4 font-body text-sm">{mutationError}</p>}
      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 flex flex-col gap-4 border bg-card p-6 sm:flex-row">
          <div className="flex-1 grid gap-2">
            <Label htmlFor="tag-name" className="font-body text-xs font-bold uppercase tracking-widest">Nombre</Label>
            <Input id="tag-name" name="name" required className="h-10 bg-transparent" placeholder="Nombre de la etiqueta" />
          </div>
          <div className="flex items-end">
            <Button type="submit" disabled={saving} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground">{saving ? 'Creando...' : 'Crear'}</Button>
          </div>
        </form>
      )}

      {state.status === 'loading' ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : state.status === 'error' ? (
        <LoadFailure error={state.error} resource="las etiquetas" onRetry={reload} />
      ) : items.length === 0 ? (
        <div className="border border-dashed p-12 text-center"><p className="font-body text-sm text-muted-foreground">No hay etiquetas creadas.</p></div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 border px-4 py-2.5 transition-colors hover:bg-card">
              <span className="font-body text-sm text-foreground">{t.name}</span>
              <button type="button" aria-label={`Eliminar etiqueta ${t.name}`} onClick={() => void handleDelete(t.id)} className="flex h-8 w-8 items-center justify-center text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100">
                <Trash2 aria-hidden="true" className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {state.status === 'success' && <PageControls page={page} total={total} limit={20} onChange={setPage} />}
    </>
  );
}
