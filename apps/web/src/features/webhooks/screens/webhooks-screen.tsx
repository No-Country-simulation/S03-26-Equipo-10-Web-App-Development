'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, Trash2, Webhook, Zap, ShieldAlert, Copy } from 'lucide-react';
import { createWebhook, deleteWebhook, listWebhookDeliveries, listWebhooks, replayWebhookDelivery, rotateWebhookSecret, testWebhook } from '../api';
import { PageControls } from '@/features/shared/pagination';

export type WebhookView = {
  id: string;
  tenantId: string;
  url: string;
  eventCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  hasSignature: boolean;
  signatureGraceUntil: string | null;
  legacyHttp?: { deadlineAt: string | null; canDeliver: boolean } | null;
  legacyUnsigned?: { deadlineAt: string | null; canDeliver: boolean } | null;
  legacySignatureUntil?: string | null;
};

type DeliveryView = {
  id: string;
  status: string;
  attempts: number;
  responseCode: number | null;
  createdAt: string;
};

export default function WebhooksPage() {
  const { session, fetchApi } = useSession();
  const [webhooks, setWebhooks] = useState<WebhookView[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [selectedWebhookId, setSelectedWebhookId] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<DeliveryView[]>([]);
  const [deliveryPage, setDeliveryPage] = useState(1);
  const [deliveryTotal, setDeliveryTotal] = useState(0);
  const [newSigningSecret, setNewSigningSecret] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listWebhooks(fetchApi, page);
      setWebhooks(res.data.items);
      setTotal(res.data.meta.total);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }, [fetchApi, page]);

  useEffect(() => { if (session) void load(); }, [session, load]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const result = await createWebhook(fetchApi, {
        url: fd.get('url'),
        eventCode: fd.get('eventCode'),
      });
      setNewSigningSecret(result.data.signingSecret);
      setShowForm(false);
      void load();
    } catch (err) {
      alert(`Error al crear webhook: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRotateSecret(id: string) {
    if (!confirm('¿Rotar el secreto de firma? El anterior tendrá 24 horas de gracia.')) return;
    try {
      const result = await rotateWebhookSecret(fetchApi, id);
      setNewSigningSecret(result.data.signingSecret);
      void load();
    } catch (err) {
      alert(`Error al rotar el secreto: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('¿Seguro quieres eliminar este webhook?')) return;
    try {
      await deleteWebhook(fetchApi, id);
      void load();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function handleTest(id: string) {
    try {
      await testWebhook(fetchApi, id);
      alert('Evento de prueba encolado. Revisá el historial para ver el resultado de la entrega.');
    } catch (err) {
      alert(`Error enviando prueba: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function showDeliveries(webhookId: string, requestedPage = 1) {
    try {
      const res = await listWebhookDeliveries(fetchApi, webhookId, requestedPage);
      setSelectedWebhookId(webhookId);
      setDeliveries(res.data.items);
      setDeliveryPage(requestedPage);
      setDeliveryTotal(res.data.meta.total);
    } catch (err) {
      alert(`Error cargando entregas: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async function replayDelivery(deliveryId: string) {
    if (!selectedWebhookId) return;
    try {
      await replayWebhookDelivery(fetchApi, selectedWebhookId, deliveryId);
      await showDeliveries(selectedWebhookId, deliveryPage);
    } catch (err) {
      alert(`Error reenviando entrega: ${err instanceof Error ? err.message : String(err)}`);
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

      {newSigningSecret && (
        <div role="status" className="mb-6 border-l-4 border-primary bg-primary/10 p-4">
          <p className="font-body text-sm font-bold">Copiá el secreto de firma ahora. No volverá a mostrarse.</p>
          <div className="mt-2 flex gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto border bg-background p-2 text-xs">{newSigningSecret}</code>
            <Button type="button" variant="outline" onClick={() => void navigator.clipboard.writeText(newSigningSecret)}
              aria-label="Copiar secreto de firma"><Copy className="h-4 w-4" /></Button>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-4">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">URL de Destino</Label>
            <Input name="url" type="url" pattern="https://.*" required className="h-10 bg-transparent" placeholder="https://api.miproyecto.com/webhooks/..." />
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
          <p className="font-body text-sm text-muted-foreground">No hay destinos webhook configurados.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          {webhooks.some(w => w.legacyHttp || w.legacyUnsigned) && (
            <p role="alert" className="mb-4 border border-amber-500/50 bg-amber-500/10 p-3 font-body text-sm">
              Los destinos HTTP deben migrarse a HTTPS y los destinos sin firma deben rotar su secreto antes de su plazo de 30 días.
            </p>
          )}
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
                    {w.legacyHttp && (
                      <span className="block text-xs text-amber-600">
                        {w.legacyHttp.canDeliver
                          ? `HTTP legado: migrá a HTTPS antes del ${w.legacyHttp.deadlineAt ?? 'plazo configurado'}`
                          : 'HTTP legado: envío bloqueado; migrá a HTTPS'}
                      </span>
                    )}
                    {w.legacyUnsigned && (
                      <span className="block text-xs text-amber-600">
                        {w.legacyUnsigned.canDeliver
                          ? `Sin firma: rotá el secreto antes del ${w.legacyUnsigned.deadlineAt ?? 'plazo configurado'}`
                          : 'Sin firma: envío bloqueado; rotá el secreto'}
                      </span>
                    )}
                  </td>
                  <td className="py-4 pr-4">
                    <span className="inline-block border px-2 py-0.5 font-mono text-[10px] bg-muted/20">
                      {w.eventCode}
                    </span>
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                      w.isActive && !w.deletedAt ? 'bg-green-500/20 text-green-600' : 'bg-muted text-muted-foreground'
                    )}>
                      {w.deletedAt ? 'Archivado' : w.isActive ? 'Activo' : 'Pausado'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="flex justify-end gap-1">
                      {!w.deletedAt && (
                        <Button variant="ghost" size="sm" onClick={() => handleTest(w.id)} className="text-blue-500 hover:bg-blue-500/10 hover:text-blue-500">
                          <Zap className="h-4 w-4" />
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => void showDeliveries(w.id)}>
                        Historial
                      </Button>
                      {!w.deletedAt && (
                        <Button variant="ghost" size="sm" onClick={() => void handleRotateSecret(w.id)}>
                          Rotar secreto
                        </Button>
                      )}
                      {!w.deletedAt && (
                        <Button variant="ghost" size="sm" onClick={() => handleRemove(w.id)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedWebhookId && (
            <section className="mt-6 border bg-card p-4" aria-label="Historial de entregas">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-body text-sm font-bold">Entregas recientes</h2>
                <Button variant="ghost" size="sm" onClick={() => void showDeliveries(selectedWebhookId)}>
                  Actualizar
                </Button>
              </div>
              {deliveries.length === 0 ? (
                <p className="font-body text-sm text-muted-foreground">Todavía no hay entregas.</p>
              ) : (
                <ul className="space-y-2">
                  {deliveries.map(delivery => (
                    <li key={delivery.id} className="flex flex-wrap items-center gap-3 border-b py-2 font-body text-sm">
                      <span className={delivery.status === 'dead' ? 'font-bold text-destructive' : ''}>
                        {delivery.status}
                      </span>
                      <span>{delivery.attempts} intento(s)</span>
                      <span>HTTP {delivery.responseCode ?? 'sin respuesta'}</span>
                      <time dateTime={delivery.createdAt}>{new Date(delivery.createdAt).toLocaleString()}</time>
                      {delivery.status === 'dead' && (
                        <Button variant="outline" size="sm" onClick={() => void replayDelivery(delivery.id)}>
                          Reenviar
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              <PageControls page={deliveryPage} total={deliveryTotal} limit={20}
                onChange={(next) => void showDeliveries(selectedWebhookId, next)} />
            </section>
          )}
        </div>
      )}
      <PageControls page={page} total={total} limit={20} onChange={setPage} />
    </>
  );
}
