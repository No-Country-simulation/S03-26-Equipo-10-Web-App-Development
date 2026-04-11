'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react';

interface WebhookRecord {
  id: string;
  url: string;
  eventCode?: string;
  isActive: boolean;
  createdAt: string;
}

export default function WebhooksPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [items, setItems] = useState<WebhookRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<WebhookRecord[]>('/webhooks');
      setItems(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetchApi('/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url: fd.get('url'), eventId: Number(fd.get('eventId')) }),
    });
    setShowForm(false);
    void load();
  }

  async function handleDelete(id: string) {
    await fetchApi(`/webhooks/${id}`, { method: 'DELETE' });
    void load();
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="mx-auto mb-4 h-10 w-10 text-destructive/50" />
          <p className="font-body text-sm uppercase tracking-widest text-muted-foreground">Acceso restringido a administradores</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader title="Webhooks" description="Configura notificaciones automáticas a sistemas externos.">
        <Button onClick={() => setShowForm(!showForm)} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-2 h-4 w-4" /> Nuevo
        </Button>
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-3">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">URL</Label>
            <Input name="url" type="url" required className="h-10 bg-transparent" placeholder="https://ejemplo.com/webhook" />
          </div>
          <div className="grid gap-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Evento</Label>
            <div className="flex gap-2">
              <select name="eventId" className="h-10 flex-1 border bg-transparent px-3 font-body text-sm text-foreground">
                <option value="1">testimonial.published</option>
                <option value="2">testimonial.created</option>
              </select>
              <Button type="submit" className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground">Crear</Button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="border border-dashed p-12 text-center"><p className="font-body text-sm text-muted-foreground">No hay webhooks configurados.</p></div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">URL</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creado</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((w) => (
                <tr key={w.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-mono text-sm text-foreground">{w.url}</td>
                  <td className="py-4 pr-4">
                    <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', w.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/20 text-destructive')}>
                      {w.isActive ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td className="py-4 pr-4 font-body text-xs text-muted-foreground">{new Date(w.createdAt).toLocaleDateString()}</td>
                  <td className="py-4">
                    <button onClick={() => void handleDelete(w.id)}><Trash2 className="h-4 w-4 text-destructive/60 hover:text-destructive" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
