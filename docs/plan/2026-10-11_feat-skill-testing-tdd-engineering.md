# Plan de Ejecución: Skill de Testing y TDD para Testimonial CMS

**Fecha de Inicio**: 2026-10-11

**Estado Global**: `En Progreso`

**Ticket / Issue Vinculado**: No asignado

**Rama Git**: `codex/skill-testing-tdd`, creada por solicitud posterior del usuario desde `882d6a7`; los commits se sugieren y no se crean automáticamente.

## 1. Contexto y Restricciones

Incorporar `testing-tdd-engineering`, código **SKL-TDD-001**, versión inicial **1.0.0**, a partir del adjunto del usuario «Especificación técnica de habilidad en Unit, Integration & E2E con TDD e Inteligencia Artificial». El usuario eligió una skill adaptada al Testimonial CMS y la actualización de la guía y la regla de cobertura para alinearlas con una metodología basada en riesgos. La solicitud posterior «PLEASE IMPLEMENT THIS PLAN» autoriza ejecutar la fase 1 del plan aprobado; conserva el ACK intermedio establecido para la fase 2.

Lecturas de contexto para la incorporación:

- [AGENTS.md](../../AGENTS.md), especialmente secciones 5, 8 y 9, y [llm.txt](../../llm.txt).
- [Arquitectura](../technical/01_architecture.md), [reglas de negocio](../domain/business_rules.md) y [diccionario de datos](../domain/diccionario_de_dato.md).
- [Guía de testing](../technical/05_testing.md), [reglas operativas](../../.agents/rules/RULES.md), [template HITL](./TEMPLATE.md) y [CI existente](../../.github/workflows/ci.yml).
- Manifests, configuración y suites actuales de API y web; distinguir herramientas instaladas, controles ejecutables y propuestas futuras.
- Skill `skill-creator` disponible en la sesión: frontmatter válido, instrucciones proporcionales y referencias de lectura progresiva.

La especificación fuente tiene versión **1.0.0**, actualización octubre de 2026. Leer íntegramente el adjunto al redactar la skill y conservar sus identificadores RF, RNF y AI. La habilidad resultante debe ser autocontenida y no depender de una ruta temporal de adjuntos ni copiar manuales completos.

**Alcance autorizado:** este plan y su índice; nueva skill y tres referencias; guía de testing; regla de cobertura y criterio de testing del template HITL; registro y conteos de skills propias en AGENTS.md y llm.txt. No modificar aplicaciones, dependencias, lockfile, workflows, infraestructura, hooks, esquemas ni contratos públicos. No instalar herramientas, ejecutar migraciones, crear recursos externos, desplegar ni persistir secretos, tokens, contraseñas o PII.

**Integridad HITL:** ejecutar sólo la fase `[Actual]`, mostrar commit sugerido y detenerse. Esperar ACK humano antes de avanzar; no registrar aprobaciones ni commits que no hayan ocurrido. Las etapas Red, Green y Refactor son partes del trabajo técnico dentro de una fase autorizada, no fases HITL adicionales.

## 2. Decisiones de Diseño

### Skill y referencias

- Crear `.agents/skills/testing-tdd-engineering/SKILL.md` con `name: testing-tdd-engineering`, descripción de activación para diseño, implementación, diagnóstico y revisión de pruebas, identificación SKL-TDD-001 y versión 1.0.0. Mantener la selección automática predeterminada; no agregar scripts, assets o metadatos UI sin necesidad concreta.
- Mantener la entrada breve: contexto vigente, selección Unit/Integration/E2E, ciclo Discover → Design → Red → Green → Refactor → Verify → Report, restricciones y enlaces de lectura condicional.
- Crear `references/estrategia-y-tdd.md`: selección por riesgo P0–P3, comportamiento y oráculo independiente, límites de cada nivel, Red funcional, Green sin debilitar pruebas, refactorización y caracterización de legado. Conservar trazabilidad RF-01–22 y RNF-01–10.
- Crear `references/integracion-y-e2e.md`: límites del sistema bajo prueba, dependencias reales, fixtures y limpieza aisladas, requisitos de entorno, concurrencia y recorridos completos. Distinguir claramente pruebas de UI simuladas y E2E con backend y almacenamiento reales.
- Crear `references/integridad-y-evaluacion.md`: AI-01–14, auditoría de assertions y mocks, controles negativos, mutación selectiva, antipatrones, criterios de aceptación y métricas con límites de interpretación.
- Preservar el contenido operativo del adjunto sin imponer TDD a cambios triviales, porcentajes universales de distribución, mutation testing permanente ni herramientas redundantes. Los estándares mencionados son referencias de diseño, no certificaciones.
- Priorizar aislamiento entre tenants; sesiones, RBAC y CSRF; API keys; validación y transiciones de testimonios; atomicidad del outbox; cuotas/caché; y operación BI. Derivar resultados esperados de contratos y reglas aprobadas; no inventar reglas cuando exista una discrepancia.
- Distinguir comportamiento existente, especificación deseada y defectos conocidos. Exigir un fallo funcional significativo en Red y expectativas independientes; no eliminar assertions, cambiar fixtures o alterar resultados legítimos para alcanzar Green.

