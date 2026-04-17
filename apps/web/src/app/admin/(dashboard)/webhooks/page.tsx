'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, Webhook, Zap, ShieldAlert } from 'lucide-react';

export type WebhookView = {
  id: string;
  tenantId: string;
  url: string;
  eventCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export default function WebhooksPage() {
  const { session, fetchApi } = useSession();
  const [webhooks, setWebhooks] = useState<WebhookView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<WebhookView[]>('/webhooks');
      setWebhooks(res.data || []);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetchApi('/webhooks', {
        method: 'POST',
        body: JSON.stringify({
          url: fd.get('url'),
          eventCode: fd.get('eventCode'),
          secret: fd.get('secret') || undefined,
        }),
      });
      setShowForm(false);
      void load();
    } catch (err: any) {
      alert(`Error al crear webhook: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Seguro quieres eliminar este webhook?')) return;
    try {
      await fetchApi(`/webhooks/${id}`, { method: 'DELETE' });
      void load();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  }

  async function handleTest(id: string) {
    try {
      await fetchApi(`/webhooks/${id}/test`, { method: 'POST' });
      alert('Evento de prueba enviado correctamente a la URL suscrita.');
    } catch (err: any) {
      alert(`Error enviando prueba: ${err.message}`);
    }
  }

  if (!session?.user.roles.includes('admin')) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center">
        <ShieldAlert className="h-10 w-10 text-destructive mb-4" />
        <h2 className="font-body text-lg font-bold">Acceso Denegado</h2>
        <p className="text-muted-foreground">Solo administradores pueden ver esta sección.</p>
      </div>
    );
  }

  return (
    <>
      <DashboardHeader title="Notificaciones (Webhooks)" description="Integra y envía eventos de tus testimonios a aplicaciones externas en tiempo real.">
        <Button
          onClick={() => setShowForm(!showForm)}
          className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Nuevo Webhook
        </Button>
        <Button
          variant="ghost"
          onClick={() => void load()}
          className="h-10 font-body text-xs uppercase tracking-wider"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">URL de Destino</Label>
            <Input name="url" type="url" required className="h-10 bg-transparent" placeholder="https://api.miproyecto.com/webhooks/..." />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Secret KEY (Opcional, Hmac)</Label>
            <Input name="secret" type="password" className="h-10 bg-transparent" placeholder="Llave de firma" />
          </div>
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Evento a Suscribir</Label>
            <select name="eventCode" required className="h-10 border bg-transparent font-body text-sm px-3 focus:outline-none focus:ring-1 focus:ring-primary w-full">
              <option value="testimonial.created" className="text-black">1. Nuevo Testimonio Creado (testimonial.created)</option>
              <option value="testimonial.published" className="text-black">2. Testimonio Publicado (testimonial.published)</option>
            </select>
          </div>
          <div className="grid gap-2 sm:col-span-2 items-end">
            <Button type="submit" disabled={createLoading} className="h-10 bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground w-full sm:w-auto ml-auto">
              {createLoading ? 'Creando...' : 'Crear Webhook'}
            </Button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : webhooks.length === 0 ? (
        <div className="border border-dashed p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">No tienes webhooks activos configurados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Endpoint URL</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Suscrito A</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-right font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Controles</th>
              </tr>
            </thead>
            <tbody>
              {webhooks.map((w) => (
                <tr key={w.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground flex items-center gap-2 max-w-[200px] truncate">
                    <Webhook className="h-4 w-4 shrink-0 text-muted-foreground"/> {w.url}
                  </td>
                  <td className="py-4 pr-4">
                    <span className="inline-block border px-2 py-0.5 font-mono text-[10px] bg-muted/20">
                      {w.eventCode}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                      w.isActive ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
                    )}>
                      {w.isActive ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleTest(w.id)} className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-500">
                        <Zap className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleRemove(w.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
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
