# Prompt Template: Nueva Feature (HITL)
# Código: SKL-PRO-001 — Nivel 2, Arsenal Táctico
# Uso: Copiar y completar los campos entre < > antes de enviar al agente

---

## Template

```
Contexto del Proyecto:
- Leer: AGENTS.md (fronteras operativas)
- Leer: llm.txt (stack y estructura completa)
- Leer: docs/technical/01_architecture.md (restricciones arquitectónicas)
- Leer: docs/domain/business_rules.md (invariantes de negocio aplicables)
- Leer: docs/plan/<FECHA>_<NOMBRE-FEATURE>.md (plan HITL activo)
- Leer: docs/modules/<MÓDULO-AFECTADO>.md (especificación del módulo)

Skill a aplicar:
- .agents/skills/<NOMBRE-SKILL>/SKILL.md

Tarea:
Ejecuta ÚNICAMENTE la Fase <N> del plan docs/plan/<FECHA>_<NOMBRE-FEATURE>.md.

Módulos afectados:
- apps/api/src/modules/<módulo>/
- apps/web/src/features/<feature>/

Restricciones críticas:
1. Mantener aislamiento multi-tenant (filtrar por tenant_id)
2. TypeScript strict mode obligatorio
3. Todo endpoint nuevo requiere DTO con validación Zod
4. Al finalizar: proponer commit en formato Conventional Commits y DETENERSE

Al completar la fase, mostrar:
1. Resumen de cambios realizados
2. Commit propuesto: `<tipo>(<ámbito>): <descripción>`
3. Esperar ACK humano
```

---

## Ejemplo de Uso

```
Contexto del Proyecto:
- Leer: AGENTS.md
- Leer: llm.txt
- Leer: docs/technical/01_architecture.md
- Leer: docs/domain/business_rules.md
- Leer: docs/plan/2026-09-20_moderacion-bulk.md
- Leer: docs/modules/api-testimonials.md

Skill a aplicar:
- .agents/skills/node-next-api-engineering/SKILL.md

Tarea:
Ejecuta ÚNICAMENTE la Fase 2 del plan docs/plan/2026-09-20_moderacion-bulk.md.

Módulos afectados:
- apps/api/src/modules/testimonials/
- apps/web/src/features/testimonials/

Restricciones críticas:
1. Mantener aislamiento multi-tenant (filtrar por tenant_id)
2. TypeScript strict mode obligatorio
3. Todo endpoint nuevo requiere DTO con validación Zod
4. Al finalizar: proponer commit en formato Conventional Commits y DETENERSE

Al completar la fase, mostrar:
1. Resumen de cambios realizados
2. Commit propuesto: `feat(api): add bulk moderation endpoint for testimonials`
3. Esperar ACK humano
```
