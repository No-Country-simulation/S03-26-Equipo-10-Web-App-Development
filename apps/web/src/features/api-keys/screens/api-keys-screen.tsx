'use client';

import { useCallback, useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';
import { createApiKey, listApiKeys, revokeApiKey, rotateApiKey } from '../api';

export type ApiKeyView = {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  publicId: string | null;
  scopes: Array<'testimonials:read' | 'analytics:write'>;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  legacy: boolean;
  expiresAt: string | null;
  legacyDeadline: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ApiKeysPage() {
  const { session, fetchApi } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [rotationTarget, setRotationTarget] = useState<ApiKeyView | null>(null);
  const [createLoading, setCreateLoading] = useState(false);
  
  // State to hold the newly generated raw token
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await listApiKeys(fetchApi);
      setApiKeys(res.data || []);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }, [fetchApi]);

  useEffect(() => { if (session) void load(); }, [session, load]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    setNewRawToken(null);
    setCopied(false);
    const fd = new FormData(e.currentTarget);
    try {
      const expiry = fd.get('expiresAt');
      const input = {
        name: String(fd.get('name') ?? ''),
        scopes: fd.getAll('scopes').map(String).filter((value): value is 'testimonials:read' | 'analytics:write' =>
          value === 'testimonials:read' || value === 'analytics:write'),
        ...(expiry ? { expiresAt: new Date(String(expiry)).toISOString() } : {}),
      };
      if (input.scopes.length === 0) throw new Error('Elegí al menos un permiso');
      const res = rotationTarget
        ? await rotateApiKey(fetchApi, rotationTarget.id, input)
        : await createApiKey(fetchApi, input);
      setNewRawToken(res.data.apiKey);
      setShowForm(false);
      setRotationTarget(null);
      void load();
    } catch (err) {
      alert(`Error al generar token: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Estás SEGURO de revocar esta API Key? Dejará de funcionar en cualquier aplicación que la esté utilizando.')) return;
    try {
      await revokeApiKey(fetchApi, id);
      void load();
    } catch (err) {
      alert(`Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function startRotation(key: ApiKeyView) {
    setRotationTarget(key);
    setShowForm(true);
    setNewRawToken(null);
  }

  const copyToClipboard = () => {
    if (newRawToken) {
      navigator.clipboard.writeText(newRawToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

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
      <DashboardHeader title="API Keys" description="Gestiona los tokens de acceso para conectar aplicaciones externas.">
        <Button
          onClick={() => { setRotationTarget(null); setShowForm(!showForm); }}
          className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" /> Generar Token
        </Button>
        <Button
          variant="ghost"
          onClick={() => void load()}
          className="h-10 font-body text-xs uppercase tracking-wider"
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {newRawToken && (
        <div className="mb-8 border-l-4 border-primary bg-primary/10 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="font-body text-sm font-bold text-foreground">Tu API Key ha sido generada exitosamente</h3>
            <p className="text-xs text-muted-foreground mt-1">
              Copia este token ahora. <strong className="text-foreground">Por razones de seguridad, no volverá a mostrarse nunca más.</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <code className="text-sm border border-primary/20 bg-background px-4 py-2 font-mono flex-1 sm:w-80 truncate">
              {newRawToken}
            </code>
            <Button onClick={copyToClipboard} variant="outline" className="h-10 w-10 p-0 shrink-0">
              {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
            </Button>
          </div>
        </div>
      )}

      {showForm && (
        <form key={rotationTarget?.id ?? 'create'} onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-3 items-end">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Nombre Descriptivo</Label>
            <Input name="name" required defaultValue={rotationTarget?.name ?? ''} className="h-10 bg-transparent" placeholder="Ej. Integración App Móvil, Servidor Nodejs..." minLength={2} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="api-key-expiry" className="font-body text-[10px] font-bold uppercase tracking-widest">Expira (opcional)</Label>
            <Input id="api-key-expiry" name="expiresAt" type="datetime-local" defaultValue={rotationTarget?.expiresAt?.slice(0, 16) ?? ''} className="h-10 bg-transparent" />
          </div>
          <fieldset className="sm:col-span-3 flex flex-wrap gap-4 text-sm">
            <legend className="font-body text-[10px] font-bold uppercase tracking-widest mb-2">Permisos</legend>
            <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="testimonials:read" defaultChecked={!rotationTarget || rotationTarget.legacy || rotationTarget.scopes.includes('testimonials:read')} /> Leer testimonios</label>
            <label className="flex items-center gap-2"><input type="checkbox" name="scopes" value="analytics:write" defaultChecked={rotationTarget?.legacy || rotationTarget?.scopes.includes('analytics:write') || false} /> Escribir analítica</label>
          </fieldset>
          <Button type="submit" disabled={createLoading} className="h-10 bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground">
            {createLoading ? 'Generando...' : rotationTarget ? 'Rotar API Key' : 'Crear API Key'}
          </Button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : apiKeys.length === 0 ? (
        <div className="border border-dashed p-12 text-center">
          <p className="font-body text-sm text-muted-foreground">No tienes ninguna API Key activa.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Último Uso</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</th>
                <th className="pb-3 text-left font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Permisos y vencimiento</th>
                <th className="pb-3 text-right font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground"/> {key.name}
                    <span className="text-xs text-muted-foreground">{key.publicId ?? 'tms_ legado'}</span>
                  </td>
                  <td className="py-4 pr-4 text-sm text-muted-foreground">
                    {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : 'Nunca'}
                  </td>
                  <td className="py-4 pr-4">
                    <span className={cn(
                      'inline-block px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider',
                      key.isActive ? 'bg-green-500/20 text-green-600' : 'bg-destructive/20 text-destructive'
                    )}>
                      {key.isActive ? 'Activo' : 'Revocado'}
                    </span>
                    {key.legacy && <p className="mt-1 text-xs text-amber-700">Clave legada: migrá antes de {key.legacyDeadline ? new Date(key.legacyDeadline).toLocaleString() : 'activar la ventana de 30 días'}.</p>}
                  </td>
                  <td className="py-4 pr-4 text-xs text-muted-foreground">
                    {key.scopes.length ? key.scopes.join(', ') : 'Permisos legados'}
                    <br />{key.expiresAt ? `Expira ${new Date(key.expiresAt).toLocaleString()}` : 'Sin vencimiento'}
                  </td>
                  <td className="py-4 text-right">
                    {key.isActive && (
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="sm" onClick={() => startRotation(key)} className="font-body text-xs tracking-wider uppercase">Rotar</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)} className="text-destructive font-body text-xs tracking-wider uppercase hover:bg-destructive/10 hover:text-destructive">Revocar</Button>
                      </div>
                    )}
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
