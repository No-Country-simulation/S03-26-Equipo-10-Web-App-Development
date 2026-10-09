# Plan HITL: interfaces de consulta y administración BI

**Fecha:** 2026-10-09. **Estado:** fase 3 terminada, pendiente de revisión y ACK para fase 4. **ACK:** «Continua» después del cierre de fase 2; autoriza exclusivamente la API operativa de fase 3. [Contrato detallado](../modules/api-bi-operations.md).

## Contexto y Restricciones

- Respetar [AGENTS.md](../../AGENTS.md): una fase por ejecución, evidencia y commit sugerido al finalizar, ACK antes de avanzar. Esta entrega no autoriza infraestructura, Prisma, migraciones persistentes ni agrupar fases.
- El checkout estaba limpio. Preservar cualquier cambio local posterior. Skills: PostgreSQL, contratos API, TypeScript y frontend Next.js; usar el mecanismo de sesión vigente.
- Warehouse con 0001/0002/0003 y tiempo dimensional implementado; dashboard consulta sólo `dw`. ETL independiente con reconciliación completa por empresa, publicación ACID, lease/fencing y límites horarios durables.
- El plan completo requiere backend, control durable y frontend. La fase 1 prepara persistencia/contratos; no habilita endpoints ni altera el scheduler. Infraestructura, paquete raíz, hooks y `schema.prisma` quedan fuera de esta fase.
- No ejecutar DDL en entornos persistentes. Validar en bases aleatorias de PostgreSQL descartable. Conservar las tres migraciones existentes y sus checksums.

## Decisiones confirmadas

- Admin consulta, descarga CSV, configura y opera su empresa; editor consulta indicadores, historial/alertas y descarga CSV. Toda autorización se aplica en NestJS; tenant sólo de sesión.
- Frecuencia 1/6/24 horas UTC, inicialmente 1. Una publicación exitosa por empresa/hora y máximo tres intentos compartidos entre cargas automáticas/manuales.
- Alertas dentro del módulo; fallos y atrasos habilitados inicialmente, tolerancia 30/60/120 minutos, default 60. Vigencia = frecuencia + tolerancia; pausa suspende la alerta de atraso programado.
- Pausa detiene futuras cargas automáticas; carga activa termina y manuales siguen permitidas. Reintento observa estado actual, vinculado al fallo anterior; no reconstruye horas pasadas.
- CSV separados de resumen, estados, categorías y serie diaria desde los datos autorizados visibles; UTC, cantidades decimales, escape y neutralización de fórmulas, sin dependencias nuevas.
- Servidores, credenciales, migraciones, recursos, abortos forzados, CDC, SQL libre, panel global, PDF y notificaciones externas fuera del alcance de interfaz.

## Experiencia objetivo

`/admin/business-intelligence` conserva Resumen; navegación interna agrega Ejecuciones, detalle, Operación y Configuración. Admin accede además a auditoría administrativa. Cada vista soporta carga, vacío, error, falta de permisos y OLAP indisponible, móvil, teclado y feedback accesible.

- Resumen: indicadores existentes, rango/gráfico/tablas, vigencia según programación y CSV. «Actualizar vista» sólo vuelve a consultar.
- Ejecuciones: solicitudes y runs paginados, filtros en URL por fecha/estado/origen. Detalle: fase, tiempos, cantidades conocidas y errores seguros; desconocido no equivale a cero.
- Operación: worker, carga activa, próxima ejecución, presupuesto y acciones con motivo de bloqueo. «Ejecutar ahora» devuelve aceptación pendiente, nunca éxito anticipado.
- Configuración: frecuencia, pausa/reanudación, preferencias/tolerancia. Versión esperada impide sobrescribir cambios concurrentes; editor sólo lectura.
- Polling 5s con solicitud activa y 30s en Operación; parar al ocultar pestaña y refrescar al volver. Limpiar datos ante cambio de identidad y no publicar respuestas obsoletas.

## Persistencia, API y orquestación acordadas

0004 agrega configuración, solicitudes, auditoría y heartbeat en `etl`; extiende runs con origen, solicitud, fase y fin de extracción. Datos previos quedan `legacy`. No copiar identidades personales ni secretos.

