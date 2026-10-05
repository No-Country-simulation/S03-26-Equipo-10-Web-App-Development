# Fechas absolutas, procedencia UTC y medición de índices

## Estado y alcance

`apps/api/prisma/schema.prisma` declara los 47 instantes absolutos como `@db.Timestamptz(3)`. La migración `20261005000000_absolute_timestamps` interpreta los valores `timestamp` anteriores como UTC con `AT TIME ZONE 'UTC'`. **La procedencia de una base persistente no está verificada**: la migración se detiene si alguna tabla temporal tiene filas y la conexión no presenta `tms.utc_timestamp_provenance=confirmed`. La migración `20261005010000_drop_unused_covering_index` retira un índice medido en datos sintéticos. Ninguna de las dos se aplicó a una base persistente.

## Evidencia requerida antes de convertir datos existentes

1. Identificar los entornos y periodos en que se escribieron filas. Revisar la zona horaria histórica del servidor PostgreSQL, de las conexiones de Prisma, de los jobs y de cualquier importador o SQL manual. `SHOW TimeZone` informa solo la configuración actual; no demuestra la procedencia histórica.
2. Comparar muestras de cada origen y periodo con una fuente independiente que registre UTC (por ejemplo, logs de despliegue, eventos externos u otros registros inmutables). No copiar IDs de usuarios, secretos ni contenido de testimonios a la evidencia compartida. Si hay periodos mixtos o inciertos, detener el corte y diseñar una corrección por lote o por fila.
3. Ensayar respaldo y restauración, verificar recuentos y fechas en una copia, medir el bloqueo y el tiempo de la reescritura de tablas e índices. Reservar una ventana de mantenimiento y detener escritores incompatibles. Registrar responsable y aprobación para la base concreta.
4. Confirmar el indicador **solo para esa conexión** después de documentar la evidencia. Por ejemplo, una sesión `psql` puede recibir `PGOPTIONS='-c tms.utc_timestamp_provenance=confirmed'`. Probar el mecanismo elegido por el ejecutor de migraciones en una copia antes de usarlo en datos persistentes, y conservar el registro de aplicación en `_prisma_migrations`; ejecutar el SQL manualmente sin registrar la migración deja el historial de Prisma inconsistente. `AGENTS.md` exige ACK adicional antes de `prisma migrate deploy` o cualquier migración persistente; el indicador técnico no sustituye ese ACK.
5. Tras convertir, comprobar `information_schema.columns`, comparar instantes de muestra con su valor UTC esperado desde dos zonas horarias de sesión, verificar orden y expiraciones de API keys, refresh tokens, outbox y webhooks, y observar errores y latencia. Mantener el respaldo para rollback: volver de `timestamptz` a `timestamp` sin registrar la zona interpretada puede perder significado.

La migración usa `AT TIME ZONE 'UTC'` de forma explícita; un cast implícito dependería de la zona horaria de la sesión. `timestamptz` almacena el instante y lo presenta en la zona de esa sesión. Ver [tipos temporales de PostgreSQL](https://www.postgresql.org/docs/18/datatype-datetime.html) y [tipos nativos de Prisma 6](https://www.prisma.io/docs/orm/v6/overview/databases/postgresql).

## Índice de testimonios

Medición local del 2026-10-05 sobre PostgreSQL 18 descartable, con 30.000 testimonios sintéticos, cinco categorías y `ANALYZE`. Las dos consultas seleccionaron todas las columnas del testimonio, como las listas del repositorio, con orden estable y `LIMIT 20`. Se ejecutó `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` antes y después de retirar `idx_testimonials_covering` solo en esa base.

| Consulta | Antes: plan, bloques compartidos, ejecución | Después: plan, bloques compartidos, ejecución |
| --- | --- | --- |
| Administración por tenant, `created_at DESC, id DESC` | Seq Scan + Sort; 1.312; 14,642 ms | Seq Scan + Sort; 1.312; 14,786 ms |
| Publicados por tenant y categoría, `score DESC, id DESC` | `idx_testimonials_score` + Incremental Sort; 2.424; 2,911 ms | mismo plan; 2.424; 2,905 ms |

El índice covering ocupaba 8.712 kB y no apareció en esos planes. `idx_testimonials_category`, con las mismas claves `(tenant_id, category_id)` y sin columnas incluidas, ocupaba 216 kB y permanece. Esta evidencia justifica el retiro para las consultas actuales; no extrapola latencias a producción. Repetir mediciones sobre una carga representativa si cambian las consultas.

## `pg_stat_statements`

La migración antigua crea la extensión, pero en el PostgreSQL 18 descartable `shared_preload_libraries` estaba vacío y consultar la vista devolvió `pg_stat_statements must be loaded via "shared_preload_libraries"`. El alojamiento futuro debe decidir si precarga el módulo, reiniciar el servidor según su procedimiento y comprobar que la vista recolecta llamadas. Crear la extensión por sí solo no habilita las estadísticas. Ver [documentación de PostgreSQL 18](https://www.postgresql.org/docs/18/pgstatstatements.html).
