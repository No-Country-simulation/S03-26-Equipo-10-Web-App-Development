# ADR 0004: warehouse PostgreSQL separado y cortes horarios

**Fecha:** 2026-10-08

**Estado:** Decisión aprobada; warehouse/ETL implementados y probados en fase 3. API/panel, métricas y pruebas locales de capacidad/restauración implementadas en fase 4; habilitación productiva pendiente; sin despliegue persistente verificado.

**Plan:** [Foto de empresa y BI](../plan/2026-10-08_feat-foto-empresa-bi.md).

**Evolución temporal (2026-10-09):** [plan de tiempo dimensional](../plan/2026-10-08_refactor-bi-tiempo-dimensional.md). Los hechos incorporan instante/fecha de observación y cabecera por tenant/corte, incluidos vacíos. El dashboard lee sólo `dw`, mientras control y métricas siguen en `etl`. La separación OLTP/OLAP y el proceso horario se conservan. Migración con mantenimiento BI, backfill explícito y cierre validado; sin despliegue persistente autorizado.

## Contexto

El CMS persiste testimonios, autenticación, outbox y eventos de interacción en PostgreSQL. En el diagnóstico inicial, la analítica agrupaba las tablas operacionales y no existía warehouse. El usuario requiere tendencias por empresa y eligió instancias separadas en producción, actualización horaria y cortes del estado observado. No hay volumetría de producción medida.

La base OLTP conserva el estado actual del testimonio, su creación y eventual publicación; no un historial completo de transiciones. La captura anónima y la moderación deben seguir disponibles aunque falle BI.

## Decisión

1. Conservar PostgreSQL 18 para ambos workloads. OLTP mantiene la base actual; OLAP usa `testimonial_dw` en otra instancia con CPU, memoria, almacenamiento y ciclo operativo separados. Dos contenedores sobre un host compartido sirven para integración local, pero no prueban aislamiento de recursos en producción.
2. Organizar el destino en `staging`, `dw` y `etl`, con migraciones propias y claves foráneas locales. No incorporar modelos warehouse al schema Prisma operacional ni joins remotos desde las consultas del panel.
3. Crear un modelo dimensional con cortes horarios de testimonios y hechos diarios de interacción. Los snapshots empiezan al activar el proceso; importar únicamente interacciones históricas efectivamente disponibles en el origen.
4. Ejecutar ETL mediante una entrada independiente del workspace API, sin servidor HTTP ni inicialización del outbox/scoring. Extraer columnas autorizadas por empresa en una transacción de lectura consistente, paginar y transformar/agregar en OLAP.
5. Empezar con reconciliación completa por empresa cada hora. Publicar staging y dimensiones/hechos de forma atómica, usando lease con token de fencing. Los consumidores leen sólo resultados publicados.
6. Mantener autorización y filtro tenant en NestJS; admin y editor consultan su empresa. No introducir un dashboard global del operador ni clientes SQL en el navegador. Métricas agregadas técnicas globales, sin identidades de empresas, se exponen únicamente al monitoreo mediante token de operación.
7. Usar identidades distintas para lectura del origen, escritura ETL y lectura BI. La API transaccional no recibe las credenciales de extracción/escritura. Fallos de conexión warehouse no detienen el startup ni cambian la readiness operacional.
8. Modelar explícitamente `snapshot_at` y `snapshot_date_key` en detalle y cabecera, relacionados con `dim_date`; conservar `run_id` para trazabilidad. `fact_tenant_snapshot` representa el corte vacío y evita depender de tablas operativas para el tiempo de negocio. Mantener FK de detalle a cabecera con tenant/run/instante/fecha. El total de cabecera es no aditivo entre cortes.
9. El flujo combina transformaciones previas mínimas de proyección/normalización con carga en staging y transformación/agregación en destino: ETL/ELT pragmático, reconciliación completa por empresa. `staging/dw/etl` son responsabilidades de carga, modelo y control; no capas Bronze/Silver/Gold. El destino es dimensional con estrellas que comparten dimensiones y un hecho agregado de cortes, sin introducir medallón, cubos físicos ni minería predictiva.

## Alternativas consideradas

| Alternativa | Evaluación |
| --- | --- |
| Esquema OLAP dentro de la base actual | Organización y permisos separados, pero comparte recursos y disponibilidad con OLTP. Adecuado para demostración pequeña; no cumple la elección de producción. |
| Otra base dentro de la misma instancia | Aísla conexiones y objetos; continúa compartiendo recursos del proceso PostgreSQL. |
| Otra instancia PostgreSQL con recursos separados | Elección del usuario: permite dimensionar, respaldar y operar BI por separado. La extracción todavía genera lecturas sobre OLTP. |
| Réplica física como warehouse | Puede descargar lecturas, pero una réplica física en recuperación no sirve como destino de escritura para staging/dimensiones. No reemplaza la base analítica. |
| CDC/replicación lógica más ELT | Alternativa de crecimiento cuando la carga completa deje de cumplir los objetivos. Requiere operación de slots/WAL, gestión de borrados y cambios de esquema; no se incorpora en esta versión. |
| SQL Server u otro motor | No hay un requisito del producto que justifique otro motor y su operación adicional. |

## Consecuencias y límites

- Hay consistencia eventual. El panel presenta el corte del origen, el fin de publicación y la edad de los datos. Una carga demorada nunca se presenta como tiempo real.
- Una hora exitosa registra una observación; las horas perdidas quedan ausentes. El inventario de testimonios no se suma entre horas y no equivale a un flujo de altas/bajas.
- Las categorías y nombres descriptivos usan la última versión publicada; las relaciones de categoría/estado observadas se conservan en cada snapshot. No se promete el nombre histórico de una categoría renombrada.
- Reconciliar la interacción diaria corrige actualizaciones y borrados del origen. Los snapshots publicados son historia observada y no se borran por una desaparición operacional; una purga explícita es un procedimiento independiente, incluyendo backups, cuando corresponda.
- El warehouse almacena IDs técnicos pseudónimos y métricas. No exporta autores, texto, IP/hash de IP, usuarios, credenciales, webhooks, notas de moderación ni URLs multimedia.
- Sin volumen real conocido, no se certifica capacidad. La carga completa tiene límites y una prueba comparativa contra OLTP. Si no cumple, la habilitación productiva queda pendiente de rediseñar la captura incremental, sin elevar límites a ciegas.
- Se conserva inicialmente el historial sin purga automática. El crecimiento y las necesidades de conservación se revisan antes de añadir particiones o retención.

## Referencias

- [Diccionario dimensional propuesto](../domain/warehouse_diccionario_de_datos.md).
- [Contrato BI y algoritmo de carga](../modules/api-business-intelligence.md).
- [PostgreSQL 18: schemas](https://www.postgresql.org/docs/18/ddl-schemas.html).
- [PostgreSQL 18: transaction isolation](https://www.postgresql.org/docs/18/transaction-iso.html).
- [PostgreSQL 18: hot standby](https://www.postgresql.org/docs/18/hot-standby.html).
- [PostgreSQL 18: restricciones de replicación lógica](https://www.postgresql.org/docs/18/logical-replication-restrictions.html).
- [Kimball: periodic snapshot fact tables](https://www.kimballgroup.com/data-warehouse-business-intelligence-resources/kimball-techniques/dimensional-modeling-techniques/periodic-snapshot-fact-table/).
