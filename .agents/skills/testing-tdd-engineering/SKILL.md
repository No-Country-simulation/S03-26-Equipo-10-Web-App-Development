---
name: testing-tdd-engineering
description: 'Diseñar, implementar, diagnosticar y revisar pruebas Unit, Integration y E2E del Testimonial CMS mediante TDD, selección por riesgo y controles de integridad (SKL-TDD-001). Usar para lógica nueva, regresiones, contratos, fixtures, assertions, mocks y evidencia de testing en Jest/Supertest y Vitest/Testing Library.'
---

# Testing y TDD para Testimonial CMS

**Código:** SKL-TDD-001 · **Versión:** 1.0.1

**Fuente:** especificación del usuario «Unit, Integration & E2E con TDD e Inteligencia Artificial», v1.0.0; adaptación del 2026-10-11. ISO/IEC/IEEE 29119, IEEE 29148, Agile Definition of Done y OWASP ASVS son referencias de diseño; su mención no acredita cumplimiento ni certificación.

Construir evidencia de que el software cumple sus contratos y de que las pruebas detectan los defectos relevantes. Elegir el conjunto mínimo suficiente según riesgo; el número de tests y el porcentaje de código ejecutado no sustituyen esa evidencia.

## Contexto y límites

- Leer [AGENTS.md](../../../AGENTS.md), [llm.txt](../../../llm.txt), el plan activo y los contratos del módulo afectado. Ejecutar sólo la fase HITL autorizada y detenerse con commit sugerido al finalizar. Discover/Red/Green/Refactor son etapas técnicas dentro de esa fase.
- API NestJS 11/Prisma 6.5: Jest y Supertest, suites principalmente en `apps/api/test/`. Web Next.js 15/React 18: Vitest, jsdom y Testing Library, tests junto a features y otras ubicaciones existentes. Consultar [guía operativa](../../../docs/technical/05_testing.md) para comandos y gates reales; usar las versiones de manifests y lockfile.
- Aislamiento por `tenant_id`, sin RLS implementada. Conservar JWT, refresh tokens, RBAC, cookies HttpOnly y CSRF propios. Outbox durable mediante polling PostgreSQL; Redis sirve cuotas/caché. BI usa warehouse PostgreSQL separado.
- Playwright 1.64.0 cubre seis recorridos Chromium escritorio/móvil con API/PG18/Redis7 propios descartables y Next standalone sobre HTTPS. Fase 3 lo incorpora a `verify` en PR/main; evidencia de cada SHA en plan/PR, no trasladar aprobación local a CI. El harness también prueba imágenes API finales sin navegador, con la misma propiedad y consentimiento de migración. Ver `docs/technical/e2e.md`. MSW, Testcontainers, fast-check y Stryker siguen siendo opciones según necesidad, no prerrequisitos. No instalar ni migrar herramientas por catálogo.
- Cambiar `schema.prisma`, ejecutar `prisma migrate deploy`/`db push`, alterar infraestructura, package.json raíz o hooks requiere el ACK específico de AGENTS.md. El CI descartable existente no autoriza esas operaciones desde una sesión del agente.
- Usar datos sintéticos y destinos de pruebas descartables verificados. No persistir secretos, tokens, contraseñas ni PII en contexto, ejemplos, reportes o logs. Declarar cuándo una dependencia se simula.

## Elegir la evidencia

| Nivel                         | Qué demuestra                                                  | Límite que debe quedar claro                                                                         |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Unit                          | Regla, cálculo, transformación o transición con lógica propia  | Un mock del repositorio no demuestra persistencia ni atomicidad.                                     |
| Integration                   | Colaboración real dentro del límite definido                   | Mantener reales Prisma/DB o Redis cuando su integración sea la propiedad evaluada.                   |
| UI con dependencias simuladas | Comportamiento observable del componente o pantalla            | No demuestra sesión persistente ni recorrido completo con API real.                                  |
| E2E                           | Recorrido crítico desde navegador hasta efectos finales reales | Requiere entorno completo, datos y sesiones aislados; no duplicar todas las combinaciones unitarias. |

Una regla puede aparecer en varias capas si cada prueba aporta evidencia diferente. P0 protege autorización, aislamiento e integridad de datos; P1 cubre operaciones principales y errores previsibles; P2 es selectivo; P3 evita suites dedicadas sin un riesgo concreto. No imponer proporciones universales ni pruebas para forwarding trivial.

## Procedimiento

1. **Discover:** inspeccionar requisito, contratos, código, suites, scripts y entorno. Identificar riesgos y distinguir especificación deseada, comportamiento actual y defectos conocidos. La implementación no es el único oráculo. Si falta una decisión de negocio que cambie el resultado, señalarla antes de fijar expectativas.
2. **Design:** describir precondiciones, entrada, resultado y efectos esperados; elegir capa y datos. Priorizar tenants, sesiones/permisos, API keys, validaciones/transiciones, outbox, cuotas/caché y BI según el cambio. Leer [estrategia y TDD](references/estrategia-y-tdd.md) para escenarios y trazabilidad RF/RNF.
3. **Red:** para lógica nueva o una regresión reproducible, escribir y ejecutar una prueba antes de corregir producción. Confirmar un fallo funcional relacionado con el defecto; sintaxis, imports rotos o servicios indisponibles no acreditan Red. Para legado, usar caracterización sin asumir que todo comportamiento actual es correcto.
4. **Green:** implementar el cambio mínimo y ejecutar la prueba y las relacionadas. No cambiar expectativas legítimas, eliminar assertions, reducir fixtures para esconder el caso ni introducir caminos artificiales para pasar el test.
5. **Refactor:** mejorar estructura preservando contratos; volver a ejecutar lo afectado. Exploración visual, documentación y cambios triviales pueden usar validación proporcional sin TDD estricto.
6. **Verify:** auditar oráculos, assertions, mocks, aislamiento y defectos que podrían escapar. Leer [integración y E2E](references/integracion-y-e2e.md) cuando se evalúen persistencia, HTTP, concurrencia o navegador; leer [integridad y evaluación](references/integridad-y-evaluacion.md) para controles AI y negativos, mutación selectiva, fallos o aceptación de suites críticas. Clasificar el fallo antes de tocar código o tests.
7. **Report:** enumerar comportamientos y pruebas añadidas/modificadas, comandos y entorno, resultados reales y omisiones, evidencia Red/Green disponible, simulaciones y riesgos pendientes. Diferenciar diseñado, implementado, ejecutado, validado y auditado. No trasladar aprobación de otro SHA, fixtures o smoke tests sintéticos a un entorno real.

## Criterio de entrega

Las pruebas seleccionadas verifican resultados y efectos del contrato, permanecen útiles frente a refactorizaciones válidas y no ocultan fallos mediante retries, skips o autocuración silenciosa. Reportar una ejecución parcial como parcial. Los controles nuevos de CI, E2E y mutación requieren implementación y evidencia propias; escribir esta metodología no los habilita ni los acredita.
