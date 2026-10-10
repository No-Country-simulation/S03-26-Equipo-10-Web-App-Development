# Seguridad de dependencias

**Revisión:** 2026-10-10 · Node 24.21.0 · npm 11.19.0 · React 18.

## Instalación y scripts

`npm ci` usa `strict-peer-deps=true` y `strict-allow-scripts=true`. El `allowScripts` del `package.json` raíz aprueba por versión los scripts de `@prisma/client`, `@prisma/engines`, `prisma`, `@swc/core`, `esbuild` y `unrs-resolver`. Son necesarios para generar el cliente Prisma, preparar los motores y comprobar los binarios nativos de compilación y resolución. `@scarf/scarf` queda denegado porque su `postinstall` ejecuta `report.js` para telemetría. También quedan denegados `protobufjs@7.6.6` y `@parcel/watcher@2.6.0`: este último sólo invoca `node-gyp` si se solicita compilar desde fuentes; usamos los binarios opcionales del lockfile. Se revisó `unrs-resolver@1.12.2`: su `postinstall.js` llama a `napi-postinstall` para preparar el binding nativo de la misma versión; conservar las dependencias opcionales para evitar descargas de fallback.

Al cambiar cualquiera de estas versiones, revisá el script nuevo antes de volver a aprobarlo con `npm install-scripts approve <paquete>`. `npm install-scripts ls` debe quedar vacío. En CI se ejecutan `npm ci`, `npm audit --audit-level=high` y `npm audit signatures`; los cambios de dependencias en pull requests y los commits nuevos también se inspeccionan con Dependency Review y TruffleHog. Dependency Review requiere que el gráfico de dependencias esté habilitado en GitHub.

## Overrides

Los overrides son temporales. Al actualizar una dependencia que los arrastra, probá retirarlos uno a uno, regenerá el lockfile con npm y repetí `npm ci`, auditoría, tests y builds.

| Paquete | Versión | Motivo | Condición de retiro |
| --- | --- | --- | --- |
| `picomatch` | `4.0.7` | Unifica globbing y satisface el mínimo de Vitest 5. El motivo de seguridad del pin anterior no quedó registrado. | Retirar cuando el árbol resuelva versiones seguras sin el pin y pasen lint, tests y builds. |
| `path-to-regexp` | `8.4.2` | Sustituye `8.3.0`, afectada por [GHSA-j3q9-mxjg-w52f](https://github.com/advisories/GHSA-j3q9-mxjg-w52f). | Retirar cuando NestJS/Express resuelvan una versión corregida sin override y pasen las pruebas HTTP. |
| `lodash` | `4.18.1` | Sustituye `4.17.21`, afectada por [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc). | Retirar cuando las dependencias transitivas resuelvan versiones corregidas por sí mismas. |
| `qs` | `6.16.0` | Sustituye `6.14.2`, afectada por [GHSA-q8mj-m7cp-5q26](https://github.com/advisories/GHSA-q8mj-m7cp-5q26). | Retirar cuando Express y sus dependencias resuelvan una versión corregida sin override. |
| `postcss` | `8.5.29` | Next.js 15.5.27 pide `8.4.31`, afectada por [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93). El override conserva Next 15 y React 18 y satisface el mínimo de Vite 8.3.4. | Retirar cuando una versión compatible de Next incluya PostCSS corregido y el build web pase sin override. |
| `postcss-selector-parser` | `7.1.6` | Corrige [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Sustituye también dependencias en major 6; requiere validar CSS y build web. | Retirar cuando Tailwind/autoprefixer resuelvan versiones seguras por sí mismos. |
| `@nestjs/swagger > js-yaml` | `5.4.3` | Corrige [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) sin migrar Swagger a major 12, incompatible con NestJS 11. | Retirar cuando Swagger compatible con NestJS 11 resuelva YAML corregido. |

## Hallazgos pendientes

La auditoría del 2026-10-10 bajó de **41 altas y 4 críticas** a **7 altas, 0 críticas y 20 moderadas**. Son entradas de paquetes afectados, incluyendo propagación por dependencias, no 27 CVE distintos. El gate `npm audit --audit-level=high` sigue fallando y se conserva sin excepciones.

Las siete altas proceden de `braces@3.0.3`, mediante `micromatch`, `fast-glob` y `chokidar`, alcanzando Tailwind 3 y el plugin ESLint de Next 15. [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) indica **sin versión corregida**. npm propone migrar Tailwind a 4 y degradar eslint-config-next a 14; no se aplicaron esos cambios ni `npm audit fix --force`. Resolver este bloqueo requiere un parche publicado o una migración/reemplazo planificado de las cadenas afectadas. No declarar la fase 1 aprobada mientras persista.

Las moderadas restantes provienen de `sprintf-js` mediante `argparse`/YAML y el tooling Babel/Istanbul/Jest; no corresponden al YAML de Swagger corregido. [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) no se resuelve con la actualización compatible realizada. `npm audit --omit=dev` informa **5 altas y ninguna crítica**: el árbol de producción del monorepo aún incluye Tailwind por peers; esta medición no demuestra el contenido de las imágenes finales.

Se actualizaron Next a 15.5.27, Jest a 30.5.2, Vitest a 5.0.3, lint-staged a 17.6.0, TypeScript ESLint a 8.71.1 y ts-loader a 9.6.2. `npm update --ignore-scripts` renovó transitivas compatibles, eliminando los avisos críticos de proxy-addr, shell-quote y tinypool. El lockfile lo generó npm, sin edición manual. Las pruebas/builds y firmas de esta revisión se registran en [preparación CI de la demo](24_demo_ci_preparation.md).

La comprobación del lockfile final del 2026-10-10 verificó firmas de registry para **1387 paquetes** y attestations para **282**. Las dos imágenes finales pasaron Trivy sin altas/críticas; el árbol npm completo conserva el bloqueo anterior. La ejecución del workflow modificado en GitHub sigue pendiente.
