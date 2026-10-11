# Entrega de la demo mediante tags

Preparación de fase 4, 2026-10-11. **Entrega deshabilitada; no se crearon recursos, imágenes remotas, tags ni deployments.** Este runbook complementa [servicios y permisos](26_demo_services_preparation.md) y [proxy de mismo origen](25_demo_same_origin_proxy.md). No acredita una demo remota funcional.

## Estado y arquitectura

El [CI de main 38156809417](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38156809417) aprobó el commit `06186df8064e438101c79fb22d8ec4f3ce48408c`, después de integrar humanamente el PR #2. Cerró el fallo de la prueba de rotación concurrente, sin modificar producción. Cada SHA posterior requiere sus propios checks.

La entrega por tags se integró mediante el [PR #3](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/3) como `aeef546b0a7de1cb8beb6074779faf3b58fa808d`; su [CI de main 38160840942](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38160840942) aprobó. La corrección de maintenance se entrega en el [PR #4](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/4): implementación `124c50e`, [CI 38172308957](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38172308957) aprobado. El seguimiento de ese PR registra los checks del cierre documental y del SHA resultante de main; comprobar su integración y CI antes de activar.

Topología conservada: Next.js/proxy en Vercel; API NestJS con outbox y limpieza de logos, worker/scheduler BI independiente y Redis privado en Railway; OLTP y warehouse en dos proyectos Supabase; imágenes Cloudinary y videos YouTube. Se conservan Prisma y la autenticación propia. Supabase no aloja NestJS ni estos procesos persistentes.

Los archivos de entrega son:

| Archivo                              | Función                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `.github/workflows/ci.yml`           | Validación existente, pruebas de entrega, actionlint y build/smoke/SBOM/escaneo de maintenance              |
| `scripts/ci-smoke-maintenance.sh`    | Empaquetado de migraciones y CLI nativo offline, no root, sólo lectura y comando explícito                  |
| `.github/workflows/demo-release.yml` | Tag anotado → CI → imágenes/SBOM/escaneo/attestations → aprobación → API/worker → web candidata → promoción |
| `.github/workflows/demo-migrate.yml` | Migración manual de una base, con digest atestado y ACK del SHA/destino                                     |
| `.github/workflows/demo-recover.yml` | Recuperación manual de una entrega exitosa anterior, compatible con el esquema actual                       |
| `scripts/release/`                   | Gates, adaptadores de proveedores, evidencia y pruebas de fallos                                            |
| `.github/governance/`                | Políticas aplicadas a main y tags de versión                                                                |

## Protecciones aplicadas

Se verificaron y aplicaron en GitHub:

- `main`: PR obligatorio, checks `verify`, `secret-scan` y `dependency-review`, rama actualizada antes de integrar, resolución de conversaciones, protección también para administradores, sin force push ni borrado. El mínimo de aprobaciones formales es 0; el merge sigue siendo una decisión humana.
- Creación de `v*`: sólo administradores del repositorio, ruleset `demo-version-tag-creation`, ID `24885595`.
- Actualización/borrado de `v*`: bloqueados sin bypass, ruleset `demo-version-tag-immutability`, ID `24885597`. Para corregir una versión, publicar otro tag; no mover el anterior.

No se crearon GitHub environments. La variable de repositorio `DEMO_DELIVERY_ENABLED` no existe: el primer gate falla con `RELEASE_NOT_ARMED` antes de publicar o acceder a proveedores. No sustituir este bloqueo con `continue-on-error`.

## Contrato de una entrega

1. `push` de `v*` dispara el workflow; el gate exige formato `vMAJOR.MINOR.PATCH` con prerelease opcional, tag anotado cuyo destino directo sea un commit, pertenencia a `main` protegida y el CI más reciente de ese SHA en `main` terminado exitosamente. Verifica también los jobs `verify` y `secret-scan`; Dependency Review se exige al integrar el PR y se omite en el push de main.
2. Debe existir el environment protegido, con al menos un reviewer y políticas explícitas que permitan el ref de la ejecución. Un environment inexistente no se crea automáticamente desde el gate.
3. Construye `runner` y `maintenance` del SHA exacto, genera SBOM y bloquea vulnerabilidades HIGH/CRITICAL antes de publicarlas en GHCR. Registra los digests recuperables del registro y attestations del workflow hospedado en GitHub.
4. Espera aprobación del environment `demo` y vuelve a comprobar CI/protección antes de operar proveedores. Comprueba habilitación, esquema compatible para ese SHA, preflight declarado, IDs, dominios y proyecto Vercel existente. No crea ni enlaza proyectos implícitamente.
5. Verifica la attestation API; aplica la imagen por digest y configuración capturada al servicio API; espera su deployment concreto y readiness. Repite con el worker y verifica por SSH un heartbeat reciente del nuevo proceso en una transacción READ ONLY acotada.
6. Vercel compila producción con `/api/v1` y el destino esperado; publica con `--skip-domain`. Comprueba proyecto, SHA y estado de la candidata, readiness a través del proxy y bloqueo 404 de métricas internas. Sólo entonces promueve y comprueba el dominio canónico.

API y worker usan el mismo digest. Se captura en el manifest la sección `deploy` de `infra/railway/{api,worker}.json`; se aplica explícitamente al cambiar la imagen, porque un servicio basado en imagen no lee esos archivos del repositorio. Se exige una réplica, sin suspensión, wrapper del rol correcto, drenaje de 330 segundos y sin comandos de migración. Las actualizaciones automáticas de imagen quedan deshabilitadas.

La serialización `demo-delivery`, compartida por entrega, migración y recuperación, no cancela la operación activa. GitHub puede reemplazar una ejecución pendiente por otra nueva: no es una cola durable de solicitudes. Evitar despachar varias operaciones pendientes.

La entrega no es una transacción entre proveedores: un fallo puede dejar API/worker actualizados y la web anterior. Se detiene la promoción si falla un paso previo y se conserva evidencia; un fallo posterior a promover requiere recuperación manual. No se ejecuta rollback automático ni se revierte DDL.

## Activación futura: recursos y permisos

Confirmar presupuesto antes de aprovisionar; esta preparación no autoriza contratación. Completar el runbook 26 antes de activar:

- Crear los proyectos y servicios existentes esperados por los IDs; API y worker dedicados a imágenes GHCR, sin Git autodeploy ni otros actores cambiando sus deployments durante una entrega. Verificar acceso desde Railway al paquete GHCR: hacerlo público sólo si se aprobó su contenido, o configurar lectura privada con credencial de alcance mínimo fuera del repositorio.
- Habilitar IPv6 de salida en ambos procesos Railway, conexiones directas Supabase con TLS/CA estrictos, pools y PostgreSQL >=17; verificar compatibilidad real. Redis por red privada. Deshabilitar Data API en ambos proyectos Supabase y aplicar las identidades/grants separados del runbook 26.
- Configurar secretos de runtime sólo en los servicios que los consumen; no dar credenciales migradoras a API, worker ni web. Verificar Cloudinary, YouTube, CORS, cookies Secure/HttpOnly/Strict, Origin/CSRF, métricas y cuotas.
- Resolver y verificar confianza del ingress y atribución de IP para cuotas antes de aceptar uso multiusuario. `TRUST_PROXY_HOPS=0` sigue siendo el valor soportado por esta preparación; no aumentar hops ni confiar en headers del navegador para sortear el pendiente. La comprobación del proveedor puede requerir un cambio de código revisado y su propio CI.
- Crear el proyecto Vercel con framework Next.js y Root Directory `apps/web`. Configurar producción con `NEXT_PUBLIC_API_URL=/api/v1`, `API_BACKEND_ORIGIN` HTTPS fijo de Railway y el dominio gratuito canónico. Deshabilitar despliegues Git que puedan promover por fuera de este flujo. Verificar que el CLI prebuilt conserva el contrato del monorepo y que las protecciones de deployment permiten los smoke mediante `vercel curl`.
- Crear environments GitHub `demo` y `demo-migrations` con reviewers humanos. Usar políticas personalizadas: `demo` admite branch `main` para ejecución manual y tag `v*`; `demo-migrations` admite sólo branch `main`. Revisar quién puede aprobar y evitar el bypass de protección. Las credenciales se liberan sólo después de aprobación.
- Preparar un runner de mantenimiento confiable Linux x64 con Docker, Node compatible, `gh`, acceso GHCR y conectividad IPv6 a los endpoints directos Supabase. Etiqueta `demo-maintenance-ipv6`; preferir runner efímero dedicado. No ejecutarlo en PRs, no compartirlo con código no confiable y verificar limpieza tras cancelaciones. No está creado. Los runners hospedados sin IPv6 no alcanzan esa topología directa; no contratar un addon IPv4 implícitamente.
- Probar backup/restauración, permisos del migrador, compatibilidad de aplicación/esquema y procedimiento de detener ETL antes del DDL warehouse. La migración 0004 exige ausencia de runs/reservas activos; el workflow no detiene el worker automáticamente.

## Variables y secretos externos

No copiar valores secretos a issues, manifests, logs o archivos de contexto. Los nombres siguientes son el contrato, no valores de ejemplo.

| Alcance                      | Nombre                                                                                                | Condición                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Variable de repositorio      | `DEMO_DELIVERY_ENABLED`                                                                               | `true` sólo al autorizar activación; su ausencia bloquea todo el flujo                           |
| Variables environment `demo` | `DEMO_PROVIDER_PREFLIGHT_COMPLETE`                                                                    | `true` sólo con evidencia real del checklist anterior; no constituye una comprobación automática |
| Variable `demo`              | `DEMO_SCHEMA_READY_SHA`                                                                               | SHA completo cuyo esquema fue verificado compatible para entregar                                |
| Variable `demo`              | `DEMO_ROLLBACK_COMPATIBLE_SHA`                                                                        | SHA anterior compatible verificado antes de recuperar                                            |
| Variables `demo`             | `RAILWAY_PROJECT_ID`, `RAILWAY_ENVIRONMENT_ID`, `RAILWAY_API_SERVICE_ID`, `RAILWAY_WORKER_SERVICE_ID` | UUIDs; servicios API y worker distintos                                                          |
| Variables `demo`             | `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`                                                                  | Equipo/proyecto existentes comprobados por API                                                   |
| Variables `demo`             | `API_BACKEND_ORIGIN`, `DEMO_WEB_ORIGIN`                                                               | Origins HTTPS gratuitos `*.up.railway.app` y `*.vercel.app`, sin paths ni credenciales           |
| Secretos `demo`              | `RAILWAY_TOKEN`, `VERCEL_TOKEN`                                                                       | Alcance mínimo al destino; rotación externa; verificar permisos CLI/SSH antes de habilitar       |
| Variable `demo-migrations`   | `DEMO_MIGRATIONS_ENABLED`                                                                             | `true` sólo al autorizar operaciones persistentes                                                |
| Variables `demo-migrations`  | `SUPABASE_OLTP_HOST`, `SUPABASE_WAREHOUSE_HOST`                                                       | Hosts directos de dos proyectos distintos                                                        |
| Variables `demo-migrations`  | `OLTP_CA_PEM`, `WAREHOUSE_CA_PEM`                                                                     | Certificados CA públicos válidos, no claves privadas                                             |
| Secretos `demo-migrations`   | `OLTP_MIGRATION_DATABASE_URL`, `WAREHOUSE_MIGRATION_DATABASE_URL`                                     | Roles `cms_migrator`/`bi_migrator`, base postgres, TLS estricto y pool 1                         |

`GITHUB_TOKEN` efímero publica/verifica GHCR y attestations con permisos por job. El workflow no almacena un PAT de GitHub ni credenciales de bases de runtime en GitHub. `vercel pull` materializa entorno en el runner: `.vercel/` se ignora y elimina, y nunca forma parte de los artefactos. No incluir secretos de backend en Vercel.

Para el heartbeat, el environment `demo` requiere además el secreto `RAILWAY_SSH_PRIVATE_KEY` (clave dedicada sin passphrase, previamente registrada por un operador en Railway) y la variable `RAILWAY_SSH_KNOWN_HOSTS` (claves públicas verificadas de `ssh.railway.com` en formato known_hosts). No usar trust-on-first-use ni `ssh-keyscan` ciego. El workflow no registra claves.

Railway CLI 5.64.2 usa OpenSSH nativo. El token de proyecto permite selección/operación del servicio; no sustituye una identidad SSH registrada. La prueba del worker suministra `--identity-file` para evitar registro interactivo, fuerza BatchMode/StrictHostKeyChecking y elimina sus archivos temporales incluso al fallar. Los subprocesses reciben sólo el token del proveedor que ejecutan; el build Vercel no hereda Railway ni la clave SSH. Ver [SSH oficial](https://docs.railway.com/cli/ssh).

## Primera entrega y migración

Este procedimiento es futuro y requiere recursos, presupuesto y autorización específicos. No se ejecutó durante la preparación.

1. Integrar la preparación por PR y comprobar CI verde del SHA de main. Configurar recursos/environments manteniendo `DEMO_DELIVERY_ENABLED` ausente. Crear el primer tag anotado del HEAD de main; su ejecución automática fallará cerrada por entrega deshabilitada.
2. Con environments protegidos y permisos listos, autorizar `DEMO_DELIVERY_ENABLED=true`. Ejecutar manualmente **Demo release**, branch `main`, `release_tag` del HEAD y `prepare_only=true`. Publica imágenes y `demo-image-evidence`, sin reservar el job de entrega ni bloquear la migración esperando una aprobación.
3. Obtener el digest maintenance del manifest. Con backup/restauración verificados y ETL detenido cuando corresponda, ejecutar **Demo migrations** desde main para cada destino por separado. Elegir tag, digest y confirmación exacta `APPLY <SHA completo> <oltp|warehouse>`; aprobar `demo-migrations`. Se verifica attestation y se ejecuta sólo ese migrador dentro de un contenedor no root, sólo lectura, sin capacidades adicionales. No usar credenciales de runtime.
4. Confirmar esquema/grants/preflight real, fijar `DEMO_SCHEMA_READY_SHA` al commit y marcar preflight sólo con evidencia suficiente. Ejecutar **Demo release** manual desde main con `prepare_only=false`, aprobar `demo` y completar aceptación. El build puede producir otros digests para el mismo SHA; no atribuir a un digest el escaneo de otro.
5. Para releases posteriores, preparar compatibilidad de esquema antes de publicar el tag. El push del tag inicia la entrega; las migraciones siguen siendo manuales. Cambios destructivos requieren expand/contract o un procedimiento de mantenimiento autorizado.

La publicación manual de imágenes exige tag del HEAD actual de main para que la procedencia de GitHub corresponda al SHA realmente construido. Para repetir un tag anterior, reejecutar su run original; no usar el dispatch de construcción desde otro SHA.

Comandos de versionado, una vez autorizado el despliegue y elegido un SHA validado:

```bash
git fetch origin main
git log -1 origin/main
# Reemplazá SHA_VALIDADO por el SHA completo cuyo CI de main aprobó.
git tag -a v0.1.0 SHA_VALIDADO -m 'Demo v0.1.0'
git push origin refs/tags/v0.1.0
```

## Recuperación y evidencia

**Demo recover** se ejecuta manualmente desde main. Requiere tag anterior, ID de un run exitoso de Demo release y `DEMO_ROLLBACK_COMPATIBLE_SHA` igual al SHA de ese tag; también aprobación `demo`. Descarga únicamente `demo-release-evidence` vigente del run, verifica identidad y attestation, reutiliza API/worker por digest con su configuración registrada y vuelve a promover el deployment Vercel existente después del smoke. No recompila la web ni ejecuta migraciones inversas. Si se eliminó el deployment, la imagen o el artefacto, falla cerrada: definir retención adicional antes de depender de recuperación de más de 90 días.

Artefactos con retención de 90 días: `demo-image-evidence` (manifest, SBOM y escaneos), `demo-release-evidence` (manifest y resultado público), `demo-recovery-evidence` y `demo-migration-evidence` (SHA, tag, base, digest, run/attempt y resultado del paso). Conservan SHA, tag, CI/run/attempt, digests, IDs de deployments, URL Vercel, eventos y códigos de fallo. No conservan entorno Vercel, URLs de conexión, cuerpos de errores de proveedor, credenciales ni logs crudos. Consultar el evento/estado fallido y la consola del proveedor con acceso autorizado para el diagnóstico; no publicar esos logs sin redactarlos.

## Aceptación y límites de la validación

La automatización comprueba identidad, estados de deployment, readiness, heartbeat BI y bloqueo del endpoint interno. No sustituye estas pruebas en HTTPS real:

| Prueba                                 | Evidencia exigida antes de aceptar demo completa                               |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| Registro, login, refresh, logout, CSRF | Navegador real sobre dominio Vercel, persistencia y cookies verificadas        |
| Dos tenants, admin/editor              | Sin acceso cruzado ni bypass de cuotas mediante headers                        |
| Captura, moderación, publicación       | Imágenes/logo Cloudinary y YouTube funcionales                                 |
| Webhooks                               | Reintentos y recuperación después de reiniciar la API                          |
| BI                                     | Solicitud durable, worker independiente, caída warehouse sin interrumpir CMS   |
| Redis, métricas, restauración          | Comportamiento degradado, rutas protegidas y restore ensayado                  |
| Entrega fallida y recuperación         | Promoción bloqueada, evidencia accionable y reversión compatible de aplicación |

Validación de preparación: 49 pruebas de gates/adaptadores sin proveedores aprobadas, cero omisiones; actionlint y build maintenance local aprobados. La imagen maintenance original heredaba herramientas de desarrollo/CLI Supabase: Trivy 0.74.0 informó 24 hallazgos HIGH. La propuesta mínima basada en runtime y cierre transitivo instalado de Prisma CLI aprobó con cero HIGH/CRITICAL, sin exclusiones, y se aplicó al Dockerfile activo con ACK posterior. Conserva migraciones/CLI compilados y elimina npm/Supabase CLI; el target final `runner` conserva el arranque API por defecto.

El CI construye y escanea maintenance además de API/web, conserva SBOM y reporte JSON en `image-reports` y bloquea **todas** las HIGH/CRITICAL de maintenance, aunque no tengan parche, igual que Demo release. El smoke `bash scripts/ci-smoke-maintenance.sh` ejecuta contenedores sin red, no root, con raíz de sólo lectura y `/tmp` efímero: compara hashes de los 19 archivos de esquema/migraciones contra el repositorio, carga el migrador BI y Prisma, ejercita el engine nativo de Prisma produciendo SQL offline sin aplicarlo y exige rechazo sin comando explícito. No se conecta a bases ni ejecuta DDL.

La imagen activa compilada localmente también aprobó el smoke y Trivy 0.74.0 con base actualizada: cero HIGH/CRITICAL, sin exclusiones; SBOM generado de la misma imagen exportada. El control negativo del gate extraído del workflow confirmó que una HIGH sin parche o un reporte maintenance ausente bloquean. El CI remoto `38172308957` repitió build/smoke/SBOM y aprobó el gate maintenance, además de 476 pruebas API sin omisiones y el resto de checks existentes. Cada commit posterior conserva esos checks como condición de integración.

Los adaptadores externos se prueban con respuestas simuladas: su contrato y acceso real deberán verificarse al activar. La aprobación de un SHA no se traslada a otro; consultar el CI del PR de cierre y, después de integrarlo, el CI de main antes de crear el tag.

Referencias primarias: [environments y aprobación GitHub](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/deploy-to-environment), [API de deployments Railway](https://docs.railway.com/integrations/api/manage-deployments), [Vercel deploy](https://vercel.com/docs/cli/deploy), [Vercel promote](https://vercel.com/docs/cli/promote), [conexiones Supabase](https://supabase.com/docs/guides/database/connecting-to-postgres).
