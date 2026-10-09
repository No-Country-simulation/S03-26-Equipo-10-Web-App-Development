# Contrato de operación BI

**Fecha:** 2026-10-09. **Estado:** fase 1, persistencia y contratos; endpoints/worker/frontend pendientes de fases posteriores. [Plan](../plan/2026-10-09_feat-interfaces-operacion-bi.md). No confundir esta preparación con la consola ya disponible.

## Roles, fronteras y disponibilidad

Admin opera su empresa; editor lee indicadores, historial, alertas/configuración y descarga CSV. Auditoría sólo admin. NestJS autentica/autoriza; recursos llevan tenant de sesión en consultas y asociaciones, nunca tenant del body/query. Otra empresa devuelve 404.

`BI_ENABLED` sigue controlando BI; `BI_OPERATIONS_ENABLED` habilita las nuevas operaciones y empieza false. `BI_CONTROL_DATABASE_URL` es la identidad DW de control, pool 2, conexión lazy, sin participación en readiness. Sin configuración/destino: `BI_UNAVAILABLE`. Operaciones apagadas: `BI_OPERATIONS_DISABLED`. El worker no depende del proceso HTTP y conserva extractor/escritor separados.

La API no puede escribir hechos, dimensiones, runs, leases, ledger de migraciones ni heartbeat. La transacción de control usa UTC, SQL5s/lock1s/transacción10s/espera1s. No fallback OLTP, ni ejecución ETL dentro de HTTP. El esquema requiere 0001/2/3/4, con migración manual y ledger/checksum.

## Modelo de control

| Tabla | Granularidad y contrato |
| --- | --- |
| `etl.tenant_settings` | Una empresa: frecuencia 1/6/24, programación habilitada, próxima hora UTC o NULL al pausar, alertas de fallos/atrasos, tolerancia 30/60/120, versión positiva y actualización. Sin FK a dimensión: válida antes de primera publicación. |
| `etl.load_requests` | Una solicitud manual/retry: UUID, tenant, actor UUID técnico, clave/huella, hora/expires, estado y tiempos, error acotado, referencia compuesta al fallo anterior. UNIQUE activo por tenant y clave por tenant/actor. |
| `etl.control_audit` | Acción administrativa append-only: actor UUID, instante, configuración antes/después o referencia a solicitud. Sin texto libre. Clave de cancelación única por tenant/actor. |
| `etl.worker_health` | Señal técnica por worker UUID, protocolo 1, inicio/última señal y parada; sólo el worker escribe. La API publica un agregado de disponibilidad, nunca worker IDs ni inventario de empresas. |

Runs conservan su PK y límites existentes, más `request_id`, `origin` (`legacy/scheduled/cli/manual/retry`), fase opcional `extraction/publication` y `extraction_completed_at`. FK compuesta exige tenant, solicitud, tipo y hora coherentes. Migración clasifica como `legacy` lo previo; no inventa fases ni fin de extracción.

Los conteos fuente se muestran como NULL si no consta extracción completa, salvo éxitos legados cuyo contrato ya exige conciliación. Conteos destino sólo para éxito. Todos los conteos de filas viajan como cadenas decimales, incluso cero; duración NULL mientras no termina. No exponer hashes/keys de idempotencia, lease/token ni actor en la consulta de solicitudes/runs; actor técnico sólo en auditoría admin.

## Configuración y concurrencia

GET settings retorna `frequencyHours`, `scheduleEnabled`, `nextScheduledAt`, `alertFailures`, `alertDelays`, `delayToleranceMinutes`, `version`, `updatedAt`. Sin fila, defaults 1/true/hora UTC actual/true/true/60 y versión0/updatedAtNULL; lectura no provisiona filas.

PATCH recibe `expectedVersion` y al menos una preferencia editable; rechaza campos desconocidos. Admin no envía `nextScheduledAt`, tenant, timestamps ni una versión nueva. Primera configuración/resume/cambio de frecuencia hacen elegible el corte actual; después el worker avanza al próximo múltiplo UTC. Cambios de alertas conservan próxima ejecución. Pausa deja next NULL. El avance del worker no incrementa la versión de preferencias; ambos procesos usan el mismo lock para no perder ese avance.

