# Demo: preparación de servicios, conexiones y permisos

Fase 3 del [plan](../plan/2026-10-10_chore-preparacion-demo-completa.md), sobre `ddd3030`. Preparación local; no acredita despliegue, aprovisionamiento, presupuesto ni migraciones persistentes. La fase 2 aprobó el [CI 38100197594](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38100197594): 474 pruebas API sin omisiones, gates de web/proxy, imágenes, auditoría y secretos. Los cambios de esta fase requieren su propio SHA/CI.

## Artefactos y autorización

| Propuesta revisable conservada | Archivo aplicado con ACK |
|---|---|
| [Parche API](demo/api-Dockerfile.patch) | [Dockerfile API](../../apps/api/Dockerfile): target `maintenance` separado y copia de cuatro scripts de runtime/preflight en runner. |
| [Railway API](demo/railway-api.json.example) | [infra/railway/api.json](../../infra/railway/api.json) |
| [Railway worker](demo/railway-worker.json.example) | [infra/railway/worker.json](../../infra/railway/worker.json) |
| [Vercel](demo/vercel.json.example) | [apps/web/vercel.json](../../apps/web/vercel.json) |

`AGENTS.md` exige ACK para infraestructura. Se recibió «Continuar» en respuesta a la solicitud acotada y los cuatro cambios se aplicaron el 2026-10-11. Los ejemplos y el parche se conservan como evidencia de lo aprobado; los SQL de bootstrap/grants siguen siendo propuestas sin ejecución persistente. Aplicar los cuatro archivos no autoriza publicar imágenes, contratar servicios, activar despliegues ni ejecutar SQL persistente. Compose, Dockerfile web, manifiesto raíz, lockfile y schema Prisma quedan fuera de esta autorización.

Los scripts `scripts/demo/` están separados de las entradas existentes de Compose. `runtime.mjs api|worker` prepara TLS/pools, elimina credenciales de migración y ejecuta el proceso compilado; reenvía SIGINT/SIGTERM y conserva certificados hasta terminar el hijo. No conecta al warehouse antes de arrancar el CMS ni ejecuta DDL. Sólo copia al runner `config.mjs`, `runtime.mjs`, `preflight.mjs` y `permissions.mjs`; las fixtures no son una entrada productiva.

## Servicios Railway

Raíz de build: repositorio completo. Seleccionar explícitamente el archivo de configuración de cada servicio desde la raíz; ambos usan `apps/api/Dockerfile`. API y worker reutilizan la misma imagen compatible, con entradas diferentes. Deshabilitar despliegue automático desde Git en la configuración del proveedor durante esta preparación; los JSON no certifican esa opción externa. En fase 4 promover digest validado y registrar deployment/configuración, sin recompilar silenciosamente durante la promoción.

| Servicio | Entrada | Supervisión |
|---|---|---|
| API | `node scripts/demo/runtime.mjs api` | Readiness real `/api/v1/health/ready`, timeout 120 s; incluye OLTP, no warehouse. Outbox y limpieza siguen en la API. |
| Worker continuo | `node scripts/demo/runtime.mjs worker` | Sin servidor HTTP ni cron; gate futuro mediante heartbeat protocolo 1 vigente en `etl.worker_health` y solicitud BI completada. `healthcheckPath: null` no demuestra salud. |
| Redis privado | Servicio independiente, URL sólo en API | Verificar autenticación, red privada y fallo controlado de cuotas/caché; no participa en entrega durable. |

Propuestas: una réplica, `sleepApplication: false`, reinicio `ON_FAILURE` con diez reintentos, `overlapSeconds: 0`, drenaje 330 s. El worker tarda hasta cinco minutos en drenar una carga activa; el ledger/lease recupera terminaciones forzadas. Confirmar que el plan del proveedor admite y aplica ese drenaje; el schema JSON no demuestra su comportamiento. Aunque overlap sea cero, presupuestar conexiones de versiones vieja/nueva durante el drenaje. No exponer el worker públicamente.

