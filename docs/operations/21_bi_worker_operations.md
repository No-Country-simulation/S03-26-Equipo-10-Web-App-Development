# Worker BI: programación y solicitudes durables

**Estado:** fase 2 del [plan de interfaces](../plan/2026-10-09_feat-interfaces-operacion-bi.md). Worker implementado y verificado localmente; API operativa, controles web, alertas de aplicación y despliegue pendientes. No se aplicaron migraciones persistentes.

## Compatibilidad y permisos

La entrada `bi:etl`/`bi:etl:prod` ahora usa el protocolo 1 de control y **requiere 0004**, además del esquema temporal. Comprueba el ledger antes de reclamar trabajo; sólo 0003 produce `BI_MIGRATION_REQUIRED`. No migra al arrancar. `WarehouseRepository` conserva los primitivos de publicación y el claim anterior para fixtures/regresiones; la entrada de producción usa `ManagedWarehouseRepository`.

`BI_OPERATIONS_ENABLED=false` mantiene apagados los futuros controles HTTP. El nuevo worker siempre respeta configuración y solicitudes durables, aun con la bandera apagada; apagar controles no cancela trabajo aceptado. No necesita `BI_CONTROL_DATABASE_URL`, `BI_DATABASE_URL`, secretos HTTP ni Redis. Mantiene extractor OLTP pool1 y escritor DW pool2.

Además de DML de staging/dw y SELECT/INSERT/UPDATE de runs/estado, el escritor necesita:

```sql
GRANT SELECT ON etl.schema_migrations TO bi_etl_writer;
GRANT SELECT, INSERT, UPDATE ON etl.tenant_settings, etl.worker_health TO bi_etl_writer;
GRANT SELECT, UPDATE ON etl.load_requests TO bi_etl_writer;
```

No INSERT de solicitudes, acceso de escritura a auditoría, DELETE de controles/ledger, CREATE ni propiedad de tablas. API de control y worker mantienen identidades distintas. La comprobación de versión requiere SELECT del ledger, nunca su modificación. No cambiar concesiones de producción sin mantenimiento autorizado.

## Bucle y programación

Un proceso independiente revisa trabajo cada 15 segundos, secuencialmente, sin ciclos superpuestos. Un ciclo que tarda más desplaza la siguiente revisión; no se crea otro en paralelo. No se garantiza inicio inmediato de una solicitud si existe backlog. Las empresas se descubren en páginas de hasta1000 desde OLTP, como máximo una enumeración por minuto. El inventario se provisiona en `tenant_settings` con INSERT ON CONFLICT DO NOTHING; no se guarda una lista de empresas completa en memoria ni se sobrescriben preferencias.

La cola de candidatos se pagina de100 en100 por UUID desde DW: programación vencida, solicitudes activas y reservas/runs que requieren recuperación. Este inventario técnico explícito sólo transporta identificadores; cada operación de recursos aplica `tenant_id`. No requiere repetir el inventario OLTP para atender una solicitud ya persistida. Si falla el inventario, se registra `BI_INVENTORY_UNAVAILABLE` y se siguen atendiendo candidatos conocidos; sus fallos de extracción quedan en runs.

Frecuencias 1/6/24 se alinean con UTC. Se observa siempre la hora **actual del DW**; no se generan cortes de horas perdidas. Primera configuración/reanudación/cambio de frecuencia hacen elegible la hora actual, sujeta a éxito y presupuesto existentes. Tras éxito o agotamiento, próxima ejecución = frontera UTC estrictamente posterior según las preferencias vigentes. Ese avance no modifica versión ni `updated_at` administrativos.

Manual tiene prioridad sobre carga automática del mismo tenant. Pausa elimina futuras cargas automáticas, conserva manuales y permite terminar la publicación activa. Una ejecución manual exitosa satisface la programación si estaba pendiente; no adelanta una programación que ya estaba en el futuro. Cambiar frecuencia no reinicia intentos ni permite otro éxito horario.

En modo continuo, un fallo se vuelve a intentar en una revisión posterior, hasta tres intentos durables por empresa/hora. `--once` hace un barrido acotado de candidatos, con hasta tres intentos por empresa; respeta pausa, frecuencia, cola, éxito y presupuesto. No fuerza cargas pausadas ni corta una hora antigua. Un fallo devuelve salida1; sin trabajo elegible finaliza correctamente.

## Transacciones, fases y recuperación

Toda reserva y transición de control obtiene advisory lock por tenant antes de bloquear estado/solicitudes. Las cargas automáticas/manuales comparten lease90s, heartbeat20s, token de exclusión y restricciones horarias. Dos workers pueden descubrir el mismo candidato; sólo uno reclama su empresa. Nunca se mantienen bloqueos DW durante la extracción OLTP completa.

