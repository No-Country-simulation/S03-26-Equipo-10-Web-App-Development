# BI: validación integral, restauración y habilitación

**Validación local:** 2026-10-09 (resultados UTC del 10/10). Fase 5 del [plan](../plan/2026-10-09_feat-interfaces-operacion-bi.md). Implementación validada en servicios descartables; sin despliegue persistente. Controles desactivados por defecto. [Resultados del benchmark](../technical/bi-operations-benchmark-2026-10-10.json).

## Entorno y evidencia

Dos PostgreSQL 18.6 independientes en loopback, cada uno con `shared_buffers=32MB` y `max_connections=30`; zona del servidor `America/Argentina/Buenos_Aires`. Redis 7 descartable real, sin persistencia. Node 24.21.0, NestJS y Next.js del lockfile. El CMS usa DDL generado desde Prisma más las vistas de exportación: esto **no** reproduce toda la cadena histórica de migraciones OLTP.

`bi-system.integration.spec.ts` arranca el AppModule completo, autenticación real con sesiones almacenadas en OLTP, guards y Redis sin reemplazos. El worker se ejecuta como otro proceso mediante la CLI real. Las identidades SQL de extracción, publicación, lectura y control son distintas. Cada fixture crea y elimina sus propias bases y roles aleatorios.

La integración verifica:

- POST aceptado sin ejecutar ETL en HTTP; API cerrada y reabierta; el worker publica y la misma solicitud conserva su ID al repetir la clave. Dashboard concilia 1 testimonio, 2 vistas, 1 clic, 1 reproducción y CTR 50 %. Editor consulta, no muta; otra empresa recibe 404.
- Un trigger sintético rechaza la transición final a éxito. Se revierten los hechos y el éxito del run, se consumen tres intentos registrados y el dashboard conserva el corte anterior. El error público no contiene el mensaje del driver.
- Dump completo y restauración en **otra base vacía**, comparación de cantidad y digest de todas las tablas `dw`, `etl` y `staging`, incluidas migraciones, controles, auditoría, heartbeat e idempotencia. Los roles ya existen en el servidor; `pg_restore --no-owner` conserva ACL. Una solicitud restaurada pendiente se publica con la CLI restringida; un segundo barrido no agrega otro intento.
- Roles HTTP/worker sin superusuario, BYPASSRLS, CREATEDB, CREATEROLE, propiedad de tablas ni CREATE de base/esquemas. Escrituras prohibidas sobre hechos, runs, migraciones y auditoría son rechazadas según cada identidad. Las suites previas verifican también el extractor limitado a vistas sin texto, autor, IP ni secretos.
- Se revoca LOGIN a las dos identidades BI de HTTP y se terminan sus conexiones. Dashboard/status/creación devuelven 503; no hay aceptación ficticia. Liveness, readiness OLTP, listado, captura, envío a revisión y aprobación siguen funcionando. Al restaurar acceso, el receipt anterior sigue siendo recuperable.

En navegador, sobre build de producción y la API/worker reales de la fixture: ingreso admin, solicitud pendiente, cierre de la pestaña, nueva sesión y consulta del mismo enlace con resultado correcto y un intento. Resumen concilia los indicadores. Roles y estados de interfaz también tienen pruebas de componente. La revisión móvil/teclado y CSV con cantidades grandes de fase 4 se conserva; no constituye una auditoría WCAG completa.

La ejecución cerca de medianoche UTC expuso un defecto del fixture anterior del worker: su conexión administrativa no fijaba UTC para los filtros por fecha. Se alineó con `BiConnection`, que ya fija UTC en producción. En la interfaz se explicita `hourCycle: h23` para que 00:xx y 12:xx sean inequívocos en diferentes navegadores; dos pruebas adicionales verifican medianoche y cambio de día por offset.

## Rendimiento observado y límites

Fixture: 100 empresas × 200 horas, 20.000 solicitudes canceladas, 20.000 runs fallidos y 20.002 auditorías. OLTP: 4.002 testimonios y 20.013 eventos entre dos empresas. Una carga manual real publica 4.001 testimonios y 20.009 eventos de su empresa. Redis y cuotas permanecen activos.

