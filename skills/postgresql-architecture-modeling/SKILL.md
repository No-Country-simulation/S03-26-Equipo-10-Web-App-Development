# Especificación Técnica de Habilidad: PostgreSQL (Arquitectura y Modelado)

**Código de Skill:** SKL-DB-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **PostgreSQL Avanzado** |
| **Objetivo de Dominio** | Capacitar al usuario para diseñar, implementar y optimizar bases de datos relacionales robustas, garantizando integridad atómica y escalabilidad mediante técnicas de arquitectura de motor. |
| **Tipo de Proyecto** | Arquitectura de Datos / Backend de Alta Concurrencia / Sistemas Financieros. |
| **Complejidad** | **Alta** (Enfoque en optimización de almacenamiento y lógica de servidor). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **PostgreSQL** trasciende el simple uso de SQL. Se fundamenta en la **Integridad Basada en el Motor**, donde la base de datos es la última línea de defensa de las reglas de negocio, y en la **Optimización de E/S** mediante el uso estratégico de tipos de datos y estructuras de indexación.

- **Modularidad:** Uso de Esquemas (Schemas) para separar dominios y PL/pgSQL para encapsular lógica.
- **Idempotencia:** Migraciones y scripts de base de datos diseñados para ejecutarse múltiples veces sin alterar el estado final (uso de `IF NOT EXISTS`, `DROP ... CASCADE`).
- **Reusabilidad:** Creación de tipos de datos personalizados (Domain/Enum) y funciones genéricas.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Uso estricto de transacciones **ACID**. Implementación de `Savepoints` en procesos batch complejos.
- **Persistencia y Fallos:** Configuración de **Write-Ahead Logging (WAL)** y estrategias de replicación (Streaming Replication).
- **Trazabilidad:** Uso de la extensión `pg_stat_statements` para identificar *slow queries* y `Correlation IDs` en comentarios de SQL para rastrear el origen de la consulta en los logs.
- **Confiabilidad:** Implementación de **Transactional DDL** para asegurar que los cambios de esquema sean atómicos.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Capacidad de normalizar estructuras hasta **3NF/BCNF** y desnormalizar estratégicamente con `JSONB`.
- **[RF-02]:** Implementación de integridad referencial avanzada (Exclusion Constraints, Partial Indexes).
- **[RF-03]:** Desarrollo de lógica en servidor mediante `PROCEDURES` y `TRIGGERS` de auditoría.
- **[RF-04]:** Gestión de datos temporales con precisión usando `TIMESTAMPTZ`.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Escalabilidad:** Implementación de **Declarative Partitioning** para tablas que superen el umbral de rendimiento del índice B-Tree.
- **[RNF-02] Seguridad:** Configuración de **Row Level Security (RLS)** y gestión de roles basada en el principio de menor privilegio.
- **[RNF-03] Mantenibilidad:** Ajuste de parámetros de `Autovacuum` para prevenir el *table bloat* y fragmentación.
- **[RNF-04] Rendimiento:** Tiempo de respuesta optimizado mediante **Covering Indexes** (cláusula `INCLUDE`).

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El esquema cumple con las reglas de integridad referencial y no permite estados de datos inconsistentes (ej. precios negativos, solapamientos de fechas).
2. **Resiliencia:** El sistema maneja errores de concurrencia mediante niveles de aislamiento de transacción adecuados (`Read Committed` / `Serializable`).
3. **Calidad Técnica:** Los planes de ejecución (`EXPLAIN ANALYZE`) muestran un uso eficiente de índices, evitando *Sequential Scans* en tablas de alto volumen.
4. **Autonomía:** El usuario puede realizar un tuneo básico de `postgresql.conf` basándose en el hardware disponible.

---

## 5. Ecosistema de Herramientas (Stack)

- **Motor:** PostgreSQL 15+ (soporte nativo para procedimientos y particionamiento avanzado).
- **Extensiones Críticas:** `PostGIS` (Geospacial), `pg_stat_statements` (Monitoreo), `btree_gist` (Constraints complejas).
- **Gestión:** `psql` (CLI), `pgAdmin` / `DBeaver` (GUI), `Liquibase` / `Flyway` (Migraciones).
- **Análisis:** `PEV2` (Postgres Explain Visualizer).

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Despliegue de instancia (Docker/Cloud) y ajuste de `shared_buffers` y `work_mem`.
2. **Fase de Construcción:** Modelado de tablas con tipos de datos precisos (`BIGINT`, `NUMERIC`, `UUID`).
3. **Fase de Refactor:** Optimización de consultas lentas detectadas por `EXPLAIN` y creación de índices parciales.
4. **Fase de QA:** Pruebas de carga para verificar el comportamiento del `Autovacuum` y la contención de bloqueos (locks).

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Usar `SELECT *` en código de aplicación (aumenta el tráfico de red y rompe índices de cobertura).
- ⚠️ **[Antipatrón 2]:** Almacenar dinero en campos `FLOAT` o `REAL` (pérdida de precisión decimal).
- ⚠️ **[Antipatrón 3]:** Abusar del patrón **EAV** (Entity-Attribute-Value) en lugar de usar `JSONB` con validaciones.
- ⚠️ **[Antipatrón 4]:** Ignorar la zona horaria (usar `TIMESTAMP` en lugar de `TIMESTAMPTZ`).

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Index Hit Rate** | > 99% en entornos transaccionales |
| **Query Latency (P95)** | < 100ms para operaciones OLTP |
| **Redundancia de Datos** | Mínima (Normalización verificada) |
| **Bloat Ratio** | < 20% en tablas críticas |

---

## 9. Recursos Adicionales

- [PostgreSQL Official Documentation](https://www.postgresql.org/docs/current/index.html)
- [Postgres Weekly Newsletter](https://postgresweekly.com/)
- [Use The Index, Luke (Guía de Indexación)](https://use-the-index-luke.com/)
