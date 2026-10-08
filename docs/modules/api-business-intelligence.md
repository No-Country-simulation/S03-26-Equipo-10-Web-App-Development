# Contrato propuesto: Business Intelligence

**Fecha:** 2026-10-08. **Estado:** diseño; implementación en fases 3 y 4.

**Referencias:** [Plan HITL](../plan/2026-10-08_feat-foto-empresa-bi.md), [ADR 0004](../adr/0004-warehouse-postgresql-separado.md), [diccionario DW](../domain/warehouse_diccionario_de_datos.md), [borrador SQL](../plan/2026-10-08_feat-foto-empresa-bi_warehouse-borrador.sql).

## Fronteras y configuración

`apps/api/src/modules/business-intelligence/` contiene consultas BI y carga, con providers separados. La API HTTP sólo importa la parte de lectura; la entrada ETL crea únicamente configuración, logger, clientes y servicios de carga. No importar AppModule ni iniciar scoring, outbox, HTTP o Redis en ETL. El frontend compone `/admin/business-intelligence` desde su feature y usa `useSession`/adaptadores de respuesta vigentes.

| Variable propuesta | Consumidor | Uso |
| --- | --- | --- |
| `BI_ENABLED` | API HTTP | Default false; si false responder BI deshabilitado sin abrir conexión DW. |
| `BI_DATABASE_URL` | API HTTP | Identidad warehouse con SELECT exclusivamente sobre tablas BI/metadatos necesarios. |
| `BI_SOURCE_DATABASE_URL` | ETL | Identidad OLTP con SELECT sólo sobre columnas autorizadas de tenants, testimonios, categorías, catálogos y eventos. |
| `BI_ETL_DATABASE_URL` | ETL | Identidad DW con DML sobre staging/dimensiones/hechos/control; sin permisos DDL. |

No usar `DATABASE_URL` como fallback warehouse/extractor. Validar URLs PostgreSQL sin incluirlas en mensajes o logs. Cuando BI_ENABLED sea true pero el destino no sea accesible, el endpoint devuelve 503; la API operacional debe arrancar y mantener su readiness. Los errores de configuración BI no invalidan el esquema de configuración global de la aplicación.

Defaults ETL: páginas de 1 000 filas, una empresa a la vez, una conexión fuente y dos destino como máximo (trabajo y heartbeat). Origen: `REPEATABLE READ READ ONLY`, zona UTC, `statement_timeout=30s`, `lock_timeout=1s`, `idle_in_transaction_session_timeout=60s`, `transaction_timeout=5min` en PostgreSQL 18. Cancelar toda la carga de la empresa tras cinco minutos, incluida publicación. Destino: `statement_timeout=30s`, `lock_timeout=1s`; transacciones de publicación cortas y cancelables. Estos límites son un punto de partida medible, no una capacidad certificada.

La ejecución CLI acepta `--once` para prueba/manual y modo scheduler horario en UTC; al arrancar intenta la hora actual y después cada hora. Un único scheduler recorre empresas, con leases por tenant que protegen réplicas accidentales. No intenta fabricar cortes de horas previas. Las ejecuciones fallidas pueden reintentarse con un nuevo run mientras siga siendo la misma hora, máximo tres intentos por hora. Un éxito existente en esa hora se omite.

## Extracción, fencing y publicación

