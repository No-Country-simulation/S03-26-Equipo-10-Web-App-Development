# BI: validación local y operación

**Estado:** fase 4 implementada y verificada localmente. No se modificó infraestructura ni se aplicaron migraciones persistentes. La habilitación productiva necesita ACK de mantenimiento y una prueba de capacidad con volumen, distribución, recursos y SLO acordados.

Referencias: [contrato](../modules/api-business-intelligence.md), [permisos y ETL](17_business_intelligence_etl.md), [plan](../plan/2026-10-08_feat-foto-empresa-bi.md), [resultado JSON](18_business_intelligence_benchmark.json), [benchmark reproducible](../../apps/api/test/bi-load-benchmark.ts).

**Transición temporal:** este runbook describe el sistema con 0001. La evolución 0002/0003 requiere el [procedimiento de mantenimiento temporal](19_bi_snapshot_time_migration.md) y un escritor compatible de fase 2, todavía pendiente. No aplicar todas las nuevas migraciones con el publicador anterior.

## API, panel y aislamiento

`GET /api/v1/bi/dashboard` usa sesión JWT y roles admin/editor; deriva la empresa de la sesión y rechaza `tenantId` y parámetros desconocidos. La pantalla `/admin/business-intelligence` usa el layout y menú administrativos, adaptador validado y transporte de sesión vigente. Sólo envía fechas. El inventario se obtiene del último corte; la serie diaria toma el último corte de cada día y mantiene NULL donde no hubo carga. Los eventos son strings decimales, con formato BigInt en el navegador; CTR sin vistas es «Sin datos».

La lectura completa se hace en una transacción `REPEATABLE READ READ ONLY`, UTC, pool de dos conexiones, máximo de espera transaccional de un segundo, sentencias de cinco segundos, locks de un segundo y transacción de diez segundos. La configuración no conecta durante startup. `BI_ENABLED` sólo habilita cuando vale exactamente `true`; URL inválida/ausente o caída del destino da 503 seguro. No hay fallback OLTP. El destino no se incorpora a readiness del CMS.

El benchmark verifica una caída real usando una base warehouse inexistente: BI responde **503**, liveness/readiness/listado operacional responden **200**. Las pruebas HTTP comprueban guards reales, rangos, respuesta privada, errores sin detalles del driver y token de métricas. La integración comprueba consultas con lector restringido, empresas distintas, días ausentes, último corte diario vacío y precisión superior a MAX_SAFE_INTEGER.

## Prueba de carga local

Ejecución registrada en el JSON: PostgreSQL 18.6, Node 24.21.0, dos procesos PostgreSQL en el mismo host de cuatro CPU lógicas y aproximadamente 8 GB RAM; `shared_buffers=32MB`, conexiones máximas 30/20. Dataset sintético inicial: **3 empresas, 12 000 testimonios y 60 000 eventos**. API pool 8, extractor 1, destino 2. Cuatro clientes de carga cerrada durante ocho segundos por ronda, alternando listado, analytics operacional, captura y aprobación. Se restablecen las capturas/aprobaciones entre rondas.

| Ruta | Sin ETL p95 / p99 (ms) | Con ETL p95 / p99 (ms) | Solicitudes sin / con ETL |
| --- | --- | --- | --- |
| GET testimonials | 63,49 / 91,73 | 102,53 / 156,02 | 136 / 90 |
| GET analytics/dashboard | 82,39 / 117,63 | 137,89 / 172,64 | 136 / 90 |
| POST testimonials | 123,35 / 150,61 | 163,56 / 232,00 | 136 / 89 |
| POST testimonials/:id/approve | 99,65 / 144,40 | 168,00 / 290,82 | 135 / 89 |

