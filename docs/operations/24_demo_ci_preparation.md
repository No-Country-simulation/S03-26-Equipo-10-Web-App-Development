# Preparación CI de la demo — fase 1

Revisión local del 2026-10-10. Plan: [preparación de la demo](../plan/2026-10-10_chore-preparacion-demo-completa.md). Incluye la evidencia local histórica y la validación remota de la implementación `3b98f64` en CI `38097512213`, detallada al final. No acredita un despliegue remoto.

## Alcance y autorización

Se trabaja únicamente en CI confiable. ACK recibido para corregir dependencias/overrides/allowlist del manifiesto raíz y ejecutar migraciones en PostgreSQL descartables. La continuación recibió ACK para migrar dependencias y agregar exactamente tres instrucciones COPY del adaptador local a los Dockerfiles (API deps, API production-deps y web deps). No se modificaron schema Prisma, migraciones existentes, Compose ni hooks; no se operaron bases persistentes o proveedores de despliegue.

La topología acordada para las fases siguientes es Vercel con proxy de mismo origen, API/pollers y worker BI independientes en Railway, Redis privado en Railway y dos proyectos Supabase para OLTP/warehouse, conservando Cloudinary y YouTube. Esa integración todavía está pendiente.

## Cambios verificables

- El test de escritura en otro tenant exige `NotFoundError`; la transición concurrente mantiene `ConflictError`. No cambia el repositorio ni el aislamiento.
- CI incorpora un segundo PostgreSQL 18 descartable para warehouse, Redis BI separado por índice y el DDL sintético generado desde el schema existente mediante `prisma migrate diff`.
- `pg_dump` y `pg_restore` deben ser major 18, instalados desde PGDG, para ejecutar la prueba real de backup/restauración BI.
- El setup API falla en CI si falta alguna variable de integración, el DDL no es legible o ambas conexiones BI apuntan al mismo host/puerto. El reporte Jest además debe contener pruebas exitosas y cero omisiones de tests/suites; se conserva como artefacto durante 14 días, incluso si fallan las pruebas y existe el reporte.
- Todas las acciones del workflow se referencian por SHA completo. Se agregan timeouts y cancelación de validaciones obsoletas por PR/rama. Esto no fija por digest las imágenes de servicios ni todas las descargas internas de las acciones.
- Se conserva el bloqueo por auditoría alta/crítica, firmas, Dependency Review, secretos, smoke de imágenes y escaneo existente. `continue-on-error` de auditoría conserva su gate final.
- Next sigue en major 15, NestJS en 11 y React en 18. La continuación migra Tailwind a 4.3.3 y sustituye el globbing vulnerable del lint de Next por un adaptador local acotado, con prueba explícita en CI. Vitest 5 requiere configurar JSX automático mediante `oxc` con Vite 8. Detalle de paquetes/overrides: [seguridad de dependencias](05_dependency_security.md).

## Reproducción local autorizada

Usar exclusivamente dos servidores PostgreSQL descartables y un Redis descartable, accesibles sólo por loopback, sin volúmenes persistentes. Los fixtures BI crean bases y roles sintéticos; sus privilegios de administrador son sólo para estos servidores de pruebas, nunca para runtime remoto.

1. `npm ci`; comprobar que no cambie `package-lock.json` y que `npm install-scripts ls` no liste scripts pendientes.
2. Generar Prisma con `npm run db:generate --workspace @testimonial-cms/api`.
3. Generar DDL con `prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script` a un archivo temporal.
4. Con ACK específico, aplicar las migraciones OLTP exclusivamente a la base descartable con `npm run db:migrate --workspace @testimonial-cms/api`. No aplicar el schema OLTP al warehouse; los fixtures administran su propio esquema.
5. Configurar `TEST_DATABASE_URL`, `TEST_LOGO_DATABASE_URL`, `TEST_REDIS_URL`, `TEST_BI_SOURCE_DATABASE_URL`, `TEST_BI_WAREHOUSE_DATABASE_URL`, `TEST_BI_REDIS_URL` y `TEST_BI_BENCHMARK_SCHEMA_FILE`. Source y warehouse deben apuntar a servidores distintos. Para herramientas y smoke de contenedores, configurar también `DATABASE_URL` y `REDIS_URL` descartables.
6. Con `CI=true`, ejecutar API con `--json --outputFile=<reporte-temporal>` y revisar éxito y cero omisiones; luego web, tipos, lint, builds, auditoría y firmas según el workflow. Construir las imágenes existentes y ejecutar `scripts/ci-smoke-containers.sh` con las dependencias descartables.
7. Eliminar los contenedores de pruebas al terminar. No copiar URLs con credenciales, dumps ni logs completos al repositorio.

## Evidencia histórica del commit 4d0b612

Los resultados de esta sección corresponden a la primera implementación y quedan sustituidos por la continuación documentada debajo.

