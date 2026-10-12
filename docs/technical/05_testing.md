# Estrategia de testing del Testimonial CMS

La estrategia prioriza comportamientos y riesgos del cambio. Una prueba aporta confianza cuando comprueba un contrato con expectativas independientes y detecta los defectos que debe proteger. Cobertura de código y cantidad de tests complementan esa evidencia; no la sustituyen.

La metodología para agentes está en [testing-tdd-engineering, SKL-TDD-001](../../.agents/skills/testing-tdd-engineering/SKILL.md). Las reglas de negocio, contratos del módulo y decisiones aprobadas determinan el resultado esperado. La implementación existente por sí sola no demuestra que ese resultado sea correcto.

## 1. Herramientas y ubicaciones vigentes

| Área      | Herramientas y configuración                                                                                                            | Ubicación actual                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API       | Jest, SWC, Nest Testing y Supertest; [configuración](../../apps/api/jest.config.ts)                                                     | Principalmente `apps/api/test/*.spec.ts`, incluidas `*.integration.spec.ts`; fixtures en `apps/api/test/fixtures/`. Jest también descubre `*.spec.ts` bajo su root. |
| Web       | Vitest, jsdom, Testing Library y user-event; [configuración](../../apps/web/vitest.config.ts) y [setup](../../apps/web/vitest.setup.ts) | `*.test.ts`/`*.test.tsx` junto a features, componentes, librerías y middleware; también hay pruebas en `apps/web/src/tests/integration/`.                           |
| Scripts   | Runner nativo de Node y comprobaciones shell existentes                                                                                 | `scripts/demo/`, `scripts/release/`, smoke tests y compatibilidad del lint de Next.js, según el workflow.                                                           |
| Navegador | Recorridos locales documentados; sin runner E2E persistente configurado                                                                 | [Recorridos y límites](../../apps/web/src/tests/e2e/README.md). No hay script `test:e2e` instalado.                                                                 |

Conservar Jest en API y Vitest en web; usar versiones de manifests y lockfile. Playwright, MSW, Testcontainers, fast-check y Stryker son opciones futuras según necesidad, no herramientas que haya que instalar para cada cambio. Los tests de UI con HTTP simulado no demuestran autenticación persistente ni un recorrido E2E completo.

## 2. Elegir nivel y alcance

| Riesgo                        | Ejemplos que evaluar según el cambio                        | Evidencia suficiente                                                                                                                       |
| ----------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| P0: autorización e integridad | Tenants, sesión/RBAC/CSRF, API keys, outbox, publicación BI | Casos exitosos, fallos significativos, fronteras y ausencia de efectos indebidos; todos los escenarios críticos identificados y aprobados. |
| P1: operación principal       | Captura, moderación, CRUD, multimedia                       | Comportamiento y errores previsibles en el nivel adecuado.                                                                                 |
| P2: secundario                | Filtros, formato o interacción acotada                      | Pruebas selectivas según complejidad e historial.                                                                                          |
| P3: trivial                   | Decoración, forwarding, texto/documentación                 | Revisión o comprobación ligera salvo riesgo concreto.                                                                                      |

Unit prueba lógica propia aislada; Integration prueba colaboración real dentro de un límite declarado; E2E confirma un recorrido crítico desde navegador hasta efectos finales con backend y almacenamiento reales. La misma regla puede aparecer en varias capas si cada una detecta defectos diferentes. No imponer proporciones de pruebas ni duplicar todas las combinaciones unitarias en navegador.

Priorizar assertions sobre resultados y efectos del contrato, nombres por comportamiento y Arrange/Act/Assert o Given/When/Then. Restaurar mocks, spies, timers y estado global. Detalle y trazabilidad RF/RNF: [estrategia y TDD](../../.agents/skills/testing-tdd-engineering/references/estrategia-y-tdd.md).

## 3. TDD y ejemplos del dominio

Para lógica nueva y regresiones reproducibles, definir precondiciones, entrada, resultado y efectos esperados antes de cambiar producción:

1. **Red:** escribir y ejecutar la prueba; confirmar que falla por el comportamiento ausente/incorrecto. Sintaxis rota, imports erróneos o DB indisponible no acreditan Red.
2. **Green:** implementar el mínimo y ejecutar pruebas nuevas y relacionadas. No cambiar expectativas legítimas ni eliminar assertions o el escenario que expone el defecto.
3. **Refactor:** mejorar estructura conservando contratos y volver a ejecutar lo pertinente.

Para legado, usar caracterización distinguiendo comportamiento actual, contrato deseado y defectos conocidos. Exploración visual, documentación y configuración trivial pueden validarse sin TDD estricto. En planes HITL, estas etapas técnicas ocurren dentro de la fase autorizada; no modifican las fronteras ni los ACK de [AGENTS.md](../../AGENTS.md).

Ejemplos de escenarios, no resultados de una ejecución actual:

| Contrato y fuente local                                                                                                                                                | Escenario                                                                                                                      | Assertion o efecto que lo distingue                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Contenido mínimo/rating; [DTO](../../apps/api/src/modules/testimonials/dto/testimonial.dto.ts) y [Unicode](../../apps/api/test/testimonial-content-validation.spec.ts) | Nueve caracteres se rechazan, diez se aceptan; cinco emoji se rechazan y diez se aceptan. Rating 1/5 válido; 0/6/1.5 inválido. | Comparar aceptación/rechazo con valores independientes, usando puntos de código para el mínimo como `char_length` de PostgreSQL.      |
| Atomicidad; [persistencia de testimonios](../../apps/api/test/testimonial-persistence.integration.spec.ts)                                                             | Falla la inserción outbox al crear o publicar.                                                                                 | No queda el testimonio nuevo; una publicación fallida conserva el estado anterior y no deja el evento, verificado en PostgreSQL real. |
| Aislamiento; [integridad entre tenants](../../apps/api/test/tenant-integrity.integration.spec.ts)                                                                      | Un recurso o relación pertenece a otro tenant.                                                                                 | Denegación/restricción y ausencia de cambios ajenos; un mock del repositorio no demuestra integridad de DB.                           |

