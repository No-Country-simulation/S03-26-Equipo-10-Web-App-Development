# Módulo de webhooks

**Estado:** implementación local de la Fase 3 del [plan HITL](../plan/2026-09-30_chore-endurecimiento-seguridad.md). La migración y el despliegue persistente requieren revisión separada.

## Escritura y entrega

El productor escribe el cambio de dominio, un `outbox_events` y una entrega lógica por destino activo en la **misma transacción PostgreSQL**. La pareja `(outbox_event_id, webhook_id)` es única y cada entrega guarda la URL de destino vigente al crearse. Los cambios posteriores de URL solo afectan eventos nuevos. Los eventos anteriores a esta versión, sin entregas inicializadas, se recuperan mediante un inicializador transaccional que usa `FOR UPDATE SKIP LOCKED`.

El procesador consulta entregas `pending` cuyo `next_retry_at` haya vencido. Cada adquisición usa `FOR UPDATE SKIP LOCKED`, incrementa el contador e inserta un registro en `webhook_delivery_attempts` antes de hacer HTTP. Procesa como máximo cinco entregas a la vez por instancia. Un token de lease identifica al propietario del intento; un resultado tardío no puede sobrescribir el estado si el lease venció y otro worker lo adquirió. Los intentos interrumpidos quedan en el historial.

Cada intento hace **una sola llamada HTTP** con timeout de cinco segundos. 2xx confirma; 408, 429, 5xx y errores de red se reprograman con backoff exponencial y full jitter. Otros 4xx y 3xx terminan como `dead`. El presupuesto es de diez intentos o 72 horas por ciclo. Un administrador puede reenviar una entrega `dead`, lo que abre un presupuesto nuevo sin borrar el historial. `outbox_events.status` pasa a `processed` solo cuando todas las entregas están en `success` o `dead`. `dead` es un resultado terminal visible, no un éxito de transporte.

La semántica es **at least once**: un receptor puede recibir un POST y el emisor perder su respuesta antes de confirmar el intento. El header `X-TMS-Event-Id` mantiene el ID estable de evento para deduplicación. La firma versionada y la ventana anti-replay se completan en la Fase 7; durante la compatibilidad se conserva `X-Signature` cuando el destino tiene secreto.

## Endpoints de administración

Todos exigen sesión autenticada, rol `admin` y tenant actual.

| Método | Ruta | Resultado |
| --- | --- | --- |
| `GET` | `/api/v1/webhooks` | Destinos del tenant |
| `POST` | `/api/v1/webhooks` | Crea un destino HTTPS |
| `PATCH` | `/api/v1/webhooks/:webhook_id` | Modifica un destino |
| `DELETE` | `/api/v1/webhooks/:webhook_id` | Archiva el destino; permanece visible para consultar entregas e intentos |
| `GET` | `/api/v1/webhooks/:webhook_id/deliveries` | Estado e intentos recientes |
| `POST` | `/api/v1/webhooks/:webhook_id/test` | Encola una prueba solo para ese destino; responde `202` con ID de evento |
| `POST` | `/api/v1/webhooks/:webhook_id/deliveries/:delivery_id/replay` | Reabre una entrega `dead` del tenant; responde `202` |

## Datos y despliegue

La migración `20260930000000_webhook_delivery_expand` añade columnas y la tabla de intentos sin romper los escritores antiguos. El corte `20260930000001_webhook_delivery_cutover` deduplica filas históricas, crea la unicidad y reabre eventos que la versión anterior marcó `processed` aunque una entrega había fallado. Antes del **corte**, drenar todos los procesadores antiguos; sus escrituras duplicadas ya no son compatibles con el índice único. Después se activa la versión nueva. Las columnas legadas permanecen durante la ventana de rollback, pero un rollback del procesador exige el mismo corte coordinado y no debe iniciar workers antiguos con el índice único vigente. El backfill con datos sintéticos y la suite de concurrencia se prueban en PostgreSQL 18 descartable. No ejecutar `prisma migrate deploy` ni aplicar estas migraciones a una base persistente sin autorización separada.

Los límites del cliente HTTP, la defensa SSRF y la ventana de HTTP legado están descritos en [la guía SSRF](../operations/08_webhook_ssrf_rollout.md). Métricas, alertas y retiro de columnas legadas pertenecen a la Fase 8.
