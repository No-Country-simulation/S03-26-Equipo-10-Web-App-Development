# Preparación de la demo remota

El plan de demo del 2026-10-10 acuerda Vercel, Railway, dos proyectos Supabase independientes y Cloudinary; YouTube sirve videos en testimonios. Esta guía no acredita despliegue ni autoriza recursos externos. Verificar capacidades, versiones, límites y presupuesto al implementar cada fase.

## Topología previa a CD

| Componente       | Estado / destino                                                              | Decisión o evidencia necesaria                                                                                     |
| ---------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Next.js          | Local; Vercel acordado.                                                       | Proxy local y CI de fase 2 aprobados; proyecto/equipo/root, workspaces/build y aceptación HTTPS remota pendientes. |
| NestJS y pollers | API, outbox y limpieza Cloudinary locales; Railway acordado.                  | Servicio persistente, reinicio, red, health checks y continuidad por validar.                                      |
| OLTP PostgreSQL  | Supabase previsto; PostgreSQL 18 local.                                       | Versión/DDL compatibles, red/pool, roles, migración autorizada y restauración.                                     |
| Redis            | Compose/CI, cuotas/caché; Railway privado acordado.                           | Cliente compatible, autenticación, red privada, límites y caída.                                                   |
| Warehouse y ETL  | Segundo proyecto Supabase y worker/scheduler Railway independiente acordados. | Instancia OLAP separada, roles independientes, scheduler y límites; caída OLAP aislada del CMS.                    |
| Cloudinary       | Subida y limpieza durable locales.                                            | Cuenta/configuración, permisos/cuota, lectura pública y poller activo.                                             |
| YouTube          | Parser/metadatos/reproductor locales.                                         | Video disponible/embebible, clave backend si requiere metadatos, CSP/red y navegador real.                         |

