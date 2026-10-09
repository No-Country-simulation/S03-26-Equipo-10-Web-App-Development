# Contrato: Business Intelligence

**Fecha:** 2026-10-09. **Estado:** warehouse/ETL/scoring, endpoint, panel, métricas y tiempo dimensional implementados; integración y operación verificadas localmente. Despliegue persistente no verificado.

**Referencias:** [Plan HITL](../plan/2026-10-08_feat-foto-empresa-bi.md), [ADR 0004](../adr/0004-warehouse-postgresql-separado.md), [diccionario DW](../domain/warehouse_diccionario_de_datos.md), [migración warehouse](../../apps/api/warehouse/migrations/0001_initial.sql), [operación ETL](../operations/17_business_intelligence_etl.md), [validación y despliegue](../operations/18_business_intelligence_rollout.md).

## Fronteras y configuración

`apps/api/src/modules/business-intelligence/` contiene configuración, repositorios y servicios de carga. La entrada ETL crea únicamente configuración, logger, clientes y servicios de carga. No importa AppModule ni inicia scoring, outbox, HTTP o Redis. La API HTTP importa exclusivamente providers de lectura; el worker mantiene su entrada independiente. El frontend compone `/admin/business-intelligence` desde su feature dentro del layout administrativo y usa los adaptadores/sesión vigentes.

| Variable | Consumidor | Uso |
| --- | --- | --- |
| `BI_ENABLED` | API HTTP | Default false; si false responder BI deshabilitado sin abrir conexión DW. |
| `BI_DATABASE_URL` | API HTTP | Identidad warehouse con SELECT exclusivamente sobre tablas BI/metadatos necesarios. |
| `BI_SOURCE_DATABASE_URL` | ETL | Identidad OLTP con SELECT sólo sobre las vistas allowlist `bi_export`; sin acceso a tablas privadas. |
| `BI_ETL_DATABASE_URL` | ETL | Identidad DW con DML sobre staging/dimensiones/hechos/control; sin permisos DDL. |
| `BI_MIGRATION_DATABASE_URL` | Migrador manual | Identidad propietaria independiente; nunca consumida por HTTP/ETL. |

No usar `DATABASE_URL` como fallback warehouse/extractor. Validar URLs PostgreSQL sin incluirlas en mensajes o logs. Cuando BI_ENABLED sea true pero el destino no sea accesible, el endpoint devuelve 503; la API operacional debe arrancar y mantener su readiness. Los errores de configuración BI no invalidan el esquema de configuración global de la aplicación.

Defaults ETL: páginas de 1 000 filas, una empresa a la vez, una conexión fuente y dos destino como máximo (trabajo y heartbeat). Origen: `REPEATABLE READ READ ONLY`, zona UTC, `statement_timeout=30s`, `lock_timeout=1s`, `idle_in_transaction_session_timeout=60s`, `transaction_timeout=5min` en PostgreSQL 18. Cancelar toda la carga de la empresa tras cinco minutos, incluida publicación. Destino: `statement_timeout=30s`, `lock_timeout=1s`; transacciones de publicación cortas y cancelables. Estos límites son un punto de partida medible, no una capacidad certificada.

La ejecución CLI acepta `--once` para prueba/manual y modo scheduler horario en UTC; al arrancar intenta la hora actual y después cada hora. Un único scheduler recorre empresas, con leases por tenant que protegen réplicas accidentales. No intenta fabricar cortes de horas previas. Las ejecuciones fallidas pueden reintentarse con un nuevo run mientras siga siendo la misma hora, máximo tres intentos por hora. Un éxito existente en esa hora se omite.

## Extracción, fencing y publicación

