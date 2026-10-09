import type { BiRun, BiSettings, LoadRequest, OperationsState } from '../operations.types';

const messages = new Map<string, string>([
  ['BI_WORKER_UNAVAILABLE', 'El servicio de cargas no envía una señal vigente.'],
  ['BI_LOAD_FAILED', 'La última carga falló y todavía no hubo una publicación que la recupere.'],
  ['BI_REQUEST_EXPIRED', 'Una solicitud venció antes de comenzar; no se trasladará a otra hora.'],
  ['BI_SCHEDULE_DELAYED', 'La actualización superó la frecuencia y la tolerancia configuradas.'],
  ['BI_ETL_FAILED', 'La carga no pudo completarse. Se conserva el último corte correcto.'],
  ['BI_DEADLINE_EXCEEDED', 'La carga superó su tiempo permitido.'],
  ['BI_SLOT_CHANGED', 'La observación cambió de hora UTC y no se publicará como un corte anterior.'],
  ['BI_SOURCE_INCONSISTENT', 'La extracción no superó la conciliación; se conservó el último corte correcto.'],
  ['BI_SOURCE_NOT_NEWER', 'La observación no es posterior al último corte publicado.'],
  ['BI_CONFIGURATION_INVALID', 'La configuración técnica de la carga necesita revisión de operación.'],
  ['BI_LEASE_LOST', 'La carga perdió su reserva; el servicio debe recuperar el intento.'],
  ['BI_ATTEMPTS_EXHAUSTED', 'Se agotaron los tres intentos de la hora UTC actual.'],
  ['BI_ALREADY_SUCCEEDED', 'Ya existe una publicación correcta en la hora UTC actual.'],
  ['BI_ALREADY_RUNNING', 'Hay una carga en ejecución.'],
  ['BI_REQUEST_CONFLICT', 'Hay una solicitud pendiente o en ejecución.'],
  ['BI_RECOVERY_REQUIRED', 'El servicio debe recuperar una reserva o ejecución interrumpida.'],
  ['BI_RETRY_NOT_ALLOWED', 'No hay una ejecución fallida disponible para reintentar.'],
  ['BI_REQUEST_NOT_PENDING', 'Sólo se puede cancelar una solicitud pendiente y vigente.'],
  ['BI_UNAVAILABLE', 'El control de cargas no está disponible.'],
  ['BI_ADMIN_REQUIRED', 'Esta acción requiere el rol de administrador.'],
]);
export function safeBiError(code: string | null): string | null {
  return code === null ? null : messages.get(code) ?? 'La operación no pudo completarse. Revisá el estado del servicio.';
}
export function presentRun(run: BiRun) { return { ...run, errorMessage: safeBiError(run.errorCode) }; }
export function presentRequest(request: LoadRequest) { return { ...request, errorMessage: safeBiError(request.errorCode) }; }
export function freshnessPolicy(ageSeconds: number | null, settings: BiSettings) {
  const staleAfterSeconds = settings.frequencyHours * 3600 + settings.delayToleranceMinutes * 60;
  return { status: ageSeconds === null ? 'not_loaded' as const : ageSeconds > staleAfterSeconds ? 'stale' as const : 'fresh' as const,
    staleAfterSeconds, frequencyHours: settings.frequencyHours, delayToleranceMinutes: settings.delayToleranceMinutes,
    schedulePaused: !settings.scheduleEnabled };
}
function action(reason: string | null) { return { allowed: reason === null, reason, message: safeBiError(reason) }; }
export function operationsStatus(state: OperationsState, isAdmin: boolean, controlConfigured: boolean) {
  const now = Date.parse(state.now);
  const workerOnline = state.workerLastSeenAt !== null && now - Date.parse(state.workerLastSeenAt) < 60000;
  const leaseLive = state.lease?.until !== null && state.lease?.until !== undefined && Date.parse(state.lease.until) > now;
  let reason: string | null = !isAdmin ? 'BI_ADMIN_REQUIRED' : !controlConfigured ? 'BI_UNAVAILABLE' : null;
  if (!reason) {
    if (state.lease) reason = leaseLive ? 'BI_ALREADY_RUNNING' : 'BI_RECOVERY_REQUIRED';
    else if (state.activeRun) reason = 'BI_RECOVERY_REQUIRED';
    else if (state.activeRequest && (state.activeRequest.status !== 'pending' || Date.parse(state.activeRequest.expiresAt) > now)) reason = 'BI_REQUEST_CONFLICT';
    else if (state.succeededThisHour) reason = 'BI_ALREADY_SUCCEEDED';
    else if (state.attempts >= 3) reason = 'BI_ATTEMPTS_EXHAUSTED';
    else if (!workerOnline) reason = 'BI_WORKER_UNAVAILABLE';
  }
  const alerts: Array<{ code: string; severity: 'warning' | 'error'; message: string; runId?: string; requestId?: string }> = [];
  const addAlert = (code: string, severity: 'warning' | 'error', reference: { runId?: string; requestId?: string } = {}) => {
    alerts.push({ code, severity, message: safeBiError(code)!, ...reference });
  };
  if (!workerOnline) addAlert('BI_WORKER_UNAVAILABLE', 'error');
  const recoveredAt = state.lastSuccessAt === null ? -Infinity : Date.parse(state.lastSuccessAt);
  if (state.settings.alertFailures) {
    if (state.latestFailure && Date.parse(state.latestFailure.finishedAt ?? state.latestFailure.startedAt) > recoveredAt) {
      addAlert('BI_LOAD_FAILED', 'error', { runId: state.latestFailure.id });
    }
    if (state.latestExpiredRequest && Date.parse(state.latestExpiredRequest.finishedAt ?? state.latestExpiredRequest.expiresAt) > recoveredAt) {
      addAlert('BI_REQUEST_EXPIRED', 'warning', { requestId: state.latestExpiredRequest.id });
    }
    // A worker outage may leave a physically pending request past expiry. Reads explain it without mutating the queue.
    if (state.activeRequest?.status === 'pending' && Date.parse(state.activeRequest.expiresAt) <= now) {
      addAlert('BI_REQUEST_EXPIRED', 'warning', { requestId: state.activeRequest.id });
    }
  }
  const age = state.sourceSnapshotAt === null ? null : Math.max(0, (now - Date.parse(state.sourceSnapshotAt)) / 1000);
  const freshness = freshnessPolicy(age, state.settings);
  const initialDelayed = age === null && state.settings.version > 0 && state.settings.nextScheduledAt !== null
    && now - Date.parse(state.settings.nextScheduledAt) > state.settings.delayToleranceMinutes * 60000;
  if (state.settings.scheduleEnabled && state.settings.alertDelays && (freshness.status === 'stale' || initialDelayed)) {
    addAlert('BI_SCHEDULE_DELAYED', 'warning');
  }
  const pending = state.activeRequest;
  const cancelReason = !isAdmin ? 'BI_ADMIN_REQUIRED' : !controlConfigured ? 'BI_UNAVAILABLE'
    : pending?.status === 'pending' && Date.parse(pending.expiresAt) > now ? null : 'BI_REQUEST_NOT_PENDING';
  return { observedAt: state.now, timezone: 'UTC' as const,
    service: { status: workerOnline ? 'online' as const : 'unavailable' as const, lastSeenAt: state.workerLastSeenAt, heartbeatTimeoutSeconds: 60 },
    schedule: { paused: !state.settings.scheduleEnabled, frequencyHours: state.settings.frequencyHours,
      nextScheduledAt: state.settings.nextScheduledAt, delayToleranceMinutes: state.settings.delayToleranceMinutes },
    budget: { slotAt: new Date(Math.floor(now / 3600000) * 3600000).toISOString(), maxAttempts: 3,
      attemptsUsed: state.attempts, attemptsRemaining: Math.max(0, 3 - state.attempts), succeeded: state.succeededThisHour },
    activeRun: state.activeRun ? presentRun(state.activeRun) : null,
    activeRequest: pending ? presentRequest(pending) : null,
    freshness: { ...freshness, sourceSnapshotAt: state.sourceSnapshotAt, lastPublishedAt: state.lastPublishedAt, dataAgeSeconds: age },
    alerts, actions: { runNow: action(reason),
      retry: { ...action(reason ?? (state.latestFailure ? null : 'BI_RETRY_NOT_ALLOWED')), runId: state.latestFailure?.id ?? null },
      cancel: { ...action(cancelReason), requestId: pending?.id ?? null },
      updateSettings: action(!isAdmin ? 'BI_ADMIN_REQUIRED' : !controlConfigured ? 'BI_UNAVAILABLE' : null) } };
}