Un resultado 200, `toBeDefined()` o una llamada aislada pueden ser insuficientes: comprobar aquello que afirma el nombre de la prueba. Para casos críticos, revisar qué implementación deliberadamente defectuosa podría seguir pasando y aplicar controles negativos proporcionados. Mutation testing selectivo es una opción futura; no es requisito universal.

## 4. Ejecución local

Los siguientes comandos se ejecutan desde la raíz con las dependencias ya instaladas. En ejemplos selectivos, los paths pasados al runner son relativos al workspace.

```bash
# Caso API sin dependencias de integración externas
npm test --workspace @testimonial-cms/api -- --runTestsByPath test/testimonial-content-validation.spec.ts

# Caso UI: comportamiento del formulario, sin acreditar backend real
npm test --workspace @testimonial-cms/web -- src/features/auth/components/login-form.test.tsx

# Suites API/web: revisar requisitos y posibles omisiones antes de interpretar el resultado
npm test --workspace @testimonial-cms/api
npm test --workspace @testimonial-cms/web

# Cobertura API disponible; no aplica un umbral porcentual global configurado
npm run test:cov --workspace @testimonial-cms/api

# Checks de código cuando el cambio los requiera
npm run typecheck
npm run lint
```

Los [manifests API](../../apps/api/package.json) y [web](../../apps/web/package.json) no definen `test:unit`, `test:integration`, `test:e2e` ni `test:coverage`. El script existente de cobertura API se llama `test:cov`. Web no tiene configurado un proveedor de cobertura; no dar por disponible `--coverage` sin comprobar dependencias. Los argumentos de selección se pasan al runner mediante `--`, según la [CLI de Jest](https://jestjs.io/docs/cli).

Las integraciones requieren destinos descartables explícitos y fixtures/migraciones compatibles. Verificar el destino antes de correr tests que creen schemas, roles o datos. El [setup API](../../apps/api/test/setup.ts) exige en CI `TEST_DATABASE_URL`, `TEST_LOGO_DATABASE_URL`, `TEST_REDIS_URL`, `TEST_BI_SOURCE_DATABASE_URL`, `TEST_BI_WAREHOUSE_DATABASE_URL`, `TEST_BI_BENCHMARK_SCHEMA_FILE` y `TEST_BI_REDIS_URL`. BI exige servidores distintos para fuente y warehouse, y DDL legible; algunas suites requieren herramientas de backup/restauración. Requisitos y límites: [integración y E2E](../../.agents/skills/testing-tdd-engineering/references/integracion-y-e2e.md).

En local pueden omitirse suites sin servicios. Reportar cantidades y motivos: una ejecución satisfactoria con integraciones omitidas aporta evidencia parcial. No completar URLs con una base persistente, ni eliminar `CI` o desactivar tests para conseguir un resultado verde. Ejecutar `prisma migrate deploy`/`db push` desde una sesión del agente requiere ACK específico, incluso para pruebas; el workflow descartable existente no lo concede.

## 5. CI y cobertura

El [workflow actual](../../.github/workflows/ci.yml) se ejecuta en PR y push a main. Prepara PostgreSQL 18, warehouse en otro servidor, Redis 7, esquema/migraciones y clientes de backup; ejecuta tipos, lint, pruebas de scripts, API/web, build y smoke tests, además de controles de dependencias, secretos e imágenes.

La API genera un reporte JSON que se adjunta como artefacto. El gate exige éxito, tests presentes y cero tests/suites pendientes; el setup también falla con servicios/configuración incompletos. La suite web se ejecuta con Vitest; no se debe atribuirle el gate adicional de omisiones API. El smoke del proxy utiliza una fixture sintética y no demuestra un E2E con sesión persistente ni aceptación remota.

No hay umbrales porcentuales globales de cobertura configurados en Jest/Vitest ni gate de cobertura porcentual en CI. Cualquier umbral nuevo requiere decisión explícita, alcance, medición real y control ejecutable. Cobertura muestra código ejecutado, no calidad de assertions: evitar tests para aumentar porcentajes. Los [requisitos de cobertura de Vitest](https://vitest.dev/guide/coverage.html) dependen también de su proveedor; no asumirlos habilitados.

La aceptación requiere proteger escenarios críticos y conservar los checks obligatorios. E2E persistente, mutación y compatibilidad ampliada permanecen como adopciones futuras con entorno, costo y evidencia propios. Modificar esta guía no modifica CI ni acredita un run remoto para el SHA actual.

## 6. Entrega y diagnóstico

Antes de reparar un fallo, separar defecto de producción, expectativa incorrecta, test defectuoso, datos contaminados, proveedor, entorno y temporización/concurrencia. No debilitar pruebas para ocultar defectos ni usar retries como reparación de flakiness.

El reporte debe identificar requisito/riesgo, pruebas y nivel, comandos y entorno, resultados reales, omisiones, simulaciones y pendientes. Distinguir **diseñado**, **implementado**, **ejecutado**, **validado** y **auditado**. Conservar evidencia saneada según criticidad, sin secretos, tokens, contraseñas ni PII en contexto o documentación. Detalle de los controles AI, antipatrones, métricas y aceptación: [integridad y evaluación](../../.agents/skills/testing-tdd-engineering/references/integridad-y-evaluacion.md).
