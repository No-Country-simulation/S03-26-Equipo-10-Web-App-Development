'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FeatureFlag {
  id: string;
  name: string;
  enabled?: boolean;
}

interface TenantInfo {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [tenantRes, flagsRes] = await Promise.all([
        fetchApi<TenantInfo>(`/tenants/${session?.user.tenantId}`),
        fetchApi<FeatureFlag[]>('/feature-flags'),
      ]);
      setTenant(tenantRes.data);
      setFlags(flagsRes.data);
    } catch { /* handled */ } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (session) void load(); }, [session]);

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
      <DashboardHeader title="Configuración" description="Información del tenant y feature flags.">
        <Button variant="ghost" onClick={() => void load()} className="h-10 font-body text-xs uppercase tracking-wider">
          <RefreshCw className="mr-2 h-4 w-4" /> Refrescar
        </Button>
      </DashboardHeader>

      {loading ? (
        <div className="flex items-center gap-3 py-20">
          <div className="h-5 w-5 animate-spin border-2 border-primary border-t-transparent" />
          <span className="font-body text-sm text-muted-foreground">Cargando...</span>
        </div>
      ) : (
        <div className="grid gap-8">
          {/* Tenant Info */}
          <div>
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Tenant
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border p-6">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre</span>
                <p className="mt-2 font-caption text-2xl font-light italic text-foreground">{tenant?.name ?? '—'}</p>
              </div>
              <div className="border p-6">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado</span>
                <p className="mt-2">
                  <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', tenant?.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/20 text-destructive')}>
                    {tenant?.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </p>
              </div>
              <div className="border p-6">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Creado</span>
                <p className="mt-2 font-body text-sm text-foreground">{tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString() : '—'}</p>
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div>
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Feature Flags
            </h2>
            {flags.length === 0 ? (
              <div className="border border-dashed p-12 text-center">
                <p className="font-body text-sm text-muted-foreground">No hay feature flags disponibles.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {flags.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border p-5 transition-colors hover:bg-card">
                    <div>
                      <span className="font-body text-sm font-medium text-foreground">{f.name}</span>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {f.name === 'enable_analytics' && 'Habilita el módulo de analítica para este tenant.'}
                        {f.name === 'enable_webhooks' && 'Permite configurar webhooks para notificaciones externas.'}
                        {f.name === 'enable_scoring' && 'Activa el cálculo automático de scoring de testimonios.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-body text-[10px] font-bold uppercase tracking-wider', f.enabled ? 'text-primary' : 'text-muted-foreground')}>
                        {f.enabled ? 'On' : 'Off'}
                      </span>
                      {f.enabled ? (
                        <ToggleRight className="h-6 w-6 text-primary" />
                      ) : (
                        <ToggleLeft className="h-6 w-6 text-muted-foreground/40" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
