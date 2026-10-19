# Feature: Testimonios administrativos

**Última actualización:** 2026-10-15. Contrato vigente de `apps/web/src/features/testimonials/`.

## Responsabilidad y superficies

Admins y editores visualizan, crean y moderan testimonios de su espacio. La ruta activa `/admin/testimonials` compone `TestimonialsScreen`, una pantalla cliente con búsqueda y filtros globales en API, paginación y detalle enlazable. La fase 3 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md) incorpora URL compartible, catálogos independientes, resumen global y eliminación confirmada.

`CreateTestimonialModal` registra un borrador. `TestimonialModal` presenta detalle, edición, moderación y adjuntos, y también se usa desde Inicio (`features/overview`). Las rutas preparatorias de detalle y edición no son implementaciones alternativas activas. El widget embebible sigue pendiente y no pertenece a esta fase.

## Datos y transporte

- `api.ts` contiene los adaptadores validados con Zod; `useSession().fetchApi` conserva cookies, CSRF y recuperación de sesión.
- `GET /testimonials?page=&limit=` responde `data[]` con `meta: { total, page, limit }` en el envelope HTTP. `sessionPageRequest` lo adapta a `{ items, meta }` dentro de la web. La API pagina antes de enviar datos; la web no presenta filtros locales como búsqueda global.
- Cada registro incluye `createdById: string | null`, validado y tipado. `null` corresponde a recepción pública y no concede propiedad al editor. No inferir autoría a partir de `authorName`.
- Crear (`POST /testimonials`), editar (`PATCH /testimonials/:id`), moderar (`POST .../submit|approve|publish|reject`) y adjuntar (`POST .../image|video`) devuelven el registro confirmado. Rechazar acepta `{ reason?: string }` de hasta 500 caracteres.
- Catálogos usan endpoints paginados `/categories` y `/tags`. Las opciones seleccionadas se conservan al cambiar de página; no se pretende cargar catálogos ilimitados.
- NestJS decide autorización, tenant, validez de transiciones y persistencia. La UI adapta controles; no amplía permisos.

## Permisos de presentación

| Operación                      | Admin                 | Editor                                                   | Restricciones de estado                            |
| ------------------------------ | --------------------- | -------------------------------------------------------- | -------------------------------------------------- |
| Crear y moderar                | Sí                    | Sí, incluso contenido ajeno                              | Sólo transiciones permitidas por la API            |
| Editar contenido/clasificación | Sí                    | Sólo si `createdById` coincide con su ID                 | Nunca si está publicado                            |
| Adjuntar imagen/video          | Sí                    | Sí, sin restricción de propiedad en este endpoint actual | Nunca si está publicado                            |
| Sin rol admin/editor           | Sin acceso autorizado | Sin acceso autorizado                                    | La API rechaza con 403; la UI no ofrece mutaciones |

La fase 3 incorpora eliminación confirmada e identificada por autor: admin puede eliminar cualquiera; editor sólo propios, también publicados según el contrato vigente. Los envíos públicos (`createdById: null`) requieren admin para borrar. Se advierte sobre pérdida definitiva, asociaciones y retirada pública. Cancelar no invoca DELETE; mientras se procesa se bloquean operaciones/cierre. La respuesta debe confirmar el mismo ID y `deleted: true`. Por decisión humana del 2026-10-15 se conserva la actividad: un testimonio con eventos registrados no se borra; el conflicto explica que puede ocultarse si está publicado. No se borran eventos de analítica.

## Estados y consecuencias

| Estado API  | Etiqueta              | Siguiente acción presentada        |
| ----------- | --------------------- | ---------------------------------- |
| `draft`     | Borrador              | Enviar a revisión                  |
| `pending`   | Pendiente de revisión | Aprobar o rechazar                 |
| `approved`  | Aprobado              | Publicar o rechazar                |
| `published` | Publicado             | Ocultar, que lo cambia a Rechazado |
| `rejected`  | Rechazado             | Sin nueva transición               |

`presentation.ts` concentra etiquetas y explicaciones. Aprobar no publica. Ocultar quita visibilidad pública mediante el rechazo; no promete deshacer ni republicar desde un estado terminal.

## Borradores, concurrencia y recuperación