- `BI_OPERATIONS_ENABLED=false` inicialmente; `BI_CONTROL_DATABASE_URL` independiente para control HTTP. Nunca fallback OLTP. API no modifica hechos/runs/leases/ledger; worker conserva sus credenciales propias.
- Solicitud, idempotencia y auditoría se confirman en una misma transacción DW. Cancelación de pendiente y auditoría también; no transacciones distribuidas aparentes.
- Scheduler revisa trabajo cada 15s, una empresa a la vez; inventario paginado como máximo cada minuto. Reserva existente y lock compartido por empresa coordinan con las nuevas operaciones.
- Solicitud manual pertenece a su hora de aceptación; si no empieza antes de terminar, expira. Una solicitud activa por empresa; cancelar sólo pending. Éxito de solicitud se confirma con publicación; recuperación conserva intentos y fencing.
- Frecuencias alineadas UTC: cada hora, 00/06/12/18, o 00. Al reanudar/cambiar frecuencia, observar hora actual si se permite, luego siguiente frontera alineada. Fallos de servicio no fabrican historia; `--once` acotado respeta límites/configuración.
- Contratos `/bi`: GET dashboard/status/runs/runs/:id/requests/requests/:id/settings; PATCH settings; POST requests y requests/:id/cancel; GET audit exclusivo admin. Lecturas admin/editor; mutaciones admin. CSRF, validación estricta, idempotencia, cuotas y respuestas privadas.
- Historial 30 días por defecto, máximo 366 UTC; página 20, máximo 100. Otra empresa responde 404. No exponer conexiones, stacks, SQL ni token de métricas.

## Fases

### [Completada] 1. Contratos y persistencia

- [x] Documentar interfaces, transiciones, mínimos privilegios y compatibilidad.
- [x] Preparar 0004 sin alterar migraciones previas; registrar origen legacy y valores desconocidos.
- [x] Implementar conexión de control lazy, repositorios de configuración/solicitudes/cancelación/auditoría y lecturas paginadas por tenant.
- [x] Probar integridad, concurrencia, idempotencia, límites, rollback y privilegios en PostgreSQL descartable; completar checks API y evidencia.
- [x] Cerrar esta fase y detenerse antes del scheduler. No avanzar hasta ACK humano.

**Commit sugerido:** `feat(bi): agregá la persistencia y los contratos de operación`.

### [Completada] 2. Orquestación ETL

Integrar cola, programación y lock por tenant, origen/fase/extracción completa, heartbeat 20s y señal perdida tras 60s, vencimiento, recuperación y resultado atómico con publicación. Probar competencia automática/manual, dos workers, cruce UTC, pausa/reanudación, presupuestos y respuesta perdida tras COMMIT.

- [x] Entrada CLI con protocolo1/0004 obligatorio, polling15s sin solapamientos, inventario paginado<=1/min y candidato DW acotado, una empresa por vez.
- [x] Solicitudes priorizadas, frecuencia/pausa UTC, presupuesto compartido y éxito conjunto con hechos/run; no trasladar solicitudes a otra hora.
- [x] Fases/cantidades conocidas, señal independiente del worker, recuperación de leases y runs huérfanos, fencing y apagado con drenaje.
- [x] Integración con dos PostgreSQL descartables y roles restringidos, regresión BI y documentación de compatibilidad/permisos.
- [x] Cerrar fase y detenerse antes de endpoints. API/frontend operativos siguen desactivados.

**Commit sugerido:** `feat(bi): integrá solicitudes y programación del ETL`.

### [Actual] 3. API operativa

Agregar endpoints/DTOs/servicios, guards/CSRF/cuotas, idempotencia y auditoría. Implementar status/acciones y alertas/vigencia; mantener DashboardRepository exclusivamente `dw`. Probar admin/editor/dos tenants, entradas inválidas, conflictos y caída DW.

- [x] Registrar endpoints/DTOs y repositorios DW independientes; no ejecutar ETL dentro de HTTP.
- [x] Autenticar tenant/actor de sesión, RBAC admin/editor, CSRF vigente, cuotas y respuestas privadas incluso ante errores.
- [x] Solicitudes/cancelación idempotentes, configuración versionada, auditoría y explicaciones seguras.
- [x] Estado, acciones permitidas/motivos, señal del worker y política de vigencia/alertas según frecuencia y pausa.
- [x] Completar regresión con dos PostgreSQL descartables, checks API y documentación; cerrar y detenerse antes de frontend.

**Commit sugerido:** `feat(bi): exponé la operación y la configuración por empresa`.

### [Pendiente] 4. Frontend

Agregar navegación/pantallas/seguimiento, formularios con versión, CSV y estados accesibles. Validar contratos con Zod, permisos/identidad, filtros URL, polling visible y errores recuperables. Revisar visualmente móvil/escritorio/teclado.

**Commit sugerido:** `feat(web): incorporá las interfaces completas de inteligencia de negocio`.

### [Pendiente] 5. Validación integral

