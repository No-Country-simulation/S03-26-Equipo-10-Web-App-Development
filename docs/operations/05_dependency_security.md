# Seguridad de dependencias

**Revisión:** 2026-09-28 · Node 24.21.0 · npm 11.19.0 · React 18.

## Instalación y scripts

`npm ci` usa `strict-peer-deps=true` y `strict-allow-scripts=true`. El `allowScripts` del `package.json` raíz aprueba por versión los scripts de `@prisma/client`, `@prisma/engines`, `prisma`, `@swc/core`, `esbuild` y `unrs-resolver`. Son necesarios para generar el cliente Prisma, preparar los motores y comprobar los binarios nativos de compilación y resolución. `@scarf/scarf` queda denegado porque su `postinstall` ejecuta `report.js` para telemetría y no es necesario para compilar ni ejecutar las apps.

Al cambiar cualquiera de estas versiones, revisá el script nuevo antes de volver a aprobarlo con `npm install-scripts approve <paquete>`. `npm install-scripts ls` debe quedar vacío. En CI se ejecutan `npm ci`, `npm audit --audit-level=high` y `npm audit signatures`; los cambios de dependencias en pull requests y los commits nuevos también se inspeccionan con Dependency Review y TruffleHog. Dependency Review requiere que el gráfico de dependencias esté habilitado en GitHub.

## Overrides

Los overrides son temporales. Al actualizar una dependencia que los arrastra, probá retirarlos uno a uno, regenerá el lockfile con npm y repetí `npm ci`, auditoría, tests y builds.

| Paquete | Versión | Motivo | Condición de retiro |
| --- | --- | --- | --- |
| `picomatch` | `4.0.4` | Pin anterior que unifica el motor de globbing usado por Jest, Vitest y tooling. El motivo de seguridad original no quedó registrado. | Retirar cuando el árbol resuelva versiones seguras sin el pin y pasen lint, tests y builds. |
| `path-to-regexp` | `8.4.2` | Sustituye `8.3.0`, afectada por [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f). | Retirar cuando NestJS/Express resuelvan una versión corregida sin override y pasen las pruebas HTTP. |
| `lodash` | `4.18.1` | Sustituye `4.17.21`, afectada por [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc). | Retirar cuando las dependencias transitivas resuelvan versiones corregidas por sí mismas. |
| `qs` | `6.16.0` | Sustituye `6.14.2`, afectada por [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26). | Retirar cuando Express y sus dependencias resuelvan una versión corregida sin override. |
| `postcss` | `8.5.28` | Next.js 15.5.26 pide `8.4.31`, afectada por [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93). El override conserva Next 15 y React 18. | Retirar cuando una versión compatible de Next incluya PostCSS corregido y el build web pase sin override. |

## Hallazgos pendientes

La auditoría del 2026-09-28, después de `npm ci`, reportó **0 críticas, 0 altas, 2 moderadas y 0 bajas**. Las dos moderadas corresponden a `vitest@3.2.7` y `@vitest/mocker@3.2.7` por [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9). Son herramientas de pruebas en `devDependencies`; el fix sugerido por npm es Vitest 5.0.2, que cambia de versión mayor. Revisar la migración y repetir los tests web antes de actualizar. El informe es una medición puntual: CI repetirá la auditoría en cada ejecución y fallará si aparece una alerta alta o crítica.

La comprobación local `npm audit signatures` terminó con `invalid: 0` y `missing: 0`. La ejecución de estos controles en GitHub Actions queda por validar en un run real del workflow.
