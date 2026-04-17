'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { Plus, RefreshCw, KeyRound, Copy, Check, ShieldAlert } from 'lucide-react';

export type ApiKeyView = {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ApiKeysPage() {
  const { session, fetchApi } = useSession();
  const [apiKeys, setApiKeys] = useState<ApiKeyView[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  
  // State to hold the newly generated raw token
  const [newRawToken, setNewRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<ApiKeyView[]>('/api-keys');
      setApiKeys(res.data || []);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setCreateLoading(true);
    setNewRawToken(null);
    setCopied(false);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetchApi<{ apiKey: string }>('/api-keys', {
        method: 'POST',
        body: JSON.stringify({
          name: fd.get('name'),
        }),
      });
      setNewRawToken(res.data.apiKey);
      setShowForm(false);
      void load();
    } catch (err: any) {
      alert(`Error al generar token: ${err.message}`);
    } finally {
      setCreateLoading(false);
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Estás SEGURO de revocar esta API Key? Dejará de funcionar en cualquier aplicación que la esté utilizando.')) return;
    try {
      await fetchApi(`/api-keys/${id}`, { method: 'DELETE' });
      void load();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
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
          onClick={() => setShowForm(!showForm)}
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
        <form onSubmit={handleCreate} className="mb-8 grid gap-4 border bg-card p-6 sm:grid-cols-3 items-end">
          <div className="grid gap-2 sm:col-span-2">
            <Label className="font-body text-[10px] font-bold uppercase tracking-widest">Nombre Descriptivo</Label>
            <Input name="name" required className="h-10 bg-transparent" placeholder="Ej. Integración App Móvil, Servidor Nodejs..." minLength={2} />
          </div>
          <Button type="submit" disabled={createLoading} className="h-10 bg-primary font-body text-xs uppercase tracking-wider text-primary-foreground">
            {createLoading ? 'Generando...' : 'Crear API Key'}
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
                <th className="pb-3 text-right font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((key) => (
                <tr key={key.id} className="border-b border-foreground/5 transition-colors hover:bg-card">
                  <td className="py-4 pr-4 font-body text-sm font-medium text-foreground flex items-center gap-2">
                    <KeyRound className="h-4 w-4 text-muted-foreground"/> {key.name}
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
                  </td>
                  <td className="py-4 text-right">
                    {key.isActive && (
                      <Button variant="ghost" size="sm" onClick={() => handleRevoke(key.id)} className="text-destructive font-body text-xs tracking-wider uppercase hover:bg-destructive/10 hover:text-destructive">
                        Revocar
                      </Button>
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
