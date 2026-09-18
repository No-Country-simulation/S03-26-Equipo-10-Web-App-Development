---
name: postgresql-database-engineering
description: "Diseño, implementación, optimización, evolución y operación profesional de bases de datos PostgreSQL (código SKL-DB-POSTGRES-001). Usar cuando se requiera modelado relacional en PostgreSQL 18+, integridad declarativa (PK, FK, CHECK, UNIQUE, EXCLUDE con GiST), tipos nativos (timestamptz, numeric, uuid, inet, jsonb), estrategias de indexación (B-tree skip scan, GIN, GiST, BRIN, partial, expression, covering), optimización y diagnóstico con EXPLAIN (ANALYZE, BUFFERS), control de concurrencia y MVCC, tuning de autovacuum y bloat, locking (FOR UPDATE SKIP LOCKED, advisory locks), migraciones zero-downtime (Expand-Migrate-Contract, CONCURRENTLY, NOT VALID), pooling con PgBouncer, replicación (streaming, lógica, slots), backup con PITR, observabilidad con pg_stat_statements y seguridad (RLS multi-tenant, roles, least privilege)."
---

# SKL-DB-POSTGRES-001: Senior PostgreSQL Architecture, Data Modeling & Database Engineering

```text
====================================================================================================
ESPECIFICACIÓN TÉCNICA DE HABILIDAD: SKL-DB-POSTGRES-001
Senior PostgreSQL Architecture, Data Modeling & Database Engineering — Versión 2.0.0
Baseline Técnico: PostgreSQL 18+
Estándares: ISO/IEC 9075 (SQL) | IEEE 29148 | ISO/IEC 25010 | ACID | Agile Definition of Done
Host Application: NestJS 11, TypeScript 5.8+, Prisma ORM 6.5+, Next.js 15 App Router
Responsable: Facundo Nicolás González
Dominio: PostgreSQL / SQL / Arquitectura de Datos / Backend / Data Engineering / Database Engineering
====================================================================================================
```

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Código de Habilidad** | `SKL-DB-POSTGRES-001` |
| **Nombre de Habilidad** | Senior PostgreSQL Architecture, Data Modeling & Database Engineering |
| **Versión** | `2.0.0` |
| **Nivel Objetivo** | Intermedio $\longrightarrow$ Avanzado $\longrightarrow$ Senior $\longrightarrow$ Staff / Principal |
| **Habilidad Principal** | Diseño, implementación, optimización, evolución y operación de bases de datos PostgreSQL |
| **Objetivo de Dominio** | Capacitar al practicante para transformar reglas de negocio en esquemas PostgreSQL consistentes, normalizados, eficientes, concurrentes, seguros, observables y recuperables |
| **Motor Objetivo** | **PostgreSQL 18+** |
| **Áreas Principales** | Modelado relacional, PostgreSQL SQL, constraints, tipos nativos, índices, MVCC, transacciones, concurrencia, query planner, JSONB, particionamiento, seguridad, RLS, VACUUM, WAL, replicación, backup/PITR y migraciones |
| **Extensiones Relevantes**| `pg_stat_statements`, `pg_trgm`, `citext`, `btree_gist`, `btree_gin`, `PostGIS`, `pgvector` según el dominio |
| **Tipo de Proyecto** | Backend, APIs, SaaS Multi-tenant, Fintech, ERP, CRM, GIS, Data Platforms, sistemas empresariales y servicios transaccionales |
| **Complejidad** | Media / Alta |
| **Paradigma** | Modelo relacional + SQL declarativo + MVCC + ACID + extensibilidad |
| **Prioridad Arquitectónica**| **Correctitud $\longrightarrow$ Integridad $\longrightarrow$ Seguridad $\longrightarrow$ Mantenibilidad $\longrightarrow$ Observabilidad $\longrightarrow$ Rendimiento $\longrightarrow$ Escalabilidad** |

---

## 2. Descripción y Filosofía de Diseño

Esta habilidad se enfoca exclusivamente en **PostgreSQL como sistema de persistencia relacional, transaccional y extensible**.
La base de datos nunca debe tratarse como *"un lugar donde el ORM guarda objetos"*.

PostgreSQL debe considerarse una parte activa y soberana de la arquitectura, capaz de proteger de forma autónoma:
1. **Identidad** de entidades mediante claves primarias unívocas y subrogadas.
2. **Relaciones** estrictas gobernadas por claves foráneas con semántica de eliminación explícita.
3. **Invariantes** de negocio mediante restricciones declarativas (`CHECK`, `UNIQUE`, `EXCLUDE`).
4. **Concurrencia** y consistencia transaccional mediante Multi-Version Concurrency Control (MVCC) y primitivas de bloqueo no destructivas.
5. **Permisos** y segregación perimetral a través de roles de privilegios mínimos y Row-Level Security (RLS).
6. **Consistencia** atómica bajo fallos de hardware o red.
7. **Integridad referencial** inmutable ante operaciones concurrentes.
8. **Recuperación ante desastres** mediante Write-Ahead Logging (WAL) y Point-In-Time Recovery (PITR).

La aplicación y PostgreSQL deben colaborar estrechamente, pero las invariantes que puedan expresarse declarativamente deben estar protegidas **lo más cerca posible de los datos**.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        ARQUITECTURA DE DOMINIO                         │
│                                                                        │
│   Dominio (Reglas de Negocio)                                          │
│      ↓                                                                 │
│   Modelo Conceptual / ER                                               │
│      ↓                                                                 │
│   Modelo Relacional PostgreSQL (Tablas, Constraints, Tipos)            │
│      ↓                                                                 │
│   Estrategia de Indexación & Concurrencia (B-tree, GIN, GiST, MVCC)    │
│      ↓                                                                 │
│   SQL Declarativo & Vistas / Funciones                                 │
│      ↓                                                                 │
│   ORM / Query Builder (Prisma 6.5+ / pg adapter / Kysely)              │
│      ↓                                                                 │
│   Aplicación Backend (NestJS 11 / Node.js)                             │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Principios Fundamentales

#### Integridad por Diseño
Utilizar deliberadamente el abanico declarativo nativo de PostgreSQL:
```text
PRIMARY KEY
FOREIGN KEY
UNIQUE
NOT NULL
CHECK
EXCLUDE
GENERATED
DOMAIN
```
cuando expresen correctamente reglas del dominio.
PostgreSQL ofrece, además de las restricciones SQL convencionales, las **exclusion constraints**, fundamentales para modelar incompatibilidades de recursos compartidos y rangos temporales o espaciales que no pueden superponerse concurrentemente.

#### PostgreSQL Primero, ORM Después
El modelo de datos debe poder comprenderse, auditarse y ejecutarse sin Prisma, TypeORM, Sequelize, SQLAlchemy o Hibernate.
Orden metodológico recomendado:
```text
Dominio
   ↓
Modelo conceptual
   ↓
Modelo relacional PostgreSQL
   ↓
Constraints
   ↓
Tipos PostgreSQL
   ↓
Índices
   ↓
SQL
   ↓
ORM / Query Builder
```
El ORM debe adaptarse al modelo relacional. Jamás se debe diseñar un modelo deficiente, anémico o desnormalizado únicamente porque *"el ORM lo hace más fácil así"*.

### 2.2. Normalizar antes de Optimizar
Para sistemas OLTP transaccionales:
$$\text{1NF} \longrightarrow \text{2NF} \longrightarrow \text{3NF}$$
constituye el estándar obligatorio de partida.
La desnormalización jamás es un punto de partida; debe fundamentarse en una razón concreta, demostrable y documentada:
- **Snapshot histórico**: Preservar el estado exacto de un dato en el tiempo (p. ej., precio unitario o nombre de autor al momento de emitir un testimonio o factura).
- **Lectura intensiva**: Reducción demostrada de contención en tablas con ratios de lectura/escritura superiores a 100:1.
- **Agregación precalculada**: Resúmenes atómicos sincronizados transaccionalmente.
- **Reducción demostrada de costo**: Evidencia empírica mediante métricas de buffers y CPU.
- **CQRS / Reporting / Eventos**: Modelos de lectura desacoplados para analítica.

### 2.3. Medir antes de Optimizar
Queda terminantemente prohibido asumir axiomas infundados:
- *"JOIN es lento"* (falso: el planner ejecuta Hash Joins y Merge Joins en memoria en microsegundos).
- *"JSONB es rápido"* (falso: parsear JSONB en runtime consume CPU y memoria; no sustituye columnas normalizadas).
- *"Índice es rápido"* (falso: índices innecesarios ralentizan escrituras, aumentan el WAL y provocan bloat).
- *"Partición es rápido"* (falso: particionar sin partition pruning añade sobrecarga de planificación).
- *"CTE es lento"* (falso: PostgreSQL optimiza e inlina CTEs no recursivos salvo indicación de `MATERIALIZED`).
- *"UUID es malo"* (falso: UUIDv7 preserva la localidad B-tree y permite generación descentralizada segura).
- *"BIGINT es bueno"* (falso: expone claves secuenciales predecibles susceptibles a enumeración BOLA).

La pregunta arquitectónica fundamental siempre es:
$$\text{¿Qué plan de ejecución está seleccionando PostgreSQL y qué recursos físicos está consumiendo?}$$

Herramientas analíticas indispensables:
- `EXPLAIN` (estimación de costos del planner).
- `EXPLAIN ANALYZE` (ejecución real con tiempos y filas efectivas).
- `EXPLAIN (ANALYZE, BUFFERS)` (análisis exhaustivo de lecturas de caché *shared hit* vs disco *read*).
- Observabilidad agregada mediante la vista del sistema `pg_stat_statements`.

### 2.4. El Esquema es una API Persistente
Las tablas de base de datos sobreviven a los frameworks, ORMs, librerías, microservicios y versiones de aplicación. Por ello, cualquier modificación debe ser:
- **Versionada**: Script DDL inmutable registrado en el repositorio.
- **Revisable**: Sometida a auditoría de bloqueos (*lock levels*) antes de producción.
- **Reproducible**: Idéntica en local, staging y producción.
- **Compatible**: Respetar compatibilidad hacia atrás para despliegues *rolling* (*zero-downtime*).
- **Reversible**: Contar con plan de rollback o mitigación cuando sea factible.
- **Observable**: Medir tiempos de ejecución y bloqueos en staging antes de aplicar en producción.

---

## 3. Arquitectura de Proyecto

Estructura modular orientada a puertos y adaptadores en una aplicación backend (p. ej., `@testimonial-cms/api` en NestJS 11):

```text
src/
├── domain/
│   ├── entities/                      # Entidades puras de negocio (invariantes de dominio)
│   ├── value-objects/                 # Objetos de valor inmutables (Email, Slug, Money)
│   └── repositories/                  # Interfaces / Puertos de persistencia (IPortRepository)
│
├── application/
│   └── use-cases/                     # Casos de uso y orquestación de transacciones
│
└── infrastructure/
    └── database/
        └── postgres/                  # Adaptador PostgreSQL soberano
            ├── migrations/            # Scripts SQL versionados (0001_init.sql, 0002_expand.sql)
            ├── repositories/          # Implementación del puerto (PostgresTestimonialRepository)
            ├── queries/               # Consultas optimizadas en SQL crudo / Kysely / Prisma
            ├── functions/             # Procedimientos PL/pgSQL y triggers de auditoría
            ├── types/                 # Mapeo de tipos nativos (UUID, Timestamps, JSONB)
            └── connection/            # Configuración de PgBouncer y pool de conexiones
```

**Principio Arquitectónico Rector:**
$$\text{Domain} \longrightarrow \text{Port (Interface)} \longleftarrow \text{PostgreSQL Adapter}$$

Jamás acoplar el dominio directamente al SDK de base de datos o al cliente generado de Prisma:
$$\text{Domain} \xlongrightarrow{\quad\text{PROHIBIDO}\quad} \text{PrismaClient / Postgres SDK}$$

---

## 4. Modelo Relacional en PostgreSQL

Mapeo conceptual entre la teoría relacional y los tipos y estructuras nativas de PostgreSQL 18+:

| Concepto Relacional Formal | Implementación en PostgreSQL 18+ | Justificación / Buenas Prácticas |
| :--- | :--- | :--- |
| **Entidad** | Tabla relacional (`CREATE TABLE`) | Conjunto acotado de atributos con clave primaria |
| **Instancia / Tupla** | Fila (`ROW` / `TUPLE`) | Unidad física versionada por MVCC |
| **Identidad Técnica** | `GENERATED ALWAYS AS IDENTITY` o `uuid` | Claves primarias no nulas, inmutables |
| **Identidad de Negocio**| Restricción `UNIQUE` sobre clave natural | Evita duplicidad funcional independiente de la PK |
| **Relación** | Clave Foránea (`FOREIGN KEY`) | Mantiene integridad referencial y gobierna cascades |
| **Regla de Dominio** | Restricciones `CHECK`, `EXCLUDE`, `DOMAIN` | Invariantes evaluadas a nivel motor en cada DML |
| **Valor Ausente** | `NULL` semántico | Manejado con lógica trivalente (`TRUE`, `FALSE`, `UNKNOWN`) |
| **Valor Estructurado** | `jsonb` / tipos compuestos / arrays | Estrictamente justificado para metadatos dinámicos |
| **Rango Temporal/Num.** | `tstzrange`, `numrange`, `multirange` | Rangos continuos con soporte de operadores `@>`, `&&` |
| **Dirección de Red** | `inet` / `cidr` | Almacenamiento binario eficiente con validación de máscara |
| **UUID** | Tipo nativo `uuid` (16 bytes) | Soporte nativo para UUIDv4 y UUIDv7 |
| **Texto Libre** | `text` | Almacenamiento eficiente TOAST sin penalización artificial |
| **Dinero / Moneda** | `numeric(precision, scale)` | Precisión fija exacta, eliminando errores de redondeo |

---

## 5. Relaciones

PostgreSQL permite expresar relaciones de cualquier cardinalidad mediante la combinación rigurosa de claves primarias, foráneas y restricciones de unicidad.

### 5.1. Relación Uno a Uno (1:1)
Se modela haciendo que la clave primaria de la tabla secundaria sea a la vez su clave foránea (`PK + FK`), o agregando una restricción `UNIQUE` sobre una clave foránea `NOT NULL`.

```sql
-- Usuario central del sistema
CREATE TABLE users (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_users_email UNIQUE (email)
);

-- Perfil extendido: user_id es simultáneamente Clave Primaria y Clave Foránea
CREATE TABLE user_profiles (
    user_id bigint PRIMARY KEY
        REFERENCES users(id)
        ON DELETE CASCADE,
    first_name text NOT NULL,
    last_name text NOT NULL,
    bio text,
    avatar_url text,
    updated_at timestamptz NOT NULL DEFAULT now()
);
```
> [!NOTE]
> Al definir `user_id` como clave primaria de `user_profiles`, se garantiza físicamente que jamás existirá más de un perfil por cada usuario registrado.

