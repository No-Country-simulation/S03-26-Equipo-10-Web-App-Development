---
name: web-seo-accessibility-engineering
description: >-
  Diseño y revisión de HTML semántico, SEO técnico y accesibilidad WCAG 2.2 AA del Testimonial CMS (SKL-WEB-SEO-A11Y-001). Usar para rutas públicas, metadata, indexación, URLs, formularios y navegación en Next.js 15; distinguir estado vigente, opciones contextuales y migraciones futuras.
---

# SKL-WEB-SEO-A11Y-001 — SEO y accesibilidad web

## Propósito y fuentes

Guiar decisiones sobre semántica HTML, accesibilidad y descubrimiento de contenido. Leer AGENTS.md, llm.txt, el plan HITL activo y el código de la ruta afectada. Para renderizado y caché, consultar [Web Rendering](../web-rendering-performance-engineering/SKILL.md); para fronteras Next/NestJS, [Next.js Architecture](../nextjs-architecture-engineering/SKILL.md).

El código ejecutable y los contratos NestJS prevalecen sobre ejemplos históricos en docs/. Esta skill no certifica cumplimiento WCAG, indexación ni resultados de búsqueda.

| Estado | Uso |
| --- | --- |
| **Vigente** | Next.js 15.5, React 18.3, metadata global en app/layout.tsx y rutas públicas /, /t/[slug] y /p/[slug]. |
| **Vigente** | /t/[slug] es el muro; /p/[slug] es captura. Ambos consultan NestJS desde pantallas cliente. |
| **Vigente** | Tenant.publicSlug identifica un tenant para consulta pública; NestJS decide publicación y campos expuestos. |
| **Opción contextual** | Metadata por ruta, canonical, noindex, HTML con datos públicos desde servidor, JSON-LD, robots.ts y sitemap.ts. |
| **Migración futura** | Historial y redirección de slugs, rutas individuales indexables, i18n, Search Console, RUM y auditoría automatizada no implementados. |

## Mapa del producto actual

- apps/web/src/app/page.tsx compone la landing; comprobar HTML servido antes de afirmar cobertura SEO.
- apps/web/src/app/t/[slug]/page.tsx compone PublicTestimonialsScreen, cuya lista se obtiene en cliente.
- apps/web/src/app/p/[slug]/page.tsx compone CaptureScreen, que consulta información y envía el formulario.
- apps/web/src/app/admin/ contiene rutas de administración con sesión web y autorización API.
- apps/web/src/app/layout.tsx define título, descripción, Open Graph y Twitter globales.
- La URL en el layout no demuestra cuál será el dominio real de producción.
- apps/api/prisma/schema.prisma contiene Tenant.publicSlug único y opcional; no contiene Organization ni SlugHistory.
- No describir robots.ts, sitemap.ts, metadata por slug, JSON-LD, Search Console, RUM o axe/Playwright como operativos sin evidencia.

NestJS conserva autoridad de publicación, aislamiento por tenant, autenticación y persistencia. Un slug público no confiere acceso administrativo. No exponer drafts, pendientes, datos internos ni credenciales en HTML o metadata.

## Decisión por ruta

1. Identificar actor, contenido y objetivo: landing, muro, captura o administración.
2. Preguntar a producto si la ruta debe aparecer en buscadores; ser pública no basta para decidirlo.
3. Inspeccionar HTML inicial, contenido después de hidratar y status HTTP real.
4. Separar accesibilidad de indexabilidad: un formulario no indexado sigue necesitando teclado y etiquetas.
5. Si el contenido viene de NestJS, distinguir ausencia, denegación, límite y falla de servicio.
6. Elegir metadata, canonical, robots y sitemap solo con host y política definidos.
7. Registrar qué se comprobó y qué queda como hipótesis.