**Cero errores HTTP** en ambas rondas; las 358 solicitudes de la segunda coincidieron con el ETL. Tres empresas publicadas correctamente, ciclo **53,20 s**, máximo por empresa **20,005 s**, extracciones 2,17–4,76 s y publicaciones 14,06–15,09 s. Las cantidades exportadas incluyen las capturas visibles en el corte de cada empresa: la referencia inicial no implica que deban seguir siendo 12 000 durante la carga concurrente.

CPU Node acumulada: 11,13 / 8,27 segundos; RSS observado al finalizar ronda: 457,85 / 487,74 MB, sin afirmar que sea su pico. CPU de backends PostgreSQL: 4,49 s durante la ronda base y 4,37 s durante **todo el ciclo ETL**; ventanas diferentes, no comparables como porcentaje. Los contadores compartidos registran 113 601 / 126 640 hits adicionales, cero lecturas de bloque adicionales y cero bytes temporales. Son estadísticas acumuladas/asíncronas con caché caliente, **no medición de IO físico**. Los reportes previos variaron por contención local; este resultado final incluye la limpieza de staging antes del timestamp de finalización del run.

La carga usa AppModule, guards JWT/RBAC, repositorios y servicios reales; reemplaza Redis por un adaptador de prueba y genera DDL desde Prisma más las vistas de exportación. No aplica todos los CHECK/índices de la cadena histórica OLTP. El plan de una página de eventos usa bitmap scan por tenant y sort sobre 20 000 filas antes de LIMIT; revisar un índice `(tenant_id, id)` con EXPLAIN en una prueba representativa, mediante migración separada y ACK. No se añadió ese índice aquí.

La latencia aumentó y el throughput disminuyó. El ciclo cabe dentro de una hora **para este dataset local**; eso no acredita viabilidad productiva ni recursos aislados. Antes de habilitar: fijar presupuesto de latencia/error de las rutas críticas, probar datos y hardware representativos, medir disco/CPU/locks/autovacuum y duración completa. Si falla el presupuesto, mantener BI deshabilitado y sustituir reconciliación completa por extracción incremental verificable antes de desplegar.

Para reproducir, usar exclusivamente dos servidores descartables e inyectar `TEST_BI_SOURCE_DATABASE_URL` y `TEST_BI_WAREHOUSE_DATABASE_URL` de administración por configuración externa. Generar DDL sólo como artefacto local; no aplicarlo a un servidor existente:

```sh
node node_modules/prisma/build/index.js migrate diff --from-empty \
  --to-schema-datamodel apps/api/prisma/schema.prisma --script > /tmp/tms-bi-benchmark-schema.sql
```

Desde `apps/api`, con `TEST_BI_BENCHMARK_SCHEMA_FILE` apuntando a ese archivo:

```sh
../../node_modules/.bin/ts-node test/bi-load-benchmark.ts --run
```

Requiere HTTP local, PostgreSQL 18 y Linux `/proc`/`getconf` para CPU de backends. Crea bases aleatorias, ejecuta sobre ellas y las elimina al finalizar. No usar identidades productivas. El JSON no registra tokens, contraseñas, cadenas de conexión, textos ni autores; UUID de fixture del plan de consulta se anonimiza en el artefacto versionado.

## Observabilidad y alertas propuestas

`GET /api/v1/internal/bi/metrics` devuelve Prometheus sin envelope, `no-store`. Exige `X-Metrics-Token` configurado mediante `METRICS_TOKEN`, comparado en tiempo constante tras comprobar longitud. Sin token correcto devuelve 404 antes de consultar DW. Un JWT de administrador no sustituye ese token. Restringir la ruta a la red de monitoreo y TLS; el token permanece externo y el logger vigente lo redacta.

Esta ruta es un inventario global de operación explícito, separado de la API por empresa. No expone IDs/nombres de empresas ni labels de cardinalidad ilimitada. Usa la identidad de lectura y una transacción consistente con los mismos límites del panel.

