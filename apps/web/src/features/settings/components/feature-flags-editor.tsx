'use client';

import { useCallback, useRef, useState } from 'react';
import type { SessionFetch } from '@/lib/api/validated-response';
import { Button } from '@/components/ui/button';
import { ActionFeedback, LoadingState } from '@/features/shared/feedback';
import { LoadFailure, actionFailureCopy } from '@/features/shared/load-failure';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { listFeatureFlags, updateFeatureFlag, type FeatureFlag } from '../api';

const descriptions: Record<
  string,
  { title: string; description: string; technical?: boolean }
> = {
  testimonials: {
    title: 'Gestión de testimonios',
    description:
      'Controla las operaciones autenticadas de testimonios y su lectura con API key. Desactivarla no cierra la recepción anónima ni oculta la galería pública; cerrá la recepción por separado.',
  },
  enable_scoring: {
    title: 'Relevancia',
    description:
      'Recalcula el puntaje de testimonios publicados al iniciar el proceso y cada hora: rating × 10 + vistas × 0,1 + clics × 0,5 − días desde publicación × 0,05, con mínimo 0. No usa IA ni publica contenido. Desactivarla conserva los puntajes existentes.',
  },
  enable_analytics: {
    title: 'Analítica',
    technical: true,
    description:
      'Parámetro técnico guardado: actualmente no controla el acceso a Analítica ni detiene el registro de actividad.',
  },
  enable_webhooks: {
    title: 'Webhooks',
    technical: true,
    description:
      'Parámetro técnico guardado: actualmente no controla el acceso a Webhooks ni pausa sus entregas. Para pausarlas, desactivá cada destino en Webhooks.',
  },
};

function FlagRow({
  flag,
  fetchApi,
  tenantId,
  onBusy,
}: {
  flag: FeatureFlag;
  fetchApi: SessionFetch;
  tenantId: string;
  onBusy: (delta: number) => void;
}) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const lock = useRef(false);
  const confirmation = useActionConfirmation();
  const info = descriptions[flag.name] ?? {
    title: flag.name,
    technical: true,
    description:
      'Parámetro técnico del espacio. Su valor se guarda; no se atribuye un efecto funcional no documentado.',
  };
  async function save() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    onBusy(1);
    setError(null);
    setMessage(null);
    try {
      const response = await updateFeatureFlag(
        fetchApi,
        flag.name,
        !enabled,
        tenantId,
      );
      setEnabled(response.data.enabled);
      setMessage('Valor guardado.');
    } catch (failure) {
      setError(actionFailureCopy(failure, `el cambio de ${info.title}`));
    } finally {
      lock.current = false;
      setBusy(false);
      onBusy(-1);
    }
  }
  const label = `${enabled ? 'Desactivar' : 'Activar'} ${info.technical ? 'parámetro ' : ''}${info.title}`;
  return (
    <li className="py-6 font-body" aria-busy={busy}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-2xl">
          <h3 className="break-words text-base font-medium">{info.title}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {info.description}
          </p>
          <p className="mt-2 text-sm">
            {info.technical ? 'Valor' : 'Estado'}:{' '}
            <strong>{enabled ? 'Activado' : 'Desactivado'}</strong>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          onClick={() => {
            if (flag.name === 'testimonials' && enabled)
              confirmation.confirm({
                title: 'Desactivar gestión de testimonios',
                description: `${info.description} Esto también limita la revisión y publicación en el panel. Podés reactivarla desde Configuración.`,
                confirmLabel: 'Desactivar gestión',
                task: 'el cambio de testimonios',
                action: save,
              });
            else void save();
          }}
        >
          {busy ? 'Guardando…' : label}
        </Button>
      </div>
      {error && <ActionFeedback className="mt-4">{error}</ActionFeedback>}
      {message && (
        <ActionFeedback kind="success" className="mt-4">
          {message}
        </ActionFeedback>
      )}
      {confirmation.dialog}
    </li>
  );
}

export function FeatureFlagsEditor({
  fetchApi,
  tenantId,
}: {
  fetchApi: SessionFetch;
  tenantId: string;
}) {
  const load = useCallback(
    async () => (await listFeatureFlags(fetchApi)).data,
    [fetchApi],
  );
  const { state, reload } = useRemoteResource(load, true);
  const [busy, setBusy] = useState(0);
  const onBusy = useCallback(
    (delta: number) => setBusy((value) => value + delta),
    [],
  );
  return (
    <section
      id="capabilities"
      tabIndex={-1}
      aria-labelledby="capabilities-title"
      className="scroll-mt-20 border-t pt-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 id="capabilities-title" className="font-display text-2xl">
          Capacidades y parámetros
        </h2>
        <Button
          type="button"
          variant="outline"
          disabled={busy > 0 || state.status === 'loading'}
          onClick={reload}
        >
          Refrescar parámetros
        </Button>
      </div>
      <p className="mt-3 max-w-2xl font-body text-sm text-muted-foreground">
        Los cambios se aplican únicamente a este espacio. Cada parámetro indica
        su efecto actual.
      </p>
      {state.status === 'loading' ? (
        <LoadingState>Cargando parámetros…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="los parámetros"
          onRetry={reload}
        />
      ) : state.data.length ? (
        <ul className="divide-y">
          {state.data.map((flag) => (
            <FlagRow
              key={`${flag.id}:${flag.enabled}`}
              flag={flag}
              fetchApi={fetchApi}
              tenantId={tenantId}
              onBusy={onBusy}
            />
          ))}
        </ul>
      ) : (
        <p className="py-6 font-body text-sm">
          No hay parámetros registrados para este espacio.
        </p>
      )}
    </section>
  );
}
