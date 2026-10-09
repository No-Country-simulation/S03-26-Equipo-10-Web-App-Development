# Warehouse y proceso de carga BI

**Estado (2026-10-08):** fase 3 implementada y probada en dos PostgreSQL 18.6 descartables. Panel, métricas, backup/restauración y benchmark local completados en fase 4; ver [validación y despliegue](18_business_intelligence_rollout.md). Migraciones persistentes, infraestructura y capacidad productiva pendientes. Este documento prepara la operación; no acredita un despliegue.

Referencias: [plan HITL](../plan/2026-10-08_feat-foto-empresa-bi.md), [contrato BI](../modules/api-business-intelligence.md), [diccionario dimensional](../domain/warehouse_diccionario_de_datos.md), [ADR 0004](../adr/0004-warehouse-postgresql-separado.md).

**Transición temporal:** 0002/0003, backfill y escritor/lector compatibles están implementados y probados localmente. El código actual requiere el esquema temporal; no iniciar ETL/dashboard con sólo 0001. Para evolucionar un historial existente, seguir el [procedimiento temporal](19_bi_snapshot_time_migration.md). La validación de capacidad y preparación final de despliegue quedan para la fase 3; el escritor anterior es incompatible con 0003.

## Artefactos y conexiones

- [Migración warehouse](../../apps/api/warehouse/migrations/0001_initial.sql): 15 tablas en `staging`, `dw`, `etl`; versionado independiente de Prisma. No hay FK entre servidores.
- [Migración de exportación OLTP](../../apps/api/prisma/migrations/20261008010000_bi_export_views/migration.sql): cuatro vistas `bi_export`. Permiten proyectar presencia de medios y normalizar fuentes sin conceder al extractor acceso a URLs ni al texto libre original.
- [Entrada ETL](../../apps/api/src/modules/business-intelligence/etl.cli.ts): configuración, logger y dos clientes Prisma independientes. No importa AppModule ni inicia HTTP, outbox, scoring o Redis.
- [Migrador warehouse](../../apps/api/src/modules/business-intelligence/migration.cli.ts): proceso manual separado; necesita `--apply` y credenciales propias. El ETL y el arranque HTTP no ejecutan migraciones.

| Variable externa | Identidad y alcance |
| --- | --- |
| `BI_SOURCE_DATABASE_URL` | Extractor OLTP: sólo SELECT sobre las cuatro vistas de exportación. |
| `BI_ETL_DATABASE_URL` | Escritor warehouse: SELECT/INSERT/UPDATE/DELETE sobre staging, dimensiones, hechos, runs y estado; USAGE de secuencias. |
| `BI_MIGRATION_DATABASE_URL` | Propietario/migrador del warehouse; exclusivamente durante mantenimiento autorizado. |
| `BI_DATABASE_URL` | Lector del endpoint BI y métricas técnicas, sólo SELECT; sin staging/ledger. |

No hay fallback a `DATABASE_URL`. Inyectar los valores mediante la configuración externa del entorno; no incluirlos en comandos versionados, documentación ni logs. La API transaccional no necesita las credenciales del ETL. El proceso limita los pools a una conexión de origen y dos de destino, con esperas de conexión/pool de cinco segundos.

En producción se rechazan URLs al mismo host/puerto/socket, aunque indiquen distintas bases. En cualquier entorno se rechaza el mismo servidor y base como origen/destino. Esta comprobación no identifica aliases DNS ni acredita separación física: verificar recursos separados durante el despliegue. Los relojes del proceso y ambos servidores deben estar sincronizados; un desacuerdo de hora abandona el intento reservado, nunca falsea el corte.

## Preparación autorizada

El administrador provisiona ambas instancias, `testimonial_dw` y las identidades fuera del runtime. Las identidades de aplicación no deben ser propietarias, superuser, tener CREATE ni heredar permisos privilegiados. Conservar revocados los permisos de PUBLIC sobre los esquemas/objetos nuevos. PostgreSQL sigue sin RLS: las identidades técnicas cubren múltiples empresas y toda consulta de sus recursos lleva `tenant_id`.