Verificar solicitud durable tras cerrar navegador, recuperación ante fallos, regresión BI/OLTP, backup/restauración de controles/historial, mínimos privilegios y costo polling/consultas con planes y volumetría explícita. Actualizar runbooks/contexto y checklist de despliegue. No certificar capacidad productiva con fixtures.

**Commit sugerido:** `test(bi): validá las interfaces y la recuperación operativa`.

## Despliegue y aceptación

Requiere entorno/backup/ventana/ACK específicos. Detener worker anterior y deshabilitar controles; aplicar migración autorizada, provisionar roles, instalar worker/API/web compatibles, verificar una carga y habilitar operaciones. No activar controles con scheduler antiguo. La migración no habilita capacidades automáticamente.

Aceptación: admin solicita, cierra página y recupera resultado persistente; editor consulta sin mutar; dos empresas permanecen aisladas; un fallo no desplaza el último corte correcto ni duplica publicaciones.

## Evidencia de fase 1

- 0004 agrega cuatro tablas de control y columnas/constraints/índices en runs. Las migraciones 0001–0003 permanecen intactas; se verificaron checksums, repetición y rechazo de ejecución activa/reserva, incluso vencida.
- Repositorios de lectura por empresa y control transaccional preparados, sin registrarlos en HTTP: conexión lazy/pool2, escrituras y auditoría atómicas, versión esperada, idempotencia persistente, cancelación sólo pendiente, claves compuestas y restricción de una solicitud activa.
- Ocho suites BI: **79 pruebas aprobadas**, con dos instancias PostgreSQL 18.6 descartables. Incluyen las **21 pruebas nuevas** (17 integración/4 unitarias), conciliación y regresiones ETL/tiempo dimensional/dashboard/HTTP. Se repitieron las 21 nuevas tras los ajustes finales de DDL.
- `npm run typecheck --workspace apps/api`, `npm run build --workspace apps/api` y `npm run lint --workspace apps/api` aprobados. Lint conserva sólo dos advertencias preexistentes en idempotency/public-testimonials; ninguna advertencia nueva.
- Planes `EXPLAIN (ANALYZE, BUFFERS)` con 20.500 solicitudes, 20.000 runs y 20.500 auditorías sintéticas: índices para cola, tres historiales y conteo; ejecución local 0,068–0,325ms, sin forzar el optimizador. Fixture reproducible en `apps/api/test/fixtures/bi-operations-plans.sql`; no certifica capacidad productiva, costo de polling ni filtros de las futuras pantallas.
- Sin migraciones persistentes, cambios de infraestructura, Prisma, dependencias o commits automáticos. Bases y roles de prueba eliminados. Fases 2–5 pendientes; no hay nuevas operaciones habilitadas ni pantallas administrativas adicionales.

## Evidencia de fase 2

- `ManagedWarehouseRepository` usa el mismo advisory lock por UUID canónico que el control, antes del estado/solicitud. Mantiene los primitivos de publicación verificados; reserva, fase, reintento, recuperación, éxito de solicitud y avance de programación respetan tenant y presupuesto. Los cambios de mayúsculas del UUID no evaden el bloqueo.
- `WorkerControlRepository` y `EtlScheduler`: configuración provisionada sin sobrescrituras, inventario en páginas de1000 y como máximo una vez por minuto, candidatos DW de100, polling15s sin ciclos superpuestos y una empresa a la vez por proceso. `--once` respeta controles y límites; origen CLI/scheduled sólo cuando no hay solicitud manual/retry.
- Heartbeat independiente20s/protocolo1 y marca stopping; pérdida prevista tras60s en el futuro servicio de status. SIGTERM/SIGINT detienen nuevas reservas y drenan carga activa<=5min. Fallo de inventario no impide atender solicitudes conocidas; fallo DW no confirma resultados inexistentes.
- **106 pruebas aprobadas en diez suites BI**, con dos PostgreSQL18.6 descartables. Incremento de27 casos: 19 integración del worker, cinco scheduler y tres ciclo ETL; aceptación durable después de cerrar cliente, carreras auto/manual/dos workers/cancelación, frecuencias, pausa, agotamiento, fases/desconocidos, vencimiento, recuperación/retry actual, rollback de transición final y respuesta perdida tras COMMIT.
- Tras el ajuste de UUID canónico se repitieron **36 pruebas de integración** control/worker. Se verificó contención entre representaciones del mismo UUID y ausencia de solicitudes parciales. Tras separar el evento técnico de inventario de los resultados por tenant, se repitieron **18 pruebas unitarias** de scheduler/ETL. Tests/typecheck/build/lint API aprobados; lint conserva sólo dos advertencias preexistentes.
- No se modificaron migraciones 0001–0004, infraestructura, Prisma, dependencias ni hooks. DDL de prueba sólo en bases aleatorias descartables; roles/bases eliminados al terminar. Nuevo [runbook del worker](../operations/21_bi_worker_operations.md) y documentación/contexto actualizados.
- Pendiente: endpoints/RBAC/CSRF/cuotas/alertas y vigencia en fase3, pantallas/CSV/polling web en fase4, restauración de controles, capacidad y costo de polling en fase5. Sin despliegue persistente y sin controles nuevos habilitados.


