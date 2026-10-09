# Tiempo dimensional BI: validación y preparación operativa

**Fecha:** 2026-10-09. **Alcance:** fase 3 del [plan temporal](../plan/2026-10-08_refactor-bi-tiempo-dimensional.md). Pruebas y mediciones locales descartables; sin despliegue persistente. [Procedimiento de mantenimiento](19_bi_snapshot_time_migration.md).

## Comparación del modelo

[Ejecutor reproducible](../../apps/api/test/bi-snapshot-time-benchmark.ts) y [resultado completo](20_bi_snapshot_time_benchmark.json), incluidos planes EXPLAIN ANALYZE/BUFFERS en JSON. Baseline congelado del commit `085d95b`, en fixtures exclusivas de benchmark: [lector](../../apps/api/test/fixtures/bi-dashboard-legacy.ts) y [publicador](../../apps/api/test/fixtures/bi-warehouse-legacy.ts). Sólo se adaptaron imports/nombres de clase; no se usa código legado en producción.

Historial sintético: **tres empresas, siete días, 160 cortes, 98 000 detalles y 4 200 agregados diarios de engagement**. Incluye cortes cada tres horas, categorías, una empresa siempre vacía, últimos cortes vacíos y un día ausente. Las consultas antigua/nueva se comparan sobre el mismo historial convertido, con paridad de JSON ignorando únicamente segundos transcurridos de edad. Publicación se compara sobre historias inicialmente equivalentes mediante clon de la base 0001 antes de convertir la otra.

Host compartido Intel i5-2400, cuatro CPU lógicas, aproximadamente 8 GB RAM, Node 24.21.0, PostgreSQL 18.6, `shared_buffers=32MB`, máximo 20 conexiones DW. Una ejecución, caché caliente y llamadas seriales. Son muestras sintéticas de este host; no prueban concurrencia ni capacidad productiva.

| Medición | Baseline | Modelo temporal | Con índices candidatos |
| --- | ---: | ---: | ---: |
| Dashboard p50, 300 muestras por variante | 19,59 ms | 20,40 ms | 17,33 ms |
| Dashboard p95 | 42,14 ms | 41,33 ms | 37,05 ms |
| Dashboard p99 | 50,05 ms | 51,79 ms | 47,88 ms |
| Publicación p50, 10 cortes de 1 000 testimonios/1 000 eventos | 395,74 ms | 434,63 ms | No medido |
| Publicación p95/p99, sólo 10 muestras | 422,63 ms | 468,39 ms | No medido |
| WAL de las 10 cargas, incluido staging/control | 20 178 920 bytes | 20 352 672 bytes | No medido |

Latencia del dashboard similar en esta ejecución; no se demuestra una mejora estadística ni se promete menor latencia por eliminar JOIN a `etl`. La publicación temporal agrega trabajo de cabecera, validación y conciliación. WAL es del cluster y puede incluir actividad de mantenimiento: no es una atribución exacta de bytes por columna. Con diez muestras p95/p99 de publicación son el máximo observado; no estiman colas extremas de producción.

## Backfill, espacio y locks

- Expansión: **50,27 ms**. Backfill completo: **30,85 s**. Cierre/validación: **530,85 ms**.
- 101 lotes no vacíos; intervalos p50 **284,99 ms**, p95 **437,10 ms**, p99 **501,08 ms**. Incluyen guard, conciliación y planificación del siguiente lote; no equivalen al tiempo exacto durante el que se retiene cada lock. El preflight por tenant se repite: el costo crece con historial y cantidad de lotes, sin promesa de escalado lineal.
- Detalle antes: **21 962 752 bytes** totales. Después de backfill y VACUUM normal: **38 215 680 bytes**. Nueva cabecera: **90 112 bytes**. La actualización crea versiones de filas, páginas y splits de índices; VACUUM permite reutilizar espacio, pero no reduce necesariamente el archivo. Este aumento incluye espacio retenido de la migración y no representa sólo el tamaño lógico de las dos columnas. Reservar margen en disco/WAL/backups y medir el entorno; no prescribir VACUUM FULL como parte del procedimiento.
- Se conserva límite SQL 30s, lock 1s, transacción 35s, y lotes de hasta 1 000. El backfill total puede durar más que una transacción. El fixture cabe en los límites; una ventana productiva debe sumar pausa, backup, validación, cambio de código/roles, prueba de carga y recuperación.
- Prueba de contención: otra transacción mantiene lock incompatible sobre control ETL. El backfill termina con `55P03` sin escribir cabeceras y se reanuda después de liberarlo. También se prueban worker reactivado entre lotes, leases vencidos, interrupciones y cierre incompleto. Esto comprueba límites/recuperación, no certifica ausencia de bloqueos bajo tráfico real.