Aplicar la migración OLTP por el procedimiento de despliegue vigente, después de su ACK explícito. La cuenta propietaria de las vistas conserva acceso al origen; la identidad de extracción sólo ve su proyección. No concederle permisos sobre tablas `public.*`, ni pertenencia a roles como `pg_read_all_data`.

El siguiente SQL es un **borrador de concesiones** para identidades ya provisionadas y sin herencias privilegiadas. Revisar sus nombres/propietario con el administrador; no ejecutado contra un entorno persistente:

```sql
-- En OLTP, tras aplicar bi_export:
GRANT USAGE ON SCHEMA bi_export TO bi_source_reader;
GRANT SELECT ON bi_export.tenants, bi_export.categories,
    bi_export.testimonials, bi_export.analytics_events TO bi_source_reader;

-- En testimonial_dw, tras aplicar sus migraciones:
GRANT USAGE ON SCHEMA staging, dw, etl TO bi_etl_writer;
GRANT SELECT, INSERT, UPDATE, DELETE ON
    staging.categories, staging.testimonials, staging.analytics_events,
    dw.dim_date, dw.dim_tenant, dw.dim_testimonial, dw.dim_category,
    dw.dim_status, dw.dim_source, dw.dim_event_type,
    dw.fact_testimonial_snapshot, dw.fact_engagement_daily,
    etl.runs, etl.tenant_load_state TO bi_etl_writer;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA dw TO bi_etl_writer;

-- API BI y métricas de operación:
GRANT USAGE ON SCHEMA dw, etl TO bi_api_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA dw TO bi_api_reader;
GRANT SELECT ON etl.runs, etl.tenant_load_state TO bi_api_reader;
```

No conceder al escritor acceso a `etl.schema_migrations`, TRUNCATE ni DDL. El lector no recibe staging, escritura ni ledger. Las pruebas ejecutadas verifican denegaciones con identidades distintas; las concesiones efectivas de producción requieren su propia comprobación.

## Migración y ejecución

Los siguientes comandos se muestran para el operador; esta fase no los ejecuta sobre bases persistentes. Desde la raíz del monorepo y con las variables externas ya inyectadas:

```sh
# Sólo en warehouse nuevo vacío y tras ACK, con BI_MIGRATION_DATABASE_URL:
# Para un historial existente, seguir el procedimiento temporal: expansión, backfill y cierre.
npm run bi:migrate --workspace=@testimonial-cms/api -- --apply

# Carga manual única, con BI_SOURCE_DATABASE_URL y BI_ETL_DATABASE_URL:
npm run bi:etl --workspace=@testimonial-cms/api -- --once

# Scheduler UTC: intenta el corte actual y luego cada hora:
npm run bi:etl --workspace=@testimonial-cms/api

# Proceso compilado, tras build (no necesita ts-node):
npm run bi:etl:prod --workspace=@testimonial-cms/api
```

El migrador busca `warehouse/migrations` desde el directorio del workspace API. El artefacto de mantenimiento debe incluir esos archivos; en un warehouse nuevo vacío, el proceso compilado puede invocarse desde `apps/api` con `node dist/modules/business-intelligence/migration.cli.js --apply`, sólo tras el ACK correspondiente. En un historial existente usar `--to` y el procedimiento temporal. No se modificó la imagen Docker ni Compose. El ledger guarda SHA-256 del archivo exacto: repetir una versión idéntica no aplica DDL; modificar una ya aplicada se rechaza como `BI_MIGRATION_DRIFT`. Añadir una migración nueva para evolucionar el esquema. El parser inicial admite DDL con comentarios de línea y literales/identificadores entre comillas, no cuerpos dollar-quoted ni comentarios de bloque.

La carga procesa una empresa por vez y páginas de 1 000 filas en una transacción origen `REPEATABLE READ READ ONLY`. Filtra todos los recursos por empresa. Usa BigInt para IDs y conteos, y Decimal para score. El destino agrega interacciones, mantiene snapshots publicados y reemplaza sólo la serie de engagement de esa empresa. También publica empresas vacías o inactivas.

Lease: 90 segundos; heartbeat: 20 segundos; máximo tres intentos por empresa/hora. Bloqueo corto por empresa y token impiden ejecuciones superpuestas. La publicación comprueba la vigencia al inicio **y al final**; si vence durante las escrituras, todo revierte. El corte fuente debe avanzar respecto al último publicado. No se reconstruyen horas perdidas.

