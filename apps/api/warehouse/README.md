# Testimonial DW

Migraciones PostgreSQL 18 independientes de Prisma OLTP, en `migrations/`.
El ETL no ejecuta DDL. El migrador requiere `BI_MIGRATION_DATABASE_URL` y `--apply` explícito; registra versión y SHA-256 en `etl.schema_migrations`.

Consultar [operación y permisos](../../../docs/operations/17_business_intelligence_etl.md), [contrato BI](../../../docs/modules/api-business-intelligence.md) y [diccionario](../../../docs/domain/warehouse_diccionario_de_datos.md). Migraciones persistentes e infraestructura requieren ACK humano; las pruebas usan dos PostgreSQL descartables.
