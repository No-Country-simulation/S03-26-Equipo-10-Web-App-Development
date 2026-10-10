# Contrato de operación BI

**Fecha:** 2026-10-09. **Estado:** persistencia, worker, API e interfaces implementados (fases 1–4); validación integral pendiente de fase 5. [Interfaz web](web-business-intelligence.md). [Plan](../plan/2026-10-09_feat-interfaces-operacion-bi.md). La bandera permanece desactivada por defecto; no hubo despliegue persistente.

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

Toda escritura de control y claim ETL obtiene primero el advisory lock `hashtextextended(tenant_id, 543004)`, luego las filas de estado/configuración/solicitud. Nunca orden inverso. El lock es por tenant, no global; colisiones de hash sólo serializan empresas adicionales. El worker anterior no participa: controles permanecen sin activar hasta reemplazarlo. El [worker nuevo](../operations/21_bi_worker_operations.md) requiere 0004 y siempre respeta la programación durable; la bandera limita los controles HTTP.

Configuración y auditoría se guardan en una transacción. Versión desactualizada -> `409 BI_SETTINGS_CONFLICT`; la UI conserva cambios y ofrece refrescar. La API no toca reservas ni reinicia presupuestos al editar.

## Solicitudes e idempotencia

POST requests recibe `{ kind: 'manual' }` o `{ kind: 'retry', retryOfRunId }`. El retry debe pertenecer al tenant y estar failed/abandoned; crea una observación actual. La respuesta pública es `202 { id, status: 'accepted' }` dentro del envelope vigente: confirma aceptación durable, no finalización; repeticiones devuelven el mismo ID. Consultar GET requests/:id para estado actual e intentos.

`Idempotency-Key` obligatorio de 1–128 caracteres ASCII alfanuméricos o `._:-`, sin espacios/saltos. Scope de creación = tenant/actor/operación; huella SHA256 de kind y retryOfRunId normalizados (UUID en minúsculas). Revisar repetición antes del estado horario; la misma clave sigue resolviendo su ID tras cancelación/finalización. Otra huella -> `IDEMPOTENCY_KEY_REUSED`. No purgar keys automáticamente en v1. Este contrato usa persistencia/idempotencia DW propia: no aplica `@Idempotent` ni el interceptor/repositorio OLTP de24h, que introduciría una atomicidad aparente entre servidores.

Para una solicitud **nueva**, la API exige señal de un worker protocolo1 no detenido en los últimos60s (`503 BI_WORKER_UNAVAILABLE` si falta). La consulta ocurre en la misma transacción de control, después de revisar idempotencia y límites; un replay durable no requiere worker vivo. La señal indica disponibilidad reciente, no garantiza inicio inmediato.

Una solicitud activa por tenant. Creación rechaza lease activo (`BI_ALREADY_RUNNING`), vencido o run huérfano (`BI_RECOVERY_REQUIRED`), otra solicitud activa (`BI_REQUEST_CONFLICT`), éxito horario (`BI_ALREADY_SUCCEEDED`) o tres intentos (`BI_ATTEMPTS_EXHAUSTED`). No crea un run ni consume presupuesto hasta que el worker reclama. El servidor calcula hora/expiración con reloj DW; acepta aun con programación pausada.

Estados: pending -> running -> succeeded/failed; pending -> cancelled/expired/skipped. Failed puede originarse antes de extracción. Una ejecución comenzada a tiempo puede finalizar después de expires_at dentro de su deadline; una pendiente nunca comienza en otra hora. Reintentos automáticos pertenecen a la misma solicitud mientras conservan hora/presupuesto; el worker conserva running hasta resultado terminal y usa lease para recuperación. Éxito de solicitud/run/hechos se confirma conjuntamente.

POST requests/:id/cancel requiere key y sólo cambia pending no vencida a cancelled, junto con auditoría. Scope de key de cancelación = tenant/actor/operación cancel; key repetida del mismo ID devuelve resultado cancelado; otra solicitud con esa key ->409. Cancelar otra empresa ->404; activa/terminal/vencida ->`BI_REQUEST_NOT_PENDING`. Una key nueva después de cancelación no vuelve a cancelar ni crea otra auditoría.

El repositorio verifica elegibilidad y registra solicitud/auditoría en una sola transacción DW. Si falla auditoría no queda solicitud confirmada. Las cancelaciones tampoco abortan ETL en curso.

## Lecturas y endpoints implementados

Todos bajo `/api/v1/bi`, JWT/sesión, RBAC, CSRF para mutaciones, `Cache-Control: private, no-store`. Usan errores/envelope, DTOs strict y cuotas vigentes. La bandera se comprueba después de autenticar/autorizar y antes de acceder a DW. El middleware privado se ejecuta antes de todos los guards, incluso CSRF.