Solicitud aceptada = pending. Claim atómico crea run con origen/manual/retry/scheduled/cli, fase extraction y estado running de la solicitud. Al terminar la extracción, guarda totales y `extraction_completed_at` con fase publication en la misma transacción. Antes de ello, conteos fuente son desconocidos; no deben mostrarse como cero. Destino conocido sólo tras éxito.

Publicación, éxito del run, éxito de la solicitud, cabecera y avance de programación se confirman juntos. Si falla la transición final de la solicitud, también revierten hechos, dimensiones y éxito del run. Tras una respuesta perdida después del COMMIT, el servicio consulta el run durable; si succeeded, no reintenta ni marca failed. La solicitud ya quedó succeeded por la misma transacción.

Después de un fallo recuperable, solicitud permanece running entre intentos y no admite cancelación. Al tercer intento o cambio de hora queda failed. Un corte OLTP de otra hora produce BI_SLOT_CHANGED, conserva el intento abandoned y finaliza esa solicitud; no la traslada al siguiente slot.

Caída después de reclamar: esperar vencimiento, registrar run anterior abandoned, limpiar sólo su staging, liberar reserva y continuar dentro del presupuesto. También se recuperan runs running huérfanos sin reserva viva. Tokens anteriores no pueden publicar ni liberar la reserva nueva. Todos los intentos se conservan.

Pendiente que no empezó al vencer su hora -> expired; running de una hora anterior sin lease vivo -> failed. Un retry posterior es otra solicitud actual vinculada al run failed/abandoned anterior. Una publicación que empezó a tiempo puede terminar después de vencer la hora, dentro de su deadline y lease. No se cancela desde el panel.

La señal del servicio usa `worker_health`: protocolo1, heartbeat independiente cada20s, incluso mientras una empresa carga, y stopping al salir. El futuro servicio de status considerará perdida la señal tras60s; esta fase no añade ese endpoint. Si cae DW, señal/ciclo fallan de forma segura; el bucle continúa y no informa aceptación ficticia.

SIGINT/SIGTERM detienen nuevas reservas y la espera del siguiente tick. La carga activa termina bajo su plazo de cinco minutos, con heartbeat vigente; después se registra stopping y se cierran conexiones. El supervisor necesita un grace period compatible; una terminación forzada se recupera por lease. No se modificó infraestructura.

## Despliegue pendiente

1. Mantener controles apagados y detener el worker antiguo durante toda la ventana. Esperar publicaciones y resolver reservas vencidas con el procedimiento autorizado antes del DDL; el migrador rechaza runs running/reservas.
2. Completar expansión/backfill/cierre temporal si corresponde, aplicar 0004 con ACK del entorno y provisionar permisos mínimos. No modificar migraciones anteriores.
3. Instalar el nuevo worker y ejecutar `--once` para verificar esquema, permisos, conciliación y programación. Instalar supervisor continuo independiente; no usar un cron horario como sustituto del bucle que atiende manuales.
4. Mantener API operativa y UI desactivadas hasta fases3/4 y aceptación5. La vigencia del dashboard y métricas existentes sigue su política anterior hasta integrar fase3; no certificar todavía alertas adaptadas a 6/24h.

Backup/restauración de controles y prueba de costo de polling con volumen representativo pertenecen a fase5. Preservar todas las tablas etl en backups; no borrar solicitudes, auditoría ni historial para liberar presupuestos. No retroceder al scheduler antiguo con configuración nueva.

## Verificación reproducible

Dos PostgreSQL18 descartables con `TEST_BI_SOURCE_DATABASE_URL` y `TEST_BI_WAREHOUSE_DATABASE_URL` externos. Suites crean/eliminan bases y roles aleatorios; sin variables se omiten explícitamente. No usar un servidor persistente.

```sh
npm test --workspace=@testimonial-cms/api -- --runTestsByPath \
  test/bi-worker.integration.spec.ts test/bi-scheduler.spec.ts test/bi-etl.spec.ts \
  test/bi-postgres.integration.spec.ts test/bi-operations.integration.spec.ts
```

La integración verifica extractor/escritor restringidos, aceptación durable con cliente cerrado, carreras manual/automática/dos workers, pausa, frecuencias, recuperación, agotamiento, vencimiento, retry actual, fases/cantidades, rollback final y respuesta perdida tras COMMIT. Fixtures sintéticas, sin certificar capacidad productiva ni autorización HTTP futura.
