# Preparación de la demo completa

**Inicio:** 2026-10-10. **Estado:** en progreso. Plan autorizado en el chat; una fase por ACK.

## Contexto y Restricciones

- Conservar NestJS, autenticación propia, Prisma, aislamiento por tenant, outbox PostgreSQL y Cloudinary.
- Topología acordada: web/proxy en Vercel; API/pollers, worker BI y Redis en Railway; OLTP y warehouse en proyectos Supabase independientes. Dominios gratuitos.
- Referencias: `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, `docs/operations/23_bi_validation_and_release.md` y skill `cicd-pipeline-engineering`.
- Ejecutar una sola fase; mostrar evidencia y commit sugerido, detenerse y esperar ACK. No contratar recursos, desplegar ni ejecutar migraciones persistentes con esta autorización.
- `AGENTS.md` exige ACK específico para el manifiesto raíz, infraestructura, schema Prisma, hooks y ejecución de `prisma migrate deploy`/`db push`. No registrar secretos ni datos reales.
- No modificar checksums de migraciones existentes ni debilitar filtros tenant o gates de seguridad para conseguir un resultado verde.
- ACK posterior: resolver primero las dependencias de fase 1 mediante su migración. Se autorizaron exactamente tres instrucciones COPY del adaptador local en Dockerfiles: API deps, API production-deps y web deps; no otros cambios de infraestructura.
- ACK específico recibido en el chat: cambios acotados de dependencias/overrides/allowlist del manifiesto raíz y `prisma migrate deploy` sólo sobre los PostgreSQL descartables de fase 1. No alcanza bases persistentes ni las fases siguientes.

## [Completada] Fase 1 — CI confiable

- [x] Corregir la expectativa de recurso ajeno: NotFound, conservando Conflict para concurrencia.
- [x] Revisar dependencias afectadas y aplicar correcciones compatibles verificadas; documentar vulnerabilidades sin solución.
- [x] Configurar dos PostgreSQL descartables, Redis, DDL sintético y clientes de backup PostgreSQL 18 en CI.
- [x] Fallar ante configuración incompleta y pruebas omitidas en CI.
- [x] Fijar acciones por SHA; timeouts y cancelación de CI obsoleto, sin CD.
- [x] Validar instalación, tipos, lint, pruebas completas, builds y controles disponibles; registrar límites reales.
- [x] Resolver localmente el gate de auditoría alta/crítica sin excepciones.
- [x] Obtener un run remoto aprobado de la implementación final: `3b98f64`, CI `38097512213`.
- [x] Revisión humana y ACK para iniciar fase 2: «Continuar» recibido en el chat.

**Estado actual:** el bloqueo por `braces` se resolvió localmente migrando Tailwind a 4.3.3 y reemplazando el globbing del lint de Next 15 por un adaptador acotado con tinyglobby. Auditoría completa: 0 altas/0 críticas/20 moderadas; producción: 0 vulnerabilidades; gate alta/crítica aprobado sin excepciones. La implementación quedó publicada en `main` como `3b98f64dcf0f81ede916263c74d5d43c9cd7571f`. Su [CI remoto 38097512213](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38097512213) terminó aprobado el 2026-10-10. La fase 1 está validada técnicamente y recibió ACK humano para iniciar fase 2. No declarar demo lista.

**Evidencia:** [runbook de fase 1](../operations/24_demo_ci_preparation.md), con resultados históricos del commit `4d0b612` separados de la continuación local. Instalación, firmas, tipos, lint, 471 pruebas API y 119 web aprobados; cero omisiones. El runbook conserva el primer fallo BI intermitente y su repetición final aprobada; los cinco escenarios BI aprobaron también en remoto; el seguimiento BI-RECOVERY-001 conserva la incidencia local sin atribuir una causa no confirmada. Builds Docker, smoke y escaneos de ambas imágenes aprobados, sin altas/críticas; identidades y SBOM registrados en el runbook. La fase 1 quedó cerrada con ACK; la fase 2 está autorizada. Commit de la implementación: `3b98f64 fix(deps): eliminá la cadena vulnerable de braces`. Commit sugerido de esta evidencia documental: `docs(ci): registrá la validación remota de la fase 1`.

## [Completada] Fase 2 — Integración web/API

ACK de inicio recibido: «Continuar». No amplía permisos sobre infraestructura, manifiesto raíz ni migraciones.

- [x] Admitir `/api/v1` en el cliente y separar el destino backend del entorno público.
- [x] Incorporar el proxy externo, conservar Origin, cookies, CSRF, métodos y bytes del cuerpo.
- [x] Bloquear rutas internas, filtrar headers de identidad y evitar caché privada.
- [x] Verificar configuración, transporte y sesión con navegador real; distinguir pruebas locales de aceptación remota.
- [x] Registrar evidencia, límites y commit sugerido; detenerse para ACK de fase 3.

**Estado:** implementación de fase 2 y validación local completas. [Runbook](../operations/25_demo_same_origin_proxy.md): 161 pruebas web, 37 API afectadas, tipos/lint/builds y smoke HTTP standalone aprobados; 16 verificaciones de sesión en navegador real. Conserva Strict/HttpOnly/Secure, Origin/CSRF y bytes de cuerpos de 14 MiB. Skill CI/CD y seguridad, rollout y contexto actualizados.

**Límites:** aceptación HTTPS Vercel/Railway pendiente. El commit `67621707522465c700d0b98c5a7de61ff867ff6c` fue publicado, pero su [CI 38099725713](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38099725713) falló en `secret-scan`: una URI con credenciales sintéticas en `apps/web/src/middleware.test.ts` dispara el detector URI de TruffleHog. Se reprodujo el hallazgo con 3.97.5 y se corrigió localmente construyendo la URI durante la prueba, sin exclusiones ni cambios del gate. El nuevo commit `ddd3030` y su CI aprobaron posteriormente, según la evidencia de cierre debajo. Trust proxy predetermina 0; atribución de IP real/cuotas y restricciones del ingress se deben resolver/verificar en fases 3/4 antes de aceptar demo multiusuario. La fixture usa almacenamiento/servicio auth en memoria, no certifica persistencia, contraseñas ni Redis. No hubo migraciones, despliegues ni cambios de infraestructura/manifiesto.

**Commit sugerido:** `feat(proxy): conectá la web y la API por el mismo origen`.

- [x] Revisión/commit y CI del nuevo SHA; ACK humano antes de fase 3.

La corrección quedó publicada como `ddd30302c122bfbac8225ae4d5e1a9e214e0d779`. Su [CI 38100197594](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38100197594) terminó aprobado el 2026-10-10 (ART): verify y secret-scan; dependency-review omitido por push. Reporte API: 68 suites/474 pruebas aprobadas y cero omisiones. Tipos, lint, web, build relativo, smoke proxy, imágenes, smoke de contenedores, auditoría, firmas, SBOM y gates de escaneo aprobados. El fallo histórico de `6762170` se conserva como evidencia, resuelto por este nuevo SHA. ACK de inicio de fase 3: «Continuar» recibido después de publicar la corrección. No acredita aceptación HTTPS remota.

## [Actual] Fase 3 — Preparación de servicios y entrega

Configuración reproducible Railway/Vercel, roles/secretos separados, conexiones TLS/IPv6, pools acotados y Data API deshabilitada en Supabase. Sin contratación o aprovisionamiento implícitos.

- [x] Preparar y aplicar configuración reproducible API/worker y web, sin CD ni migraciones automáticas; ACK específico recibido.
- [x] Preparar permisos separados y comprobación de versión/TLS/pools/privilegios en fixtures descartables.
- [x] Documentar secretos externos, deshabilitación Data API y salida IPv6 por servicio; opciones remotas pendientes de aplicar/verificar.
- [x] Validar localmente los artefactos autorizados y registrar pendientes del entorno real.
- [x] Obtener ACK específico y aplicar los cuatro cambios de infraestructura; conservar los permisos acotados previos.
- [x] Entregar evidencia y commit sugerido; detenerse antes de fase 4.
- [ ] Publicar/revisar el commit final de infraestructura y comprobar su CI completo; recibir ACK para fase 4.

**Preparación local 2026-10-11:** [runbook de servicios](../operations/26_demo_services_preparation.md). Scripts runtime/preflight READ ONLY, TLS estricto Prisma6.5, cinco identidades restringidas y dos proyectos distintos; mínimo PostgreSQL17 por `transaction_timeout`. Aprobados 14 casos de configuración, proceso/SIGTERM, integración con dos PG17/TLS descartables (registro/analytics/auditoría y solicitud/cancelación/ejecución BI/snapshot), schemas JSON oficiales, builds e inspección de ambas imágenes propuestas, y escaneo redactado sin hallazgos. CI agrega los nuevos gates después del build; CI del nuevo SHA todavía pendiente. Sin migraciones persistentes ni recursos remotos.

**ACK recibido y aplicado 2026-10-11:** «Continuar» en respuesta a la solicitud acotada de infraestructura. Aplicado únicamente el parche `docs/operations/demo/api-Dockerfile.patch` a `apps/api/Dockerfile`; creados `infra/railway/api.json`, `infra/railway/worker.json` y `apps/web/vercel.json` desde las propuestas revisables. Verificación byte a byte de los JSON y reverse-check del parche aprobados; validación contra schemas oficiales aprobada. No autoriza SQL persistente ni despliegue/provisión. Ingress y cuotas por IP, IPv6/TLS y Data API reales, capacidad, restauración y aceptación HTTPS continúan pendientes.

**Entrega local terminada:** la preparación anterior quedó en `368db56ae0277ca34a96ba59022cd8a3c56c4744`; su [CI 38150470333](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38150470333) aprobó verify y secret-scan, incluido el nuevo gate de configuración/runtime/identidades restringidas; dependency-review omitido por push. Esa aprobación no cubre los cuatro cambios de infraestructura aplicados después. Fase3 permanece actual hasta revisar el commit final y su CI; fase4 no iniciada.

**Commit sugerido de esta continuación:** `build(deploy): configurá Railway y Vercel para la demo`.

**Seguimiento 2026-10-11:** los cuatro archivos quedaron publicados en `695828283b194e51da713eb0746aff640ff21f01`, junto con la skill Railway instalada. Su [CI 38151400859](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38151400859) aprobó `verify` completo, pero falló en `secret-scan`: dos candidatos MongoDB corresponden a una plantilla de variables de entorno en `use-railway/scripts/analyze-mongo.py`, sin credenciales literales. Se separó la interpolación de autenticación conservando el comando generado; cuatro casos de equivalencia y la expansión de argumentos con un `mongosh` simulado aprobaron. El archivo corregido no produce candidatos en TruffleHog 3.97.5 sin red/verificación y con `verified,unknown,unverified`. La validación remota del nuevo SHA sigue pendiente; no se excluyeron archivos ni se alteraron gates o historial.

**Alcance confirmado:** todavía no existen los proyectos Vercel, Railway ni los dos Supabase. Respuesta humana: «Todavía no; prepará la entrega sin crear recursos». La fase 4 podrá preparar la entrega una vez cumplido el gate de fase 3, sin aprovisionar, contratar, desplegar ni ejecutar migraciones persistentes.

El rango prospectivo de la corrección/documentación también aprobó TruffleHog con todos los candidatos en una copia Git temporal; sintaxis Python y `git diff --check` aprobados. Artefacto API del CI de infraestructura: 68 suites/474 pruebas aprobadas, cero omisiones. La skill CI/CD y `llm.txt` reflejan el bloqueo y el alcance sin recursos.

**Commit sugerido de la corrección:** `fix(ci): corregí el falso positivo de la skill Railway`.

**Publicación de la corrección:** autorización explícita recibida para publicar `codex/fix-railway-secret-scan` en este repositorio y abrir un PR borrador, sin merge ni despliegues. [PR #1](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/1): corrección `9741b7b` y formato `0ee1696ffaeedea118bb4664f911d38c3a6d2167`. El escaneo offline de ambos commits aprobó con todos los candidatos. El [CI del PR 38152713874](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38152713874) terminó aprobado en el intento 2: `verify`, `secret-scan` y `dependency-review`. El primer intento falló únicamente en Dependency Review porque Dependency Graph estaba deshabilitado. El usuario confirmó su habilitación; la API de comparación respondió y se reejecutó sólo el job fallido, sin cambiar gates. El reporte API confirma 68 suites/474 pruebas aprobadas y cero omisiones. La corrección está validada en el PR; faltan revisión, merge humano y CI del SHA resultante de `main` para cerrar fase 3. La fase 4 no comenzó.

**Continuación 2026-10-11:** el usuario integró el PR #1 como `4b5b587`. El [CI de main 38154039851](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38154039851) aprobó secret-scan, pero falló en una prueba API (473 aprobadas, una fallida, cero omisiones). La prueba de rotación suponía que iniciar dos llamadas juntas garantizaba leer la misma versión PostgreSQL. Se sincronizó la escritura de dos transacciones reales y se agregó un caso de rotación secuencial válida, sin alterar repositorio ni schema. Seis casos locales aprobaron sin omisiones; ocho ejecuciones dirigidas del caso sincronizado aprobaron; el control negativo sin predicado de versión falló con dos éxitos, y el código restaurado volvió a aprobar. Tipos y lint aprobados. Ver evidencia y límites en el runbook de servicios. El nuevo SHA requiere revisión, integración humana y CI; no avanzar a fase 4 con main rojo. Commit sugerido: `test(api-keys): sincronizá la prueba de rotación concurrente`.

## [Pendiente] Fase 4 — Despliegue controlado y aceptación

Workflow manual de SHA validado de main; identidad de artefacto, serialización, migraciones separadas y autorizadas, protección de rama, smoke tests y recuperación remota. Cada servicio externo requiere entorno y presupuesto confirmados.

## Aceptación final

Login/refresh/logout/CSRF, dos tenants y roles, captura/moderación/publicación, imágenes/logo/YouTube, webhooks y recuperación, BI durable y aislamiento OLAP, caída Redis, métricas protegidas y restauración/reversión compatibles. No declarar demo completa sin evidencia del destino real.
