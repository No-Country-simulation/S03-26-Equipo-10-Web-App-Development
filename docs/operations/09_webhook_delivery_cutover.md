# Corte del ledger de entregas de webhooks

Este documento prepara el despliegue de la Fase 3. **No autoriza ejecutar migraciones en una base persistente.** La migración se probó con PostgreSQL 18 descartable y datos sintéticos.

## Orden obligatorio

1. En staging, registrar recuentos de `outbox_events` por estado y de pares repetidos `(outbox_event_id, webhook_id)`; tomar un respaldo verificado. Confirmar que no hay workers antiguos activos fuera de las réplicas de API.
2. Aplicar `20260930000000_webhook_delivery_expand`. Solo agrega columnas y tabla de historial; la versión anterior puede seguir escribiendo mientras se prepara el corte.
3. Drenar **todas** las réplicas antiguas antes de `20260930000001_webhook_delivery_cutover`. En este despliegue el polling vive dentro de la API, por lo que drenar los procesadores implica detener temporalmente esas réplicas. Los productores pueden seguir escribiendo el outbox solo si no quedan workers antiguos ejecutándose.
4. Con autorización separada, aplicar el corte. Este deduplica registros históricos, crea el índice único y reabre eventos que figuraban procesados pese a tener entregas fallidas. La URL histórica no existía en las filas antiguas: su backfill usa la URL vigente en el momento del corte. Iniciar únicamente la versión nueva; no volver a arrancar una imagen antigua que inserte varias filas de entrega para el mismo par.
5. Verificar en staging: dos réplicas adquieren trabajos diferentes, el outbox no pasa a `processed` mientras hay entregas pendientes, leases vencidos se recuperan, `dead` es visible y el reenvío administrativo funciona. Repetir el proceso en producción solo tras aprobación y observación de staging.

## Consultas de revisión

```sql
SELECT status, count(*) FROM outbox_events GROUP BY status;
SELECT outbox_event_id, webhook_id, count(*)
FROM webhook_deliveries
WHERE outbox_event_id IS NOT NULL
GROUP BY outbox_event_id, webhook_id
HAVING count(*) > 1;
SELECT status, count(*) FROM webhook_deliveries GROUP BY status;
```

Tras el corte, la segunda consulta debe devolver cero filas. Un evento `processed` puede contener entregas `dead`, pero cada una debe conservar resultado terminal e intentos consultables. No interpretar `processed` como confirmación de 2xx por todos los destinos.

## Retroceso

El índice único del corte impide que el procesador anterior vuelva a insertar intentos como filas de entrega. Si la versión nueva falla, conservar sus workers detenidos y corregir o desplegar una versión que lea el ledger nuevo. Restaurar una copia de la base o retirar el índice requiere una decisión operativa separada; no hacerlo automáticamente ni perder intentos ya confirmados. Las columnas legadas permanecen para facilitar una corrección compatible durante la ventana de transición.