### 5.2. Relación Uno a Muchos (1:N)
La clave foránea reside mandatoriamente en la tabla del lado "Muchos" (N).

```sql
CREATE TABLE customers (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE orders (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    customer_id bigint NOT NULL
        REFERENCES customers(id)
        ON DELETE RESTRICT,
    total_amount numeric(14,2) NOT NULL,
    status text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT chk_orders_total_positive CHECK (total_amount >= 0)
);

-- Índice mandatorio para optimizar JOINs y bloqueos en DELETE sobre customers
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
```

### 5.3. Relación Muchos a Muchos (N:M)
Se implementa mediante una entidad asociativa (tabla intermedia) con clave primaria compuesta y atributos propios de la relación.

```sql
CREATE TABLE roles (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code text NOT NULL UNIQUE,
    description text NOT NULL
);

CREATE TABLE user_roles (
    user_id bigint NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
    role_id bigint NOT NULL
        REFERENCES roles(id)
        ON DELETE RESTRICT,
    assigned_at timestamptz NOT NULL DEFAULT now(),
    assigned_by_user_id bigint REFERENCES users(id) ON DELETE SET NULL,
    PRIMARY KEY (user_id, role_id)
);

-- Índice inverso para consultas que parten desde role_id hacia users
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

### 5.4. Relaciones Autorreferenciales y Jerarquías
Permite modelar árboles y dependencias dentro de la misma entidad mediante una clave foránea recursiva.

```sql
CREATE TABLE categories (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    parent_id bigint REFERENCES categories(id) ON DELETE RESTRICT,
    name text NOT NULL,
    slug text NOT NULL,
    CONSTRAINT uq_categories_parent_slug UNIQUE NULLS NOT DISTINCT (parent_id, slug)
);

