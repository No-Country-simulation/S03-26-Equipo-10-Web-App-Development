# Plan HITL: corrección de nueve skills de ingeniería web

**Fecha de inicio:** 2026-10-05  
**Estado global:** En progreso; Fase 1 lista para revisión  
**Alcance:** nueve archivos `SKILL.md` indicados abajo, este registro HITL y su entrada en `docs/plan/README.md`

## Contexto y restricciones

- El estado ejecutable del proyecto está en `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md`, `docs/domain/business_rules.md` y los manifiestos y archivos de configuración de ambas aplicaciones. Las skills no pueden sustituir esas fuentes de verdad.
- Baseline comprobado: Node.js 24.21.0, npm 11.19.0 con workspaces, Next.js 15.5, React 18.3, Tailwind CSS 3.4, NestJS 11 con Express y `nestjs-zod`. NestJS conserva la autoridad de negocio, autorización, persistencia y entrega durable de webhooks. La sesión de las rutas web activas usa `apps/web/src/hooks/use-session.ts`.
- Los tokens visuales actuales viven en `apps/web/src/app/globals.css`; `styles/tokens.css` y `styles/themes.css` son marcadores preparatorios. El outbox se procesa mediante polling PostgreSQL en la API; no hay BullMQ ni worker separado.
- Corregir **solo documentación de skills, este registro HITL y su índice**. No modificar `apps/web`, `apps/api`, dependencias, `AGENTS.md`, `llm.txt` ni infraestructura. No incorporar secretos ni PII a archivos de contexto.
- Conservar en cada skill el frontmatter YAML, propósito, reglas de decisión, ejemplos seguros y un único Definition of Done. Reducir repeticiones y apuntar a unas 250–450 líneas por archivo, sin recortar reglas necesarias para ejecutar tareas correctamente.
- Distinguir expresamente **vigente**, **opción contextual** y **migración futura**. Next.js 16, React 19, Tailwind 4, nuevos archivos de tokens, ISR por eventos, RUM y otras capacidades no implementadas no se presentarán como estado actual.
- Ejecutar **una sola fase `[Actual]` por turno**. Al terminar, mostrar evidencia y commit sugerido, detenerse y esperar ACK humano antes de marcar la fase siguiente como `[Actual]`.

## Skills comprendidas

1. `.agents/skills/nextjs-architecture-engineering/SKILL.md`
2. `.agents/skills/nextjs-frontend-engineering/SKILL.md`
3. `.agents/skills/web-rendering-performance-engineering/SKILL.md`
4. `.agents/skills/node-next-api-engineering/SKILL.md`
5. `.agents/skills/tailwind-architecture-engineering/SKILL.md`
6. `.agents/skills/css-architecture-engineering/SKILL.md`
7. `.agents/skills/cognitive-interface-engineering/SKILL.md`
8. `.agents/skills/react-interface-engineering/SKILL.md`
9. `.agents/skills/javascript-typescript-engineering/SKILL.md`

## Fases

### `[Actual]` Fase 1: registrar el plan HITL

- [x] Registrar baseline, fuentes de verdad, alcance y cuatro fases con sus criterios de salida.
- [x] Incorporar el plan al índice de `docs/plan/`.
- [x] Confirmar que el registro no modifica código ni archivos de infraestructura.

**Salida para revisión:** plan e índice creados; la fase permanece `[Actual]` hasta recibir ACK.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `docs(plan): registrá la corrección HITL de nueve skills web`.

### `[Pendiente]` Fase 2: fronteras de Next.js, renderizado y API

- Reescribir las skills de Next.js Architecture y Next.js Frontend para el modelo vigente: NestJS como backend independiente, adaptadores HTTP de web, sesión actual y Server Components solo donde los datos y la autenticación de la ruta lo permitan. Separar la DAL de API externa de ejemplos genéricos de Prisma en Next.
- Reescribir Web Rendering con estrategias actuales por ruta, sin presentar como implementados ISR por eventos, `/api/revalidate`, RUM, worker separado ni acceso Prisma desde Next. Aclarar caché privada y pública, frescura y fallas sin inventar contratos de despliegue.
- Reescribir Node/Next API según Express, `nestjs-zod`, `ApiExceptionFilter`, `IdempotencyInterceptor` y aislamiento por tenant existentes. Eliminar ejemplos de idempotencia con `tap(async ...)` y autorización que retorna `true` sin verificar propiedad; reemplazarlos por reglas y ejemplos que fallen cerrados.
- Usar firmas y configuración de Next.js 15.5 en todos los ejemplos vigentes. Etiquetar `cacheComponents`, APIs de Next 16 y arquitectura de workers externos como migraciones futuras.

