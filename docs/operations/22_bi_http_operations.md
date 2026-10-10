# API de consulta y administración BI

**Estado:** fase3 implementada localmente, bandera desactivada por defecto, sin despliegue persistente. Interfaces implementadas y aceptación operativa integral local completada; despliegue pendiente según el [plan HITL](../plan/2026-10-09_feat-interfaces-operacion-bi.md). [Contrato y permisos SQL](../modules/api-bi-operations.md).

## Compatibilidad y provisión

HTTP y worker actuales requieren warehouse0004. La API no migra, no carga OLTP ni importa el scheduler. `BI_DATABASE_URL` usa pool2 de lectura; `BI_CONTROL_DATABASE_URL`, otro pool2 para solicitudes/configuración/auditoría. Ninguna conexión participa en readiness del CMS ni tiene fallback a su base transaccional. Sin las variables BI, CMS arranca y el módulo devuelve indisponibilidad.

El lector HTTP necesita SELECT de `dw` y `etl.tenant_settings/load_requests/control_audit/runs/tenant_load_state/worker_health`. El rol de control necesita permisos limitados publicados en el contrato, incluido SELECT de heartbeat; carece de escritura de hechos, runs, reservas y heartbeat. Verificar herencias, propietarios y privilegios efectivos, no sólo los GRANT nominales.

`BI_OPERATIONS_ENABLED=false` impide todas las nuevas rutas antes de consultar DW; dashboard existente conserva su bandera `BI_ENABLED`. Activación técnica requiere mantenimiento autorizado, detener el scheduler anterior, aplicar0004 sin alterar checksums anteriores, provisionar identidades y desplegar worker/API/web compatibles. No habilitar hasta validar el entorno objetivo y comprobar una carga. Apagar controles no elimina historial ni cambia configuración del worker.

## Ciclo de una solicitud

1. Admin obtiene status/settings de su sesión. Las acciones indican elegibilidad y motivo de bloqueo; no reservan capacidad.
2. POST /api/v1/bi/requests con Idempotency-Key y `{kind:"manual"}` o `{kind:"retry",retryOfRunId}`. No recibe tenant, actor, fechas ni secretos.
3. La API serializa por empresa, comprueba repetición, referencias propias, hora/presupuesto/reservas y señal reciente del worker. Inserta solicitud y auditoría en la misma transacción DW.
4. Sólo después de COMMIT devuelve202 `{success:true,data:{id,status:"accepted"}}`. Es pendiente de procesamiento, nunca prueba de publicación.
5. El worker independiente reclama y publica. Cerrar el navegador no afecta la cola. GET requests/:id devuelve estado durable e intentos; errores de publicación conservan el último corte correcto.
6. Si se pierde la respuesta HTTP, repetir exactamente la misma clave/cuerpo: devuelve el mismo ID, incluso terminal o sin worker vivo. Usar otra clave puede generar conflicto por solicitud activa, éxito horario o presupuesto. No repetir automáticamente con una clave nueva.

Sólo pending vigente admite cancelación. Cancelación requiere su propia Idempotency-Key y guarda transición/auditoría conjuntamente; running no se interrumpe. Un retry solicita observación actual, vinculado al fallo original; no reconstruye una hora pasada. Cambios de frecuencia/pausa no resetean intentos ni autorizan segundo éxito horario.

## Lecturas y diagnóstico

Admin/editor consultan dashboard/status/settings/runs/requests; sólo admin modifica y lee audit. Toda consulta de recursos se limita al tenant de sesión; otro tenant responde404. Listas entregan `{success:true,data:[...],meta:{total,page,limit}}`, inicialmente20/máximo100, rangoUTC30/máximo366 días. Fechas de runs corresponden al inicio y solicitudes/auditoría a creación.

Status observa reloj DW y metadatos en RR READ ONLY. No modifica solicitudes ni settings. Señal protocolo1 no detenida con antigüedad menor60s indica online, no garantiza ausencia de backlog. Una reserva vencida/run huérfano se informa como recuperación necesaria; la API no libera ni recupera reservas.

Vigencia = frecuencia+tolerancia; la fecha fuente es distinta de la de publicación. Pausa conserva edad y muestra schedule.paused/schedulePaused, pero no genera alerta de programación. Fallo sin éxito posterior, solicitud vencida y worker sin señal se distinguen; no se borra historia al recuperar. Conteo NULL significa desconocido, decimal string `'0'` significa extracción/publicación completa vacía. La métrica técnica stale comparte frecuencia+tolerancia y excluye pausas; edad absoluta sigue observable.

| Resultado | Acción del cliente |
| --- | --- |
| 400 | Corregir campos, rango, UUID o Idempotency-Key. |
| 401/403 | Renovar sesión o respetar permisos/CSRF vigentes; no insistir con otra identidad ajena. |
| 404 | El recurso no existe en la empresa de sesión. |
| 409 BI_SETTINGS_CONFLICT | Refrescar configuración; preservar edición local y resolver versión. |
| 409 de ejecución | Refrescar status y respetar solicitud/reserva/éxito/presupuesto. |
| 409 IDEMPOTENCY_KEY_REUSED | La clave tiene otro contenido; no tratarlo como aceptación nueva. |
| 429 | Esperar antes de volver a consultar o solicitar. |
| 503 BI_WORKER_UNAVAILABLE | Revisar supervisor/señal/conectividad del worker; no se guardó solicitud nueva. |
| 503 BI_UNAVAILABLE | Revisar DW/permisos/configuración; nunca afirmar aceptación sin receipt. |
| 503 BI_OPERATIONS_DISABLED | Controles no habilitados; conservar disponible el resto del CMS. |

Respuestas privadas incluso ante error; catálogo seguro para mensajes, nunca SQL, stacks, conexiones ni tokens globales. Cuotas por ruta/tenant/IP: lecturas120/min, creación6/min, configuración/cancelación20/min; mutaciones fallan cerradas si Redis no responde. Idempotencia DW se conserva sin purga automática y no usa el mecanismo OLTP de24h.

## Verificación y límites

Las suites `bi-operations-http.integration.spec.ts` y `bi-operations-policy.spec.ts` cubren permisos, aislamiento, CSRF, cuotas, validación, bandera, conflictos, receipts/replays, resultado publicado, indisponibilidad y alertas. El conjunto BI prueba dos PostgreSQL18 descartables con bases/roles aleatorios que elimina al terminar. Las URLs se inyectan externamente; no usar bases persistentes como destino de tests.

Typecheck/build/lint API y regresión verifican implementación local. La lectura de status contiene varias consultas acotadas dentro de una transacción y pool2 compartido con dashboard; el costo local con historial/polling concurrente se documenta en [validación integral](23_bi_validation_and_release.md). El benchmark HTTP/ETL ahora prepara0004 para seguir siendo compatible; los resultados históricos se conservan y fase5 agrega un benchmark operativo independiente. Backup/restauración local verificados; supervisor productivo, SLO y privilegios desplegados requieren validación del entorno objetivo.
