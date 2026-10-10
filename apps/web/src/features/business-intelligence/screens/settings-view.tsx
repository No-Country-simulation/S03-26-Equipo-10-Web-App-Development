'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import type { SessionFetch } from '@/lib/api/validated-response';
import { getBiSettings, patchBiSettings } from '../operations-api';
import { settingsInputSchema, type BiAction, type BiSettings, type SettingsInput } from '../operations-schemas';
import { useBiResource } from '../use-bi-resource';
import { timestamp } from '../format';
import { BiFailure, Loading, biFailure, selectClass } from '../components/shared';

function preferences(settings: BiSettings): SettingsInput {
  return { expectedVersion: settings.version, frequencyHours: settings.frequencyHours, scheduleEnabled: settings.scheduleEnabled,
    alertFailures: settings.alertFailures, alertDelays: settings.alertDelays, delayToleranceMinutes: settings.delayToleranceMinutes };
}
export function SettingsForm({ settings, fetchApi, isAdmin, action, blocked, onSaved }: {
  settings: BiSettings; fetchApi: SessionFetch; isAdmin: boolean; action?: BiAction; blocked: boolean; onSaved: () => void;
}) {
  const [base, setBase] = useState(() => preferences(settings));
  const [draft, setDraft] = useState(() => preferences(settings));
  const [busy, setBusy] = useState(false); const [error, setError] = useState<unknown>();
  const [conflict, setConflict] = useState(false); const [latest, setLatest] = useState<BiSettings | null>(null); const [notice, setNotice] = useState('');
  const alive = useRef(true); const lock = useRef(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function save(event: FormEvent) {
    event.preventDefault(); if (lock.current || !isAdmin || blocked || !action?.allowed || conflict) return;
    const valid = settingsInputSchema.safeParse(draft);
    if (!valid.success) { setNotice('Revisá la frecuencia y la tolerancia seleccionadas.'); return; }
    lock.current = true; setBusy(true); setError(undefined); setNotice('');
    try {
      const response = await patchBiSettings(fetchApi, valid.data);
      if (alive.current) { setDraft(preferences(response.data)); setBase(preferences(response.data)); setLatest(null); setNotice('Configuración guardada.'); onSaved(); }
    } catch (failure) {
      if (alive.current) { setError(failure); setConflict(true); setLatest(null); }
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function loadLatest() {
    if (lock.current) return; lock.current = true; setBusy(true);
    try { const response = await getBiSettings(fetchApi); if (alive.current) { setLatest(response.data); setError(undefined); } }
    catch (failure) { if (alive.current) setError(failure); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const fieldsDisabled = !isAdmin || busy;
  const disabled = fieldsDisabled || blocked || !action?.allowed;
  return <div className="mt-5 max-w-3xl space-y-5">
    {!isAdmin && <p className="border p-4 text-sm">Configuración de tu empresa. Sólo los administradores pueden modificarla.</p>}
    <form onSubmit={save} aria-label="Configuración BI" className="space-y-6">
      <fieldset disabled={fieldsDisabled} className="space-y-5"><legend className="font-semibold">Programación en UTC</legend>
        <label className="block text-sm">Frecuencia<select className={selectClass} value={draft.frequencyHours} onChange={e => setDraft({ ...draft, frequencyHours: Number(e.target.value) as SettingsInput['frequencyHours'] })}><option value="1">Cada hora</option><option value="6">Cada 6 horas (00, 06, 12 y 18 UTC)</option><option value="24">Cada 24 horas (00 UTC)</option></select></label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={!draft.scheduleEnabled} onChange={e => setDraft({ ...draft, scheduleEnabled: !e.target.checked })} />Pausar cargas automáticas</label>
        <p className="text-sm text-muted-foreground">La ejecución activa termina normalmente. Las solicitudes manuales siguen disponibles durante la pausa. Al reanudar se intenta una observación actual si el presupuesto lo permite.</p>
      </fieldset>
      <fieldset disabled={fieldsDisabled} className="space-y-5"><legend className="font-semibold">Alertas dentro del módulo</legend>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.alertFailures} onChange={e => setDraft({ ...draft, alertFailures: e.target.checked })} />Avisar fallos de cargas</label>
        <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={draft.alertDelays} onChange={e => setDraft({ ...draft, alertDelays: e.target.checked })} />Avisar atrasos de programación</label>
        <label className="block text-sm">Tolerancia de atraso<select className={selectClass} value={draft.delayToleranceMinutes} onChange={e => setDraft({ ...draft, delayToleranceMinutes: Number(e.target.value) as SettingsInput['delayToleranceMinutes'] })}>{[30, 60, 120].map(value => <option value={value} key={value}>{value} minutos</option>)}</select></label>
        <p className="text-sm text-muted-foreground">La vigencia considera frecuencia más tolerancia. La pausa suspende el aviso de atraso programado.</p>
      </fieldset>
      <p className="text-sm text-muted-foreground">Versión de edición: {draft.expectedVersion}. Próxima ejecución registrada: {timestamp(settings.nextScheduledAt)}.</p>
      {isAdmin && <Button type="submit" disabled={disabled || conflict}>{busy ? 'Guardando…' : 'Guardar configuración'}</Button>}
      {isAdmin && action && !action.allowed && <p className="text-sm">{action.message ?? 'No podés modificar la configuración en este momento.'}</p>}
    </form>
    {Boolean(error) && <p role="alert" className="border border-destructive/50 p-4 text-sm">{biFailure(error)}{!(error instanceof ApiError && error.code === 'BI_SETTINGS_CONFLICT') && ' Tus campos se conservaron. Consultá la versión vigente antes de volver a guardar.'}</p>}
    {conflict && <div className="space-y-3 border p-4 text-sm"><p>La edición está detenida hasta revisar la configuración del servidor. Al conservar tus cambios, los campos que no editaste usarán los valores vigentes.</p><Button type="button" variant="outline" disabled={busy} onClick={() => void loadLatest()}>Cargar versión vigente</Button>
      {latest && <><p>Versión vigente: {latest.version}. Frecuencia: {latest.frequencyHours} h. Programación: {latest.scheduleEnabled ? 'Activa' : 'Pausada'}. Alertas de fallos: {latest.alertFailures ? 'Sí' : 'No'}. Alertas de atrasos: {latest.alertDelays ? 'Sí' : 'No'}. Tolerancia: {latest.delayToleranceMinutes} minutos.</p>
        <div className="flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => { setDraft(preferences(latest)); setBase(preferences(latest)); setConflict(false); setLatest(null); setError(undefined); }}>Usar configuración vigente</Button>
          <Button type="button" variant="outline" onClick={() => { setDraft({ expectedVersion: latest.version,
            frequencyHours: draft.frequencyHours !== base.frequencyHours ? draft.frequencyHours : latest.frequencyHours,
            scheduleEnabled: draft.scheduleEnabled !== base.scheduleEnabled ? draft.scheduleEnabled : latest.scheduleEnabled,
            alertFailures: draft.alertFailures !== base.alertFailures ? draft.alertFailures : latest.alertFailures,
            alertDelays: draft.alertDelays !== base.alertDelays ? draft.alertDelays : latest.alertDelays,
            delayToleranceMinutes: draft.delayToleranceMinutes !== base.delayToleranceMinutes ? draft.delayToleranceMinutes : latest.delayToleranceMinutes,
          }); setBase(preferences(latest)); setConflict(false); setLatest(null); setError(undefined); setNotice('Revisá tus cambios antes de guardarlos sobre la versión vigente.'); }}>Conservar mis cambios sobre esta versión</Button></div></>}
    </div>}
    {notice && <p role="status" className="border p-4 text-sm">{notice}</p>}
  </div>;
}
export default function SettingsView({ fetchApi, refreshKey, isAdmin, action, blocked, onSaved }: { fetchApi: SessionFetch; refreshKey: number; isAdmin: boolean; action?: BiAction; blocked: boolean; onSaved: () => void }) {
  const load = useCallback(async (signal: AbortSignal) => (await getBiSettings(fetchApi, signal)).data, [fetchApi]);
  const resource = useBiResource(load, true, null, refreshKey);
  return <section className="mt-6"><h2 className="text-lg font-semibold">Configuración de inteligencia de negocio</h2>
    {resource.loading && <Loading />}{Boolean(resource.error) && <BiFailure error={resource.error} onRetry={resource.reload} retained={Boolean(resource.data)} />}
    {resource.data && <SettingsForm key={isAdmin ? 'admin-form' : resource.data.version} settings={resource.data} fetchApi={fetchApi} isAdmin={isAdmin} action={action} blocked={blocked || Boolean(resource.error) || resource.refreshing} onSaved={onSaved} />}
  </section>;
}
