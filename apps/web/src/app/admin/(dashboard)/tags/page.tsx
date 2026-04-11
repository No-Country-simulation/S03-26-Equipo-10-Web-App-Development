'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

interface TagRecord {
  id: string;
  name: string;
  tenantId: string;
}

export default function TagsPage() {
  const { session, fetchApi } = useSession();
  const [items, setItems] = useState<TagRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<TagRecord[]>('/tags');
      setItems(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetchApi('/tags', { method: 'POST', body: JSON.stringify({ name: fd.get('name') }) });
    setShowForm(false);
    void load();
  }

  async function handleDelete(id: string) {
    await fetchApi(`/tags/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <>
      <DashboardHeader title="Etiquetas" description="Etiquetas para clasificar testimonios.">
        <Button onClick={() => setShowForm(!showForm)} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nueva
        </Button>
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 flex gap-4 border bg-card p-6">
          <div className="flex-1 grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Nombre</Label>
            <Input name="name" required className="h-10 bg-transparent" placeholder="Nombre de la etiqueta" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground">Crear</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="border border-dashed p-12 text-center"><p className="font-body text-sm text-muted-foreground">No hay etiquetas creadas.</p></div>
      ) : (
        <div className="flex flex-wrap gap-3">
          {items.map((t) => (
            <div key={t.id} className="group flex items-center gap-3 border px-4 py-2.5 transition-colors hover:bg-card">
              <span className="font-body text-sm text-foreground">{t.name}</span>
              <button onClick={() => void handleDelete(t.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5 text-destructive/60 hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
