# Migración del tiempo dimensional BI

**Estado:** fases 1/2/3 implementadas y validadas localmente en PostgreSQL 18 descartable. No se aplicó a un entorno persistente. [Mediciones y restauración](20_bi_snapshot_time_validation.md) documentadas; capacidad/SLO del entorno productivo y ACK de despliegue siguen pendientes. Este procedimiento prepara el mantenimiento.

**Referencias:** [plan HITL](../plan/2026-10-08_refactor-bi-tiempo-dimensional.md), [expansión 0002](../../apps/api/warehouse/migrations/0002_snapshot_time_expand.sql), [cierre 0003](../../apps/api/warehouse/migrations/0003_snapshot_time_constraints.sql), [backfill](../../apps/api/src/modules/business-intelligence/repositories/snapshot-time-backfill.repository.ts), [validación](../../apps/api/src/modules/business-intelligence/repositories/snapshot-time-validation.ts).

## Compatibilidad y condiciones de entrada

0002 crea `dw.fact_tenant_snapshot` y agrega `snapshot_at`/`snapshot_date_key` nullable al detalle, sin defaults. 0001 conserva su contenido y checksum. El escritor anterior todavía puede insertar detalles tras 0002, pero no crea cabeceras ni completa las columnas nuevas. **0003 exige el escritor nuevo: no iniciar el ETL anterior después de aplicar el cierre**, incluso en una instalación vacía. El código actual requiere el esquema temporal; no iniciar el ETL/dashboard sobre sólo 0001. La conversión de historial existente precede al cambio de consumidores.

El migrador con `--apply` sin destino intenta todas las versiones disponibles. Usar `--to` para detener la expansión antes del backfill. El destino es un nombre exacto del repositorio, no una ruta. Versiones desconocidas y argumentos extra se rechazan. `--to` limita qué archivos se comprueban/aplican: no revierte versiones que ya consten en el ledger.

0004 prepara la futura consola de operación BI y es requisito del nuevo worker configurable. Este procedimiento temporal termina explícitamente en 0003; antes de iniciar la entrada ETL actual completar también 0004 bajo mantenimiento autorizado. No usar un `--apply` sin destino para asumir que se aplican sólo las tres versiones iniciales. [Plan de consola](../plan/2026-10-09_feat-interfaces-operacion-bi.md), [contrato de control](../modules/api-bi-operations.md) y [compatibilidad del worker](21_bi_worker_operations.md).

Antes de un entorno persistente, identificar versión, volumen, ventana y ACK, verificar backup restaurable y aceptar la evidencia de capacidad/SLO del entorno objetivo. La evidencia local de fases 2/3 no la sustituye. Detener todos los workers/schedulers y deshabilitar temporalmente BI; captura y moderación OLTP siguen disponibles. Esperar la finalización de publicaciones. Cualquier run `running` o componente de lease no nulo, aunque esté vencido, bloquea el mantenimiento. Resolver intentos pendientes mediante la recuperación normal del ETL antes de la ventana; el backfill no borra runs ni limpia leases.

Usar `BI_MIGRATION_DATABASE_URL` provista externamente, con identidad migradora del warehouse. No guardar su valor en documentación, contexto o logs. El CLI no usa la conexión OLTP, no inicia HTTP y no se ejecuta automáticamente desde el ETL.

## Secuencia para el operador

Los comandos se ejecutan desde `apps/api`, con el runtime y dependencias ya disponibles. En esta entrega sólo se ejecutaron contra bases descartables. En otro entorno requieren el ACK correspondiente y las condiciones anteriores.

1. Aplicar hasta la expansión:

   ```bash
   ../../node_modules/.bin/ts-node src/modules/business-intelligence/migration.cli.ts --apply --to 0002_snapshot_time_expand.sql
   ```

2. Revisar sin escribir filas ni DDL:

   ```bash
   ../../node_modules/.bin/ts-node src/modules/business-intelligence/snapshot-time-backfill.cli.ts --check
   ```

   Salida 0 significa historial conciliado y sin pendientes. Salida 1 con `BI_BACKFILL_REQUIRED` significa que falta convertir datos; las cantidades se registran como cadenas. `BI_BACKFILL_INCONSISTENT` detiene la operación ante anomalías y puede incluir el UUID técnico del tenant afectado. `BI_MAINTENANCE_REQUIRED` exige resolver actividad/leases. Otros fallos se reportan con códigos acotados, sin mensajes del driver ni credenciales.