## Decisión de índices

Se crearon únicamente en la base descartable `(tenant_id, snapshot_at DESC, run_id)` de cabecera y `(tenant_id, snapshot_date_key, snapshot_at, run_id)` de detalle. Construcción conjunta **156,10 ms**; aproximadamente **32 KiB** y **712 KiB** adicionales, respectivamente. Se eliminaron antes de la comparación de publicación; no se añadieron migraciones de índices.

Los planes del dashboard siguen usando la PK del detalle por tenant/run: alrededor de 91–94 buffers de caché para agregados del último corte y 486 para la serie. El índice temporal de cabecera aparece en último corte/inicio de historia, donde sólo hay 160 cabeceras. Las diferencias de latencia de una ejecución son insuficientes para aprobar el costo permanente de dos índices.

El sondeo explícito de mantenimiento por fecha global mejora con el índice candidato de detalle: aproximadamente **27,10 → 3,63 ms**, **3 334 buffers → 8 hits + 21 reads**. Es un sondeo agregado en datos sintéticos, no una consulta del dashboard ni una prueba de DELETE/FK durante purga. PostgreSQL 18 eligió ese índice pese al prefijo tenant en esta distribución; no garantiza ese comportamiento con otra cardinalidad.

**Decisión:** conservar los índices actuales. Antes de adoptar candidatos, repetir con volumetría, concurrencia, frecuencia de consultas y costo de escritura de índices medidos, y preparar una migración nueva. No hay purga de calendario implementada que justifique optimizar ese acceso ahora. Si se requiere `CREATE INDEX CONCURRENTLY`, ejecutarlo mediante procedimiento separado del migrador transaccional y con ACK del entorno.

## Impacto sobre OLTP y disponibilidad

El [benchmark HTTP/ETL](../../apps/api/test/bi-load-benchmark.ts) usa dos PostgreSQL descartables, tres empresas, 12 000 testimonios y 60 000 eventos iniciales. Cuatro requests concurrentes, dos rondas de ocho segundos, mismas rutas y restauración de escrituras entre rondas. Comparación sin/con ETL en el mismo ejecutor; [resultado actual](20_bi_snapshot_time_oltp_benchmark.json). Incluye CPU, RSS, contadores PostgreSQL, extracción/publicación y caída real de la conexión OLAP.

El primer [ensayo con typechecker residente](20_bi_snapshot_time_oltp_initial_runner.json) obtuvo liveness 503 mientras readiness y listado operacional devolvían 200. El controlador liveness sólo comprueba heap con umbral de 300 MiB. Se repite sin checker (`TS_NODE_TRANSPILE_ONLY=true`), manteniendo typecheck separado, y se registra heap/respuesta de liveness. La hipótesis de interferencia del ejecutor no debe confundirse con un cambio de umbral o disponibilidad productiva: no se modificó el controlador.

La repetición registró heap **79 991 232 bytes**, liveness/readiness/listado operacional **200**, y BI **503** al usar una base DW inexistente. El resultado respalda la hipótesis de interferencia del ejecutor TypeScript en el primer ensayo; no demuestra disponibilidad productiva ni justifica cambiar el umbral de heap.

| Ruta | p95 sin/con ETL | p99 sin/con ETL |
| --- | ---: | ---: |
| Listado de testimonios | 78,52 / 100,72 ms | 96,94 / 167,49 ms |
| Analytics operacional | 105,39 / 131,89 ms | 116,39 / 149,13 ms |
| Captura de testimonio | 137,48 / 184,76 ms | 156,94 / 230,63 ms |
| Moderación/aprobación | 130,86 / 181,81 ms | 140,62 / 203,58 ms |

**449 → 338 requests**, cero errores en ambas rondas; 338 solicitudes solapadas con ETL. Los tres tenants publicaron correctamente: ciclo **69,19 s**, mayor run **26,06 s**, publicaciones **15,47–21,61 s**. El origen cambia durante la prueba: 12 000 testimonios es el estado inicial, no un conteo de extracción inmutable. Las publicaciones caben en los límites actuales para este fixture, con margen limitado; no elevar timeouts para admitir otro volumen sin medición.