1. Enumerar únicamente IDs de empresas en el origen: operación explícita del proceso autorizado de exportación, sin exponer listado a la API BI. Cada lectura posterior de recursos propios filtra por tenant. Exportar también empresas inactivas para reflejar ese estado; la autenticación HTTP vigente decide su acceso.
2. En destino, crear/reclamar estado de carga por tenant en transacción corta. Si hay lease vigente o éxito en el slot, omitir. Marcar el run vencido anterior como `abandoned`; registrar intento nuevo y token. Lease de 90 segundos, heartbeat cada 20 segundos mediante la segunda conexión; no permitir renovar un lease ya vencido.
3. Abrir la transacción fuente. La primera consulta fija el snapshot y obtiene `date_trunc('milliseconds', statement_timestamp())` junto con nombre/is_active del tenant; ese instante es `source_snapshot_at`. Truncar a la precisión de origen evita redondear el último milisegundo hacia la hora siguiente. Si cae en otra hora que el slot reservado, abandonar y observar la hora corriente con un nuevo run. No usar `now()` del servidor destino como corte fuente.
4. Extraer categorías y testimonios por cursor UUID y eventos por cursor BigInt, ordenados y paginados **dentro de esa misma transacción**. Hacer joins de categorías/testimonios con tenant; catálogos globales por código. Los límites/cursor incluyen tenant. No usar `updated_at` ni el máximo ID como watermark de la próxima carga.
5. Insertar staging por lotes parametrizados, ligados a tenant/run. Antes de cada lote y después de esperas de red comprobar que el token sigue vigente. Todo timestamp fuente conserva su precisión. No convertir IDs BigInt a Number. Normalizar `source` en la consulta fuente mediante CASE: admitir `public`, `public-browser`, `api`, `widget`; otros valores se exportan como `other`. No transportar ni loguear el texto original arbitrario.
6. Al completar extracción, cerrar la transacción fuente y guardar sus cantidades en el run, antes de publicar. Validar cantidades, duplicados y referencias. Si hay evento de otro tenant o referencia ausente, abortar con código técnico; no omitirlo silenciosamente. Excluir datos futuros respecto al corte no es una corrección silenciosa: reportarlos como origen inconsistente.
7. En una sola transacción destino, bloquear `tenant_load_state`, comprobar run/token/lease vigente y que el run sigue `running`. Exigir que el instante recibido coincida con `source_snapshot_at` del run del mismo tenant. Actualizar dimensiones, marcar ausencias, resolver «Sin categoría» y crear calendario/cabecera/detalles con el mismo instante/fecha UTC, incluso con cero testimonios. FK compuesta protege tenant/run/instante/fecha; conciliar cantidad de cabecera, detalles y extracción.
8. Reemplazar **sólo** la serie diaria de interacción del tenant y registrar su run de reconciliación. Validar `SUM(event_count)` contra los eventos extraídos. Limpiar staging y obtener una única marca terminal, asignada al run `succeeded.finished_at` y a la cabecera `published_at`. Actualizar pointer `last_published_run_id` y liberar lease en esa misma transacción. Comprobar token, vigencia y plazo nuevamente al final: si vencieron durante las escrituras, revertir todo, incluida cabecera.
9. El pointer no retrocede: un corte fuente menor o igual al último publicado no se publica. Si hay rollback, persisten dimensiones/hechos/pointer anteriores. Marcar el intento fallido sólo si el token continúa propio; no liberar el lease de otro worker. Cualquier resultado ambiguo tras commit se resuelve consultando el run/éxito del slot antes de reintentar.

Un run exitoso vacío crea cabecera de cantidad 0, actualiza el pointer y demuestra extracción completada. Si el proceso cae, el siguiente worker recupera el lease y abandona el intento incompleto; nunca mezcla staging de runs. La limpieza de staging abandonado se hace por tenant/run, tras confirmar estado terminal y ausencia de lease vigente.

El lease se mantiene en el destino, nunca bloquea escrituras OLTP. Un worker obsoleto puede dejar staging de su propio run, pero no publicar: el token y la fila bloqueada actúan como fencing. Usar parámetros para datos; el rol de lectura no recibe SELECT sobre passwords, texto, autores, URLs, ip_hash, tokens o notas.

## Endpoint del panel

`GET /api/v1/bi/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`, con JwtAuthGuard/RolesGuard y roles `admin`, `editor`. Tenant exclusivamente de sesión. Rechazar query `tenantId` y claves desconocidas. Las fechas son fechas de calendario reales UTC, rango inclusivo, `from <= to`, máximo 366 días; fechas inválidas dan 400. `to` sólo: completar 29 días anteriores. `from` sólo: completar `to` con hoy UTC. Sin ambas: hoy UTC y 29 días anteriores. Rechazar `to` futura.

Leer el dashboard completo en una transacción warehouse `REPEATABLE READ READ ONLY` para que summary/series/metadatos no mezclen publicaciones. Pool máximo dos, `statement_timeout=5s`, `lock_timeout=1s`, `transaction_timeout=10s`, espera transaccional un segundo. Configuración/conexión lazy sin participar en readiness. Respuestas mediante el envelope existente y `Cache-Control: private, no-store`. Contrato de `data`:

| Campo | Forma / semántica |
| --- | --- |
| `range` | `{ from, to, timezone: 'UTC' }`. Etiquetar UTC en UI. |
| `summary` | `{ totalTestimonials: number, averageRating: number \| null, statuses: Array<{ code, count: number }>, views: string, clicks: string, plays: string, ctr: number \| null }`. Inventario/rating/estados del último corte publicado; interacciones del rango. |
| `testimonialSeries` | Una fila por día `{ date, snapshotAt: string \| null, total: number \| null, averageRating: number \| null }`. Última cabecera cuya fecha UTC sea ese día; sin corte da NULL, nunca cero ficticio ni arrastre del día anterior. Corte vacío da total 0. |
| `engagementSeries` | Una fila por día `{ date, views: string, clicks: string, plays: string, ctr: number \| null }`. Conteos decimales como strings para no perder BigInt; día sin eventos da `'0'`, CTR NULL. |
| `categories` | `{ categoryKey: string, name: string, count: number, averageRating: number \| null }[]` del último corte; NULL fuente se presenta «Sin categoría». No sumar sobre joins con etiquetas. |
| `freshness` | `{ status: 'not_loaded' \| 'fresh' \| 'stale', sourceSnapshotAt: string \| null, lastPublishedAt: string \| null, historyStartedAt: string \| null, engagementHistoryStartedAt: string \| null, dataAgeSeconds: number \| null }`. |

