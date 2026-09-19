# Plan de Ejecución: Incorporación de Skill SKL-DEVOPS-DKR-001 (Docker Container Engineering)

**Fecha de Inicio**: 2026-09-18  
**Estado Global**: `Completado`  
**Ticket / Issue Vinculado**: [#SKL-DKR-001](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/issues/SKL-DKR-001)  
**Rama Git**: `feat/skill-docker-engineering`  

---

## 1. Contexto y Restricciones (Lectura Obligatoria para IA)

Antes de ejecutar código, el agente DEBE interiorizar:

- **Arquitectura Base**: `docs/technical/01_architecture.md` (Monolito modular, Docker Compose, PostgreSQL 18, Redis 7, BullMQ, Nginx).
- **Docker y Pipelines**: `infra/docker/` (`api.Dockerfile`, `web.Dockerfile`), `infra/nginx/`, `docker-compose.yml`.
- **Módulos Afectados**:
  - `.agents/skills/docker-container-engineering/SKILL.md`
  - `AGENTS.md`
  - `llm.txt`
  - `docs/plan/README.md`
- **Skills a aplicar**:
  - `.agents/skills/node-backend-engineering/SKILL.md`
  - `.agents/skills/nextjs-architecture-engineering/SKILL.md`
  - `.agents/skills/secure-project-configuration-engineering/SKILL.md`
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

**Objetivo**: Inicializar el plan de ejecución interactivo HITL y registrar formalmente la skill #23 en `AGENTS.md`, `llm.txt` y `docs/plan/README.md`.

- [x] Crear el plan HITL formal en `docs/plan/2026-09-18_feat-skill-docker-engineering.md`.
- [x] Actualizar `AGENTS.md` reflejando 23 skills y agregando `docker-container-engineering` en la Sección 10.
- [x] Actualizar `llm.txt` reflejando 23 skills.
- [x] Actualizar la tabla de planes en `docs/plan/README.md`.

**Criterio de completitud**: Todos los documentos de inducción y gobernanza registran la nueva habilidad y el plan HITL está publicado en el repositorio.

**Review Humano (ACK)**: `Aprobado`

---

### `[Completada]` Fase 2: Redacción Completa de la Especificación del Skill

**Objetivo**: Crear `.agents/skills/docker-container-engineering/SKILL.md` con Frontmatter YAML, Ficha de Identificación, Filosofía de Diseño, Requisitos Funcionales/No Funcionales, Definition of Done, Stack OCI, 35 fases metodológicas adaptadas a Testimonial CMS, 20 antipatrones, baseline de seguridad, métricas y checklists.

- [x] Crear el directorio `.agents/skills/docker-container-engineering/`.
- [x] Redactar Frontmatter YAML canónico (`name: docker-container-engineering`).
- [x] Redactar Sección 1: Ficha de Identificación del Skill (SKL-DEVOPS-DKR-001).
- [x] Redactar Sección 2: Filosofía de Diseño e Inmutabilidad (*Build once, deploy many*, *defense-in-depth*, efimeridad).
- [x] Redactar Sección 3: Requerimientos Funcionales ([RF-01] a [RF-20]) y No Funcionales ([RNF-01] a [RNF-12]).
- [x] Redactar Sección 4: Criterios de Aceptación — Definition of Done.
- [x] Redactar Sección 5: Ecosistema de Herramientas (Stack OCI, BuildKit, Compose, registries, scanning).
- [x] Redactar Sección 6: Metodología de Práctica en 35 Fases adaptadas a NestJS 11 y Next.js 15 en Testimonial CMS.
- [x] Redactar Sección 7: Estructura recomendada del repositorio e infraestructura Docker.
- [x] Redactar Sección 8: Baseline de seguridad para producción (Compose endurecido).
- [x] Redactar Sección 9: Catálogo de 20 Antipatrones de Docker.
- [x] Redactar Sección 10: Evaluación y KPIs de Calidad en Contenedores.
- [x] Redactar Sección 11: Matriz de Competencia (Junior, Mid-Level, Senior).
- [x] Redactar Sección 12: Checklist Senior de Revisión (30 verificaciones críticas).
- [x] Redactar Sección 13: Resultado Esperado del Skill.
- [x] Redactar Sección 14: Recursos Adicionales y referencias OCI/Docker.
- [x] Redactar Sección 15: Regla Arquitectónica Final.

**Criterio de completitud**: El archivo `SKILL.md` cuenta con las 15 secciones exhaustivamente desarrolladas sin omisiones ni resúmenes vacíos.

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
git commit -m "feat(skills): agregá la skill SKL-DEVOPS-DKR-001 de containerización y Docker" \
  -m "Creá .agents/skills/docker-container-engineering/SKILL.md con 15 secciones y 35 fases metodológicas adaptadas a Testimonial CMS." \
  -m "Refs: #SKL-DKR-001"
```