### Herramientas, integración y evidencia

- Conservar Jest/Supertest en API y Vitest/Testing Library en web. Usar manifests y configuración como fuente para comandos y ubicaciones; no describir scripts ilustrativos como instalados.
- Documentar integración real con PostgreSQL/Redis y datos descartables. BI requiere servidores OLTP y warehouse separados en CI; respetar los requisitos reales de las suites y sus fixtures.
- Presentar Playwright, MSW, Testcontainers, fast-check y Stryker como opciones de adopción futura según necesidad; no instalarlas ni migrar los frameworks actuales en esta tarea.
- Para E2E futuro, exigir sesiones y datos aislados, locators semánticos, esperas por condiciones, resultados finales y evidencia de fallos. Una API simulada no acredita persistencia real ni aceptación remota.
- Reportar pruebas diseñadas, implementadas, ejecutadas, validadas y auditadas como estados distintos. Informar fallos, omisiones, limitaciones de entorno y alcance de los proveedores simulados; no inventar métricas ni resultados.

### Coherencia documental

- Reescribir `docs/technical/05_testing.md` como guía concisa con herramientas y ubicaciones reales, comandos existentes, metodología por riesgo, ejemplos basados en contratos y gates actuales. Enlazar el detalle de la skill sin duplicarlo.
- Sustituir sólo la obligación universal de cobertura superior al 80% por servicio en `.agents/rules/RULES.md` por pruebas de comportamiento proporcionales al riesgo. Alinear el criterio de testing de `docs/plan/TEMPLATE.md`; no corregir otras convenciones ajenas a esta tarea.
- Eliminar de la guía porcentajes universales de distribución y métricas ilustrativas presentadas como resultados. Los umbrales numéricos requerirán decisión explícita y un control ejecutable; esta incorporación no cambia los gates de CI.
- Documentar que CI exige servicios de integración y rechaza pruebas API omitidas. Una ejecución local con integraciones omitidas aporta evidencia parcial y debe comunicarse así.
- Registrar la habilidad en AGENTS.md y llm.txt; actualizar el catálogo propio de 25 a 26 tras verificar los archivos. No confundir ese conteo con el total de skills instaladas ni modificar registros históricos de planes completados.

Referencias oficiales para comprobar las instrucciones durante la fase 2:

- [Jest CLI](https://jestjs.io/docs/cli).
- [Cobertura en Vitest](https://vitest.dev/guide/coverage.html).
- [Principios de Testing Library](https://testing-library.com/docs/guiding-principles/).
- [Buenas prácticas de Playwright](https://playwright.dev/docs/best-practices).
- [Estados y métricas de mutación en Stryker](https://stryker-mutator.io/docs/mutation-testing-elements/mutant-states-and-metrics/).

## 3. Fases de Ejecución

### `[Completada]` Fase 1: Plan Persistente y Registro

**Estado de ejecución**: Terminada y aprobada. Commit verificado: `c16d798`, `docs(plan): incorporá el plan HITL de la skill de testing`; incorporó únicamente el plan y su entrada del índice.

- [x] Crear este plan con contexto, restricciones, decisiones y fases del plan aprobado.
- [x] Registrarlo en el índice de planes como `En Progreso`.
- [x] Validar enlaces locales del plan y el índice, whitespace y límites del diff.
- [x] Registrar evidencia real y preparar la entrega con commit sugerido; detenerse antes de la incorporación.

**Criterio de completitud**: Plan e índice coherentes y revisados, sin cambios fuera de esos dos archivos. La fase 2 permanece pendiente de ACK humano intermedio.

**Review Humano (ACK)**: `Aprobado` — mensaje «Continuar» del usuario, recibido el 2026-10-11 después de la entrega y del commit de fase 1. Autoriza la fase 2.

**Commit sugerido**:

```text
docs(plan): incorporá el plan HITL de la skill de testing
```

### `[Actual]` Fase 2: Skill, Coherencia y Validación

**Estado de ejecución**: Terminada técnicamente el 2026-10-11; pendiente de revisión humana y commit. ACK intermedio y commit de fase 1 verificados.

- [x] Tras ACK intermedio, registrar la revisión real, marcar fase 1 completada y fase 2 actual. Verificar el commit de fase 1 antes de iniciar la implementación según el índice de planes; no crear ni afirmar commits automáticamente.
- [x] Leer íntegramente el adjunto y crear la skill y sus tres referencias conforme a las decisiones de diseño.
- [x] Actualizar guía, regla de cobertura y criterio de testing del template, sin modificar aplicaciones ni automatización.
- [x] Actualizar registro y conteos en AGENTS.md y llm.txt tras verificar el inventario.
- [x] Ejecutar `quick_validate.py` de `skill-creator`; revisar frontmatter, enlaces, placeholders y trazabilidad RF/RNF/AI.
- [x] Revisar los escenarios documentales de la sección 4, los comandos contra los manifests y los gates contra el CI existente.
- [x] Revisar whitespace y alcance del diff; registrar resultados reales y actualizar la entrada del índice a fase 2 terminada pendiente de revisión.
- [x] Preparar entrega con commit sugerido y detenerse; conservar estado global `En Progreso` hasta la revisión final. Registrar el cierre sólo con aprobaciones y commits efectivamente verificados.

**Criterio de completitud**: Skill válida y autocontenida, referencias accesibles, documentación y reglas coherentes, catálogo propio de 26 entradas y cambios limitados al alcance documental autorizado.

**Review Humano (ACK)**: `Pendiente`.

**Commit sugerido**:

```text
feat(skills): agregá la metodología de testing y TDD
```

## 4. Validación y Criterios de Aceptación

La fase 1 valida únicamente plan e índice. `quick_validate.py`, el inventario de 26 skills y la trazabilidad del adjunto corresponden a la fase 2; no informar esas comprobaciones como realizadas durante la fase 1.

Validación documental de fase 2:

- Frontmatter, nombre y estructura válidos mediante `quick_validate.py`; enlaces locales existentes y referencias accesibles desde la entrada de la skill.
- Trazabilidad de los 22 RF, 10 RNF y 14 controles AI; preservación de antipatrones, criterios de aceptación y límites de las métricas del adjunto.
- Comandos y ubicaciones contrastados con manifests, configuración y suites existentes. Herramientas futuras y gates propuestos claramente separados de capacidades actuales.
- Conteos coherentes: 26 entradas propias SKL con archivo existente; sin dependencia de la ruta temporal del adjunto ni placeholders de scaffold.
- `git diff --check` y revisión del diff completo, incluidos archivos nuevos; ninguna modificación de aplicaciones, APIs, tipos públicos, dependencias, infraestructura, esquemas o workflows.

Escenarios para evaluar las decisiones que produce la documentación:

| Escenario | Decisión esperada |
| --- | --- |
| Contenido mínimo y Unicode | Derivar expectativas del contrato; distinguir el límite válido y el inmediatamente inferior, con conteo coherente entre DTO y PostgreSQL. Red debe fallar por el comportamiento evaluado. |
| Acceso entre tenants | Verificar denegación y ausencia de efectos sobre recursos ajenos; mantener reales las capas cuya integración se afirma comprobar. |
| Fallo al insertar outbox | Verificar rollback y ausencia de cambios persistentes con almacenamiento real; un mock del repositorio no prueba atomicidad transaccional. |
| UI con API simulada | Comunicar el alcance como prueba de UI; reservar la afirmación de E2E completo para el recorrido con backend y almacenamiento reales. |
| Ejecución local con integraciones omitidas | Informar qué pruebas se ejecutaron y cuáles se omitieron; no extrapolar el resultado a la suite completa ni al CI. |
| Cambio trivial o documental | Elegir validación proporcional; no exigir suites redundantes, TDD o mutation testing sin un riesgo concreto. |

No ejecutar suites de aplicación, servicios externos ni migraciones en esta incorporación documental. La revisión de escenarios verifica las instrucciones de la skill; no demuestra ejecución de esos comportamientos en la app.

## 5. Evidencia de Ejecución

### Fase 1

Validación documental realizada el 2026-10-11:

- 23 enlaces locales del plan y del índice resueltos.
- Diff del índice y contenido completo del plan nuevo revisados contra el plan aprobado.
- Whitespace revisado mediante `git diff --check` y comprobación del archivo nuevo con `git diff --no-index --check`; sin errores tras retirar espacios finales de los metadatos.
- Conjunto de cambios verificado: únicamente este plan y `docs/plan/README.md`.
- No se ejecutaron suites de aplicación, servicios externos ni migraciones. `quick_validate.py`, trazabilidad e inventario final corresponden a la fase 2.
- Al entregar fase 1 no se habían creado commits ni registrado ACK intermedio; la skill todavía no estaba creada y el catálogo permanecía en 25. Posteriormente se verificó el commit `c16d798` y se recibió el ACK documentado en la sección 3.

### Fase 2

Implementación documental y validación realizadas el 2026-10-11 en `codex/skill-testing-tdd`:

- Skill SKL-TDD-001 v1.0.0 creada con entrada y tres referencias, sin scripts, dependencias ni metadatos UI adicionales. `quick_validate.py`: `Skill is valid!`.
- Trazabilidad contra el adjunto completo: RF 22/22, RNF 10/10 y AI 14/14, sin identificadores faltantes, adicionales o duplicados en la skill; 20/20 antipatrones conservados.
- Revisión del contenido: seis áreas de aceptación y 14 métricas del adjunto conservadas con límites de interpretación y sin resultados ficticios. Herramientas futuras y controles actuales diferenciados.
- 56 enlaces locales del plan, índice, skill, guía y reglas resueltos, más el enlace nuevo del template a la guía. Sin placeholders de scaffold ni dependencia de la ruta temporal del adjunto en la skill.
- Catálogo propio: 26 nombres únicos SKL con archivo `SKILL.md` existente; AGENTS.md y llm.txt reflejan el mismo conteo.
- Siete comandos de la guía contrastados estáticamente con scripts y paths existentes, sin ejecutarlos. Las siete variables obligatorias de integración y el gate JSON API se contrastaron con setup/workflow; configuraciones Jest/Vitest y CI no tienen gate porcentual global de cobertura.
- Prettier `--check` aprobado para los cuatro archivos nuevos de la skill y la guía reescrita. Las actualizaciones de reglas, template y registros son puntuales; no se reformatearon íntegramente documentos ajenos al cambio.
- `git diff --check` y whitespace de archivos nuevos revisados. Diff limitado a los 11 archivos previstos: cuatro documentos de skill, reglas, guía, template, AGENTS.md, llm.txt, plan e índice.
- Referencias oficiales de Jest, Vitest, Testing Library, Playwright y Stryker consultadas; no se adoptaron herramientas ni configuraciones nuevas.

Revisión documental de escenarios; no constituye ejecución de los comportamientos de aplicación:

| Escenario | Resultado de la revisión |
| --- | --- |
| Mínimo y Unicode | La guía deriva expected independientes: nueve/diez caracteres y cinco/diez emoji; distingue puntos de código de UTF-16 y exige Red funcional. |
| Dos tenants | La referencia exige denegación y ausencia de efectos ajenos, con dependencias reales para afirmar aislamiento de persistencia. |
| Fallo outbox | La documentación distingue rollback real en PostgreSQL de la reacción ante un repositorio simulado; exige verificar el estado anterior y ausencia de eventos indebidos. |
| UI simulada | Se declara prueba de interfaz y no E2E completo; runner persistente y backend real siguen pendientes de adopción específica. |
| Integraciones omitidas | Se reportan como evidencia parcial; la guía distingue el gate API de CI del comportamiento local y de la suite web. |
| Cambio trivial/documental | Skill, guía y criterio de testing del template admiten validación proporcional sin tests redundantes ni mutación obligatoria. |

No se ejecutaron suites de aplicación, servicios externos, migraciones, mutaciones ni aceptación remota. No se creó commit de fase 2 ni se registró ACK final; el plan permanece `En Progreso` hasta esa revisión.