Comparar duración, payloads y scheduling de [Vercel Functions](https://vercel.com/docs/functions/limitations) con los pollers actuales. Atender peticiones no demuestra ejecución persistente. Un cron invocando endpoints no sustituye automáticamente estos procesos; requiere diseño y autorización propios.

## Supabase y Prisma

Conservar acceso NestJS y autenticación propia. Elegir Supabase PostgreSQL no implica Supabase Auth, Storage o acceso directo del navegador. El plan acuerda deshabilitar Data API en ambos proyectos y usar conexiones directas con TLS y salida IPv6 de Railway; verificar conectividad, permisos, pools y compatibilidad antes del despliegue.

- Revisar [changelog](https://supabase.com/changelog) y [guía Prisma](https://supabase.com/docs/guides/database/prisma). Los ejemplos actuales pueden usar configuración distinta a Prisma 6.5; no copiar `prisma.config.ts` ni cambiar versión/schema automáticamente.
- Para proceso persistente evaluar conexión directa si la red soporta endpoint, o pooler de sesión si lo requiere conectividad. Para serverless/autoscaling evaluar pooler transaccional, Prisma instalado, prepared statements y transacciones. Migraciones mediante conexión directa/sesión compatible, sin asumir pool transaccional apto para DDL.
- Dimensionar suma de pools API/pollers/ETL contra límites reales, verificar TLS/certificados; no deshabilitar seguridad ni registrar URLs con credenciales.
- Roles/credenciales separados: runtime con permisos necesarios y migrador DDL controlado; warehouse con roles de exportación, lectura y migración independientes. La guía genérica no justifica `createdb`, `bypassrls` o privilegios amplios para runtime.
- El CMS no usa Data API: deshabilitarla para sus tablas o mantener esquemas fuera de exposición y revisar grants/default privileges. Si se autoriza exposición, configurar RLS/políticas por tenant antes del acceso público; revisar vistas/funciones. `anon`/`authenticated` no deben saltarse la API. [Seguridad Data API](https://supabase.com/docs/guides/api/securing-your-api).
- No activar RLS sobre la aplicación existente automáticamente: diseñar impacto/permisos con plan aprobado. Ensayar migraciones sólo en recursos autorizados y obtener ACK para deploy/db push; no migrar desde cada instancia de arranque ni confundir rollback de app con reversión de esquema.

## Preparación reproducible de servicios

La fase 3 aplicó con ACK específico `infra/railway/api.json`, `infra/railway/worker.json`, `apps/web/vercel.json` y el parche de `apps/api/Dockerfile` con maintenance separado y cuatro scripts runtime/preflight en runner. Las propuestas aprobadas se conservan en `docs/operations/demo/`; bootstrap/grants sin contraseñas para proyectos nuevos dedicados siguen sin ejecutar en recursos persistentes. Preparación `368db56`/CI `38150470333` aprobados; los archivos de infraestructura posteriores requieren CI de su propio SHA. Ejecutar SQL persistente requiere autorización distinta. No usar bootstrap en proyectos compartidos ni arrancar runtime con identidad migradora.

Consultar [runbook de servicios](../../../../docs/operations/26_demo_services_preparation.md) para variables por servicio, permisos efectivos de tablas/columnas/secuencias, TLS estricto de Prisma 6.5, presupuesto de pools y verificación. `scripts/demo/permissions.integration.mjs` prueba dos PostgreSQL 17 descartables con TLS, registro/analytics/auditoría y solicitud BI/ETL con cinco roles restringidos. CI ejecuta estas pruebas después del build. No equivale a aplicar migraciones reales ni validar Supabase.

BI requiere PostgreSQL >=17 por `transaction_timeout`; conservar PostgreSQL18 local, verificar la versión hospedada. Los endpoints directos requieren IPv6 activado por servicio Railway. Deshabilitar Data API en ambos proyectos según el plan y comprobar por separado ese ajuste del dashboard; revocar grants no lo demuestra. Worker continuo sin HTTP/cron: readiness mediante heartbeat protocolo1 y trabajo completado, drenaje330s sujeto a soporte real del proveedor. Mantener `TRUST_PROXY_HOPS=0` hasta resolver/verificar ingress; agrupación por peer bloquea la aceptación multiusuario. La imagen maintenance requiere SBOM/escaneo/gate propios antes de su publicación en fase4.

## Entrega preparada por tags

Fase 3 cerrada con `06186df` y CI main `38156809417` aprobado. El usuario autorizó terminar la preparación de fase 4, difiriendo recursos y despliegue. Ver [runbook de entrega](../../../../docs/operations/27_demo_tag_delivery.md): tag anotado de main/CI aprobado, publicación GHCR con SBOM/escaneo y attestations; aprobación de environment; API/worker por digest y configuración registrada; candidata Vercel con promoción después del smoke. La modalidad manual `prepare_only` publica imágenes para bootstrap sin bloquear migraciones esperando aprobación de entrega.

Migración manual por base y SHA, con digest maintenance atestado, credencial migradora separada y runner confiable IPv6 dedicado aún no creado. Recuperación manual de una entrega exitosa compatible, reutilizando digest y deployment web, sin DDL inverso. Operaciones serializadas; un fallo puede dejar backend actualizado y web anterior, requiere evidencia y recuperación explícita.

Main protegido con PR y tres checks; tags v\* creación sólo admins y actualización/borrado bloqueados sin bypass. La entrega está apagada por ausencia de `DEMO_DELIVERY_ENABLED`; environments/proveedores no creados. Revisar aprobación, presupuesto, restauración, TLS/IPv6, Data API e ingress/cuotas reales antes de activarla. Las pruebas locales simulan proveedores y no acreditan aceptación remota.

## Vercel y seguridad web

Confirmar proyecto/equipo/root antes de operar; [vercel-cli](../../vercel-cli/SKILL.md) describe inspección y prevención de vinculación accidental. Consultar [monorepos](https://vercel.com/docs/monorepos) y runtime vigentes sin actualizar herramientas innecesariamente.

`NEXT_PUBLIC_API_URL` es pública, se procesa en build y determina `connect-src` en `next.config.mjs`. No reutilizar preview con API distinta sin verificar; registrar build/deployment específicos cuando cambie. [Variables públicas Next.js](https://nextjs.org/docs/app/guides/environment-variables).

La fase 2 prepara el proxy externo de mismo origen: `NEXT_PUBLIC_API_URL=/api/v1` y `API_BACKEND_ORIGIN` separado, sólo servidor. Conserva cookies actuales Strict/HttpOnly/Secure y CSRF; bloquea `/internal` y filtraciones de headers de identidad, sin caché compartida. No envolver imágenes de hasta 14 MiB en una Vercel Function sin revisar su límite de cuerpo. Consultar [runbook de proxy](../../../../docs/operations/25_demo_same_origin_proxy.md); la fixture HTTP/navegador local no acredita límites ni ingress del proveedor. La confianza en proxies predetermina 0 y las cuotas por IP agrupan al peer hasta verificar la cadena real.

Usar HTTPS y probar dominio real. Actualmente `CORS_ORIGIN` admite un origen: previews nuevos no quedan admitidos por defecto. Elegir dominio de demo o autorizar cambio de allowlist sin comodines con credenciales. Verificar cookies HttpOnly/Secure/SameSite, requests con credenciales, refresh y CSRF; dominios de proveedores distintos exigen revisar same-site y restricciones del navegador. CORS por sí solo no resuelve cookies. Leer [rollout de sesión](../../../../docs/operations/11_cookie_session_rollout.md).

## Cloudinary y YouTube

Inspeccionar adaptador Cloudinary y variables `CLOUDINARY_UPLOAD_URL`, `CLOUDINARY_UPLOAD_PRESET`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`; registrar sólo nombres y mantener credenciales externas/backend. No crear preset unsigned ni cambiar firma por defecto. Placeholder local está deshabilitado en producción y no demuestra integración. Probar subida/reemplazo/eliminación/limpieza durable, sin borrar activos compartidos al revertir app. [Subida Cloudinary](https://cloudinary.com/documentation/upload_images).

YouTube usa parser, `YoutubeService` y pantalla pública actuales: enlaces validados/normalizados, sin descarga ni subida/publicación a YouTube.

- `YOUTUBE_API_KEY` sólo en backend para metadatos; servicio retorna `null` sin clave o item. No es requisito de IFrame Player ni garantiza embed. [videos.list](https://developers.google.com/youtube/v3/docs/videos/list).
- CSP permite scripts/frames `www.youtube.com`, miniaturas `img.youtube.com`/`i.ytimg.com` e imágenes `res.cloudinary.com`. Verificar requests/bloqueos antes de ampliar orígenes; `youtube-nocookie.com` no está permitido por defecto.
- Probar reproducción tras interacción y video no disponible; privacidad, restricciones regionales, embed deshabilitado o navegador pueden bloquear un enlace válido. Preservar mensajes y apertura externa actuales. [YouTube IFrame API](https://developers.google.com/youtube/iframe_api_reference).

## Smoke tests del futuro despliegue

Datos sintéticos y activos de prueba identificados en entorno autorizado. Registrar commit, deployment, entorno, hora y resultado redactado; no credenciales ni contenido/autores reales.

| Escenario           | Resultado verificable                                                                                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Inicio/dependencias | Web/API saludables y OLTP/Redis según contrato; caída OLAP no bloquea readiness del CMS.                                                                                                             |
| Sesión/aislamiento  | Login, refresh, logout y mutación CSRF por HTTPS; segundo tenant sin acceso al primero.                                                                                                              |
| Testimonio público  | Captura/moderación/publicación con contenido/rating válidos y API remota.                                                                                                                            |
| Imágenes/logo       | Subida/lectura reales; reemplazo/eliminación y limpieza observables sin IDs privados expuestos.                                                                                                      |
| YouTube disponible  | Enlaces watch/corto, metadatos si configurados, miniatura y reproducción en navegador.                                                                                                               |
| YouTube fallido     | URL inválida rechazada; sin clave/sin item/error de metadatos y video no embebible tienen respuesta explícita vigente. Revisar casos por separado: error HTTP y `null` no garantizan mismo fallback. |
| Seguridad navegador | Sin bloqueos inesperados CSP/CORS/cookies; origen no autorizado y CSRF inválido rechazados.                                                                                                          |
| Polling durable     | Evento entregado, fallo transitorio con reintento acotado; reinicio no pierde ledger ni intención de limpieza.                                                                                       |
| BI                  | Scheduler/ETL/snapshot funcionan; caída warehouse aislada del CMS.                                                                                                                                   |
| Reversión           | Versión/configuración previas compatibles, datos/activos preservados y verificaciones repetidas.                                                                                                     |

Build/container local no acredita smoke tests remotos. Si faltan procesos persistentes, Redis, warehouse/scheduler o cuenta externa, registrar alcance parcial y dependencias pendientes; no declarar despliegue completo.