1. Enumerar únicamente IDs de empresas en el origen: operación explícita del proceso autorizado de exportación, sin exponer listado a la API BI. Cada lectura posterior de recursos propios filtra por tenant. Exportar también empresas inactivas para reflejar ese estado; la autenticación HTTP vigente decide su acceso.
2. En destino, crear/reclamar estado de carga por tenant en transacción corta. Si hay lease vigente o éxito en el slot, omitir. Marcar el run vencido anterior como `abandoned`; registrar intento nuevo y token. Lease de 90 segundos, heartbeat cada 20 segundos mediante la segunda conexión; no permitir renovar un lease ya vencido.
3. Abrir la transacción fuente. La primera consulta fija el snapshot y obtiene `date_trunc('milliseconds', statement_timestamp())` junto con nombre/is_active del tenant; ese instante es `source_snapshot_at`. Truncar a la precisión de origen evita redondear el último milisegundo hacia la hora siguiente. Si cae en otra hora que el slot reservado, abandonar y observar la hora corriente con un nuevo run. No usar `now()` del servidor destino como corte fuente.
4. Extraer categorías y testimonios por cursor UUID y eventos por cursor BigInt, ordenados y paginados **dentro de esa misma transacción**. Hacer joins de categorías/testimonios con tenant; catálogos globales por código. Los límites/cursor incluyen tenant. No usar `updated_at` ni el máximo ID como watermark de la próxima carga.
5. Insertar staging por lotes parametrizados, ligados a tenant/run. Antes de cada lote y después de esperas de red comprobar que el token sigue vigente. Todo timestamp fuente conserva su precisión. No convertir IDs BigInt a Number. Normalizar `source` en la consulta fuente mediante CASE: admitir `public`, `public-browser`, `api`, `widget`; otros valores se exportan como `other`. No transportar ni loguear el texto original arbitrario.
6. Al completar extracción, cerrar la transacción fuente y validar cantidades, duplicados y referencias. Si hay evento de otro tenant o referencia ausente, abortar con código técnico; no omitirlo silenciosamente. Excluir datos futuros respecto al corte no es una corrección silenciosa: reportarlos como origen inconsistente.
7. En una sola transacción destino, bloquear `tenant_load_state`, comprobar run/token/lease vigente y comprobar que el run sigue `running`. Si no cumple, abortar. Actualizar nombre/dimensiones, marcar testimonios y categorías ausentes, resolver «Sin categoría», insertar snapshot y agregar staging de eventos por fecha UTC/testimonio/origen/tipo.
8. Reemplazar **sólo** la serie diaria de interacción del tenant y registrar su run de reconciliación. Validar `SUM(event_count)` contra los eventos extraídos. Insertar fechas necesarias, marcar run `succeeded` con cantidades y fin, actualizar pointer `last_published_run_id`, limpiar staging y liberar lease, todo en la misma transacción.
9. El pointer no retrocede: un corte fuente menor o igual al último publicado no se publica. Si hay rollback, persisten dimensiones/hechos/pointer anteriores. Marcar el intento fallido sólo si el token continúa propio; no liberar el lease de otro worker. Cualquier resultado ambiguo tras commit se resuelve consultando el run/éxito del slot antes de reintentar.

Un run exitoso vacío actualiza el pointer y demuestra extracción completada. Si el proceso cae, el siguiente worker recupera el lease y abandona el intento incompleto; nunca mezcla staging de runs. La limpieza de staging abandonado se hace por tenant/run, tras confirmar estado terminal y ausencia de lease vigente.

El lease se mantiene en el destino, nunca bloquea escrituras OLTP. Un worker obsoleto puede dejar staging de su propio run, pero no publicar: el token y la fila bloqueada actúan como fencing. Usar parámetros para datos; el rol de lectura no recibe SELECT sobre passwords, texto, autores, URLs, ip_hash, tokens o notas.

## Endpoint del panel

`GET /api/v1/bi/dashboard?from=YYYY-MM-DD&to=YYYY-MM-DD`, con JwtAuthGuard/RolesGuard y roles `admin`, `editor`. Tenant exclusivamente de sesión. Rechazar query `tenantId` y claves desconocidas. Las fechas son fechas de calendario reales UTC, rango inclusivo, `from <= to`, máximo 366 días; fechas inválidas dan 400. `to` sólo: completar 29 días anteriores. `from` sólo: completar `to` con hoy UTC. Sin ambas: hoy UTC y 29 días anteriores. Rechazar `to` futura.

Leer el dashboard completo en una transacción warehouse `REPEATABLE READ READ ONLY` para que summary/series/metadatos no mezclen publicaciones. Respuestas mediante el envelope existente. Contrato de `data`:

| Campo | Forma / semántica |
| --- | --- |
| `range` | `{ from, to, timezone: 'UTC' }`. Etiquetar UTC en UI. |
| `summary` | `{ totalTestimonials: number, averageRating: number \| null, statuses: Array<{ code, count: number }>, views: string, clicks: string, plays: string, ctr: number \| null }`. Inventario/rating/estados del último corte publicado; interacciones del rango. |
| `testimonialSeries` | Una fila por día `{ date, snapshotAt: string \| null, total: number \| null, averageRating: number \| null }`. Último run exitoso cuya fecha fuente sea ese día; sin corte da NULL, nunca cero ficticio ni arrastre del día anterior. Corte vacío da total 0. |
| `engagementSeries` | Una fila por día `{ date, views: string, clicks: string, plays: string, ctr: number \| null }`. Conteos decimales como strings para no perder BigInt; día sin eventos da `'0'`, CTR NULL. |
| `categories` | `{ categoryKey: string, name: string, count: number, averageRating: number \| null }[]` del último corte; NULL fuente se presenta «Sin categoría». No sumar sobre joins con etiquetas. |
| `freshness` | `{ status: 'not_loaded' \| 'fresh' \| 'stale', sourceSnapshotAt: string \| null, lastPublishedAt: string \| null, historyStartedAt: string \| null, engagementHistoryStartedAt: string \| null, dataAgeSeconds: number \| null }`. |