La [salida IPv6 de Railway](https://docs.railway.com/networking/outbound-networking) está deshabilitada por defecto y se activa **por servicio**. API, worker y futuro job de mantenimiento necesitan activación y redeploy autorizados para los endpoints directos Supabase. No se modificó esa opción remotamente. Config-as-code se valida con el [schema oficial](https://railway.com/railway.schema.json) y la [referencia Railway](https://docs.railway.com/config-as-code/reference).

## Web Vercel

Root Directory `apps/web`, framework Next.js, Node 24.x del proveedor; registrar versión efectiva y compatibilidad con Node 24.21.0 del repositorio. Activar **Include source files outside of the Root Directory**: instalación usa lockfile raíz, workspaces y adaptador local `apps/web/tools/next-lint-glob`. `installCommand` vuelve a la raíz para `npm ci`; `buildCommand` ejecuta el build del workspace web. La salida la detecta Next.js, sin export estático. Ver [monorepos](https://vercel.com/docs/monorepos/monorepo-faq) y [configuración](https://vercel.com/docs/project-configuration).

`git.deploymentEnabled: false` impide el CD automático del proyecto propuesto. Mantener explícitamente separado el entorno de demo de previews. Configurar `NEXT_PUBLIC_API_URL=/api/v1` y `API_BACKEND_ORIGIN` con origen HTTPS fijo de Railway, en build y servidor; sólo la primera variable es pública. Cambiar origen requiere rebuild/redeploy trazable. No entregar secretos DB, JWT, Redis o Cloudinary a Vercel. El [runbook del proxy](25_demo_same_origin_proxy.md) conserva cookies, Origin/CSRF, bloqueo interno y no-store; aceptación HTTPS y cargas de 14 MiB en Vercel siguen pendientes.

## Variables externas por identidad

Inyectar desde gestores del proveedor; no guardar valores en `.env` del repositorio, contexto, argumentos de consola, SQL, imágenes o reportes. Los CA son certificados públicos, nunca claves privadas. Descargar los CA oficiales de cada proyecto y revisar huella/vigencia por canal confiable; rotación requiere reiniciar con configuración revisada.

| Destino | Variables / responsabilidad |
|---|---|
| API | `NODE_ENV=production`, `PORT` provisto por Railway, `CORS_ORIGIN` exacto de la web, `TRUST_PROXY_HOPS=0`; `DATABASE_URL` para `cms_runtime`. |
| API con BI completo | `BI_ENABLED=true`, `BI_OPERATIONS_ENABLED=true`, `BI_DATABASE_URL` para `bi_api_reader`, `BI_CONTROL_DATABASE_URL` para `bi_control`. Durante instalación/mantenimiento mantener controles apagados hasta validar esquema y worker. |
| Worker | Sólo `BI_SOURCE_DATABASE_URL` para `bi_source_reader` y `BI_ETL_DATABASE_URL` para `bi_etl_writer`; no necesita banderas HTTP, Redis, JWT, Cloudinary ni claves de métricas. |
| API/worker | `SUPABASE_OLTP_HOST`, `SUPABASE_WAREHOUSE_HOST` distintos; formato directo `db.<project-ref>.supabase.co`. `OLTP_CA_PEM` y, cuando corresponda, `WAREHOUSE_CA_PEM`. |
| API, secretos de aplicación | `JWT_SECRET`, `API_KEY_PEPPERS_JSON`, versión activa; `WEBHOOK_SECRET_KEYS_JSON`, versión activa; `METRICS_TOKEN`; `REDIS_URL` privado. Conservar claves anteriores durante ventanas de rotación y restauración compatibles. |
| API, proveedores | Variables Cloudinary actuales, preset revisado, credencial firmada para logos y limpieza; `CLOUDINARY_LOCAL_PLACEHOLDER=false`. `YOUTUBE_API_KEY` backend para metadatos cuando corresponda; reproducción no depende de ella. |
| Migración OLTP | Identidad exclusiva `cms_migrator` en `DATABASE_URL` del job de mantenimiento; nunca en el servicio API. |
| Migración warehouse | Identidad exclusiva `bi_migrator` en `BI_MIGRATION_DATABASE_URL` del job; nunca en worker/API. |

Las variables legadas `*_LEGACY_STARTED_AT` se configuran según los runbooks de corte existentes, con fechas reales del primer despliegue compatible; no inventar una fecha ni reiniciar la ventana en cada despliegue. `runtime.mjs` elimina credenciales no utilizadas antes de lanzar el hijo; esto no sustituye separar variables y permisos en cada servicio del proveedor.

## Supabase: versión y TLS

Dos proyectos dedicados independientes, transaccional y warehouse. El [changelog Supabase](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) documenta versiones 15/17 gestionadas; no asumir que PostgreSQL 18 local implica disponibilidad hospedada. El código BI usa `transaction_timeout`, disponible desde [PostgreSQL 17](https://www.postgresql.org/docs/17/runtime-config-client.html). El preflight acepta 17/18, rechaza 15 y versiones futuras sin verificar. Se ensaya 17 localmente; comprobar la versión concreta del proveedor antes de autorizar DDL.

Conexión directa, puerto 5432, base `postgres`, TLS con validación estricta de CA/hostname. La normalización rechaza pooler, proyectos cruzados, identidades incorrectas, parámetros desconocidos/duplicados, schemas ajenos e intentos de desactivar TLS. Prisma 6.5 usa `sslmode=require&sslaccept=strict&sslcert=<ruta-absoluta>`: `require` solo no basta porque su aceptación predeterminada permite certificados inválidos. No copiar `sslmode=verify-full` de psql a Prisma. Ver [Prisma v6 PostgreSQL](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql) y [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).

El wrapper materializa cada CA en un directorio temporal privado y archivo modo 0600; cierra y elimina al terminar. Tiempo de conexión/pool: 5 s. No usar pooler transaccional para el worker con locks de sesión ni para migraciones. Estos límites no representan un SLO remoto.

| Conexión | Pool máximo |
|---|---:|
| CMS runtime | 5 |
| Extractor OLTP | 1 |
| Lector warehouse API | 2 |
| Control warehouse API | 2 |
| Escritor warehouse | 2 |

Total estable: 6 OLTP y 6 warehouse. Presupuestar hasta 12 por proyecto durante reemplazo con dos versiones, más mantenimiento/preflight (un cliente activo por identidad), conexiones administrativas y servicios internos. Verificar `max_connections`, límites reservados del proveedor y uso real antes de activar réplicas; el preflight informa el máximo, no certifica capacidad disponible.

## Roles y Data API

Los cuatro SQL de `demo/` son propuestas exclusivas para **proyectos nuevos dedicados**, sin ejecutar sobre recursos persistentes. Bootstrap crea identidades NOLOGIN sin contraseña, sin membresías elevadas, sin CREATEDB/CREATEROLE/BYPASSRLS. No es idempotente: si existen roles, detener y revisar, no resetear permisos ajenos. Los migradores reciben CREATE sobre su base/schema y son dueños de sus objetos; runtime no es miembro de ellos. Un operador habilita LOGIN y establece SCRAM externamente, sin introducir contraseñas en SQL o historial. Desactivar LOGIN de migradores fuera de la ventana de mantenimiento.

Orden futuro, con ACK específico del entorno: revisar extensiones existentes (`pgcrypto`, `pg_stat_statements`, `uuid-ossp`) y habilitarlas como administrador gestionado si faltan; bootstrap; migraciones con su identidad propietaria; grants; preflight. No otorgar privilegios de administrador al migrador para sortear una extensión faltante. Las migraciones mantienen sus checksums.

| Rol | Acceso efectivo |
|---|---|
| `cms_runtime` | DML de las 27 tablas CMS según uso; catálogos necesarios para registro con upsert. Permisos, relaciones de permisos y eventos webhook sólo lectura; auditoría SELECT/INSERT. USAGE de cinco secuencias necesarias, no todas. |
| `bi_source_reader` | SELECT de cuatro vistas `bi_export`; sin SELECT directo de usuarios/PII. |
| `bi_api_reader` | SELECT de diez tablas `dw` y seis controles técnicos `etl`; sin escritura. |
| `bi_control` | Preferencias SELECT/INSERT/UPDATE; solicitudes SELECT/INSERT y UPDATE sólo `status`, `finished_at`, `error_code`; auditoría SELECT/INSERT; runs/estado/heartbeat sólo lectura. |
| `bi_etl_writer` | DML staging/dw, secuencias dw; runs/estado/preferencias/heartbeat SELECT/INSERT/UPDATE; solicitudes SELECT/UPDATE; ledger sólo SELECT. Sin escritura de auditoría ni INSERT de solicitudes. |

Bootstrap revoca default grants del propietario hacia PUBLIC/anon/authenticated/service_role. Grants revoca permisos sobre objetos CMS/BI conocidos y secuencias de sus schemas; por eso no se aplica sin revisión a proyectos compartidos. No concede acceso automático a futuras tablas. El preflight inspecciona privilegios **efectivos** de tablas/columnas/secuencias, propiedad, membresías, CREATE, funciones SECURITY DEFINER ejecutables y accesos de roles Data API. No hace cambios ni reemplaza la autorización por `tenant_id` de NestJS: no se incorpora RLS de aplicación en esta fase.

Deshabilitar **Enable Data API** en la integración Data API de **ambos proyectos**, según [documentación oficial](https://supabase.com/docs/guides/api/securing-your-api). Revocar grants es defensa adicional; la inspección SQL no puede demostrar el interruptor del dashboard. Registrar evidencia redactada y rechazos REST reales en fase 4. El [cambio de default grants Supabase](https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically) no revoca exposiciones existentes ni sustituye esa deshabilitación. No entregar claves anon/service_role al frontend.

## Preflight y mantenimiento separados

Después de inyectar variables externas en un entorno autorizado:

```sh
node scripts/demo/preflight.mjs api --offline
node scripts/demo/preflight.mjs worker --offline
node scripts/demo/preflight.mjs api --connect
node scripts/demo/preflight.mjs worker --connect
```

Offline valida configuración sin red. Connect abre una conexión por identidad, transacciones READ ONLY, timeout de consultas 5 s y transacción 15 s; emite sólo nombres de conexión, versión, máximo y códigos. Un error devuelve código 1 sin imprimir URL ni mensajes originales de Prisma. Sólo inspecciona base ya preparada; `providerAcceptance` permanece pendiente. Un resultado verde no acredita Data API/IPv6/ingress remoto ni permisos del rol migrador.

La imagen de mantenimiento propuesta hereda el builder, incluye Prisma CLI/schema/migraciones OLTP y SQL/CLI warehouse, ejecuta como `node` y **falla sin comando explícito**. Su directorio es `/app/apps/api`. El runner actual conserva Prisma como dependencia peer incluso con `--omit=dev`; no se afirma que carezca de CLI. Carece de los SQL warehouse y credenciales migradoras; la restricción DDL se verifica en la base mediante los roles. Después de un ACK de migración persistente, las entradas a pasar a su ENTRYPOINT `node` serían:

```text
/app/node_modules/prisma/build/index.js migrate deploy --schema=/app/apps/api/prisma/schema.prisma
/app/apps/api/dist/modules/business-intelligence/migration.cli.js --apply --to 0004_bi_operations.sql
```

Son referencias de operación futura, no se ejecutaron. Cada job necesita sólo su credencial migradora, CA público montado en ruta absoluta, URL TLS estricta y pool1; no usa el wrapper de roles runtime. No configurar `preDeployCommand` ni DDL en arranque. La imagen maintenance contiene dependencias de desarrollo y requiere SBOM, escaneo/gate e identidad propios antes de publicarse en fase 4; el escaneo aprobado de la imagen runner anterior no la cubre. Backfill/cierre temporal en un warehouse existente requiere su procedimiento separado y ACK.

## Validación local y pendientes

Comandos reproducibles desde la raíz, con API ya compilada y Prisma generado:

```sh
node scripts/demo/config.test.mjs
node scripts/demo/runtime.test.mjs
node scripts/demo/permissions.integration.mjs
git apply --reverse --check docs/operations/demo/api-Dockerfile.patch
```

La integración crea **dos PostgreSQL 17 descartables** con TLS y publicación sólo loopback/puertos aleatorios; usa DDL sintético generado desde schema actual y SQL warehouse en fixtures vacías. No ejecuta `prisma migrate deploy`/`db push`, ni valida historial de migración productivo; el ledger sintético usa checksum placeholder identificado como fixture. Limpia clientes, contenedores y certificados al terminar. No usar servidores o credenciales persistentes. CI incorpora estas pruebas después del build; no omite la integración si falta Docker.

Resultados locales 2026-10-11: 14 pruebas de configuración aprobadas; una prueba de proceso/SIGTERM aprobada; integración TLS/perfiles aprobada con registro real de repositorio, analytics/auditoría, configuración/cancelación/aceptación BI, ejecución ETL y lectura de snapshot publicado. Rechazados: lectura de usuarios por extractor, cambios a heartbeat/actor por control, DDL runtime, TLS ausente/CA incorrecta/hostname incorrecto, membresía elevada y concesión Data API por columna. Los permisos iniciales contenían una secuencia inexistente; se corrigieron conforme al schema y se agregaron analytics/auditoría. La inspección inicial por nombre exigía USAGE de schemas ajenos; ahora usa OID, sin ampliar grants. La fixture respetó la versión inicial 1 de preferencias provisionadas. La prueba de señales aprobó fuera del aislamiento de procesos; se limpiaron sus procesos tras los intentos bloqueados localmente.

Railway API/worker y Vercel validan contra schemas oficiales descargados, sin dependencias nuevas. `git apply --check` aprueba el parche (SHA-256 `395e1c8ca4e56b747cfaeba88d67ed382d8f5698ffe270206021a0f228534166`). Builds locales maintenance/runner aprobados usando exactamente ese parche sin aplicarlo al Dockerfile activo. Inspección con red deshabilitada/root filesystem de sólo lectura: usuario node UID1000; maintenance incluye CLI/SQL y rechaza entrada vacía; runner incluye ETL y cuatro scripts cuyos hashes coinciden con las fuentes, excluye la fixture de integración/SQL warehouse y falla ante configuración incompleta. Una comprobación inicial suponía erróneamente que npm retiraba Prisma del runner; se corrigió la expectativa según el filesystem, sin ampliar el parche. Identidades locales, sin publicación: maintenance `sha256:c8409e2a005316a5dc4fc819956b440f6df689c70c5a0377477def3b4c041cc4`, runner `sha256:1939935074dc82a8fa29571e58e9ecb3afa729b07cb49fb249aa212ad4b33719`; no son identidades de un release remoto.

TruffleHog 3.97.5 sobre nuevos archivos y diff preparado, contenedor sin red/montaje de sólo lectura, `verified,unknown`, verificación de credenciales deshabilitada: salida0, cero hallazgos. No sustituye el gate de escaneo de commits del próximo SHA. `git diff --check` y sintaxis de scripts aprobados; no se cambiaron dependencias ni checksums de migraciones.

La preparación quedó registrada en `368db56ae0277ca34a96ba59022cd8a3c56c4744`; su [CI 38150470333](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38150470333) aprobó verify y secret-scan (dependency-review omitido por push). Se verificó expresamente el gate `Verify demo configuration, runtime and restricted database identities`, además de build API, smoke de imágenes y escaneo API. Los cuatro archivos de infraestructura aplicados después coinciden exactamente con las propuestas: JSON byte a byte y reverse-check del parche; schemas oficiales aprobados. No se repitieron las integraciones ni builds de una propuesta idéntica. Las identidades locales anteriores documentan el ensayo del contenido aprobado, no un build del futuro commit.

Quedan pendientes commit/revisión y CI del SHA final, aprovisionamiento/presupuesto, migraciones persistentes autorizadas, Data API off, IPv6/TLS real, capacidad/restore, credenciales/proveedores reales y aceptación HTTPS. **Ingress y cuotas por IP siguen siendo bloqueantes de aceptación multiusuario**: el wrapper exige `TRUST_PROXY_HOPS=0`, que agrupa por peer. Verificar limpieza de headers/caminos alternativos y diseñar atribución autenticada o confianza demostrada antes de cambiarlo; no aceptar headers de identidad/IP proporcionados por el visitante. Fase 4 permanece sin iniciar.

Commit sugerido para la aplicación de infraestructura: `build(deploy): configurá Railway y Vercel para la demo`.
