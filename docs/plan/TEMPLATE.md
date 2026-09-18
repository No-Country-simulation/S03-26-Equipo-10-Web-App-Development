# Plan de Ejecución: <Nombre de la Tarea o Feature>
<!-- Instrucción: Reemplazar todos los valores entre < > y eliminar los comentarios HTML antes de usar -->

**Fecha de Inicio**: YYYY-MM-DD
**Estado Global**: `En Progreso` | `Completado` | `Bloqueado`
**Ticket / Issue Vinculado**: [#NÚMERO](https://github.com/repo/issues/NÚMERO)
**Rama Git**: `feat/<número>-<descripción-corta>`

---

## 1. Contexto y Restricciones (Lectura Obligatoria para IA)

Antes de ejecutar código, el agente DEBE interiorizar:

- **Arquitectura Base**: `docs/technical/01_architecture.md`
- **Reglas de Negocio**: `docs/domain/business_rules.md` — Secciones: <listar BR-ID relevantes>
- **Módulos Afectados**:
  - `apps/api/src/modules/<módulo>/` — ver `docs/modules/api-<módulo>.md`
  - `apps/web/src/features/<feature>/` — ver `docs/modules/web-<feature>.md`
- **Skills a aplicar**:
  - `.agents/skills/<skill-1>/SKILL.md`
  - `.agents/skills/<skill-2>/SKILL.md`

> [!CAUTION]
> **Directiva de Integridad HITL**: Ejecuta **UNA SOLA FASE** por iteración. No implementes lógica fuera del alcance de la fase activa. Al completar la fase, propone el commit y **DETENTE** esperando ACK humano.

---

## 2. Estándar de Versionado

Referencia: `docs/collaboration/02_git_workflow.md`

Formato de commit por fase:
```
<tipo>(<ámbito>): <descripción imperativa breve en inglés>

<descripción larga opcional>

Closes #<número-issue>
```

**Tipos**: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`

---

## 3. Fases de Ejecución (Flujo HITL)

> **Instrucción para IA**: Identifica la fase marcada como `[Actual]` y ejecútala únicamente.
> Al concluir, muestra el commit propuesto y espera ACK.

---

### `[Pendiente]` Fase 1: <Nombre de la Fase>

**Objetivo**: <Qué logra esta fase>

- [ ] <Subtarea 1 concreta>
- [ ] <Subtarea 2 concreta>
- [ ] <Subtarea 3 concreta>

**Criterio de completitud**: <¿Qué debe ser verdad para considerar esta fase terminada?>

**Review Humano (ACK)**: `Pendiente`

**Commit Propuesto**:
```bash
git commit -m "<tipo>(<ámbito>): <descripción>" \
  -m "<descripción larga si aplica>" \
  -m "Refs: #<número>"
```

---

### `[Pendiente]` Fase 2: <Nombre de la Fase>

**Objetivo**: <Qué logra esta fase>

- [ ] <Subtarea 1>
- [ ] <Subtarea 2>

**Review Humano (ACK)**: `Pendiente`

**Commit Propuesto**:
```bash
git commit -m "<tipo>(<ámbito>): <descripción>"
```

---

### `[Pendiente]` Fase 3: <Nombre de la Fase>

**Objetivo**: <Qué logra esta fase>

- [ ] <Subtarea 1>
- [ ] <Subtarea 2>

**Review Humano (ACK)**: `Pendiente`

**Commit Propuesto**:
```bash
git commit -m "<tipo>(<ámbito>): <descripción>"
```

---

## 4. Criterios de Aceptación (Definition of Done)

Marcar al finalizar TODAS las fases:

- [ ] Tests de cada fase pasan (coverage > 80%)
- [ ] Linter (`npm run lint`) sin advertencias
- [ ] Formatter (`npm run format`) sin cambios pendientes
- [ ] Cada commit sigue el estándar Conventional Commits
- [ ] `docs/modules/<módulo>.md` actualizado (si hay cambios en contratos)
- [ ] `llm.txt` actualizado (si hay cambios arquitectónicos)
- [ ] PR creado con descripción detallada del cambio

---

## 5. Post-Mortem y Ajuste Sistémico

> Completar SOLO si hubo desviaciones del agente. Sirve para mejorar el sistema.

| Error / Desviación del Agente | Ajuste en Sistema |
|-------------------------------|-------------------|
| *(Ej: La IA agrupó fases 1 y 2 sin pedir ACK)* | *(Ej: Reforzar regla en `.agents/rules/RULES.md`)* |
| *(Ej: La IA violó el aislamiento multi-tenant)* | *(Ej: Agregar regla explícita en RULES.md sección 2)* |

---

*Template versión: SKL-PRO-001 v1.1.0 — Generado: 2026-09-18*
