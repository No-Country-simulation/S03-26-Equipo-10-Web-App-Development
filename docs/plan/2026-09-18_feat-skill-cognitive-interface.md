# Plan de Ejecución: Incorporación de Skill SKL-UX-PSYCH-001 (Cognitive Interface Engineering)

**Fecha de Inicio**: 2026-09-18  
**Estado Global**: `Completado`  
**Ticket / Issue Vinculado**: [#SKL-UX-001](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/issues/SKL-UX-001)  
**Rama Git**: `feat/skill-cognitive-interface`  

---

## 1. Contexto y Restricciones (Lectura Obligatoria para IA)

Antes de ejecutar código, el agente DEBE interiorizar:

- **Arquitectura Base**: `docs/technical/01_architecture.md` (Next.js 15 App Router, React 19, Tailwind CSS v3, Radix UI).
- **Reglas de Negocio**: `docs/domain/business_rules.md` (Ciclo de vida de testimonios, moderación, aislamiento multi-tenant por `tenant_id`).
- **Módulos Afectados**:
  - `.agents/skills/cognitive-interface-engineering/SKILL.md`
  - `AGENTS.md`
  - `llm.txt`
  - `docs/plan/README.md`
- **Skills a aplicar**:
  - `.agents/skills/react-interface-engineering/SKILL.md`
  - `.agents/skills/nextjs-frontend-engineering/SKILL.md`
  - `.agents/skills/tailwind-architecture-engineering/SKILL.md`
  - `.agents/skills/web-seo-accessibility-engineering/SKILL.md`

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

**Objetivo**: Inicializar el plan de ejecución interactivo HITL y registrar la skill #22 en `AGENTS.md`, `llm.txt` y `docs/plan/README.md`.

- [x] Crear el plan HITL formal en `docs/plan/2026-09-18_feat-skill-cognitive-interface.md`.
- [x] Actualizar `AGENTS.md` reflejando 22 skills y agregando `cognitive-interface-engineering` en la Sección 10.
- [x] Actualizar `llm.txt` reflejando 22 skills.
- [x] Actualizar la tabla de planes en `docs/plan/README.md`.

**Criterio de completitud**: Todos los documentos de inducción y gobernanza registran la nueva habilidad y el plan HITL está publicado en el repositorio.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 2: Redacción Completa de la Especificación del Skill

**Objetivo**: Crear `.agents/skills/cognitive-interface-engineering/SKILL.md` con Frontmatter YAML, Ficha de Identificación, Filosofía de Diseño, Requisitos Funcionales/No Funcionales, Definition of Done, 26 leyes y modelos de UX aplicados a Testimonial CMS, 10 fases metodológicas, 30 antipatrones (UXLAW-01 a UXLAW-30), métricas y checklists.

- [x] Crear el directorio `.agents/skills/cognitive-interface-engineering/`.
- [x] Redactar Frontmatter YAML canónico (`name: cognitive-interface-engineering`).
- [x] Redactar Sección 1: Ficha de Identificación del Skill (SKL-UX-PSYCH-001).
- [x] Redactar Sección 2: Filosofía de Diseño, Regla Rectora y Ética Anti-Dark Patterns.
- [x] Redactar Sección 3: Requerimientos Funcionales ([RF-01] a [RF-08]) y No Funcionales ([RNF-01] a [RNF-05]).
- [x] Redactar Sección 4: Criterios de Aceptación — Definition of Done.
- [x] Redactar Sección 5: Ecosistema Conceptual — 26 Leyes de UX aplicadas a Next.js 15, Tailwind CSS y Radix UI en Testimonial CMS.
- [x] Redactar Sección 6: Metodología de Práctica en 10 Fases.
- [x] Redactar Sección 7: Catálogo exhaustivo de Antipatrones UXLAW-01 a UXLAW-30.
- [x] Redactar Sección 8: Evaluación y KPIs (Usabilidad, Eficiencia, Comprensión, Engagement, Accesibilidad).
- [x] Redactar Sección 9: Recursos Adicionales, Checklists (Pantalla, Flujo, Memorabilidad), Matriz de Aplicación, Regla Final de Flujo y Resultado Esperado.

**Criterio de completitud**: El archivo `SKILL.md` cuenta con las 9 secciones exhaustivamente desarrolladas sin omisiones ni resúmenes vacíos.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 3: Verificación Cruzada, Consistencia Global y Cierre

**Objetivo**: Validar integridad sintáctica, formato Markdown, enlaces cruzados y marcar el plan como completado.

- [x] Verificar sintaxis YAML y estructura Markdown.
- [x] Verificar sincronización con `AGENTS.md` y `llm.txt`.
- [x] Actualizar estado del plan en `docs/plan/README.md` a `Completado`.

**Criterio de completitud**: Todos los checks pasan sin advertencias y la documentación queda perfectamente alineada.

**Review Humano (ACK)**: `Aprobado`

**Commit Propuesto**:
```bash
git commit -m "feat(skills): agregá la skill SKL-UX-PSYCH-001 de diseño cognitivo y leyes de UX" \
  -m "Creá .agents/skills/cognitive-interface-engineering/SKILL.md con 26 leyes y principios de UX aplicados a Testimonial CMS." \
  -m "Refs: #SKL-UX-001"
```
