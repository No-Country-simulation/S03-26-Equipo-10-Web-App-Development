# Plan HITL: interfaces de consulta y administración BI

**Fecha:** 2026-10-09. **Estado:** fase 1 terminada, pendiente de revisión y ACK para fase 2. **ACK:** pedido «PLEASE IMPLEMENT THIS PLAN»; autoriza sólo la fase actual. [Contrato detallado](../modules/api-bi-operations.md).

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

### [Actual] 1. Contratos y persistencia

- [x] Documentar interfaces, transiciones, mínimos privilegios y compatibilidad.
- [x] Preparar 0004 sin alterar migraciones previas; registrar origen legacy y valores desconocidos.
- [x] Implementar conexión de control lazy, repositorios de configuración/solicitudes/cancelación/auditoría y lecturas paginadas por tenant.
- [x] Probar integridad, concurrencia, idempotencia, límites, rollback y privilegios en PostgreSQL descartable; completar checks API y evidencia.
- [x] Cerrar esta fase y detenerse antes del scheduler. No avanzar hasta ACK humano.

**Commit sugerido:** `feat(bi): agregá la persistencia y los contratos de operación`.

### [Pendiente] 2. Orquestación ETL

Integrar cola, programación y lock por tenant, origen/fase/extracción completa, heartbeat 20s y señal perdida tras 60s, vencimiento, recuperación y resultado atómico con publicación. Probar competencia automática/manual, dos workers, cruce UTC, pausa/reanudación, presupuestos y respuesta perdida tras COMMIT.

**Commit sugerido:** `feat(bi): integrá solicitudes y programación del ETL`.

### [Pendiente] 3. API operativa

Agregar endpoints/DTOs/servicios, guards/CSRF/cuotas, idempotencia y auditoría. Implementar status/acciones y alertas/vigencia; mantener DashboardRepository exclusivamente `dw`. Probar admin/editor/dos tenants, entradas inválidas, conflictos y caída DW.

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
