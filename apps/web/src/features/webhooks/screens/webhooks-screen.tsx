'use client';
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSession } from '@/hooks/use-session';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import {
  createWebhook,
  deleteWebhook,
  listWebhookDeliveries,
  listWebhooks,
  replayWebhookDelivery,
  rotateWebhookSecret,
  testWebhook,
  updateWebhook,
  webhookSchema,
  type DeliveryView,
  type WebhookView,
} from '../api';
import {
  blockedDelivery,
  dateLabel,
  eventLabel,
  eventLabels,
} from '../presentation';
import { DeliveryHistory } from '../components/delivery-history';
import { SigningSecret, type SecretReveal } from '../components/signing-secret';
import { PageControls } from '@/features/shared/pagination';
import { actionFailureCopy, LoadFailure } from '@/features/shared/load-failure';
import { LoadingState, ActionFeedback } from '@/features/shared/feedback';
import { useActionConfirmation } from '@/features/shared/use-action-confirmation';
import { useRemoteResource } from '@/features/shared/use-remote-resource';
export type { WebhookView } from '../api';

type FormDraft = {
  target: WebhookView | null;
  url: string;
  eventCode: string;
  initialUrl: string;
  initialEvent: string;
};
type Notice = {
  kind: 'success' | 'error' | 'info';
  text: string;
  target: WebhookView;
};
export default function WebhooksPage() {
  const { session, fetchApi } = useSession(),
    confirmation = useActionConfirmation();
  const admin = Boolean(session?.user.roles.includes('admin'));
  const [page, setPage] = useState(1),
    [form, setForm] = useState<FormDraft | null>(null),
    [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<WebhookView | null>(null),
    [deliveryPage, setDeliveryPage] = useState(1);
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const locks = useRef(new Set<string>()),
    secretLock = useRef(false),
    lifetime = useRef(0),
    sequence = useRef(0);
  const [pending, setPending] = useState<Set<string>>(new Set()),
    [secretBusy, setSecretBusy] = useState(false);
  const [reveal, setReveal] = useState<SecretReveal | null>(null),
    [notices, setNotices] = useState<Record<string, Notice>>({});
  const load = useCallback(
    async () => (await listWebhooks(fetchApi, page)).data,
    [fetchApi, page],
  );
  const { state, reload } = useRemoteResource(load, admin);
  const webhooks = state.status === 'success' ? state.data.items : [],
    total = state.status === 'success' ? state.data.meta.total : 0;
  const historyLoad = useCallback(
    async () =>
      (await listWebhookDeliveries(fetchApi, selected?.id ?? '', deliveryPage))
        .data,
    [fetchApi, selected?.id, deliveryPage],
  );
  const history = useRemoteResource(historyLoad, admin && Boolean(selected));
  useEffect(
    () => () => {
      lifetime.current += 1;
    },
    [session?.user.tenantId, session?.user.id],
  );
  useEffect(() => {
    locks.current = new Set();
    secretLock.current = false;
    setPending(new Set());
    setSecretBusy(false);
    selectedRef.current = null;
    setSelected(null);
    setDeliveryPage(1);
    setForm(null);
    setFormError(null);
    setReveal(null);
    setNotices({});
  }, [session?.user.tenantId, session?.user.id]);
  useEffect(() => {
    if (state.status === 'success' && page > Math.max(1, Math.ceil(total / 20)))
      setPage(Math.max(1, Math.ceil(total / 20)));
  }, [state, page, total]);
  useEffect(() => {
    if (
      history.state.status === 'success' &&
      deliveryPage > Math.max(1, Math.ceil(history.state.data.meta.total / 20))
    )
      setDeliveryPage(
        Math.max(1, Math.ceil(history.state.data.meta.total / 20)),
      );
  }, [history.state, deliveryPage]);
  async function mutate<T>(
    key: string,
    work: () => Promise<T>,
    secret = false,
  ): Promise<T | undefined> {
    if (locks.current.has(key) || (secret && secretLock.current)) return;
    const generation = lifetime.current;
    locks.current.add(key);
    setPending(new Set(locks.current));
    if (secret) {
      secretLock.current = true;
      setSecretBusy(true);
    }
    try {
      const result = await work();
      return generation === lifetime.current ? result : undefined;
    } catch (cause) {
      if (generation !== lifetime.current) return;
      throw cause;
    } finally {
      if (generation === lifetime.current) {
        locks.current.delete(key);
        if (secret) secretLock.current = false;
        setPending(new Set(locks.current));
        if (secret) setSecretBusy(false);
      }
    }
  }
  function notify(
    target: WebhookView,
    text: string,
    kind: Notice['kind'] = 'success',
  ) {
    setNotices((previous) => ({
      ...previous,
      [target.id]: { target, text, kind },
    }));
  }
  function fail(target: WebhookView, cause: unknown, task: string) {
    notify(target, actionFailureCopy(cause, task), 'error');
  }
  function reconcile(input: WebhookView) {
    const target = webhookSchema.parse(input);
    if (selectedRef.current?.id === target.id) {
      selectedRef.current = target;
      setSelected(target);
    }
    setReveal((previous) =>
      previous?.target.id === target.id ? { ...previous, target } : previous,
    );
    reload();
  }
  function showHistory(target: WebhookView) {
    if (selectedRef.current?.id !== target.id) setDeliveryPage(1);
    selectedRef.current = target;
    setSelected(target);
  }
  function refreshHistoryIfCurrent(target: WebhookView) {
    if (selectedRef.current?.id === target.id) history.reload();
  }
  function changeForm(next: FormDraft | null) {
    if (form && locks.current.has(form.target?.id ?? 'create')) return;
    const change = () => {
      setForm(next);
      setFormError(null);
    };
    if (
      form &&
      (form.url !== form.initialUrl || form.eventCode !== form.initialEvent)
    )
      confirmation.confirm({
        title: 'Descartar cambios del formulario',
        description:
          'Los cambios de URL y evento todavía no se guardaron. Si continuás, se descartarán.',
        confirmLabel: 'Descartar cambios',
        task: 'el cierre del formulario',
        destructive: false,
        action: async () => change(),
      });
    else change();
  }
  function openForm(target: WebhookView | null = null) {
    changeForm({
      target,
      url: target?.url ?? '',
      eventCode: target?.eventCode ?? 'testimonial.created',
      initialUrl: target?.url ?? '',
      initialEvent: target?.eventCode ?? 'testimonial.created',
    });
  }
  function saveReveal(target: WebhookView, value: string) {
    setReveal({
      target: webhookSchema.parse(target),
      value,
      sequence: ++sequence.current,
    });
  }
  async function saveForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    const draft = form;
    setFormError(null);
    const action = async () => {
      const result = await mutate(
        draft.target?.id ?? 'create',
        () =>
          draft.target
            ? updateWebhook(fetchApi, draft.target.id, {
                url: draft.url,
                eventCode: draft.eventCode,
              })
            : createWebhook(fetchApi, {
                url: draft.url,
                eventCode: draft.eventCode,
              }),
        !draft.target,
      );
      if (!result) return;
      if (
        !draft.target &&
        'signingSecret' in result.data &&
        typeof result.data.signingSecret === 'string'
      ) {
        saveReveal(result.data, result.data.signingSecret);
        setPage(1);
      } else
        notify(
          result.data,
          'Cambios guardados. La URL y el evento nuevos se usarán para eventos futuros.',
        );
      setForm(null);
      reconcile(result.data);
    };
    if (!draft.target && reveal)
      confirmation.confirm({
        title: 'Reemplazar la revelación del secreto',
        description: `Guardá primero el secreto de ${reveal.target.url} (${eventLabel(reveal.target.eventCode)}). El secreto de ${draft.url} sólo lo reemplazará si se crea el destino correctamente.`,
        confirmLabel: 'Crear y reemplazar',
        task: 'la creación del webhook',
        destructive: false,
        action,
      });
    else
      try {
        await action();
      } catch (cause) {
        setFormError(
          actionFailureCopy(
            cause,
            draft.target
              ? 'la actualización del webhook'
              : 'la creación del webhook',
          ),
        );
      }
  }
  function rotate(target: WebhookView) {
    if (locks.current.has(target.id) || secretLock.current) return;
    confirmation.confirm({
      title: 'Rotar secreto del webhook',
      confirmLabel: 'Rotar secreto',
      destructive: false,
      task: 'la rotación del secreto',
      description: `Destino: ${target.url}. Evento: ${eventLabel(target.eventCode)}. Configurá el receptor con el nuevo secreto. Si existe uno anterior, la API informa su gracia y bloquea otra rotación durante esa ventana. Un conflicto también puede indicar que otro administrador cambió el destino: actualizá antes de decidir cómo seguir.${reveal ? ' Guardá antes el secreto que se muestra: sólo será reemplazado si esta rotación termina correctamente.' : ''}`,
      action: async () => {
        const result = await mutate(
          target.id,
          () => rotateWebhookSecret(fetchApi, target.id),
          true,
        );
        if (!result) return;
        saveReveal(result.data, result.data.signingSecret);
        reconcile(result.data);
      },
    });
  }
  function toggle(target: WebhookView) {
    if (locks.current.has(target.id)) return;
    const active = !target.isActive;
    confirmation.confirm({
      title: active ? 'Reactivar webhook' : 'Pausar webhook',
      confirmLabel: active ? 'Reactivar webhook' : 'Pausar webhook',
      destructive: false,
      task: 'el cambio de estado del webhook',
      description: `${target.url} · ${eventLabel(target.eventCode)}. ${active ? 'Volverá a recibir eventos nuevos. Comprobá HTTPS, firma y configuración del receptor antes de continuar.' : 'Dejará de recibir eventos nuevos. Las entregas ya encoladas pueden continuar; pausar no deshace efectos en el receptor.'}`,
      action: async () => {
        const result = await mutate(target.id, () =>
          updateWebhook(fetchApi, target.id, { isActive: active }),
        );
        if (!result) return;
        reconcile(result.data);
        notify(
          result.data,
          active
            ? 'Webhook reactivado para eventos nuevos.'
            : 'Webhook pausado para eventos nuevos.',
        );
      },
    });
  }
  function archive(target: WebhookView) {
    if (locks.current.has(target.id)) return;
    confirmation.confirm({
      title: 'Archivar webhook',
      confirmLabel: 'Archivar webhook',
      task: 'el archivo del webhook',
      description: `${target.url} · ${eventLabel(target.eventCode)}. Dejará de recibir eventos nuevos y no podrá editarse ni reactivarse. El destino y su historial se conservan. Las entregas ya encoladas pueden continuar.`,
      action: async () => {
        const result = await mutate(target.id, () =>
          deleteWebhook(fetchApi, target.id),
        );
        if (!result) return;
        const archived = {
          ...target,
          isActive: false,
          deletedAt: new Date().toISOString(),
        };
        reconcile(archived);
        notify(archived, 'Webhook archivado. El historial se conserva.');
      },
    });
  }
  async function sendTest(target: WebhookView) {
    try {
      const result = await mutate(target.id, () =>
        testWebhook(fetchApi, target.id),
      );
      if (!result) return;
      notify(
        target,
        `Prueba encolada (evento ${result.data.id}). Todavía no confirma una entrega. Abrí o actualizá el historial para comprobar el resultado.`,
        'info',
      );
      refreshHistoryIfCurrent(target);
    } catch (cause) {
      fail(target, cause, 'el envío de la prueba');
    }
  }
  async function replay(target: WebhookView, delivery: DeliveryView) {
    try {
      const result = await mutate(target.id, () =>
        replayWebhookDelivery(fetchApi, target.id, delivery.id),
      );
      if (!result) return;
      notify(
        target,
        `Reenvío encolado para la entrega ${result.data.id}. No confirma recepción; el historial anterior se conserva.`,
        'info',
      );
      refreshHistoryIfCurrent(target);
    } catch (cause) {
      fail(target, cause, 'el reenvío de la entrega');
    }
  }
  function hideSecret() {
    if (!reveal) return;
    confirmation.confirm({
      title: 'Ocultar secreto de firma',
      description: `Guardá el secreto de ${reveal.target.url} (${eventLabel(reveal.target.eventCode)}) antes de ocultarlo. No volverá a mostrarse y ocultarlo no lo revoca.`,
      confirmLabel: 'Ya lo guardé, ocultar',
      task: 'el cierre de la revelación',
      destructive: false,
      action: async () => setReveal(null),
    });
  }
  if (!admin)
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <ShieldAlert className="mb-4 h-10 w-10 text-destructive" />
        <h2 className="font-body text-lg font-bold">Acceso denegado</h2>
        <p className="text-muted-foreground">
          Solo administradores pueden ver esta sección.
        </p>
      </div>
    );
  const formBusy = Boolean(form && pending.has(form.target?.id ?? 'create'));
  return (
    <>
      <DashboardHeader
        title="Webhooks"
        description="Conectá eventos del espacio con tu receptor y comprobá sus entregas."
      >
        <Button type="button" disabled={secretBusy} onClick={() => openForm()}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo webhook
        </Button>
        <Button type="button" variant="ghost" onClick={reload}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar destinos
        </Button>
      </DashboardHeader>
      <details className="mb-6 font-body text-sm">
        <summary className="w-fit cursor-pointer py-2 font-medium underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
          Cómo conectar un receptor
        </summary>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-muted-foreground">
          <li>
            Prepará un receptor HTTPS público y creá el destino con el evento
            que necesitás. Queda activo al crearlo.
          </li>
          <li>
            Guardá el secreto y configurá la verificación de X-TMS-Signature y
            la deduplicación por ID de evento.
          </li>
          <li>
            Usá Probar para encolar un evento de prueba. Se envía sólo a ese
            destino.
          </li>
          <li>
            Abrí el historial y actualizalo para comprobar la respuesta HTTP. Un
            2xx confirma recepción; los efectos internos dependen del receptor.
          </li>
        </ol>
      </details>
      {reveal && reveal.target.tenantId === session?.user.tenantId && (
        <SigningSecret
          key={reveal.sequence}
          reveal={reveal}
          onHide={hideSecret}
          onHistory={() => showHistory(reveal.target)}
        />
      )}
      {secretBusy && (
        <LoadingState>
          Generando el secreto. Esperá el resultado antes de iniciar otra
          generación.
        </LoadingState>
      )}
      {form && (
        <form
          onSubmit={(event) => void saveForm(event)}
          aria-label={form.target ? 'Editar webhook' : 'Nuevo webhook'}
          aria-busy={formBusy}
          className="mb-8 border bg-card p-4 font-body sm:p-6"
        >
          <fieldset
            disabled={formBusy || (!form.target && secretBusy)}
            className="grid min-w-0 gap-5 sm:grid-cols-2"
          >
            <legend className="mb-4 text-lg font-semibold">
              {form.target ? 'Editar webhook' : 'Nuevo webhook'}
            </legend>
            <p className="text-sm text-muted-foreground sm:col-span-2">
              {form.target
                ? 'La URL y el evento nuevos afectan eventos futuros. Las entregas anteriores conservan su destino original.'
                : 'Se creará un destino activo. Prepará el receptor antes de enviar y guardá el secreto al terminar.'}
            </p>
            <div className="grid content-start gap-2">
              <Label htmlFor="webhook-url">URL de destino</Label>
              <Input
                id="webhook-url"
                name="url"
                type="url"
                pattern="https://.*"
                required
                value={form.url}
                onChange={(event) =>
                  setForm({ ...form, url: event.target.value })
                }
                aria-describedby="webhook-url-hint"
                placeholder="https://receptor.example.com/eventos"
              />
              <p
                id="webhook-url-hint"
                className="text-xs text-muted-foreground"
              >
                HTTPS público. La API valida también el destino para impedir
                acceso a redes privadas.
              </p>
            </div>
            <div className="grid content-start gap-2">
              <Label htmlFor="webhook-event">Evento</Label>
              <select
                id="webhook-event"
                name="eventCode"
                required
                value={form.eventCode}
                onChange={(event) =>
                  setForm({ ...form, eventCode: event.target.value })
                }
                className="h-11 min-w-0 w-full border bg-background px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
              >
                {!eventLabels[form.eventCode] && (
                  <option value={form.eventCode}>
                    {form.eventCode} (actual)
                  </option>
                )}
                {Object.entries(eventLabels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            {formError && (
              <div className="sm:col-span-2">
                <ActionFeedback>{formError}</ActionFeedback>
              </div>
            )}
            <div className="flex flex-wrap gap-3 sm:col-span-2">
              <Button type="submit">
                {formBusy
                  ? 'Guardando…'
                  : form.target
                    ? 'Guardar cambios'
                    : 'Crear webhook'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => changeForm(null)}
              >
                Cerrar formulario
              </Button>
            </div>
          </fieldset>
        </form>
      )}
      {Object.values(notices).map((notice) => (
        <ActionFeedback key={notice.target.id} kind={notice.kind}>
          <p className="break-words">
            {notice.target.url} · {eventLabel(notice.target.eventCode)}:{' '}
            {notice.text}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {notice.kind === 'info' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => showHistory(notice.target)}
              >
                Ver entregas de este destino
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label={`Cerrar aviso de ${notice.target.url}`}
              onClick={() =>
                setNotices((previous) =>
                  Object.fromEntries(
                    Object.entries(previous).filter(
                      ([id]) => id !== notice.target.id,
                    ),
                  ),
                )
              }
            >
              Cerrar aviso
            </Button>
          </div>
        </ActionFeedback>
      ))}
      {state.status === 'loading' ? (
        <LoadingState>Cargando webhooks…</LoadingState>
      ) : state.status === 'error' ? (
        <LoadFailure
          error={state.error}
          resource="los webhooks"
          onRetry={reload}
        />
      ) : webhooks.length === 0 ? (
        <div className="border border-dashed p-8 text-center font-body text-sm text-muted-foreground">
          No hay destinos configurados. Prepará tu receptor HTTPS y creá tu
          primer webhook.
        </div>
      ) : (
        <>
          <p className="mb-3 font-body text-sm text-muted-foreground sm:hidden">
            Deslizá la tabla para ver el estado y las acciones.
          </p>
          <div
            role="region"
            aria-label="Tabla de webhooks"
            tabIndex={0}
            className="min-w-0 overflow-x-auto"
          >
            <table className="w-full min-w-[820px] font-body text-sm">
              <caption className="sr-only">
                Destinos webhook del espacio, incluidos los archivados
              </caption>
              <thead>
                <tr className="border-b">
                  {['Destino y evento', 'Estado y firma', 'Acciones'].map(
                    (label) => (
                      <th
                        key={label}
                        scope="col"
                        className="pb-3 pr-4 text-left text-xs font-semibold text-muted-foreground"
                      >
                        {label}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {webhooks.map((target) => {
                  const busy = pending.has(target.id),
                    blocked = blockedDelivery(target),
                    grace = Boolean(
                      target.signatureGraceUntil &&
                        Date.parse(target.signatureGraceUntil) > Date.now(),
                    );
                  return (
                    <Fragment key={target.id}>
                      <tr className="border-b border-border align-top">
                        <td className="max-w-80 py-4 pr-5">
                          <p className="break-all font-medium">{target.url}</p>
                          <p className="mt-2 text-muted-foreground">
                            {eventLabel(target.eventCode)}
                          </p>
                          <p className="mt-1 break-all text-xs text-muted-foreground">
                            {target.eventCode}
                          </p>
                        </td>
                        <td className="max-w-64 py-4 pr-5">
                          <span
                            className={
                              target.isActive && !target.deletedAt
                                ? 'font-semibold text-success'
                                : 'font-semibold text-muted-foreground'
                            }
                          >
                            {target.deletedAt
                              ? 'Archivado'
                              : target.isActive
                                ? 'Activo'
                                : 'Pausado'}
                          </span>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {target.hasSignature
                              ? 'Firma configurada'
                              : 'Sin firma configurada'}
                          </p>
                          {target.signatureGraceUntil && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Gracia informada hasta{' '}
                              {dateLabel(target.signatureGraceUntil)}.
                              {grace
                                ? ' Actualizá los destinos al finalizar para habilitar otra rotación.'
                                : ''}
                            </p>
                          )}
                          {target.legacyHttp && (
                            <p className="mt-2 text-xs text-warning">
                              {target.legacyHttp.canDeliver
                                ? `HTTP legado: migrá a HTTPS antes de ${target.legacyHttp.deadlineAt ? dateLabel(target.legacyHttp.deadlineAt) : 'su plazo configurado'}.`
                                : 'Envío HTTP bloqueado: editá la URL para usar HTTPS antes de reactivar.'}
                            </p>
                          )}
                          {target.legacyUnsigned && (
                            <p className="mt-2 text-xs text-warning">
                              {target.legacyUnsigned.canDeliver
                                ? `Firma pendiente: rotá el secreto antes de ${target.legacyUnsigned.deadlineAt ? dateLabel(target.legacyUnsigned.deadlineAt) : 'su plazo configurado'}.`
                                : 'Envío sin firma bloqueado: rotá el secreto antes de reactivar.'}
                            </p>
                          )}
                        </td>
                        <td className="max-w-96 py-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => showHistory(target)}
                            >
                              Historial
                            </Button>
                            {!target.deletedAt && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || !target.isActive || blocked}
                                  aria-label={`Probar webhook ${target.url}`}
                                  onClick={() => void sendTest(target)}
                                >
                                  Probar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => openForm(target)}
                                >
                                  Editar
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={
                                    busy || (!target.isActive && blocked)
                                  }
                                  onClick={() => toggle(target)}
                                >
                                  {target.isActive ? 'Pausar' : 'Reactivar'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={busy || secretBusy || grace}
                                  onClick={() => rotate(target)}
                                >
                                  Rotar secreto
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive"
                                  disabled={busy}
                                  aria-label={`Archivar webhook ${target.url}`}
                                  onClick={() => archive(target)}
                                >
                                  Archivar
                                </Button>
                              </>
                            )}
                          </div>
                          {busy && (
                            <LoadingState className="py-3">
                              Operación pendiente para este destino.
                            </LoadingState>
                          )}
                        </td>
                      </tr>
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
      {state.status === 'success' && (
        <PageControls page={page} total={total} limit={20} onChange={setPage} />
      )}
      {selected && (
        <DeliveryHistory
          target={selected}
          state={history.state}
          page={deliveryPage}
          busy={pending.has(selected.id)}
          onPage={setDeliveryPage}
          onRefresh={history.reload}
          onClose={() => {
            selectedRef.current = null;
            setSelected(null);
          }}
          onReplay={(delivery) => void replay(selected, delivery)}
        />
      )}
      {confirmation.dialog}
    </>
  );
}
