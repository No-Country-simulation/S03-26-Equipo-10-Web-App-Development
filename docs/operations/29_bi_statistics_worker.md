# Motor estadístico BI: cálculo y recuperación

**Fecha:** 2026-10-19. **Estado:** fase 3 implementada y validada localmente; pendiente ACK. Sin habilitación persistente, endpoint ni interfaz nuevos.
**Referencias:** [plan y evidencia](../plan/2026-10-19_feat-bi-analitica-estadistica.md), [catálogo stats_v1](../modules/api-bi-statistics.md), [preparación de datos](28_bi_statistics_data.md).

## Ejecución y permisos

El worker existente `bi:etl` ejecuta primero las cargas elegibles y después como máximo una tarea estadística por ciclo. Utiliza la conexión DW existente, pool de dos; el cálculo no abre conexiones OLTP ni incorpora servicios/dependencias. `--once` respeta este límite: si hay varias empresas, las restantes quedan pendientes para próximos ciclos. Un fallo de estadísticas puede producir salida no exitosa de `--once`, pero conserva los runs ETL exitosos y el informe anterior.

`BI_STATISTICS_ENABLED=false` por defecto evita las consultas nuevas. Al habilitarla, el preflight de datos valida esquema/privilegios/inicialización; otro preflight comprueba los permisos del motor. Si sólo falla el segundo, se registra `bi.statistics_engine_unavailable` y continúa la extracción compatible, sin calcular. Ambos se evalúan al arrancar: corregir permisos requiere reinicio controlado. La bandera no habilita HTTP ni UI en esta fase y no participa en readiness del CMS.

Los siguientes grants complementan los de datos y el SELECT base del worker sobre DW. Son ejemplos para un entorno posteriormente autorizado; no se aplicaron a recursos persistentes ni amplían la autorización de migración:

```sql
GRANT SELECT, INSERT, UPDATE ON etl.statistics_jobs TO bi_etl_writer;
GRANT SELECT, INSERT ON dw.statistics_publication TO bi_etl_writer;
GRANT SELECT, INSERT, UPDATE ON dw.statistics_current TO bi_etl_writer;
```

No conceder UPDATE/DELETE de informes, DELETE de jobs/punteros, DDL ni permisos nuevos al control HTTP. El lector estadístico consulta exclusivamente `dw`; los repositorios de jobs/publicación necesitan control `etl`. Las pruebas usan ambas identidades separadas para comprobar ese límite; el CLI mantiene su identidad escritora existente.

## Entrada y cálculo

Una transacción DW `REPEATABLE READ READ ONLY` fija UTC, valida tenant/run/corte e inicialización del historial y devuelve agregados acotados. SQL hasta30s, lock1s y transacción dentro del presupuesto restante de60s. Máximos:24 meses, seis orígenes de tres entradas,50 categorías/etiquetas/segmentos,1225 pares candidatos y118 cortes diarios. Los escaneos SQL pueden recorrer más filas; estos límites de salida no acreditan capacidad productiva.

Al cerrar esa transacción, funciones TypeScript puras calculan:

- Media3 constante para el próximo mes, MAE y sesgo de seis orígenes históricos a dos pasos, sin entradas conocidas después del origen. La promoción de mejora>=10% usa productos cruzados BigInt exactos para evitar errores en tercios periódicos. El mes actual no entra en el ajuste; sin historia/cobertura/mejora se conserva la explicación y el histórico.
- Frecuencias, segmentos y hasta20 pares de etiquetas con soporte, ambas confianzas y lift. Los porcentajes conservan el denominador del inventario original y el resultado informa truncamiento.
- Dos señales diarias durante90 días, mediana/MAD sobre referencias anteriores válidas y umbral mínimo5pp. Un día sin corte no vale cero; el último corte actualiza la identidad estable del día.

