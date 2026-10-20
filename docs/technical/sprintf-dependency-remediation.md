# Corrección de la dependencia sprintf-js

**Fecha:** 2026-10-20. **Estado:** corrección y compatibilidad local verificadas en fase 2; cierre pendiente ACK. Instalación limpia, firmas, regresión integral y aceptación remota corresponden a fase 3.
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
