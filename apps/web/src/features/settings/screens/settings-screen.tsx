'use client';

import { useEffect, useRef, useState } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { updateTenant } from '../api';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { useWorkspaceIdentity } from '@/features/shared/workspace-identity';
import type { SessionFetch } from '@/lib/api/validated-response';
import { TenantLogoEditor } from '../components/tenant-logo-editor';
import { WorkspaceField } from '../components/workspace-field';
import { FeatureFlagsEditor } from '../components/feature-flags-editor';
import { useTenantSettings } from '../use-tenant-settings';

function WorkspaceSettings({
  fetchApi,
  tenantId,
}: {
  fetchApi: SessionFetch;
  tenantId: string;
}) {
  const resource = useTenantSettings(fetchApi, tenantId);
  const { tenant } = resource;
  const identity = useWorkspaceIdentity();
  const rename = identity?.rename;
  useEffect(() => {
    if (tenant?.name) rename?.(tenant.name);
  }, [tenant?.name, rename]);
  const [savingReception, setSavingReception] = useState(false);
  const receptionLock = useRef(false);
  const [receptionError, setReceptionError] = useState<string | null>(null);
  const [receptionMessage, setReceptionMessage] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);
  const confirmation = useActionConfirmation();
  async function toggleReception() {
    if (!tenant || receptionLock.current) return;
    receptionLock.current = true;
    setSavingReception(true);
    resource.beginWrite();
    setReceptionError(null);
    setReceptionMessage(null);
    try {
      const response = await updateTenant(
        fetchApi,
        { isPublicFormEnabled: !tenant.isPublicFormEnabled },
        tenantId,
      );
      resource.merge(response.data, ['isPublicFormEnabled']);
      setReceptionMessage(
        response.data.isPublicFormEnabled
          ? 'Recepción abierta.'
          : 'Recepción cerrada. La galería sigue disponible.',
      );
    } catch (failure) {
      setReceptionError(actionFailureCopy(failure, 'el cambio de recepción'));
    } finally {
      receptionLock.current = false;
      setSavingReception(false);
      resource.endWrite();
    }
  }
  const publicLink =
    tenant?.publicSlug && typeof window !== 'undefined'
      ? `${window.location.origin}/p/${tenant.publicSlug}`
      : '';
  return (
    <>
      <DashboardHeader
        title="Configuración"
        description="Identidad, recepción de testimonios y parámetros de este espacio."
      >
        <Button
          type="button"
          variant="ghost"
          disabled={resource.loading || resource.writes > 0}
          onClick={() => void resource.reload()}
        >
          <RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
          Refrescar
        </Button>
      </DashboardHeader>
      {resource.loading && (
        <LoadingState>
          {tenant
            ? 'Actualizando datos del espacio…'
            : 'Cargando datos del espacio…'}
        </LoadingState>
      )}
      {resource.error != null && (
        <LoadFailure
          error={resource.error}
          resource="los datos del espacio"
          onRetry={() => void resource.reload()}
        />
      )}
      <div className="space-y-10">
        {tenant && (
          <>
            <section
              id="brand"
              aria-labelledby="brand-title"
              className="scroll-mt-20"
            >
              <h2 id="brand-title" className="mb-5 font-display text-2xl">
                Identidad del espacio
              </h2>
              <WorkspaceField
                id="workspace-name"
                label="Nombre del espacio"
                value={tenant.name}
                help="Se muestra en el panel y en las páginas públicas. Usá entre 3 y 120 caracteres."
                button="Guardar nombre"
                minLength={3}
                maxLength={120}
                save={async (name) => {
                  resource.beginWrite();
                  try {
                    const response = await updateTenant(
                      fetchApi,
                      { name },
                      tenantId,
                    );
                    resource.merge(response.data, ['name']);
                    identity?.rename(response.data.name);
                  } finally {
                    resource.endWrite();
                  }
                }}
              />
              <p className="mt-5 font-body text-sm text-muted-foreground">
                Cuenta {tenant.isActive ? 'activa' : 'inactiva'} · Creada el{' '}
                {new Date(tenant.createdAt).toLocaleDateString('es-AR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                .
              </p>
            </section>
            <TenantLogoEditor
              key={tenant.id}
              tenantId={tenant.id}
              name={tenant.name}
              logoUrl={tenant.logoUrl}
              fetchApi={fetchApi}
              onMutationStart={resource.beginWrite}
              onMutationEnd={resource.endWrite}
              onSaved={(response) => resource.merge(response, ['logoUrl'])}
            />
            <section
              id="capture"
              aria-labelledby="capture-title"
              className="scroll-mt-20 border-t pt-8"
            >
              <h2 id="capture-title" className="mb-5 font-display text-2xl">
                Enlace y recepción
              </h2>
              <WorkspaceField
                id="public-slug"
                label="Identificador del enlace"
                value={tenant.publicSlug ?? ''}
                help="Entre 3 y 50 letras minúsculas, números o guiones. Cambiarlo reemplaza el enlace anterior: actualizá los lugares donde lo compartiste."
                button="Guardar enlace"
                minLength={3}
                maxLength={50}
                pattern="[a-z0-9-]+"
                save={async (publicSlug) => {
                  resource.beginWrite();
                  try {
                    const response = await updateTenant(
                      fetchApi,
                      { publicSlug },
                      tenantId,
                    );
                    resource.merge(response.data, ['publicSlug']);
                    setCopyMessage(null);
                  } finally {
                    resource.endWrite();
                  }
                }}
              />
              {publicLink ? (
                <div className="mt-6 max-w-2xl space-y-3 font-body">
                  <label
                    htmlFor="capture-url"
                    className="block text-sm font-medium"
                  >
                    Enlace configurado para compartir
                  </label>
                  <input
                    ref={linkInput}
                    id="capture-url"
                    value={publicLink}
                    readOnly
                    className="min-h-11 w-full min-w-0 border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                    onFocus={(event) => event.target.select()}
                  />
                  <div className="flex flex-wrap items-center gap-4">
                    <Button
                      type="button"
                      variant="outline"
                      className="transition-none"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(publicLink);
                          setCopyMessage('Enlace copiado.');
                        } catch {
                          linkInput.current?.focus();
                          linkInput.current?.select();
                          setCopyMessage(
                            'No pudimos copiar. El enlace quedó seleccionado para copiarlo manualmente.',
                          );
                        }
                      }}
                    >
                      Copiar enlace
                    </Button>
                    <a
                      href={`/p/${tenant.publicSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
                    >
                      Ver captura (nueva pestaña)
                    </a>
                  </div>
                  {copyMessage && (
                    <ActionFeedback kind="info">{copyMessage}</ActionFeedback>
                  )}
                </div>
              ) : (
                <p className="mt-5 font-body text-sm">
                  Guardá un identificador para obtener el enlace público.
                </p>
              )}
              <div
                className="mt-8 max-w-2xl border-t pt-6 font-body"
                aria-busy={savingReception}
              >
                <h3 className="text-base font-medium">
                  Recepción {tenant.isPublicFormEnabled ? 'abierta' : 'cerrada'}
                </h3>
                <p className="my-3 text-sm text-muted-foreground">
                  {!tenant.publicSlug
                    ? 'Configurá un enlace para poder recibir nuevos envíos.'
                    : tenant.isPublicFormEnabled
                      ? 'Se aceptan nuevos envíos por el enlace configurado.'
                      : 'El enlace configurado puede mostrar la marca, pero no acepta nuevos envíos.'}{' '}
                  Cerrar la recepción conserva los testimonios y la galería
                  pública.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={savingReception}
                  onClick={() => {
                    if (tenant.isPublicFormEnabled)
                      confirmation.confirm({
                        title: 'Cerrar recepción de testimonios',
                        description: `El espacio ${tenant.name} dejará de aceptar nuevos envíos anónimos. El enlace, la marca y la galería se conservan. Podés volver a abrirla desde aquí.`,
                        confirmLabel: 'Confirmar cierre',
                        task: 'el cierre de recepción',
                        action: toggleReception,
                      });
                    else void toggleReception();
                  }}
                >
                  {savingReception
                    ? 'Guardando…'
                    : tenant.isPublicFormEnabled
                      ? 'Cerrar recepción'
                      : 'Abrir recepción'}
                </Button>
                {receptionError && (
                  <ActionFeedback className="mt-4">
                    {receptionError}
                  </ActionFeedback>
                )}
                {receptionMessage && (
                  <ActionFeedback kind="success" className="mt-4">
                    {receptionMessage}
                  </ActionFeedback>
                )}
              </div>
            </section>
          </>
        )}
        <FeatureFlagsEditor fetchApi={fetchApi} tenantId={tenantId} />
      </div>
      {confirmation.dialog}
    </>
  );
}
export default function SettingsPage() {
  const { session, fetchApi, isAdmin } = useSession();
  if (!isAdmin)
    return (
      <p className="py-12 text-center font-body text-sm">
        Acceso restringido a administradores
      </p>
    );
  if (!session) return <LoadingState>Cargando sesión…</LoadingState>;
  return (
    <WorkspaceSettings
      key={session.user.tenantId}
      fetchApi={fetchApi}
      tenantId={session.user.tenantId}
    />
  );
}
