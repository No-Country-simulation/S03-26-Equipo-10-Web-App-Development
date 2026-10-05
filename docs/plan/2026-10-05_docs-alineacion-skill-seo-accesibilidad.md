# Plan HITL: alinear la skill de SEO y accesibilidad

**Fecha de inicio:** 2026-10-05

**Estado global:** Completado; tres fases revisadas con ACK humano

**Alcance:** `.agents/skills/web-seo-accessibility-engineering/SKILL.md`, este registro HITL y su entrada en `docs/plan/README.md`. Las otras nueve skills web se revisan como referencias, sin reescribirlas salvo que aparezca una contradicción documental concreta.

## Contexto y restricciones

- Las fuentes de verdad son `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, los manifiestos, el esquema Prisma y el código activo. La skill debe ajustarse a ellos, no sustituirlos.
- Baseline comprobado: Next.js 15.5, React 18.3, Tailwind 3.4, API NestJS 11 y npm workspaces. `/p/[slug]` compone la captura pública; `/t/[slug]` compone el muro público con carga cliente. `Tenant.publicSlug` existe; `SlugHistory` no. La metadata actual es global y los mecanismos propuestos de sitemap, robots, JSON-LD y medición SEO no están implementados en la web.
- La identidad del dominio de producción y la política de indexación requieren una decisión de producto y despliegue. La skill no debe fijarlas por un ejemplo. SSR público, redirects por historial de slugs, canonicalización, Search Console y RUM se describen como opciones condicionadas.
- El alcance es **solo documental**. No modificar aplicaciones, `schema.prisma`, dependencias, infraestructura, `AGENTS.md` ni `llm.txt`; no afirmar cumplimiento WCAG o indexabilidad de la aplicación sin pruebas. No persistir secretos ni PII en contexto.
- Conservar nombre y frontmatter de la skill; apuntar a unas 250–450 líneas, con propósito, reglas de decisión, ejemplos seguros y un único Definition of Done. Distinguir **vigente**, **opción contextual** y **migración futura**.
- Ejecutar solo la fase `[Actual]` por turno. Al finalizarla, registrar evidencia y commit sugerido, detenerse y esperar ACK humano antes de marcar la fase siguiente como `[Actual]`.

## Diagnóstico que guía la corrección

- La skill actual tiene 2.020 líneas y repite listas, protocolos, KPIs y DoD. Presenta como actuales rutas, modelos y herramientas que el repositorio no implementa, incluido `/p/[slug]` como muro, `SlugHistory`, `sitemap.ts`, `robots.ts` y medición en Search Console.
- El ejemplo JSON-LD usa `JSON.stringify` en `dangerouslySetInnerHTML` sin escapar `<`. Las firmas de `generateMetadata` usan `params` síncronos de compatibilidad, y el texto garantiza 404 HTTP para `notFound()` sin distinguir respuestas con streaming.
- La sección WCAG escribe `3.1:1` para texto grande, omite excepciones del objetivo de puntero y presenta métricas sin fuente. La canonical se trata como obligatoria y el ejemplo de `Organization`/`AggregateRating` no contempla la restricción de Google para reseñas propias.
- Fuentes primarias de contraste: [Next.js JSON-LD](https://nextjs.org/docs/app/guides/json-ld), [Next.js 15 metadata](https://nextjs.org/docs/15/app/api-reference/functions/generate-metadata), [Next.js 15 not-found](https://nextjs.org/docs/15/app/api-reference/file-conventions/not-found), [WCAG 2.2 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum), [Google canonical](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls) y [Google review snippets](https://developers.google.com/search/docs/appearance/structured-data/review-snippet).

## Fases

### `[Completada]` Fase 1: registrar el plan

- [x] Registrar baseline, hallazgos, alcance y fases con criterios de salida.
- [x] Incorporar el plan al índice de `docs/plan/`.
- [x] Confirmar que esta fase no modifica código ni la skill.

**Salida para revisión:** plan e índice creados; la skill permanece sin cambios.

**Review humano (ACK):** Recibido el 2026-10-05: «Continua».

**Commit sugerido:** `docs(plan): registrá la alineación HITL de SEO y accesibilidad`.

### `[Completada]` Fase 2: reescribir la guía para el proyecto vigente

- Reemplazar la estructura repetitiva por una guía de unas 250–450 líneas con frontmatter, propósito, mapa de estado vigente/opcional/futuro y un solo DoD.
- Describir rutas reales, `Tenant.publicSlug`, carga cliente de testimonios, metadata global y fronteras NestJS/Next. No presentar un objetivo SEO o una capacidad de despliegue como resultado logrado.
- Mantener reglas útiles de HTML semántico, navegación, formularios y accesibilidad. Presentar SSR público, historial de slugs, sitemap, robots, canonical, JSON-LD, Search Console y RUM solo bajo sus condiciones de adopción. Retirar por completo los ejemplos peligrosos o incompatibles durante esta fase.

**Salida para revisión:** skill reescrita de 2.020 a 283 líneas, con frontmatter, propósito, mapa vigente/opcional/futuro y un DoD. Usa rutas y modelo reales, conserva un ejemplo semántico sencillo y retira los ejemplos JSON-LD, Prisma y metadata incompatibles.

**Verificación:** `quick_validate.py` aprobó la skill; un único DoD y cercos balanceados; búsqueda dirigida de rutas, capacidades futuras, JSON-LD y `notFound()`; `git diff --check` sin errores. No se modificaron aplicaciones, esquema ni infraestructura.

**Criterio de salida:** skill coherente con el repositorio, sin ejemplos inseguros ni funcionalidades futuras afirmadas como actuales; no se modifican aplicaciones ni esquema.

**Review humano (ACK):** Recibido el 2026-10-05: «Falta algo? Continua».

**Commit sugerido:** `docs(skills): alineá SEO y accesibilidad con la web vigente`.

### `[Completada]` Fase 3: ejemplos seguros y revisión cruzada

- Incorporar ejemplos breves y seguros solo donde mejoren una decisión: firma `params: Promise` en Next 15, serialización JSON-LD que escape `<` si se muestra ese patrón, y tratamiento de ausencia/streaming sin prometer status 404 universal.
- Corregir ratios WCAG y excepciones del objetivo de puntero; distinguir consejo SEO de requisito y explicar la restricción de reseñas propias. Eliminar porcentajes sin fuente y requisitos de herramientas no instaladas.
- Revisar las diez skills en conjunto: referencias cruzadas, rutas, vocabulario, capacidades futuras y contradicciones. Ajustar únicamente las inconsistencias documentales demostradas.

**Salida para revisión:** la skill SEO quedó en 325 líneas. Incluye un ejemplo de `params: Promise` para Next.js 15, serialización JSON-LD que escapa `<`, una tabla que distingue ausencias antes y después del streaming, ratios y excepciones WCAG 2.2 AA precisos, y la restricción de Google para reseñas propias. Se añadió un enlace directo a esta skill desde la guía Next.js Frontend; la revisión cruzada de las otras nueve no encontró contradicciones que requieran reescritura.

**Verificación:** `quick_validate.py` aprobó las diez skills; las diez tienen frontmatter válido, un único DoD, cercos balanceados y enlaces locales existentes. Los tres ejemplos TS/TSX de la skill SEO se transpilaron sin errores sintácticos y se comprobó el escape de `<` con `</script>`. La búsqueda dirigida de rutas, modelos y capacidades futuras no reveló afirmaciones obsoletas como estado actual. Se contrastaron manualmente las afirmaciones sobre Next.js 15, WCAG 2.2 AA y Google con las fuentes primarias enlazadas en la skill. `git diff --check` terminó sin errores. No se ejecutaron tests de aplicaciones porque el cambio es solo documental.

**Criterio de salida:** validación de frontmatter, enlaces locales, cercos y ejemplos; búsqueda dirigida de afirmaciones obsoletas; contraste manual con fuentes primarias; `git diff --check` sin errores. No ejecutar tests de aplicaciones por tratarse solo de documentación.

**Review humano (ACK):** Recibido el 2026-10-05: «Falta algo, continua desde donde lo dejaste».

**Commit sugerido:** `docs(skills): asegurá los ejemplos SEO y revisá las diez guías`.

## Criterios de cierre

- La skill resulta ejecutable para el stack instalado y no confunde una propuesta de SEO con una función desplegada.
- Los ejemplos no introducen XSS, contratos inexistentes ni afirmaciones incorrectas sobre Next.js 15, Google o WCAG 2.2 AA.
- Las diez skills conservan referencias coherentes. Cada fase recibe ACK y commit sugerido antes de avanzar; solo entonces se marca el plan como `Completado`.
