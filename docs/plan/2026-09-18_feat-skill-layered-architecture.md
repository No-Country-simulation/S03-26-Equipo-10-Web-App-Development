# Plan de Ejecución: Incorporación de Skill SKL-ARCH-LAYERED-001 (Senior Layered Architecture)

**Fecha de Inicio**: 2026-09-18  
**Estado Global**: `Completado`  
**Ticket / Issue Vinculado**: [#SKL-ARCH-001](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/issues/SKL-ARCH-001)  
**Rama Git**: `feat/skill-layered-architecture`  

---

## 1. Contexto y Restricciones (Lectura Obligatoria para IA)

Antes de ejecutar código, el agente DEBE interiorizar:

- **Arquitectura Base**: `docs/technical/01_architecture.md` (Monolito modular, N-Tier, NestJS 11 + Next.js 15 App Router).
- **Reglas de Negocio**: `docs/domain/business_rules.md` (Aislamiento multi-tenant por `tenant_id`, ciclo de vida de testimonios, webhooks firmados).
- **Módulos Afectados**:
  - `.agents/skills/layered-architecture-engineering/SKILL.md`
  - `AGENTS.md`
  - `llm.txt`
  - `docs/plan/README.md`
- **Skills a aplicar**:
  - `.agents/skills/node-backend-engineering/SKILL.md`
  - `.agents/skills/nextjs-architecture-engineering/SKILL.md`
  - `.agents/skills/prisma-persistence-engineering/SKILL.md`
  - `.agents/skills/observability-reliability-engineering/SKILL.md`

---

## 2. Estándar de Versionado

Referencia: `docs/collaboration/02_git_workflow.md`

Formato de commit por fase:
```
<type>(<scope>): <descripción en español rioplatense, voseo formal>

[cuerpo opcional en español rioplatense]

Refs: #<número-issue>
```

**Tipos**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## 3. Fases de Ejecución (Flujo HITL)

---

### `[Completada]` Fase 1: Plan HITL y Actualización de Registros Canónicos

**Objetivo**: Inicializar el plan de ejecución interactivo HITL y registrar formalmente la skill #21 en `AGENTS.md`, `llm.txt` y `docs/plan/README.md`.

- [x] Crear el plan HITL formal en `docs/plan/2026-09-18_feat-skill-layered-architecture.md`.
- [x] Actualizar `AGENTS.md` reflejando 21 skills y agregando `layered-architecture-engineering` en la Sección 10.
- [x] Actualizar `llm.txt` reflejando 21 skills.
- [x] Actualizar la tabla de planes activos en `docs/plan/README.md`.

**Criterio de completitud**: Todos los documentos de inducción y gobernanza registran la nueva habilidad y el plan HITL está publicado en el repositorio.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 2: Redacción de la Especificación del Skill — Ficha, Filosofía, Requisitos y Perfiles

**Objetivo**: Crear `.agents/skills/layered-architecture-engineering/SKILL.md` con Frontmatter YAML, Ficha de Identificación, Filosofía de Diseño, Requisitos Funcionales/No Funcionales, Definition of Done y los 3 Perfiles (Node.js Puro, NestJS 11 y Next.js 15 App Router adaptados a Testimonial CMS).

- [x] Crear el directorio `.agents/skills/layered-architecture-engineering/`.
- [x] Redactar Frontmatter YAML canónico (`name: layered-architecture-engineering`).
- [x] Redactar Sección 1: Ficha de Identificación del Skill (SKL-ARCH-LAYERED-001).
- [x] Redactar Sección 2: Filosofía de Diseño y Regla Rectora (Feature-First, Modelo Conceptual, Dominio opcional, Domain Model ≠ ORM Model, Contexto ALS, Manejo de errores).
- [x] Redactar Sección 3: Requerimientos Funcionales ([RF-01] a [RF-12]) y No Funcionales ([RNF-01] a [RNF-06]).
- [x] Redactar Sección 4: Criterios de Aceptación — Definition of Done.
- [x] Redactar Sección 5: Ecosistema de Herramientas y Perfiles:
  - 5.1 Perfil A: Node.js Puro / Express / Fastify (Functional Core / Imperative Shell, `app.ts` vs `server.ts`, composición manual).
  - 5.2 Perfil B: NestJS 11 adaptado a `apps/api/` (Modules como boundaries, DI con tokens `Symbol`, thin controllers, Pipes/Standard Schema, Guards vs use cases, Exception Filters RFC 9457).
  - 5.3 Perfil C: Next.js 15 App Router adaptado a `apps/web/` (RSC default, Client Islands `'use client'`, DAL `server-only`, Route Handlers/Server Actions, cliente API hacia NestJS).

**Criterio de completitud**: El archivo `SKILL.md` cuenta con las secciones de fundamentos y perfiles desarrolladas con alta rigurosidad técnica y ejemplos adaptados a `apps/api` y `apps/web`.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 3: Metodología de Práctica, Catálogo de 30 Antipatrones, KPIs y Checklists

**Objetivo**: Completar `SKILL.md` con la Metodología de 15 Fases, los 30 antipatrones (LAYER-01 a LAYER-30), métricas de evaluación, checklists operativos por capa/framework, árbol de decisión y Cheat Sheet de 30 reglas.

- [x] Redactar Sección 6: Metodología de Práctica en 15 Fases con flujo end-to-end y snippets TypeScript.
- [x] Redactar Sección 7: Catálogo exhaustivo de Antipatrones LAYER-01 a LAYER-30 con explicaciones de impacto, código erróneo y remediación.
- [x] Redactar Sección 8: Evaluación y KPIs (Integridad, Testeabilidad, Mantenibilidad, Observabilidad, Performance).
- [x] Redactar Sección 9: Recursos Adicionales, Checklists operativos (¿Necesito cuatro capas?, Controller, Use Case, Domain, Repository, NestJS, Next.js, Node.js puro), Árbol de decisión, Matriz por framework, Cheat Sheet de 30 reglas y Regla Rectora Final.

**Criterio de completitud**: Las secciones 6 a 9 están integradas de manera exhaustiva en `SKILL.md`, sin secciones incompletas ni placeholders.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 4: Verificación Cruzada, Consistencia Global y Cierre

**Objetivo**: Validar integridad sintáctica, enlaces cruzados, estándares de formato y sincronización de todo el monorepo.

- [x] Verificar formato Markdown, sintaxis YAML del frontmatter y renderizado de bloques de código y diagramas ASCII.
- [x] Verificar consistencia entre `SKILL.md`, `AGENTS.md`, `llm.txt` y los módulos en `apps/api` y `apps/web`.
- [x] Actualizar estado del plan en `docs/plan/README.md` a `Completado`.

**Criterio de completitud**: Todos los checks pasan sin advertencias y la documentación queda perfectamente alineada.

**Review Humano (ACK)**: `Aprobado`

**Commit Final**:
```bash
git commit -m "feat(skills): agregá la especificación técnica de la skill SKL-ARCH-LAYERED-001" \
  -m "Creá .agents/skills/layered-architecture-engineering/SKILL.md con 9 secciones completas y perfiles para Node.js, NestJS y Next.js." \
  -m "Refs: #SKL-ARCH-001"
```
