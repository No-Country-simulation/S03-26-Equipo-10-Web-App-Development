# Contrato propuesto: idempotencia HTTP y captura pública

**Estado:** diseño de la fase 2 del [plan HITL de remediación](../plan/2026-10-05_fix-remediacion-codigo-web.md). **No está implementado.** El código vigente usa `IdempotencyInterceptor` con `tap(async ...)` y no garantiza persistencia previa a la respuesta ni exclusión de solicitudes concurrentes. El [SQL adjunto](../plan/2026-10-05_fix-remediacion-codigo-web_idempotencia-borrador.sql) es un borrador para revisión, no una migración activa.

## Alcance por endpoint

| Endpoint | Estado vigente | Decisión para fase 3 |
| --- | --- | --- |
| `POST /api/v1/testimonials` | `@Idempotent()`, tenant y usuario autenticados | Ofrecer garantía de 24 horas con la misma transacción que testimonio y outbox. |
| `POST /api/v1/testimonials/:testimonial_id/publish` | `@Idempotent()`, tenant y usuario autenticados | Ofrecer garantía de 24 horas con la misma transacción que transición y outbox. La invalidación Redis sigue después del commit y su fallo queda acotado por el TTL actual. |
| `POST /api/v1/webhooks/:webhook_id/test` | `@Idempotent()`, tenant y admin autenticados | Ofrecer garantía de 24 horas con la misma transacción que el evento de prueba y su ledger; repetir devuelve el ID original y `202`. |
| `POST /api/v1/webhooks/:webhook_id/deliveries/:delivery_id/replay` | `@Idempotent()`, tenant y admin autenticados | Ofrecer garantía de 24 horas con la misma transacción que la reapertura de la entrega y su evento; repetir devuelve `202` sin reabrir dos veces. |
| `POST /api/v1/auth/register-admin` | `@Idempotent()` pero todavía no existe tenant autenticado; el interceptor saltea la ruta | Retirar el decorador y la afirmación documental de idempotencia. La unicidad de cuenta sigue siendo una regla distinta; no almacenar ni reproducir credenciales/cookies de registro. |
| `POST /api/v1/public/analytics/events` y `/tenants/:slug/events` | `@Idempotent()`; la segunda ruta carece de tenant autenticado | Retirar ambos decoradores. Los eventos de analítica conservan su contrato actual; deduplicación pública necesitaría un diseño propio. |

`@Idempotent()` y OpenAPI solo anunciarán la garantía en los cuatro endpoints transaccionales. Una solicitud sin `Idempotency-Key` conserva el comportamiento actual de la operación, **sin garantía de deduplicación**. Un cliente que reintenta debe reutilizar la misma clave únicamente para la misma operación. No se añaden claves automáticamente a acciones que revelan secretos o rotan sesiones.

## Identidad, solicitud y respuesta

- Validar el header como 1–128 caracteres de `[A-Za-z0-9._~-]`; recomendar un UUID aleatorio. Un header presente que no cumpla recibe `400` Problem Details con `code: IDEMPOTENCY_KEY_INVALID`. Nunca aceptar una clave vacía como garantía.
- Resolver autorización antes de consultar la clave. El scope es `(tenantId verificado, principalKind, principalId, método, ruta concreta sin query, clave)`. `principalKind` es `user` o `api_key`; `principalId` es `userId` o `apiKeyId` verificado. Usar la ruta concreta, no la plantilla `:id`, para que IDs distintos no compartan un resultado.
- Calcular SHA-256 hexadecimal de JSON canónico con claves de objeto ordenadas a partir del DTO ya validado, parámetros de ruta y query que afecten la operación. Preservar el orden de arrays. No persistir el payload ni datos de credenciales en la tabla idempotente. Las cuatro rutas iniciales no dependen de query.
- Una fila nueva vence a las 24 horas según el reloj PostgreSQL. Dentro de esa ventana, el mismo scope y la misma huella devuelven el **status y el body crudo originales**; `ApiResponseInterceptor` aplica después el mismo envelope de éxito. Una huella distinta devuelve `409` Problem Details con `code: IDEMPOTENCY_KEY_REUSED`, sin mutación.
- Las respuestas de error no se guardan como éxito idempotente: la transacción se revierte y el cliente puede reintentar. Tras vencer la ventana, reutilizar la clave puede ejecutar de nuevo la operación; el cliente no debe hacerlo. Respuestas privadas llevan `Cache-Control: no-store` cuando corresponda y nunca se comparten entre actores.

