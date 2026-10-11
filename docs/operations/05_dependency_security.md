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
| `postcss-selector-parser` | `7.1.6` | Corrige [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf). Sustituye también dependencias en major 6; requiere validar CSS y build web. | Retirar cuando el árbol resuelva versiones seguras por sí mismo. |
| `@nestjs/swagger > js-yaml` | `5.4.3` | Corrige [GHSA-r3ph-w7gj-g6xm](https://github.com/advisories/GHSA-r3ph-w7gj-g6xm) sin migrar Swagger a major 12, incompatible con NestJS 11. | Retirar cuando Swagger compatible con NestJS 11 resuelva YAML corregido. |
| `@next/eslint-plugin-next > fast-glob` | Adaptador local `@testimonial-cms/next-lint-glob@1.0.0` + `tinyglobby@0.2.17` | Retira `micromatch/braces` afectado por [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). Conserva únicamente `globSync(string, { onlyDirectories: true })`, el contrato que usa Next 15; rechaza otras opciones. | Retirar cuando el plugin oficial use una dependencia segura; repetir el test de compatibilidad y lint. |

El override de archivo se resuelve desde `node_modules/@next/eslint-plugin-next`: `file:../../../apps/web/tools/next-lint-glob`. npm lo convierte en un enlace local explícito en el lockfile. No es una publicación externa ni un reemplazo general de `fast-glob`. El adaptador desactiva expansión recursiva implícita y conserva rutas absolutas/relativas y la ausencia de slash final. La [guía de tinyglobby](https://superchupu.dev/tinyglobby/migration) explica por qué un alias directo no preserva ese comportamiento. Las tres etapas Docker que instalan dependencias copian antes el adaptador, con ACK específico.

`node --test scripts/test-next-eslint-glob.mjs` verifica directorios, patrones, espacios, configuración de roots y la regla real de enlaces de Next. CI conserva todas las reglas y ejecuta este control adicional. Los paquetes de registry se verifican con `npm audit signatures`; el adaptador local se revisa como código del repositorio y no tiene firma de registry. No se permiten scripts de instalación nuevos.

## Remediación de fase 1

Con ACK del 2026-10-10 se migró Tailwind 3.4.19 a **4.3.3**, con `@tailwindcss/postcss@4.3.3` y `tailwind-merge@3.7.0`. Se retiró autoprefixer porque el plugin nuevo se ocupa del prefijado. Se conservan tokens HSL, configuración TS, animaciones y Next 15/React 18; se ajustaron utilidades y tipografía para compatibilidad. Navegadores mínimos: Safari 16.4, Chrome 111 y Firefox 128 según la [guía oficial](https://tailwindcss.com/docs/upgrade-guide). El merge de clases declara las fuentes y sombras semánticas propias.

El lockfile final no contiene `braces` ni `micromatch`. La auditoría completa en línea informa **0 altas, 0 críticas y 20 moderadas**; `npm audit --audit-level=high` aprobó sin excepciones. `npm audit --omit=dev` informa **0 vulnerabilidades**. Las 20 moderadas son entradas afectadas y propagación por dependencias, no 20 CVE distintos: provienen de `sprintf-js` mediante argparse/YAML y Babel/Istanbul/Jest; no corresponden al YAML de Swagger corregido. [GHSA-hp3w-g68c-fv3c](https://github.com/advisories/GHSA-hp3w-g68c-fv3c) continúa pendiente sin solución compatible verificada; no se aplica la degradación de Jest que propone npm.

Firmas del lockfile final: **1347 paquetes de registry y 287 attestations verificadas**. SHA-256 del lockfile: `eee48c3c70f96e83328531842a32dfe7e836f22c1329eed9a31619dabe8e2f9b`. Se generó mediante npm en un fixture limpio porque una actualización incremental retenía la resolución anterior; no se editaron entradas del lockfile a mano. `npm ci` en línea aprobó con ese mismo hash y sin scripts pendientes. Un intento offline carecía del tarball de tinybench actualizado y no se toma como validación exitosa.

Esta revisión continúa el commit `4d0b612`. Evidencia de pruebas, builds e imágenes en [preparación CI de la demo](24_demo_ci_preparation.md). El workflow del commit final en GitHub sigue pendiente; corregir la auditoría local no acredita despliegue ni protección de main.
