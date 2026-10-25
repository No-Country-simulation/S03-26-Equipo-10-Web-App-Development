'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { LoadFailure } from '@/features/shared/load-failure';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { PageControls } from '@/features/shared/pagination';
import {
  loadSummary,
  loadCatalog,
  loadPayments,
  operationAccepted,
  featureNames,
  quotaNames,
  type Version,
} from '../api';
import {
  accessLabels,
  formatMoney,
  billingDate,
  paymentLabels,
} from '../presentation';
import { useBillingAction } from '../components/use-billing-action';
import { CheckoutStatus } from '../components/checkout-status';
const selectClass =
  'mt-1 min-h-11 w-full border border-input bg-background px-3 py-2 font-body text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';
export default function BillingScreen() {
  const { session, loading, isAdmin, fetchApi } = useSession();
  const [page, setPage] = useState(1);
  const [currency, setCurrency] = useState<'USD' | 'ARS'>('USD');
  const [interval, setInterval] = useState<'month' | 'year'>('month');
  const [mode, setMode] = useState<'manual' | 'automatic'>('automatic');
  const [operationId, setOperationId] = useState<string | null>(null);
  const [checkoutExpired, setCheckoutExpired] = useState(false);
  const action = useBillingAction(fetchApi);
  const confirmation = useActionConfirmation();
  const load = useCallback(async () => {
    const summary = (await loadSummary(fetchApi)).data;
    if (summary.runtime === 'disabled')
      return {
        summary,
        catalog: [],
        history: { items: [], total: 0, page, limit: 20 },
      };
    const [catalog, history] = await Promise.all([
      loadCatalog(fetchApi),
      loadPayments(fetchApi, page),
    ]);
    return { summary, catalog: catalog.data, history: history.data };
  }, [fetchApi, page]);
  const { state, reload } = useRemoteResource(load, !!session && isAdmin);
  const confirmed = useCallback(() => {
    setCheckoutExpired(false);
    setOperationId(null);
    reload();
  }, [reload]);
  const expired = useCallback(() => {
    setCheckoutExpired(true);
    setOperationId(null);
    reload();
  }, [reload]);
  if (loading) return <LoadingState />;
  if (!isAdmin)
    return (
      <ActionFeedback kind="info">
        El administrador del espacio gestiona la facturación. Podés consultar el
        estado de acceso en el panel.
      </ActionFeedback>
    );
  if (state.status === 'loading')
    return <LoadingState>Cargando facturación…</LoadingState>;
  if (state.status === 'error')
    return (
      <LoadFailure
        error={state.error}
        resource="la facturación"
        onRetry={reload}
      />
    );
  const { summary, catalog, history } = state.data;
  const activeOperation = operationId ?? summary.pendingOperationId ?? null;
  async function purchase(version: Version, priceId: string) {
    const existing = summary.subscription;
    const different =
      !!existing &&
      (existing.price.id !== priceId || existing.mode !== mode) &&
      ['active', 'pending', 'past_due', 'cancel_pending'].includes(
        existing.status,
      );
    confirmation.confirm({
      title: different
        ? 'Programar cambio al terminar el período'
        : 'Continuar al checkout seguro',
      confirmLabel: different ? 'Programar cambio' : 'Continuar al pago',
      task: 'la contratación',
      destructive: false,
      description: different
        ? 'Se detendrá la renovación anterior y conservarás el período pagado. Al vencer, tendrás que aceptar una nueva adhesión para activar este plan. No hay prorrateos.'
        : `${version.name}. ${mode === 'automatic' ? 'El proveedor realizará las renovaciones automáticas; podés cancelarlas para conservar sólo el período pagado.' : 'Comprás un período: no se renueva automáticamente.'} ${summary.access.mode === 'trial' ? 'Si el pago se confirma, empieza el período pago y termina la prueba.' : ''} Los métodos disponibles se muestran en la pasarela.`,
      action: async () => {
        const result = await action.execute(
          different ? '/billing/subscription/changes' : '/billing/checkouts',
          { priceId, mode },
        );
        const op = operationAccepted.parse(result);
        setCheckoutExpired(false);
        if (!different) setOperationId(op.operationId);
        reload();
      },
    });
  }
  return (
    <>
      <DashboardHeader
        title="Facturación"
        description="Planes, períodos y pagos del espacio de trabajo."
      >
        <Button variant="outline" disabled={action.busy} onClick={reload}>
          Actualizar
        </Button>
        {summary.isOperator && (
          <Button variant="outline" asChild>
            <Link href="/platform/billing">Administrar plataforma</Link>
          </Button>
        )}
      </DashboardHeader>
      {summary.runtime === 'disabled' ? (
        <ActionFeedback kind="info">
          La facturación está desactivada. El CMS conserva su funcionamiento
          habitual. El operador puede preparar el entorno de simulación o
          configurar un sandbox antes de habilitarla.
        </ActionFeedback>
      ) : (
        <>
          <section
            aria-labelledby="current-access"
            className="mb-10 border-b border-border pb-8"
          >
            <h2 id="current-access" className="font-caption text-2xl italic">
              {summary.plan?.name ?? 'Sin plan contratado'}
            </h2>
            <p className="mt-2 font-body text-sm">
              {accessLabels[summary.access.mode]}
              {summary.coverage &&
                ` · Hasta ${billingDate(summary.access.mode === 'grace' && summary.coverage.graceEndsAt ? summary.coverage.graceEndsAt : summary.coverage.endsAt)} (UTC)`}
            </p>
            {summary.access.mode === 'grace' && (
              <ActionFeedback kind="warning">
                Renová el período para evitar el acceso de consulta
                {summary.coverage?.graceEndsAt
                  ? ` a partir del ${billingDate(summary.coverage.graceEndsAt)} (UTC)`
                  : ''}
                .
              </ActionFeedback>
            )}
            {summary.subscription && (
              <p className="mt-2 text-sm text-muted-foreground">
                {summary.subscription.mode === 'automatic'
                  ? 'Renovación automática'
                  : 'Compra manual de períodos'}{' '}
                ·{' '}
                {formatMoney(
                  summary.subscription.price.amountMinor,
                  summary.subscription.price.currency,
                )}{' '}
                /{' '}
                {summary.subscription.price.interval === 'month'
                  ? 'mes'
                  : 'año'}
                {summary.subscription.renewalStoppedAt
                  ? ' · Renovación detenida'
                  : ''}
              </p>
            )}
            {summary.subscription?.mode === 'automatic' &&
              !summary.subscription.renewalStoppedAt && (
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={action.busy}
                  onClick={() =>
                    confirmation.confirm({
                      title: 'Detener la renovación automática',
                      description:
                        'Conservás el período ya pagado. La baja puede quedar pendiente mientras el proveedor confirma. Un pago en curso debe reconciliarse antes de cambiar de adhesión.',
                      confirmLabel: 'Detener renovación',
                      task: 'la cancelación',
                      destructive: false,
                      action: async () => {
                        await action.execute(
                          '/billing/subscription/cancel',
                          {},
                        );
                        reload();
                      },
                    })
                  }
                >
                  Detener renovación
                </Button>
              )}
            {summary.subscription?.mode === 'manual' &&
              ['active', 'past_due'].includes(summary.subscription.status) &&
              !activeOperation && (
                <Button
                  className="mt-4"
                  variant="outline"
                  disabled={action.busy}
                  onClick={() =>
                    confirmation.confirm({
                      title: 'Renovar el período contratado',
                      description: `Conservás el precio aceptado: ${formatMoney(summary.subscription!.price.amountMinor, summary.subscription!.price.currency)} por ${summary.subscription!.price.interval === 'month' ? 'mes' : 'año'}. Comprás otro período, sin renovación automática. El acceso se extiende cuando el pago se confirma.`,
                      confirmLabel: 'Continuar a la renovación',
                      task: 'la renovación',
                      destructive: false,
                      action: async () => {
                        const op = operationAccepted.parse(
                          await action.execute('/billing/checkouts', {
                            priceId: summary.subscription!.price.id,
                            mode: 'manual',
                          }),
                        );
                        setOperationId(op.operationId);
                        reload();
                      },
                    })
                  }
                >
                  Renovar período actual
                </Button>
              )}
            {summary.change && (
              <ActionFeedback kind="info">
                Cambio solicitado para {billingDate(summary.change.effectiveAt)}{' '}
                (UTC). La nueva adhesión requiere tu confirmación al terminar el
                período.{' '}
                <Button
                  variant="link"
                  disabled={action.busy}
                  onClick={() =>
                    void action
                      .execute('/billing/subscription/changes/cancel', {})
                      .then(reload)
                      .catch(() => {})
                  }
                >
                  Retirar solicitud
                </Button>
              </ActionFeedback>
            )}
            {summary.usage && (
              <dl className="mt-6 grid gap-x-8 gap-y-4 sm:grid-cols-2 xl:grid-cols-4">
                {(Object.keys(quotaNames) as (keyof typeof quotaNames)[]).map(
                  (q) => (
                    <div key={q}>
                      <dt className="text-xs text-muted-foreground">
                        {quotaNames[q]}
                      </dt>
                      <dd className="mt-1 font-body text-sm tabular-nums">
                        {summary.usage![q]} /{' '}
                        {summary.quotas[q] === null
                          ? 'Sin límite'
                          : summary.quotas[q]}
                      </dd>
                    </div>
                  ),
                )}
              </dl>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Los límites miden capacidad almacenada. Reducir el plan conserva
              tus datos y puede impedir nuevas altas.
            </p>
          </section>
          {checkoutExpired && (
            <ActionFeedback kind="info">
              Checkout vencido. Podés volver a elegir un plan; no se inició otro
              cobro.
            </ActionFeedback>
          )}
          {activeOperation && (
            <CheckoutStatus
              key={activeOperation}
              id={activeOperation}
              fetchApi={fetchApi}
              runtime={summary.runtime}
              autoOpen={!!operationId}
              onConfirmed={confirmed}
              onExpired={expired}
            />
          )}
          {action.feedback && (
            <ActionFeedback kind={action.feedback.kind}>
              {action.feedback.text}
            </ActionFeedback>
          )}
          <section aria-labelledby="plans">
            <h2 id="plans" className="font-caption text-2xl italic">
              Elegí los términos de tu plan
            </h2>
            <fieldset className="my-6 grid gap-4 sm:grid-cols-3">
              <legend className="sr-only">Moneda, período y modalidad</legend>
              <label className="font-body text-sm">
                Moneda
                <select
                  className={selectClass}
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value as 'USD' | 'ARS')}
                >
                  <option value="USD">USD · Stripe internacional</option>
                  <option value="ARS">ARS · Mercado Pago Argentina</option>
                </select>
              </label>
              <label className="font-body text-sm">
                Período
                <select
                  className={selectClass}
                  value={interval}
                  onChange={(e) =>
                    setInterval(e.target.value as 'month' | 'year')
                  }
                >
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                </select>
              </label>
              <label className="font-body text-sm">
                Modalidad
                <select
                  className={selectClass}
                  value={mode}
                  onChange={(e) =>
                    setMode(e.target.value as 'manual' | 'automatic')
                  }
                >
                  <option value="automatic">Renovación automática</option>
                  <option value="manual">Compra manual de un período</option>
                </select>
              </label>
            </fieldset>
            <p className="mb-6 max-w-prose text-sm text-muted-foreground">
              Los precios en USD y ARS son independientes. Los métodos de pago
              dependen de la cuenta, la moneda y la compatibilidad con
              renovación automática. La gestión básica de testimonios está
              incluida en todos los planes.
            </p>
            {!catalog.length && (
              <ActionFeedback kind="info">
                Todavía no hay planes publicados. El operador debe publicar y
                sincronizar las ofertas.
              </ActionFeedback>
            )}
            <div className="grid gap-x-8 lg:grid-cols-2">
              {catalog.flatMap((plan) =>
                plan.versions.map((version) => {
                  const price = version.prices.find(
                    (p) =>
                      p.currency === currency &&
                      p.interval === interval &&
                      p.modes.includes(mode),
                  );
                  return (
                    <article
                      key={version.id}
                      className="border-t border-border py-6"
                    >
                      <h3 className="font-caption text-2xl italic">
                        {version.name}
                      </h3>
                      <p className="mt-2 max-w-prose text-sm text-muted-foreground">
                        {version.description}
                      </p>
                      <p className="my-4 font-body text-xl tabular-nums">
                        {price
                          ? `${formatMoney(price.amountMinor, price.currency)} / ${interval === 'month' ? 'mes' : 'año'}`
                          : 'Sin oferta en esta combinación'}
                      </p>
                      <dl className="grid gap-2 text-sm">
                        {(
                          Object.keys(
                            featureNames,
                          ) as (keyof typeof featureNames)[]
                        ).map((f) => (
                          <div key={f} className="flex justify-between gap-4">
                            <dt>{featureNames[f]}</dt>
                            <dd>
                              {version.features[f] ? 'Incluido' : 'No incluido'}
                            </dd>
                          </div>
                        ))}
                        {(
                          Object.keys(quotaNames) as (keyof typeof quotaNames)[]
                        ).map((q) => (
                          <div key={q} className="flex justify-between gap-4">
                            <dt>{quotaNames[q]}</dt>
                            <dd className="tabular-nums">
                              {version.quotas[q] ?? 'Sin límite'}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-4 text-xs text-muted-foreground">
                        Versión {version.version} · {version.graceDays} días de
                        gracia tras períodos pagos.
                      </p>
                      <div className="mt-5 flex flex-wrap gap-3">
                        <Button
                          disabled={
                            action.busy || !price?.ready || !!activeOperation
                          }
                          onClick={() =>
                            price && void purchase(version, price.id)
                          }
                        >
                          {price?.ready
                            ? 'Seleccionar plan'
                            : 'Oferta en preparación'}
                        </Button>
                        {version.trialDays > 0 &&
                          !summary.trialConsumed &&
                          !(
                            summary.subscription?.paidThrough &&
                            new Date(summary.subscription.paidThrough) >
                              new Date()
                          ) && (
                            <Button
                              variant="outline"
                              disabled={action.busy}
                              onClick={() =>
                                confirmation.confirm({
                                  title: `Iniciar prueba de ${version.trialDays} días`,
                                  description:
                                    'Sin tarjeta y una sola vez por espacio. Al terminar no hay cobro automático ni días de gracia. Confirmar un pago durante la prueba inicia el período pago y termina la prueba.',
                                  confirmLabel: 'Iniciar prueba sin tarjeta',
                                  task: 'la prueba gratuita',
                                  destructive: false,
                                  action: async () => {
                                    await action.execute('/billing/trial', {
                                      planVersionId: version.id,
                                    });
                                    reload();
                                  },
                                })
                              }
                            >
                              Probar {version.trialDays} días sin tarjeta
                            </Button>
                          )}
                      </div>
                    </article>
                  );
                }),
              )}
            </div>
          </section>
          <section className="mt-10" aria-labelledby="payments">
            <h2 id="payments" className="mb-4 font-caption text-2xl italic">
              Historial de pagos
            </h2>
            {!history.items.length ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay pagos registrados.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body text-sm">
                  <caption className="sr-only">
                    Pagos confirmados y pendientes del espacio
                  </caption>
                  <thead>
                    <tr>
                      {['Fecha (UTC)', 'Estado', 'Importe', 'Devuelto'].map(
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
                    {history.items.map((p) => (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap border-b border-border p-3">
                          {billingDate(p.observedAt)}
                        </td>
                        <td className="border-b border-border p-3">
                          {paymentLabels[p.status] ?? 'En revisión'}
                        </td>
                        <td className="whitespace-nowrap border-b border-border p-3 tabular-nums">
                          {formatMoney(p.amountMinor, p.currency)}
                        </td>
                        <td className="whitespace-nowrap border-b border-border p-3 tabular-nums">
                          {formatMoney(p.refundedMinor, p.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <PageControls
              page={page}
              total={history.total}
              limit={20}
              onChange={setPage}
            />
          </section>
        </>
      )}
      {confirmation.dialog}
    </>
  );
}
