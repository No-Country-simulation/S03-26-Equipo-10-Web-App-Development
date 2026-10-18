'use client';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/features/shared/feedback';
import { LoadFailure } from '@/features/shared/load-failure';
import { PageControls } from '@/features/shared/pagination';
import type { RemoteState } from '@/features/shared/use-remote-resource';
import type { DeliveryView, WebhookView } from '../api';
import {
  attemptLabels,
  dateLabel,
  deliveryLabels,
  eventLabel,
} from '../presentation';

type DeliveryPage = {
  items: DeliveryView[];
  meta: { total: number; page: number; limit: number };
};
export function DeliveryHistory({
  target,
  state,
  page,
  busy,
  onPage,
  onRefresh,
  onReplay,
  onClose,
}: {
  target: WebhookView;
  state: RemoteState<DeliveryPage>;
  page: number;
  busy: boolean;
  onPage: (page: number) => void;
  onRefresh: () => void;
  onReplay: (delivery: DeliveryView) => void;
  onClose: () => void;
}) {
  return (
    <section
      aria-label="Historial de entregas"
      className="mt-8 min-w-0 border bg-card p-4 font-body sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">Historial de entregas</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={state.status === 'loading'}
            onClick={onRefresh}
          >
            Actualizar historial
          </Button>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cerrar historial
          </Button>
        </div>
      </div>
      <p className="mt-2 break-all text-sm font-medium">{target.url}</p>
      <p className="mt-1 text-sm text-muted-foreground">
        {eventLabel(target.eventCode)}
        {target.deletedAt
          ? ' · Destino archivado'
          : !target.isActive
            ? ' · Destino pausado'
            : ''}
      </p>
      <p className="mt-3 max-w-prose text-sm text-muted-foreground">
        Esta referencia corresponde al destino actual. Las entregas anteriores
        conservan la URL de cuando se encolaron; su evento también pudo ser
        distinto. Una respuesta HTTP 2xx confirma recepción, no el procesamiento
        interno del receptor.
      </p>
      {state.status === 'loading' ? (
        <LoadingState>Cargando entregas…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="las entregas de este destino"
          onRetry={onRefresh}
        />
      ) : state.data.items.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          Todavía no hay entregas. Si el destino está activo, configurá tu
          receptor y enviá una prueba desde la tabla.
        </p>
      ) : (
        <ul className="mt-5 divide-y divide-border">
          {state.data.items.map((delivery) => (
            <li key={delivery.id} className="min-w-0 py-4">
              <div className="flex flex-wrap items-center gap-3">
                <strong
                  className={
                    delivery.status === 'dead'
                      ? 'text-destructive'
                      : delivery.status === 'success'
                        ? 'text-success'
                        : ''
                  }
                >
                  {deliveryLabels[delivery.status] ?? 'Estado no reconocido'}
                </strong>
                <span className="text-sm">
                  {delivery.attempts}{' '}
                  {delivery.attempts === 1 ? 'intento' : 'intentos'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {delivery.responseCode === null
                    ? 'Sin respuesta HTTP'
                    : `HTTP ${delivery.responseCode}`}
                </span>
                <time
                  dateTime={delivery.createdAt}
                  className="text-xs text-muted-foreground"
                >
                  {dateLabel(delivery.createdAt)}
                </time>
                {delivery.status === 'dead' && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => onReplay(delivery)}
                  >
                    Reenviar
                  </Button>
                )}
              </div>
              <p className="mt-2 break-all text-xs text-muted-foreground">
                Entrega: {delivery.id}
                {delivery.outboxEventId
                  ? ` · Evento: ${delivery.outboxEventId}`
                  : ''}
              </p>
              {delivery.status === 'dead' && (
                <p className="mt-2 text-sm text-muted-foreground">
                  No se confirmó la entrega y este ciclo terminó. Corregí el
                  receptor antes de reenviar; el historial se conserva y pueden
                  existir efectos anteriores.
                </p>
              )}
              <details className="mt-3 min-w-0">
                <summary className="w-fit cursor-pointer py-2 text-sm font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                  Ver intentos ({delivery.attemptHistory?.length ?? 0}{' '}
                  disponibles)
                </summary>
                <p className="mt-2 text-xs text-muted-foreground">
                  Hasta los 20 intentos más recientes. El contador incluye
                  intentos de todos los ciclos.
                </p>
                {delivery.attemptHistory?.length ? (
                  <ol className="mt-3 space-y-3">
                    {delivery.attemptHistory.map((attempt) => (
                      <li
                        key={attempt.attemptNo}
                        className="border-b border-border py-3 text-sm"
                      >
                        <p className="font-medium">
                          Intento {attempt.attemptNo} ·{' '}
                          <span>
                            {attemptLabels[attempt.status] ??
                              'Estado no reconocido'}
                          </span>
                        </p>
                        <p className="mt-1 text-muted-foreground">
                          {attempt.responseCode === null
                            ? 'Sin respuesta HTTP'
                            : `HTTP ${attempt.responseCode}`}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Inicio: {dateLabel(attempt.startedAt)} ·{' '}
                          {attempt.completedAt
                            ? `Fin: ${dateLabel(attempt.completedAt)}`
                            : 'Sin finalización registrada'}
                        </p>
                        {attempt.errorMessage && (
                          <pre className="mt-2 whitespace-pre-wrap break-words font-body text-sm">
                            {attempt.errorMessage}
                          </pre>
                        )}
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {delivery.attempts === 0
                      ? 'Todavía no hay intentos registrados.'
                      : 'El servidor no devolvió detalle de estos intentos.'}
                  </p>
                )}
              </details>
            </li>
          ))}
        </ul>
      )}
      {state.status === 'success' && (
        <fieldset disabled={busy} className="min-w-0">
          <PageControls
            page={page}
            total={state.data.meta.total}
            limit={20}
            onChange={onPage}
          />
        </fieldset>
      )}
    </section>
  );
}