3. Confirmados workers detenidos, ejecutar el backfill manual:

   ```bash
   ../../node_modules/.bin/ts-node src/modules/business-intelligence/snapshot-time-backfill.cli.ts --apply --maintenance
   ```

   `--maintenance` expresa la condición operativa del operador; no detiene procesos. Las verificaciones de la base complementan esa condición. SIGINT/SIGTERM solicitan detenerse entre transacciones, con `BI_BACKFILL_INTERRUPTED`; repetir el mismo comando permite retomar lotes confirmados. Un lote fallido se revierte. No hay una transacción global de toda la conversión: conservar workers detenidos durante una interrupción y su reanudación.

4. Repetir `--check`; exigir salida 0 y cero pendientes. No omitir los cortes vacíos.

5. **Sólo con el escritor/lector de fase 2 preparados y el ACK del entorno**, aplicar el cierre manteniendo el ETL detenido:

   ```bash
   ../../node_modules/.bin/ts-node src/modules/business-intelligence/migration.cli.ts --apply --to 0003_snapshot_time_constraints.sql
   ```

   El migrador vuelve a conciliar todas las empresas, incluyendo runs exitosos sin detalles, bajo locks y en la misma transacción que el DDL/ledger. Rechaza el cierre si falta una cabecera o un dato temporal. Valida CHECK/FK antes de exigir NOT NULL. No insertar manualmente entradas en el ledger ni ejecutar sólo el SQL de 0003: se perdería el preflight que detecta cortes vacíos omitidos.

6. Conceder privilegios explícitos de la nueva tabla al escritor (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) y al lector (`SELECT`) usando los nombres reales de roles del entorno. No asumir que un GRANT previo sobre todas las tablas cubre tablas futuras. La identidad extractora OLTP no requiere cambios. Fase 2 verificó DashboardRepository con un lector de acceso sólo a `dw`. La conexión runtime sigue compartida con métricas: conserva sus permisos sobre `etl.runs` y `etl.tenant_load_state`; no revocarlos por esa prueba. Separar identidades runtime requeriría configuración adicional fuera de esta entrega.

7. Instalar los procesos compatibles, ejecutar un corte y verificar cabecera/detalles/metadata y paridad de consultas antes de habilitar BI y scheduler. Publicación, lectura y restauración completa se verificaron localmente; aceptar capacidad y recuperación en el entorno concreto antes de habilitarlo.

## Integridad, concurrencia y límites

La conversión copia `source_snapshot_at` exacto, su fecha UTC y `finished_at` del run exitoso. No crea cortes de horas ausentes ni usa el reloj actual. Se crean cabeceras incluso con cero testimonios y fechas en `dim_date`. El detalle mantiene su PK y todos sus campos anteriores. Cada actualización compara los campos originales antes/después dentro de SQL; una modificación adicional provoca rollback del lote. Los datos ya completos se verifican y no se sobrescriben ante discrepancias.

El preflight completo precede a la primera escritura. Se comprueba cada tenant por separado, con inventario paginado de hasta 1 000 UUID y sin cargar filas de negocio en memoria de Node. Cabeceras y detalles se convierten por lotes de hasta 1 000 filas; se concilia nuevamente antes de cerrar cada tenant y al finalizar. FKs compuestas impiden cruzar tenant/run o usar un instante/fecha distinto al de su cabecera. CHECK de UTC y FK de calendario completan la validación temporal. La igualdad de cantidad y número de detalles se valida mediante conciliación; no se presume garantizada por un CHECK de fila.

Cada lote de escritura comparte el advisory lock del migrador y bloquea escritura sobre control ETL y hechos. Usa `READ COMMITTED` para observar los claims confirmados antes de adquirir esos locks. Los chequeos de sólo lectura usan `REPEATABLE READ READ ONLY`. Si un worker vuelve a reclamar entre lotes, el siguiente guard detiene la conversión y conserva su run. Estos locks no reemplazan detener workers durante toda la ventana.

