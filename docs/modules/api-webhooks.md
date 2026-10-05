# Módulo de webhooks

**Estado:** implementación local de las Fases 3 y 7 del [plan HITL](../plan/2026-09-30_chore-endurecimiento-seguridad.md). Las migraciones y el despliegue persistente requieren revisión separada.

Los listados administrativos de destinos y entregas aceptan `page` y `limit` (1 y 20 por defecto, máximo 100) y responden `{ items, meta: { page, limit, total } }`. La API expone métricas de intentos por resultado, entregas pendientes y `dead`, fallos de polling y edad del evento pendiente más antiguo en `/api/v1/internal/metrics` mediante `x-metrics-token`. Ver [operación de fase 8](../operations/14_phase8_observability_rollout.md).

## Escritura y entrega

El productor escribe el cambio de dominio, un `outbox_events` y una entrega lógica por destino activo en la **misma transacción PostgreSQL**. La pareja `(outbox_event_id, webhook_id)` es única y cada entrega guarda la URL de destino vigente al crearse. Los cambios posteriores de URL solo afectan eventos nuevos. Los eventos anteriores a esta versión, sin entregas inicializadas, se recuperan mediante un inicializador transaccional que usa `FOR UPDATE SKIP LOCKED`.

El procesador consulta entregas `pending` cuyo `next_retry_at` haya vencido. Cada adquisición usa `FOR UPDATE SKIP LOCKED`, incrementa el contador e inserta un registro en `webhook_delivery_attempts` antes de hacer HTTP. Procesa como máximo cinco entregas a la vez por instancia. Un token de lease identifica al propietario del intento; un resultado tardío no puede sobrescribir el estado si el lease venció y otro worker lo adquirió. Los intentos interrumpidos quedan en el historial.

Cada intento hace **una sola llamada HTTP** con timeout de cinco segundos. 2xx confirma; 408, 429, 5xx y errores de red se reprograman con backoff exponencial y full jitter. Otros 4xx y 3xx terminan como `dead`. El presupuesto es de diez intentos o 72 horas por ciclo. Un administrador puede reenviar una entrega `dead`, lo que abre un presupuesto nuevo sin borrar el historial. `outbox_events.status` pasa a `processed` solo cuando todas las entregas están en `success` o `dead`. `dead` es un resultado terminal visible, no un éxito de transporte.

La semántica es **at least once**: un receptor puede recibir un POST y el emisor perder su respuesta antes de confirmar el intento. El header `X-TMS-Event-Id` y el campo `id` del JSON mantienen el ID estable de evento para deduplicación. El cuerpo incluye `schemaVersion: 1`, `eventType`, `tenantId`, `payload`, `outboxEventId` y `sentAt`. El receptor debe aplicar idempotencia por ID de evento.

## Firma y secretos

Cada destino nuevo recibe un secreto independiente `whsec_` generado por el servidor. `POST /webhooks` y `POST /webhooks/:webhook_id/rotate-secret` lo revelan una sola vez en `signingSecret` con `Cache-Control: no-store`; los GET entregan solo `hasSignature`, gracia y avisos de compatibilidad. No se acepta un secreto aportado por el cliente. PostgreSQL guarda AES-256-GCM con versión de clave y AAD vinculado a tenant y destino. Las claves de cifrado se cargan desde el gestor de secretos, nunca desde la base.

El emisor envía `X-TMS-Event-Id`, `X-TMS-Schema-Version: 1` y `X-TMS-Signature: t=<segundos>,v1=<hex HMAC-SHA-256>`. La entrada del HMAC son los bytes UTF-8 exactos de `timestamp + "." + body`, sin parsear ni reserializar JSON. Durante las 24 horas posteriores a una rotación, el header incluye dos campos `v1` (secreto actual y anterior); el receptor acepta cualquiera. Una segunda rotación durante la gracia responde `409`. El receptor exige una distancia máxima de cinco minutos entre `t` y su reloj, compara el digest en tiempo constante y deduplica el ID antes de producir efectos. Ver ejemplo y procedimiento en [operación de firmas](../operations/13_webhook_signing_rollout.md).

Los destinos legados firmados conservan `X-Signature` (HMAC-SHA-256 del body con el secreto legado) durante 30 días desde `WEBHOOK_SIGNATURE_LEGACY_STARTED_AT`. Los destinos sin firma y los HTTP anteriores a esa fecha aparecen con avisos y plazo en GET; al vencer se suspenden. Los cuerpos y errores de respuesta se redactan y truncan a 2048 caracteres antes de guardarlos en intentos o entregas. El transporte no registra el secreto.

## Endpoints de administración

Todos exigen sesión autenticada, rol `admin` y tenant actual.

`POST /test` y `POST /replay` están decorados hoy con `@Idempotent()`, pero el interceptor vigente no reserva la clave en la transacción del outbox. Su [contrato transaccional propuesto](../technical/08_http_idempotency_contract.md) es distinto de la deduplicación por evento que deben hacer los **receptores** de webhooks salientes. Hasta la fase 3, el decorador no acredita una garantía frente a solicitudes concurrentes.

| Método | Ruta | Resultado |
| --- | --- | --- |
| `GET` | `/api/v1/webhooks` | Destinos del tenant |
| `POST` | `/api/v1/webhooks` | Crea un destino HTTPS |
| `POST` | `/api/v1/webhooks/:webhook_id/rotate-secret` | Revela un secreto nuevo una sola vez; gracia de 24 horas |
| `PATCH` | `/api/v1/webhooks/:webhook_id` | Modifica un destino |
| `DELETE` | `/api/v1/webhooks/:webhook_id` | Archiva el destino; permanece visible para consultar entregas e intentos |
| `GET` | `/api/v1/webhooks/:webhook_id/deliveries` | Estado e intentos recientes |
| `POST` | `/api/v1/webhooks/:webhook_id/test` | Encola una prueba solo para ese destino; responde `202` con ID de evento |
| `POST` | `/api/v1/webhooks/:webhook_id/deliveries/:delivery_id/replay` | Reabre una entrega `dead` del tenant; responde `202` |

## Datos y despliegue

La migración `20260930000000_webhook_delivery_expand` añade columnas y la tabla de intentos sin romper los escritores antiguos. El corte `20260930000001_webhook_delivery_cutover` deduplica filas históricas, crea la unicidad y reabre eventos que la versión anterior marcó `processed` aunque una entrega había fallado. Antes del **corte**, drenar todos los procesadores antiguos; sus escrituras duplicadas ya no son compatibles con el índice único. Después se activa la versión nueva. Las columnas legadas permanecen durante la ventana de rollback, pero un rollback del procesador exige el mismo corte coordinado y no debe iniciar workers antiguos con el índice único vigente. El backfill con datos sintéticos y la suite de concurrencia se prueban en PostgreSQL 18 descartable. No ejecutar `prisma migrate deploy` ni aplicar estas migraciones a una base persistente sin autorización separada.

La migración `20261002010000_webhook_secrets_expand` añade columnas de cifrado y conserva el lector del secreto legado durante la transición. El backfill se ejecuta después de drenar escritores viejos y solo con autorización separada para la base persistente. Los límites del cliente HTTP, la defensa SSRF y la ventana de HTTP legado están descritos en [la guía SSRF](../operations/08_webhook_ssrf_rollout.md). Métricas, alertas y retiro de columnas legadas pertenecen a la Fase 8.
