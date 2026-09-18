# Prompt Template: Refactorización
# Código: SKL-PRO-001 — Nivel 2, Arsenal Táctico
# Uso: Copiar y completar los campos entre < > antes de enviar al agente

---

## Template

```
Contexto del Proyecto:
- Leer: AGENTS.md (fronteras operativas)
- Leer: llm.txt (stack y estructura)
- Leer: docs/technical/01_architecture.md (restricciones arquitectónicas)
- Leer: docs/modules/<MÓDULO-AFECTADO>.md (contrato actual del módulo)

Skill a aplicar:
- .agents/skills/<NOMBRE-SKILL>/SKILL.md (ej: javascript-typescript-engineering)

Tarea de Refactorización:
Refactorizar <DESCRIPCIÓN DEL CÓDIGO A REFACTORIZAR> en <RUTA DEL ARCHIVO>.

Objetivo:
<Qué mejora se busca: legibilidad / rendimiento / separación de responsabilidades / etc.>

Restricciones:
1. NO cambiar el comportamiento observable (tests deben seguir pasando)
2. NO ampliar el alcance: solo refactorizar lo especificado
3. Mantener compatibilidad de interfaces y contratos existentes
4. TypeScript strict mode en todo momento

Criterios de aceptación:
- [ ] Tests unitarios existentes pasan sin modificación
- [ ] Linter sin advertencias
- [ ] Complejidad ciclomática reducida (si aplica)
- [ ] Código más legible / mantenible

Al finalizar, mostrar:
1. Resumen de cambios realizados
2. Commit propuesto: `refactor(<ámbito>): <descripción>`
3. Detenerse y esperar ACK
```

---

## Ejemplo de Uso

```
Contexto del Proyecto:
- Leer: AGENTS.md
- Leer: llm.txt
- Leer: docs/technical/01_architecture.md
- Leer: docs/modules/api-testimonials.md

Skill a aplicar:
- .agents/skills/javascript-typescript-engineering/SKILL.md

Tarea de Refactorización:
Refactorizar la lógica de scoring en apps/api/src/modules/testimonials/services/scoring.service.ts
para extraer la fórmula de recency decay a una función pura testeable.

Objetivo:
Separación de responsabilidades y mejora de testabilidad.

Restricciones:
1. NO cambiar el comportamiento observable (tests deben seguir pasando)
2. NO ampliar el alcance
3. Mantener el contrato public de ScoringService sin cambios
4. TypeScript strict mode

Criterios de aceptación:
- [ ] Tests existentes de ScoringService pasan
- [ ] Nueva función pura con tests unitarios propios
- [ ] Linter sin advertencias

Al finalizar:
1. Resumen de cambios
2. Commit: `refactor(testimonials): extract recency decay to pure function`
3. Detenerse
```
