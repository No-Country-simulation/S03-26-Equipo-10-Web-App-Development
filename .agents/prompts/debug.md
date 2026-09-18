# Prompt Template: Debugging
# Código: SKL-PRO-001 — Nivel 2, Arsenal Táctico
# Uso: Copiar y completar los campos entre < > antes de enviar al agente

---

## Template

```
Contexto del Proyecto:
- Leer: AGENTS.md (fronteras operativas)
- Leer: llm.txt (stack y estructura)
- Leer: docs/modules/<MÓDULO-AFECTADO>.md (especificación del módulo)
- Leer: docs/domain/business_rules.md (reglas de negocio relacionadas)

Problema Observado:
<Descripción del comportamiento incorrecto>

Comportamiento Esperado:
<Descripción del comportamiento correcto>

Información de Diagnóstico:
- Archivo/Módulo afectado: <ruta>
- Error o stack trace:
```
<pegar stack trace aquí>
```
- Pasos para reproducir:
  1. <paso 1>
  2. <paso 2>
- Entorno: local | staging | production

Restricciones:
1. NO alterar comportamiento de otros módulos
2. NO introducir workarounds que violen las reglas de negocio en docs/domain/business_rules.md
3. Proponer la causa raíz ANTES de escribir el fix
4. Si la causa requiere cambios en schema.prisma → solicitar ACK humano antes de proceder

Entregable esperado:
1. Análisis de causa raíz
2. Fix mínimo propuesto (diff o código)
3. Test de regresión que valide el fix
4. Commit propuesto: `fix(<ámbito>): <descripción>`
```

---

## Ejemplo de Uso

```
Contexto del Proyecto:
- Leer: AGENTS.md
- Leer: llm.txt
- Leer: docs/modules/api-webhooks.md
- Leer: docs/domain/business_rules.md

Problema Observado:
Los webhooks se envían duplicados cuando un testimonio es aprobado en ráfaga de múltiples requests.

Comportamiento Esperado:
Un solo evento webhook por aprobación de testimonio.

Información de Diagnóstico:
- Módulo afectado: apps/api/src/modules/webhooks/
- Error: No hay error explícito, pero los logs muestran 2-3 POST al endpoint externo por evento
- Pasos para reproducir:
  1. Crear 5 testimonios en paralelo
  2. Aprobar todos en rápida sucesión desde el panel
- Entorno: local

Restricciones:
1. No alterar el contrato del OutboxService
2. No violar la invariante de at-least-once delivery

Entregable:
1. Análisis de causa raíz (posible race condition en outbox)
2. Fix con idempotency key en outbox_events
3. Test de regresión
4. Commit: `fix(webhooks): prevent duplicate delivery via idempotency in outbox`
```
