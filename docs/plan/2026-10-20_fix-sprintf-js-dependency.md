# Plan HITL: corregir la alerta de sprintf-js

**Fecha:** 2026-10-20. **Estado:** fases 1–2 aprobadas; fase 3 validada sobre la implementación `a2b8109`, cierre documental pendiente de commit/ACK y de sus propios checks.
**Rama:** `codex/fix-sprintf-js-dependency`.
**Base:** `origin/main` actualizado mediante fetch, commit `87a57eca846f5b687fb12102851b3d2788d57992` (merge del PR #12). La rama parte de main y no incorpora commits exclusivos de la rama BI.
**ACK de inicio:** solicitud humana «PLEASE IMPLEMENT THIS PLAN»; habilita la preparación y conserva los cortes HITL entre las tres fases.
**ACK de fase 2:** «Continuar», 2026-10-20, después del commit humano `4c4ef31` y de la solicitud que incluye expresamente el override raíz. Autoriza ese cambio acotado y la corrección/compatibilidad, sin adelantar la fase 3.
**ACK de fase 3:** «Continuar», 2026-10-20, después del commit humano `a2b8109`; autoriza validación, preparación del PR y revisión de sus checks. No autoriza merge automático ni despliegue.

## Contexto y Restricciones

- Ejecutar sólo la fase `[Actual]`, proponer commit y detenerse hasta el ACK, según [AGENTS.md, secciones 5 y 9](../../AGENTS.md) y el [flujo Git](../collaboration/02_git_workflow.md). El plan debe quedar commiteado antes de implementar.
- La fase 1 registra diagnóstico y aceptación. No modifica manifiestos, lockfile, pruebas, workflows ni paquetes instalados. No se crean commits, PR, tags o despliegues automáticamente en esta fase.
- La fase 2 requiere el ACK humano que incluya expresamente el override acotado del `package.json` raíz. No autoriza cambios a workspaces, engines, otros overrides, infraestructura, hooks ni schema Prisma.
- Sin migraciones ni acceso a bases persistentes. Validación integral con servicios descartables del harness existente, sin confundir omisiones locales con aceptación completa.
- Aplicar las skills de configuración segura y Git; en implementación, testing según riesgo. Conservar Node 24.21.0, npm 11.19.0, Jest y los controles de cobertura/seguridad actuales.
- No descartar manualmente la alerta, introducir excepciones de auditoría, ejecutar `npm audit fix --force`, borrar el lockfile ni modificar `node_modules` a mano. Si falla compatibilidad, detener la corrección y documentarla antes de cambiar el enfoque.

## Diagnóstico y solución fijada

El [advisory GHSA-hp3w-g68c-fv3c / CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) describe excepciones por precisiones numéricas fuera de rango cuando el formato es controlado por un atacante. Afecta versiones <=1.1.3 y no registra una versión corregida al consultar durante la planificación. La presencia de un paquete vulnerable no demuestra una ruta explotable del CMS.

Cadena verificada en el lockfile y la instalación local:

```text
Jest 30.5.2 → babel-plugin-istanbul 8.0.0
  → @istanbuljs/load-nyc-config 1.1.0
  → js-yaml 3.15.2 → argparse 1.0.10 → sprintf-js 1.0.3
```

`sprintf-js` está marcado como dependencia indirecta de desarrollo. No se encontró uso directo en código API/web, scripts o workflows. La resolución instalada del loader utiliza `js-yaml.load()` para YAML. La versión candidata `js-yaml@5.4.3`, presente en la rama de Swagger, expone `load()` y depende de `argparse@^2.0.1`, sin dependencia directa de `sprintf-js`. Esto acredita una ruta de corrección; no sustituye probar el consumidor completo.

La fase 2 agregará únicamente esta entrada a los overrides raíz, preservando todas las existentes:

```json
{
  "@istanbuljs/load-nyc-config": {
    "js-yaml": "5.4.3"
  }
}
```

Regenerar el lockfile mediante npm y revisar su diff. Eliminar del árbol `sprintf-js` y el `argparse` antiguo de esa cadena, sin actualizar Jest ni aplicar un override global de YAML. No hay cambios a API pública, tipos de negocio, datos ni comportamiento del CMS.

**Condición de retiro:** cuando una versión upstream del loader o de su consumidor resuelva la cadena sin `sprintf-js`, retirar el override en un cambio separado y repetir las mismas pruebas. La documentación final registrará fecha, versión, motivo, límites y resultado de compatibilidad; no presentará este ajuste como un parche publicado de `sprintf-js`.

## Fases HITL

### `[Completada]` 1. Preparación — aprobada

- [x] Verificar checkout limpio y conservar la rama BI existente.
- [x] Actualizar `origin/main` y crear la rama solicitada desde su SHA, sin arrastrar commits exclusivos de otra tarea.
- [x] Confirmar versiones, cadena transitiva, API de carga YAML y selección de tests/umbrales CI.
- [x] Registrar plan, restricciones, línea base y criterios de aceptación; incorporarlo al índice de planes.
- [x] Validar formato, referencias locales y alcance documental del cambio.

**Commit sugerido:** `docs(plan): registrá la corrección de sprintf-js`
**ACK de cierre de fase 1:** «Continuar» recibido después del commit humano `4c4ef31` y antes de fase 2.

### `[Completada]` 2. Corrección y compatibilidad — aprobada

- Capturar inventario de advisories antes del cambio para comparar identidades y severidades, además del total de paquetes reportados.
- Agregar `scripts/testing/sprintf-dependency.test.mjs`, ejecutable con `node --test`. Verificar primero el fallo funcional de la aserción de ausencia de `sprintf-js` sobre la línea base, sin confundir errores de importación o red con Red.
- Con ACK específico para el manifiesto raíz, aplicar el override fijado y regenerar el lockfile con npm. No implementar cambios de otras fases durante la preparación.
- Validar árbol instalado y lockfile: ausencia de `sprintf-js`, loader resuelto con `js-yaml@5.4.3` y retiro del `argparse` antiguo de esa cadena. Usar resolución desde el consumidor, sin depender de una posición de hoisting particular.
- Probar el loader real con directorios temporales propios: `.nycrc.yml` y `.nycrc.yaml` con listas, booleanos, normalización de claves, valores escalares convertidos en listas y `extends` relativo. Afirmar los valores finales esperados; no simular el parser.
- Incluir rechazo de YAML inválido y archivo explícito inexistente. Limpiar fixtures en finally; no cargar configuración no confiable del repositorio ni tocar datos ajenos.
- Documentar Green, compatibilidad y condición de retiro. El patrón CI actual `scripts/testing/*.test.mjs` incluye el archivo nuevo; no requiere cambiar el workflow.

**Commit sugerido:** `fix(deps): eliminá sprintf-js de la cadena de Jest`
**ACK de inicio de fase 2:** recibido con el alcance del override raíz según AGENTS.md. Detenerse al terminar y esperar ACK de cierre antes de fase 3.

### `[Actual]` 3. Validación y entrega — validada, pendiente cierre documental

- Ejecutar instalación limpia con `npm ci`, verificar lockfile inmutable y árbol efectivo. Comparar auditoría contra la línea base por advisory, sin introducir hallazgos nuevos; conservar los umbrales high/critical y la revisión de nuevas dependencias.
- Ejecutar `npm audit signatures`, tests nativos y pruebas backend con cobertura, web, tipos, lint y builds. Registrar comandos, servicios reales/simulados, omisiones y warnings previos. No desactivar controles de resultados incompletos.
- Mantener fuera del artefacto productivo dependencias de desarrollo según el empaquetado existente. Validar por los checks de imágenes actuales; no cambiar Dockerfiles por este arreglo.
- Preparar PR a main con diagnóstico, override, riesgo del cambio de versión mayor, pruebas y condición de retiro. Adjuntar el PR y verificar checks del SHA final, incluidos los seis E2E con servicios descartables existentes. Sin merge automático ni bypass de protecciones.
- Proponer commit de evidencia/cierre y detenerse para ACK. Después del merge por el procedimiento habitual, verificar CI de main y cierre automático de Dependabot tras su análisis; no cerrar la alerta por descarte manual.

**Commit sugerido:** `docs(security): registrá la validación de la corrección de sprintf-js`
**ACK de inicio de fase 3:** recibido; cierre pendiente. Despliegue y otras operaciones persistentes quedan fuera.

## Criterios de aceptación

- [x] Plan de preparación commiteado y ACK de fase 1, con permiso específico del override antes de fase 2.
- [x] `sprintf-js` ausente del lockfile y de una instalación limpia; resolución del loader compatible y sin `argparse` antiguo en esa cadena.
- [x] Prueba de ausencia falla antes de corregir y pasa después; cargas YAML/extends y negativos verifican el consumidor real.
- [x] Auditoría sin este advisory ni hallazgos nuevos; firmas verificadas, Jest/cobertura y controles CI conservados.
- [x] Regresión y checks de la implementación `a2b8109` aprobados sin omisiones; límites locales explícitos y CI completo del PR verificado.
- [ ] Cierre documental commiteado y checks del nuevo SHA publicados antes de integrar; no transferir la aprobación del SHA anterior.
- [ ] Documentación del override, PR y evidencia revisables; ACK por fase.
- [ ] Después del merge, CI de main y resolución de la alerta verificados en GitHub. La desaparición local no acredita cierre remoto.

## Evidencia y cierre de fase 1

- **Verificado:** fetch de main, nueva rama en `87a57ec`, checkout inicial limpio; manifiesto sin el override nuevo y lockfile con la cadena vulnerable indicada. La rama BI se conserva.
- **Verificado:** Node v24.21.0 y npm 11.19.0. Lectura del loader confirma uso de `load()`; `js-yaml@5.4.3` instalado bajo Swagger expone esa función. No se afirma compatibilidad integral ni instalación limpia nueva.
- **Verificado:** auditoría npm de sólo consulta devuelve exit code 1 por hallazgos: 20 paquetes moderados, cero high/critical/low/info. Este total no representa necesariamente 20 advisories distintos. `sprintf-js` se identifica como indirecto/moderado y afectado por GHSA-hp3w-g68c-fv3c. No se ejecutó reparación.
- **Verificado:** CI ya incluye `scripts/testing/*.test.mjs`, auditoría high/critical, firmas, cobertura y rechazo de reportes incompletos; se conserva la revisión de dependencias con umbral high.
- **Pendiente:** implementar, ejecutar Red/Green y compatibilidad, regenerar dependencias, comparar advisories, firmas, regresión completa, PR/CI, merge y reanálisis de Dependabot. No se presentan pruebas planificadas como ejecutadas.

**Detención de fase 1 cumplida:** plan commiteado en `4c4ef31` y ACK recibido antes de fase 2.

## Evidencia y cierre de fase 2

- **Implementado:** override acotado `@istanbuljs/load-nyc-config → js-yaml@5.4.3`, con ACK humano recibido antes de modificar el manifiesto. Comparación estructural contra HEAD acredita que no cambió ningún otro campo u override raíz.
- **Regenerado mediante npm:** la regeneración general del lockfile y la actualización dirigida al loader conservaron la resolución anterior. `npm update js-yaml --package-lock-only --ignore-scripts` aplicó la nueva resolución; el diff semántico afecta exactamente tres entradas: YAML del loader pasa de3.15.2 a5.4.3, se retiran el argparse1.0.10 de esa cadena y sprintf-js1.0.3. El resto de las resoluciones y metadatos del lockfile permanecen iguales. No se editó a mano ni se borró el lockfile.
- **Verificado localmente:** `npm install --ignore-scripts` eliminó dos paquetes y cambió uno, sin ejecutar lifecycle scripts y sin alterar el checksum del lockfile regenerado. El loader real resuelve YAML5.4.3 y argparse2.0.1. No es una instalación limpia con `npm ci`; esa comprobación sigue en fase3.
- **Red funcional:** nueve pruebas nuevas; antes del cambio fallaron tres controles por presencia en lockfile, presencia en árbol instalado y YAML3.15.2. Los seis casos de configuración pasaron sobre la versión anterior. No se confundieron errores de importación/red con evidencia Red.
- **Green:** **9/9 pruebas**, sin omisiones, mediante `node --test scripts/testing/sprintf-dependency.test.mjs`. Resolución desde la cadena real de Jest independiente del hoisting; ausencia del paquete en lockfile y árbol; loader real con YAML/JSON, listas, escalares, claves normalizadas, extends relativo y negativos. Fixtures temporales retiradas en finally, sin mocks del parser.
- **Auditoría comparada:** el inventario previo tenía un único advisory directo (GHSA-hp3w-g68c-fv3c), propagado a20 paquetes moderados. Después: exit code0, cero paquetes vulnerables, ningún advisory nuevo. [Evidencia saneada](../technical/sprintf-dependency-audit-2026-10-20.json) con timestamps/herramientas/identidades públicas; no es garantía universal de seguridad ni cierre remoto de Dependabot.
- **Documentado:** [motivo, versiones, procedimiento, pruebas y condición de retiro](../technical/sprintf-dependency-remediation.md). El workflow existente incluye el archivo nuevo por su glob actual; no cambió ningún umbral ni control de cobertura/firma/integridad.
- **Verificado:** sintaxis del script, formato, referencias locales y `git diff --check`. Alcance limitado a manifiesto/lockfile, pruebas y documentación. Sin cambios a API/CMS, esquema, infraestructura, hooks, workflows ni dependencias directas. No se crearon commits, PR, tags ni despliegues; el directorio temporal propio se retiró al cerrar.
- **Pendiente de fase3 con ACK:** instalación limpia, firmas, regresión integral con cobertura y servicios descartables, builds/tipos/lint, CI/PR del SHA final y aceptación posterior al merge. El resultado local no acredita cierre de la alerta en GitHub.

**Commit sugerido:** `fix(deps): eliminá sprintf-js de la cadena de Jest`

**Detención de fase 2 cumplida:** ACK «Continuar» recibido después del commit humano `a2b8109` y antes de fase 3; no autoriza desplegar.

## Evidencia y cierre de fase 3

- **Instalación limpia verificada:** `npm ci` terminó correctamente y conservó el checksum del lockfile; cero vulnerabilidades en la auditoría posterior. `npm audit signatures` verificó 1356 paquetes y 296 attestations. Pasaron 76 tests nativos de integridad/compatibilidad, uno del lint de Next y 64 de release, sin omisiones.
- **Regresión local:** 381 tests web en 59 archivos y 97 suites contando describe, con cobertura y gate completos. Tipos/lint/build API/web aprobados; tres warnings API y ocho web previos. El primer intento de tipos tras npm ci carecía del cliente generado; se ejecutó `npm run db:generate --workspace apps/api`, como en CI, y se repitió correctamente. Sin migraciones desde el agente.
- **PR preparado:** [#13](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/13), borrador a main, adjuntado a esta tarea. Commits aprobados publicados sin force-push; no se realizó merge ni despliegue. El cuerpo distingue implementación validada y cierre documental pendiente.
- **CI verificado:** [run 39450309407](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/39450309407), head `a2b8109841d0eb9d214f19a4695c20a65696ef83`; `verify`, `dependency-review` y `secret-scan` aprobados. Artefactos/gates confirman 634/634 API en 89 suites y 381/381 web en 97 suites, cero pendientes/todo. La API usa PostgreSQL18/Redis7 reales descartables. Cobertura de líneas API91,01% y web66,47%, sin nuevos umbrales porcentuales.
- **E2E e imágenes:** 6/6 desktop/móvil sin retries, API Docker de producción, web standalone, HTTPS de mismo origen y servicios propios. Checkout limpio del merge de prueba `02b58bea2757d3ab8a0baf8a6fada8a1e727418e`; padres confirmados: base87a57ec y heada2b8109. Pasaron builds API/maintenance/web, smoke offline de maintenance, smoke de imágenes finales y gates de escaneo vigentes. Los tres SBOM no contienen sprintf-js. Docker local carece de daemon; estas comprobaciones se ejecutaron en Actions.
- **Fallo previo:** el CI de main87a57ec fallaba en liveness por heap del runner de cobertura >300MB, con readiness aprobada. No se reprodujo en el PR. El humano autorizó un ajuste aislado de la prueba si reaparecía; no hizo falta usarlo. No cambió el health productivo ni la prueba, ni se atribuye su desaparición al override.
- **Evidencia:** [resumen saneado](../technical/sprintf-dependency-validation-2026-10-20.json) con SHA/run, gates, cobertura, E2E, firmas, auditoría y SBOM; [guía y retiro](../technical/sprintf-dependency-remediation.md). Sin reportes ricos, sesiones, credenciales, PII ni logs completos versionados. Temporales propios retirados al cerrar; sin cambios a runtime, schema, infraestructura, hooks ni workflows versionados.
- **Pendiente:** commit y ACK del cierre documental, publicación y CI del nuevo head antes de integrar, revisión/merge habitual, CI de main después del merge y reanálisis automático de Dependabot. La aprobación de a2b8109 no se atribuye al futuro commit. No se descartó la alerta manualmente.

**Commit sugerido:** `docs(security): registrá la validación de la corrección de sprintf-js`

**Detención obligatoria:** implementación validada y PR preparado; esperar commit/ACK del cierre documental. Revisar sus propios checks antes del merge. No autoriza despliegue ni merge automático.
