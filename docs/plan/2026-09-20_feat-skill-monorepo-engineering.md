# Plan de Ejecución: Incorporación de Skill SKL-MONOREPO-ARCH-001 (Senior Monorepo Architecture & Engineering)

**Fecha de Inicio**: 2026-09-20  
**Estado Global**: `Completado`  
**Ticket / Issue Vinculado**: [#SKL-MONO-001](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/issues/SKL-MONO-001)  
**Rama Git**: `feat/skill-monorepo-engineering`  

---

## 1. Contexto y Restricciones (Lectura Obligatoria para IA)

Antes de ejecutar código o modificar documentación, el agente DEBE interiorizar:

- **Arquitectura Base**: `docs/technical/01_architecture.md` (Monolito modular, npm workspaces `apps/api` y `apps/web`).
- **Estructura del Repositorio**: Monorepo `@testimonial-cms`, `package.json` raíz (`workspaces: ["apps/*"]`), tooling y Docker configs.
- **Módulos y Archivos Afectados**:
  - `.agents/skills/monorepo-architecture-engineering/SKILL.md`
  - `AGENTS.md`
  - `llm.txt`
  - `docs/plan/README.md`
- **Skills vinculadas a respetar**:
  - `.agents/skills/layered-architecture-engineering/SKILL.md`
  - `.agents/skills/docker-container-engineering/SKILL.md`
  - `.agents/skills/secure-project-configuration-engineering/SKILL.md`
  - `.agents/skills/observability-reliability-engineering/SKILL.md`
  - `.agents/skills/git-engineering/SKILL.md`

---

## 2. Estándar de Versionado

Referencia: `docs/collaboration/02_git_workflow.md`

Formato de commit por fase:
```text
<type>(<scope>): <descripción en español rioplatense, voseo formal>

[cuerpo opcional en español rioplatense]

Refs: #<número-issue>
```

**Tipos**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## 3. Fases de Ejecución (Flujo HITL)

---

### `[Completada]` Fase 1: Plan HITL y Actualización de Registros Canónicos

**Objetivo**: Inicializar el plan de ejecución interactivo HITL y registrar formalmente la skill #24 en `AGENTS.md`, `llm.txt` y `docs/plan/README.md`.

- [x] Crear el plan HITL formal en `docs/plan/2026-09-20_feat-skill-monorepo-engineering.md`.
- [x] Actualizar `AGENTS.md` reflejando 24 skills y agregando `monorepo-architecture-engineering` en la Sección 10.
- [x] Actualizar `llm.txt` reflejando 24 skills.
- [x] Actualizar la tabla de planes activos en `docs/plan/README.md`.

**Criterio de completitud**: Todos los documentos de inducción y gobernanza registran la nueva habilidad y el plan HITL está publicado en el repositorio.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 2: Redacción Completa de la Especificación del Skill

**Objetivo**: Crear `.agents/skills/monorepo-architecture-engineering/SKILL.md` con Frontmatter YAML canónico, Ficha de Identificación, Filosofía de Diseño, Requerimientos Funcionales ([RF-01] a [RF-12]) y No Funcionales ([RNF-01] a [RNF-06]), Definition of Done, Ecosistema de Herramientas (pnpm, Yarn, npm workspaces, Turborepo, Nx, Changesets), las 68 Fases Metodológicas completas adaptadas al contexto de Testimonial CMS, los 30 Antipatrones MONO-01 a MONO-30 con detección y remediación, Evaluación/KPIs y Checklists Senior.

- [x] Crear el directorio `.agents/skills/monorepo-architecture-engineering/`.
- [x] Redactar Frontmatter YAML canónico (`name: monorepo-architecture-engineering`).
- [x] Redactar Sección 1: Ficha de Identificación del Skill (SKL-MONOREPO-ARCH-001).
- [x] Redactar Sección 2: Descripción y Filosofía de Diseño (Colocation, Boundary Enforcement, Determinismo, Caching y Resiliencia).
- [x] Redactar Sección 3: Requerimientos Funcionales ([RF-01] a [RF-12]) y No Funcionales ([RNF-01] a [RNF-06]).
- [x] Redactar Sección 4: Criterios de Aceptación — Definition of Done.
- [x] Redactar Sección 5: Ecosistema de Herramientas (pnpm, Yarn, npm, Turborepo vs Nx, Changesets).
- [x] Redactar Sección 6: Metodología de Práctica en 68 Fases detalladas y contextualizadas a `@testimonial-cms`.
- [x] Redactar Sección 7: Catálogo de 30 Antipatrones (MONO-01 a MONO-30) con impacto y mitigación.
- [x] Redactar Sección 8: Evaluación, KPIs de Calidad y Métricas en Monorepo.
- [x] Redactar Sección 9: Recursos Adicionales, Checklists Senior y Regla Rectora Final.

**Criterio de completitud**: El archivo `SKILL.md` cuenta con todas las secciones exhaustivamente desarrolladas sin placeholders ni resúmenes vacíos.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 3: Verificación Cruzada, Consistencia Global y Cierre

**Objetivo**: Validar integridad sintáctica, formato Markdown, enlaces cruzados y marcar el plan como completado.

- [x] Verificar sintaxis YAML y estructura Markdown.
- [x] Verificar sincronización con `AGENTS.md` y `llm.txt`.
- [x] Actualizar estado del plan en `docs/plan/README.md` a `Completado`.

**Criterio de completitud**: Todos los checks pasan sin advertencias y la documentación queda perfectamente alineada.

**Review Humano (ACK)**: `Aprobado`

**Commit Propuesto al finalizar Fase 3**:
```bash
git commit -m "feat(skills): agregá la skill SKL-MONOREPO-ARCH-001 de arquitectura de monorepos" \
  -m "Creá .agents/skills/monorepo-architecture-engineering/SKILL.md con especificación técnica exhaustiva y sincronizá registros de inducción." \
  -m "Refs: #SKL-MONO-001"
```