Base del diff: `91c619d63585df9f9b59d578df1eeee39f4e7afe`. Lockfile final SHA-256: `3cfbbca7f97c4ad8b9c532e10787f8847eae8d37e2773708b148800dca297729`. En esa revisión eran cambios locales sin commit ni publicación; después se registraron en `4d0b612`.

| Control | Resultado observado |
| --- | --- |
| Instalación reproducible | `npm ci` y `npm ci --offline` aprobados; hash del lockfile intacto y ningún script pendiente de revisión. La auditoría offline no acredita ausencia de vulnerabilidades; se repitió el gate en línea. |
| Prisma/migraciones | Cliente 6.5 generado; 13 migraciones aplicadas sólo a PostgreSQL 18 descartable. |
| Tipos | `npm run typecheck` aprobado en ambos workspaces después de generar Prisma. |
| Lint | Aprobado, con advertencias; el acceso a variables mediante la lista fija del preflight agrega una advertencia de `security/detect-object-injection`. |
| API completa | 68 suites, **471 pruebas aprobadas, 0 omitidas**; incluye worker BI, permisos, caída del warehouse, backup/restauración y logos. Duración observada: 152,911 s. |
| Web | 23 archivos, **115 pruebas aprobadas, 0 omitidas**, con Vitest 5 y el PostCSS final. |
| Preflight | Rechaza configuración ausente, variable de logos ausente, DDL ilegible y source/warehouse en mismo servidor; permite configuración completa y tests locales sin CI. |
| Gate de omisiones | El reporte final tiene éxito y cero tests/suites pendientes. La primera corrida detectó 8 tests de logos omitidos; se agregó `TEST_LOGO_DATABASE_URL` y se repitió la suite completa. |
| Workflow | `actionlint` 1.7.12 aprobado; binario verificado contra checksum publicado. `git diff --check` aprobado. |
| Firmas del lockfile final | 1.387 paquetes con firmas verificadas y 282 attestations verificadas. |
| Auditoría en línea | **Falla**, con 7 altas/0 críticas/20 moderadas. El gate final conserva el fallo. |
| Builds | API compilada y web Next 15.5.27 compilada; 27 páginas generadas. El build local requiere red para `next/font/google`; el primer intento sin red falló y la repetición con red aprobó. |
| Imágenes finales | API y web construidas con el lockfile final; builds Docker aprobados. |
| Smoke de producción | `scripts/ci-smoke-containers.sh` aprobado: liveness/readiness, Redis/login inválido, métricas protegidas, web/health, usuarios sin root, capabilities eliminadas, root filesystem inmutable, temporales escribibles y apagado sin OOM/SIGKILL. |
| Trivy 0.74.0 | **0 altas/críticas en API y 0 en web**, incluyendo sistema operativo y paquetes detectados. Gate de imágenes aprobado; no sustituye la auditoría npm del árbol completo. |
| SBOM | CycloneDX generado para ambas imágenes: 455 componentes API y 112 web. |

Identidades locales verificadas (sin publicación en registry):

- API `testimonial-cms-api:ci`: `sha256:7afb4b92d3b68fd271801ec5d4025d98fdc784531dd50e55b50725bc2a567245`.
- Web `testimonial-cms-web:ci`: `sha256:6735f6864d601c213de3fe9b759ccfe70f31c287701565e6a19621a56b8c9190`.

Durante la continuación se recrearon los servicios descartables tras perder los temporales de la sesión. No se usaron bases persistentes. La revisión automática rechazó el montaje del socket Docker dentro de Trivy; se eligió exportar imágenes a tar y montarlos de sólo lectura, sin socket. Los contenedores descartables y los tar de imágenes se eliminaron al terminar; las imágenes locales y reportes quedan disponibles para revisión.

Pendiente remoto: ejecutar el workflow sobre el commit final en GitHub, incluyendo instalación PGDG en el runner, Dependency Review, TruffleHog, artefactos y gates. La validación local no acredita esos servicios ni la protección de `main`.

## Bloqueo de seguridad original — remediado localmente

`npm audit` pasó de 41 altas/4 críticas a **7 altas/0 críticas**, con 20 moderadas. Las siete altas derivan de `braces@3.0.3`, sin parche publicado según [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), a través de Tailwind 3 y el lint de Next 15. `npm audit --omit=dev` todavía informa 5 altas por la cadena de peers de Tailwind en el monorepo; no confundir ese árbol con las imágenes finales.

En ese commit el gate permanecía rojo. El usuario autorizó después resolver primero las dependencias de fase 1, incluyendo la migración descrita debajo; no aplicar downgrades automáticos, forks sin revisar ni excepciones silenciosas. Tras resolverlo, repetir instalación, auditorías y las validaciones afectadas y obtener evidencia de un run remoto del commit final.

