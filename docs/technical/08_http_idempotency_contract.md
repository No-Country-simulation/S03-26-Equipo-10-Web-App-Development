# Contrato de idempotencia HTTP y captura pública

**Estado:** implementado en código en la fase 3 del [plan HITL de remediación](../plan/2026-10-05_fix-remediacion-codigo-web.md). La [migración preparada](../../apps/api/prisma/migrations/20261005020000_idempotency_scope/migration.sql) **no tiene aplicación verificada**. La garantía exige código y esquema compatibles; el [borrador anterior](../plan/2026-10-05_fix-remediacion-codigo-web_idempotencia-borrador.sql) queda como registro de diseño.

## Alcance por endpoint

| Endpoint | Contrato implementado en código | Límite |
| --- | --- | --- |
| `POST /api/v1/testimonials` | Reserva, testimonio, outbox y resultado en una transacción | 24 horas, tenant y usuario autenticados. |
| `POST /api/v1/testimonials/:testimonial_id/publish` | Reserva, transición, outbox y resultado en una transacción | Invalidación Redis posterior al commit; su fallo queda acotado por el TTL vigente. |
| `POST /api/v1/webhooks/:webhook_id/test` | Reserva, evento de prueba y resultado en una transacción | Repetir devuelve el ID original y `202`. |
| `POST /api/v1/webhooks/:webhook_id/deliveries/:delivery_id/replay` | Reserva, reapertura y resultado en una transacción | Repetir devuelve `202` sin reabrir dos veces. |
| `POST /api/v1/auth/register-admin` | Sin `@Idempotent()` | La unicidad de cuenta es una regla distinta; no se reproducen credenciales ni cookies. |
| `POST /api/v1/public/analytics/events` y `/tenants/:slug/events` | Sin `@Idempotent()` | La deduplicación pública requiere un contrato propio. |

`@Idempotent()` documenta el header en OpenAPI solo para los cuatro endpoints transaccionales; la ejecución pasa explícitamente por `IdempotencyService` y `IdempotencyRepository`. Una solicitud sin `Idempotency-Key` conserva el comportamiento actual de la operación, **sin garantía de deduplicación**. Un cliente que reintenta debe reutilizar la misma clave únicamente para la misma operación. No se añaden claves automáticamente a acciones que revelan secretos o rotan sesiones.

## Identidad, solicitud y respuesta

- Validar el header como 1–128 caracteres de `[A-Za-z0-9._~-]`; recomendar un UUID aleatorio. Un header presente que no cumpla recibe `400` Problem Details con `code: IDEMPOTENCY_KEY_INVALID`. Nunca aceptar una clave vacía como garantía.
- Resolver autorización antes de consultar la clave. El scope es `(tenantId verificado, principalKind, principalId, método, ruta concreta sin query, clave)`. `principalKind` es `user` o `api_key`; `principalId` es `userId` o `apiKeyId` verificado. Usar la ruta concreta, no la plantilla `:id`, para que IDs distintos no compartan un resultado.
- Calcular SHA-256 hexadecimal de JSON canónico con claves de objeto ordenadas a partir del DTO ya validado, parámetros de ruta y query que afecten la operación. Preservar el orden de arrays. No persistir el payload ni datos de credenciales en la tabla idempotente. Las cuatro rutas iniciales no dependen de query.
- Una fila nueva vence a las 24 horas según el reloj PostgreSQL. Dentro de esa ventana, el mismo scope y la misma huella devuelven el **status y el body crudo originales**; `ApiResponseInterceptor` aplica después el mismo envelope de éxito. Una huella distinta devuelve `409` Problem Details con `code: IDEMPOTENCY_KEY_REUSED`, sin mutación.
- Las respuestas de error no se guardan como éxito idempotente: la transacción se revierte y el cliente puede reintentar. Tras vencer la ventana, reutilizar la clave puede ejecutar de nuevo la operación; el cliente no debe hacerlo. Respuestas privadas llevan `Cache-Control: no-store` cuando corresponda y nunca se comparten entre actores.

## Protocolo transaccional