`ctr` es porcentaje calculado con aritmética decimal antes de serializar, redondeado a dos decimales; puede superar 100 porque son eventos, no visitantes únicos. Conteos de testimonios se comprueban como enteros seguros antes de devolver Number. Convertir BigInt a texto decimal sin perder precisión en todo el transporte; categoryKey también se representa como texto.

`historyStartedAt` = mínimo corte de runs exitosos del tenant; `engagementHistoryStartedAt` = fecha mínima de interacción disponible en la última reconciliación, o NULL. `stale` si la edad del **corte fuente** supera 7 200 segundos. `lastPublishedAt` es el fin del run exitoso, diferente del corte fuente. Rango vacío no cambia la frescura del inventario. Empresa sin run: respuesta 200 `not_loaded`, resumen en cero y valores derivados NULL; el panel explica que espera la primera carga.

503 `BI_UNAVAILABLE` para destino caído/configuración ausente; `BI_DISABLED` si BI_ENABLED es false. No servir una respuesta de otra empresa como fallback ni ejecutar agregaciones en OLTP para resolver la caída. Mantener el endpoint operacional de analytics durante esta incorporación.

## Scoring y observabilidad

En fase 3, reemplazar el listado global de scoring por recorrido explícito de IDs de tenants habilitados. Para cada uno, llamar listado de publicados, `getEngagementCounts(tenantId, testimonialIds)` y `updateScores(tenantId, updates)` con filtros por tenant y estado pertinente. Probar que IDs de otro tenant no aportan métricas ni se actualizan. Conservar fórmula y comportamiento funcional de flags.

Métricas propuestas: duración/extracción/publicación, filas leídas, runs exitosos/fallidos/abandonados, lease perdido y edad del último corte. Usar estados/códigos como labels acotados; IDs tenant/run en logs estructurados técnicos, no labels Prometheus ilimitados. No registrar URLs de conexión ni datos exportados. El panel avisa atraso; la alerta operativa de atraso requiere activar monitoreo externo en despliegue.

## Permisos, compatibilidad y pruebas

Provisionar `testimonial_dw` fuera del runtime, con propietario/migrador independiente. Los scripts no contienen CREATE DATABASE, credenciales ni GRANT a PUBLIC. En origen, SELECT por columna sobre el allowlist; en destino, ETL puede DML en staging/dw/etl y usar secuencias, lector BI sólo SELECT sobre dimensiones/hechos y runs/estado. Nadie del runtime tiene superuser, CREATE o permisos de migrador. El acceso por tenant sigue siendo el contrato del proyecto sin RLS; conexiones BI nunca se entregan a empresas.

El SQL warehouse es aditivo y migra separado del Prisma OLTP. Mantener archivos numerados y ledger `etl.schema_migrations` (version/checksum/applied_at) exclusivamente bajo la identidad migradora; rechazar una versión aplicada cuyo checksum cambió. El runtime ETL no aplica DDL. Activar BI después de esquema y primera carga verificada; con BI_ENABLED=false, el CMS funciona sin destino. No modificar el ciclo de borrado ni procesar datos del outbox como una fuente histórica completa.

Probar aislamiento y FK compuestas, consistencia durante mutaciones, mismo slot duplicado, éxito vacío, publicación parcial y rollback, pérdida de lease, crash en cada borde, respuesta ambigua tras commit, borrados, categorías renombradas, fechas UTC/bisiestos, días sin corte, CTR cero, precision BigInt y orden estable. La prueba de carga compara p95/p99 de rutas OLTP críticas sin/con ETL, tasa de errores, CPU/IO, duración del snapshot y tiempo de publicación con dataset y recursos declarados. No habilitar producción si se excede el plazo de cinco minutos o los SLO acordados de la API; la ausencia de volumetría/SLO medidos debe quedar como evidencia pendiente.
