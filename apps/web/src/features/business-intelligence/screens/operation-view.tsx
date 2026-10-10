'use client';

import type { BiStatus } from '../operations-schemas';
import type { BiCommand } from '../use-bi-command';
import { timestamp, phaseName, statusNames } from '../format';
import { ActionButton, DetailLink } from '../components/shared';

export default function OperationView({ status, isAdmin, busy, blocked, execute, href }: {
  status: BiStatus; isAdmin: boolean; busy: boolean; blocked: boolean; execute: (command: BiCommand) => void; href: (type: 'run' | 'request', id: string) => string;
}) {
  return <section className="mt-6 space-y-6" aria-labelledby="bi-operation-title">
    <h2 id="bi-operation-title" className="text-lg font-semibold">Operación de cargas</h2>
    <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {[
        ['Servicio de cargas', status.service.status === 'online' ? 'En línea' : 'Sin señal vigente'],
        ['Última señal del servicio', timestamp(status.service.lastSeenAt)],
        ['Programación', status.schedule.paused ? 'Pausada' : `Cada ${status.schedule.frequencyHours} h`],
        ['Próxima ejecución prevista', status.schedule.paused ? 'Pausada' : timestamp(status.schedule.nextScheduledAt)],
        ['Presupuesto de la hora UTC', `${status.budget.attemptsRemaining} de ${status.budget.maxAttempts} intentos disponibles`],
        ['Publicación en esta hora', status.budget.succeeded ? 'Ya publicada' : 'Sin publicación exitosa'],
      ].map(([label, value]) => <div className="min-w-0 border p-5" key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-3 break-words font-medium">{value}</dd></div>)}
    </dl>
    <p className="text-sm text-muted-foreground">Presupuesto desde {timestamp(status.budget.slotAt)}. La próxima ejecución indica elegibilidad; el servicio puede estar atendiendo otra carga.</p>
    <section className="border p-5"><h3 className="font-semibold">Actividad de tu empresa</h3>
      {status.activeRequest ? <p className="mt-3 text-sm">Solicitud: {statusNames[status.activeRequest.status]} · <DetailLink href={href('request', status.activeRequest.id)}>Ver solicitud</DetailLink></p> : <p className="mt-3 text-sm">No hay solicitudes activas.</p>}
      {status.activeRun ? <p className="mt-3 text-sm">Carga: {phaseName(status.activeRun.phase)} · intento {status.activeRun.attemptNo}/3 · <DetailLink href={href('run', status.activeRun.id)}>Ver ejecución activa</DetailLink></p> : <p className="mt-3 text-sm">No hay una ejecución activa registrada.</p>}
    </section>
    {isAdmin ? <div className="flex flex-wrap items-start gap-6">
      <ActionButton action={status.actions.runNow} busy={busy} disabled={blocked} onClick={() => execute({ type: 'create', input: { kind: 'manual' } })}>Ejecutar ahora</ActionButton>
      <ActionButton action={status.actions.retry} busy={busy} disabled={blocked} onClick={() => { const id = status.actions.retry.runId; if (id) execute({ type: 'create', input: { kind: 'retry', retryOfRunId: id } }); }}>Reintentar última fallida</ActionButton>
      {status.activeRequest && <ActionButton action={status.actions.cancel} busy={busy} disabled={blocked} onClick={() => execute({ type: 'cancel', id: status.activeRequest!.id })}>Cancelar solicitud pendiente</ActionButton>}
    </div> : <p className="border p-4 text-sm">Podés consultar cargas y alertas. La operación está reservada a administradores.</p>}
    <p className="text-sm text-muted-foreground">Ejecutar ahora crea una solicitud pendiente, incluso con programación pausada. Un reintento observa el estado actual: no reconstruye una hora pasada. Una carga en ejecución no se puede cancelar.</p>
  </section>;
}
