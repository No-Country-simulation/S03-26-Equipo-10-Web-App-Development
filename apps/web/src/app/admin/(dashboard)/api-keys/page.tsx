'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldAlert, KeyRound, Copy, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ApiKeyRecord {
  id: string;
  keyBase64?: string; // Solo se envía en la creación
  isActive: boolean;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [items, setItems] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetchApi<ApiKeyRecord[]>('/api-keys');
      setItems(res.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

  async function handleCreate() {
    setCreating(true);
    try {
      const res = await fetchApi<ApiKeyRecord>('/api-keys', { method: 'POST' });
      // Insertar al principio para ver la key fresca (que es la única vez que se muestra)
      setItems(current => [res.data, ...current]);
    } finally {
      setCreating(false);
    }
  }

  function handleCopy(text: string, id: string) {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
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
      <DashboardHeader title="API Keys" description="Gestiona las claves para integrar la API de Testimonial CMS.">
        <Button onClick={() => void handleCreate()} disabled={creating} className="h-10 bg-primary px-6 font-body text-xs uppercase tracking-wider text-primary-foreground hover:bg-primary/90">
          <KeyRound className="mr-2 h-4 w-4" /> {creating ? 'Generando...' : 'Nueva API Key'}
        </Button>
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      <div className="mb-8 border border-primary/20 bg-primary/5 p-6 md:p-8">
        <h3 className="mb-2 font-body text-xs font-bold uppercase tracking-widest text-primary">Importante</h3>
        <p className="max-w-3xl font-body text-sm text-foreground/80 leading-relaxed">
          Las API Keys tienen control total sobre los datos de tu tenant. Mantenlas en secreto y nunca las uses en el código frontend público. Por seguridad, la clave completa solo se mostrará una vez al momento de crearla.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center gap-3 py-20"><div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" /></div>
      ) : items.length === 0 ? (
        <div className="border border-dashed p-12 text-center"><p className="font-body text-sm text-muted-foreground">No tienes ninguna API Key activa.</p></div>
      ) : (
        <div className="grid gap-4">
          {items.map((k) => (
            <div key={k.id} className="border bg-card p-6 transition-colors hover:bg-card/80">
              <div className="mb-4 flex items-center justify-between">
                <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', k.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/20 text-destructive')}>
                  {k.isActive ? 'Activa' : 'Revocada'}
                </span>
                <span className="font-body text-xs text-muted-foreground">Creada: {new Date(k.createdAt).toLocaleDateString()}</span>
              </div>
              
              <div className="flex items-center gap-3">
                <code className="flex-1 truncate bg-background p-3 font-mono text-sm text-foreground">
                  {k.keyBase64 ?? `••••••••••••••••••••••••••••••••`}
                </code>
                {k.keyBase64 && (
                  <Button variant="outline" className="h-[46px]" onClick={() => handleCopy(k.keyBase64!, k.id)}>
                    {copiedId === k.id ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