Los cambios de rendimiento se comparan dentro de cada ronda publicada; no comparar porcentajes con la medición original del runbook 18 realizada en otro momento, ni atribuir las diferencias entre ejecutores sólo al checker. Redis se sustituye por adaptador de prueba, y el DDL OLTP se genera desde Prisma más vistas de exportación, sin aplicar toda la cadena histórica. El host comparte CPU/disco entre instancias; faltan SLO y distribución real acordados. Una carga completa que no cumpla presupuesto de latencia/error o duración debe pasar a captura incremental verificable antes de habilitar producción.

## Restauración y aceptación operativa

La integración respalda el warehouse completo con `pg_dump --format=custom --no-owner --no-acl`, restaura en una base nueva y compara digests UTC de cabecera, detalle, calendario y ledger. Conserva cuatro cortes de tres empresas, incluidos una empresa siempre vacía y un corte vacío posterior; comprueba constraints validadas, denegación de NULL/cruce de tenant y equivalencia JSON del dashboard. También repite el migrador para comprobar checksums de 0001/0002/0003. Tras reprovisionar permisos, el dashboard restaurado se ejecuta con lector sólo `dw`; escritura, staging y ledger se rechazan. La restauración lógica no certifica PITR ni RPO/RTO productivos.

Validación: **58 pruebas en seis suites**, typecheck, lint y build API aprobados; dos advertencias lint preexistentes ajenas a esta fase. Se repitieron las 21 pruebas de integración tras fortalecer el caso de permisos de restauración.

Checklist del operador antes del ACK persistente:

1. Identificar instancias, versión, propietario, artefacto/código nuevo, entorno, responsable, ventana y RPO/RTO; validar separación de recursos OLTP/OLAP. No incluir credenciales en la revisión.
2. Medir filas/bytes/WAL, duración de preflight/backfill/cierre/publicación y bloqueos con distribución real o representativa. Fijar presupuesto API, frecuencia y límite completo de extracción; mantener BI deshabilitado si no cumple.
3. Respaldar toda la base y verificar restauración en destino aislado: ambos hechos, calendario, constraints, ledger, pointer y equivalencia de consultas. Preparar roles mínimos y demostrar denegación de escritura/staging/ledger al lector.
4. Detener scheduler y todos los workers, drenar publicaciones y deshabilitar BI. Resolver runs/leases por recuperación normal antes de la ventana; no borrar controles para forzar el preflight.
5. Seguir el orden exacto del runbook 19: 0002, `--check`, `--apply --maintenance`, `--check` con cero pendientes, 0003. No ejecutar 0003 directamente por SQL ni usar `--to` como rollback.
6. Otorgar permisos de cabecera, instalar procesos compatibles y ejecutar un corte. Conciliar tenant/run/instante/fecha, cantidades y marcas terminales; revisar casos vacíos y metadatos; verificar admin/editor de dos empresas y métricas técnicas.
7. Habilitar scheduler/BI después de aceptar resultados; observar edad de datos, fallos, leases, crecimiento y locks. Conservar historia y mantener BI apagado si falla. Después de 0003 no iniciar el escritor anterior: preparar corrección hacia adelante o restauración autorizada con pérdida potencial desde backup.

## Reproducción

Inyectar externamente `TEST_BI_SOURCE_DATABASE_URL` y `TEST_BI_WAREHOUSE_DATABASE_URL` de administración **sólo de servidores descartables**, sin escribir sus valores en archivos del repositorio. Desde `apps/api`, ejecutar las seis suites sin omitir las integraciones PostgreSQL:

```bash
../../node_modules/.bin/jest --runInBand --runTestsByPath \
  test/bi-postgres.integration.spec.ts test/bi-snapshot-time.integration.spec.ts \
  test/bi-snapshot-time.spec.ts test/bi-etl.spec.ts \
  test/bi-dashboard.spec.ts test/bi-http.integration.spec.ts
```

Para la comparación dimensional, con la URL DW descartable:

```bash
../../node_modules/.bin/ts-node test/bi-snapshot-time-benchmark.ts --run
```

Generar DDL fuente como archivo local con `prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script`; no aplica migraciones. Inyectar `TEST_BI_BENCHMARK_SCHEMA_FILE` apuntando a ese archivo y las dos URLs `TEST_BI_SOURCE_DATABASE_URL`/`TEST_BI_WAREHOUSE_DATABASE_URL`, luego:

```bash
TS_NODE_TRANSPILE_ONLY=true ../../node_modules/.bin/ts-node test/bi-load-benchmark.ts --run
```

Crear/eliminar bases aleatorias es parte de esos ejecutores; no usar servidores productivos como entrada. El benchmark temporal genera únicamente datos sintéticos y no accede a OLTP. La prueba de impacto crea también su propio origen. Los resultados publicados no contienen URLs, contraseñas ni datos de personas.
