# Feature: Testimonios administrativos

**Última actualización:** 2026-10-15. Contrato vigente de `apps/web/src/features/testimonials/`.

## Responsabilidad y superficies

Admins y editores visualizan, crean y moderan testimonios de su espacio. La ruta activa `/admin/testimonials` compone `TestimonialsScreen`, una pantalla cliente con lista paginada y búsqueda/filtros locales sobre la página cargada. La búsqueda global, URL y detalle enlazable están pendientes de la fase 3 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md).

`CreateTestimonialModal` registra un borrador. `TestimonialModal` presenta detalle, edición, moderación y adjuntos, y también se usa desde Inicio (`features/overview`). Las rutas preparatorias de detalle y edición no son implementaciones alternativas activas. El widget embebible sigue pendiente y no pertenece a esta fase.

## Datos y transporte

- `api.ts` contiene los adaptadores validados con Zod; `useSession().fetchApi` conserva cookies, CSRF y recuperación de sesión.
- `GET /testimonials?page=&limit=` responde `data[]` con `meta: { total, page, limit }` en el envelope HTTP. `sessionPageRequest` lo adapta a `{ items, meta }` dentro de la web. La API pagina antes de enviar datos; la web no presenta filtros locales como búsqueda global.
- Cada registro incluye `createdById: string | null`, validado y tipado. `null` corresponde a recepción pública y no concede propiedad al editor. No inferir autoría a partir de `authorName`.
- Crear (`POST /testimonials`), editar (`PATCH /testimonials/:id`), moderar (`POST .../submit|approve|publish|reject`) y adjuntar (`POST .../image|video`) devuelven el registro confirmado. Rechazar acepta `{ reason?: string }` de hasta 500 caracteres.
- Catálogos usan endpoints paginados `/categories` y `/tags`. Las opciones seleccionadas se conservan al cambiar de página; no se pretende cargar catálogos ilimitados.
- NestJS decide autorización, tenant, validez de transiciones y persistencia. La UI adapta controles; no amplía permisos.

## Permisos de presentación

| Operación                      | Admin   | Editor                                                   | Restricciones de estado                 |
| ------------------------------ | ------- | -------------------------------------------------------- | --------------------------------------- |
| Crear y moderar                | Sí      | Sí, incluso contenido ajeno                              | Sólo transiciones permitidas por la API |
| Editar contenido/clasificación | Sí      | Sólo si `createdById` coincide con su ID                 | Nunca si está publicado                 |
| Adjuntar imagen/video          | Sí      | Sí, sin restricción de propiedad en este endpoint actual | Nunca si está publicado                 |
| Sin rol admin/editor           | Lectura | Lectura                                                  | No se muestran controles de mutación    |

La eliminación y su presentación diferenciada se incorporan en fase 3; esta fase no añade controles de borrado.

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

Se conserva la identidad crema/terracota, esquinas rectas y serif editorial para citas/títulos. Se reutilizan Dialog/AlertDialog de Radix, foco y teclado nativos. Contraste, cierres localizados y feedback transversal continúan en fase 2; no se acredita WCAG completa con esta corrección.

## Evidencia de fase 1

- `testimonial-interactions.test.tsx`: paginación sin POST con campos válidos, recuperación de metadatos, conservación ante error, cierre con decisión, bloqueo de submits/operaciones, roles/propiedad/publicados y respuestas de guardado/medios.
- `testimonials-screen.test.tsx`: detalle reconciliado sin reabrir aunque falle la recarga de lista, más recorridos existentes.
- `overview-screen.test.tsx`: editor modera desde Inicio y actualiza detalle/tarjeta sin consultar usuarios administrativos.
- `pagination.test.ts`: envelope realista y `createdById` nullable.

Son pruebas UI con transporte simulado. Los tests unitarios NestJS seleccionados verifican reglas existentes con repositorios simulados. La pasada de navegador usa respuestas sintéticas, sin aceptación de autenticación, PostgreSQL, Redis ni proveedores reales. Comandos/resultados y revisión visual se registran en el plan.