| Ruta | Contrato |
| --- | --- |
| GET dashboard | Indicadores existentes; servicio aplica vigencia frecuencia+tolerancia manteniendo repositorio analítico sólo dw. |
| GET status | Configuración efectiva, próximo corte, solicitud/run activo, intentos restantes, señal del worker, alertas y permisos de acción con motivos. Señal perdida después de 60s; heartbeat20s. |
| GET runs | Envelope HTTP `{success:true,data:[...],meta:{total,page,limit}}`, filtro from/to/status/origin, orden startedAt DESC/id DESC. |
| GET runs/:id | Run propio con tiempos/fase/cantidades conocidas/código seguro, `errorMessage` y `actions.retry` vinculada a ese run. |
| GET requests | Mismo envelope/paginación, filtro from/to/status, orden createdAt DESC/id DESC. |
| GET requests/:id | `{request,runs,actions:{cancel}}` de la misma empresa, intentos en orden. |
| GET/PATCH settings | Defaults/versionado descritos arriba; PATCH admin. |
| POST requests | Aceptación idempotente, admin. |
| POST requests/:id/cancel | Cancelación idempotente, admin. |
| GET audit | Historial de acciones con actor técnico/configuración/referencia, sólo admin. |

Rango inclusivo UTC por inicio/creación, inicialmente30d y máximo366, nunca futuro. Página1/limit20, máximo100 y página10000, igual límite administrativo existente. Lecturas de lista y total comparten RR READ ONLY. Las respuestas internas `{items,meta}` son transformadas por el interceptor vigente a `data` y `meta` de primer nivel; no anidar `items` en `data`. Orígenes legados no se clasifican como automáticos ficticios. Los adaptadores web validan respuesta y conservan enteros grandes como texto.

Alertas: fallo terminal sin éxito posterior, solicitud vencida, worker sin señal y carga atrasada según frecuencia+tolerancia. Pausa suprime sólo atraso programado; preferencias desactivan avisos opcionales, no ocultan indisponibilidad/historial. Recuperación posterior no elimina intentos anteriores. No hay canales externos ni reconocimiento de incidentes en v1.


## Estado, acciones y política de vigencia

GET status entrega `observedAt/timezone`, `service`, `schedule`, `budget`, `activeRun`, `activeRequest`, `freshness`, `alerts` y `actions`. Usa una observación READ ONLY/RR con reloj DW; no crea configuración ni expira/modifica solicitudes al leer. El presupuesto pertenece a la hora UTC observada y tiene maxAttempts3/attemptsUsed/attemptsRemaining/succeeded.

`service` sólo expone status online/unavailable, lastSeenAt y heartbeatTimeoutSeconds60, nunca IDs de workers. `schedule` incluye paused/frequencyHours/nextScheduledAt/delayToleranceMinutes. Próxima ejecución es una previsión de elegibilidad, no una promesa de inicio: puede haber backlog, otra carga o presupuesto agotado.

Cada acción (`runNow`, `retry`, `cancel`, `updateSettings`) publica `{allowed,reason,message}`; retry incluye runId y cancel requestId, ambos de la empresa. Motivos: `BI_ADMIN_REQUIRED`, `BI_UNAVAILABLE`, `BI_ALREADY_RUNNING`, `BI_RECOVERY_REQUIRED`, `BI_REQUEST_CONFLICT`, `BI_ALREADY_SUCCEEDED`, `BI_ATTEMPTS_EXHAUSTED`, `BI_WORKER_UNAVAILABLE`, `BI_RETRY_NOT_ALLOWED`, `BI_REQUEST_NOT_PENDING`. Son indicaciones para UI: una carrera posterior puede devolver409 y debe refrescarse. Sólo pending vigente es cancelable, incluso si cae el worker. La configuración puede editarse con worker detenido, siempre que el control DW esté disponible. La presencia de URL no garantiza conectividad de escritura: el POST/PATCH confirma únicamente tras COMMIT.

La vigencia conserva status not_loaded/fresh/stale y añade `staleAfterSeconds`, `frequencyHours`, `delayToleranceMinutes`, `schedulePaused`; compara edad del corte fuente con frecuencia+tolerancia (stale sólo si la supera). Pausa no oculta la antigüedad factual, pero suprime `BI_SCHEDULE_DELAYED`. Si todavía no hubo corte, sólo una configuración persistida y vencida más allá de tolerancia genera atraso inicial; un default sin fila no inventa fecha de activación.