## Protocolo transaccional

1. El controlador obtiene el tenant y actor de guards, valida clave, params y DTO, y llama a un caso de uso con `Prisma.TransactionClient`. El interceptor global deja de hacer `get`/`upsert` o `tap(async ...)`; puede limitarse a seleccionar rutas y establecer contexto, sin ejecutar negocio por su cuenta.
2. En **una** transacción PostgreSQL, borrar la fila vencida del mismo scope si existe e intentar insertar una fila `pending` con `ON CONFLICT DO NOTHING`. La unicidad nueva serializa solicitudes con el mismo scope incluso entre réplicas. No hacer un `get` libre seguido de `upsert` que reemplace un resultado ajeno.
3. Si la inserción pierde, leer la fila confirmada: comparar la huella y devolver su resultado `completed`; si sigue `pending`, fallar cerrado con `409 IDEMPOTENCY_IN_PROGRESS` y `Retry-After: 1`. Limitar la espera por lock a dos segundos; solo un timeout de contención conocido se traduce a ese conflicto. Una falla de PostgreSQL no se convierte en éxito.
4. Si la inserción gana, ejecutar la validación dependiente del estado y la mutación de dominio **dentro de la misma transacción**. Crear/reabrir el outbox y guardar `status_code` y `response_body` crudo antes del commit; cambiar la fila a `completed`. No hacer llamadas HTTP externas dentro de la transacción. Los repositorios que hoy abren transacciones propias deben aceptar el cliente transaccional del caso de uso, evitando transacciones anidadas independientes.
5. Responder solo después del commit. Si el proceso cae antes, PostgreSQL revierte reserva y mutación; si cae después, el reintento lee el resultado durable. Una fila `pending` confirmada por error de implementación nunca ejecuta otra mutación automáticamente: se investiga y repara. Para publicación, la invalidación de caché posterior al commit no altera el resultado ya confirmado; el TTL público actual limita una vista antigua si Redis falla.
6. Borrar filas vencidas en lotes acotados en la API existente, sin introducir un worker separado. Mantener las filas legadas bajo `principal_kind=legacy`, fuera de los nuevos scopes, hasta su expiración. Registrar métricas de replay, conflicto y fallo sin claves, payloads ni PII.

**Pruebas necesarias en fase 3:** misma clave en paralelo (incluidas dos instancias), actores/tenants/recursos distintos, body distinto, 201/202 originales, error antes de commit, proceso interrumpido antes/después de commit, vencimiento, un único test/replay de webhook y un único evento outbox. La prueba debe contar efectos en PostgreSQL; un mock del interceptor no demuestra la garantía.

## Captura pública: contrato propuesto para fase 3

La ruta activa es `POST /api/v1/public/testimonials/:slug/submit`. Hoy un cookie `ts_submitted_<slug>` puede hacer que responda `{ status: 'received' }` sin escribir, mientras la pantalla trata esa respuesta como éxito.

| Caso | Respuesta de fase 3 | Comportamiento web de fase 4 |
| --- | --- | --- |
| Testimonio persistido | `201`, envelope `{ success: true, data: { status: 'success', id } }` | Mostrar confirmación de recepción. |
| Marca reciente exacta de ese navegador y slug | `409`, Problem Details `code: PUBLIC_SUBMISSION_RECENT_BROWSER` | Informar que **este intento no se guardó** y que se puede volver a intentar más adelante; no mostrar éxito. |
| Cuota por IP agotada antes de llegar al controlador | `429`, Problem Details y código de cuota existente | Informar el límite sin afirmar que se recibió el testimonio. |
| Error de validación o dependencia | Status y Problem Details vigentes | Conservar datos del formulario y ofrecer corrección o reintento según el error. |

La fase 3 comprobará la cookie por nombre y valor mediante el parser ya instalado, no por substring del header. Esa marca es una barrera de abuso por navegador, no prueba criptográfica de una sumisión anterior. El texto público no dirá que se guardó una nueva opinión cuando no ocurrió. El código estable de error debe pasar por `ApiExceptionFilter` y el adaptador web debe reconocerlo como `ApiError`; en fase 4 el schema de éxito aceptará solo `status: 'success'` con `id` requerido.
