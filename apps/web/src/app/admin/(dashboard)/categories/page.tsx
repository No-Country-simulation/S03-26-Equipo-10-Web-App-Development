'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';

interface Category {
  id: string;
  name: string;
  tenantId: string;
}

export default function CategoriesPage() {
  const { session, fetchApi } = useSession();
  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<Category[]>('/categories');
      setItems(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetchApi('/categories', { method: 'POST', body: JSON.stringify({ name: fd.get('name') }) });
    setShowForm(false);
    void load();
  }

  async function handleDelete(id: string) {
    await fetchApi(`/categories/${id}`, { method: 'DELETE' });
    void load();
  }

  return (
    <>
      <DashboardHeader title="Categorías" description="Organiza tus testimonios por categoría.">
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
            <Input name="name" required className="h-10 bg-transparent" placeholder="Nombre de la categoría" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground">Crear</Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="border border-dashed p-12 text-center"><p className="font-body text-sm text-muted-foreground">No hay categorías creadas.</p></div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((c) => (
            <div key={c.id} className="group flex items-center justify-between border p-5 transition-colors hover:bg-card">
              <span className="font-body text-sm font-medium text-foreground">{c.name}</span>
              <button onClick={() => void handleDelete(c.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                <Trash2 className="h-4 w-4 text-destructive/60 hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
