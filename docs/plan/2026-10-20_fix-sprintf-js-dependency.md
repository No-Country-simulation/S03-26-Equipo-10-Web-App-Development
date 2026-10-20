# Plan HITL: corregir la alerta de sprintf-js

**Fecha:** 2026-10-20. **Estado:** en progreso; fase 1 terminada, pendiente ACK.
**Rama:** `codex/fix-sprintf-js-dependency`.
**Base:** `origin/main` actualizado mediante fetch, commit `87a57eca846f5b687fb12102851b3d2788d57992` (merge del PR #12). La rama parte de main y no incorpora commits exclusivos de la rama BI.
**ACK de inicio:** solicitud humana «PLEASE IMPLEMENT THIS PLAN»; habilita la preparación y conserva los cortes HITL entre las tres fases.

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

### `[Actual]` 1. Preparación — terminada, pendiente ACK

- [x] Verificar checkout limpio y conservar la rama BI existente.
- [x] Actualizar `origin/main` y crear la rama solicitada desde su SHA, sin arrastrar commits exclusivos de otra tarea.
- [x] Confirmar versiones, cadena transitiva, API de carga YAML y selección de tests/umbrales CI.
- [x] Registrar plan, restricciones, línea base y criterios de aceptación; incorporarlo al índice de planes.
- [x] Validar formato, referencias locales y alcance documental del cambio.

**Commit sugerido:** `docs(plan): registrá la corrección de sprintf-js`
**ACK de cierre de fase 1:** pendiente. **Detenerse antes de fase 2.**

### `[Pendiente]` 2. Corrección y compatibilidad

- Capturar inventario de advisories antes del cambio para comparar identidades y severidades, además del total de paquetes reportados.
- Agregar `scripts/testing/sprintf-dependency.test.mjs`, ejecutable con `node --test`. Verificar primero el fallo funcional de la aserción de ausencia de `sprintf-js` sobre la línea base, sin confundir errores de importación o red con Red.
- Con ACK específico para el manifiesto raíz, aplicar el override fijado y regenerar el lockfile con npm. No implementar cambios de otras fases durante la preparación.
- Validar árbol instalado y lockfile: ausencia de `sprintf-js`, loader resuelto con `js-yaml@5.4.3` y retiro del `argparse` antiguo de esa cadena. Usar resolución desde el consumidor, sin depender de una posición de hoisting particular.
- Probar el loader real con directorios temporales propios: `.nycrc.yml` y `.nycrc.yaml` con listas, booleanos, normalización de claves, valores escalares convertidos en listas y `extends` relativo. Afirmar los valores finales esperados; no simular el parser.
- Incluir rechazo de YAML inválido y archivo explícito inexistente. Limpiar fixtures en finally; no cargar configuración no confiable del repositorio ni tocar datos ajenos.
- Documentar Green, compatibilidad y condición de retiro. El patrón CI actual `scripts/testing/*.test.mjs` incluye el archivo nuevo; no requiere cambiar el workflow.

**Commit sugerido:** `fix(deps): eliminá sprintf-js de la cadena de Jest`
**ACK de fase 2:** pendiente; debe incluir el override raíz según AGENTS.md. Detenerse al terminar.

### `[Pendiente]` 3. Validación y entrega

- Ejecutar instalación limpia con `npm ci`, verificar lockfile inmutable y árbol efectivo. Comparar auditoría contra la línea base por advisory, sin introducir hallazgos nuevos; conservar los umbrales high/critical y la revisión de nuevas dependencias.
- Ejecutar `npm audit signatures`, tests nativos y pruebas backend con cobertura, web, tipos, lint y builds. Registrar comandos, servicios reales/simulados, omisiones y warnings previos. No desactivar controles de resultados incompletos.
- Mantener fuera del artefacto productivo dependencias de desarrollo según el empaquetado existente. Validar por los checks de imágenes actuales; no cambiar Dockerfiles por este arreglo.
- Preparar PR a main con diagnóstico, override, riesgo del cambio de versión mayor, pruebas y condición de retiro. Adjuntar el PR y verificar checks del SHA final, incluidos los seis E2E con servicios descartables existentes. Sin merge automático ni bypass de protecciones.
- Proponer commit de evidencia/cierre y detenerse para ACK. Después del merge por el procedimiento habitual, verificar CI de main y cierre automático de Dependabot tras su análisis; no cerrar la alerta por descarte manual.

**Commit sugerido:** `docs(security): registrá la validación de la corrección de sprintf-js`
**ACK de fase 3:** pendiente. Despliegue y otras operaciones persistentes quedan fuera.

## Criterios de aceptación

- [ ] Plan de preparación commiteado y ACK de fase 1, con permiso específico del override antes de fase 2.
- [ ] `sprintf-js` ausente del lockfile y de una instalación limpia; resolución del loader compatible y sin `argparse` antiguo en esa cadena.
- [ ] Prueba de ausencia falla antes de corregir y pasa después; cargas YAML/extends y negativos verifican el consumidor real.
- [ ] Auditoría sin este advisory ni hallazgos nuevos; firmas verificadas, Jest/cobertura y controles CI conservados.
- [ ] Regresión y checks del SHA final aprobados sin omisiones ocultas; limitaciones locales explícitas hasta disponer de CI completo.
- [ ] Documentación del override, PR y evidencia revisables; ACK por fase.
- [ ] Después del merge, CI de main y resolución de la alerta verificados en GitHub. La desaparición local no acredita cierre remoto.

## Evidencia y cierre de fase 1

- **Verificado:** fetch de main, nueva rama en `87a57ec`, checkout inicial limpio; manifiesto sin el override nuevo y lockfile con la cadena vulnerable indicada. La rama BI se conserva.
- **Verificado:** Node v24.21.0 y npm 11.19.0. Lectura del loader confirma uso de `load()`; `js-yaml@5.4.3` instalado bajo Swagger expone esa función. No se afirma compatibilidad integral ni instalación limpia nueva.
- **Verificado:** auditoría npm de sólo consulta devuelve exit code 1 por hallazgos: 20 paquetes moderados, cero high/critical/low/info. Este total no representa necesariamente 20 advisories distintos. `sprintf-js` se identifica como indirecto/moderado y afectado por GHSA-hp3w-g68c-fv3c. No se ejecutó reparación.
- **Verificado:** CI ya incluye `scripts/testing/*.test.mjs`, auditoría high/critical, firmas, cobertura y rechazo de reportes incompletos; se conserva la revisión de dependencias con umbral high.
- **Pendiente:** implementar, ejecutar Red/Green y compatibilidad, regenerar dependencias, comparar advisories, firmas, regresión completa, PR/CI, merge y reanálisis de Dependabot. No se presentan pruebas planificadas como ejecutadas.

**Detención obligatoria:** fase 1 completada. Esperar commit y ACK humano antes de avanzar; no modificar dependencias en esta ejecución.
