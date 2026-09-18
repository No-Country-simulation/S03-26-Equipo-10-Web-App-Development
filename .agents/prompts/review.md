# Prompt Template: Code Review
# Código: SKL-PRO-001 — Nivel 2, Arsenal Táctico
# Uso: Copiar y completar los campos entre < > antes de enviar al agente

---

## Template

```
Contexto del Proyecto:
- Leer: AGENTS.md (fronteras operativas y reglas)
- Leer: llm.txt (stack y arquitectura)
- Leer: docs/technical/01_architecture.md (restricciones macro)
- Leer: docs/domain/business_rules.md (invariantes de negocio)
- Leer: docs/modules/<MÓDULO-AFECTADO>.md (contrato del módulo)
- Leer: .agents/rules/RULES.md (reglas operativas)

Código a Revisar:
<pegar código o indicar ruta: apps/api/src/modules/<módulo>/<archivo>.ts>

Criterios de Revisión (marcar los aplicables):
- [ ] Correctitud funcional (¿cumple la regla de negocio especificada?)
- [ ] Seguridad (¿viola OWASP? ¿expone secretos? ¿multi-tenant seguro?)
- [ ] Rendimiento (¿N+1 queries? ¿operaciones bloqueantes?)
- [ ] TypeScript (¿strict mode? ¿tipos correctos? ¿no any?)
- [ ] Tests (¿coverage > 80%? ¿casos edge cubiertos?)
- [ ] Arquitectura (¿respeta capas NestJS? ¿feature-oriented en frontend?)
- [ ] Convenciones (¿nombres en inglés? ¿Conventional Commits?)
- [ ] Documentación (¿docs/modules/ actualizado?)

Formato de Salida Requerido:
1. **BLOQUEANTES** (deben resolverse antes de merge)
   - [BLOQUANTE] <descripción del problema> → <solución propuesta>
2. **ADVERTENCIAS** (recomendado resolver)
   - [WARNING] <descripción> → <sugerencia>
3. **SUGERENCIAS** (mejoras opcionales)
   - [SUGGESTION] <descripción>
4. **APROBADO** / **RECHAZADO** con justificación
```

---

## Ejemplo de Uso

```
Contexto del Proyecto:
- Leer: AGENTS.md
- Leer: llm.txt
- Leer: docs/technical/01_architecture.md
- Leer: docs/domain/business_rules.md
- Leer: docs/modules/api-testimonials.md
- Leer: .agents/rules/RULES.md

Código a Revisar:
apps/api/src/modules/testimonials/services/testimonials.service.ts (método publishTestimonial)

Criterios de Revisión:
- [x] Correctitud funcional (¿cumple lifecycle draft→published?)
- [x] Seguridad (¿multi-tenant seguro? ¿filtro tenant_id?)
- [x] Rendimiento (¿N+1 queries en carga de tags?)
- [x] TypeScript strict mode
- [x] Tests (¿tiene unit test para el flujo happy path y casos de error?)
- [x] Arquitectura (¿emite evento al WebhookOutboxHandler correctamente?)

Formato de Salida:
1. BLOQUEANTES
2. ADVERTENCIAS
3. SUGERENCIAS
4. Veredicto final
```
