# Corrección de la dependencia sprintf-js

**Fecha:** 2026-10-20. **Estado:** implementación `a2b8109` validada en fase 3 con CI aprobado; cierre documental pendiente de commit/ACK y de sus propios checks. Merge y reanálisis de Dependabot pendientes. [Evidencia saneada de entrega](sprintf-dependency-validation-2026-10-20.json).
**Referencias:** [plan HITL](../plan/2026-10-20_fix-sprintf-js-dependency.md), [auditoría comparativa](sprintf-dependency-audit-2026-10-20.json), [pruebas ejecutables](../../scripts/testing/sprintf-dependency.test.mjs).

## Motivo y alcance

El advisory [GHSA-hp3w-g68c-fv3c / CVE-2026-97058](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) afecta a `sprintf-js` hasta 1.1.3 y no registra un parche al realizar esta corrección. La dependencia llegaba desde las herramientas de cobertura de Jest, mediante `@istanbuljs/load-nyc-config → js-yaml 3 → argparse 1 → sprintf-js`.

Se agregó un override raíz acotado al loader:

```json
{
  "@istanbuljs/load-nyc-config": {
    "js-yaml": "5.4.3"
  }
}
```

| Componente en esa cadena | Antes  | Después                    |
| ------------------------ | ------ | -------------------------- |
| Loader NYC               | 1.1.0  | 1.1.0                      |
| js-yaml                  | 3.15.2 | 5.4.3                      |
| argparse                 | 1.0.10 | 2.0.1, resuelto desde YAML |
| sprintf-js               | 1.0.3  | Ausente                    |

Jest permanece en 30.5.2. Se conservaron los demás campos y overrides del manifiesto. El diff semántico del lockfile contiene exactamente una resolución modificada y dos eliminaciones: YAML del loader, `argparse` antiguo de esa cadena y `sprintf-js`. No es un parche de la librería vulnerable ni una actualización global de YAML.

## Regeneración y comprobaciones

Con Node 24.21.0 y npm 11.19.0, la primera regeneración general y la actualización dirigida al loader conservaron la resolución anterior. La actualización dirigida a YAML aplicó el override; se revisó que las otras resoluciones no cambiaran:

```bash
npm update js-yaml --package-lock-only --ignore-scripts
npm install --ignore-scripts
node --test scripts/testing/sprintf-dependency.test.mjs
```

La instalación eliminó dos paquetes y cambió uno; el checksum del lockfile regenerado permaneció igual. No se ejecutaron scripts de instalación en estos comandos. La instalación limpia con `npm ci` y la verificación de firmas permanecen pendientes de fase 3.

Antes de corregir, tres assertions fallaron por presencia del paquete en lockfile/árbol y por la resolución YAML 3.15.2. Los otros seis casos pasaron. Después de corregir, los nueve pasaron sin omisiones: resolución desde la cadena real de Jest, carga de `.nycrc.yml`/`.nycrc.yaml`, listas, escalares, claves normalizadas, extends relativo a YAML/JSON y rechazo de YAML inválido o archivo explícito ausente. Las fixtures son temporales y se eliminan en finally; el parser y el loader no se simulan.

La auditoría antes del cambio reportó 20 paquetes moderados afectados por un único advisory directo; después reportó cero paquetes vulnerables y ningún advisory nuevo. El JSON enlazado conserva fecha, herramientas, códigos de salida, conteos e identidades públicas; no almacena credenciales ni datos del CMS. Es evidencia del registry consultado en esas fechas, no garantía universal de ausencia de vulnerabilidades.

El workflow existente ya ejecuta `scripts/testing/*.test.mjs`. No se cambiaron sus umbrales, firmas, cobertura ni controles de resultados incompletos. La alerta de GitHub seguirá pendiente hasta integrar el cambio y verificar el reanálisis de Dependabot en main; no se descartó manualmente.

## Condición de retiro

Cuando una versión upstream del loader o de su consumidor retire la cadena vulnerable, actualizarla en un cambio separado, quitar este override y repetir pruebas de árbol/compatibilidad, instalación limpia, auditoría, firmas y CI. No retirar sólo por la existencia de una nueva versión sin verificar su resolución efectiva. Si se detecta incompatibilidad, detener la promoción y documentarla; no ampliar el override ni sustituir herramientas silenciosamente.

## Validación de fase 3

La implementación commiteada es `a2b8109841d0eb9d214f19a4695c20a65696ef83`; el [PR #13](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/13) se abrió en borrador y su [CI 39450309407](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/39450309407) valida ese head. El cierre documental posterior requiere su propio CI cuando se publique; no se traslada la aprobación a un SHA nuevo.

Localmente, `npm ci` terminó con cero vulnerabilidades y el checksum del lockfile intacto. `npm audit signatures` verificó firmas de 1356 paquetes y 296 attestations. Pasaron 76 controles de integridad/compatibilidad, uno del lint de Next, 64 controles de release y 381 tests web con cobertura; el gate validó sus 97 suites sin omisiones. Tipos, lint y build API/web aprobados; lint conserva tres warnings API y ocho web anteriores. Tras la instalación limpia fue necesario generar el cliente Prisma como hace CI; el primer intento de tipos sin ese artefacto no constituye una regresión del código y se repitió después de generarlo, sin migraciones.

Los artefactos API/web del run verifican 634/634 casos API en 89 suites y 381/381 web en 97 suites (59 archivos), sin pendientes ni todo. La API usa los servicios PostgreSQL18 y Redis7 descartables del workflow; la web conserva sus dependencias reales/simuladas según cada test. Cobertura de líneas: API91,01% y web66,47%; son mediciones del run, sin un umbral porcentual nuevo ni garantía de calidad universal.

La base `87a57ec` tenía un CI fallido porque el runner de cobertura superó el heap de300MB en una prueba de liveness de BI. Ese fallo no se reprodujo en la suite API del PR; no se modificaron la prueba ni el health productivo, ni se atribuye su desaparición al override. El humano autorizó un ajuste aislado de la prueba sólo si se repite ese fallo; esa autorización condicional no se utilizó en este run.

Docker local no dispone de daemon. Los seis recorridos E2E, las imágenes finales y sus smoke/escaneos se validaron en Actions: 6/6 sin retries, checkout limpio, builds API/maintenance/web y gates de seguridad aprobados. Los tres SBOM no contienen `sprintf-js`. El checkout E2E corresponde al merge de prueba `02b58bea2757d3ab8a0baf8a6fada8a1e727418e`, con padres base87a57ec e implementacióna2b8109, confirmados mediante GitHub. Los tres checks requeridos del run terminaron en success. El escaneo respeta la política existente: maintenance bloquea todo HIGH/CRITICAL; API/web bloquean HIGH/CRITICAL con corrección disponible. Ese gate no equivale a cero vulnerabilidades universales.

La alerta de Dependabot, el CI posterior al merge y el cierre HITL siguen pendientes. El PR permanece en borrador hasta incorporar/revisar el cierre documental y verificar los checks de ese nuevo head; este run no valida un commit futuro.