| Métrica | Semántica |
| --- | --- |
| `tms_bi_etl_runs_total{status}` | Intentos terminales retenidos: succeeded/failed/abandoned. |
| `tms_bi_etl_running` | Runs aún marcados running, incluidos leases vencidos pendientes de recuperación. |
| `tms_bi_etl_source_rows_total{kind}` | Extracciones completadas retenidas, incluidas las de intentos fallidos/reintentos; no contar como publicaciones únicas. |
| `tms_bi_etl_lease_lost_total` | Intentos con error BI_LEASE_LOST retenidos. |
| `tms_bi_etl_duration_seconds` | Histograma durable de intentos terminales: 1/5/15/30/60/120/300/360/+Inf segundos, sum y count. |
| `tms_bi_oldest_snapshot_age_seconds` | Mayor edad del corte vigente entre empresas conocidas por ETL; cero si no existe ninguno. |
| `tms_bi_tenants_not_loaded`, `tms_bi_tenants_stale` | Empresas conocidas sin publicación o con corte de más de dos horas. |

Cada scrape reconstruye agregados desde el ledger: reiniciar la API no pierde los conteos. Purga futura/restauración antigua pueden reiniciarlos. No sumar copias de estos contadores entre réplicas HTTP: seleccionar un target lógico. Las consultas escanean el ledger; medir costo/índices con su crecimiento y mantener timeout. Si falla DW, scrape devuelve 503, nunca métricas de éxito ficticias. La métrica de empresas desconocidas hasta el primer claim no existe; comprobar también el inventario OLTP mediante operación autorizada.

El proceso ETL emite `bi.etl_phase_finished` al completar extracción/publicación con milisegundos y cantidades acotadas, además de sus eventos terminales y de ciclo. Fases fallidas se diagnostican por el run y código terminal; no emiten un timing de éxito. No publicar URLs/filas/secretos. Log de publicación incluye limpieza; histogramas durables usan el inicio y fin del run.

Propuestas para el operador, **no desplegadas**:

- `up{job="testimonial-bi"} == 0` durante diez minutos: destino/scrape inaccesible, configuración/token o timeout; correlacionar con health operacional.
- `tms_bi_tenants_stale > 0` durante quince minutos y edad > 7 200 s: carga atrasada. Consultar runs del tenant afectado con autorización y parámetro.
- `tms_bi_tenants_not_loaded > 0` durante dos horas: empresa sin primera publicación; revisar importación/permisos/lease.
- `increase(tms_bi_etl_runs_total{status="failed"}[2h]) > 0` o `increase(tms_bi_etl_lease_lost_total[2h]) > 0`: causa técnica/reintentos; el reset al restaurar requiere tratamiento de counters del monitoreo.

Asignar responsable, severidad y canal externo durante el despliegue. No se creó monitor, scheduler de infraestructura ni envío de mensajes.

## Habilitación con ACK del entorno

1. Registrar SLO y capacidad aprobados, ubicación de dos instancias con recursos independientes, relojes UTC sincronizados, TLS/red, backups y responsables. Separar credenciales extractor/escritor/lector/migrador y verificar permisos negativos del [runbook ETL](17_business_intelligence_etl.md).
2. Mantener `BI_ENABLED=false`. Aplicar migraciones OLTP de logo/vistas mediante el procedimiento vigente y migraciones DW mediante `bi:migrate -- --apply --to 0001_initial.sql`, sólo con ACK explícito. Verificar ledger/checksum y existencia de las cuatro vistas. HTTP/ETL nunca migran al arrancar. Para versiones posteriores, usar el procedimiento temporal enlazado arriba; el destino no revierte versiones ya aplicadas.
3. Ejecutar ETL `--once`. Conciliar conteos del origen en su corte, agregados diarios y snapshots por empresa, incluido origen vacío; comprobar pointer asociado a un run succeeded y ausencia de staging pendiente. No usar el estado OLTP de un instante posterior como si fuera el mismo corte.
4. Preparar backup/restauración y monitoreo, probar interrupción OLAP manteniendo liveness/readiness/captura/moderación operacionales. Revisar `BI_DATABASE_URL` como lector y denegación efectiva de escritura/staging/ledger. No entregar ninguna credencial al navegador.
5. Activar supervisor horario ETL y `BI_ENABLED=true` en HTTP mediante cambio autorizado del entorno. Reiniciar el proceso HTTP al cambiar esas variables (se leen al construir providers). Comprobar admin/editor de dos empresas, rangos, cortes/CTR, actualización y respuesta privada; revisar freshness tras dos horas.