Baseline: 30 consultas del listado del CMS. Ronda concurrente: 40 tandas aceleradas de cinco rutas (listado CMS, status, runs filtrados, requests filtradas y auditoría), mientras arranca y trabaja un proceso ETL. Las tandas esperan 200ms **después** de finalizar la anterior; no representan 40 usuarios ni reproducen la cadencia 5/30s del navegador. Los cuantiles tienen muestras pequeñas y no son SLO.

| Ruta | Muestras | p95 local |
| --- | ---: | ---: |
| Listado CMS, baseline |30|121ms|
| Listado CMS, con polling y proceso ETL |40|307ms|
| Estado BI |40|424ms|
| Intentos filtrados |40|372ms|
| Solicitudes filtradas |40|406ms|
| Auditoría |40|461ms|

Las 200 peticiones de la ronda concurrente devolvieron 200. El run duró 33,8s; el proceso CLI completo 42,1s, incluido arranque. No hubo duplicados ni índices nuevos. Los seis EXPLAIN almacenados (presupuesto, fallo reciente, historial filtrado, solicitudes filtradas, conteo y auditoría) eligieron índices y tardaron 0,132–0,639ms, con 4–11 buffers compartidos. SQL individual y latencia HTTP miden cosas distintas: HTTP incluye varias consultas, autenticación, Redis, espera de pool y Node.

**Hay costo medible:** el p95 del listado aumentó de 121 a 307ms en esta muestra. Baseline y ronda concurrente difieren en número/rutas simultáneas; no permiten atribuir el aumento exclusivamente al extractor. El mismo host, caché caliente, servicios de revisión concurrentes y muestra corta impiden certificar aislamiento o capacidad productiva. Antes de habilitar en producción, repetir con recursos realmente separados, volumen objetivo, usuarios/cadencias reales, varias rondas, CPU/IO/pools de cada instancia y SLO acordados. Si la reconciliación horaria no entra en el presupuesto con margen o degrada el CMS, reducir carga/concurrencia o pasar a captura incremental antes de habilitar.

El pooling está acotado por proceso: CMS 8, BI lectura 2, BI control 2, extractor 1, escritor 2. Dimensionar el total multiplicando por réplicas y dejando reserva operativa. La API comparte el pool BI de lectura entre dashboard y control; no aumentar conexiones ni frecuencia a partir de esta sola medición. La pestaña oculta deja de consultar; actividad usa 5s, estado sin actividad 30s. Un usuario con varias pestañas consume varias cuotas.

## Reproducción local

Proveer externamente las URLs administrativas de **dos servidores descartables** y Redis exclusivo para pruebas:

```sh
export TEST_BI_SOURCE_DATABASE_URL='<PostgreSQL descartable de origen>'
export TEST_BI_WAREHOUSE_DATABASE_URL='<PostgreSQL descartable de destino>'
export TEST_BI_REDIS_URL='<Redis descartable exclusivo>'
```

Generar DDL sólo como archivo, sin `db push` ni `migrate deploy`:

```sh
./node_modules/.bin/prisma migrate diff --from-empty \
  --to-schema-datamodel apps/api/prisma/schema.prisma --script > /tmp/bi-source-schema.sql
export TEST_BI_BENCHMARK_SCHEMA_FILE=/tmp/bi-source-schema.sql
npm test --workspace apps/api -- --testPathPatterns='bi-.*spec.ts'
npm test --workspace apps/web -- --run
```

Desde `apps/api`, ejecutar el benchmark opt-in con las mismas variables:

```sh
TS_NODE_TRANSPILE_ONLY=true ../../node_modules/.bin/ts-node test/bi-operations-benchmark.ts --run
```

`test/bi-browser-session.ts --serve` crea otro entorno completo, API 4104 y worker continuo; detener con SIGINT/SIGTERM para drenar y eliminar bases/roles. La fixture sólo contiene cuentas públicas sintéticas del código de prueba. Compilar/servir la web con `NEXT_PUBLIC_API_URL=http://127.0.0.1:4104/api/v1`, hostname 127.0.0.1 y puerto 3104, para mantener el mismo sitio de cookies y el origen CORS. No usar credenciales reales ni apuntar estas herramientas a servidores persistentes. Las pruebas nuevas se omiten explícitamente si falta configuración; una ejecución omitida no acredita aceptación.

