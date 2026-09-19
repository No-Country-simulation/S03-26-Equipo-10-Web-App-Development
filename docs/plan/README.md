# Planes de Orquestación HITL — @testimonial-cms

> Framework: SKL-PRO-001 v1.1.0

Este directorio contiene los **planes de ejecución interactivos (HITL)** que gobiernan el desarrollo feature-by-feature bajo supervisión humana.

---

## ¿Cómo crear un plan nuevo?

1. Copiar `TEMPLATE.md` con el nombre: `YYYY-MM-DD_<nombre-de-la-tarea>.md`
2. Reemplazar todos los `< >` con los valores reales
3. Eliminar los comentarios HTML del template
4. Hacer commit del plan **antes** de comenzar la implementación

```bash
# Ejemplo de nombre
cp docs/plan/TEMPLATE.md docs/plan/2026-09-20_moderacion-bulk-testimonios.md
git add docs/plan/2026-09-20_moderacion-bulk-testimonios.md
git commit -m "docs(plan): add HITL plan for bulk moderation feature"
```

---

## Convención de Nomenclatura

```
YYYY-MM-DD_<tipo>-<descripcion-corta>.md

Ejemplos:
  2026-09-20_feat-moderacion-bulk.md
  2026-09-25_fix-webhook-duplicados.md
  2026-10-01_refactor-scoring-service.md
```

---

## Ciclo de Vida de un Plan

```
Creado → [En Progreso] → [Completado]
                      ↘ [Bloqueado] → archivado en docs/plan/archive/
```

| Estado | Significado |
|--------|-------------|
| `En Progreso` | Al menos una fase está siendo ejecutada |
| `Completado` | Todas las fases tienen ACK y commits ejecutados |
| `Bloqueado` | El plan no puede avanzar; requiere análisis y ajuste sistémico |

---

## Flujo HITL Paso a Paso

```
1. Humano crea el plan y lo commitea
2. Humano indica al agente: "Lee docs/plan/YYYY-MM-DD_<task>.md y ejecuta Fase 1"
3. Agente lee el plan + contexto (AGENTS.md, llm.txt, docs relevantes)
4. Agente ejecuta SOLO la fase marcada [Actual]
5. Agente propone commit y se DETIENE
6. Humano revisa: código ✓ → ACK / código ✗ → NACK con feedback
7. Si ACK: Humano actualiza el plan [Pendiente] → [Completada] en la fase completada
           Humano marca [Actual] la siguiente fase
           Humano ejecuta el commit propuesto
8. Repetir desde paso 2 para la siguiente fase
```

---

## Archivo de Planes Fallidos

Si un plan falla sistemáticamente (> 3 ciclos sin avanzar):

1. Mover el archivo a `docs/plan/archive/<mismo-nombre>.md`
2. Agregar sección "Post-Mortem" al final del archivo
3. Analizar las desviaciones e incorporar reglas en `.agents/rules/RULES.md`
4. Crear un nuevo plan mejorado si la tarea sigue siendo válida

```bash
mkdir -p docs/plan/archive
mv docs/plan/2026-09-20_feat-fallida.md docs/plan/archive/
git commit -m "docs(plan): archive failed plan and add post-mortem"
```

---

## Planes Activos

<!-- Actualizar esta tabla manualmente al crear/completar planes -->

| Archivo | Estado | Descripción |
|---------|--------|-------------|
| [`2026-09-18_feat-skill-layered-architecture.md`](./2026-09-18_feat-skill-layered-architecture.md) | `Completado` | Incorporación de la skill SKL-ARCH-LAYERED-001 (Senior Layered Architecture) |
| [`2026-09-18_feat-skill-cognitive-interface.md`](./2026-09-18_feat-skill-cognitive-interface.md) | `Completado` | Incorporación de la skill SKL-UX-PSYCH-001 (Cognitive Interface Engineering) |

---

## Métricas de Salud del Sistema HITL

| Métrica | Meta | Cómo medir |
|---------|------|------------|
| First-Time Right Rate | > 80% | Fases aprobadas en primera revisión / total de fases |
| Tasa de alucinación | < 10% | Fases con violaciones de architecture.md o business_rules.md / total |
| Tiempo de onboarding | < 5 min | Tiempo de `AGENTS.md` + `llm.txt` → primer código correcto |
