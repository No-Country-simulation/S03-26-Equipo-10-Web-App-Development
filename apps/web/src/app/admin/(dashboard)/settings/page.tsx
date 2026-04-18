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
  publicSlug: string | null;
  isPublicFormEnabled: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function SettingsPage() {
  const { session, fetchApi, isAdmin } = useSession();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [flags, setFlags] = useState<FeatureFlag[]>([]);
  const [loading, setLoading] = useState(true);
  const [slugInput, setSlugInput] = useState('');
  const [isSavingSlug, setIsSavingSlug] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [tenantRes, flagsRes] = await Promise.all([
        fetchApi<TenantInfo>(`/tenants/me`),
        fetchApi<FeatureFlag[]>('/feature-flags'),
      ]);
      setTenant(tenantRes.data);
      setFlags(flagsRes.data);
      setSlugInput(tenantRes.data.publicSlug ?? '');
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

  async function handleTogglePublicForm() {
    if (!tenant) return;
    try {
      const data = await fetchApi<TenantInfo>(`/tenants/me`, {
        method: 'PATCH',
        body: JSON.stringify({ isPublicFormEnabled: !tenant.isPublicFormEnabled }),
      });
      setTenant({ ...tenant, isPublicFormEnabled: data.data.isPublicFormEnabled });
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSaveSlug() {
    if (!tenant) return;
    setIsSavingSlug(true);
    try {
      const data = await fetchApi<TenantInfo>(`/tenants/me`, {
        method: 'PATCH',
        body: JSON.stringify({ publicSlug: slugInput || null }),
      });
      setTenant({ ...tenant, publicSlug: data.data.publicSlug });
    } catch (e) {
      console.error(e);
    } finally {
      setIsSavingSlug(false);
    }
  }

  const publicLink = typeof window !== 'undefined' ? `${window.location.origin}/p/${tenant?.publicSlug}` : '';

  return (
    <>
      <DashboardHeader title="Configuración" description="Información de tu espacio de trabajo y módulos opcionales.">
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
              Mi Espacio de Trabajo
            </h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border p-6">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Nombre de la Marca</span>
                <p className="mt-2 font-caption text-2xl font-light italic text-foreground">{tenant?.name ?? '—'}</p>
              </div>
              <div className="border p-6">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Estado de la Cuenta</span>
                <p className="mt-2">
                  <span className={cn('px-2 py-0.5 font-body text-[10px] font-bold uppercase tracking-wider', tenant?.isActive ? 'bg-primary/10 text-primary' : 'bg-destructive/20 text-destructive')}>
                    {tenant?.isActive ? 'Activa' : 'Inactiva'}
                  </span>
                </p>
              </div>
              <div className="border p-6 sm:col-span-3">
                <span className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Fecha de Creación</span>
                <p className="mt-2 font-body text-sm text-foreground">{tenant?.createdAt ? new Date(tenant.createdAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'}</p>
              </div>
            </div>
          </div>

          {/* Formulario Público */}
          <div>
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Buzón de Recepción Público
            </h2>
            <div className="border p-6 shadow-sm">
              <div className="flex items-center justify-between border-b pb-4 mb-4">
                <div>
                  <h3 className="font-body text-sm font-medium text-foreground">Habilitar Recepción Externa</h3>
                  <p className="text-xs text-muted-foreground mt-1">Permite que tus clientes envíen testimonios usando un enlace seguro sin necesidad de iniciar sesión.</p>
                </div>
                <div 
                  className="cursor-pointer"
                  onClick={() => void handleTogglePublicForm()}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn('font-body text-[10px] font-bold uppercase tracking-wider', tenant?.isPublicFormEnabled ? 'text-primary' : 'text-muted-foreground')}>
                      {tenant?.isPublicFormEnabled ? 'Habilitado' : 'Cerrado'}
                    </span>
                    {tenant?.isPublicFormEnabled ? (
                      <ToggleRight className="h-8 w-8 text-primary" />
                    ) : (
                      <ToggleLeft className="h-8 w-8 text-muted-foreground/40" />
                    )}
                  </div>
                </div>
              </div>

              <div className="grid gap-4">
                <div>
                  <label className="font-body text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">Enlace Personalizado</label>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 max-w-sm flex">
                      <span className="inline-flex items-center px-3 border border-r-0 bg-muted/20 text-muted-foreground text-sm font-body">/p/</span>
                      <input 
                        type="text" 
                        value={slugInput}
                        onChange={(e) => setSlugInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                        className="flex-1 w-full border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        placeholder="tu-empresa"
                      />
                    </div>
                    <Button 
                      variant="outline" 
                      onClick={() => void handleSaveSlug()}
                      disabled={isSavingSlug || slugInput === (tenant?.publicSlug ?? '')}
                      className="font-body text-xs uppercase tracking-wider"
                    >
                      {isSavingSlug ? 'Guardando...' : 'Guardar Enlace'}
                    </Button>
                  </div>
                </div>
                
                {tenant?.publicSlug && (
                  <div className="mt-2 bg-muted/10 p-4 border flex items-center justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground font-body">Tu buzón público está disponible en:</p>
                      <a href={publicLink} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline mt-1 block">
                        {publicLink}
                      </a>
                    </div>
                    <Button 
                      variant="default" 
                      onClick={() => {
                        void navigator.clipboard.writeText(publicLink);
                        alert('Enlace copiado al portapapeles');
                      }}
                      className="font-body text-xs uppercase tracking-wider"
                    >
                      Copiar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Feature Flags */}
          <div>
            <h2 className="mb-6 font-body text-xs font-bold uppercase tracking-widest text-foreground">
              Módulos Opcionales
            </h2>
            {flags.length === 0 ? (
              <div className="border border-dashed p-12 text-center">
                <p className="font-body text-sm text-muted-foreground">No hay módulos disponibles.</p>
              </div>
            ) : (
              <div className="grid gap-3">
                {flags.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border p-5 transition-colors hover:bg-card">
                    <div>
                      <span className="font-body text-sm font-medium text-foreground">
                        {f.name === 'enable_analytics' && 'Módulo de Analítica Avanzada'}
                        {f.name === 'enable_webhooks' && 'Integraciones y Webhooks'}
                        {f.name === 'enable_scoring' && 'Algoritmo de Relevancia Automático'}
                        {f.name === 'testimonials' && 'Gestor Principal de Testimonios'}
                        {!['enable_analytics', 'enable_webhooks', 'enable_scoring', 'testimonials'].includes(f.name) && f.name}
                      </span>
                      <p className="mt-1 font-body text-xs text-muted-foreground">
                        {f.name === 'enable_analytics' && 'Obtén gráficas de conversión y clics de tus widgets públicos.'}
                        {f.name === 'enable_webhooks' && 'Conecta eventos de testimonios con Slack, Zapier u otras herramientas.'}
                        {f.name === 'enable_scoring' && 'Nuestra IA puntuará y destacará automáticamente tus mejores testimonios.'}
                        {f.name === 'testimonials' && 'Permite la recepción y gestión manual de contenido.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn('font-body text-[10px] font-bold uppercase tracking-wider', f.enabled ? 'text-primary' : 'text-muted-foreground')}>
                        {f.enabled ? 'Activo' : 'Inactivo'}
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
