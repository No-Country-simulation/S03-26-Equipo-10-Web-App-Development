# Datos de analítica estadística: preparación y mantenimiento

**Fecha:** 2026-10-19. **Estado:** fase 2 implementada y validada en recursos descartables; sin aplicación persistente ni habilitación de analítica.
**Referencias:** [plan HITL](../plan/2026-10-19_feat-bi-analitica-estadistica.md), [contrato](../modules/api-bi-statistics.md), [operación ETL](17_business_intelligence_etl.md).

## Objetos y compatibilidad

- OLTP: [20261019000000_bi_statistics_export](../../apps/api/prisma/migrations/20261019000000_bi_statistics_export/migration.sql), dos vistas con `security_barrier`: `bi_export.tags` y `bi_export.testimonial_tags`. No cambia `schema.prisma` ni tablas operacionales.
- DW: [0005_bi_statistics](../../apps/api/warehouse/migrations/0005_bi_statistics.sql), diez tablas adicionales; 30 con la cadena 0001–0005. Migrador verifica 0004, ledger/checksum y ausencia de runs/reservas ETL, incluso vencidos. No hay backfill implícito.
- Las relaciones llevan tenant en sus FK. En staging, el enlace también se elimina al limpiar su testimonio mediante `ON DELETE CASCADE`; esto permite limpiar con el escritor anterior sin bloquear la carga base. No hay cascada sobre hechos históricos.
- Los borradores de fase 1 permanecen como antecedente; sólo los archivos de migración son candidatos a aplicación. La fase 2 corrigió la limpieza de enlaces temporales al promover el SQL; no se modificaron migraciones previas.

## Preparación para un futuro entorno autorizado

Este documento no autoriza ejecutar migraciones persistentes. Requiere ACK del entorno/ventana, backup y mantenimiento; los comandos Prisma protegidos conservan su autorización específica de AGENTS.md.

1. Mantener `BI_STATISTICS_ENABLED` desactivada, detener workers y resolver runs/reservas huérfanas. No iniciar el worker anterior durante mantenimiento.
2. Aplicar la migración OLTP mediante el procedimiento autorizado y la 0005 mediante el migrador DW manual con identidad propietaria. Son destinos independientes: no existe transacción distribuida.
3. Provisionar los permisos adicionales indicados abajo. El control HTTP no recibe permisos nuevos.
4. Con la identidad migradora del warehouse, ejecutar el comprobador; aplicar el backfill explícito sólo después de inspeccionar el resultado y confirmar mantenimiento.
5. Verificar cero empresas pendientes y cero creaciones faltantes, desplegar worker compatible y recién después considerar el opt-in. El motor de fase3 requiere además los [permisos de cálculo](29_bi_statistics_worker.md); el consumo HTTP sigue pendiente de fase4.

Desde la raíz del repositorio, con la conexión migradora cargada externamente en el entorno, sin escribirla en archivos de contexto:

```bash
npm exec --workspace apps/api -- ts-node src/modules/business-intelligence/statistics-history.cli.ts --check
npm exec --workspace apps/api -- ts-node src/modules/business-intelligence/statistics-history.cli.ts --apply --maintenance
```

`--check` no modifica datos y termina con error `BI_BACKFILL_REQUIRED` si falta conciliación. `--apply` sin `--maintenance` se rechaza antes de crear conexiones. El programa usa únicamente `BI_MIGRATION_DATABASE_URL`; no hace fallback a OLTP. SIGINT/SIGTERM detienen la siguiente tanda. Los logs contienen conteos y códigos, sin textos, filas, SQL ni conexiones.

## Backfill de primeras observaciones

La herramienta verifica consistencia temporal y cantidad de detalles por cabecera, run exitoso, igualdad de `created_at` para cada identidad y coherencia de cualquier registro ya inicializado. Una discrepancia produce `BI_BACKFILL_INCONSISTENT`, sin elegir silenciosamente un valor.