SQL por sentencia: 30 segundos; espera de lock: un segundo; transacciones destino: hasta 35 segundos. La carga completa de una empresa, incluida publicación, dispone de cinco minutos. El origen limita también el idle en transacción a 60 segundos. PostgreSQL 18 aplica `transaction_timeout`; si se agota cualquiera de esos límites se conserva el último resultado publicado. El pool puede agregar una espera previa de hasta cinco segundos para tomar conexión. SIGINT/SIGTERM interrumpen entre lotes; una consulta en curso termina bajo sus límites antes del cierre de clientes.

En modo `--once`, cargas fallidas producen salida 1. Scheduler y ejecuciones manuales emiten JSON con eventos `bi.etl_tenant_finished`, `bi.etl_cycle_finished` y, si termina por error, `bi.etl_stopped`; sólo IDs técnicos, estado, duración y código acotado. No registrar mensajes completos del driver, filas exportadas, leases, cadenas de conexión ni payloads. Se añade `bi.etl_phase_finished` para extracción/publicación completadas. Métricas y alertas propuestas: [runbook de fase 4](18_business_intelligence_rollout.md).

## Diagnóstico y recuperación

Consultar bajo la identidad de mantenimiento o lectura y con parámetros `tenant_id`: `etl.runs` registra estado, slot UTC, corte observado, inicio/fin y cantidades. Duración = fin menos inicio. Los conteos fuente se guardan después de completar extracción, antes de publicar; una publicación fallida conserva esos conteos y deja cantidades destino en cero. Si la extracción no terminó, los conteos fuente en cero no acreditan un origen vacío.

`etl.tenant_load_state.last_published_run_id` señala el único resultado vigente, incluso si está vacío. Un fallo revierte dimensiones, hechos y pointer; nunca deja una publicación parcial. Una respuesta de red ambigua se resuelve leyendo el estado durable del run antes de declarar fracaso o reintentar.

Si cae el proceso o el destino, no borrar leases/staging manualmente ni editar el pointer. Al recuperar servicio, ejecutar otra carga: si el lease sigue vivo, se omite; tras vencer se marca el intento anterior `abandoned`, se limpia sólo su staging y se reclama uno nuevo dentro del presupuesto de esa hora. El trabajador viejo no puede renovar, publicar ni liberar el lease nuevo. Si agotó tres intentos, corregir la causa y esperar el siguiente corte; no reiniciar contadores ni fabricar un éxito.

Los snapshots históricos conservan observaciones de testimonios borrados del origen. Engagement refleja sólo eventos aún disponibles tras reconciliación. No hay retención/purga automática. Backup/restauración y capacidad local: [runbook de fase 4](18_business_intelligence_rollout.md). La capacidad productiva sigue pendiente.

## Integración reproducible

Usar exclusivamente **dos servidores PostgreSQL 18 descartables**, sin datos reales. Inyectar `TEST_BI_SOURCE_DATABASE_URL` y `TEST_BI_WAREHOUSE_DATABASE_URL` como conexiones de administración de esos servidores. La suite crea bases y roles de nombres aleatorios, aplica fixtures mínimas/vistas y el DDL warehouse, ejecuta como extractor/escritor/lector restringidos y elimina bases/roles al finalizar. Necesita privilegios de CREATE DATABASE/ROLE en los servidores de prueba; no usar cuentas productivas. Sin ambas variables la suite se omite explícitamente.

```sh
npm test --workspace=@testimonial-cms/api -- --runTestsByPath \
  test/bi-postgres.integration.spec.ts test/bi-etl.spec.ts test/analytics.service.spec.ts
```

La fixture OLTP es mínima y sintética: esta evidencia comprueba PostgreSQL/Prisma, DDL, privilegios, publicación y scoring; no aplica toda la cadena histórica de migraciones operacionales ni representa volumen real. Registrar el número de tests ejecutados y omitidos. No se integra infraestructura CI/Compose en esta fase. La prueba comparativa local se ejecutó en fase 4; la certificación productiva de capacidad y aislamiento de recursos sigue pendiente. La suite incluye pg_dump/pg_restore contra otra base nueva: necesita ambas utilidades PostgreSQL en PATH.
