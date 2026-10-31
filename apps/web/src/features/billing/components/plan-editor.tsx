'use client';
import { useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { SessionFetch } from '@/lib/api/validated-response';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ActionFeedback } from '@/features/shared/feedback';
import { featureNames, quotaNames, type Catalog, type Version } from '../api';
import { minorFromDecimal } from '../presentation';
import { useBillingAction } from './use-billing-action';
const selectClass =
  'min-h-11 w-full border border-input bg-background px-3 py-2 text-sm focus-visible:outline focus-visible:outline-ring';
const defaultFeatures = {
  media: false,
  analytics: false,
  scoring: false,
  business_intelligence: false,
  bi_statistics: false,
  api_keys: false,
  webhooks: false,
};
export function PlanEditor({
  fetchApi,
  catalog,
  onSaved,
  onCatalogChange,
  initialPlanId,
  editing,
}: {
  fetchApi: SessionFetch;
  catalog: Catalog;
  onSaved: () => void;
  onCatalogChange: (id: string) => void;
  initialPlanId?: string;
  editing?: Version | null;
}) {
  const action = useBillingAction(fetchApi);
  const [planId, setPlanId] = useState(
    editing?.planId ?? initialPlanId ?? catalog[0]?.id ?? '',
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [trialDays, setTrialDays] = useState(editing?.trialDays ?? 0);
  const [graceDays, setGraceDays] = useState(editing?.graceDays ?? 7);
  const [features, setFeatures] = useState(
    editing?.features ?? defaultFeatures,
  );
  const [limits, setLimits] = useState<Record<keyof typeof quotaNames, string>>(
    {
      active_users: editing?.quotas.active_users?.toString() ?? '',
      stored_testimonials:
        editing?.quotas.stored_testimonials?.toString() ?? '',
      active_api_keys: editing?.quotas.active_api_keys?.toString() ?? '',
      active_webhooks: editing?.quotas.active_webhooks?.toString() ?? '',
    },
  );
  const [prices, setPrices] = useState(
    editing?.prices.map((p) => ({
      currency: p.currency,
      interval: p.interval,
      amount: `${BigInt(p.amountMinor) / 100n}.${(BigInt(p.amountMinor) % 100n).toString().padStart(2, '0')}`,
      manual: p.modes.includes('manual'),
      automatic: p.modes.includes('automatic'),
    })) ?? [
      {
        currency: 'USD' as 'USD' | 'ARS',
        interval: 'month' as 'month' | 'year',
        amount: '',
        manual: true,
        automatic: true,
      },
    ],
  );
  async function createPlan(e: FormEvent) {
    e.preventDefault();
    try {
      const result = z
        .object({ id: z.string().uuid() })
        .parse(await action.execute('/platform/billing/plans', { code }));
      setPlanId(result.id);
      setCode('');
      onCatalogChange(result.id);
    } catch {
      /* Feedback retains inputs and idempotency key. */
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const quotas = Object.fromEntries(
        Object.entries(limits).map(([key, value]) => {
          if (
            value !== '' &&
            (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
          )
            throw Error(
              'Los límites admiten cero, enteros positivos o vacío para sin límite.',
            );
          return [key, value === '' ? null : Number(value)];
        }),
      );
      const draft = {
        name,
        description,
        trialDays,
        graceDays,
        features,
        quotas,
        prices: prices.map((p) => ({
          provider: p.currency === 'USD' ? 'stripe' : 'mercadopago',
          currency: p.currency,
          interval: p.interval,
          amountMinor: minorFromDecimal(p.amount),
          modes: [
            ...(p.manual ? ['manual'] : []),
            ...(p.automatic ? ['automatic'] : []),
          ],
        })),
      };
      if (editing?.id)
        await action.execute(
          `/platform/billing/versions/${editing.id}`,
          { expectedRevision: editing.revision, draft },
          'PATCH',
        );
      else
        await action.execute(
          `/platform/billing/plans/${planId}/versions`,
          draft,
        );
      onSaved();
      action.setFeedback({
        kind: 'success',
        text: 'Borrador guardado. Revisá sus términos antes de publicarlo.',
      });
    } catch (cause) {
      if (cause instanceof Error) setError(cause.message);
    }
  }
  return (
    <section
      aria-labelledby="catalog-editor"
      className="mt-10 border-t border-border pt-8"
    >
      <h2 id="catalog-editor" className="font-caption text-2xl italic">
        {editing?.id ? 'Editar borrador' : 'Preparar una versión comercial'}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Una versión publicada conserva sus términos. Para cambiar precios o
        prestaciones, creá otra versión. Los importes de este formulario no son
        recomendaciones comerciales.
      </p>
      {!editing?.id && (
        <form
          onSubmit={(e) => void createPlan(e)}
          className="my-6 flex flex-wrap items-end gap-3"
        >
          <div>
            <Label htmlFor="plan-code">Código de un nuevo plan</Label>
            <Input
              id="plan-code"
              required
              maxLength={64}
              pattern="[a-z][a-z0-9_-]*"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="plan-equipo"
            />
          </div>
          <Button variant="outline" disabled={action.busy}>
            Crear plan
          </Button>
        </form>
      )}
      <form onSubmit={(e) => void submit(e)} className="mt-6 space-y-7">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="commercial-plan">Plan</Label>
            <select
              id="commercial-plan"
              className={selectClass}
              required
              disabled={!!editing?.id}
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
            >
              <option value="">Seleccioná un plan</option>
              {catalog.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="commercial-name">
              Nombre público de la versión
            </Label>
            <Input
              id="commercial-name"
              value={name}
              required
              maxLength={120}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="commercial-description">Descripción</Label>
            <textarea
              id="commercial-description"
              className={selectClass}
              maxLength={2000}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="trial-days">Días de prueba (0 deshabilita)</Label>
            <Input
              id="trial-days"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={trialDays}
              required
              onChange={(e) => setTrialDays(Number(e.target.value))}
            />
          </div>
          <div>
            <Label htmlFor="grace-days">Días de gracia tras período pago</Label>
            <Input
              id="grace-days"
              type="number"
              min="0"
              max="2147483647"
              step="1"
              value={graceDays}
              required
              onChange={(e) => setGraceDays(Number(e.target.value))}
            />
          </div>
        </div>
        <fieldset>
          <legend className="mb-3 font-body font-medium">
            Funciones incluidas
          </legend>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(featureNames) as (keyof typeof featureNames)[]).map(
              (f) => (
                <label
                  key={f}
                  className="flex min-h-10 items-center gap-3 text-sm"
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary focus-visible:outline"
                    checked={features[f]}
                    onChange={(e) =>
                      setFeatures((v) => ({
                        ...v,
                        [f]: e.target.checked,
                        ...(f === 'business_intelligence' && !e.target.checked
                          ? { bi_statistics: false }
                          : {}),
                      }))
                    }
                  />
                  {featureNames[f]}
                </label>
              ),
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            La estadística avanzada requiere inteligencia de negocio. Los flags
            técnicos siguen aplicándose.
          </p>
        </fieldset>
        <fieldset>
          <legend className="mb-3 font-body font-medium">
            Capacidad almacenada
          </legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {(Object.keys(quotaNames) as (keyof typeof quotaNames)[]).map(
              (q) => (
                <div key={q}>
                  <Label htmlFor={`limit-${q}`}>{quotaNames[q]}</Label>
                  <Input
                    id={`limit-${q}`}
                    type="number"
                    min="0"
                    step="1"
                    value={limits[q]}
                    onChange={(e) =>
                      setLimits((v) => ({ ...v, [q]: e.target.value }))
                    }
                    placeholder="Sin límite"
                  />
                </div>
              ),
            )}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Vacío significa sin límite. Cero bloquea nuevas altas sin borrar
            datos.
          </p>
        </fieldset>
        <fieldset>
          <legend className="mb-3 font-body font-medium">
            Precios y modalidades
          </legend>
          {prices.map((p, index) => (
            <div
              key={index}
              className="mb-4 grid gap-3 border-b border-border pb-5 sm:grid-cols-3"
            >
              <label className="text-sm">
                Moneda
                <select
                  className={selectClass}
                  value={p.currency}
                  onChange={(e) =>
                    setPrices((v) =>
                      v.map((r, i) =>
                        i === index
                          ? { ...r, currency: e.target.value as 'USD' | 'ARS' }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="USD">USD · Stripe</option>
                  <option value="ARS">ARS · Mercado Pago</option>
                </select>
              </label>
              <label className="text-sm">
                Período
                <select
                  className={selectClass}
                  value={p.interval}
                  onChange={(e) =>
                    setPrices((v) =>
                      v.map((r, i) =>
                        i === index
                          ? {
                              ...r,
                              interval: e.target.value as 'month' | 'year',
                            }
                          : r,
                      ),
                    )
                  }
                >
                  <option value="month">Mensual</option>
                  <option value="year">Anual</option>
                </select>
              </label>
              <label className="text-sm">
                Importe (punto decimal)
                <Input
                  inputMode="decimal"
                  required
                  value={p.amount}
                  onChange={(e) =>
                    setPrices((v) =>
                      v.map((r, i) =>
                        i === index ? { ...r, amount: e.target.value } : r,
                      ),
                    )
                  }
                />
              </label>
              <div className="flex flex-wrap items-center gap-4 sm:col-span-3">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.manual}
                    onChange={(e) =>
                      setPrices((v) =>
                        v.map((r, i) =>
                          i === index ? { ...r, manual: e.target.checked } : r,
                        ),
                      )
                    }
                  />
                  Compra manual
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={p.automatic}
                    onChange={(e) =>
                      setPrices((v) =>
                        v.map((r, i) =>
                          i === index
                            ? { ...r, automatic: e.target.checked }
                            : r,
                        ),
                      )
                    }
                  />
                  Renovación automática
                </label>
                {prices.length > 1 && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() =>
                      setPrices((v) => v.filter((_, i) => i !== index))
                    }
                  >
                    Quitar precio {index + 1}
                  </Button>
                )}
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            disabled={prices.length >= 4}
            onClick={() =>
              setPrices((v) => [
                ...v,
                {
                  currency: 'ARS',
                  interval: 'month',
                  amount: '',
                  manual: true,
                  automatic: true,
                },
              ])
            }
          >
            Agregar precio
          </Button>
        </fieldset>
        {error && <ActionFeedback>{error}</ActionFeedback>}
        {action.feedback && (
          <ActionFeedback kind={action.feedback.kind}>
            {action.feedback.text}
          </ActionFeedback>
        )}
        <Button disabled={action.busy || !planId}>Guardar borrador</Button>
      </form>
    </section>
  );
}