Una conexión migradora; `statement_timeout=30s`, `lock_timeout=1s`, `transaction_timeout=35s`, timeout Prisma de 35s y espera de conexión de 5s. El chequeo completo también debe caber en esos límites. No aumentarlos sin medir el entorno y revisar el mantenimiento. La [evaluación sintética](20_bi_snapshot_time_validation.md) conserva los índices actuales; nuevos índices requieren evidencia del entorno y una migración independiente.

Antes de 0003 se puede conservar el esquema expandido y el lector anterior con ETL detenido. Después del cierre, volver al código escritor anterior requiere una migración correctiva autorizada o restauración verificada. `--to 0002` no es rollback. Ante fallo, mantener BI deshabilitado y conservar el historial; no ejecutar DROP/CASCADE ni borrar metadatos para forzar el cierre.

## Evidencia local de fase 1

46 pruebas pasaron en cuatro suites: 15 de integración temporal nueva, tres unitarias nuevas, 10 unitarias ETL existentes y 18 de integración BI existentes con dos PostgreSQL descartables. Se probaron instalación nueva y actualización desde 0001, compatibilidad del escritor anterior tras expansión, UTC/milisegundos/bisiesto/cambio de año, empresas vacías, preservación de campos, repetición, interrupción/reanudación, conflictos temporales, conteos incorrectos, runs fallidos, leases vencidos, worker reactivado entre lotes, rollback de un lote y rechazo del cierre incompleto. También se ejercitaron los CLI reales y la detección de drift.

Typecheck, lint y build API pasaron. Lint conserva dos advertencias preexistentes fuera de estos cambios. La integración crea una base aleatoria descartable y la elimina al terminar; nunca usar una URL persistente como `TEST_BI_WAREHOUSE_DATABASE_URL`. Para repetir las pruebas temporales, con esa variable configurada externamente:

```bash
npm test --workspace apps/api -- --runTestsByPath test/bi-snapshot-time.integration.spec.ts test/bi-snapshot-time.spec.ts test/bi-etl.spec.ts
```

La regresión `test/bi-postgres.integration.spec.ts` requiere además `TEST_BI_SOURCE_DATABASE_URL` descartable. Esta evidencia inicial no certifica capacidad productiva. Fase 2 agrega lectura/publicación dimensional y fase 3 comprueba restauración integral y mediciones locales.

## Cambios y verificación de fase 2

El publicador verifica que el instante recibido coincida con el run del tenant, crea calendario/cabecera/detalles en la misma transacción y concilia cantidades. Después de limpiar staging obtiene una marca terminal única mediante el UPDATE del run y la copia a la cabecera antes del fencing/plazo final. Errores y pérdida de lease revierten también la cabecera. Los reintentos y la resolución de respuesta perdida tras COMMIT conservan su comportamiento.

DashboardRepository usa exclusivamente `dw` para elegir último corte global, último corte diario e inicio del historial. El total procede de la cabecera; rating/estados/categorías proceden de los detalles del mismo tenant/run. Cortes vacíos devuelven 0 con fecha conocida; días sin corte mantienen NULL. El rango UTC limita series/eventos, mientras el resumen conserva el último corte global. Contrato HTTP/UI y conexión consistente de sólo lectura permanecen vigentes.

Las fixtures de integración/benchmark instalan todas las versiones en bases nuevas vacías. Las fechas históricas de prueba se reconstruyen junto con run, calendario, cabecera y detalles dentro de una transacción respetando FK inmediatas; el runtime no modifica cortes históricos. Se comprobaron publicación normal y vacía, igualdad de marca terminal, rollback, reintentos, pérdida de lease/COMMIT, límites UTC, contrato JSON completo, lectura limitada a `dw`, métricas con permisos técnicos y publicación durante una lectura consistente.

El resultado final de tests/typecheck/lint/build queda registrado en la [evidencia del plan](../plan/2026-10-08_refactor-bi-tiempo-dimensional.md). No se cambió infraestructura, Prisma, dependencias ni configuración de identidades runtime. No hay migraciones persistentes. [Fase 3](20_bi_snapshot_time_validation.md) documenta mediciones, restauración, límites y checklist de aceptación; el despliegue persistente requiere su propio ACK.