## Evidencia de fase 3

- `BiOperationsController` y DTOs strict exponen las diez rutas operativas acordadas, además del dashboard existente. Admin/editor consultan; sólo admin muta y consulta auditoría. Tenant/actor se obtienen de sesión; IDs ajenos devuelven404 y no aceptan tenant/actor/horas del navegador. Middleware privado cubre incluso errores de guards.
- Mecanismos HTTP vigentes: JWT/roles, CSRF global de cookies/Bearer explícito y cuotas por ruta/tenant/IP. Creación6/min, settings/cancel20/min, lecturas120/min. Mutaciones fallan cerradas ante cuota caída. Respuesta202 confirma un receipt estable, sin ejecutar ETL en HTTP; GET devuelve ciclo durable e intentos.
- Repositorios DW registrados mediante conexión de lectura y conexión de control pool2 independientes y lazy. Control sólo settings/requests/audit; comprobación de worker vivo dentro de su transacción, después de resolver replay. Claves permanecen durables tras cancelación/éxito/worker detenido; UUIDs de reintento/cancelación canónicos. `BiConnection` preserva errores de aplicación como404 y traduce fallos técnicos a503 seguro.
- Servicio status READ ONLY/RR con reloj DW, worker protocolo1/señal<60s, actividad propia, próximo horario y presupuesto compartido. Acciones devuelven permiso/motivo, incluidos recuperación, éxito horario, intentos agotados y worker ausente. Catálogo seguro de mensajes; cantidades desconocidas NULL. Lectura nunca altera cola/configuración.
- Alertas separadas de fallo sin recuperación, vencimiento, ausencia de señal y atraso. Frecuencia+tolerancia, pausa explícita/supresión de atraso, preferencias y recuperación sin borrar historial. `DashboardRepository` permanece intacto y consulta exclusivamente `dw`; servicio combina settings/metadatos. La métrica técnica stale también respeta frecuencia+tolerancia y excluye pausas.
- **165 casos BI distintos aprobados**, en12 suites: regresión completa inicial de163; tras los últimos ajustes se repitieron los afectados y se incorporaron dos casos más (métrica configurable y desconexión real). Nuevos59 = **41 HTTP/integración** + **18 políticas**. Dos PostgreSQL18.6 descartables y roles de lectura/control restringidos; autenticación/roles/tenant, CSRF, validación, cuotas, conflictos, idempotencia/concurrencia, presupuesto, vacío/desconocido y receipt/resultados durables.
- Las pruebas terminan conexiones SQL de los roles temporales y niegan nuevos logins para simular pérdida de acceso; status/dashboard/creación responden503 sin falsa aceptación. Al restaurar LOGIN, configuración/auditoría permanecen y no existe solicitud parcial. Fallo de INSERT de auditoría revierte solicitud; ausencia de SELECT se informa sin SQL/stack/conexiones.
- Ocho pruebas adicionales de CSRF/cuotas vigentes aprobadas. Una prueba integral preexistente de cookies se omitió explícitamente por falta de `TEST_DATABASE_URL`/`TEST_REDIS_URL`; el nuevo HTTP BI sí ejercita cookies, Origin y token CSRF reales del guard con credenciales sintéticas. No se afirma ejecutar toda la suite del CMS ni integración Redis en esta fase.
- `npm run typecheck --workspace apps/api`, `npm run build --workspace apps/api`, `npm run lint --workspace apps/api` aprobados; lint conserva sólo dos advertencias preexistentes fuera de BI. `git diff --check` sin problemas.
- Documentación de contratos/roles y [runbook API](../operations/22_bi_http_operations.md) actualizados. Fixture del benchmark HTTP/ETL prepara0004 para compatibilidad; no se repitió prueba de carga ni se alteraron resultados históricos. Costo de status/polling, restauración de controles y SLO siguen en fase5.
- Sin cambios de migraciones0001–0004, Prisma, infraestructura, dependencias ni hooks; sin despliegue ni commit automático. Bandera desactivada por defecto. Pruebas eliminaron sus bases/roles (0 remanentes en ambas instancias); PostgreSQL temporales apagados y directorios propios eliminados. Frontend/CSV/polling web quedan exclusivamente para fase4 tras ACK.
