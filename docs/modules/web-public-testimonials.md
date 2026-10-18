# Captura y galería públicas

Las rutas `/p/[slug]` y `/t/[slug]` consumen exclusivamente los endpoints públicos existentes de NestJS. La fase 9 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md) mejora identidad, lectura, paginación y envío sin cambiar esquema, cuotas, cookies, CSRF, publicación ni servicios externos.

## Identidad y recepción

Ambas superficies obtienen nombre, logo nullable y recepción desde `GET /public/testimonials/:slug/form-info`. Esa información está disponible también con recepción cerrada. La galería consulta marca y testimonios por separado: una falla de marca no bloquea lectura ni paginación; una falla de lista tampoco oculta la identidad confirmada. Si falla la imagen de marca se muestran iniciales. Captura mantiene marca tanto en recepción cerrada como en confirmación.

Cerrar recepción impide nuevos envíos; no oculta testimonios ya publicados. Los flags técnicos de Analítica/Webhooks no se presentan como controles de acceso a estas páginas. No se necesita API key para las rutas por slug.

## Galería y alcance

`GET /public/testimonials/tenants/:slug?page=N&limit=20` conserva `data[]` más `meta {total,page,limit}`. El adaptador transforma el envelope en `{items,meta}` para la UI y valida forma, página solicitada, límite, cantidad máxima e IDs únicos dentro de la página. No trae todas las publicaciones en una consulta.

La galería mantiene el orden por relevancia vigente del backend y ofrece Cargar más. La primera página muestra alcance, las siguientes se agregan sin desmontar lo leído y se deduplican por ID. Una falla conserva las páginas anteriores y reintenta la misma página, sin avanzar el cursor antes de confirmar. Se bloquea el doble pedido; al cambiar de slug se aborta/descarta la respuesta anterior y se reinicia la colección.

El total corresponde a la última consulta y no constituye un snapshot de todas las páginas. Si varía durante la lectura, la UI diferencia cantidad cargada y total informado. La paginación por offset conserva el contrato actual: publicaciones/reordenamientos concurrentes pueden alterar la composición entre consultas. No se promete consistencia de snapshot ni un cursor que el backend no implementa. Se distingue carga, vacío, error recuperable, final y límite técnico de 10.000 páginas.

Tras cargar más, el foco pasa al primer autor nuevo; si no hay elementos nuevos se anuncia el alcance. Los testimonios tienen autor asociado, cita, rating textual y expansión con estado y relación semántica. Los nombres largos se contienen sin recortarlos con un overflow de página. Se retiran rótulos de telemetría de la lectura pública.

## Medios y tracking

Imágenes y miniaturas conservan `loading="lazy"` y `decoding="async"`. Una imagen fallida informa su indisponibilidad sin un área vacía con proporción de foto. YouTube carga la API/reproductor sólo tras la acción de reproducir; se anuncia la carga y se ofrece enlace externo ante falla. El contenedor de React permanece estable aunque YouTube reemplace su nodo interno. Enlaces externos heredados sólo admiten HTTP(S) sin credenciales; esquemas ejecutables no se renderizan.

Se conservan eventos view/click/play y deduplicación por sesión. El storage utiliza el fallback en memoria existente y sus fallas no impiden leer. El envío de eventos es independiente de las consultas; un error de tracking no borra ni bloquea contenido. Si no hay IntersectionObserver se conserva lectura sin fabricar vistas. Los controles no muestran eventos como si fueran métricas útiles para quien lee.

## Captura y confirmación

No se preselecciona rating. Se requiere elegir 1–5 estrellas, se informa la elección en texto y el grupo sigue usando radios nativos con etiquetas táctiles. Texto: 10–1000 caracteres conforme al DTO; nombre: 2–120. Ambos se conservan al fallar un envío, junto con la elección y los adjuntos en memoria.

Antes de seleccionar: PNG/JPEG/WebP hasta **10 MiB**, video opcional mediante URL HTTPS compatible de YouTube (`youtu.be/ID` o `youtube.com/watch?v=ID`). El cliente rechaza tipos/tamaños no admitidos y URLs incompatibles antes de enviar, mientras la API mantiene su autoridad. No se cambia la capacidad GIF del endpoint; la selección web conserva sus tres formatos originales y ahora los valida explícitamente. Se puede quitar una selección para enviar sin foto. La lectura de archivo se bloquea antes de enviar, se anuncia y descarta callbacks de otra ruta/selección.

Un candado síncrono impide dobles POST; durante envío no se edita el contenido ni se cambia rating/archivo. El formulario usa POST también como método nativo, aunque la operación funcional requiere el cliente JavaScript. Los errores distinguen validación, límites, supresión por marca reciente y resultados inciertos. No se asegura que una falla de red implique que no se guardó.

La respuesta `success` exige ID guardado y ningún medio fallido; `partial` exige ID y medios fallidos no vacíos. En ambos casos se enfoca la confirmación y se retira el formulario. Un parcial dice explícitamente que el texto ya se guardó y no debe reenviarse. No se promete revisión en un plazo no acreditado ni publicación automática. Se ofrece leer la galería desde captura, recepción cerrada y confirmación.

## Evidencia y límites

Tests UI/adaptadores cubren publicación 21, reintento sin pérdida de páginas, marca fallida independiente, cambio de slug, storage/tracking denegados, YouTube diferido/fallback, rating deliberado, bloqueos y resultados parciales. La prueba PostgreSQL añadida verifica 20+1, pendientes excluidos y otro tenant en una categoría homónima; su ejecución depende del entorno descartable y se declara por separado en el plan. No se omiten gates para convertir una ausencia de servicios en aceptación.

La inspección local usa respuestas y contenido sintéticos; no acredita Cloudinary, YouTube real, cookies/cuotas de producción ni disponibilidad del proxy remoto. Los seis E2E mantienen las garantías anteriores y amplían assertions pertinentes. Los overlays heredados y mediciones de producción conservan su fase 12.