Toda escritura de control y futuro claim ETL obtiene primero el advisory lock `hashtextextended(tenant_id, 543004)`, luego las filas de estado/configuración/solicitud. Nunca orden inverso. El lock es por tenant, no global; colisiones de hash sólo serializan empresas adicionales. El worker anterior no participa: controles permanecen sin activar hasta reemplazarlo.

Configuración y auditoría se guardan en una transacción. Versión desactualizada -> `409 BI_SETTINGS_CONFLICT`; la UI conserva cambios y ofrece refrescar. La API no toca reservas ni reinicia presupuestos al editar.

## Solicitudes e idempotencia

POST requests recibe `{ kind: 'manual' }` o `{ kind: 'retry', retryOfRunId }`. El retry debe pertenecer al tenant y estar failed/abandoned; crea una observación actual. La respuesta pública prevista es `202 { id, status: 'accepted' }` dentro del envelope vigente: confirma aceptación durable, no finalización; repeticiones devuelven el mismo ID. Consultar GET requests/:id para estado actual e intentos.

`Idempotency-Key` obligatorio de 1–128 caracteres ASCII alfanuméricos o `._:-`, sin espacios/saltos. Scope de creación = tenant/actor/operación; huella SHA256 de kind y retryOfRunId normalizados. Revisar repetición antes del estado horario; la misma clave sigue resolviendo su ID tras cancelación/finalización. Otra huella -> `IDEMPOTENCY_KEY_REUSED`. No purgar keys automáticamente en v1.

Una solicitud activa por tenant. Creación rechaza lease activo (`BI_ALREADY_RUNNING`), vencido o run huérfano (`BI_RECOVERY_REQUIRED`), otra solicitud activa (`BI_REQUEST_CONFLICT`), éxito horario (`BI_ALREADY_SUCCEEDED`) o tres intentos (`BI_ATTEMPTS_EXHAUSTED`). No crea un run ni consume presupuesto hasta que el worker reclama. El servidor calcula hora/expiración con reloj DW; acepta aun con programación pausada.

Estados: pending -> running -> succeeded/failed; pending -> cancelled/expired/skipped. Failed puede originarse antes de extracción. Una ejecución comenzada a tiempo puede finalizar después de expires_at dentro de su deadline; una pendiente nunca comienza en otra hora. Reintentos automáticos pertenecen a la misma solicitud mientras conservan hora/presupuesto; fase 2 debe conservar running hasta resultado terminal y usar lease para recuperación.

POST requests/:id/cancel requiere key y sólo cambia pending no vencida a cancelled, junto con auditoría. Scope de key de cancelación = tenant/actor/operación cancel; key repetida del mismo ID devuelve resultado cancelado; otra solicitud con esa key ->409. Cancelar otra empresa ->404; activa/terminal/vencida ->`BI_REQUEST_NOT_PENDING`. Una key nueva después de cancelación no vuelve a cancelar ni crea otra auditoría.

El repositorio verifica elegibilidad y registra solicitud/auditoría en una sola transacción DW. Si falla auditoría no queda solicitud confirmada. Las cancelaciones tampoco abortan ETL en curso.

## Lecturas y endpoints previstos

Todos bajo `/api/v1/bi`, JWT/sesión, RBAC, CSRF para mutaciones, `Cache-Control: private, no-store`. Reutilizar errores/envelope, DTOs strict y cuotas existentes al integrar fase 3.

| Ruta | Contrato |
| --- | --- |
| GET dashboard | Indicadores existentes; servicio aplica vigencia frecuencia+tolerancia manteniendo repositorio analítico sólo dw. |
| GET status | Configuración efectiva, próximo corte, solicitud/run activo, intentos restantes, señal del worker, alertas y permisos de acción con motivos. Señal perdida después de 60s; heartbeat20s. |
| GET runs | `{items,meta:{total,page,limit}}`, filtro from/to/status/origin, orden startedAt DESC/id DESC. |
| GET runs/:id | Run propio con tiempos/fase/cantidades conocidas/código seguro. |
| GET requests | Mismo envelope/paginación, filtro from/to/status, orden createdAt DESC/id DESC. |
| GET requests/:id | `{request,runs}` de la misma empresa, intentos en orden. |
| GET/PATCH settings | Defaults/versionado descritos arriba; PATCH admin. |
| POST requests | Aceptación idempotente, admin. |
| POST requests/:id/cancel | Cancelación idempotente, admin. |
| GET audit | Historial de acciones con actor técnico/configuración/referencia, sólo admin. |