Las cantidades permanecen BigInt/cadenas y el cálculo decimal utiliza `Prisma.Decimal` sin cliente ni persistencia desde las funciones. Se comprueba rango antes de convertir magnitudes a Number. Zod valida el payload completo y sus estados antes de publicar; metadatos relacionales determinan procedencia y versión. No se publican intervalos ni probabilidades inventadas.

## Reserva y publicación

`discover` busca últimos cortes inicializados sin job, en lotes de hasta1000. Así recupera una caída posterior al commit ETL y anterior al encolado. La clave es tenant/run/`stats_v1`. `claim` examina hasta100 tenants por ronda, toma un lock por tenant y deja un solo job activo por empresa. Pendientes antiguas se marcan `superseded`; no se generan informes para cortes omitidos.

Cada claim incrementa el contador durable hasta tres intentos y fija token, lease90s y deadline60s desde el reloj DW. Heartbeat20s sólo renueva el token vivo y nunca supera el deadline original. Una reserva vencida se recupera con otro token dentro del presupuesto. Un tercer fallo permanece terminal para ese corte/versión; un nuevo corte puede generar otra tarea. No reiniciar contadores manualmente para ocultar fallos.

La publicación toma el lock del job y luego del puntero, valida fuente/token/lease/plazo y confirma informe inmutable, puntero y éxito juntos, con SQL4s/lock1s/tx5s. Cualquier fallo revierte las tres escrituras; el puntero no retrocede. El replay de un éxito no duplica ni mueve el puntero. Si la respuesta se pierde después del commit, se consulta el éxito durable antes de repetir. Un corte base nuevo puede dejar temporalmente el informe anterior; el consumo de su antigüedad se incorporará en fase4.

SIGTERM impide reclamar otra tarea; una ya reclamada drena hasta su plazo. Las comprobaciones de plazo se realizan entre lectura/cálculo/publicación y en el fence DW. El cálculo síncrono usa las entradas acotadas; no hay interrupción preventiva del JavaScript ni un worker thread. El costo máximo efectivo debe medirse en fase5.

## Diagnóstico y recuperación

El evento `bi.statistics_task_finished` incluye estado, duración y sólo códigos permitidos: `BI_STATISTICS_FAILED`, `BI_STATISTICS_DEADLINE_EXCEEDED`, `BI_STATISTICS_LEASE_LOST`, `BI_STATISTICS_DATA_INVALID`, `BI_STATISTICS_COUNT_OUT_OF_RANGE`. No contiene filas, nombres de taxonomía, SQL, credenciales ni stacks. No se incorporan métricas HTTP ni controles de reintento nuevos en esta fase.

Ante un fallo, conservar el informe publicado y examinar permisos, disponibilidad y marcador con la identidad de mantenimiento autorizada. Corregida la causa, próximos ciclos recuperan tareas elegibles hasta su presupuesto; no borrar hechos ni crear snapshots ficticios. Para deshabilitar, drenar el worker, apagar la bandera y reiniciar. Tras un intervalo sin extracción compatible, conciliar el historial según la guía de datos antes de reactivar. No hay DDL inverso.

## Evidencia y límites

Regresión local:239/239 casos en17 suites BI, sin omisiones, sobre dos PostgreSQL18.6 descartables. Se agregaron52 casos en esta fase:31 del motor,6 del servicio,14 de persistencia y uno del CLI real. Incluyen oráculos numéricos, fronteras temporales, datos tardíos, roles restringidos/dos tenants, competencia, presupuesto, lease, deadline, rollback de publicación y respuesta ambigua post-commit. El CLI confirma prioridad ETL y una tarea por ciclo.

Typecheck, lint y build API aprobados; lint conserva tres advertencias anteriores ajenas al cambio. Los fixtures sintéticos verifican mecánica, no utilidad predictiva real. HTTP/UI/CSV corresponden a fase4; restauración integral, benchmarks CMS/ETL/cálculo y despliegue autorizado corresponden a fase5. No se afirma haber ejecutado toda la suite CMS ni E2E.