`ctr` es porcentaje calculado con aritmética decimal antes de serializar, redondeado a dos decimales; puede superar 100 porque son eventos, no visitantes únicos. Conteos de testimonios se comprueban como enteros seguros antes de devolver Number. Convertir BigInt a texto decimal sin perder precisión en todo el transporte; categoryKey también se representa como texto.

`historyStartedAt` = mínimo `snapshot_at` en cabeceras `dw.fact_tenant_snapshot` del tenant; `engagementHistoryStartedAt` = fecha mínima de interacción disponible en la última reconciliación, o NULL. `stale` si la edad del **corte fuente** supera 7 200 segundos. `lastPublishedAt` es `published_at` terminal de cabecera, igual al fin del run exitoso y diferente del corte fuente. Rango vacío no cambia la frescura del inventario. Empresa sin cabecera: respuesta 200 `not_loaded`, resumen en cero y valores derivados NULL; el panel explica que espera la primera carga.

DashboardRepository consulta exclusivamente `dw.*`: cabecera más reciente por instante/run para resumen y metadatos, última cabecera por fecha UTC para serie, detalles por tenant/run para rating/estado/categorías. Cantidades de cabecera no se suman tras joins. Horas ausentes no se reconstruyen. `run_id` y FK hacia control ETL permanecen como trazabilidad; métricas técnicas continúan leyendo `etl.*`. La independencia del dashboard se prueba con otro lector limitado a `dw`; la conexión runtime compartida conserva permisos técnicos.

503 `BI_UNAVAILABLE` para destino caído/configuración ausente; `BI_DISABLED` si BI_ENABLED es false. No servir una respuesta de otra empresa como fallback ni ejecutar agregaciones en OLTP para resolver la caída. Mantener el endpoint operacional de analytics durante esta incorporación.

## Scoring y observabilidad

Scoring recorre explícitamente IDs de tenants habilitados, reemplazando el listado global. Para cada uno, llamar listado de publicados, `getEngagementCounts(tenantId, testimonialIds)` y `updateScores(tenantId, updates)` con filtros por tenant y estado pertinente. Probar que IDs de otro tenant no aportan métricas ni se actualizan. Conservar fórmula y comportamiento funcional de flags.

`GET /api/v1/internal/bi/metrics` exige el token de operación vigente antes de consultar DW: no acepta un JWT como sustituto. Reconstruye contadores/histograma de intentos, filas extraídas, lease perdido y gauges de atraso desde el ledger, sin labels tenant/run. Es un inventario técnico global explícito, separado del dashboard por empresa. La duración incluye limpieza de staging; logs `bi.etl_phase_finished` registran extracción/publicación completadas. No registrar URLs de conexión ni datos exportados. El [runbook](../operations/18_business_intelligence_rollout.md) describe semántica, límites, alertas propuestas y reinicios de counters por restauración/purga. El panel avisa atraso; el monitoreo externo no está desplegado.

## Permisos, compatibilidad y pruebas

Provisionar `testimonial_dw` fuera del runtime, con propietario/migrador independiente. Las migraciones no contienen CREATE DATABASE, credenciales ni GRANT a PUBLIC. En origen, SELECT sólo sobre cuatro vistas `bi_export` con `security_barrier`, propiedad de la identidad que puede leer las tablas: convierten URLs a booleanos y fuente libre a catálogo antes de exportar. El extractor no tiene SELECT sobre tablas privadas. En destino, ETL puede DML en staging/dw/etl excepto `schema_migrations`, y usar secuencias; lector BI sólo SELECT sobre dimensiones/hechos y runs/estado. Nadie del runtime tiene superuser, CREATE o permisos de migrador. El acceso por tenant sigue siendo el contrato del proyecto sin RLS; conexiones BI nunca se entregan a empresas.

El SQL warehouse es aditivo y migra separado del Prisma OLTP. Mantener archivos numerados y ledger `etl.schema_migrations` (version/checksum/applied_at) exclusivamente bajo la identidad migradora; rechazar una versión aplicada cuyo checksum cambió. El runtime ETL no aplica DDL. El código actual requiere 0001/0002/0003; para historial existente usar [expansión/backfill/cierre](../operations/19_bi_snapshot_time_migration.md) con workers detenidos. No iniciar el escritor anterior tras 0003. Activar BI después de esquema y primera carga verificada; con BI_ENABLED=false, el CMS funciona sin destino. No modificar el ciclo de borrado ni procesar datos del outbox como una fuente histórica completa.

Probar aislamiento y FK compuestas, consistencia durante mutaciones, mismo slot duplicado, éxito vacío, publicación parcial y rollback, pérdida de lease, crash en cada borde, respuesta ambigua tras commit, borrados, categorías renombradas, fechas UTC/bisiestos, días sin corte, CTR cero, precision BigInt y orden estable. La prueba de carga compara p95/p99 de rutas OLTP críticas sin/con ETL, tasa de errores, CPU/IO, duración del snapshot y tiempo de publicación con dataset y recursos declarados. No habilitar producción si se excede el plazo de cinco minutos o los SLO acordados de la API; la ausencia de volumetría/SLO medidos debe quedar como evidencia pendiente.
