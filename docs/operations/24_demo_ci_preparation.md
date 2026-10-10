# Preparación CI de la demo — fase 1

Revisión local del 2026-10-10. Plan: [preparación de la demo](../plan/2026-10-10_chore-preparacion-demo-completa.md). Esta evidencia corresponde al diff local; no acredita un nuevo run de GitHub Actions ni un despliegue remoto.

## Alcance y autorización

Se trabaja únicamente en CI confiable. ACK recibido para corregir dependencias/overrides/allowlist del manifiesto raíz y ejecutar migraciones en PostgreSQL descartables. No se modificaron schema Prisma, migraciones existentes, Dockerfiles, Compose ni hooks; no se operaron bases persistentes o proveedores de despliegue.

La topología acordada para las fases siguientes es Vercel con proxy de mismo origen, API/pollers y worker BI independientes en Railway, Redis privado en Railway y dos proyectos Supabase para OLTP/warehouse, conservando Cloudinary y YouTube. Esa integración todavía está pendiente.

## Cambios verificables

- El test de escritura en otro tenant exige `NotFoundError`; la transición concurrente mantiene `ConflictError`. No cambia el repositorio ni el aislamiento.
- CI incorpora un segundo PostgreSQL 18 descartable para warehouse, Redis BI separado por índice y el DDL sintético generado desde el schema existente mediante `prisma migrate diff`.
- `pg_dump` y `pg_restore` deben ser major 18, instalados desde PGDG, para ejecutar la prueba real de backup/restauración BI.
- El setup API falla en CI si falta alguna variable de integración, el DDL no es legible o ambas conexiones BI apuntan al mismo host/puerto. El reporte Jest además debe contener pruebas exitosas y cero omisiones de tests/suites; se conserva como artefacto durante 14 días, incluso si fallan las pruebas y existe el reporte.
- Todas las acciones del workflow se referencian por SHA completo. Se agregan timeouts y cancelación de validaciones obsoletas por PR/rama. Esto no fija por digest las imágenes de servicios ni todas las descargas internas de las acciones.
- Se conserva el bloqueo por auditoría alta/crítica, firmas, Dependency Review, secretos, smoke de imágenes y escaneo existente. `continue-on-error` de auditoría conserva su gate final.
- Next sigue en major 15, NestJS en 11, React en 18 y Tailwind en 3. Vitest 5 requiere configurar JSX automático mediante `oxc` con Vite 8. Detalle de paquetes/overrides: [seguridad de dependencias](05_dependency_security.md).

## Reproducción local autorizada

Usar exclusivamente dos servidores PostgreSQL descartables y un Redis descartable, accesibles sólo por loopback, sin volúmenes persistentes. Los fixtures BI crean bases y roles sintéticos; sus privilegios de administrador son sólo para estos servidores de pruebas, nunca para runtime remoto.

1. `npm ci`; comprobar que no cambie `package-lock.json` y que `npm install-scripts ls` no liste scripts pendientes.
2. Generar Prisma con `npm run db:generate --workspace @testimonial-cms/api`.
3. Generar DDL con `prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script` a un archivo temporal.
4. Con ACK específico, aplicar las migraciones OLTP exclusivamente a la base descartable con `npm run db:migrate --workspace @testimonial-cms/api`. No aplicar el schema OLTP al warehouse; los fixtures administran su propio esquema.
5. Configurar `TEST_DATABASE_URL`, `TEST_LOGO_DATABASE_URL`, `TEST_REDIS_URL`, `TEST_BI_SOURCE_DATABASE_URL`, `TEST_BI_WAREHOUSE_DATABASE_URL`, `TEST_BI_REDIS_URL` y `TEST_BI_BENCHMARK_SCHEMA_FILE`. Source y warehouse deben apuntar a servidores distintos. Para herramientas y smoke de contenedores, configurar también `DATABASE_URL` y `REDIS_URL` descartables.
6. Con `CI=true`, ejecutar API con `--json --outputFile=<reporte-temporal>` y revisar éxito y cero omisiones; luego web, tipos, lint, builds, auditoría y firmas según el workflow. Construir las imágenes existentes y ejecutar `scripts/ci-smoke-containers.sh` con las dependencias descartables.
7. Eliminar los contenedores de pruebas al terminar. No copiar URLs con credenciales, dumps ni logs completos al repositorio.

## Evidencia local

Base del diff: `91c619d63585df9f9b59d578df1eeee39f4e7afe`. Lockfile final SHA-256: `3cfbbca7f97c4ad8b9c532e10787f8847eae8d37e2773708b148800dca297729`. Son cambios locales sin commit ni publicación.

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

## Bloqueo de seguridad y condición de cierre

`npm audit` pasó de 41 altas/4 críticas a **7 altas/0 críticas**, con 20 moderadas. Las siete altas derivan de `braces@3.0.3`, sin parche publicado según [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), a través de Tailwind 3 y el lint de Next 15. `npm audit --omit=dev` todavía informa 5 altas por la cadena de peers de Tailwind en el monorepo; no confundir ese árbol con las imágenes finales.

El gate permanece rojo. La fase 1 no está aprobada ni habilita promoción. Hace falta un parche verificado o un cambio de alcance acordado para reemplazar/migrar esas dependencias; no aplicar downgrades automáticos, forks sin revisar ni excepciones silenciosas. Tras resolverlo, repetir instalación, auditorías y las validaciones afectadas y obtener evidencia de un run remoto del commit final.

Las fases 2–4 requieren ACK intermedio según AGENTS.md y el plan. Aprovisionamiento, presupuesto y migraciones persistentes requieren sus autorizaciones específicas.