La imagen actual no fue adaptada para contener el worker/migrador/SQL. Su empaquetado, red, recursos, secretos y supervision deben quedar revisados antes de activar; no iniciar ETL dentro del proceso HTTP.

## Backup y restauración

Realizar backup consistente de **toda** `testimonial_dw`, incluidos staging, dw, etl.runs, tenant_load_state y schema_migrations. Un dump PostgreSQL usa un snapshot consistente: nunca respaldar sólo hechos separadamente del pointer. Mantener también el historial de migraciones en el artefacto de mantenimiento. El backup no contiene texto/autores pero conserva identidad técnica de empresas; cifrar almacenamiento, restringir acceso y definir RPO/RTO y frecuencia con el operador. El corte horario no sustituye backup ni protege cambios desde el último respaldo.

Ejemplo para operador, con servicios PostgreSQL y autenticación externa ya configurados, después de ACK; no contiene credenciales:

```sh
PGSERVICE=testimonial_dw_backup pg_dump --format=custom --no-owner --no-acl \
  --file=/ruta/protegida/testimonial_dw.dump

# Destino vacío provisionado y propietario de restauración autorizados:
PGSERVICE=testimonial_dw_restore pg_restore --exit-on-error --no-owner --no-acl \
  --dbname=testimonial_dw_restore /ruta/protegida/testimonial_dw.dump
```

El perfil PGSERVICE de backup requiere lectura de todos los objetos de esta base y acceso a sus esquemas; no usar el lector HTTP, que carece de staging/ledger. Roles/passwords no se incluyen en el dump: aprovisionarlos externamente y reaplicar concesiones bajo mantenimiento. Verificar extensiones/tipos/versiones necesarios antes de restaurar; no usar `--clean` sobre la base en servicio.

Para recuperar: deshabilitar BI HTTP y detener **sólo ETL**, manteniendo el CMS. Restaurar en base nueva; verificar checksum del ledger, FK/índices, runs, último pointer, cantidad de snapshots y suma de eventos por empresa. Comprobar permisos de runtime en la restaurada; reconfigurar lectores/escritores mediante operación autorizada. Leases restaurados pueden esperar hasta vencer; no borrarlos manualmente. Reanudar ETL para un corte actual, sin inventar horas perdidas, y comparar frescura/conciliación antes de reactivar BI. El historial posterior al backup puede perderse: no afirmar recuperación completa sin PITR validado.

**Prueba ejecutada:** integración con pg_dump custom y pg_restore en otra base descartable PostgreSQL 18.6, hechos/cantidades/pointer comprobados y migración idéntica omitida por checksum del ledger restaurado. No mide RPO/RTO productivos ni recuperación PITR. Las bases y el archivo temporal se eliminan después.

## Retirada y seguimiento

Si falla aceptación productiva, deshabilitar BI y detener el supervisor ETL; preservar warehouse, snapshots y ledger para investigación. No revertir ni borrar datos/migraciones del logo ni del CMS como parte de una retirada BI. La API operacional puede seguir capturando y moderando; una nueva carga conciliará el estado actual al recuperar.

Medir crecimiento de snapshots/eventos/ledger, costo de scrape, tiempos de reconciliación y autovacuum antes de introducir retención, particiones o captura incremental. No hay purga automática ni minería textual/predicciones en esta entrega.
