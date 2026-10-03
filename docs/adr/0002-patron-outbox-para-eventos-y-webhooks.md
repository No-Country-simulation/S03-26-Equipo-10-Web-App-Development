# ADR 0002: PostgreSQL como fuente de verdad para eventos y webhooks

**Fecha:** 2026-04-25
**Actualización:** 2026-10-02
**Estado:** Aceptado

## Contexto

Publicar o rechazar un testimonio puede generar notificaciones HTTP. Enviar dentro de la petición acoplaría la respuesta al destinatario y permitiría perder el evento si el proceso cae entre el commit de negocio y el POST.

El texto inicial de este ADR proponía BullMQ y un worker separado. La implementación y el plan HITL de seguridad eligieron PostgreSQL como único sistema de entrega durable. Redis 7 se usa para cuotas y caché pública compartida; una caída de Redis no debe alterar el ledger de entregas.

## Decisión implementada

1. La escritura de dominio, el evento de `outbox_events` y una entrega lógica por destino activo se confirman en la misma transacción PostgreSQL. La pareja `(evento, destino)` es única.
2. `OutboxProcessor` corre dentro de cada réplica de la API y consulta PostgreSQL cada tres segundos. Adquiere entregas con `FOR UPDATE SKIP LOCKED`, lease recuperable y concurrencia acotada.
3. Cada intento se registra por separado y hace una sola llamada HTTP con timeout. Los errores de red, 408, 429 y 5xx se reprograman con backoff exponencial y full jitter. Otros 4xx terminan; diez intentos o 72 horas llevan la entrega a `dead`.
4. Un evento queda `processed` cuando todas sus entregas tienen un resultado terminal (`success` o `dead`) registrado. `dead` representa un fallo visible y reenviable por administración, nunca un éxito de transporte.
5. Los destinatarios deduplican usando el ID estable del evento. La semántica es **at least once**: un POST puede haberse recibido aunque el emisor no haya llegado a confirmar la respuesta.

## Consecuencias

- PostgreSQL conserva la integridad del evento y del ledger sin coordinación adicional con Redis.
- El polling comparte el ciclo de vida y los recursos de la API; los leases permiten recuperar trabajo tras una caída y distribuirlo entre réplicas.
- Hay que monitorear la antigüedad del pendiente, intentos, fallos y entregas `dead`, y disponer de un procedimiento de reenvío. Ver `docs/modules/api-webhooks.md` y `docs/operations/14_phase8_observability_rollout.md`.
- BullMQ, una cola Redis y un worker separado no forman parte de esta decisión ni del despliegue actual.
