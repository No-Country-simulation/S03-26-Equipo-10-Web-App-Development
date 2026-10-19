'use client';

import { useCallback, useRef, useState, type FormEvent } from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Plus,
  RefreshCw,
  KeyRound,
  Copy,
  Check,
  ShieldAlert,
} from 'lucide-react';
import {
  createApiKey,
  listApiKeys,
  revokeApiKey,
  rotateApiKey,
  type ApiKeyInput,
} from '../api';
import { expiryChange, localExpiry, scopeLabels } from '../key-form';
import { useKeyExitGuard } from '../use-key-exit-guard';
import { PageControls } from '@/features/shared/pagination';
import { LoadFailure, actionFailureCopy } from '@/features/shared/load-failure';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { useRemoteResource } from '@/features/shared/use-remote-resource';

export type ApiKeyView = {
  id: string;
  tenantId: string;
  name: string;
  isActive: boolean;
  publicId: string | null;
  scopes: Array<keyof typeof scopeLabels>;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  legacy: boolean;
  expiresAt: string | null;
  legacyDeadline: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
const dateLabel = (value: string) =>
  new Date(value).toLocaleString('es-AR', { timeZoneName: 'short' });
const stateLabels = {
  ACTIVE: 'Activa',
  EXPIRED: 'Vencida',
  REVOKED: 'Revocada',
} as const;

export default function ApiKeysPage() {
  const { session, fetchApi } = useSession();
  const [page, setPage] = useState(1);
  const confirmation = useActionConfirmation();
  const [showForm, setShowForm] = useState(false);
  const [target, setTarget] = useState<ApiKeyView | null>(null);
  const [replacement, setReplacement] = useState(false);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [reveal, setReveal] = useState<{
    value: string;
    name: string;
    rotated: boolean;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [actionMessage, setActionMessage] = useState<{
    kind: 'error' | 'success';
    text: string;
  } | null>(null);
  const secretField = useRef<HTMLTextAreaElement>(null);
  const rotationTarget = replacement ? null : target;
  const isAdmin = Boolean(session?.user.roles.includes('admin'));
  const load = useCallback(
    async () => (await listApiKeys(fetchApi, page)).data,
    [fetchApi, page],
  );
  const { state, reload } = useRemoteResource(load, isAdmin);
  const apiKeys: ApiKeyView[] =
    state.status === 'success' ? state.data.items : [];
  const total = state.status === 'success' ? state.data.meta.total : 0;

  function discardReveal(leave?: () => void) {
    if (lock.current) {
      setActionMessage({
        kind: 'error',
        text: 'Esperá el resultado de la operación antes de salir.',
      });
      return;
    }
    confirmation.confirm({
      title: leave ? 'Salir con una API key revelada' : 'Ocultar API key',
      description: `La clave de «${reveal?.name ?? 'la integración'}» no volverá a mostrarse. Guardala en un lugar seguro antes de continuar. Ocultarla no la revoca.`,
      confirmLabel: leave ? 'Ocultar y salir' : 'Ya la guardé, ocultar',
      task: 'el cierre de la revelación',
      destructive: false,
      action: async () => {
        setReveal(null);
        leave?.();
      },
    });
  }
  useKeyExitGuard(Boolean(reveal) || busy, (leave) => discardReveal(leave));

  async function generate(input: ApiKeyInput, rotating: ApiKeyView | null) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setActionMessage(null);
    try {
      const result = rotating
        ? await rotateApiKey(fetchApi, rotating.id, input)
        : await createApiKey(fetchApi, input);
      setReveal({
        value: result.data.apiKey,
        name: result.data.name,
        rotated: Boolean(rotating),
      });
      setCopied(false);
      setCopyError(false);
      setShowForm(false);
      setTarget(null);
      setReplacement(false);
      if (!rotating) setPage(1);
      reload();
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const fd = new FormData(event.currentTarget);
    try {
      const scopes = fd
        .getAll('scopes')
        .map(String)
        .filter(
          (value): value is keyof typeof scopeLabels => value in scopeLabels,
        );
      if (scopes.length === 0) throw new Error('Elegí al menos un permiso.');
      const expiresAt = expiryChange(
        String(fd.get('expiresAt') ?? ''),
        rotationTarget?.expiresAt ?? null,
      );
      const input = {
        name: String(fd.get('name') ?? '').trim(),
        scopes,
        ...(expiresAt ? { expiresAt } : {}),
      };
      if (reveal) {
        confirmation.confirm({
          title: 'Reemplazar la revelación',
          description: `Guardá primero la clave de «${reveal.name}». Si la generación de «${input.name}» termina correctamente, su clave ocupará este lugar. Si falla, conservarás la revelación actual.`,
          confirmLabel: 'Generar y reemplazar',
          task: 'la generación de la API key',
          destructive: false,
          action: () => generate(input, rotationTarget),
        });
      } else await generate(input, rotationTarget);
    } catch (cause) {
      const validation =
        cause instanceof Error &&
        /^(Elegí|Revisá|La rotación)/.test(cause.message);
      setActionMessage({
        kind: 'error',
        text: validation
          ? cause.message
          : actionFailureCopy(cause, 'la generación de la API key'),
      });
    }
  }
  function revoke(key: ApiKeyView) {
    if (lock.current) return;
    confirmation.confirm({
      title: 'Revocar API key',
      confirmLabel: 'Revocar API key',
      task: 'la revocación de la API key',
      description: `La API key «${key.name}» y todas sus credenciales dejarán de funcionar de inmediato. Esta acción no se puede deshacer.`,
      action: async () => {
        if (lock.current) return;
        lock.current = true;
        setBusy(true);
        try {
          await revokeApiKey(fetchApi, key.id);
          setActionMessage({ kind: 'success', text: 'API key revocada.' });
          reload();
        } finally {
          lock.current = false;
          setBusy(false);
        }
      },
    });
  }
  async function copy() {
    if (!reveal) return;
    try {
      await navigator.clipboard.writeText(reveal.value);
      setCopied(true);
      setCopyError(false);
    } catch {
      setCopyError(true);
      secretField.current?.focus();
      secretField.current?.select();
    }
  }
  function openForm(key: ApiKeyView | null = null, replace = false) {
    if (lock.current) return;
    setTarget(key);
    setReplacement(replace);
    setShowForm(true);
    setActionMessage(null);
  }

  if (!isAdmin)
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-destructive" />
        <h2 className="font-body text-lg font-bold">Acceso denegado</h2>
        <p className="text-muted-foreground">
          Solo administradores pueden ver esta sección.
        </p>
      </div>
    );

  return (
    <>
      <DashboardHeader
        title="API keys"
        description="Conectá integraciones con permisos y vencimientos propios."
      >
        <Button type="button" disabled={busy} onClick={() => openForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva API key
        </Button>
        <Button type="button" disabled={busy} variant="ghost" onClick={reload}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </DashboardHeader>
      {actionMessage && (
        <ActionFeedback kind={actionMessage.kind}>
          {actionMessage.text}
        </ActionFeedback>
      )}
      {busy && (
        <LoadingState>
          Procesando la API key. Esperá el resultado antes de salir.
        </LoadingState>
      )}
      {reveal && (
        <section
          aria-labelledby="key-reveal-title"
          className="mb-8 min-w-0 border border-primary bg-card p-4 font-body sm:p-6"
        >
          <h2
            id="key-reveal-title"
            className="text-lg font-semibold break-words"
          >
            API key de «{reveal.name}»
          </h2>
          <p role="status" className="mt-2 text-sm">
            Clave {reveal.rotated ? 'rotada' : 'creada'}. Guardala ahora: no
            volverá a mostrarse.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Usala en el servidor de tu integración y guardala en su gestor de
            secretos.
          </p>
          <Label htmlFor="revealed-api-key" className="mt-4 block">
            Clave completa para copiar
          </Label>
          <textarea
            ref={secretField}
            id="revealed-api-key"
            readOnly
            spellCheck={false}
            autoComplete="off"
            value={reveal.value}
            rows={3}
            className="mt-2 w-full resize-none border bg-background p-3 font-mono text-sm break-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onFocus={(event) => event.currentTarget.select()}
          />
          {copyError && (
            <ActionFeedback>
              No se pudo copiar. La clave está seleccionada: usá el menú Copiar
              de tu dispositivo o Ctrl/Cmd+C.
            </ActionFeedback>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            <Button type="button" variant="outline" onClick={() => void copy()}>
              {copied ? (
                <Check className="mr-2 h-4 w-4" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
              {copied ? 'API key copiada' : 'Copiar API key'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={() => discardReveal()}
            >
              Ocultar API key
            </Button>
          </div>
          {reveal.rotated && (
            <p className="mt-4 text-sm text-muted-foreground">
              Actualizá tu integración con la nueva clave y comprobá la
              conexión. La anterior conserva sus permisos por hasta 24 horas; su
              vencimiento previo, el vencimiento actual de la clave o el fin de
              la ventana legada pueden cortar esa gracia antes. Revocar elimina
              la gracia de inmediato.
            </p>
          )}
        </section>
      )}
      {showForm && (
        <form
          key={`${target?.id ?? 'new'}-${replacement}`}
          onSubmit={(event) => void handleCreate(event)}
          className="mb-8 border bg-card p-4 font-body sm:p-6"
          aria-label={rotationTarget ? 'Rotación de API key' : 'Nueva API key'}
          aria-busy={busy}
        >
          <fieldset
            disabled={busy}
            className="grid min-w-0 gap-5 sm:grid-cols-2"
          >
            <legend className="mb-4 text-lg font-semibold">
              {rotationTarget
                ? `Rotar «${rotationTarget.name}»`
                : replacement
                  ? `Crear reemplazo de «${target?.name}»`
                  : 'Nueva API key'}
            </legend>
            {rotationTarget && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                La nueva clave se mostrará una sola vez. La anterior conserva
                sus permisos por hasta 24 horas, limitada por su vencimiento
                previo y el vencimiento actual. En claves legadas también aplica
                el fin de la ventana de migración.
              </p>
            )}
            {replacement && (
              <p className="text-sm text-muted-foreground sm:col-span-2">
                Se creará una API key independiente. La clave vencida seguirá en
                el historial.
              </p>
            )}
            <div className="grid content-start gap-2">
              <Label htmlFor="api-key-name">Nombre de la integración</Label>
              <Input
                id="api-key-name"
                name="name"
                required
                minLength={2}
                maxLength={80}
                defaultValue={target?.name ?? ''}
                placeholder="Por ejemplo, sitio institucional"
              />
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="api-key-expiry">
                Vencimiento (hora local, opcional)
              </Label>
              <Input
                id="api-key-expiry"
                name="expiresAt"
                type="datetime-local"
                defaultValue={localExpiry(rotationTarget?.expiresAt ?? null)}
                required={Boolean(rotationTarget?.expiresAt)}
                aria-describedby="expiry-hint"
              />
              <p id="expiry-hint" className="text-xs text-muted-foreground">
                {rotationTarget?.expiresAt
                  ? 'Sin cambios se conserva el instante exacto. La rotación permite conservar o cambiar la fecha, pero no quitarla.'
                  : 'Si lo dejás vacío, la clave no tendrá vencimiento.'}
              </p>
            </div>
            <fieldset className="grid gap-3 sm:col-span-2">
              <legend className="mb-2 text-sm font-semibold">Permisos</legend>
              {(
                Object.keys(scopeLabels) as Array<keyof typeof scopeLabels>
              ).map((scope) => (
                <label
                  key={scope}
                  className="flex min-h-11 items-center gap-3 text-sm"
                >
                  <input
                    className="h-5 w-5 accent-primary"
                    type="checkbox"
                    name="scopes"
                    value={scope}
                    defaultChecked={
                      target
                        ? (target.legacy && target.scopes.length === 0) ||
                          target.scopes.includes(scope)
                        : scope === 'testimonials:read'
                    }
                  />
                  {scopeLabels[scope]}
                </label>
              ))}
            </fieldset>
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit">
                {busy
                  ? 'Generando…'
                  : rotationTarget
                    ? 'Rotar API key'
                    : 'Crear API key'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cerrar formulario
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {state.status === 'loading' ? (
        <LoadingState>Cargando API keys…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="las API keys"
          onRetry={reload}
        />
      ) : apiKeys.length === 0 ? (
        <div className="border border-dashed p-8 text-center">
          <p className="font-body text-sm text-muted-foreground">
            Todavía no hay API keys en este espacio. Creá una para conectar tu
            primera integración.
          </p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted-foreground sm:hidden">
            Deslizá la tabla para ver vencimientos y acciones.
          </p>
          <div
            role="region"
            aria-label="Tabla de API keys"
            tabIndex={0}
            className="min-w-0 overflow-x-auto"
          >
            <table className="w-full min-w-[720px] font-body text-sm">
              <caption className="sr-only">
                API keys de este espacio, incluidas las vencidas y revocadas
              </caption>
              <thead>
                <tr className="border-b">
                  {[
                    'Integración',
                    'Último uso',
                    'Estado',
                    'Permisos y vencimiento',
                    'Acciones',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="pb-3 pr-4 text-left text-xs font-semibold text-muted-foreground"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((key) => (
                  <tr key={key.id} className="border-b border-border align-top">
                    <td className="max-w-64 py-4 pr-4">
                      <span className="flex items-start gap-2 font-medium break-words">
                        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        {key.name}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {key.publicId ?? 'Clave legada'}
                      </span>
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">
                      {key.lastUsedAt ? dateLabel(key.lastUsedAt) : 'Nunca'}
                    </td>
                    <td className="py-4 pr-4">
                      <span
                        className={cn(
                          'inline-block px-2 py-1 text-xs font-semibold',
                          key.status === 'ACTIVE'
                            ? 'bg-success/10 text-success'
                            : key.status === 'EXPIRED'
                              ? 'bg-warning/10 text-warning'
                              : 'bg-destructive/10 text-destructive',
                        )}
                      >
                        {stateLabels[key.status]}
                      </span>
                      {key.legacy && !key.publicId && (
                        <p className="mt-2 max-w-48 text-xs text-muted-foreground">
                          Clave legada: migrá{' '}
                          {key.legacyDeadline
                            ? `antes del ${dateLabel(key.legacyDeadline)}`
                            : 'antes de activar la ventana de migración'}
                          .
                        </p>
                      )}
                    </td>
                    <td className="py-4 pr-4 text-muted-foreground">
                      <ul>
                        {(key.scopes.length
                          ? key.scopes
                          : key.legacy
                            ? ([
                                'testimonials:read',
                                'analytics:write',
                              ] as const)
                            : []
                        ).map((scope) => (
                          <li key={scope}>{scopeLabels[scope]}</li>
                        ))}
                      </ul>
                      <p className="mt-2 text-xs">
                        {key.expiresAt
                          ? `Vence ${dateLabel(key.expiresAt)}`
                          : 'Sin vencimiento'}
                      </p>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-2">
                        {key.status === 'ACTIVE' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openForm(key)}
                          >
                            Rotar
                          </Button>
                        )}
                        {key.status === 'EXPIRED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => openForm(key, true)}
                          >
                            Crear reemplazo
                          </Button>
                        )}
                        {key.status !== 'REVOKED' && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => revoke(key)}
                            className="text-destructive hover:text-destructive"
                          >
                            Revocar
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
      {state.status === 'success' && (
        <fieldset disabled={busy}>
          <PageControls
            page={page}
            total={total}
            limit={20}
            onChange={setPage}
          />
        </fieldset>
      )}
      {confirmation.dialog}
    </>
  );
}