1. El controlador obtiene el tenant y actor de guards, valida clave, params y DTO, y llama a `IdempotencyService`. El interceptor global fue retirado; el repositorio coordina la transacción y entrega su cliente al caso de uso.
2. En **una** transacción PostgreSQL, borrar la fila vencida del mismo scope si existe e intentar insertar una fila `pending` con `ON CONFLICT DO NOTHING`. La unicidad nueva serializa solicitudes con el mismo scope incluso entre réplicas. No hacer un `get` libre seguido de `upsert` que reemplace un resultado ajeno.
3. Si la inserción pierde, leer la fila confirmada: comparar la huella y devolver su resultado `completed`; si sigue `pending`, fallar cerrado con `409 IDEMPOTENCY_IN_PROGRESS` y `Retry-After: 1`. Limitar la espera por lock a dos segundos; solo un timeout de contención conocido se traduce a ese conflicto. Una falla de PostgreSQL no se convierte en éxito.
4. Si la inserción gana, ejecutar la validación dependiente del estado y la mutación de dominio **dentro de la misma transacción**. Crear/reabrir el outbox y guardar `status_code` y `response_body` crudo antes del commit; cambiar la fila a `completed`. No hacer llamadas HTTP externas dentro de la transacción. Los repositorios que hoy abren transacciones propias deben aceptar el cliente transaccional del caso de uso, evitando transacciones anidadas independientes.
5. Responder solo después del commit. Si el proceso cae antes, PostgreSQL revierte reserva y mutación; si cae después, el reintento lee el resultado durable. Una fila `pending` confirmada por error de implementación nunca ejecuta otra mutación automáticamente: se investiga y repara. Para publicación, la invalidación de caché posterior al commit no altera el resultado ya confirmado; el TTL público actual limita una vista antigua si Redis falla.
6. Borrar filas vencidas en lotes de hasta 1000 desde un temporizador de la API, sin introducir un worker separado. Mantener las filas legadas bajo `principal_kind=legacy`, fuera de los nuevos scopes, hasta su expiración. Las métricas específicas de replay y conflicto aún no están implementadas.

**Verificación:** las pruebas unitarias cubren resultado escrito antes de responder, replay, conflicto y clave inválida. La suite de integración con dos clientes Prisma está preparada para concurrencia, rollback y efectos en PostgreSQL. Solo debe ejecutarse con `TEST_DATABASE_URL` apuntando a una base aislada y con la migración ya aplicada. En la revisión del 2026-10-07, esa variable no estaba configurada, PostgreSQL no respondió en `127.0.0.1:5432` y Docker no permitió consultar su daemon; **la garantía concurrente sigue sin verificación en PostgreSQL**. Una caída real de proceso también requiere un entorno de integración.

## Captura pública

La ruta activa es `POST /api/v1/public/testimonials/:slug/submit`. Una cookie `ts_submitted_<slug>` con valor `true` responde conflicto sin llamar al servicio de escritura. En una recepción nueva, el texto y el evento outbox se confirman juntos antes de intentar los medios opcionales por separado. La marca del navegador se establece tanto para recepción completa como parcial.

| Caso | Respuesta implementada | Comportamiento web actual |
| --- | --- | --- |
| Texto y medios confirmados | `201`, envelope `{ success: true, data: { id, status: 'success', failedMedia: [] } }` | Confirmar recepción. |
| Texto confirmado; imagen y/o video falló tras el commit | `201`, envelope `{ success: true, data: { id, status: 'partial', failedMedia: ['image', 'video'] } }` cuando fallan ambos; el array contiene solo los medios fallidos | Confirmar el texto, nombrar los medios sin adjuntar y evitar sugerir otro envío completo. |
| Marca reciente exacta de ese navegador y slug | `409`, Problem Details `code: PUBLIC_SUBMISSION_RECENT_BROWSER` | Informar que **este intento no se guardó**; no mostrar éxito. |
| Cuota por IP agotada antes de llegar al controlador | `429`, Problem Details y código de cuota existente | Informar el límite sin afirmar que se recibió el testimonio. |
| URL de video inválida u otra entrada inválida | `400`, Problem Details antes de persistir | Conservar datos del formulario y pedir corrección. |

El controlador comprueba la cookie por nombre y valor mediante el parser ya instalado, no por substring del header. Esa marca es una barrera de abuso por navegador, no prueba criptográfica de una sumisión anterior. `ApiExceptionFilter` devuelve el código estable y el adaptador web lo recibe como `ApiError`; el esquema web exige un `id` en ambos estados y `failedMedia` no vacío en el parcial. Las URL de video admitidas se normalizan a `https://www.youtube.com/watch?v=<id>` antes de guardarse.