Las fases 2–4 requieren ACK intermedio según AGENTS.md y el plan. Aprovisionamiento, presupuesto y migraciones persistentes requieren sus autorizaciones específicas.


## Continuación: eliminación de braces

Implementación sobre `4d0b612`, inicialmente local y luego publicada por el usuario como `3b98f64`; sin despliegue. Se retiraron Tailwind 3/autoprefixer y la cadena `fast-glob → micromatch → braces` usada por el lint de Next 15. Tailwind 4.3.3 usa su plugin PostCSS y `tailwind-merge` 3.7.0; conserva configuración TS y tokens HSL. Se ajustaron utilidades, alturas de línea responsive, container y fuentes/sombras semánticas del merge. Detalle y condiciones de retiro del adaptador: [seguridad de dependencias](05_dependency_security.md).

El adaptador CommonJS privado sólo implementa la llamada de directorios que usa el plugin de Next, mediante tinyglobby 0.2.17. Rechaza otras opciones. La prueba de CI verifica patrones, roots múltiples, espacios, rutas absolutas y la regla real de enlaces; no se desactivaron reglas de Next ni gates de seguridad. Las tres instrucciones COPY autorizadas permiten resolver el paquete local antes de cada `npm ci` Docker.

| Control de la continuación | Resultado |
| --- | --- |
| Lockfile | SHA-256 `eee48c3c70f96e83328531842a32dfe7e836f22c1329eed9a31619dabe8e2f9b`; regenerado por npm desde manifests y adaptador en un fixture limpio. |
| Instalación | `npm ci --prefer-offline` en línea aprobado; hash intacto y cero scripts sin revisar. Un intento offline carecía de un tarball; no se cuenta como aprobado. |
| Auditoría completa en línea | **0 altas, 0 críticas, 20 moderadas**; `npm audit --audit-level=high` termina con código 0 sin excepciones. `npm ls braces micromatch --all` no encuentra esos paquetes. |
| Auditoría de producción | `npm audit --omit=dev`: **0 vulnerabilidades**. |
| Firmas | **1347 paquetes de registry y 287 attestations** verificadas; el adaptador local se revisa como código del repositorio. |
| Tipos y build host | Ambos workspaces aprobados; Next 15.5.27 genera 27 páginas. |
| Docker API | Build aprobado con las dos instrucciones COPY autorizadas; Trivy 0.74.0: **0 altas/críticas**; SBOM CycloneDX: **439 componentes**. |
| Docker web | Build aprobado con COPY autorizado; Trivy 0.74.0: **0 altas/críticas**; SBOM CycloneDX: **112 componentes**. |
| Smoke final | Ambas imágenes aprobadas con PostgreSQL/Redis descartables: salud, cuotas/login inválido, métricas protegidas, web, UID sin root, filesystem de sólo lectura, tmp/cache y apagado. |
| Workflow actual | YAML válido y `git diff --check` aprobado; actionlint corresponde a la validación histórica, no se repitió en esta continuación. |
| API completa | **68 suites, 471 pruebas aprobadas, cero omitidas** en la repetición final; ver incidencia intermitente documentada debajo. |
| Web | **24 archivos, 119 pruebas aprobadas, cero omitidas**; incluye cuatro pruebas del merge de clases. |
| Lint y adaptador | Lint aprobado con 13 advertencias existentes, cero errores; compatibilidad Next: 1 prueba aprobada, cero omitidas. Las importaciones require del adaptador CommonJS tienen una excepción de estilo local justificada. |

La comparación en Chromium del build final conserva las medidas de login desktop (formulario 384×248, inputs/botón 384×48, título 152 px), tipografía de portada (título 323 px), tokens claros/oscuros y foco de teclado con ring visible. En móvil, login no desborda (390 px, inputs 326×48). La portada ya desbordaba antes: ancho de contenido 497 px con viewport 390 px, igual después; requiere corrección y aceptación de UI posterior, no se presenta como una regresión resuelta por esta migración. Tailwind 4 requiere Safari 16.4, Chrome 111 o Firefox 128 como mínimo.

En la primera suite API completa, 470 pruebas pasaron y falló la aceptación del replay BI inmediatamente después de restaurar LOGIN del warehouse (503). La reproducción aislada pasó sus cinco escenarios. Se agregó el código de error a la aserción sin cambiar el contrato ni introducir reintentos, sleeps o nuevas omisiones. La repetición completa aprobó: **68 suites, 471 pruebas, cero fallos y cero omisiones**. La causa del 503 de la primera corrida no se confirmó; se conserva como incidencia intermitente a observar en el run remoto, sin declarar una corrección de reconexión inexistente.

La revisión remota de la implementación se completó en el run documentado debajo. Dependency Review queda condicionado a PR y la protección de main pertenece a fase 4. Esta preparación no acredita la demo remota; las fases siguientes conservan sus ACK.