## Backup y restauración operativa

El backup de BI incluye **toda la base**, no únicamente `dw`: ledger de migraciones, hechos/cortes, dimensiones, controles, runs, reservas, auditoría y staging. Los roles/permisos se provisionan por separado; no guardar credenciales o hashes de roles en el repositorio. Cifrar y controlar acceso al backup según la política operativa. Redis no es el registro durable de BI.

Procedimiento de mantenimiento, con entorno, responsable y ACK propios:

1. Desactivar operaciones HTTP; detener reservas nuevas y drenar el worker. Comprobar que no quedan publicaciones activas. Respaldar la base con snapshot consistente; registrar hora/checkpoint y versión/checksums. Probar restauración, no sólo existencia del archivo.
2. Aislar la instancia y los workers anteriores antes de conectar la restaurada. Evitar dos destinos aceptando control/publicaciones: los tokens de lease de una copia no protegen contra otra copia independiente del warehouse.
3. Provisionar roles sin permisos heredados amplios. Restaurar en base nueva vacía con `pg_restore --exit-on-error --single-transaction --no-owner`, conservando ACL o reprovisionándolas explícitamente. Validar propietarios, grants efectivos, checksums, constraints, cantidades y enlaces compuestos por empresa.
4. Mantener controles apagados. La señal de vida restaurada es histórica: no implica que haya un worker vivo. Esperar su vencimiento de 60s y arrancar un worker compatible con identidad nueva. Para reservas de procesos ya detenidos, dejar vencer el lease y permitir recuperación/fencing normal; no reiniciar intentos, truncar runs ni liberar reservas manualmente para forzar otra publicación.
5. El worker actual observa el origen actual. Pending de hora pasada expira, running sin lease se recupera o falla según hora/presupuesto, y un éxito ya registrado impide otro en la misma hora. No fabricar cortes de horas perdidas ni reproducir automáticamente el scheduler antiguo.
6. Verificar una carga permitida, el último corte correcto y receipts/auditoría antes de reabrir controles. Volver a comprobar roles y SLO; registrar tiempos reales de recuperación.

La prueba local usa un backup sin escritores concurrentes, compara tablas completas y reanuda pendientes en la misma hora. No acredita PITR, restauración de roles entre clusters, failover, ni un RTO/RPO productivo. Restaurar un backup antiguo puede perder solicitudes, claves idempotentes y auditorías aceptadas después de ese backup: declarar la ventana de pérdida, reconciliar con evidencia y no prometer exactly-once fuera del estado durable recuperado. El origen OLTP y el warehouse no tienen una transacción de backup distribuida; una carga posterior reconcilia el origen actual sin reconstruir historia perdida.

## Checklist de habilitación y reversión

- [ ] ACK del entorno/ventana y backup restaurable; migraciones temporales/backfill cerrados según su runbook.
- [ ] Worker antiguo detenido y ausentes runs/reservas que bloqueen el migrador; aplicar 0004 autorizada sin editar checksums previos.
- [ ] Identidades independientes de extracción, publicación, lectura y control; grants efectivos comprobados, sin propiedad/superusuario ni acceso directo del navegador.
- [ ] Worker/API/web compatibles, supervisor independiente con drenaje de al menos el deadline de 5min más margen, endpoints internos de métricas protegidos y señales observables.
- [ ] Prueba con recursos/volumen objetivo satisface SLO y presupuesto horario; revisar demora de cola, heartbeat, crecimiento, cuotas y pools.
- [ ] Prueba admin/editor/dos empresas, solicitud durable tras cerrar sesión, fallo conservando último corte y restauración del entorno objetivo.
- [ ] Una carga verificada antes de habilitar `BI_OPERATIONS_ENABLED`; registrar versión desplegada y responsables.

Reversión funcional: apagar controles, conservar datos y detener nuevas reservas si el incidente lo requiere. Una carga activa drena o se recupera por lease tras terminación forzada. No volver al scheduler antiguo con settings nuevos; mantener worker compatible aunque se revierta la web. No ejecutar DROP, truncar historia ni cambiar a OLTP como fallback. Estos pasos son una guía pendiente de ejecución autorizada, no evidencia de despliegue.