Procesa empresas e identidades con páginas de hasta 1000; cada tanda usa transacción acotada SQL30s/lock1s/tx35s y locks de mantenimiento. Las inserciones son idempotentes. Una interrupción puede dejar filas válidas ya copiadas, pero nunca avanza el marcador de ese tenant antes de conciliar todas sus observaciones. Reejecutar recorre las identidades y conserva la primera aparición; no altera los hechos fuente. La verificación global inicial y final también es acotada por tiempo: si excede el límite, no asumir éxito ni ampliarlo sin medición.

`dw.statistics_history_state` apunta al último run conciliado. Incluso una empresa siempre vacía obtiene marcador desde su cabecera real. Nunca se inventan tags históricos ni se asignan los actuales a cortes anteriores. La primera observación se conserva aunque un testimonio haya desaparecido del origen; no equivale a capturar todas las altas.

Si se omiten cargas estadísticas durante un período, el marcador queda atrás. Antes de reactivarlas se repite el backfill con workers detenidos. La publicación compatible rechaza `BI_BACKFILL_REQUIRED` si el marcador no alcanza al corte previo: no promociona un historial parcial.

## Permisos adicionales propuestos

Aplicar únicamente después de crear objetos e identidades por sus procedimientos vigentes. Los siguientes ejemplos no crean roles, secretos ni conexiones y se ejecutan en sus destinos respectivos. Complementan los permisos base; no los reemplazan.

```sql
-- OLTP: proyección autorizada; sin SELECT de tablas privadas.
GRANT SELECT ON bi_export.tags, bi_export.testimonial_tags TO bi_source_reader;

-- Warehouse: escritura sólo de datos necesarios por el worker de fase 2.
GRANT SELECT, INSERT, DELETE ON staging.tags, staging.testimonial_tags TO bi_etl_writer;
GRANT SELECT, INSERT, UPDATE ON dw.dim_tag, dw.statistics_history_state TO bi_etl_writer;
GRANT SELECT, INSERT ON dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot,
    dw.fact_testimonial_creation TO bi_etl_writer;

-- Lector privado; no habilita endpoint nuevo por sí mismo.
GRANT SELECT ON dw.dim_tag, dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot,
    dw.fact_testimonial_creation, dw.statistics_history_state TO bi_api_reader;
```

El escritor de datos no necesita UPDATE/DELETE de creaciones ni escritura del ledger; los informes sólo admiten INSERT/SELECT, sin UPDATE/DELETE. Los grants de jobs/informes/punteros están en la [guía del motor de fase3](29_bi_statistics_worker.md). No conceder DDL, TRUNCATE ni acceso a nuevas tablas desde `bi_control`.

Los adaptadores de entrega/auditoría de permisos de demo conservan su catálogo anterior. Su ampliación, recursos remotos, restauración y aceptación de habilitación permanecen pendientes del procedimiento final; no activar estadísticas remotas usando sólo los ejemplos de grants de este documento.

## Opt-in del worker y fallos

`BI_STATISTICS_ENABLED` controla extracción/publicación de datos y, desde fase3, cálculo del worker; default false, sin efecto sobre API/UI todavía. Apagada, no consulta vistas ni tablas nuevas. Encendida, un preflight comprueba ledger0005, SELECT de vistas/objetos, DML mínimo y marcador al día. Si falla, registra `bi.statistics_data_unavailable` con código seguro, mantiene el worker base y no publica un falso marcador de tags. La condición se revisa al iniciar el proceso; tras corregirla se reinicia de forma controlada. Un segundo preflight verifica permisos del motor; su fallo permite seguir extrayendo datos compatibles, sin calcular.

Una vez iniciada extracción completa, errores de FK/conteos/fechas abortan el corte entero. Tag dimension, puente, creaciones, marcador y cabecera se confirman juntos, con el fencing final del ETL. No omitir relaciones inconsistentes para aparentar éxito. La cola/cálculo de fase3 funciona después de esa publicación; GET statistics todavía no está registrado.

Para apagar/revertir: drenar las cargas, recuperar reservas y limpiar staging del worker compatible antes de cambiar bandera/software. Si un proceso con tags cayó y luego se arranca el modo anterior, la cascada permite limpiar enlaces, pero pueden quedar filas de `staging.tags` del run abandonado; saneamiento por tenant/run terminal con identidad de mantenimiento antes de reactivar. No borrar hechos, creaciones ni migraciones para volver al resumen anterior.