Identidad de la imagen API de la continuación: Docker `sha256:b235d945c73a50ff4e69c7d0cf64c8061e6b5d245093d43472c8a4ff05d81165`; configuración escaneada `sha256:85223f1f12d29a73cd6d9474e7c2f4addf98b9cde72d5752a3a2c6f1d9831dde`. Se verificó la coincidencia de sus nueve capas DiffID con el tar y el reporte Trivy. El primer escaneo terminó por SIGTERM después de descargar la base; la repetición usó esa base actualizada con paralelismo 1 y aprobó, sin montar socket Docker.

Identidad web de la continuación: Docker `sha256:b0dd9e3055a8268449cee60d24ea1fcba237afc295fb373146afde5001ddb9ae`; configuración escaneada `sha256:9b05ec3c0c7e7808f5d69a198ef30fab547ccb5c418df20e995ec30740b02b6a`. Las capas y la configuración del tar coinciden con el reporte. Son identidades locales, sin publicación. Los contenedores de smoke se eliminaron al finalizar; los tres servicios descartables y los tar de escaneo también se eliminaron al cerrar la sesión. Se conservan las imágenes y reportes locales para revisión.


## Verificación remota de la implementación

El usuario publicó la implementación en `main` como `3b98f64dcf0f81ede916263c74d5d43c9cd7571f`, con árbol local limpio al retomar. [CI 38097512213](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38097512213), disparado por push el 2026-10-10, terminó **success**. `verify` aprobó entre las 21:10:17 y las 21:18:40 ART (8 min 23 s); `secret-scan` aprobó en 13 s. Dependency Review se omitió por diseño al no ser un pull request; no contar esa omisión como una revisión aprobada. La protección de main y los despliegues siguen pendientes de las fases correspondientes.


El artefacto remoto `api-test-results` confirma 68 suites y 471 pruebas aprobadas, cero fallos y cero tests/suites pendientes. Los cinco escenarios de `bi-system.integration.spec.ts` aprobaron, incluida recuperación tras pérdida de acceso del warehouse y restauración de backup con permisos. Una corrida remota aprobada no demuestra ausencia de intermitencias.

Seguimiento **BI-RECOVERY-001**: responsables, mantenedores del CMS; plazo, antes de la aceptación de fase 4. Conservar la primera incidencia local 503 tras restaurar LOGIN y observar su repetición en CI. Si reaparece, conservar el código de error incorporado a la aserción e investigar la reconexión; no resolverla mediante omisiones o reintentos automáticos de suites. No se aplicó cuarentena ni se debilitó el contrato de replay.


| Control remoto del SHA 3b98f64 | Resultado verificado |
| --- | --- |
| Dependencias | Instalación y lockfile sin cambios; auditoría alta/crítica aprobada sin excepciones, con 20 moderadas; 1347 firmas y 287 attestations verificadas. |
| PostgreSQL/BI | Clientes major 18, DDL sintético y migraciones de la base descartable aprobados. |
| Calidad | Tipos, lint, compatibilidad del adaptador, **471 pruebas API y 119 web**, cero omisiones API; builds de aplicaciones aprobados. |
| Contenedores | Builds API/web y smoke de producción aprobados. |
| Trivy 0.74.0 | Reportes descargados: **0 altas/críticas en ambas imágenes**, incluidos hallazgos sin parche; gate de imágenes aprobado. |
| SBOM | CycloneDX publicado: **439 componentes API y 112 web**. |
| Gate final | `Enforce image scan` y `Enforce dependency audit` aprobados; run completo `success`. |

Identidades construidas y escaneadas **en el runner**, distintas de las imágenes locales y sin publicar en registry:

- API: `sha256:4e2aa02edeccab7acdd664943b3288072dcb11def3f28da4683780a4e4295f23`.
- Web: `sha256:12fa8f651f554027b567b013d14cff8715f1fe1bbee5455f253cd6a7cd8db6a6`.

Los IDs de imagen de los reportes coinciden con los del log de build. Artefactos del run: [api-test-results](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38097512213/artifacts/11686791853) y [image-reports](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38097512213/artifacts/11686456688). El workflow solicita 14 días, pero la API de GitHub informa vencimiento **2026-10-14 00:10:14 UTC / 2026-10-13 21:10:14 ART** para ambos: retención observada cercana a tres días; su causa no se verificó. Las copias de revisión quedan en `/tmp/demo-ci-38097512213`, fuera del repositorio; no se copiaron logs completos al contexto versionado.

La fase 1 está validada localmente y en remoto para esta implementación. Esta actualización documental no modifica el código validado ni requiere repetir pruebas locales. Queda revisión humana y ACK antes de fase 2. Commit sugerido: `docs(ci): registrá la validación remota de la fase 1`.