Rango inclusivo UTC por inicio/creación, inicialmente30d y máximo366, nunca futuro. Página1/limit20, máximo100 y página10000, igual límite administrativo existente. Lecturas de lista y total comparten RR READ ONLY. Orígenes legados no se clasifican como automáticos ficticios. Los adaptadores web validan respuesta y conservan enteros grandes como texto.

Alertas previstas: fallo terminal sin éxito posterior, solicitud vencida, worker sin señal y carga atrasada según frecuencia+tolerancia. Pausa suprime sólo atraso programado; preferencias desactivan avisos opcionales, no ocultan indisponibilidad/historial. Recuperación posterior no elimina intentos anteriores. No hay canales externos ni reconocimiento de incidentes en v1.

## Privilegios y activación

Provisionar externamente identidades reales, sin contraseñas en archivos. Ejemplo de permisos para el rol de control:

```sql
GRANT USAGE ON SCHEMA etl TO bi_control;
GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit,
    etl.runs, etl.tenant_load_state TO bi_control;
GRANT INSERT ON etl.tenant_settings, etl.load_requests, etl.control_audit TO bi_control;
GRANT UPDATE ON etl.tenant_settings TO bi_control;
GRANT UPDATE (status, finished_at, error_code) ON etl.load_requests TO bi_control;
```

No DELETE ni UPDATE de auditoría; no CREATE ni propiedad/herencia privilegiada. Lector operativo SELECT sobre tablas nuevas/worker health; lector del dashboard exclusivamente dw sigue suficiente para su repositorio analítico. Worker DML sobre configuración/solicitudes/heartbeat además de sus tablas vigentes; auditoría sólo INSERT cuando corresponde. Roles administrativos humanos no equivalen a usuarios SQL.

Al aplicar 0004, detener ETL, esperar publicaciones y comprobar ausencia de runs running/reservas incluso vencidas. Migrador verifica 0003, bloquea escrituras de control ETL y rechaza actividad antes de DDL. Repetición comprueba checksum. Añadir tablas no habilita endpoints ni convierte el scheduler antiguo; fase 1 no registra providers de control en el módulo HTTP.

No activar operaciones antes de fases 2/3/4 y aceptación integral. Caída DW no altera captura/moderación. Reversión de interfaz = apagar bandera; mantener datos de control y detener workers incompatibles, sin DROP ni borrado de historial automático.

## Evidencia de persistencia

Fase 1: 17 pruebas de integración PostgreSQL y cuatro unitarias nuevas; regresión BI completa de 79 casos. Ver [plan y resultados](../plan/2026-10-09_feat-interfaces-operacion-bi.md#evidencia-de-fase-1). Los guards, endpoints, worker y UI se validarán al implementar sus fases; estos tests no certifican autorización HTTP nueva.

Para reproducir planes, usar una base **descartable vacía** con 0001–0004 y ejecutar `psql -v ON_ERROR_STOP=1 -f apps/api/test/fixtures/bi-operations-plans.sql` con conexión local provista por operación. La fixture usa 100 empresas con 200 horas de historia y 500 solicitudes pendientes de empresas adicionales; hace ROLLBACK. No ejecutarla sobre un entorno persistente.

PostgreSQL 18.6 eligió `idx_bi_request_queue`, `idx_bi_request_history`, `idx_bi_run_history`, `idx_bi_audit_history` y un Bitmap Index Scan por tenant para el conteo, sin modificar parámetros del optimizador. Tiempos de ejecución locales 0,068–0,325ms y 4–10 buffers compartidos por consulta. La muestra sirve para revisar índices; volumen real, filtros, costo de polling y restauración operativa se medirán en fase 5.
