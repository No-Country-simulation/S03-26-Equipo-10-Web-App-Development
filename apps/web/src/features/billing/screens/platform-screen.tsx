'use client';
import { useCallback, useState, type FormEvent } from 'react';
import { z } from 'zod';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { LoadFailure } from '@/features/shared/load-failure';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { sessionRequest } from '@/lib/api/validated-response';
import { loadPlatform, loadCatalog, type Version } from '../api';
import {
  formatMoney,
  billingDate,
  paymentLabels,
  operationLabels,
} from '../presentation';
import { useBillingAction } from '../components/use-billing-action';
import { PlanEditor } from '../components/plan-editor';
const selectClass =
  'min-h-11 w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-ring';
export default function PlatformBillingScreen() {
  const { session, fetchApi } = useSession();
  const load = useCallback(async () => {
    const [overview, catalog] = await Promise.all([
      loadPlatform(fetchApi),
      loadCatalog(fetchApi, true),
    ]);
    return { overview: overview.data, catalog: catalog.data };
  }, [fetchApi]);
  const { state, reload } = useRemoteResource(load, !!session);
  const action = useBillingAction(fetchApi);
  const confirmation = useActionConfirmation();
  const [editing, setEditing] = useState<Version | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const [createdPlanId, setCreatedPlanId] = useState<string | undefined>();
  const [provider, setProvider] = useState<'stripe' | 'mercadopago'>('stripe');
  const [sellerId, setSellerId] = useState('');
  const [applicationId, setApplicationId] = useState('');
  const [configurationKey, setConfigurationKey] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [policy, setPolicy] = useState<{
    revision: number;
    enforcementEnabled: boolean;
  } | null>(null);
  const [policyError, setPolicyError] = useState<string | null>(null);
  const [simulation, setSimulation] = useState<{
    id: string;
    scenario: string;
    at: string;
    cycle: string;
  } | null>(null);
  async function account(e: FormEvent) {
    e.preventDefault();
    await action.execute('/platform/billing/accounts', {
      provider,
      sellerId,
      applicationId: applicationId || null,
      configurationKey:
        configurationKey ||
        (state.status === 'success' &&
        state.data.overview.runtime === 'simulation'
          ? 'BILLING_SIMULATION'
          : provider === 'stripe'
            ? 'BILLING_STRIPE_SANDBOX'
            : 'BILLING_MP_SANDBOX'),
      enabled: true,
    });
    reload();
  }
  async function loadPolicy(e: FormEvent) {
    e.preventDefault();
    setPolicy(null);
    setPolicyError(null);
    try {
      const id = z.string().uuid().parse(tenantId);
      setPolicy(
        (
          await sessionRequest(
            fetchApi,
            `/platform/billing/tenants/${id}`,
            z.object({
              revision: z.number().int(),
              enforcementEnabled: z.boolean(),
            }),
          )
        ).data,
      );
    } catch {
      setPolicyError(
        'No pudimos leer la política. Verificá el UUID del tenant y tus permisos.',
      );
    }
  }
  if (state.status === 'loading')
    return <LoadingState>Cargando plataforma…</LoadingState>;
  if (state.status === 'error')
    return (
      <LoadFailure
        error={state.error}
        resource="la administración de facturación"
        onRetry={reload}
      />
    );
  const { overview, catalog } = state.data;
  function changeVersion(v: Version, actionName: 'publish' | 'archive') {
    confirmation.confirm({
      title:
        actionName === 'publish'
          ? 'Publicar términos comerciales'
          : 'Archivar versión',
      description:
        actionName === 'publish'
          ? 'Al publicar, los términos quedan inmutables. Las ofertas se habilitan para contratar cuando estén sincronizadas.'
          : 'Deja de ofrecerse para nuevas contrataciones. Los contratos existentes conservan los términos aceptados.',
      confirmLabel:
        actionName === 'publish' ? 'Publicar versión' : 'Archivar versión',
      task: 'la actualización del catálogo',
      destructive: false,
      action: async () => {
        await action.execute(
          `/platform/billing/versions/${v.id}/${actionName}`,
          { expectedRevision: v.revision },
        );
        reload();
      },
    });
  }
  return (
    <>
      <DashboardHeader
        title="Facturación de plataforma"
        description="Catálogo global, cuentas y operaciones. La autorización se comprueba en BD, independientemente del rol del tenant."
      >
        <Button variant="outline" onClick={reload} disabled={action.busy}>
          Actualizar
        </Button>
        <Button variant="outline" asChild>
          <Link href="/admin/billing">Mi espacio</Link>
        </Button>
      </DashboardHeader>
      <ActionFeedback kind="info">
        Entorno{' '}
        {overview.runtime === 'simulation'
          ? 'de simulación local, sin cobros'
          : 'sandbox'}
        . Las claves se inyectan en el servidor; este panel sólo configura
        referencias no secretas.
      </ActionFeedback>
      {action.feedback && (
        <ActionFeedback kind={action.feedback.kind}>
          {action.feedback.text}
        </ActionFeedback>
      )}
      <section aria-labelledby="accounts">
        <h2 id="accounts" className="font-caption text-2xl italic">
          Cuentas del proveedor
        </h2>
        <div className="mt-4 space-y-3">
          {overview.accounts.map((a) => (
            <div
              key={a.id}
              className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3"
            >
              <p className="min-w-0 text-sm">
                <strong>
                  {a.provider === 'stripe' ? 'Stripe' : 'Mercado Pago'}
                </strong>{' '}
                · {a.sellerId} · {a.enabled ? 'Habilitada' : 'Deshabilitada'}
                <span className="mt-1 block break-all text-xs text-muted-foreground">
                  {a.id}
                </span>
              </p>
              <Button
                variant="outline"
                disabled={action.busy}
                onClick={() =>
                  confirmation.confirm({
                    title: a.enabled
                      ? 'Deshabilitar proveedor'
                      : 'Habilitar proveedor',
                    description:
                      'Una deshabilitación impide nuevas llamadas desde el CMS. No equivale a cancelar suscripciones remotas ni detiene los débitos del proveedor. Revisá los contratos activos antes de cambiarla.',
                    confirmLabel: 'Guardar estado',
                    task: 'la configuración de cuenta',
                    destructive: false,
                    action: async () => {
                      await action.execute('/platform/billing/accounts', {
                        provider: a.provider,
                        sellerId: a.sellerId,
                        applicationId: a.applicationId,
                        configurationKey: a.configurationKey,
                        enabled: !a.enabled,
                      });
                      reload();
                    },
                  })
                }
              >
                {a.enabled ? 'Deshabilitar' : 'Habilitar'}
              </Button>
            </div>
          ))}
        </div>
        <form
          onSubmit={(e) => void account(e).catch(() => {})}
          className="mt-5 grid items-end gap-4 sm:grid-cols-2"
        >
          <label className="text-sm">
            Proveedor
            <select
              className={selectClass}
              value={provider}
              onChange={(e) =>
                setProvider(e.target.value as 'stripe' | 'mercadopago')
              }
            >
              <option value="stripe">Stripe · USD</option>
              <option value="mercadopago">Mercado Pago · ARS</option>
            </select>
          </label>
          <div>
            <Label htmlFor="seller-id">ID del vendedor esperado</Label>
            <Input
              id="seller-id"
              value={sellerId}
              onChange={(e) => setSellerId(e.target.value)}
              required
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="provider-application">
              ID de aplicación (si corresponde)
            </Label>
            <Input
              id="provider-application"
              value={applicationId}
              onChange={(e) => setApplicationId(e.target.value)}
              maxLength={100}
            />
          </div>
          <div>
            <Label htmlFor="provider-reference">
              Referencia de configuración no secreta
            </Label>
            <Input
              id="provider-reference"
              value={configurationKey}
              onChange={(e) => setConfigurationKey(e.target.value)}
              placeholder={
                overview.runtime === 'simulation'
                  ? 'BILLING_SIMULATION'
                  : 'BILLING_STRIPE_SANDBOX'
              }
              pattern="[A-Z][A-Z0-9_]*"
              maxLength={64}
            />
          </div>
          <Button disabled={action.busy}>Registrar cuenta de prueba</Button>
        </form>
      </section>
      <section className="mt-10" aria-labelledby="platform-catalog">
        <h2 id="platform-catalog" className="font-caption text-2xl italic">
          Catálogo versionado
        </h2>
        {!catalog.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Creá un plan y guardá su primer borrador abajo.
          </p>
        )}
        {catalog.flatMap((p) =>
          p.versions.map((v) => (
            <article key={v.id} className="mt-5 border-b border-border pb-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-body font-medium">
                    {p.code} · {v.name} · v{v.version}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    {v.status === 'draft'
                      ? 'Borrador'
                      : v.status === 'published'
                        ? 'Publicada'
                        : 'Archivada'}{' '}
                    · revisión {v.revision}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {v.status === 'draft' ? (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setEditing(v);
                          setEditorRevision((r) => r + 1);
                          document
                            .getElementById('catalog-editor')
                            ?.scrollIntoView({ block: 'start' });
                        }}
                      >
                        Editar borrador
                      </Button>
                      <Button
                        disabled={action.busy}
                        onClick={() => changeVersion(v, 'publish')}
                      >
                        Publicar
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditing({ ...v, id: '', status: 'draft' });
                        setEditorRevision((r) => r + 1);
                      }}
                    >
                      Preparar otra versión
                    </Button>
                  )}
                  {v.status === 'published' && (
                    <Button
                      variant="outline"
                      disabled={action.busy}
                      onClick={() => changeVersion(v, 'archive')}
                    >
                      Archivar
                    </Button>
                  )}
                </div>
              </div>
              <ul className="mt-3 space-y-3">
                {v.prices.map((price) => (
                  <li
                    key={price.id}
                    className="flex flex-wrap items-center justify-between gap-3 text-sm"
                  >
                    <span>
                      {formatMoney(price.amountMinor, price.currency)} /{' '}
                      {price.interval === 'month' ? 'mes' : 'año'} ·{' '}
                      {price.ready
                        ? 'Lista para contratar'
                        : 'Pendiente de sincronización'}
                    </span>
                    {v.status !== 'draft' &&
                      overview.accounts
                        .filter(
                          (a) => a.provider === price.provider && a.enabled,
                        )
                        .map((a) => (
                          <Button
                            key={a.id}
                            size="sm"
                            variant="outline"
                            disabled={action.busy}
                            onClick={() =>
                              void action
                                .execute('/platform/billing/sync', {
                                  accountId: a.id,
                                  priceId: price.id,
                                })
                                .then(reload)
                                .catch(() => {})
                            }
                          >
                            Sincronizar {price.currency}{' '}
                            {price.interval === 'month' ? 'mensual' : 'anual'}
                          </Button>
                        ))}
                  </li>
                ))}
              </ul>
            </article>
          )),
        )}
      </section>
      <PlanEditor
        key={`${editing?.id ?? 'new'}-${editorRevision}`}
        fetchApi={fetchApi}
        catalog={catalog}
        editing={editing}
        onCatalogChange={(id) => {
          setCreatedPlanId(id);
          reload();
        }}
        initialPlanId={createdPlanId}
        onSaved={() => {
          setEditing(null);
          setEditorRevision((r) => r + 1);
          reload();
        }}
      />
      <section
        className="mt-10 border-t border-border pt-8"
        aria-labelledby="tenant-policy"
      >
        <h2 id="tenant-policy" className="font-caption text-2xl italic">
          Control comercial por tenant
        </h2>
        <p className="mt-2 max-w-prose text-sm text-muted-foreground">
          Está apagado por defecto. Al activarlo, aplican plan, prueba, gracia,
          prestaciones y cuotas. Sin cobertura queda consulta; se conservan
          contenido publicado y revocación de credenciales.
        </p>
        <form
          onSubmit={(e) => void loadPolicy(e)}
          className="mt-4 flex flex-wrap items-end gap-3"
        >
          <div className="min-w-0 flex-1">
            <Label htmlFor="billing-tenant-id">UUID del tenant</Label>
            <Input
              id="billing-tenant-id"
              value={tenantId}
              onChange={(e) => {
                setTenantId(e.target.value);
                setPolicy(null);
              }}
              required
            />
          </div>
          <Button variant="outline">Leer política actual</Button>
        </form>
        {policyError && <ActionFeedback>{policyError}</ActionFeedback>}
        {policy && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <p className="text-sm">
              Revisión {policy.revision} · Control{' '}
              {policy.enforcementEnabled ? 'activo' : 'apagado'}
            </p>
            <Button
              disabled={action.busy}
              onClick={() =>
                confirmation.confirm({
                  title: policy.enforcementEnabled
                    ? 'Apagar el control comercial'
                    : 'Activar el control comercial',
                  description: `Tenant ${tenantId}. El cambio modifica el acceso comercial de todo este espacio. Verificá su suscripción y límites antes de continuar.`,
                  confirmLabel: 'Confirmar política',
                  task: 'la política del tenant',
                  destructive: false,
                  action: async () => {
                    await action.execute(
                      `/platform/billing/tenants/${tenantId}/policy`,
                      {
                        expectedRevision: policy.revision,
                        enforcementEnabled: !policy.enforcementEnabled,
                      },
                      'PATCH',
                    );
                    setPolicy(null);
                    reload();
                  },
                })
              }
            >
              {policy.enforcementEnabled ? 'Apagar control' : 'Activar control'}
            </Button>
          </div>
        )}
      </section>
      <section className="mt-10" aria-labelledby="operations">
        <h2 id="operations" className="font-caption text-2xl italic">
          Operaciones recientes
        </h2>
        <p className="mt-2 text-xs text-muted-foreground">
          Últimas 50 operaciones. Una incertidumbre requiere consulta; reenviar
          no autoriza recrear un cobro.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Registro financiero global</caption>
            <thead>
              <tr>
                {['Operación / tenant', 'Estado', 'Intentos', 'Acciones'].map(
                  (h) => (
                    <th
                      key={h}
                      scope="col"
                      className="border-b border-border p-3 font-medium"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {overview.operations.map((op) => (
                <tr key={op.id}>
                  <td className="max-w-64 border-b border-border p-3">
                    <strong>{op.kind}</strong>
                    <span className="block break-all text-xs text-muted-foreground">
                      {op.id}
                    </span>
                    <span className="block break-all text-xs text-muted-foreground">
                      {op.tenantId ?? 'Catálogo global'}
                    </span>
                  </td>
                  <td className="border-b border-border p-3">
                    {operationLabels[op.status] ?? op.status}
                    {op.errorCode && (
                      <span className="block text-xs">{op.errorCode}</span>
                    )}
                  </td>
                  <td className="border-b border-border p-3 tabular-nums">
                    {op.attempts}
                  </td>
                  <td className="border-b border-border p-3">
                    <div className="flex flex-wrap gap-2">
                      {op.status === 'review' && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={action.busy}
                          onClick={() =>
                            void action
                              .execute(
                                `/platform/billing/operations/${op.id}/reconcile`,
                                { kind: 'operation' },
                              )
                              .then(reload)
                              .catch(() => {})
                          }
                        >
                          Reconciliar
                        </Button>
                      )}
                      {overview.runtime === 'simulation' &&
                        op.kind === 'checkout' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              setSimulation({
                                id: op.id,
                                scenario: 'approved',
                                at: new Date().toISOString().slice(0, 16),
                                cycle: 'initial',
                              })
                            }
                          >
                            Simular resultado
                          </Button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {simulation && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action
                .execute(
                  `/platform/billing/operations/${simulation.id}/simulate`,
                  {
                    scenario: simulation.scenario,
                    at: new Date(simulation.at + 'Z').toISOString(),
                    cycle: simulation.cycle,
                  },
                )
                .then(() => {
                  setSimulation(null);
                  reload();
                })
                .catch(() => {});
            }}
            className="mt-5 grid gap-4 border border-border p-4 sm:grid-cols-3"
          >
            <h3 className="break-all text-sm font-medium sm:col-span-3">
              Simular operación {simulation.id}
            </h3>
            <label className="text-sm">
              Resultado
              <select
                className={selectClass}
                value={simulation.scenario}
                onChange={(e) =>
                  setSimulation((v) =>
                    v ? { ...v, scenario: e.target.value } : v,
                  )
                }
              >
                {[
                  ['pending', 'Pendiente'],
                  ['approved', 'Aprobado'],
                  ['rejected', 'Rechazado'],
                  ['partial_refund', 'Devolución parcial'],
                  ['full_refund', 'Devolución total'],
                  ['chargeback', 'Contracargo confirmado'],
                ].map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              Instante simulado (UTC)
              <Input
                type="datetime-local"
                required
                value={simulation.at}
                onChange={(e) =>
                  setSimulation((v) => (v ? { ...v, at: e.target.value } : v))
                }
              />
            </label>
            <label className="text-sm">
              Identidad del ciclo
              <Input
                required
                maxLength={50}
                pattern="[a-zA-Z0-9_-]+"
                value={simulation.cycle}
                onChange={(e) =>
                  setSimulation((v) =>
                    v ? { ...v, cycle: e.target.value } : v,
                  )
                }
              />
            </label>
            <div className="flex gap-3 sm:col-span-3">
              <Button disabled={action.busy}>Registrar simulación</Button>
              <Button
                variant="outline"
                type="button"
                disabled={action.busy}
                onClick={() => setSimulation(null)}
              >
                Cerrar
              </Button>
            </div>
          </form>
        )}
      </section>
      <section className="mt-8">
        <h2 className="font-caption text-2xl italic">
          Recepciones que requieren revisión
        </h2>
        {!overview.inbox.some((i) => i.status === 'review') ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No hay recepciones en revisión entre las últimas 50.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {overview.inbox
              .filter((i) => i.status === 'review')
              .map((i) => (
                <li
                  key={i.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-sm"
                >
                  <span>
                    {i.topic} · {i.errorCode}
                  </span>
                  <Button
                    variant="outline"
                    disabled={action.busy}
                    onClick={() =>
                      void action
                        .execute(
                          `/platform/billing/operations/${i.id}/reconcile`,
                          { kind: 'inbox' },
                        )
                        .then(reload)
                        .catch(() => {})
                    }
                  >
                    Reprocesar recepción
                  </Button>
                </li>
              ))}
          </ul>
        )}
      </section>
      <section className="mt-8">
        <h2 className="font-caption text-2xl italic">
          Pagos y discrepancias recientes
        </h2>
        <ul className="mt-4 space-y-3">
          {overview.payments.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap justify-between gap-3 border-b border-border pb-3 text-sm"
            >
              <span className="min-w-0 break-all">
                {p.tenantId} · {billingDate(p.observedAt)} (UTC)
              </span>
              <span className="tabular-nums">
                {paymentLabels[p.status] ?? p.status} ·{' '}
                {formatMoney(p.amountMinor, p.currency)} · Devuelto{' '}
                {formatMoney(p.refundedMinor, p.currency)}
              </span>
            </li>
          ))}
        </ul>
        {!overview.payments.length && (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin pagos registrados.
          </p>
        )}
      </section>
      <section className="mt-8" aria-labelledby="billing-discrepancies">
        <h2 id="billing-discrepancies" className="font-caption text-2xl italic">
          Discrepancias financieras
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Últimos 50 registros de revisión o cobros adicionales. Un cobro
          adicional no concede un segundo período. Requiere revisión en el
          proveedor; esta pantalla no inicia devoluciones.
        </p>
        {!overview.discrepancies.length ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Sin discrepancias registradas.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {overview.discrepancies.map((d) => (
              <li key={d.id} className="border-b border-border pb-3 text-sm">
                <p>
                  {d.action === 'payment.additional'
                    ? 'Cobro adicional sin segundo acceso'
                    : 'Operación derivada a revisión'}{' '}
                  · {billingDate(d.createdAt)} (UTC)
                </p>
                <p className="mt-1 break-all text-xs text-muted-foreground">
                  Tenant: {d.tenantId ?? 'global'} · Recurso: {d.entityId}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
      {confirmation.dialog}
    </>
  );
}