CREATE INDEX idx_categories_parent_id ON categories(parent_id);
```

Para jerarquías de alta profundidad o árboles de lectura intensiva, se deben evaluar las siguientes alternativas según el patrón de acceso:
1. **Recursive CTE**: Óptimo para árboles dinámicos con mutaciones frecuentes.
2. **Extensión `ltree`**: Ideal para taxonomías y consultas de ancestros/descendientes con indexación GiST.
3. **Closure Table**: Persiste todos los pares ancestro-descendiente; excelente para lecturas masivas con costo adicional en inserciones.
4. **Materialized Path**: Almacena rutas de texto (`/1/4/12/`); simple pero exige mantenimiento en reordenamientos.

---

## 6. Identidad

### 6.1. Identity Columns (`GENERATED AS IDENTITY`)
Para claves primarias secuenciales en esquemas modernos, utilizar siempre el estándar SQL moderno de PostgreSQL:
```sql
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```
o bien:
```sql
id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY
```
> [!WARNING]
> Descartar por completo los tipos heredados `SERIAL` y `BIGSERIAL`. Los pseudo-tipos serial crean secuencias desacopladas de la columna, no respetan el estándar SQL y dificultan la gestión de permisos y clonación de esquemas.

### 6.2. BIGINT vs UUID
No existe una elección universal; la decisión debe fundamentarse en la arquitectura:

```text
┌──────────────────────────────┬──────────────────────────────┐
│       BIGINT (IDENTITY)      │             UUID             │
├──────────────────────────────┼──────────────────────────────┤
│ 8 bytes por fila             │ 16 bytes por fila            │
│ Óptima localidad de caché    │ Fragmentación si es v4       │
│ Secuencial y compacto        │ UUIDv7 preserva orden B-tree │
│ Expuesto: Riesgo IDOR/BOLA   │ Seguro para URLs públicas    │
│ Requiere round-trip a la DB  │ Generable en cliente / app   │
└──────────────────────────────┴──────────────────────────────┘
```

**Regla de Selección:**
- **UUID (UUIDv7)**: Excelente para entidades distribuidas, identificadores expuestos en APIs públicas, sistemas multi-tenant donde los clientes crean IDs antes de persistir, y prevención de ataques BOLA/IDOR.
- **BIGINT**: Excelente para tablas de alto volumen interno, tablas intermedias N:M, registros de log, o entidades cuyos IDs jamás se exponen fuera del perímetro de confianza.

### 6.3. Clave Natural (Natural Key) + Clave Subrogada (Surrogate Key)
La presencia de una clave subrogada técnica (`id`) jamás sustituye la obligación de proteger la clave natural del negocio.

```sql
CREATE TABLE organizations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tax_id text NOT NULL,
    legal_name text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_organizations_tax_id UNIQUE (tax_id)
);
```

---

## 7. Tipos PostgreSQL

Utilizar siempre los tipos nativos que representen con la mayor precisión posible la semántica del dominio.

### 7.1. Texto (`text` vs `varchar`)
En PostgreSQL, `text`, `varchar` y `varchar(n)` comparten exactamente la misma representación física interna (con compresión TOAST para valores extensos) y el mismo rendimiento de lectura y escritura.
- Utilizar `varchar(n)` **únicamente** si el límite $n$ representa una regla inquebrantable de dominio (p. ej., `varchar(2)` para códigos de país ISO-3166-1 alpha-2, o `varchar(3)` para códigos de moneda ISO-4217).
- Utilizar `text` con restricciones `CHECK (char_length(...) <= X)` para campos descriptivos o nombres.
- Evitar `varchar(255)` arbitrario importado de costumbres de otros motores como MySQL.

### 7.2. Dinero y Valores Financieros
- Utilizar mandatoriamente `numeric(precision, scale)` (p. ej., `numeric(14,2)` o `numeric(18,4)`) para balances, precios e impuestos.
- Queda terminantemente prohibido el uso de `real` o `double precision` (punto flotante IEEE 754) para valores monetarios debido a errores acumulativos de redondeo binario.

### 7.3. Tiempo y Fechas
- Utilizar siempre `timestamptz` (`timestamp with time zone`) para registrar eventos absolutos en sistemas distribuidos. Almacena instantes UTC en 8 bytes y convierte al huso horario de la sesión en la visualización.
- Utilizar `date` para fechas sin hora (p. ej., fechas de nacimiento o días feriados).
- Utilizar `interval` para operaciones de duración.
- Evitar `timestamp` (`timestamp without time zone`) para eventos de negocio, ya que pierde el contexto temporal absoluto cuando cambian las zonas horarias de los servidores.

### 7.4. Booleanos
Utilizar el tipo nativo `boolean`. No emular booleanos con `char(1)` (`'Y'`, `'N'`), cadenas (`'true'`, `'false'`) ni números (`0`, `1`).

### 7.5. UUID
Utilizar el tipo nativo `uuid` (almacenamiento binario de 16 bytes). Jamás almacenar UUIDs como `varchar(36)`.

### 7.6. Tipos de Red
Utilizar `inet` y `cidr` para direcciones IPv4 e IPv6. Validan la sintaxis, optimizan el espacio en disco e incorporan operadores nativos de inclusión en subred (`<<=`, `>>=`).

### 7.7. Arrays
PostgreSQL ofrece soporte de arrays (`text[]`, `bigint[]`).
- **Regla:** Soporte nativo $\neq$ reemplazo del modelo relacional.
- Usar arrays solo cuando el atributo represente una lista autocontenida de literales sin identidad propia ni relaciones foráneas (p. ej., `features text[]` o `phone_numbers text[]`).
- Jamás usar arrays de claves foráneas (`role_ids bigint[]`) para modelar relaciones entre entidades de negocio.

### 7.8. ENUM
Los tipos `CREATE TYPE ... AS ENUM` son adecuados para dominios pequeños, muy estables y bien definidos (p. ej., `order_status AS ENUM ('draft', 'pending', 'paid', 'cancelled')`).
- Si los valores mutan dinámicamente, requieren traducciones, metadatos adicionales o desactivación lógica, utilizar siempre una **tabla catálogo relacional**.

### 7.9. DOMAIN
Permite encapsular un tipo base con restricciones reutilizables en todo el esquema:
```sql
CREATE DOMAIN email_address AS text
CHECK (VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

CREATE DOMAIN positive_amount AS numeric(14,2)
CHECK (VALUE > 0);
```

---

## 8. JSONB

PostgreSQL permite combinar la solidez del modelo relacional con la flexibilidad de datos semi-estructurados mediante `jsonb` (formato binario indexable).

### 8.1. Buen Uso de JSONB
- Payloads crudos de webhooks de terceros (`stripe_payload jsonb`).
- Metadatos variables de integraciones externas.
- Propiedades dinámicas secundarias definidas por el usuario final.
- Configuraciones de interfaz o flags no críticos para la integridad relacional.

### 8.2. Mal Uso de JSONB
- Almacenar entidades centrales del negocio en una columna `data jsonb`.
- Reemplazar relaciones relacionales normalizadas por documentos anidados.
- Campos que requieren integridad referencial mediante claves foráneas.

### 8.3. Indexación JSONB con GIN
Para búsquedas rápidas mediante operadores de contención (`@>`, `?`, `?|`):

```sql
CREATE TABLE audit_events (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    tenant_id uuid NOT NULL,
    action text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
);

-- Índice GIN completo para búsquedas de contención en metadatos
CREATE INDEX idx_audit_events_metadata_gin
ON audit_events
USING GIN (metadata);

-- Consulta acelerada por el índice GIN
SELECT * FROM audit_events
WHERE metadata @> '{"provider": "stripe", "status": "failed"}';
```

---

## 9. Constraints (Restricciones Declarativas)

La integridad declarativa en el motor es la primera línea de defensa contra la corrupción de datos.

### 9.1. NOT NULL
Definir siempre `NOT NULL` a menos que la ausencia del dato sea un estado válido del dominio.

### 9.2. CHECK
Valida condiciones lógicas en cada fila al insertar o actualizar:
```sql
ALTER TABLE products
ADD CONSTRAINT chk_products_price_positive
CHECK (price >= 0);

ALTER TABLE campaigns
ADD CONSTRAINT chk_campaigns_dates_valid
CHECK (ended_at IS NULL OR ended_at >= started_at);
```

### 9.3. UNIQUE y Partial Unique Index
Para garantizar unicidad condicionada al borrado lógico (*soft delete*):
```sql
CREATE UNIQUE INDEX uq_users_active_email
ON users (lower(email))
WHERE deleted_at IS NULL;
```

### 9.4. Exclusion Constraints (`EXCLUDE USING gist`)
Permiten modelar restricciones complejas donde dos filas no pueden coexistir si una expresión booleana sobre sus atributos resulta verdadera (p. ej., evitar que una misma habitación o recurso compartido tenga dos reservas que se superpongan en el tiempo):

```sql
-- Requiere la extensión btree_gist para combinar tipos escalares con rangos
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE room_reservations (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    room_id int NOT NULL,
    booking_period tstzrange NOT NULL,
    CONSTRAINT exclude_overlapping_reservations
        EXCLUDE USING gist (
            room_id WITH =,
            booking_period WITH &&
        )
);
```
> [!IMPORTANT]
> La restricción de exclusión resuelve de raíz las condiciones de carrera concurrentes a nivel motor sin necesidad de implementar bloqueos pesados a nivel de aplicación.

---

## 10. Foreign Keys (Claves Foráneas)

Una clave foránea salvaguarda la integridad referencial entre entidades relacionadas.
```sql
customer_id bigint NOT NULL REFERENCES customers(id)
```
> [!CAUTION]
> **PostgreSQL NO crea automáticamente un índice sobre las columnas de una Foreign Key.**
> La omisión de este índice provoca que cualquier `DELETE` o `UPDATE` sobre la tabla padre realice un escaneo secuencial completo (`Seq Scan`) sobre la tabla hija para verificar la existencia de huérfanos, adquiriendo locks prolongados y degradando severamente el throughput. Crear siempre un índice sobre la columna referenciante cuando participe en JOINs o cuando la tabla padre sufra mutaciones.

---

## 11. Acciones Referenciales `ON DELETE`

Elegir deliberadamente el comportamiento referencial según la semántica del dominio:

```text
┌───────────────────────────┬─────────────────────────────────────────────────────────┐
│ Cláusula                  │ Regla de Negocio y Caso de Uso                          │
├───────────────────────────┼─────────────────────────────────────────────────────────┤
│ ON DELETE RESTRICT        │ Impide la eliminación del padre si existen hijos.       │
│                           │ (Ejemplo: Prohibido borrar un Cliente con Órdenes)     │
├───────────────────────────┼─────────────────────────────────────────────────────────┤
│ ON DELETE CASCADE         │ Elimina automáticamente los hijos al borrar el padre.    │
│                           │ (Ejemplo: Borrar una Factura borra sus FacturaItems)    │
├───────────────────────────┼─────────────────────────────────────────────────────────┤
│ ON DELETE SET NULL        │ Desvincula el hijo colocando la FK en NULL.             │
│                           │ (Ejemplo: Si se borra un Agente, tickets quedan sin     │
│                           │ agente asignado)                                        │
├───────────────────────────┼─────────────────────────────────────────────────────────┤
│ ON DELETE NO ACTION       │ Valida la restricción al final de la sentencia o        │
│                           │ transacción (diferible). Comportamiento por defecto.   │
└───────────────────────────┴─────────────────────────────────────────────────────────┘
```

---

## 12. Normalización

En sistemas OLTP, diseñar siguiendo rigurosamente las formas normales:
- **1NF (Primera Forma Normal)**: Valores atómicos por columna. Cero listas separadas por coma o estructuras no estructuradas que representen relaciones.
- **2NF (Segunda Forma Normal)**: Estar en 1NF y que todo atributo no clave dependa por completo de la clave primaria completa (sin dependencias funcionales parciales en claves compuestas).
- **3NF (Tercera Forma Normal)**: Estar en 2NF y que ningún atributo no clave dependa transitivamente de la clave primaria (sin dependencias transitivas $A \rightarrow B \rightarrow C$).
- **BCNF (Forma Normal de Boyce-Codd)**: Refinamiento de 3NF donde para toda dependencia funcional $X \rightarrow Y$, $X$ es superclave.

---

## 13. Desnormalización Consciente

La desnormalización es válida **únicamente** cuando responde a un requerimiento de dominio documentado:
```sql
-- order_items almacena unit_price como snapshot histórico
CREATE TABLE order_items (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_id bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id bigint NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    quantity int NOT NULL CHECK (quantity > 0),
    unit_price numeric(14,2) NOT NULL CHECK (unit_price >= 0)
);
```
Aunque `products.current_price` exista en la tabla de productos, almacenar `order_items.unit_price` no es redundancia accidental: es un **snapshot temporal inmutable**.

---

## 14. Índices en PostgreSQL

PostgreSQL dispone de seis métodos de acceso a índices (*access methods*) nativos:

```text
┌──────────┬─────────────────────────────────────────────────────────────────────────┐
│ Método   │ Operadores Soportados y Casos de Uso                                    │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ B-tree   │ =, <, <=, >, >=, BETWEEN, IN, IS NULL, ORDER BY                         │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ Hash     │ = (Igualdad exacta simple en escalares)                                │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ GiST     │ && (solapamiento), @> (contención), <-> (distancia k-NN), rangos, geo   │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ SP-GiST  │ Partición espacial desbalanceada, quadtrees, prefijos de texto         │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ GIN      │ @>, ?, ?& (índice invertido para JSONB, arrays y Full-Text Search)      │
├──────────┼─────────────────────────────────────────────────────────────────────────┤
│ BRIN     │ Rangos físicos de bloques (tablas masivas con orden temporal/físico)    │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

## 15. B-tree

Es el índice por defecto y el más versátil. Mantiene una estructura de árbol balanceado autogestionada.
- Resuelve operadores de comparación escalar, rangos y ordenamientos explícitos (`ORDER BY`).
- Permite ordenamiento bidireccional y navegación prefijada.

```sql
CREATE INDEX idx_orders_customer_created
ON orders (customer_id, created_at DESC);
```

---

## 16. Índices Compuestos y PostgreSQL 18 B-tree Skip Scan

En un índice compuesto `(A, B)`:
- Tradicionalmente, las consultas deben filtrar por la columna guía `A` para aprovechar el índice eficientemente.
- **PostgreSQL 18+ incorpora B-tree Skip Scans**, permitiendo al optimizador "saltar" entre valores distintos de la primera columna cuando la cardinalidad de $A$ es baja y la consulta filtra únicamente por $B$.
- **Regla:** A pesar de las optimizaciones del motor, el orden de las columnas debe seguir guiándose por la selectividad de los filtros principales: columnas de igualdad estricta primero, seguidas de columnas de rango o de ordenamiento.

---

## 17. Covering Index (`INCLUDE`)

Permite incluir columnas adicionales en el nivel de hojas del índice B-tree sin que formen parte de la clave de búsqueda:

```sql
CREATE INDEX idx_orders_customer_covering
ON orders (customer_id)
INCLUDE (status, total_amount);
```
**Beneficio:** Permite al motor ejecutar un **Index-Only Scan**, extrayendo las columnas `status` y `total_amount` directamente desde las páginas del índice sin tocar las páginas de la tabla (*heap fetch = 0*), siempre que el mapa de visibilidad de la tabla esté actualizado por `VACUUM`.

---

## 18. Partial Index (Índices Parciales)

Indexa únicamente un subconjunto de filas que cumplen una cláusula `WHERE`:

```sql
CREATE INDEX idx_orders_unprocessed
ON orders (created_at)
WHERE status IN ('pending', 'processing');
```
**Ventajas:**
- Ocupa una fracción mínima de espacio en disco y memoria RAM.
- No sufre penalización de escritura cuando se insertan o actualizan filas fuera del filtro (p. ej., pedidos finalizados).

---

## 19. Expression Index (Índices sobre Expresiones)

Indexa el resultado de una función determinista o cálculo:

```sql
CREATE UNIQUE INDEX uq_users_email_ci
ON users (lower(email));
```
Permite acelerar consultas como `WHERE lower(email) = lower($1)` y garantiza la unicidad estricta insensible a mayúsculas y minúsculas.

---

## 20. GIN (Generalized Inverted Index)

Índice invertido diseñado para columnas compuestas cuyos elementos internos deben buscarse individualmente:
- Documentos `jsonb`.
- Vectores de búsqueda textual `tsvector`.
- Arrays escalares `text[]`, `bigint[]`.
> [!NOTE]
> GIN tiene un costo de inserción y actualización superior al de B-tree porque una única fila genera múltiples entradas en el índice. En tablas con escritura intensiva, ajustar `fastupdate = on` y monitorear el tamaño de la lista de pendientes.

---

## 21. GiST (Generalized Search Tree)

Estructura de árbol extensible para datos de geometría, rangos temporales continuos y búsqueda de vecinos más cercanos (*k-Nearest Neighbors*):
- Fundamental para `tstzrange` y restricciones `EXCLUDE`.
- Esencial en dominios geoespaciales con `PostGIS` (`ST_DWithin`, `ST_Intersects`).

---

## 22. SP-GiST (Space-Partitioned GiST)

Método de acceso para espacios de datos no balanceados:
- Árboles de sufijos / radix trees para direcciones IP (`inet`).
- Quadtrees para agrupaciones de puntos espaciales dispersos.

---

## 23. BRIN (Block Range Index)

Almacena únicamente los valores mínimo y máximo correspondientes a rangos físicos contiguos de bloques en el disco (por defecto, 128 páginas de 8KB):
- Ideal para tablas gigantescas (decenas o cientos de gigabytes) donde los datos tienen una correlación física estricta con el tiempo de inserción (`created_at`, `event_id`, series de tiempo, outbox histórico).
- Ocupa hasta un 99% menos de espacio que un índice B-tree equivalente.

```sql
CREATE INDEX idx_audit_logs_brin_created
ON audit_logs
USING BRIN (created_at);
```

---

## 24. Hash Index

Optimizado para comparaciones de igualdad simple (`=`):
- Desde PostgreSQL 10, los índices Hash generan WAL y son totalmente seguros ante caídas y compatibles con replicación.
- Sin embargo, B-tree sigue siendo la opción recomendada por defecto debido a su flexibilidad para soportar ordenamientos, rangos y verificaciones de unicidad.

---

## 25. Principio: No Indexar por Intuición

Todo índice creado en el esquema debe responder satisfactoriamente a las 6 preguntas maestras:
1. **¿Qué consulta o patrón de acceso crítico mejora?**
2. **¿Qué selectividad tiene el filtro?** (Si el filtro devuelve el 40% de la tabla, el planner preferirá un `Seq Scan`).
3. **¿Cuánto costo de I/O y memoria añade a los `INSERT`, `UPDATE` y `DELETE`?**
4. **¿Cuánto espacio físico ocupa en RAM (`shared_buffers`) y en almacenamiento de disco?**
5. **¿Qué volumen de WAL adicional genera en cada transacción?**
6. **¿Lo está utilizando efectivamente el optimizador?** (Validar mediante `pg_stat_user_indexes.idx_scan`).

---

## 26. Query Planner (Optimizador Basado en Costos)

El motor de PostgreSQL evalúa múltiples planes de ejecución y calcula el costo computacional estimado en función de unidades arbitrarias de costo de página (`seq_page_cost = 1.0`, `random_page_cost = 4.0` o `1.1` en discos SSD/NVMe).

Métodos de escaneo y unión seleccionados por el planner:
- **Scans**: `Seq Scan`, `Index Scan`, `Index Only Scan`, `Bitmap Index Scan` + `Bitmap Heap Scan`.
- **Joins**:
  - `Nested Loop`: Eficiente cuando el conjunto exterior es pequeño y el interior está indexado.
  - `Hash Join`: Eficiente para unir conjuntos medianos a grandes sin orden previo.
  - `Merge Join`: Eficiente cuando ambos conjuntos ya están ordenados por la clave de unión.
- **Sorts**: `Sort` (en memoria si entra en `work_mem`; en disco si desborda), `Incremental Sort`.

---

## 27. Diagnóstico con `EXPLAIN`

Niveles de introspección:

```sql
-- 1. Estimación teórica sin ejecutar la consulta
EXPLAIN SELECT * FROM orders WHERE customer_id = 42;

-- 2. Ejecución real con medición de tiempos y filas (ANALYZE ejecuta la query)
EXPLAIN ANALYZE SELECT * FROM orders WHERE customer_id = 42;

-- 3. Análisis forense completo de producción (tiempos, buffers de memoria y disco)
EXPLAIN (ANALYZE, BUFFERS, SETTINGS)
SELECT * FROM orders WHERE customer_id = 42;
```
> [!CAUTION]
> Recordar que `EXPLAIN ANALYZE` **ejecuta físicamente** la sentencia. Jamás correr `EXPLAIN ANALYZE` sobre sentencias `DELETE` o `UPDATE` destructivas en entornos de producción.

Métricas clave en la salida de `BUFFERS`:
- `shared hit`: Páginas leídas directamente de la memoria caché de PostgreSQL (`shared_buffers`).
- `shared read`: Páginas leídas físicamente desde el disco o la caché del sistema operativo.
- `shared dirtied`: Páginas modificadas que requerirán flush a disco.

---

## 28. Estadísticas del Optimizador

El planificador depende de las estadísticas recopiladas en la tabla de catálogo `pg_statistic` (accesible mediante la vista `pg_stats`).
- Un plan ineficiente frecuentemente no se debe a la ausencia de un índice, sino a estadísticas desactualizadas o a una estimación errónea de cardinalidad.
- Forzar actualización de estadísticas:
```sql
ANALYZE orders;
-- o en conjunto con recolección de espacio:
VACUUM ANALYZE orders;
```

---

## 29. Estadísticas Extendidas (`CREATE STATISTICS`)

Cuando dos o más columnas están funcionalmente correlacionadas (p. ej., `city` y `zip_code`, o `make` y `model`), el planner asume independencia estadística ($P(A \land B) = P(A) \times P(B)$), subestimando gravemente la cantidad de filas resultantes y eligiendo un plan subóptimo (p. ej., un `Nested Loop` desastroso).

```sql
CREATE STATISTICS stat_locations_city_zip (dependencies, mcv)
ON city, zip_code FROM locations;

ANALYZE locations;
```

---

## 30. MVCC (Multi-Version Concurrency Control)

PostgreSQL gestiona la concurrencia sin recurrir a bloqueos de lectura generalizados:
- Cada transacción observa un **snapshot** consistente de datos, determinado por su identificador de transacción (`txid`/`xid`) y los límites de visibilidad en el momento de creación del snapshot.
- **Regla Fundamental:** Los lectores jamás bloquean a los escritores, y los escritores jamás bloquean a los lectores.
- Sin embargo, los escritores sí bloquean a otros escritores cuando intentan modificar la misma fila.

---

## 31. Consecuencias de MVCC: Tuplas Muertas y Bloat

En PostgreSQL, una sentencia `UPDATE` o `DELETE` **no sobreescribe los datos en la misma posición de la página de disco**:
- `DELETE`: Marca la tupla actual con un `xmax` correspondiente a la transacción que la eliminó. La tupla permanece físicamente en la página.
- `UPDATE`: Marca la tupla original como eliminada (`xmax`) e inserta una nueva versión de la tupla (*new tuple*) con un nuevo identificador de tupla física (`ctid`).
- Cuando ninguna transacción activa necesita ver la versión anterior, dicha tupla se convierte en una **tupla muerta (*dead tuple*)**.
- La acumulación de tuplas muertas no recolectadas provoca **bloat** (inflamiento innecesario del tamaño de tablas e índices), degradando la velocidad de los escaneos y saturando la caché.

---

## 32. VACUUM

El proceso de `VACUUM` cumple tres roles críticos e irremplazables:
1. **Recuperación de Espacio**: Recorre las páginas de datos, localiza tuplas muertas y marca su espacio físico como reutilizable para futuros `INSERT` o `UPDATE` dentro del mismo archivo de tabla.
2. **Actualización del Visibility Map (VM)**: Permite que el planner utilice *Index-Only Scans* con seguridad al certificar qué páginas contienen únicamente tuplas visibles para todas las transacciones.
3. **Prevención de Wraparound de Transaction IDs**: Congela (*freezing*) tuplas antiguas para evitar que el contador circular de 32 bits de transacciones se reinicie y vuelva invisibles los datos históricos.

---

## 33. Autovacuum

`autovacuum` es el proceso demonio en segundo plano encargado de ejecutar `VACUUM` y `ANALYZE` automáticamente según umbrales de modificación:
> [!IMPORTANT]
> **Queda terminantemente prohibido deshabilitar `autovacuum`.**
> Deshabilitar autovacuum lleva indefectiblemente a degradación severa de rendimiento, saturación de disco por bloat y parada catastrófica de base de datos por riesgo de *transaction wraparound*.

Ajuste fino (*tuning*) para tablas de alta rotación en `@testimonial-cms`:
```sql
ALTER TABLE outbox_events SET (
    autovacuum_vacuum_scale_factor = 0.05,  -- Disparar al modificarse el 5% de filas
    autovacuum_vacuum_threshold = 1000,     -- Umbral mínimo de 1000 filas
    autovacuum_vacuum_cost_limit = 2000     -- Mayor cuota de I/O para evitar retrasos
);
```

---

## 34. VACUUM FULL

- `VACUUM`: Limpia tuplas muertas y permite la reutilización interna de espacio en páginas existentes. No devuelve espacio al sistema operativo (salvo páginas completamente vacías al final del archivo) y no bloquea lecturas ni escrituras concurrentes.
- `VACUUM FULL`: Reescribe físicamente toda la tabla a un nuevo archivo en disco y devuelve el espacio al sistema operativo.
> [!CAUTION]
> `VACUUM FULL` adquiere un bloqueo exclusivo de acceso total (`ACCESS EXCLUSIVE LOCK`), impidiendo cualquier lectura o escritura concurrente en la tabla durante toda su ejecución. Jamás debe utilizarse como tarea de mantenimiento rutinario en producción.

---

## 35. Monitoreo de Bloat

Detección de tablas con alto porcentaje de tuplas muertas mediante vistas de estadísticas:

```sql
SELECT
    relname AS table_name,
    n_live_tup AS live_tuples,
    n_dead_tup AS dead_tuples,
    round(n_dead_tup * 100.0 / nullif(n_live_tup + n_dead_tup, 0), 2) AS dead_tuple_pct,
    last_vacuum,
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 5000
ORDER BY dead_tuples DESC;
```

---

## 36. REINDEX y `REINDEX CONCURRENTLY`

Los índices B-tree también sufren bloat por fragmentación tras miles de mutaciones:
- Para desfragmentar y reconstruir un índice en producción sin bloquear las operaciones de escritura concurrentes:
```sql
REINDEX INDEX CONCURRENTLY idx_orders_customer_id;
```
- Monitorear el progreso y verificar que el índice reconstruido no quede marcado como `INVALID` en caso de cancelación imprevista.

---

## 37. Transacciones y Semántica ACID

PostgreSQL garantiza atomicidad, consistencia, aislamiento y durabilidad en cada bloque transaccional:

```sql
BEGIN;

UPDATE accounts
SET balance = balance - 150.00
WHERE id = 1 AND balance >= 150.00;

UPDATE accounts
SET balance = balance + 150.00
WHERE id = 2;

COMMIT;
```

Si cualquier sentencia falla o se detecta una violación de constraint, la transacción entra en estado de aborto y debe cerrarse mediante `ROLLBACK;`.

---

## 38. Duración de Transacciones

Una transacción abierta mantiene viva una vista del motor que impide que `VACUUM` limpie tuplas muertas creadas después del `xmin` más antiguo.
> [!CAUTION]
> **Prohibición de Transacciones de Larga Duración:**
> Jamás envolver llamadas a APIs externas HTTP, cálculos pesados de CPU, operaciones de I/O en almacenamiento externo o esperas de usuario dentro de un bloque transaccional `BEGIN ... COMMIT`.

```text
┌────────────────────────────────────────────────────────┐
│                      ANTIPATRÓN                        │
│                                                        │
│  BEGIN;                                                │
│    SELECT for update ...;                              │
│    Llamada HTTP a Stripe / S3 (500ms - 5s) ───► PELIGRO│
│    UPDATE payment_status ...;                          │
│  COMMIT;                                               │
└────────────────────────────────────────────────────────┘
```
**Patrón Correcto:** Realizar las operaciones externas antes o después de la transacción, o utilizar un patrón de Outbox / dos fases.

---

## 39. Niveles de Aislamiento en PostgreSQL

PostgreSQL implementa tres niveles de aislamiento formales:
1. `READ COMMITTED` (por defecto)
2. `REPEATABLE READ`
3. `SERIALIZABLE`

> [!NOTE]
> En PostgreSQL, el nivel estándar SQL `READ UNCOMMITTED` es tratado automáticamente como `READ COMMITTED`. PostgreSQL jamás permite lecturas sucias (*dirty reads*).

---

## 40. READ COMMITTED

- Cada sentencia individual ejecutada dentro de la transacción adquiere un **nuevo snapshot** correspondiente al instante en que comenzó esa sentencia específica.
- Dos `SELECT` idénticos dentro de la misma transacción pueden devolver resultados diferentes (*non-repeatable read*) si otra transacción concurrentemente hizo `COMMIT` entre ambos.

---

## 41. REPEATABLE READ

- La transacción completa adquiere un **único snapshot inmutable** al momento de ejecutar su primera sentencia que no sea de control.
- Garantiza que cualquier lectura posterior verá exactamente el mismo estado del mundo.
- Si una sentencia de modificación intenta actualizar una fila que fue modificada por otra transacción concurrentemente después del inicio del snapshot, PostgreSQL aborta la transacción con un error de serialización:
  `ERROR: could not serialize access due to concurrent update`.
- La aplicación debe capturar este error y reintentar la transacción.

---

## 42. SERIALIZABLE (SSI - Serializable Snapshot Isolation)

Proporciona el nivel más estricto de consistencia matemática, garantizando que cualquier ejecución concurrente produzca exactamente el mismo resultado que alguna ejecución estrictamente secuencial:
- PostgreSQL utiliza SSI, detectando dependencias cíclicas de lectura/escritura (*rw-antidependencies*) sin bloquear lectores.
- Ante un conflicto de serialización, el motor aborta la transacción con código `40001` (`serialization_failure`).
- **Obligación:** El backend debe implementar un mecanismo de reintento automático (*retry backoff con full jitter*) ante excepciones `40001`.

---

## 43. Locking (Mecanismos de Bloqueo)

PostgreSQL dispone de bloqueos a nivel de tabla y a nivel de fila:

### Bloqueos de Fila Comunes:
- `FOR UPDATE`: Bloqueo exclusivo de fila; bloquea a cualquier otro lector `FOR UPDATE` o modificador de fila.
- `FOR NO KEY UPDATE`: Bloqueo de fila que permite a otros adquirir `FOR KEY SHARE`. Ideal para updates que no alteran claves foráneas o primarias.
- `FOR SHARE`: Bloqueo compartido de fila; permite lecturas compartidas concurrentes pero bloquea modificaciones.
- `FOR KEY SHARE`: Permite operaciones como inserciones hijas que referencian la clave.

---

## 44. `FOR UPDATE SKIP LOCKED` (Colas y Patrón Outbox)

Permite seleccionar y bloquear un lote de filas ignorando instantáneamente aquellas que ya están siendo procesadas por otros workers concurrentes:

```sql
-- Consumo concurrente ultra eficiente en NestJS Outbox Worker
SELECT id, event_type, payload
FROM outbox_events
WHERE status = 'pending'
ORDER BY created_at ASC
LIMIT 10
FOR UPDATE SKIP LOCKED;
```
**Beneficio:** Elimina por completo la contención entre workers en paralelo y evita que un worker quede bloqueado esperando que otro termine.

---

## 45. Advisory Locks (Bloqueos Consultivos)

Mecanismo de sincronización distribuida provisto por la propia base de datos, independiente de tablas o filas:

```sql
-- Adquiere un lock transaccional exclusivo sobre una clave numérica de 64 bits
SELECT pg_advisory_xact_lock(hash_key);
```
- El lock se libera automáticamente al terminar la transacción (`COMMIT` o `ROLLBACK`).
- Ideal para coordinar ejecuciones de cron jobs distribuidos o migraciones de base de datos exclusivas sin recurrir a Redis o Zookeeper.

---

## 46. Gestión y Prevención de Deadlocks

Un interbloqueo (*deadlock*) ocurre cuando dos transacciones compiten por recursos en orden inverso:
- Transacción 1: Modifica Fila A, intenta bloquear Fila B.
- Transacción 2: Modifica Fila B, intenta bloquear Fila A.
- PostgreSQL detecta automáticamente el ciclo mediante el temporizador `deadlock_timeout` (por defecto, 1 segundo) y aborta una de las transacciones con código `40P01` (`deadlock_detected`).

**Mitigaciones Obligatorias:**
1. Adquirir recursos y actualizar filas siempre en un orden determinista y unificado (p. ej., ordenando los IDs de forma ascendente antes de bloquear).
2. Mantener las transacciones lo más breves posible.
3. Indexar adecuadamente todas las claves foráneas.

---

## 47. Concurrencia Optimista (`version`)

Para operaciones con baja probabilidad de colisión o interfaces interactivas donde los bloqueos pesados son inviables:

```sql
UPDATE documents
SET
    title = $1,
    content = $2,
    version = version + 1,
    updated_at = now()
WHERE id = $3
  AND version = $4;
```
Si la consulta devuelve `affected_rows = 0`, la aplicación detecta inmediatamente que otro usuario o proceso modificó el registro en paralelo y rechaza la operación con un error de conflicto de negocio (HTTP 409).

---

## 48. UPSERT (`INSERT ... ON CONFLICT`)

Garantiza la inserción idempotente sin condiciones de carrera:

```sql
INSERT INTO user_preferences (user_id, theme, notifications_enabled)
VALUES ($1, $2, $3)
ON CONFLICT (user_id)
DO UPDATE SET
    theme = EXCLUDED.theme,
    notifications_enabled = EXCLUDED.notifications_enabled,
    updated_at = now();
```
> [!CAUTION]
> Jamás implementar la secuencia `SELECT ... IF NOT EXISTS THEN INSERT` en el código de la aplicación. En entornos concurrentes, esta secuencia introduce una condición de carrera insalvable que provoca violaciones de clave única o registros duplicados.

---

## 49. Cláusula `RETURNING`

Permite recuperar los datos generados o actualizados por una sentencia DML sin necesidad de ejecutar un `SELECT` posterior en un round-trip adicional de red:

```sql
INSERT INTO orders (customer_id, total_amount, status)
VALUES ($1, $2, 'pending')
RETURNING id, created_at;
```

---

## 50. Common Table Expressions (CTE)

Utilizar `WITH` para modularizar consultas complejas y `WITH RECURSIVE` para recorrer grafos y jerarquías:

```sql
WITH RECURSIVE category_tree AS (
    -- Miembro ancla
    SELECT id, parent_id, name, 1 AS depth
    FROM categories
    WHERE id = $1

    UNION ALL

    -- Miembro recursivo
    SELECT c.id, c.parent_id, c.name, ct.depth + 1
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
)
SELECT * FROM category_tree;
```
> [!NOTE]
> Desde PostgreSQL 12, los CTEs no recursivos son inlinados automáticamente por el optimizador salvo que se especifique explícitamente `WITH cte AS MATERIALIZED (...)`.

---

## 51. Window Functions (Funciones de Ventana)

Permiten realizar cálculos sobre particiones de filas sin colapsar el conjunto de resultados:

```sql
SELECT
    id,
    customer_id,
    total_amount,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY customer_id ORDER BY created_at DESC) AS order_rank,
    SUM(total_amount) OVER (PARTITION BY customer_id) AS total_customer_spend,
    LAG(total_amount, 1) OVER (PARTITION BY customer_id ORDER BY created_at ASC) AS prev_order_amount
FROM orders;
```

---

## 52. Consultas Correlacionadas con `LATERAL`

La cláusula `JOIN LATERAL` permite que una subconsulta haga referencia a columnas de tablas precedentes en la cláusula `FROM`:

```sql
-- Obtener los 3 pedidos más recientes de cada cliente (Top-N per group)
SELECT c.name, o.id, o.total_amount, o.created_at
FROM customers c
CROSS JOIN LATERAL (
    SELECT id, total_amount, created_at
    FROM orders
    WHERE orders.customer_id = c.id
    ORDER BY created_at DESC
    LIMIT 3
) o;
```

---

## 53. Cláusula `DISTINCT ON`

Funcionalidad única y altamente eficiente de PostgreSQL para obtener la primera fila de cada grupo según un orden específico:

```sql
-- Obtener el último testimonio aprobado por cada proyecto
SELECT DISTINCT ON (project_id)
    project_id,
    id AS testimonial_id,
    rating,
    created_at
FROM testimonials
WHERE status = 'approved'
ORDER BY project_id, created_at DESC;
```
*Requiere un índice compuesto sobre `(project_id, created_at DESC)` para una ejecución óptima.*

---

## 54. Full-Text Search (Búsqueda Textual Nativa)

PostgreSQL incluye motores de búsqueda léxica nativos mediante `tsvector` y `tsquery`:

```sql
-- Columna generada para búsqueda textual indexada
ALTER TABLE testimonials
ADD COLUMN search_vector tsvector
GENERATED ALWAYS AS (
    to_tsvector('spanish', coalesce(title, '') || ' ' || coalesce(content, ''))
) STORED;

CREATE INDEX idx_testimonials_search_gin
ON testimonials
USING GIN (search_vector);

-- Consulta acelerada por el índice GIN
SELECT id, title, content
FROM testimonials
WHERE search_vector @@ to_tsquery('spanish', 'servicio & excelente');
```

---

## 55. Trigram Search (`pg_trgm`)

La extensión `pg_trgm` descompone textos en trigramas de 3 caracteres, habilitando búsquedas difusas (*fuzzy matching*) y acelerando consultas `LIKE '%texto%'`:

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_customers_name_trgm
ON customers
USING GIN (name gin_trgm_ops);

-- Búsqueda difusa y coincidencia parcial acelerada
SELECT id, name, similarity(name, 'Gonzales') AS score
FROM customers
WHERE name % 'Gonzales' OR name ILIKE '%facundo%'
ORDER BY score DESC;
```

---

## 56. Organización Modular mediante Schemas

Utilizar esquemas para aislar dominios funcionales y permisos:
- `auth`: Tablas de usuarios, sesiones y credenciales.
- `billing`: Suscripciones, facturas y métodos de pago.
- `public`: Entidades compartidas principales.
- `analytics`: Tablas de lectura y materializaciones.

---

## 57. Seguridad en `search_path`

El parámetro `search_path` define el orden de resolución de nombres de esquemas:
> [!CAUTION]
> En entornos multiusuario o funciones `SECURITY DEFINER`, no confiar ciegamente en el `search_path`. Un atacante con permisos de creación de objetos en un esquema público podría crear una tabla o función maliciosa que suplante a la original. Calificar siempre explícitamente los nombres de objetos (`schema.table`) o fijar `SET search_path = pg_catalog, pg_temp;` en funciones de seguridad.

---

## 58. Segregación de Roles

Nunca utilizar el usuario maestro `postgres` como credencial de conexión del backend. Diseñar roles con separación de responsabilidades:

```sql
-- Rol de runtime para la aplicación NestJS
CREATE ROLE app_runtime WITH LOGIN PASSWORD 'secure_token' NOSUPERUSER NOCREATEDB;

-- Rol exclusivo para migraciones CI/CD
CREATE ROLE app_migrator WITH LOGIN PASSWORD 'migration_token' NOSUPERUSER CREATEDB;

-- Rol de solo lectura para dashboards y réplicas
CREATE ROLE app_readonly WITH LOGIN PASSWORD 'readonly_token' NOSUPERUSER;
```

---

## 59. Principio de Mínimo Privilegio (Least Privilege)

Otorgar únicamente los permisos estrictamente necesarios sobre cada objeto:

```sql
GRANT CONNECT ON DATABASE testimonial_db TO app_runtime;
GRANT USAGE ON SCHEMA public TO app_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_runtime;

-- Prohibir DDL a runtime
REVOKE CREATE ON SCHEMA public FROM app_runtime;
```

---

## 60. Row-Level Security (RLS)

PostgreSQL permite aplicar políticas de seguridad a nivel de fila transparentes para las consultas:

```sql
-- Habilitar RLS en la tabla
ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Forzar RLS incluso si el usuario es dueño de la tabla
ALTER TABLE testimonials FORCE ROW LEVEL SECURITY;
```

---

## 61. Multi-Tenancy Aislado con RLS

Implementación de aislamiento multi-inquilino de alta seguridad mediante variables de sesión de aplicación:

```sql
-- Política de lectura y escritura restringida al tenant activo
CREATE POLICY tenant_isolation_policy
ON testimonials
FOR ALL
USING (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
)
WITH CHECK (
    tenant_id = nullif(current_setting('app.current_tenant_id', true), '')::uuid
);
```

En NestJS o Prisma, cada conexión que toma un cliente del pool ejecuta antes de cualquier consulta:
```sql
SELECT set_config('app.current_tenant_id', $1, true);
```
*(El tercer parámetro `is_local = true` garantiza que la variable caduque al finalizar la transacción).*

---

## 62. Seguridad en Consultas (Prevención de SQLi)

Utilizar siempre consultas parametrizadas con placeholders (`$1, $2`).
> [!CAUTION]
> Jamás concatenar variables de usuario mediante cadenas de texto en SQL crudo. El uso de un ORM como Prisma no exime de riesgo si se utilizan métodos como `$queryRawUnsafe` con interpolación de variables.

---

## 63. Funciones en Servidor y PL/pgSQL

Utilizar funciones SQL o procedimientos PL/pgSQL cuando aporten:
1. **Atomicidad garantizada** de múltiples pasos en el motor.
2. **Eliminación de latencia de red** en transformaciones intensivas sobre millones de filas.
3. **Invariantes matemáticas estrictas**.

Evitar trasladar la totalidad de la lógica de negocio a procedimientos almacenados para no dificultar el versionado, testeo unitario y escalabilidad horizontal de la aplicación.

---

## 64. Triggers de Base de Datos

Buenos casos de uso para triggers:
- **Auditoría inmutable**: Copiar la versión anterior de cada fila modificada a una tabla `audit_log` con usuario y timestamp.
- **Transactional Outbox automático**: Generar un evento de dominio en `outbox_events` cada vez que una entidad cambie de estado.
- **Actualización de columna `updated_at`**: Garantizar la consistencia temporal.

---

## 65. Generated Columns (Columnas Generadas)

PostgreSQL soporta columnas calculadas determinísticamente a partir de otras columnas de la misma fila:

```sql
CREATE TABLE invoices (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subtotal numeric(14,2) NOT NULL,
    tax_rate numeric(4,2) NOT NULL,
    tax_amount numeric(14,2) GENERATED ALWAYS AS (round(subtotal * (tax_rate / 100.0), 2)) STORED,
    total numeric(14,2) GENERATED ALWAYS AS (subtotal + round(subtotal * (tax_rate / 100.0), 2)) STORED
);
```

---

## 66. Particionamiento Declarativo

PostgreSQL soporta particionamiento de tablas por `RANGE`, `LIST` y `HASH`:

```sql
-- Tabla particionada por rangos temporales
CREATE TABLE audit_logs (
    id bigint GENERATED ALWAYS AS IDENTITY,
    tenant_id uuid NOT NULL,
    message text NOT NULL,
    created_at timestamptz NOT NULL,
    PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Partición de un mes específico
CREATE TABLE audit_logs_2026_09 PARTITION OF audit_logs
    FOR VALUES FROM ('2026-09-01 00:00:00+00') TO ('2026-10-01 00:00:00+00');
```

---

## 67. Cuándo Particionar (Criterios Técnicos)

Particionar **únicamente** cuando se cumplan al menos dos de las siguientes condiciones:
1. La tabla supera varias decenas de millones de filas o cientos de gigabytes y la memoria RAM no puede albergar sus índices.
2. El ciclo de vida de los datos depende estrictamente de la clave de partición (p. ej., depurar datos de hace más de 1 año mediante un instantáneo `DROP TABLE audit_logs_2025_09;` sin el costo masivo de un `DELETE`).
3. Las consultas críticas filtran casi invariablemente por la clave de partición.

---

## 68. Partition Pruning

El beneficio primordial del particionamiento reside en que el planner descarte las particiones que no contienen datos relevantes para la consulta:
- Validar siempre en `EXPLAIN` que el plan muestre `Partitions removed to prune: X` y que no realice escaneos sobre todas las particiones del árbol.

---

## 69. Índices y Particionamiento Concurrente

Al definir un índice sobre la tabla padre particionada, PostgreSQL crea automáticamente los índices en todas las particiones hijas existentes y futuras:
> [!WARNING]
> En tablas de producción de gran tamaño, no es posible ejecutar `CREATE INDEX CONCURRENTLY` sobre la tabla padre particionada. La estrategia recomendada consiste en crear el índice concurrentemente en cada partición hija individual y, finalmente, adjuntar el índice en la tabla padre.

---

## 70. Gestión de Migraciones Versionadas

Todo cambio estructural debe registrarse en archivos SQL inmutables y secuenciales ejecutados por una herramienta de migración (p. ej., Prisma Migrate, Flyway, o scripts SQL versionados). Jamás aplicar cambios DDL manuales en consolas de producción.

---

## 71. Migraciones Zero-Downtime

Para evitar caídas de servicio (*downtime*) durante despliegues:
1. **Configurar Timeouts Estrictos**:
```sql
SET lock_timeout = '2s';
SET statement_timeout = '30s';
```
2. Si el comando DDL no puede adquirir el lock en 2 segundos debido a transacciones concurrentes, se aborta limpiamente sin acumular una cola de bloqueos que paralice la base de datos.

---

## 72. Patrón Expand / Migrate / Contract

Metodología de 5 fases para modificar esquemas en producción sin interrupción de servicio:

```text
1. EXPAND
   Agregar la nueva columna o tabla como opcional (compatible con la versión actual de la app).
   Ejemplo: ALTER TABLE users ADD COLUMN full_name text;

2. DEPLOY APLICACIÓN DUAL
   Desplegar código que lee del campo nuevo (o fallback al viejo) y escribe en ambos.

3. MIGRATE (Backfill)
   Migrar los datos históricos en lotes pequeños en segundo plano sin saturar I/O.
   Ejemplo: UPDATE users SET full_name = first_name || ' ' || last_name WHERE full_name IS NULL LIMIT 1000;

4. SWITCH
   Desplegar la versión de la aplicación que utiliza exclusivamente la nueva estructura.

5. CONTRACT
   Eliminar la estructura antigua de forma segura.
   Ejemplo: ALTER TABLE users DROP COLUMN first_name, DROP COLUMN last_name;
```

---

## 73. `CREATE INDEX CONCURRENTLY`

La creación estándar de un índice adquiere un bloqueo `SHARE`, permitiendo lecturas pero **bloqueando todas las escrituras** (`INSERT`, `UPDATE`, `DELETE`) en la tabla hasta que finalice:

```sql
CREATE INDEX CONCURRENTLY idx_users_created_at ON users(created_at);
```
- No bloquea escrituras.
- Requiere dos escaneos de tabla y espera a que terminen las transacciones activas.
- Si falla, el índice queda en estado `INVALID`. Debe eliminarse con `DROP INDEX CONCURRENTLY` antes de reintentar.

---

## 74. Adición Segura de Constraints con `NOT VALID`

Agregar una restricción `CHECK` o `FOREIGN KEY` sobre una tabla masiva normalmente bloquea la tabla mientras valida millones de filas existentes.

**Técnica Zero-Downtime:**
```sql
-- Paso 1: Adquirir lock ultracorto para registrar el constraint sin validar filas viejas
ALTER TABLE orders
ADD CONSTRAINT chk_orders_amount_positive
CHECK (total_amount >= 0) NOT VALID;

-- Paso 2: Validar todas las filas existentes en segundo plano sin bloquear escrituras
ALTER TABLE orders
VALIDATE CONSTRAINT chk_orders_amount_positive;
```

---

## 75. Connection Pooling y Dimensionamiento

Cada conexión en PostgreSQL es atendida por un proceso de sistema operativo independiente (`postgres: backend`) que consume entre 5MB y 20MB de RAM y satura los cambios de contexto de CPU si se multiplican descontroladamente.

**Fórmula Empírica de Dimensionamiento:**
$$\text{Pool Size} = (2 \times \text{Core Count}) + \text{Spindle / Effective Disks}$$

Tener 500 conexiones directas abiertas degrada el rendimiento. Es infinitamente superior encolar peticiones en un pool optimizado de 20 a 50 conexiones activas.

---

## 76. Costo del Exceso de Conexiones

Demasiadas conexiones provocan:
- Contención severa de CPU por *context switching*.
- Saturación de memoria por asignación de `work_mem` simultáneo.
- Degradación de rendimiento generalizada (*connection thrashing*).

---

## 77. PgBouncer: Modos de Pooling

Proxy de conexiones ligero indispensable para arquitecturas de alta concurrencia:
- **Session Pooling**: La conexión del pool se asigna al cliente durante toda su sesión. Seguro pero ofrece menor reutilización.
- **Transaction Pooling** (Modo Recomendado para APIs REST): La conexión del pool se devuelve al pool tan pronto como finaliza cada bloque transaccional (`COMMIT` o `ROLLBACK`). Permite atender 10,000 clientes con apenas 50 conexiones a PostgreSQL.
  - *Restricciones en Transaction Pooling:* No permite el uso de variables de sesión no locales, tablas temporales, `LISTEN/NOTIFY` persistentes, ni `PREPARE` de consultas nombradas sin configuración explícita.
- **Statement Pooling**: No soporta transacciones multisentencia. No recomendado para aplicaciones transaccionales estándar.

---

## 78. WAL (Write-Ahead Logging)

PostgreSQL garantiza la durabilidad (D en ACID) mediante el registro previo de transacciones:
- Antes de que cualquier página de datos sea modificada en disco, la descripción exacta del cambio debe quedar registrada físicamente en el registro secuencial WAL.
- Si el servidor pierde energía repentinamente, al reiniciar recorre el WAL y reproduce todas las transacciones confirmadas (*redo log*), recuperando la consistencia matemática de forma infalible.

---

## 79. Checkpoints

Proceso periódico mediante el cual PostgreSQL escribe todas las páginas sucias (*dirty buffers*) de memoria al almacenamiento físico y avanza el punto de recuperación del WAL:
- Un checkpoint agresivo genera picos masivos de I/O (*checkpoint spikes*).
- Parámetros de sintonización: `checkpoint_completion_target = 0.9` (esparce la escritura a lo largo del tiempo para evitar picos de latencia), `max_wal_size = 16GB`.

---

## 80. Replicación Física (Streaming Replication)

Topología de alta disponibilidad basada en la transmisión binaria de bloques WAL desde un nodo **Primary** hacia uno o más nodos **Standby**:
- Proporciona réplicas de lectura (*Read Scaling*) y servidores de respaldo listos para promoción (*Failover*).

---

## 81. Métricas de Replication Lag

En réplicas de lectura asíncronas, monitorear constantemente tres brechas de latencia:
1. `write_lag`: Tiempo transcurrido entre la escritura en el primary y la recepción en el standby.
2. `flush_lag`: Tiempo transcurrido hasta que la réplica descarga el WAL a disco físico.
3. `replay_lag`: Tiempo transcurrido hasta que la réplica aplica los cambios a sus páginas de datos locales.

---

## 82. Replicación Síncrona vs Asíncrona

- **Asíncrona (por defecto)**: El primary confirma el `COMMIT` inmediatamente tras escribir su WAL local. Rendimiento máximo, pero existe riesgo de pérdida de datos marginal ($RPO > 0$) ante una caída catastrófica del primary antes de transmitir el WAL.
- **Síncrona (`synchronous_commit = on`)**: El primary espera a que al menos un standby confirme la recepción o descarga del WAL antes de responder `COMMIT` al cliente. Garantiza $RPO = 0$, pero introduce la latencia de red en cada transacción de escritura.

---

## 83. Replicación Lógica (`PUBLICATION` / `SUBSCRIPTION`)

Transmite eventos de datos a nivel de fila decodificados lógicamente:
- Permite replicar únicamente un subconjunto de tablas o filtrar por filas.
- Ideal para Change Data Capture (CDC) hacia Kafka, integración con plataformas de analítica, o migraciones sin interrupción entre distintas versiones mayores de PostgreSQL.

---

## 84. Identidad de Replicación (`REPLICA IDENTITY`)

Para que la replicación lógica pueda aplicar sentencias `UPDATE` y `DELETE` en el suscriptor, la tabla debe contar con una clave de identificación inequívoca:
- Por defecto utiliza la Clave Primaria (`DEFAULT`).
- Si una tabla carece de PK, debe configurarse explícitamente `REPLICA IDENTITY FULL`, lo que obliga a escanear toda la tabla en cada actualización en el nodo destino.

---

## 85. Replication Slots y Riesgo de Llenado de Disco

Un *replication slot* retiene los archivos WAL en el nodo primario hasta que el consumidor confirme haberlos procesado:
> [!CAUTION]
> Si un suscriptor o réplica se desconecta y el slot permanece abandonado, el servidor primario continuará acumulando archivos WAL indefinidamente sin reciclarlos, saturando por completo el disco de almacenamiento y deteniendo la base de datos de producción. Monitorear siempre la vista `pg_replication_slots`.

---

## 86. Familias de Backup en PostgreSQL

Existen tres familias de respaldos:
1. **SQL Dump Lógico** (`pg_dump`, `pg_dumpall`).
2. **Copia a Nivel de Sistema de Archivos** (Snapshots de volumen / EBS con cluster detenido).
3. **Archivado Continuo de WAL y Base Backups Físicos** (`pg_basebackup`, `pgBackRest`, `WAL-G`).

---

## 87. `pg_dump` y sus Límites

`pg_dump` genera un script SQL o archivo tar con la estructura y datos lógicos:
- Excelente para entornos de desarrollo, migraciones menores y respaldos selectivos de esquemas pequeños.
- **Inviable para bases de datos críticas de alto volumen**: No permite recuperación puntual en el tiempo (PITR), consume gran cantidad de memoria y CPU, y la restauración de cientos de gigabytes puede demorar horas o días.

---

## 88. PITR (Point-In-Time Recovery)

Mecanismo nativo de recuperación ante desastres de PostgreSQL:
$$\text{Base Backup Físico} + \text{Archivado Continuo de Segmentos WAL}$$
Permite restaurar la base de datos exactamente al estado en que se encontraba en cualquier instante temporal arbitrario del pasado (p. ej., las `14:23:05.120 UTC`), deteniendo la reproducción de logs un milisegundo antes de que ocurriera un `DROP TABLE` o una corrupción accidental.

---

## 89. Principio: Backup no es Replicación

> [!IMPORTANT]
> **Alta Disponibilidad (HA) NO es un Backup.**
> Si un desarrollador o proceso ejecuta por error un `DELETE FROM customers;` en el nodo primario, la replicación en streaming replicará ese borrado de forma instantánea a todas las réplicas en milisegundos. Solo una estrategia de **PITR y backups aislados e inmutables** permite recuperar los datos ante desastres humanos o lógicos.

---

## 90. Definición de RPO y RTO

Toda arquitectura de datos debe definir formalmente sus objetivos de continuidad de negocio:
- **RPO (Recovery Point Objective)**: Cantidad máxima tolerable de datos perdidos ante un desastre, medida en tiempo (p. ej., *"máximo 5 minutos de transacciones perdidas"*). Determina la frecuencia de archivado de WAL o replicación síncrona.
- **RTO (Recovery Time Objective)**: Tiempo máximo tolerable para restaurar y reanudar el servicio operativo (p. ej., *"recuperación operativa en menos de 30 minutos"*). Determina la velocidad de descarga y restauración de los respaldos físicos.

---

## 91. Pruebas Obligatorias de Restauración (Restore Testing)

> [!CAUTION]
> Un respaldo cuya restauración jamás ha sido ejecutada y validada en un entorno de pruebas no constituye evidencia de recuperabilidad. Es una mera esperanza.
> Programar pruebas periódicas automatizadas que descarguen el backup, levanten una instancia aislada, apliquen el WAL hasta un punto objetivo y ejecuten smoke tests de integridad de datos.

---

## 92. Observabilidad Esencial

Métricas indispensables que deben ser recolectadas y alertadas continuamente:
- Latencia de consultas ($p50, p95, p99$).
- Tasa de transacciones por segundo (TPS) y abortos (`xact_commit`, `xact_rollback`).
- Esperas de bloqueos de tablas y filas (`pg_locks`).
- Ocupación de conexiones activas e inactivas (`pg_stat_activity`).
- Cache Hit Ratio (porcentaje de bloques servidos desde memoria vs disco):
```sql
SELECT
    sum(heap_blks_hit) / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100.0 AS cache_hit_ratio
FROM pg_statio_user_tables;
```
*(Debe mantenerse superior al 99% en cargas de trabajo transaccionales estándar).*

---

## 93. Extensión `pg_stat_statements`

Es la extensión de observabilidad de rendimiento más relevante del ecosistema PostgreSQL:
- Recopila estadísticas acumuladas sobre todas las consultas normalizadas ejecutadas en el motor: llamadas totales, tiempo total, tiempo medio, lecturas de buffers, y en **PostgreSQL 18+, métricas ampliadas de generación de WAL y actividad paralela**.

```sql
SELECT
    queryid,
    substring(query, 1, 60) AS query_sample,
    calls,
    round(total_exec_time::numeric, 2) AS total_ms,
    round(mean_exec_time::numeric, 2) AS avg_ms,
    shared_blks_read AS disk_reads,
    shared_blks_hit AS cache_hits
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

---

## 94. Configuración Estratégica de Logs

Parámetros fundamentales en `postgresql.conf`:
- `log_min_duration_statement = 250`: Registra en el log cualquier consulta que demore más de 250 milisegundos.
- `log_lock_waits = on`: Registra advertencias cuando una sesión espera más de `deadlock_timeout` para adquirir un bloqueo.
- `log_line_prefix = '%m [%p] %q%u@%d '`: Incluye marca de tiempo, ID de proceso, usuario y base de datos en cada línea de log.
- Evitar `log_statement = 'all'` en producción salvo auditorías muy acotadas, ya que satura el almacenamiento y expone información sensible (PII) en los logs.

---

## 95. Metodología de Triaje ante Consultas Lentas

Flujo de investigación estructurado cuando se reporta lentitud:

```text
1. Identificar la consulta en pg_stat_statements o log de slow queries.
   ↓
2. Ejecutar EXPLAIN (ANALYZE, BUFFERS) en un entorno representativo.
   ↓
3. Comparar filas estimadas vs filas reales:
   ¿Hay una diferencia de varios órdenes de magnitud? → Correr ANALYZE o CREATE STATISTICS.
   ↓
4. Analizar los buffers:
   ¿shared_blks_read es masivo? → La consulta está haciendo escaneos de disco por falta de índice.
   ↓
5. Verificar si hay filtros no selectivos o un Seq Scan evitable.
   ↓
6. Evaluar la necesidad de un índice B-tree compuesto o parcial.
   ↓
7. Verificar que el código de la aplicación no sufra el problema N+1.
```

---

## 96. Erradicación del Problema N+1

El antipatrón N+1 consiste en consultar una lista de $N$ registros padre y luego ejecutar una consulta individual para obtener los hijos de cada uno de ellos, sumando $N+1$ viajes de red ida y vuelta.

**Resolución en SQL:**
```sql
-- En lugar de N queries individuales, resolver en una única unión eficiente:
SELECT
    c.id AS customer_id,
    c.name,
    coalesce(json_agg(o.*) FILTER (WHERE o.id IS NOT NULL), '[]') AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.tenant_id = $1
GROUP BY c.id;
```

---

## 97. Paginación Eficiente: OFFSET vs Keyset Pagination

Paginación tradicional por desplazamiento:
```sql
SELECT * FROM orders
ORDER BY created_at DESC
LIMIT 50 OFFSET 500000;
```
> [!WARNING]
> La paginación por `OFFSET` obliga al motor a leer y descartar 500,000 tuplas en memoria antes de entregar los 50 resultados solicitados, volviéndose intolerablemente lenta a medida que se navega en páginas profundas.

**Keyset Pagination (Cursor-based Pagination):**
```sql
SELECT id, customer_id, total_amount, created_at
FROM orders
WHERE (created_at, id) < ($1, $2)  -- Tupla del último registro de la página previa
ORDER BY created_at DESC, id DESC
LIMIT 50;
```
*Aprovecha directamente un índice compuesto sobre `(created_at DESC, id DESC)` con costo computacional constante $O(\log N)$ sin importar la profundidad de la página.*

---

## 98. Inserción Masiva (Bulk Insert)

Evitar ejecutar miles de `INSERT` individuales en bucles de aplicación.
- Utilizar inserción multi-fila en lotes:
```sql
INSERT INTO event_metrics (event_id, metric_name, value)
VALUES
    ($1, $2, $3),
    ($4, $5, $6),
    ...
    ($N, $N+1, $N+2);
```

---

## 99. Comando `COPY`

Para ingestas masivas de datos (cientos de miles o millones de filas):
- El comando nativo `COPY` es la vía más rápida de PostgreSQL, transmitiendo un flujo binario o CSV directamente al motor sin el costo de análisis sintáctico de sentencias SQL individuales.

```sql
COPY import_staging (external_id, payload, created_at)
FROM STDIN WITH (FORMAT csv, HEADER true);
```

---

## 100. Vistas Materializadas (`MATERIALIZED VIEW`)

Permiten almacenar físicamente en disco el resultado precomputado de una consulta analítica compleja:

```sql
CREATE MATERIALIZED VIEW mv_monthly_revenue AS
SELECT
    date_trunc('month', created_at) AS revenue_month,
    count(id) AS total_orders,
    sum(total_amount) AS gross_revenue
FROM orders
WHERE status = 'completed'
GROUP BY 1;

-- Crear índice único para permitir refresco no bloqueante
CREATE UNIQUE INDEX uq_mv_monthly_revenue_month ON mv_monthly_revenue(revenue_month);

-- Refresco sin bloquear consultas de lectura concurrentes
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue;
```

---

## 101. Gobernanza de Extensiones

PostgreSQL es altamente extensible, pero cada extensión introducida añade acoplamiento operacional:
- Evaluar siempre: soporte en el proveedor de nube (RDS, Cloud SQL, Neon, Supabase), impacto en replicación y migraciones de versión mayor, y modelo de seguridad.

---

## 102. PostGIS (Datos Geoespaciales)

Para aplicaciones con georreferenciación y cálculos espaciales:
- Proporciona tipos espaciales nativos `geometry` y `geography`.
- Índices espaciales GiST para búsquedas de proximidad con `ST_DWithin` y `ST_Distance`.
- Jamás almacenar coordenadas geográficas como simples `latitude numeric` y `longitude numeric` si se requiere calcular áreas o proximidades geodésicas.

---

## 103. `pgvector` (Embeddings y Búsqueda Vectorial)

Permite almacenar vectores de alta dimensión e indexarlos mediante HNSW (*Hierarchical Navigable Small World*) o IVFFlat:
- Habilita arquitecturas híbridas donde los embeddings conviven en la misma base de datos que los datos relacionales de negocio, beneficiándose de transacciones ACID y consistencia unificada sin necesidad de incorporar una base de datos vectorial externa prematuramente.

---

## 104. Arquitectura de Alta Disponibilidad (HA)

Una solución de alta disponibilidad para PostgreSQL requiere orquestar:
1. Replicación física por streaming con múltiples standbys.
2. Detección de caídas de nodo mediante consenso distribuido (p. ej., Patroni con etcd).
3. Promoción automática de un standby (*failover*) sin intervención humana.
4. Enrutamiento de tráfico transparente (*Virtual IP* o proxy como HAProxy / PgBouncer).
5. Aislamiento estricto de nodos caídos (*fencing* / STONITH) para evitar condiciones de cerebro dividido (*split-brain*).

---

## 105. Estrategia Gradual de Escalabilidad (11 Pasos)

Antes de incurrir en la enorme complejidad de fragmentar datos (*sharding* distribuido), agotar metódicamente los 11 pasos:

```text
 1. Corregir consultas ineficientes y eliminar el problema N+1.
 2. Diseñar los índices adecuados (B-tree, compuestos, parciales, GIN).
 3. Normalizar el esquema y ajustar tipos de datos nativos.
 4. Sintonizar autovacuum y eliminar el bloat de tablas e índices.
 5. Optimizar la configuración de memoria de PostgreSQL (shared_buffers, work_mem).
 6. Implementar connection pooling con PgBouncer en modo transacción.
 7. Incorporar capas de caché desacopladas (Redis) para lecturas estáticas.
 8. Desplegar réplicas de lectura (Read Replicas) para consultas pesadas.
 9. Aplicar particionamiento declarativo en tablas de gran volumen.
10. Separar cargas analíticas (OLAP) de las transaccionales (OLTP).
11. Evaluar arquitecturas distribuidas únicamente si el volumen de escritura excede la capacidad del primary.
```

---

## 106. Escalabilidad Vertical (Scale-Up)

PostgreSQL aprovecha de manera extraordinaria el hardware moderno: instancias de 64 a 128 núcleos vCPU, 512GB de memoria RAM y volúmenes de disco NVMe con decenas de miles de IOPS pueden soportar cientos de miles de transacciones por segundo sin necesidad de fragmentar la arquitectura.

---

## 107. Escalabilidad de Lectura (Scale-Out Reads)

Las réplicas de lectura permiten escalar el throughput de consultas no transaccionales, pero exigen contemplar la latencia de replicación:
- **Read-After-Write Consistency:** Si un usuario actualiza su perfil, la consulta de visualización inmediatamente posterior debe dirigirse al nodo primario o esperar confirmación de sincronización para evitar que el usuario perciba sus cambios como perdidos.

---

## 108. Escalabilidad de Escritura (Scale-Out Writes)

PostgreSQL utiliza un modelo de un único nodo escritor primario (*single writable primary*):
- Si el volumen de escritura satura el hardware del primary, evaluar particionamiento funcional (dividir dominios independientes en distintas bases de datos) antes de recurrir a esquemas de sharding caseros complejos.

---

## 109. Checklist Integral de Seguridad

- [ ] Cifrado en tránsito forzado mediante TLS (`ssl = on`).
- [ ] Base de datos desplegada exclusivamente en subredes privadas sin IP pública.
- [ ] Principio de mínimo privilegio para todos los roles de aplicación.
- [ ] Prohibición absoluta del usuario `postgres` en la aplicación.
- [ ] Control estricto de acceso de red mediante `pg_hba.conf`.
- [ ] Gestión de credenciales mediante variables de entorno seguras o bóvedas de secretos (Vault / AWS Secrets Manager).
- [ ] Respaldo cifrado en reposo (*at rest*).
- [ ] Habilitación de auditoría para cambios de configuración y accesos sensibles.

---

## 110. Configuración de Acceso en `pg_hba.conf`

El archivo de configuración de autenticación basada en host gobierna quién puede conectarse:

```text
# TYPE  DATABASE        USER            ADDRESS                 METHOD
local   all             all                                     peer
hostssl all             app_runtime     10.0.1.0/24             scram-sha-256
hostssl all             app_readonly    10.0.2.0/24             scram-sha-256
```
> [!CAUTION]
> Queda terminantemente prohibido configurar reglas permisivas como `host all all 0.0.0.0/0 trust`. Emplear siempre `hostssl` con autenticación segura `scram-sha-256`.

---

## 111. Prohibición de `SUPERUSER`

El atributo `SUPERUSER` anula todas las restricciones de seguridad y chequeos de permisos, incluyendo Row-Level Security. Ningún servicio o API de aplicación debe conectarse como superusuario bajo ninguna circunstancia.

---

## 112. Seguridad en Funciones `SECURITY DEFINER`

Una función declarada con `SECURITY DEFINER` se ejecuta con los privilegios del usuario creador de la función:
- Debe fijar obligatoriamente un `search_path` inmutable para evitar ataques de sustitución de objetos:
```sql
CREATE FUNCTION secure_operation() RETURNS void
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $$
BEGIN
    -- Operación atómica protegida
END;
$$ LANGUAGE plpgsql;
```

---

## 113. Requerimientos Funcionales (RF)

- **[RF-01] Modelado Relacional Soberano**: Transformar reglas de dominio en esquemas relacionales normalizados y consistentes en PostgreSQL.
- **[RF-02] Integridad Declarativa en Motor**: Implementar `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `CHECK`, `UNIQUE` y `EXCLUDE` en las tablas.
- **[RF-03] Tipado Nativo Especializado**: Utilizar tipos exactos (`numeric`, `timestamptz`, `uuid`, `inet`, `jsonb`) evitando almacenar todo como texto libre.
- **[RF-04] Cardinalidad Estricta**: Modelar relaciones 1:1, 1:N, N:M y autorreferenciales con acciones referenciales deliberadas.
- **[RF-05] Evaluación de Normalización**: Garantizar que el modelo OLTP cumpla con 3NF antes de considerar cualquier desnormalización.
- **[RF-06] Estrategia Justificada de Indexación**: Diseñar índices para patrones de consulta reales demostrados.
- **[RF-07] Diagnóstico de Ejecución con EXPLAIN**: Analizar consultas críticas mediante `EXPLAIN (ANALYZE, BUFFERS)`.
- **[RF-08] Gestión de Concurrencia y Locks**: Manejar MVCC, `FOR UPDATE SKIP LOCKED`, transacciones breves y reintentos ante conflictos de serialización.
- **[RF-09] Migraciones Versionadas y Zero-Downtime**: Aplicar cambios DDL compatibles mediante patrones Expand-Contract.
- **[RF-10] Mantenimiento y Control de Bloat**: Supervisar el funcionamiento de autovacuum y recopilación de estadísticas.
- **[RF-11] Seguridad y Mínimo Privilegio**: Implementar separación de roles y aislamiento con Row-Level Security.
- **[RF-12] Continuidad de Negocio**: Garantizar respaldos automatizados con soporte de recuperación PITR.

---

## 114. Requerimientos No Funcionales (RNF)

- **[RNF-01] Integridad de Datos Absoluta**: Tasa de registros huérfanos igual a **cero**.
- **[RNF-02] Rendimiento Transaccional**: Consultas OLTP críticas con latencia $p95 < 20\text{ms}$ y $p99 < 50\text{ms}$.
- **[RNF-03] Disponibilidad de Servicio**: Soporte para migraciones de esquema sin tiempo de inactividad de la API.
- **[RNF-04] Privilegio de Runtime**: Cero conexiones de backend ejecutadas bajo el rol `SUPERUSER`.
- **[RNF-05] Recuperabilidad de Desastres**: RPO definido inferior a 5 minutos y RTO inferior a 30 minutos en entornos críticos.
- **[RNF-06] Observabilidad Continua**: Todas las consultas identificables mediante `pg_stat_statements` y correlation IDs.
- **[RNF-07] Mantenibilidad de Esquemas**: Migraciones reproducibles e idempotentes en cualquier entorno.
- **[RNF-08] Escalabilidad Concurrente**: Capacidad de absorber picos de tráfico sin degradación mediante connection pooling.

---

## 115. Definition of Done (Criterios de Aceptación para Producción)

Un esquema o modificación en PostgreSQL se considera terminado y apto para producción cuando:
1. [ ] Todas las tablas poseen una Clave Primaria inmutable definida.
2. [ ] Todas las relaciones están formalizadas mediante Claves Foráneas con acciones `ON DELETE` justificadas.
3. [ ] Todas las claves foráneas que participan en JOINs o eliminaciones de padres cuentan con un índice en la columna referenciante.
4. [ ] Todos los campos obligatorios poseen restricción `NOT NULL`.
5. [ ] Las invariantes matemáticas y de estado se protegen con restricciones `CHECK`.
6. [ ] La unicidad del negocio está blindada mediante restricciones o índices únicos.
7. [ ] Las restricciones temporales no solapables se modelan con `EXCLUDE USING gist`.
8. [ ] El modelo fue verificado al menos hasta la Tercera Forma Normal (3NF).
9. [ ] Cualquier desnormalización está justificada con métricas y documentada.
10. [ ] El uso de columnas `jsonb` está estrictamente delimitado a metadatos no relacionales.
11. [ ] No se utilizan arrays para simular relaciones entre entidades.
12. [ ] Las fechas absolutas utilizan mandatoriamente `timestamptz`.
13. [ ] Los valores monetarios utilizan mandatoriamente `numeric` de precisión fija.
14. [ ] Las claves secuenciales modernas utilizan `GENERATED ALWAYS AS IDENTITY` en lugar de `SERIAL`.
15. [ ] Cada índice existente en el esquema responde a una consulta o patrón de acceso demostrado.
16. [ ] Los índices compuestos tienen las columnas ordenadas según su selectividad e igualdad.
17. [ ] Los índices en tablas grandes fueron analizados para su creación mediante `CONCURRENTLY`.
18. [ ] Toda consulta crítica fue analizada con `EXPLAIN (ANALYZE, BUFFERS)` y cumple su SLO de latencia.
19. [ ] Se descartaron consultas con problemas de N+1.
20. [ ] No existen transacciones que mantengan conexiones abiertas durante llamadas de red externas.
21. [ ] El backend implementa reintentos con backoff ante errores de serialización (`40001`) o deadlocks (`40P01`).
22. [ ] Las colas de procesamiento de tareas utilizan `FOR UPDATE SKIP LOCKED`.
23. [ ] Todas las migraciones están versionadas y probadas en un dataset representativo en staging.
24. [ ] Las migraciones DDL fijan un `lock_timeout` conservador para no bloquear la base de datos.
25. [ ] Las constraints en tablas grandes se añadieron con `NOT VALID` antes de validarse.
26. [ ] `autovacuum` está activo y sintonizado en tablas de alta rotación.
27. [ ] Las estadísticas de tablas están actualizadas mediante `ANALYZE`.
28. [ ] La extensión `pg_stat_statements` está activa y accesible para monitoreo.
29. [ ] La aplicación se conecta mediante un rol sin privilegios administrativos (`NOSUPERUSER`).
30. [ ] El aislamiento multi-tenant está protegido mediante Row-Level Security o filtros de repositorio auditados.
31. [ ] El pool de conexiones está dimensionado con PgBouncer acorde a los núcleos y memoria del servidor.
32. [ ] Los segmentos WAL se archivan continuamente en almacenamiento inmutable para PITR.
33. [ ] El proceso de restauración de backups ha sido probado exitosamente de forma automatizada.
34. [ ] Los replication slots son supervisados para prevenir el llenado del disco.
35. [ ] No existen credenciales de base de datos incrustadas en el código fuente.

---

## 116. Metodología de Práctica (14 Fases)

```text
Fase 1: Descubrimiento y Alcance
  Definir entidades, volumen proyectado, ratio de lectura/escritura, SLA de recuperación y concurrencia.
Fase 2: Modelo Conceptual y Diagrama Entidad-Relación (ER)
  Establecer entidades, cardinalidades (1:1, 1:N, N:M) y reglas de opcionalidad.
Fase 3: Diseño de Esquema PostgreSQL
  Definir tablas, tipos de datos nativos óptimos, claves primarias e identidad.
Fase 4: Normalización Rigurosa
  Auditar el esquema contra 1NF, 2NF y 3NF. Eliminar redundancias accidentales.
Fase 5: Tipado y Restricciones Declarativas
  Incorporar restricciones NOT NULL, CHECK, UNIQUE, DOMAIN y EXCLUDE con GiST.
Fase 6: Definición de Consultas Críticas
  Redactar el SQL de las operaciones de negocio más frecuentes o sensibles.
Fase 7: Estrategia de Indexación
  Diseñar índices B-tree (compuestos, parciales, covering), GIN y BRIN para las consultas de la Fase 6.
Fase 8: Diagnóstico y Benchmarking con EXPLAIN
  Ejecutar EXPLAIN (ANALYZE, BUFFERS) en cada consulta crítica para optimizar el plan.
Fase 9: Pruebas de Concurrencia y Aislamiento
  Simular actualizaciones simultáneas, detección de deadlocks y reintentos ante fallos de serialización.
Fase 10: Estrategia de Migración Zero-Downtime
  Diseñar el script de migración aplicando patrones Expand-Contract y CREATE INDEX CONCURRENTLY.
Fase 11: Operación y Mantenimiento
  Sintonizar autovacuum, dimensionar PgBouncer y configurar monitoreo de bloat.
Fase 12: Seguridad y Segregación Perimetral
  Configurar roles con mínimo privilegio, pg_hba.conf, políticas de RLS y proteger search_path.
Fase 13: Estrategia de Continuidad de Negocio
  Configurar PITR, archivar segmentos WAL y ejecutar pruebas de restauración cronometradas.
Fase 14: Pruebas de Carga (Load Testing)
  Someter la base de datos a carga concurrente sintética representativa de picos de producción.
```

---

## 117. Checklist de Diseño de Base de Datos

### Modelo y Relaciones
- [ ] Toda tabla tiene un propósito unívoco y está documentada.
- [ ] Claves primarias formalizadas mediante `IDENTITY` o `UUID`.
- [ ] Claves foráneas configuradas en todas las relaciones con regla `ON DELETE` consciente.
- [ ] Cardinalidad documentada y verificada contra 3NF.
- [ ] Toda desnormalización cuenta con justificación técnica por escrito.

### Tipos de Datos
- [ ] Fechas absolutas en `timestamptz`.
- [ ] Moneda y valores financieros en `numeric`.
- [ ] Textos libres en `text` sin truncamientos artificiales innecesarios.
- [ ] Direcciones IP en `inet`.
- [ ] `jsonb` delimitado a datos semiestructurados secundarios.
- [ ] Arrays utilizados únicamente para colecciones literales atómicas.

### Índices
- [ ] Toda clave foránea de alto tráfico cuenta con índice.
- [ ] Los índices compuestos tienen sus columnas ordenadas por selectividad.
- [ ] Se utilizan índices parciales para filtros de alta selectividad o borrado lógico.
- [ ] Se eliminaron índices redundantes que duplicaban prefijos existentes.

### Concurrencia y Transacciones
- [ ] Transacciones breves y deterministas.
- [ ] Cero llamadas a servicios de red externos dentro de bloques transaccionales.
- [ ] Colas concurrentes operando con `FOR UPDATE SKIP LOCKED`.
- [ ] Inserciones idempotentes utilizando `ON CONFLICT`.

### Operación y Resiliencia
- [ ] `autovacuum` habilitado y monitoreado.
- [ ] `pg_stat_statements` instalado y activo.
- [ ] Pool de conexiones administrado por PgBouncer.
- [ ] Respaldos continuos WAL para recuperación PITR.
- [ ] Roles de aplicación creados sin privilegio `SUPERUSER`.

---

## 118. Los 30 Antipatrones en PostgreSQL

### ⚠️ [Antipatrón 1] — Diseñar según las limitaciones del ORM
*Modelar el esquema adaptándolo a los defaults o limitaciones del ORM en lugar de modelar el dominio con integridad relacional.*
```sql
-- INCORRECTO: Dejar que el ORM ignore las constraints de integridad
-- CORRECTO: Modelar en PostgreSQL con restricciones CHECK y FK estrictas; adaptar el ORM al esquema.
```

### ⚠️ [Antipatrón 2] — Usar `SERIAL` en lugar de `IDENTITY`
```sql
-- INCORRECTO:
id serial PRIMARY KEY
-- CORRECTO:
id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY
```

### ⚠️ [Antipatrón 3] — El síndrome de "Todo VARCHAR"
```sql
-- INCORRECTO:
price varchar(20), created_at varchar(50), is_active varchar(5)
-- CORRECTO:
price numeric(14,2) NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), is_active boolean NOT NULL
```

### ⚠️ [Antipatrón 4] — El síndrome de "Todo JSONB"
*Utilizar PostgreSQL como un almacenamiento de documentos improvisado sin validar tipos ni claves foráneas.*

### ⚠️ [Antipatrón 5] — Arrays de IDs para simular relaciones
```sql
-- INCORRECTO:
user_ids bigint[]
-- CORRECTO:
-- Crear una tabla asociativa relacional normalizada con claves foráneas.
```

### ⚠️ [Antipatrón 6] — Omitir índices en Claves Foráneas
*Asumir erróneamente que PostgreSQL indexa automáticamente las columnas hijas de las foreign keys.*

### ⚠️ [Antipatrón 7] — Indexar todas las columnas por intuición
*Crear un índice en cada columna de la tabla satura el almacenamiento, ralentiza cada escritura y genera bloat masivo en los índices.*

### ⚠️ [Antipatrón 8] — Usar siempre B-tree para cualquier tipo de dato
*Ignorar que para JSONB y arrays se debe usar GIN, para rangos y geometrías GiST, y para series temporales masivas BRIN.*

### ⚠️ [Antipatrón 9] — Indexar con GIN todo documento JSONB completo
*Crear un índice GIN sobre documentos gigantescos cuando la aplicación solo filtra por una o dos claves específicas del JSON.*

### ⚠️ [Antipatrón 10] — Guiarse por `EXPLAIN` simple sin `ANALYZE`
*Tomar decisiones de optimización basadas en costos teóricos sin medir tiempos de ejecución reales con `EXPLAIN ANALYZE`.*

### ⚠️ [Antipatrón 11] — Ejecutar `EXPLAIN ANALYZE` destructivo en producción
*Olvidar que `EXPLAIN ANALYZE` ejecuta realmente la sentencia, provocando la eliminación accidental de registros en un `DELETE`.*

### ⚠️ [Antipatrón 12] — Deshabilitar `autovacuum`
*Deshabilitar el proceso automático creyendo falsamente que ahorra CPU, condenando la base de datos a bloat y parada por wraparound.*

### ⚠️ [Antipatrón 13] — Ejecutar `VACUUM FULL` de forma rutinaria
*Bloquear tablas enteras con locks exclusivos de larga duración en lugar de permitir que `autovacuum` mantenga las páginas reciclables.*

### ⚠️ [Antipatrón 14] — Reindexar por cron sin diagnóstico previo
*Ejecutar scripts ciegos de `REINDEX` que saturan los discos y bloquean escrituras sin verificar si existe bloat real en los índices.*

### ⚠️ [Antipatrón 15] — Envolver llamadas HTTP dentro de transacciones
*Mantener transacciones y bloqueos de fila abiertos durante segundos mientras se espera la respuesta de un webhook externo.*

### ⚠️ [Antipatrón 16] — Validar unicidad mediante `SELECT` antes de `INSERT`
```sql
-- INCORRECTO:
-- if (!select exists(...)) { insert into ... } (Vulnerable a condiciones de carrera)
-- CORRECTO:
INSERT INTO users (email) VALUES ($1) ON CONFLICT (email) DO NOTHING;
```

### ⚠️ [Antipatrón 17] — Paginación infinita mediante `OFFSET` profundo
*Escanear cientos de miles de filas intermedias para entregar los últimos 20 registros. Utilizar Keyset Pagination.*

### ⚠️ [Antipatrón 18] — Crear índices en tablas gigantescas sin `CONCURRENTLY`
*Paralizar los servicios de la aplicación al bloquear las escrituras de una tabla crítica durante horas.*

### ⚠️ [Antipatrón 19] — Ejecutar DDL en producción sin `lock_timeout`
*Quedar encolado indefinidamente esperando un lock exclusivo mientras se bloquean todas las peticiones posteriores.*

### ⚠️ [Antipatrón 20] — Particionar por moda sin volumen justificado
*Añadir complejidad administrativa y sobrecarga de planificación en tablas que apenas cuentan con unos cientos de miles de filas.*

### ⚠️ [Antipatrón 21] — Crear miles de particiones diarias anticipadas
*Generar miles de tablas hijas que consumen memoria de catálogo y ralentizan el cálculo de planes del optimizador.*

### ⚠️ [Antipatrón 22] — Confundir Replicación con Backup
*Creer que tener una réplica secundaria protege los datos frente a borrados accidentales o corrupciones lógicas.*

### ⚠️ [Antipatrón 23] — Abandonar un Replication Slot
*Dejar un slot de replicación desconectado hasta que el primary agote el 100% del espacio en disco por retención de WAL.*

### ⚠️ [Antipatrón 24] — Conectar la aplicación como usuario `postgres`
*Otorgar privilegios de superusuario a servicios web expuestos a Internet, violando el principio de mínimo privilegio.*

### ⚠️ [Antipatrón 25] — Ignorar la seguridad del `search_path`
*Dejar que funciones de seguridad ejecuten objetos no calificados en esquemas modificables por otros usuarios.*

### ⚠️ [Antipatrón 26] — Trasladar la totalidad de la lógica de negocio a Triggers
*Ocultar la lógica de la aplicación en triggers opacos que dificultan la depuración, el testeo y la trazabilidad de errores.*

### ⚠️ [Antipatrón 27] — Aumentar `max_connections` para "mejorar el rendimiento"
*Configurar 2000 conexiones directas en lugar de un pooler eficiente, saturando la memoria y los cambios de contexto del procesador.*

### ⚠️ [Antipatrón 28] — Cachear en Redis antes de optimizar las consultas SQL
*Introducir inconsistencia distribuida y complejidad de invalidación de caché para tapar una consulta deficiente sin índice.*

### ⚠️ [Antipatrón 29] — Leer de una réplica asíncrona tras una escritura crítica
*No considerar la latencia de replicación y mostrar al usuario información desactualizada tras una modificación reciente.*

### ⚠️ [Antipatrón 30] — Ajustar parámetros de configuración por superstición
*Copiar configuraciones arbitrarias de blogs sin medir con benchmarks ni justificar los cambios con métricas reales de hardware.*

---

## 119. KPIs e Indicadores Clave de Rendimiento

| Métrica / Indicador | Meta Objetivo | Método de Medición |
| :--- | :--- | :--- |
| **Tablas críticas con Clave Primaria** | **100%** | Auditoría de `information_schema.table_constraints` |
| **Relaciones formalizadas mediante FK** | **100%** | Auditoría de catálogo `pg_constraint` |
| **Registros huérfanos en el sistema** | **0** | Verificación de integridad referencial |
| **Invariantes protegidas por Constraints**| **100%** viables | Auditoría de restricciones `CHECK`, `UNIQUE`, `EXCLUDE` |
| **Consultas críticas con plan revisado** | **100%** | Registro de planes de ejecución en CI/CD |
| **Cumplimiento de SLO en queries críticas**| **100%** | Monitoreo de latencia $p95 / p99$ con `pg_stat_statements` |
| **Migraciones de esquema versionadas** | **100%** | Repositorio Git y tabla de control de migraciones |
| **Migraciones probadas en Staging** | **100%** | Pipeline de despliegue automatizado |
| **Índices sin uso demostrable** | **0** | Monitoreo de `pg_stat_user_indexes.idx_scan = 0` |
| **Transacciones de larga duración innecesarias**| **0** | Alertas sobre `pg_stat_activity` ($> 10\text{s}$) |
| **Fallos de concurrencia sin retry** | **0** | Métricas de errores de aplicación (`40001`, `40P01`) |
| **Conexiones de runtime como superuser** | **0** | Auditoría de roles activos en el servidor |
| **Autovacuum deshabilitado en tablas** | **0** | Verificación de `reloptions` en `pg_class` |
| **Replication slots abandonados** | **0** | Alertas sobre `pg_replication_slots.active = false` |
| **Backups automatizados exitosos** | **100%** | Reportes de herramientas de respaldo (`pgBackRest`) |
| **Pruebas periódicas de restauración (PITR)**| **100%** según política | Bitácora de validación periódica de restauración |
| **RPO y RTO documentados y cumplidos** | **100%** | Evaluación de planes de continuidad de negocio |
| **Fugas de datos entre inquilinos (Cross-tenant)**| **0** | Auditoría de políticas de Row-Level Security |
| **Migraciones destructivas sin rollout** | **0** | Revisión de DDLs en Pull Requests |
| **Consultas críticas con problema N+1** | **0** | Profiling de endpoints y tracing distribuido |

---

## 120. Niveles de Dominio de la Habilidad

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Nivel 1: Fundamentos PostgreSQL                                        │
│   Domina sintaxis SQL estándar, tipos básicos, creación de tablas,    │
│   claves primarias, foráneas, constraints básicas, transacciones ACID │
│   y operaciones CRUD eficientes.                                      │
├────────────────────────────────────────────────────────────────────────┤
│ Nivel 2: Profesional                                                   │
│   Domina CTEs, Window Functions, DISTINCT ON, RETURNING, UPSERT,       │
│   JSONB con GIN, índices compuestos y parciales, interpretación de    │
│   EXPLAIN ANALYZE, migraciones versionadas y segregación de roles.     │
├────────────────────────────────────────────────────────────────────────┤
│ Nivel 3: Senior                                                        │
│   Domina la arquitectura física de MVCC, tuning de autovacuum, bloat,  │
│   locking avanzado (SKIP LOCKED), aislamiento Serializable (SSI),      │
│   WAL, replicación física y lógica, PITR, particionamiento declarativo,│
│   Row-Level Security, dimensionamiento de PgBouncer y zero-downtime.   │
├────────────────────────────────────────────────────────────────────────┤
│ Nivel 4: Staff / Principal                                             │
│   Toma decisiones estratégicas y compensaciones arquitectónicas:      │
│   BIGINT vs UUID, Relacional vs JSONB, B-tree vs GIN/GiST/BRIN,        │
│   Primary write vs Partitioning, FTS nativo vs motor externo,         │
│   pgvector vs base de datos vectorial dedicada, gobernando la          │
│   correctitud, disponibilidad, operabilidad y costo de escala.         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 121. Checklist de Diagnóstico de Consulta Lenta (17 Preguntas)

Ante una consulta que degrada el rendimiento:
1. ¿Cuál es el SLO de tiempo esperado para este patrón de acceso?
2. ¿Cuál es el volumen total de filas de las tablas involucradas?
3. ¿Cuántas filas y columnas devuelve efectivamente la consulta?
4. ¿Qué selectividad matemática tienen los filtros aplicados en el `WHERE`?
5. ¿Qué plan de ejecución físico seleccionó el optimizador de PostgreSQL?
6. ¿La estimación de filas del planner coincide con las filas reales devueltas (`rows=X` vs `actual rows=Y`)?
7. ¿Un `Seq Scan` reportado es realmente incorrecto para el porcentaje de filas accedido?
8. ¿Existe un índice adecuado que cubra los predicados de búsqueda?
9. ¿El índice compuesto respeta el orden estricto de las columnas de igualdad y rango?
10. ¿Se realiza una operación de ordenamiento costosa (`Sort Method: external merge Disk`)?
11. ¿La consulta genera lecturas físicas masivas de disco (`shared_blks_read`)?
12. ¿Existe desbordamiento de memoria temporal hacia el disco por insuficiencia de `work_mem`?
13. ¿La consulta espera por bloqueos concurrentes de fila o tabla?
14. ¿Las tablas o índices involucrados tienen un alto porcentaje de tuplas muertas o bloat?
15. ¿Las estadísticas recopiladas en `pg_stats` están desactualizadas?
16. ¿La consulta forma parte de un ciclo N+1 originado en la aplicación?
17. ¿El problema de fondo es la sintaxis de la consulta o una deficiencia estructural en el modelo relacional?

---

## 122. Checklist de Migración Zero-Downtime (13 Puntos de Control)

Antes de aplicar cualquier script DDL en producción:
1. [ ] ¿Qué nivel exacto de bloqueo adquiere cada sentencia DDL (`ACCESS EXCLUSIVE`, `SHARE UPDATE EXCLUSIVE`)?
2. [ ] ¿Cuánto tiempo máximo esperará la sentencia para adquirir el bloqueo (`lock_timeout`)?
3. [ ] ¿La sentencia provoca una reescritura física completa de la tabla (*table rewrite*)?
4. [ ] ¿Los índices nuevos se crean utilizando la cláusula `CONCURRENTLY`?
5. [ ] ¿La adición de columnas o tablas es compatible con la versión activa de la aplicación?
6. [ ] ¿La migración requiere un backfill masivo de datos históricos?
7. [ ] ¿El backfill está diseñado para ejecutarse en lotes (*batches*) pequeños con pausas intermedias?
8. [ ] ¿La versión antigua de la aplicación seguirá funcionando sin errores tras aplicar el esquema nuevo?
9. [ ] ¿La versión nueva de la aplicación podrá operar correctamente antes de que finalice el backfill?
10. [ ] ¿Existe un procedimiento documentado y probado de marcha atrás (*rollback*)?
11. [ ] ¿Qué ocurre si la migración falla o se interrumpe exactamente al 50% de su ejecución?
12. [ ] ¿Se cuenta con monitoreo activo de bloqueos durante la ejecución de la migración?
13. [ ] ¿Se definió un `statement_timeout` conservador para evitar ejecuciones bloqueadas eternas?

---

## 123. Checklist de Producción

### Motor PostgreSQL
- [ ] Versión soportada y respaldada (PostgreSQL 18+).
- [ ] Actualizaciones menores aplicadas periódicamente.
- [ ] Huso horario configurado de forma universal en `UTC`.
- [ ] `max_connections` acotado y ajustado según el hardware disponible.
- [ ] Connection pooler (PgBouncer) activo y gobernando las conexiones entrantes.
- [ ] Demonio de `autovacuum` activo y supervisado.
- [ ] Parámetros de `work_mem` y `shared_buffers` optimizados para la memoria del host.
- [ ] Extensión `pg_stat_statements` activa y recolectando métricas.
- [ ] Parámetros de logging configurados para capturar consultas lentas e interbloqueos.
- [ ] Alertas automáticas ante agotamiento de almacenamiento de disco o saturación de WAL.
- [ ] Monitoreo constante de replication lag y replication slots.
- [ ] Copias de seguridad automáticas y políticas de recuperación PITR activas.

### Aplicación Backend (NestJS 11 / Prisma ORM)
- [ ] Todas las consultas utilizan parámetros tipados para prevenir inyecciones SQL.
- [ ] Timeouts de conexión y de consulta configurados en el cliente de base de datos.
- [ ] Estrategia de reintentos con backoff exponencial aplicada ante fallos de serialización.
- [ ] Pool de conexiones del cliente dimensionado sin sobrepasar el límite de PgBouncer.
- [ ] Transacciones breves y deterministas sin llamadas de red intermedias.
- [ ] Consultas optimizadas con paginación por cursor en colecciones extensas.
- [ ] Erradicación completa del problema N+1 mediante agregaciones o cargas por lote.
- [ ] Migraciones desacopladas del ciclo de vida de arranque (*startup*) de los contenedores de aplicación.

---

## 124. La Regla de Oro

Una arquitectura de persistencia profesional jamás comienza preguntando:
```text
"¿Qué ORM uso?"
"¿Qué índice le agrego?"
"¿Qué framework es más fácil?"
```

Comienza preguntando rigurosamente:
```text
1. ¿Qué reglas de negocio nunca deben romperse bajo ninguna circunstancia?
2. ¿Qué datos cambian juntos de forma atómica?
3. ¿Qué identidad formal e inmutable posee cada entidad?
4. ¿Qué nivel de concurrencia y conflicto existirá en las operaciones de escritura?
5. ¿Qué consultas son críticas para la experiencia del usuario y la facturación?
6. ¿Qué volumen de datos alcanzará el sistema a lo largo del tiempo?
7. ¿Qué nivel de recuperación ante desastres (RPO y RTO) exige el negocio?
```

Cadena metodológica obligatoria:
$$\text{Dominio} \longrightarrow \text{Modelo ER} \longrightarrow \text{Modelo PostgreSQL} \longrightarrow \text{Tipos} \longrightarrow \text{Constraints} \longrightarrow \text{Normalización} \longrightarrow \text{Consultas} \longrightarrow \text{Transacciones} \longrightarrow \text{EXPLAIN} \longrightarrow \text{Índices} \longrightarrow \text{Concurrencia} \longrightarrow \text{Migración} \longrightarrow \text{Observabilidad} \longrightarrow \text{PITR} \longrightarrow \text{Producción}$$

---

## 125. Definition of Mastery (Criterio de Maestría)

La habilidad se considera dominada en grado Senior / Staff cuando el practicante es capaz de recibir un dominio de negocio complejo y desconocido y, **sin depender de ningún ORM o abstracción intermedia**:
- Construir el modelo relacional formal, delimitando cardinalidades y opcionalidades.
- Seleccionar y fundamentar el uso de claves naturales y subrogadas (`IDENTITY` vs `UUIDv7`).
- Imponer la integridad del negocio mediante `PRIMARY KEY`, `FOREIGN KEY`, `NOT NULL`, `CHECK`, `UNIQUE` y `EXCLUDE` con GiST.
- Normalizar rigurosamente hasta 3NF y justificar técnicamente cualquier desnormalización.
- Elegir tipos de datos exactos (`numeric`, `timestamptz`, `inet`, `jsonb`, `ranges`).
- Diseñar transacciones breves bajo el nivel de aislamiento adecuado (`READ COMMITTED`, `REPEATABLE READ`, `SERIALIZABLE`).
- Gobernar la concurrencia mediante `FOR UPDATE SKIP LOCKED`, bloqueos consultivos y control optimista.
- Redactar consultas avanzadas utilizando CTEs recursivos, Window Functions, `LATERAL` y `DISTINCT ON`.
- Diseñar índices B-tree (compuestos, parciales, covering), GIN, GiST y BRIN justificando su rentabilidad.
- Interpretar a nivel forense la salida de `EXPLAIN (ANALYZE, BUFFERS)` y solucionar estimaciones erróneas de cardinalidad mediante estadísticas extendidas.
- Dominar el ciclo de vida de MVCC, afinando `autovacuum` y remediando el bloat de tablas e índices sin afectar el servicio.
- Diseñar arquitecturas de alta disponibilidad con streaming replication y replicación lógica.
- Configurar y probar sistemas de recuperación puntual en el tiempo (PITR) con archivado de WAL.
- Implementar aislamiento multi-tenant estricto mediante Row-Level Security (RLS) y variables de sesión.
- Diseñar e instrumentar migraciones zero-downtime bajo el patrón Expand-Migrate-Contract.
- Diagnosticar cuellos de botella mediante `pg_stat_statements` y dimensionar pools de conexión con PgBouncer.
- Justificar cada decisión arquitectónica basándose en métricas empíricas, correctitud matemática y compensaciones operacionales.

---

## 126. Recursos de Referencia

### Documentación Oficial de PostgreSQL 18+
- [PostgreSQL Documentation — Data Definition](https://www.postgresql.org/docs/current/ddl.html)
- [PostgreSQL Documentation — Concurrency Control (MVCC, Isolation, Locks)](https://www.postgresql.org/docs/current/mvcc.html)
- [PostgreSQL Documentation — Indexes (B-tree, GIN, GiST, BRIN)](https://www.postgresql.org/docs/current/indexes.html)
- [PostgreSQL Documentation — Performance Tips & Using EXPLAIN](https://www.postgresql.org/docs/current/performance-tips.html)
- [PostgreSQL Documentation — Routine Vacuuming & Autovacuum](https://www.postgresql.org/docs/current/routine-vacuuming.html)
- [PostgreSQL Documentation — Continuous Archiving & Point-In-Time Recovery (PITR)](https://www.postgresql.org/docs/current/continuous-archiving.html)
- [PostgreSQL Documentation — High Availability, Load Balancing, and Replication](https://www.postgresql.org/docs/current/high-availability.html)
- [PostgreSQL Documentation — The Statistics Collector & `pg_stat_statements`](https://www.postgresql.org/docs/current/monitoring-stats.html)

---

## 127. Principio Final

```text
Un desarrollador principiante pregunta:
  "¿Qué consulta SQL escribo?"

Un desarrollador intermedio pregunta:
  "¿Qué índice necesito agregar?"

Un desarrollador avanzado pregunta:
  "¿Qué plan de ejecución eligió PostgreSQL y por qué?"

Un ingeniero Senior pregunta:
  "¿Cómo interactúan el modelo relacional, MVCC, los índices, los bloqueos,
   el WAL, autovacuum, las migraciones, la replicación y el workload
   bajo concurrencia real?"

Y un arquitecto de software debe ser capaz de responder además:
  "¿Qué ocurre cuando todo esto falla en producción, y cómo recuperamos
   el sistema en minutos garantizando la integridad absoluta de los datos?"
```