**Salida:** cuatro skills breves y aplicables al repositorio, sin ejemplos que concedan permisos o aparenten durabilidad sin garantizarla.  
**Verificación:** búsqueda dirigida de versiones y APIs futuras; contraste de ejemplos con tipos instalados y código de API/web.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `docs(skills): alineá Next y API con las fronteras vigentes`.

### `[Pendiente]` Fase 3: sistema visual y experiencia cognitiva

- Reescribir Tailwind para v3.4 con `tailwind.config.ts`, `@tailwind` y clases detectables estáticamente; conservar v4 (`@theme`, `@source`, `@utility`) solo como apartado de migración explícita. Sustituir referencias a pnpm y `packages/ui` como estructura vigente.
- Reescribir CSS según los tokens HSL presentes en `globals.css`, geometría editorial de radio cero y componentes existentes. Evitar exigir `tokens.css`, `themes.css`, `@scope`, container queries, subgrid o capas adicionales en toda pantalla; indicar cuándo aplican.
- Reescribir Cognitive Interface como guía de heurísticas y comprobaciones observables. Retirar porcentajes y tiempos de impacto sin medición, defaults comerciales inventados y patrones visuales ajenos al producto. Describir el tamaño de objetivos WCAG 2.2 AA con sus excepciones y proteger flujos de moderación según las reglas reales.

**Salida:** tres skills coherentes entre sí y con el diseño implementado.  
**Verificación:** contraste con `globals.css`, `tailwind.config.ts`, componentes UI y criterios WCAG citados.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `docs(skills): ajustá Tailwind CSS y UX al diseño actual`.

### `[Pendiente]` Fase 4: React, TypeScript y coherencia final

- Reescribir React para React 18.3: render puro, Effects para sincronización externa, fetch de datos de Server Components de Next como caso distinto de efectos en render cliente, formularios proporcionales a su complejidad y React Compiler solo si se configura explícitamente.
- Reescribir JavaScript/TypeScript según `tsconfig.base.json` y el runtime actual. Conservar `strict: true`; presentar `noUncheckedIndexedAccess` y `exactOptionalPropertyTypes` como cambios de configuración opcionales que requieren evaluación separada. Evitar imponer paquetes, workers o abstracciones sin necesidad comprobada.
- Hacer una revisión cruzada de las nueve skills: frontmatter, enlaces, terminología, contradicciones, ejemplos de seguridad, requisitos duplicados y distinción vigente/opcional/futuro. Resolver en esta fase únicamente las inconsistencias documentales que se descubran.

**Salida:** nueve skills consistentes, operativas y sin afirmaciones de implementación inexistente.  
**Verificación:** frontmatter y enlaces válidos; búsquedas de Next 16, React 19, Tailwind 4, pnpm, Prisma en Next y worker separado; revisión manual de ejemplos de autorización, tenant, caché e idempotencia; `git diff --check`. No exigir typecheck o tests de aplicaciones por cambios exclusivamente documentales.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `docs(skills): depurá React TypeScript y coherencia transversal`.

## Criterios de cierre

- Las nueve skills conservan sus nombres y frontmatter válidos, y ofrecen decisiones ejecutables para el stack instalado.
- Ninguna presenta capacidades futuras como actuales ni contradice la autoridad de NestJS o el aislamiento multi-tenant.
- No quedan ejemplos de idempotencia o autorización inseguros ni métricas de UX afirmadas sin evidencia.
- Cada fase recibió ACK antes de avanzar y cerró con un commit sugerido. Solo entonces se marca el plan como `Completado`.