- Los botones de paginación y auxiliares declaran `type="button"`; sólo Registrar es submit.
- Reintentar categorías/etiquetas funciona dentro de creación y edición y conserva texto, rating y selección.
- Escape, cierre, click fuera y Cancelar pasan por la misma protección. Si hay cambios, un AlertDialog de Radix permite seguir editando o descartarlos explícitamente. Cancelar una edición o una nota de rechazo tampoco descarta cambios escritos silenciosamente.
- Mientras una mutación está pendiente, se bloquean nuevos envíos y el cierre. Un lock síncrono complementa los controles deshabilitados, incluso ante submits repetidos en el mismo ciclo.
- No se superponen edición, moderación y adjuntos: se pide guardar/cancelar la edición o resolver el enlace de video antes de moderar. Los campos quedan deshabilitados durante la operación para no perder cambios posteriores al envío.
- Tras moderar, guardar o adjuntar, `onUpdated(record)` entrega la respuesta validada al host. El host reconcilia el detalle abierto y recarga lista/Inicio. Un error al recargar no revierte el registro confirmado del detalle. Se eliminó la limpieza diferida que podía borrar una selección nueva.
- Los errores recuperables conservan la entrada. Un resultado incierto no se reintenta automáticamente; el mensaje pide actualizar antes de repetir. 403/404/409/429 mantienen la explicación del adaptador compartido.
- Los borradores viven en memoria del modal. Esta fase protege sus cierres; no añade persistencia local ni garantiza conservarlos al recargar o cambiar de ruta.

## Diseño y límites

Se conserva la identidad crema/terracota, esquinas rectas y serif editorial para citas/títulos. Se reutilizan Dialog/AlertDialog de Radix, foco y teclado nativos. La fase 2 añade valoración textual, cierre localizado, retorno de foco, sans para controles y colores semánticos compartidos; ver la [base compartida](../technical/2026-10-15_frontend_base_compartida.md). No se acredita WCAG completa con estas correcciones.

## Evidencia de fase 1

- `testimonial-interactions.test.tsx`: paginación sin POST con campos válidos, recuperación de metadatos, conservación ante error, cierre con decisión, bloqueo de submits/operaciones, roles/propiedad/publicados y respuestas de guardado/medios.
- `testimonials-screen.test.tsx`: detalle reconciliado sin reabrir aunque falle la recarga de lista, más recorridos existentes.
- `overview-screen.test.tsx`: editor modera desde Inicio y actualiza detalle/tarjeta sin consultar usuarios administrativos.
- `pagination.test.ts`: envelope realista y `createdById` nullable.

Son pruebas UI con transporte simulado. Los tests unitarios NestJS seleccionados verifican reglas existentes con repositorios simulados. La pasada de navegador usa respuestas sintéticas, sin aceptación de autenticación, PostgreSQL, Redis ni proveedores reales. Comandos/resultados y revisión visual se registran en el plan.

## Consulta global y revisión contextual — fase 3

La búsqueda se confirma con Buscar/Enter y consulta autor o contenido en **todo el espacio**. Estado, categoría, etiquetas AND, orden reciente/puntaje y página viajan en la URL. Cambiar filtros vuelve a página 1; Limpiar consulta quita todos los filtros. Los catálogos se consultan al desplegarlos, con búsqueda/páginas propias; sus conteos corresponden a asociaciones en todo el espacio. Cambiar de página del catálogo conserva las selecciones. La clasificación de un formulario sigue usando los endpoints globales paginados existentes.

`/admin/testimonials?page=1&status=pending&testimonial=<uuid>` abre el detalle mediante GET autorizado aunque el recurso no esté en la página. Se rechazan identificadores, filtros o páginas inválidos antes de pedir recursos; hay recuperación explícita para 403/404 y fallas de lectura. El adaptador comprueba el ID de detalle y que la página/límite de respuesta coincidan con la solicitud. El resumen comprueba cantidades enteras no negativas y suma consistente.

Anterior/siguiente recorren los resultados de la consulta, incluso sus páginas vecinas. Si el recurso quedó fuera de los filtros se indica y no se navega con una posición inventada. Durante cambios pendientes/operación se bloquea la navegación contextual. El detalle confirmado por una mutación prevalece aunque falle la recarga de la colección. Las respuestas de consultas obsoletas se descartan; no se cancela una escritura ya enviada. Tras borrar o filtrar el último resultado de una página se reemplaza la URL por una página válida conservando los filtros.

Inicio consume `/testimonials/summary` y consulta por separado hasta seis recientes y hasta seis pendientes. Presenta primero la revisión, diferencia borradores y muestra los totales de todos los estados; no presenta la muestra reciente como total global. Los enlaces de revisión incorporan el contexto de consulta. El onboarding pertenece a fase 7.

La protección de borradores cubre las acciones del modal y la navegación contextual; siguen siendo datos en memoria. No se garantiza persistencia ante recarga o navegación externa/browser back. La aceptación real con PostgreSQL/Redis y los seis E2E sigue pendiente: el harness autorizado el 2026-10-15 no pudo crear la red porque Docker no tenía daemon disponible. No se ejecutaron migraciones. Ver comandos/evidencia en el plan activo.

## Superficies públicas desde fase 9

Captura y galería tienen su [especificación pública](web-public-testimonials.md): marca aun con recepción cerrada, paginación de veinte sin descartar meta, lectura independiente de tracking, rating deliberado, validación de adjuntos y confirmación de texto guardado incluso en resultados parciales. No se modifican publicación, permisos ni aislamiento del backend.