Alertas entregan code/severity/message y referencia propia opcional. `BI_LOAD_FAILED` y `BI_REQUEST_EXPIRED` se muestran si no hubo éxito posterior; falta de heartbeat siempre es visible. Un pending vencido durante caída del worker se explica como vencido sin alterar la fila desde GET. Preferencias alertFailures/alertDelays filtran alertas opcionales, no borran historial. `errorMessage` usa catálogo de explicaciones; código desconocido obtiene texto genérico, nunca el mensaje del driver. Fuente desconocida permanece NULL y no se publica porcentaje de progreso.

## Seguridad HTTP y cuotas

JWT/RolesGuard usan sesión/credenciales vigentes; mutaciones y auditoría requieren admin. CSRF global conserva Origin y token de sesión para cookies; Bearer explícito mantiene el contrato de clientes API. Toda ruta operativa rechaza campos desconocidos, IDs no UUID y claves ausentes/inválidas. Lecturas120/min, creación6/min, configuración/cancelación20/min por ruta, tenant e IP mediante Redis vigente. Mutaciones fallan cerradas si la cuota no está disponible. Respuestas usan Problem Details para400/401/403/404/409/429/503; ninguna excepción SQL se envía al navegador.

## Privilegios y activación

Provisionar externamente identidades reales, sin contraseñas en archivos. Ejemplo de permisos para el rol de control:

```sql
GRANT USAGE ON SCHEMA etl TO bi_control;
GRANT SELECT ON etl.tenant_settings, etl.load_requests, etl.control_audit,
    etl.runs, etl.tenant_load_state, etl.worker_health TO bi_control;
GRANT INSERT ON etl.tenant_settings, etl.load_requests, etl.control_audit TO bi_control;
GRANT UPDATE ON etl.tenant_settings TO bi_control;
GRANT UPDATE (status, finished_at, error_code) ON etl.load_requests TO bi_control;
```

No DELETE ni UPDATE de auditoría; no CREATE ni propiedad/herencia privilegiada. El lector HTTP `BI_DATABASE_URL` necesita SELECT sobre `dw` y las seis tablas operativas enumeradas; no necesita leer el ledger ni staging. Un lector limitado a `dw` sigue siendo suficiente para ejecutar directamente `DashboardRepository`; el servicio público combina sus resultados con configuración de `etl`. El rol de control sólo agrega SELECT de heartbeat para verificar disponibilidad antes de crear solicitudes; no puede modificarlo. Worker SELECT/INSERT/UPDATE sobre configuración/heartbeat, SELECT/UPDATE de solicitudes y SELECT del ledger, además de sus tablas vigentes; no necesita escribir auditoría ni crear solicitudes. Roles administrativos humanos no equivalen a usuarios SQL.

Al aplicar 0004, detener ETL, esperar publicaciones y comprobar ausencia de runs running/reservas incluso vencidas. Migrador verifica 0003, bloquea escrituras de control ETL y rechaza actividad antes de DDL. Repetición comprueba checksum. Añadir tablas no activa la bandera ni convierte el scheduler antiguo. La fase 3 registra providers de control en HTTP con una conexión independiente, sin importar servicios ETL.

No activar operaciones antes de fases 2/3/4 y aceptación integral. Caída DW no altera captura/moderación. Reversión de interfaz = apagar bandera; mantener datos de control y detener workers incompatibles, sin DROP ni borrado de historial automático.

## Evidencia de persistencia

Fase 1: 17 pruebas de integración PostgreSQL y cuatro unitarias nuevas; regresión BI completa de 79 casos. Ver [plan y resultados](../plan/2026-10-09_feat-interfaces-operacion-bi.md#evidencia-de-fase-1) y [operación/verificación del worker de fase2](../operations/21_bi_worker_operations.md). La fase 3 agrega59 pruebas (41 HTTP/integración y18 políticas), con roles SQL restringidos, alertas y bandera apagada; ver evidencia de su cierre en el plan. La fase 4 incorpora las interfaces, exportaciones y pruebas web; el costo del polling y la aceptación integral quedan para fase 5.

Para reproducir planes, usar una base **descartable vacía** con 0001–0004 y ejecutar `psql -v ON_ERROR_STOP=1 -f apps/api/test/fixtures/bi-operations-plans.sql` con conexión local provista por operación. La fixture usa 100 empresas con 200 horas de historia y 500 solicitudes pendientes de empresas adicionales; hace ROLLBACK. No ejecutarla sobre un entorno persistente.

PostgreSQL 18.6 eligió `idx_bi_request_queue`, `idx_bi_request_history`, `idx_bi_run_history`, `idx_bi_audit_history` y un Bitmap Index Scan por tenant para el conteo, sin modificar parámetros del optimizador. Tiempos de ejecución locales 0,068–0,325ms y 4–10 buffers compartidos por consulta. La muestra sirve para revisar índices; volumen real, filtros, costo de polling y restauración operativa se medirán en fase 5.
