# Analítica administrativa

`/admin/analytics` consume `GET /api/v1/analytics/dashboard` mediante la sesión vigente. El controlador mantiene JWT y roles `admin`/`editor`; el tenant procede del contexto autenticado. Los parámetros técnicos de feature flags no controlan este acceso, según la decisión humana de fase 7.

## Contrato acumulado

El envelope conserva `success: true` y `data`. Los campos anteriores `totalViews`, `totalClicks`, `totalPlays` y `events[]` permanecen; se agregan:

| Campo                  | Semántica                                                                                                                                     |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `observedAt`           | Instante UTC del servidor que acota la observación.                                                                                           |
| `period.kind`          | `all_time`: actividad acumulada registrada, sin filtro de fechas solicitado.                                                                  |
| `period.from`          | Primer evento registrado para el tenant; `null` si todavía no existe actividad. No representa la fecha de alta del espacio.                   |
| `period.to`            | Igual a `observedAt`. Se excluyen eventos posteriores a ese instante.                                                                         |
| `recentEventsLimit`    | 50 eventos como máximo, ordenados por creación descendente e ID descendente en empates. No es el total acumulado.                             |
| `events[].testimonial` | `{ id, authorName, excerpt }` de la historia autorizada; extracto de hasta 160 puntos de código Unicode, sin medios ni información de sesión. |

Los conteos por tipo, el primer instante y los eventos recientes usan el mismo filtro de tenant, pertenencia del testimonio y límite temporal, dentro de una transacción de lectura `RepeatableRead`. Se seleccionan las referencias junto con los eventos, con un número fijo de operaciones Prisma; la pantalla no hace una consulta por fila. La configuración del aislamiento no sustituye la validación con PostgreSQL real. Los IDs numéricos de eventos conservan el contrato previo; el adaptador web rechaza valores fuera del entero seguro, en lugar de usar un enlace con un ID redondeado.

La ampliación es aditiva para clientes anteriores. El frontend nuevo requiere los metadatos completos y valida el envelope con Zod, incluidos límite de filas y correspondencia entre `testimonialId` e ID enlazado. Backend y frontend deben publicarse coordinadamente: una respuesta del backend anterior se muestra como error de contrato, sin inventar período ni totales cero.

## Lectura y recuperación

La pantalla muestra todos los eventos recibidos hasta el límite informado; se eliminó el recorte adicional a veinte. Traduce visualización/clic/reproducción y muestra autores, extractos y fechas UTC. Los enlaces usan la entrada contextual validada `/admin/testimonials?page=1&testimonial=<uuid>`; el detalle vuelve a comprobar permisos y tenant en la API, aunque el recurso no esté en la página inicial.

Las cifras son eventos, no visitantes únicos ni conversiones. Los navegadores pueden bloquear el tracking; los valores describen lo registrado. La ausencia de eventos ofrece revisar historias aprobadas y configurar el enlace público. Una lectura fallida ofrece reintento y no se convierte en un vacío exitoso. La tabla conserva todas sus columnas mediante scroll horizontal con región etiquetada y foco por teclado.

## Verificación de fase 10

Pruebas de repositorio con Prisma simulado verifican alcance, límite, compatibilidad de totales, contexto y vacío. Pruebas web verifican la fila 21, los enlaces, el período, los errores y respuestas inconsistentes. Se agregó un caso PostgreSQL con dos tenants y 51 eventos en `testimonial-persistence.integration.spec.ts`, y se amplió E2E-PUBLISH para leer actividad persistida y abrir su detalle. Estas dos verificaciones reales quedan pendientes cuando Docker no puede iniciar el harness; fixtures de navegador no acreditan persistencia, aislamiento ni sesión reales.