| Ruta | Comprobación inicial |
| --- | --- |
| / | Contenido, título, enlaces y respuesta inicial de la landing. |
| /t/[slug] | HTML inicial, lista cliente y visibilidad de testimonios publicados. |
| /p/[slug] | Formulario de captura y decisión de indexación pendiente de producto. |
| /admin/** | Sesión y autorización; robots y noindex no protegen datos. |
| Rutas preparatorias | Estado real antes de sumarlas a una política SEO. |

## Semántica HTML

- Elegir elementos por función: main para contenido principal, nav para navegación y button para acción.
- Usar article si un testimonio se entiende como unidad autónoma.
- Usar section cuando haya agrupación temática reconocible; div sirve para layout.
- Revisar el DOM final, porque layout y pantalla pueden duplicar landmarks.
- Mantener un contenido principal identificable por documento.
- Ofrecer enlace de salto si la navegación repetida retrasa el acceso por teclado.
- Comprobar que el destino del enlace de salto existe en las rutas donde se muestra.
- Usar headings para estructura lógica, no para obtener un tamaño de fuente.
- Un h1 principal claro es convención útil del proyecto, no una exigencia literal de WCAG.
- Mantener autor y contenido asociados en tarjetas de testimonios.
- Un header dentro de article no sustituye el header global.
- No poner texto esencial solo en atributos, iconos o color.

~~~tsx
// Ejemplo local: conservar enlace real y nombre de la región.
function PublicNavigation() {
  return (
    <nav aria-label="Navegación principal">
      <a href="/">Inicio</a>
      <a href="/docs">Documentación</a>
    </nav>
  );
}
~~~

El ejemplo no declara que /docs sea indexable. En rutas Next puede usarse Link si el resultado conserva un enlace con href.

## Navegación y URLs

- Enlace para navegar; botón para ejecutar acción.
- El texto de un enlace debe describir el destino existente.
- Un control con solo icono necesita nombre accesible.
- Evitar navegación importante mediante onClick en contenedor no interactivo.
- Codificar segmentos externos al formar URLs; NestJS valida el slug recibido.
- Tenant.publicSlug no es clave primaria ni prueba de permiso.
- Mantener URLs compartibles estables cuando se diseña una ruta nueva.
- No exigir historial de slugs que el esquema actual no contiene.
- Si cambia un slug, revisar enlaces y redirección en una tarea aparte.
- No prometer 301/308 sin un registro durable del slug previo.
- No insertar un host canónico literal en un ejemplo operativo antes de confirmar despliegue.
- Los filtros de query pueden representar estado útil; indexar sus variantes requiere decisión de producto.

## Rastreo, indexación y HTTP

robots.txt controla rastreo y no protege datos. noindex debe ser accesible al crawler para que pueda leerse; bloquear la misma URL en robots puede impedirlo. Las rutas privadas requieren autenticación y autorización aun con una política SEO. Consultar las [reglas noindex de Google](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

- noindex decide visibilidad en resultados; nofollow es una decisión distinta sobre enlaces.
- No añadir noindex y nofollow juntos por rutina.
- Un 200 con “no encontrado” tras fetch cliente puede ser soft 404 si la ruta debería indexarse.
- Verificar la respuesta real, no inferir el status de la UI renderizada.
- notFound() pertenece al render de servidor; no sustituye el error de una carga cliente.
- Una respuesta con streaming iniciada puede conservar status 200 aunque se invoque notFound().
- Timeout y 5xx no son ausencia real del recurso.
- Una redirección permanente necesita destino equivalente y estable.
- No redirigir todos los 404 a la landing.
- No imponer 410 Gone a toda baja; definir política de retiro con producto.
- Probar status y robots con y sin JavaScript cuando se afirma indexabilidad.

## Metadata

La metadata global es un valor inicial, no un título específico para cada tenant. Antes de agregar metadata dinámica se requieren host confirmado, endpoint público y política de ausencia.

- title describe la página sin llamar “verificadas” a reseñas que el producto no acredita.
- description resume contenido visible; el buscador puede reemplazar el snippet.
- Next 15 permite generateMetadata en Server Components.
- Para slug, resolver params, obtener datos públicos y manejar ausencia sin revelar datos privados.
- Revisar consultas duplicadas y caché entre Next y NestJS/Redis.
- El campo metadata.keywords existe hoy en layout.tsx; no prueba una estrategia SEO.
- Google no utiliza meta keywords para ranking; una tarea documental no modifica el layout.
- Open Graph y Twitter requieren verificar URL, títulos e imágenes reales.
- No presentar una imagen 1200 × 630 como requisito universal de toda ruta.

## Canonicalización

Una canonical comunica preferencia entre URLs equivalentes; Google puede elegir otra. No es requisito de accesibilidad ni condición obligatoria para que una página funcione. Consultar la [guía de Google](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

- Definir host y URL preferida antes de construir una canonical absoluta.
- Mantener coherencia con enlaces internos, redirects y sitemap si se introduce.
- No usar parámetros de tracking para crear una canonical distinta por visita.
- Revisar si un filtro muestra contenido distinto antes de apuntarlo a la URL base.
- Una canonical no corrige una página que filtra datos privados o responde con error.
- No afirmar que self-canonical está implementada en todas las rutas.
- Comprobar el HTML servido para confirmar que la etiqueta existe.
- Un host histórico de docs no sustituye configuración real de despliegue.

## Sitemap y descubrimiento

Un sitemap puede ayudar al descubrimiento si existe una lista confiable de URLs públicas canónicas. No hay sitemap.ts activo ni contrato web que enumere todas las URLs indexables.

- No incluir admin, borradores, testimonios pendientes o URLs excluidas.
- lastModified debe reflejar una fecha real, no la fecha arbitraria de generación.
- Revisar paginación y caché si crece el número de tenants.
- Un sitemap no reemplaza enlaces navegables hacia contenido que debe descubrirse.
- Si se crea robots.ts, usar rutas URL reales.
- Un route group como (dashboard) no forma parte de una URL pública.
- Probar el contenido servido y el status del archivo generado.
- No dar por conectado Search Console por existir un sitemap.

## Datos estructurados

JSON-LD puede describir contenido público si existe una entidad y datos visibles confiables. No es requisito de toda tarjeta ni garantía de rich results.

- Usar solo testimonios publicados por la API pública y del tenant consultado.
- Calificaciones, autoría, fechas y conteos deben corresponder al contenido visible.
- No inventar promedio, logo o reviewsCount si el contrato no los devuelve.
- No añadir Organization, Review o AggregateRating por analogía con un ejemplo genérico.
- Si el tenant controla su muro, revisar la [restricción de reseñas propias](https://developers.google.com/search/docs/appearance/structured-data/review-snippet) antes de sugerir estrellas para Organization.
- Schema.org válido no garantiza una apariencia enriquecida en Google.
- Un script con datos externos exige serialización segura.
- No usar JSON.stringify crudo dentro de dangerouslySetInnerHTML.
- Registrar procedencia de campos y mantener aislamiento entre tenants.

## Imágenes y medios

- Una imagen informativa necesita alt significativo; una decorativa usa alt vacío.
- Evitar repetir en alt texto idéntico que ya queda junto a la imagen.
- Un enlace de solo imagen requiere nombre accesible del destino.
- Reservar dimensiones o proporción para evitar saltos de layout.
- Identificar la imagen LCP de una ruta real antes de cambiar prioridad de carga.
- No cargar todos los medios con prioridad.
- Audio y video publicados requieren revisar subtítulos, transcripción o alternativa según el medio.
- URLs de medios y testimonios son datos externos; no insertar HTML sin sanitización deliberada.

## Interacción accesible

- Recorrer el flujo completo con teclado: abrir, editar, enviar, corregir y cerrar.
- Un role ARIA no añade foco ni comportamiento automáticamente.
- Mantener foco visible y no recortado por header, overlay o overflow.
- Usar Radix existente para diálogos y controles compuestos cuando corresponde.
- Comprobar foco inicial, navegación interna y retorno al cerrar.
- Conservar orden DOM comprensible al reordenar con grid o flex.
- Sincronizar aria-expanded, aria-selected y aria-pressed con estado real.
- Dar nombre accesible a controles de icono.
- No comunicar estado solo por color, icono o movimiento.
- Anunciar cambios asíncronos importantes sin duplicar regiones vivas.
- Respetar prefers-reduced-motion y mantener contenido esencial visible.
- Revisar zoom, reflow y contraste calculado en tema claro y oscuro.
- Evaluar objetivos de puntero según WCAG 2.2 AA, no por un tamaño universal.
- Tratar WCAG 2.2 AA como objetivo verificable por criterio, no como sello automático.

## Formularios y captura pública

- Cada campo requiere nombre accesible persistente: label nativo o equivalente adecuado.
- Asociar ayuda y error al control.
- Marcar aria-invalid de acuerdo con un error real y comprobar lectura del mensaje.
- Placeholder ilustra formato, pero no sustituye la etiqueta.
- Conservar entrada tras errores recuperables.
- Diferenciar validación, permiso, cuota y red caída.
- Impedir doble envío mientras se espera; no afirmar idempotencia durable no comprobada.
- En /p/[slug], comunicar recepción para revisión y no publicación inmediata.
- No anunciar entrega de webhooks tras enviar un testimonio.
- Slug ausente y formulario deshabilitado requieren mensajes diferentes cuando el contrato los distingue.
- No persistir testimonio, token o PII localmente por comodidad.
- En un diálogo, comprobar título, descripción, cierre y foco de la primitiva real.

## Comprobación de un cambio

1. Leer ruta, pantalla, adaptador HTTP y endpoint NestJS.
2. Inspeccionar HTML de respuesta, status y metadata.
3. Recorrer con teclado el estado inicial, una mutación y un error recuperable.
4. Revisar headings, landmarks y nombres accesibles en el DOM final.
5. Comprobar foco, contraste, zoom y objetivos de puntero por criterio WCAG aplicable.
6. Si cambia indexación, probar canonical, robots y sitemap con host efectivo.
7. Si se incorpora JSON-LD, revisar serialización, datos visibles y política del tipo.
8. Usar axe, lector de pantalla, Lighthouse o Search Console si están disponibles y registrar límites.

Una herramienta automática puede detectar problemas, pero no demuestra que la tarea se complete. No asignar porcentajes de cobertura sin fuente aplicable ni inferir ranking o cumplimiento legal de Lighthouse.

## Decisiones frecuentes

### Landing

- Verificar que el heading principal represente el producto sin promesas falsas.
- Inspeccionar los enlaces reales a rutas activas.
- Revisar alt de imágenes editoriales y decorativas según su función.
- Medir el recurso LCP antes de cambiar prioridad de imágenes.
- Mantener un main claro en el DOM final.

### Muro de testimonios

- Solo mostrar contenido que NestJS considera publicado.
- Distinguir contenido cargado en cliente del HTML inicial.
- No crear un schema de reseñas si el contenido no está visible.
- Comprobar aislamiento del slug público y estado de tenant.
- Tratar error de API distinto de lista vacía.
- Si se desea SEO del contenido, diseñar primero un cambio de renderizado separado.

### Captura pública

- Definir con producto si el formulario debe indexarse.
- Etiquetar campos y mantener errores asociados.
- Conservar contenido ingresado ante falla recuperable.
- Explicar revisión posterior sin prometer publicación.
- No convertir un error cliente en un 404 HTTP imaginario.
- Revisar teclado, foco y zoom con formulario extenso.

### Administración

- Auth y RBAC de NestJS son requisito para datos privados.
- noindex o robots no sustituyen controles de seguridad.
- No filtrar metadata por sesión de forma que exponga datos privados.
- Revisar diálogo, tabla y menús con teclado.
- Mantener feedback de 401, 403 y 409 claro.
- Evitar que un logout deje contenido privado visible en cliente.

## Opciones futuras con condición de entrada

| Opción | Condición antes de adoptarla |
| --- | --- |
| HTML público con datos NestJS | Endpoint seguro, contrato validado, frescura, caché y errores definidos. |
| Metadata por slug | Dato público en servidor, host confirmado y ausencia segura. |
| robots.ts o sitemap.ts | Política de indexación, URLs y origen público acordados. |
| Canonical y redirecciones | URL preferida, duplicados reales y destino estable. |
| Historial de slugs | Esquema, migración y reglas de negocio autorizadas aparte. |
| JSON-LD | Datos visibles, elegibilidad del tipo y serialización segura. |
| i18n/hreflang | Versiones reales por idioma y URLs estables. |
| Search Console, RUM o CI axe | Herramienta conectada, entorno definido y manejo de datos aprobado. |

Una propuesta futura no es requisito del cambio actual. Para schema.prisma, infraestructura o dependencias protegidas, aplicar el ACK de AGENTS.md en una tarea propia.

## Definition of Done

- La ruta usa semántica, nombres accesibles y teclado acordes a su interacción real.
- La documentación distingue HTML inicial, carga cliente y autoridad NestJS.
- Formularios, foco, error y feedback se comprenden sin depender solo de color o animación.
- Metadata e indexación, cuando cambian, tienen política, host y status verificados.
- Datos estructurados, si se añaden, reflejan datos públicos visibles y se serializan de forma segura.
- Las comprobaciones WCAG y SEO se registran con evidencia y límites, sin resultados garantizados.
