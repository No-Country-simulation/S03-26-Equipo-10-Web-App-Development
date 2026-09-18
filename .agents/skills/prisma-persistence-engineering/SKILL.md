---
name: prisma-persistence-engineering
description: Diseño, implementación, optimización y operación profesional de capas de persistencia con Prisma ORM en Node.js, TypeScript y NestJS (código SKL-ARCH-PRISMA-001). Usar cuando se requiera diseñar esquemas relacionales, gobernar migraciones zero-downtime (Expand-Contract), optimizar consultas y prevenir N+1, manejar transacciones ACID ultracortas y concurrentes (withRetry, Outbox Pattern), implementar aislamiento multi-tenant estricto, instrumentar observabilidad de queries y adaptar aplicaciones entre Prisma 6, Prisma 7 (@prisma/adapter-pg) y Prisma 8+.
---

# Especificación Técnica de Habilidad: Senior Prisma ORM & Persistence Engineering

```text
Código de Skill:    SKL-ARCH-PRISMA-001
Versión:            2.0.0
Nivel:              Senior / Production Engineering
Estándar:           ACID / SQL / OWASP / Data Mapper / Repository / Unit of Work / Expand-Contract / SOLID / Agile DoD
Dominio:            Node.js / TypeScript / Prisma ORM / PostgreSQL / SQL / Data Access / Database Evolution
Baseline:           Prisma ORM 6.5.x (activo en repo) con adaptación explícita a Prisma 7.x y Prisma 8+
Contexto Proyecto:  @testimonial-cms/api (NestJS 11 + PostgreSQL + Multi-tenant SaaS + Outbox Pattern)
```

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, optimización y operación profesional de capas de persistencia mediante Prisma ORM. |
| **Objetivo de Dominio** | Utilizar Prisma como una abstracción de acceso a datos fuertemente tipada (*type-safe*) sin perder el control sobre SQL, la integridad relacional, las transacciones ACID, las migraciones reproducibles, el pooling de conexiones y el rendimiento. |
| **Tecnología Principal** | Prisma ORM (Prisma Schema + Prisma Client + Prisma Migrate + TypedSQL). |
| **Motores Soportados** | **PostgreSQL (motor principal del proyecto)**, MySQL, MariaDB, SQLite, SQL Server, CockroachDB, MongoDB. |
| **Arquitectura de Código**| Feature-Oriented Persistence / Modular Monolith con NestJS 11 y PostgreSQL. |
| **Gobernanza de Migraciones**| Versionadas, auditadas, reproducibles y ejecutadas mediante Expand-Contract (*zero-downtime*). |
| **Transacciones** | Explícitas, ultracortas, con reintentos exponenciales ante deadlocks (`withRetry`) y patrón Transactional Outbox. |
| **Observabilidad** | Detección de *slow queries* (> 100ms), trazabilidad de transacciones con `traceId` y métricas de saturación del pool. |
| **Seguridad de Datos** | Parameterization estricta, Least Privilege (roles DML vs DDL), prevención de Mass Assignment y aislamiento multi-tenant innegociable. |
| **Prioridad Operativa** | Integridad ➔ Seguridad ➔ Correctitud ➔ Migrabilidad ➔ Observabilidad ➔ Performance ➔ Simplicidad. |
| **Complejidad** | Alta. |

---

## 2. Filosofía de Diseño y Principios Rectores

Prisma es una biblioteca de mapeo objeto-relacional y generación de clientes; **no reemplaza el conocimiento de bases de datos ni sustituye al motor relacional**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Distinción de Fronteras                         │
├─────────────────┬──────────────────────────────────────────────────────┤
│ Prisma ORM      │ Schema modeling, queries type-safe, relaciones,      │
│                 │ migraciones DDL, transacciones, TypedSQL, DX.        │
├─────────────────┼──────────────────────────────────────────────────────┤
│ PostgreSQL DB   │ Constraints (CHECK, FK, UNIQUE), índices, locks,     │
│                 │ niveles de aislamiento ACID, planes de consulta      │
│                 │ (EXPLAIN ANALYZE), integridad referencial y storage. │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Domain Model    │ Reglas de negocio, invariantes, entidades puras.     │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Business Logic  │ Casos de uso, orquestación, políticas de aplicación. │
└─────────────────┴──────────────────────────────────────────────────────┘
```

### 2.1. Principio Rector: Abstracción Pragmática
> **Usá Prisma mientras su abstracción mantenga la solución simple, segura, legible y eficiente. Bajá a TypedSQL, `$queryRaw` parametrizado o capacidades nativas del motor (PostgreSQL) cuando el rendimiento, la complejidad de la consulta o la expresividad lo requieran.**
> 
> *Regla de oro:* No luches contra Prisma ni agregues capas innecesarias de gimnasia con el ORM para evitar escribir SQL.

### 2.2. Prisma es un Detalle de Infraestructura
La aplicación no debe estructurarse alrededor de Prisma (*"Prisma Architecture"*), sino alrededor del dominio y los casos de uso:

```text
HTTP / Controllers (NestJS / Express / Fastify)
       ↓
Application Services / Use Cases
       ↓
Persistence Boundary (Repositories / Data Services)
       ↓
Prisma Client / TypedSQL
       ↓
PostgreSQL Database
```

---

## 3. Compatibilidad de Versiones: Prisma 6 ➔ Prisma 7 ➔ Prisma 8+

Antes de generar configuración o código de infraestructura, la skill exige diagnosticar la versión exacta:

```bash
npx prisma --version
```

### 3.1. Estado Actual en este Proyecto (`@testimonial-cms/api`)
El proyecto se encuentra estandarizado en **Prisma 6.5.0** con PostgreSQL.

```json
// apps/api/package.json
{
  "dependencies": {
    "@prisma/client": "6.5.0"
  },
  "devDependencies": {
    "prisma": "6.5.0"
  }
}
```

### 3.2. Puente Arquitectónico hacia Prisma 7
En Prisma 7, las conexiones directas tradicionales se reemplazan por **Driver Adapters** (`@prisma/adapter-pg`), el cliente generado se exporta explícitamente y se eliminan los middlewares en favor de **Client Extensions**:

```typescript
// Configuración de arranque en Prisma 7 (preparada para migración)
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });
```

### 3.3. Política para Prisma 8+
Cuando el proyecto evolucione a Prisma 8+:
1. Detectar el major mediante CLI.
2. Consultar las notas de release del major correspondiente.
3. No copiar ciegamente configuraciones de versiones anteriores.
4. Mantener invariantes los principios arquitectónicos (integridad, transacciones cortas, aislamiento multi-tenant y migraciones seguras).

---

## 4. Jerarquía de Abstracción de Persistencia

```text
1. Prisma Client API convencional (findUnique, findMany, create, update)
      │  (CRUDs estándar, relaciones simples, mutaciones tipadas)
      ▼
2. Prisma relationLoadStrategy ('join' | 'query')
      │  (Optimización de relaciones 1:N sin round-trips excesivos)
      ▼
3. TypedSQL (sql/*.sql con inputs y outputs tipados en compilación)
      │  (Reportes analíticos, agregaciones pesadas, CTEs, Window Functions)
      ▼
4. Prisma $queryRaw / $executeRaw parametrizados
      │  (Queries dinámicas complejas que requieren lógica condicional)
      ▼
5. Database-native SQL / Extensiones de PostgreSQL
         (PostGIS, pg_trgm, operadores JSONB avanzados, locks explícitos)
```

---

## 5. Context Discovery & Diagnóstico del Proyecto

Para `@testimonial-cms`, el diagnóstico contextual es:

```text
DATABASE_ENGINE=PostgreSQL 16+
PRISMA_MAJOR_VERSION=6.5.0 (con puente a 7.x)
PROJECT_ARCHITECTURE=Modular Monolith (NestJS 11)
DEPLOYMENT_MODEL=Docker Containerized (Node.js 22 LTS)
TENANCY_MODEL=Shared Database, Shared Schema con tenant_id mandatorio
PRIMARY_KEYS=UUIDv4 (@default(uuid()) @db.Uuid)
MIGRATION_STRATEGY=prisma migrate deploy en CI/CD con Expand-Contract
CONCURRENCY_MODEL=withRetry (Exponential Backoff ante Deadlocks P2028/P2034)
PATTERNS=Transactional Outbox (OutboxEvent) + Idempotency (IdempotencyKey)
```

---

## 6. Estructura Arquitectónica en NestJS 11

### 6.1. Organización Modular de Persistencia
En `@testimonial-cms/api`, Prisma se centraliza en `src/modules/database/`:

```text
apps/api/
├── prisma/
│   ├── schema.prisma            # Esquema relacional centralizado
│   ├── migrations/              # Historial inmutable de migraciones SQL
│   └── seed.ts                  # Seed idempotente de datos maestros
│
└── src/
    ├── modules/
    │   ├── database/
    │   │   ├── database.module.ts
    │   │   ├── prisma.service.ts # Singleton de Prisma Client con observabilidad
    │   │   └── extensions/       # Extensiones de cliente para tenant/soft-delete
    │   │
    │   ├── testimonials/
    │   │   ├── testimonials.module.ts
    │   │   ├── testimonials.service.ts
    │   │   ├── domain/
    │   │   └── infrastructure/
    │   │       ├── testimonial.repository.ts  # Abstracción de persistencia
    │   │       └── testimonial.mapper.ts      # Mapeo Prisma Model ➔ Entity ➔ DTO
    │   │
    │   ├── auth/
    │   └── outbox/
```

---

## 7. Repository Pattern: Cuándo sí y cuándo no

- ❌ **Repository Ceremonial (Antipatrón):** Clases que simplemente duplican 1 a 1 los métodos de Prisma (`findById`, `create`) sin agregar valor. Añaden boilerplate sin aislar nada.
- ✅ **Repository con Valor de Dominio:** Oculta consultas complejas, maneja transacciones atómicas, aplica filtros de tenancy y transforma modelos de base de datos a entidades de dominio ricas.

```typescript
// Ejemplo de Repository Profesional en NestJS
export interface ITestimonialRepository {
  findApprovedByTenant(tenantId: string, limit: number, cursor?: string): Promise<Testimonial[]>;
  publishWithOutbox(testimonial: Testimonial, outboxEvent: OutboxEvent): Promise<void>;
}
```

---

## 8. Prisma Models ≠ Domain Models ≠ DTOs

Nunca exponer directamente el modelo generado por Prisma en los controladores o contratos de la API:

```text
Prisma Model (users en PostgreSQL)
       ↓  (user.mapper.ts)
Domain Entity (User con reglas de negocio: isValidPassword, canPublish)
       ↓  (user.mapper.ts)
Response DTO (UserResponseDto con exclusión de passwordHash y campos internos)
```

---

## 9. Ciclo de Vida del Cliente en NestJS (`PrismaService`)

Una aplicación en Node.js debe mantener **una única instancia singleton de PrismaClient** para no saturar el pool de conexiones de PostgreSQL.

```typescript
// src/modules/database/prisma.service.ts
import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService 
  extends PrismaClient<Prisma.PrismaClientOptions, 'query' | 'error' | 'warn'> 
  implements OnModuleInit, OnModuleDestroy 
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'event', level: 'error' },
        { emit: 'event', level: 'warn' },
      ],
    });
  }

  async onModuleInit() {
    await this.$connect();

    // Observabilidad de Slow Queries (> 100ms)
    this.$on('query', (e: Prisma.QueryEvent) => {
      if (e.duration > 100) {
        this.logger.warn(`Slow Query detected [${e.duration}ms]: ${e.query}`);
      }
    });

    this.$on('error', (e: Prisma.LogEvent) => {
      this.logger.error(`Prisma Engine Error: ${e.message}`, e.target);
    });

    this.$on('warn', (e: Prisma.LogEvent) => {
      this.logger.warn(`Prisma Warning: ${e.message}`);
    });
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Ejecuta transacciones con lógica de reintentos exponenciales ante deadlocks transitorios.
   * Mitiga los códigos de error P2028 y P2034.
   */
  async withRetry<T>(
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 200
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        return await this.$transaction(operation);
      } catch (error: any) {
        attempt++;
        if (error?.code && ['P2028', 'P2034'].includes(error.code)) {
          if (attempt >= maxRetries) throw error;
          const delay = baseDelayMs * Math.pow(2, attempt - 1);
          this.logger.warn(`Transaction conflict (${error.code}). Retrying ${attempt}/${maxRetries} after ${delay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error;
        }
      }
    }
    throw new Error('Transaction failed after maximum retries');
  }
}
```

> [!CAUTION]
> **Reglas Críticas de Conexión:**
> 1. **Prohibido** ejecutar `new PrismaClient()` dentro de controladores, servicios o por cada request.
> 2. **Prohibido** invocar `await prisma.$disconnect()` al finalizar un endpoint; destruiría el pool de conexiones reutilizables.

---

## 10. Dimensionamiento del Pool de Conexiones

El pool de PostgreSQL debe calcularse a nivel de **sistema distribuido total**, no por contenedor aislado:

$$\text{Conexiones Totales} = \text{Número de Réplicas (Contenedores)} \times \text{Tamaño del Pool por Instancia}$$

Si PostgreSQL tiene un límite de `max_connections = 100` y desplegás 5 réplicas de NestJS, el pool de cada réplica (`connection_limit` en `DATABASE_URL`) no debe superar 15-18 conexiones:

```env
DATABASE_URL="postgresql://user:pass@postgres:5432/testimonial_db?schema=public&connection_limit=15&pool_timeout=10"
```

---

## 11. Diseño del Schema Relacional (`schema.prisma`)

### 11.1. Convenciones de Nomenclatura y Mapeo SQL
- **Modelos:** `PascalCase` en singular (`Tenant`, `Testimonial`, `ApiKey`).
- **Campos en Prisma:** `camelCase` (`publicSlug`, `createdAt`, `tenantId`).
- **Tablas y Columnas en Base de Datos:** `snake_case` mediante directivas `@map` y `@@map`.

```prisma
model Testimonial {
  id          String   @id @default(uuid()) @db.Uuid
  tenantId    String   @map("tenant_id") @db.Uuid
  authorName  String   @map("author_name")
  content     String
  rating      Int      @default(5)
  isApproved  Boolean  @default(false) @map("is_approved")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  tenant      Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, isApproved], map: "idx_testimonials_tenant_approved")
  @@map("testimonials")
}
```

### 11.2. Claves Primarias: UUIDv4 vs IDs Autoincrementales
- En sistemas multi-tenant distribuidos como `@testimonial-cms`, **utilizar UUIDv4 (`@db.Uuid`)** para IDs expuestos externamente (`tenantId`, `userId`, `testimonialId`), evitando ataques de enumeración.
- Para catálogos fijos de bajo volumen (`Role`, `Permission`), utilizar IDs autoincrementales (`Int @id @default(autoincrement())`).

### 11.3. Relaciones Muchos-a-Muchos: Explícitas con Metadatos
Cuando la relación requiere registrar auditoría o atributos adicionales (e.g. `role_permissions`), utilizar **relaciones explícitas con tabla intermedia tipada**:

```prisma
model RolePermission {
  roleId       Int        @map("role_id")
  permissionId Int        @map("permission_id")
  role         Role       @relation(fields: [roleId], references: [id], onDelete: Cascade)
  permission   Permission @relation(fields: [permissionId], references: [id], onDelete: Cascade)

  @@id([roleId, permissionId])
  @@map("role_permissions")
}
```

---

## 12. Optimización de Consultas y Prevención de N+1

### 12.1. Proyección Mínima Obligatoria con `select`
Evitar traer todas las columnas si solo se consumen campos puntuales:

```typescript
// ❌ INEFICIENTE: Trae campos grandes de texto y timestamps innecesarios
const users = await this.prisma.user.findMany();

// ✅ EFICIENTE: Proyección estricta
const users = await this.prisma.user.findMany({
  where: { tenantId },
  select: {
    id: true,
    email: true,
    isActive: true,
  },
});
```

### 12.2. Antipatrón N+1 y Solución con `include` o `relationLoadStrategy`
```typescript
// ❌ ANTIPATRÓN N+1 (Genera 1 + 100 queries a PostgreSQL):
const users = await this.prisma.user.findMany({ where: { tenantId } });
for (const user of users) {
  const testimonials = await this.prisma.testimonial.findMany({ where: { createdByUserId: user.id } });
}

// ✅ CONSULTA EFICIENTE (Resuelto en batch o JOIN por Prisma):
const users = await this.prisma.user.findMany({
  where: { tenantId },
  include: {
    testimonialsCreated: true,
  },
});
```

---

## 13. Paginación de Alto Rendimiento: Cursor vs Offset

```text
┌─────────────────┬──────────────────────────────────┬─────────────────────────────────────┐
│ Estrategia      │ Ventajas                         │ Caso de Uso en @testimonial-cms     │
├─────────────────┼──────────────────────────────────┼─────────────────────────────────────┤
│ Offset (skip)   │ Navegación directa a página N.   │ Pantallas de administración interna │
│                 │                                  │ con pocas páginas (< 1,000 filas).  │
├─────────────────┼──────────────────────────────────┼─────────────────────────────────────┤
│ Cursor (take +  │ Escala O(1), no degrada con      │ Feeds públicos de testimonios,      │
│ cursor + skip:1)│ millones de registros.           │ scroll infinito y logs de auditoría.│
└─────────────────┴──────────────────────────────────┴─────────────────────────────────────┘
```

```typescript
// Paginación por Cursor Determinística
async getTestimonialFeed(tenantId: string, limit: number, cursorId?: string) {
  return this.prisma.testimonial.findMany({
    take: limit,
    skip: cursorId ? 1 : 0,
    cursor: cursorId ? { id: cursorId } : undefined,
    where: { tenantId, isApproved: true },
    orderBy: { id: 'asc' }, // Ordenamiento único y estable
  });
}
```

---

## 14. Transacciones ACID, Concurrencia y Resiliencia

### 14.1. Regla Innegociable: Transacciones Ultracortas
Las transacciones en PostgreSQL adquieren locks de fila y saturan el pool.
- ❌ **PROHIBIDO:** Llamar a pasarelas de pago (Stripe), enviar emails o hashear contraseñas (`bcrypt`/`argon2`) dentro de un bloque `$transaction`.
- ✅ **CORRECTO:** Realizar todo el procesamiento previo en memoria; abrir la transacción solo para las escrituras en base de datos.

```typescript
// ❌ ANTIPATRÓN CRÍTICO (Transacción larga con I/O bloqueante):
await prisma.$transaction(async (tx) => {
  const order = await tx.order.create(...);
  await stripe.charges.create(...); // ⚠️ Red externa: bloquea la conexión durante 3 segundos
  await tx.order.update(...);
});

// ✅ TRANSACCIÓN ULTRACORTA + OUTBOX PATTERN:
const chargeResult = await stripe.charges.create(...); // I/O fuera de la transacción
await prisma.$transaction(async (tx) => {
  await tx.order.create(...);
  await tx.outboxEvent.create({ // Evento persistido atómicamente
    data: { eventType: 'ORDER_PAID', payload: chargeResult },
  });
});
```

---

## 15. Patrones Críticos de `@testimonial-cms`

### 15.1. Transactional Outbox (`OutboxEvent`)
Garantiza la entrega confiable de webhooks y eventos hacia brokers externos sin inconsistencias duales (*Dual Write Problem*):

```typescript
// Inserción atómica del recurso y su evento outbox en la misma transacción ACID
await this.prisma.$transaction(async (tx) => {
  const testimonial = await tx.testimonial.create({
    data: testimonialData,
  });

  await tx.outboxEvent.create({
    data: {
      tenantId: testimonial.tenantId,
      eventType: 'testimonial.created',
      payload: { id: testimonial.id, author: testimonial.authorName },
      status: 'PENDING',
    },
  });

  return testimonial;
});
```

### 15.2. Control de Idempotencia (`IdempotencyKey`)
Protege endpoints de cobros o mutaciones críticas ante reintentos de red automáticos:

```typescript
// Consulta y reserva de clave de idempotencia
const existingKey = await tx.idempotencyKey.findUnique({
  where: { key_tenantId: { key: idempotencyKey, tenantId } },
});

if (existingKey && existingKey.status === 'COMPLETED') {
  return existingKey.responseBody; // Retornar respuesta previa sin reejecutar
}
```

---

## 16. Aislamiento Multi-Tenant Estricto

En un SaaS multi-tenant con base de datos compartida, **toda consulta que lea o escriba datos debe exigir el filtro por `tenantId`**:

```typescript
// ❌ VULNERABLE A BOLA / IDOR (Broken Object Level Authorization):
await prisma.apiKey.findUnique({
  where: { id: apiKeyId }, // Un atacante del Tenant B puede acceder a la clave del Tenant A
});

// ✅ AISLAMIENTO ESTRICTO Y COMPROBADO:
await prisma.apiKey.findFirst({
  where: {
    id: apiKeyId,
    tenantId: currentTenantId, // Filtro de tenant obligatorio
  },
});
```

---

## 17. Gobernanza de Migraciones y Ciclo de Vida

```text
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│ Comando                 │ Entorno de Ejecución Mandatorio                        │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ npx prisma migrate dev  │ EXCLUSIVAMENTE en máquinas de DESARROLLO local.       │
│                         │ Requiere shadow database para detectar drift.          │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ npx prisma migrate deploy│ EXCLUSIVAMENTE en CI/CD, Staging y PRODUCCIÓN.       │
│                         │ Aplica migraciones SQL pendientes sin alterar historial│
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ npx prisma db push      │ PROHIBIDO en bases de datos relacionales productivas.  │
│                         │ Solo permitido para prototipado descartable.          │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

### 17.1. Estrategia Expand-Contract para Migraciones Zero-Downtime
Para renombrar o alterar columnas existentes sin interrumpir la operación de réplicas en ejecución:

```text
1. EXPAND:
   - Crear la nueva columna en schema.prisma (e.g. `fullName String?`).
   - Mantener la columna vieja (`name`).
   - Desplegar la migración y la nueva versión del código que escribe en ambas columnas.

2. BACKFILL:
   - Ejecutar un job asíncrono que migre los datos antiguos a la nueva columna en lotes de 1,000 registros.

3. SWITCH:
   - El código pasa a leer exclusivamente de la nueva columna (`fullName`).

4. CONTRACT:
   - En una migración posterior, eliminar la columna vieja (`name`).
```

### 17.2. Seeds Idempotentes con `upsert`
El seed (`prisma/seed.ts`) debe poder ejecutarse 10 veces consecutivas sin duplicar datos ni fallar:

```typescript
await prisma.role.upsert({
  where: { code: 'ADMIN' },
  update: { description: 'Administrator Role' },
  create: { code: 'ADMIN', description: 'Administrator Role' },
});
```

---

## 18. Catálogo de 35 Antipatrones (PRISMA-01 a PRISMA-35)

| Código | Antipatrón | Causa Común | Consecuencia Técnica | Solución Profesional |
| :--- | :--- | :--- | :--- | :--- |
| **PRISMA-01** | `new PrismaClient()` por request | Ignorar el ciclo de vida | Saturación inmediata del pool de PostgreSQL. | Inyectar `PrismaService` como singleton en NestJS. |
| **PRISMA-02** | `$disconnect()` tras cada endpoint | Creer que "cierra recursos" | Destruye el pool y añade sobrecarga de 50ms por request. | Mantener conexión viva y cerrar solo en `OnModuleDestroy`. |
| **PRISMA-03** | Mezclar versiones de Prisma | Copiar código de Prisma 6 a 7 | Errores de inicialización y APIs eliminadas. | Verificar `npx prisma --version` antes de estructurar. |
| **PRISMA-04** | Creer que Prisma reemplaza SQL | Desconocimiento relacional | Consultas catastróficamente ineficientes y bloqueos. | Entender planes de ejecución e índices de PostgreSQL. |
| **PRISMA-05** | Prisma Model como Dominio | Comodidad excesiva | Acopla reglas de negocio al motor de base de datos. | Mapear a Domain Entities con métodos ricos. |
| **PRISMA-06** | Exponer modelos en endpoints | Retornar directo de Prisma | Fuga de hashes de contraseña y datos sensibles. | Retornar DTOs mapeados y validados con Zod. |
| **PRISMA-07** | Repository de pasamanos | Copiar patrones sin pensar | Boilerplate innecesario que solo duplica Prisma. | Usar Repository solo cuando abstraiga consultas complejas. |
| **PRISMA-08** | `include` de todo el árbol | Pereza de proyecciones | Carga gigabytes en memoria y degrada la latencia. | Incluir únicamente relaciones indispensables. |
| **PRISMA-09** | No usar `select` | Traer todas las columnas | Alto I/O de disco y serialización excesiva. | Seleccionar proyecciones mínimas obligatorias. |
| **PRISMA-10** | Queries dentro de bucles (N+1) | `for (const u of users) find()` | 1 + N llamadas a la base de datos; colapso bajo carga. | Usar `include`, `in: [...]` o `relationLoadStrategy`. |
| **PRISMA-11** | `skip: 50000` en paginación | Offset pagination masiva | PostgreSQL escanea 50,000 filas para descartarlas. | Migrar a paginación basada en cursor (`cursor: { id }`). |
| **PRISMA-12** | Indexar cada columna | "Por si acaso" | Degrada el rendimiento de `INSERT`/`UPDATE` y satura disco. | Diseñar índices compuestos basados en queries reales. |
| **PRISMA-13** | Ignorar `EXPLAIN ANALYZE` | Confianza ciega en el ORM | Escaneos secuenciales invisibles en producción. | Analizar SQL generado en consultas de alto tráfico. |
| **PRISMA-14** | `$queryRawUnsafe` con variables | Concatenación de strings | Vulnerabilidad crítica de SQL Injection (OWASP A03). | Usar `$queryRaw` parametrizado o TypedSQL. |
| **PRISMA-15** | `data: req.body` | Mass Assignment | Atacantes alteran roles, `tenantId` o flags de admin. | Mapear campos explícitamente desde DTOs validados. |
| **PRISMA-16** | Transacciones largas | Operaciones lentas en `$transaction` | Locks prolongados y deadlocks masivos. | Reducir el cuerpo de `$transaction` a escrituras mínimas. |
| **PRISMA-17** | HTTP o Hashing en transacciones | Enviar emails dentro de `tx` | Agota las conexiones del pool en segundos. | Mover I/O externo fuera de la transacción. |
| **PRISMA-18** | `Serializable` universal | Búsqueda ingenua de seguridad | Abortos masivos de transacciones por serialización. | Usar `ReadCommitted` con locks optimistas. |
| **PRISMA-19** | `migrate dev` en producción | Mala configuración de CI/CD | Caída del release y alteración de tablas temporales. | Usar estrictamente `npx prisma migrate deploy`. |
| **PRISMA-20** | `db push` en producción | Evitar crear migraciones SQL | Pérdida de trazabilidad y riesgo de borrado de columnas. | Versionar siempre migraciones formales en `migrations/`. |
| **PRISMA-21** | Editar migraciones ya aplicadas | "Corregir un typo" | Error de checksum y drift de migraciones en staging. | Crear una nueva migración incremental correctiva. |
| **PRISMA-22** | Migrar desde cada réplica | Script de inicio en Dockerfile | Condición de carrera; réplicas intentando migrar a la vez. | Ejecutar migraciones como un Job independiente previo en CI. |
| **PRISMA-23** | Backfills gigantes en deploy | `UPDATE table SET col = val` | Bloqueo de tabla durante horas; caída de la app. | Separar DDL en migración y backfill en background worker. |
| **PRISMA-24** | Suponer down-migrations seguras | Creer que todo rollback es fácil | Datos nuevos eliminados irreversiblemente. | Diseñar roll-forward mediante cambios compatibles. |
| **PRISMA-25** | Mezclar DDL con mutación de datos | Llenar datos en el `.sql` de migrate | Migraciones lentas y fallos difíciles de reintentar. | Separar cambios estructurales de scripts de datos. |
| **PRISMA-26** | Seed aleatorio en producción | Ejecutar `faker` en prod | Inundación de datos falsos en bases productivas. | Separar seeds de catálogo de datos de prueba local. |
| **PRISMA-27** | Hardcodear IDs numéricos en seeds | `id: 1` asumiendo autoincrement | Colisiones de secuencia y fallos de inserción. | Usar `upsert` basado en códigos únicos estables (`ADMIN`). |
| **PRISMA-28** | Olvidar `tenantId` en queries | `where: { id }` directo | Fuga de datos entre empresas (BOLA / IDOR crítico). | Incluir siempre `tenantId` en las cláusulas `where`. |
| **PRISMA-29** | Loggear parámetros sensibles | Registrar queries completas | Claves y tarjetas de crédito impresas en logs. | Sanitizar parámetros antes de enviar al logger Pino. |
| **PRISMA-30** | Sobredimensionar pools | `connection_limit=100` por réplica | PostgreSQL colapsa por agotamiento de conexiones. | Calcular: `Total Connections / Cantidad de Réplicas`. |
| **PRISMA-31** | Forzar Prisma en reportes complejos | ORM gymnastics | Código incomprensible de 200 líneas y consultas lentas. | Utilizar TypedSQL o vistas de PostgreSQL. |
| **PRISMA-32** | Probar solo con mocks en memoria | No probar PostgreSQL real | Los tests pasan pero las migraciones y constraints fallan. | Utilizar integration tests contra PostgreSQL con Testcontainers. |
| **PRISMA-33** | Confundir tipado con autorización | "Si compila en TS es seguro" | No valida si el usuario logueado es dueño del recurso. | Validar propiedad a nivel de servicio y persistencia. |
| **PRISMA-34** | Zod como única restricción | Omitir constraints en PostgreSQL | Inconsistencias de datos ante inserts concurrentes o directos. | Respaldar validaciones de Zod con `UNIQUE` y `CHECK` en DB. |
| **PRISMA-35** | Relaciones implícitas con metadata | `User[]` sin tabla intermedia | Imposible agregar `role`, `createdAt` o `status`. | Modelar tablas intermedias explícitas para N:M complejas. |

---

## 19. Definition of Done (DoD) de Persistencia

Un módulo o cambio en la capa de datos se considera terminado y listo para producción cuando:

- [ ] **Esquema:** Modelado en `schema.prisma` respetando convenciones (`PascalCase`, `@map`, `@@map`).
- [ ] **Integridad:** Claves foráneas, nullability e índices compuestos (`@@index([tenantId, ...])`) declarados.
- [ ] **Aislamiento:** Verificado que todas las consultas incorporan `tenantId` en sistemas multi-tenant.
- [ ] **Migración:** Generada mediante `prisma migrate dev`, versionada en `migrations/` y probada con `migrate deploy`.
- [ ] **Zero-Downtime:** Si introduce cambios incompatibles, se diseñó bajo la estrategia Expand-Contract.
- [ ] **Prevención N+1:** Queries analizadas con `select` e `include` conscientes; sin bucles de consultas.
- [ ] **Transacciones:** Transacciones atómicas, ultracortas y sin llamadas de red externas bloqueantes.
- [ ] **Deadlock Resilience:** Transacciones críticas envueltas con reintentos exponenciales (`withRetry`).
- [ ] **Transactional Outbox:** Si emite eventos externos, se persisten atómicamente con `OutboxEvent`.
- [ ] **Seguridad:** Datos mapeados desde DTOs validados; cero concatenación de SQL sin parametrizar.
- [ ] **Observabilidad:** Consultas lentas (> 100ms) registradas por el logger sin filtrar secretos.
- [ ] **Testing:** Pruebas de integración ejecutadas contra PostgreSQL validando constraints y transacciones.

---

## 20. Métricas de Evaluación y KPIs

| Métrica | Definición / Fórmula | Objetivo Senior |
| :--- | :--- | :--- |
| **Instancias Prisma Innecesarias** | Cantidad de clientes creados fuera del singleton `PrismaService`. | **0** |
| **Consultas N+1 en Paths Críticos** | Consultas en bucle detectadas en endpoints de alta frecuencia. | **0** |
| **Migraciones en Producción sin Versionar** | Esquemas modificados manualmente o con `db push` en prod. | **0** |
| **Ejecuciones de `migrate dev` en Prod** | Uso indebido del comando de desarrollo en pipelines productivos. | **0** |
| **Fugas de Aislamiento Multi-Tenant** | Solicitudes que retornan o modifican datos de otro `tenantId`. | **0** |
| **Credenciales de Base de Datos Versionadas** | `DATABASE_URL` o contraseñas presentes en commits de Git. | **0** |
| **Latencia p95 de Consultas de Base de Datos** | Tiempo de ejecución de consultas en PostgreSQL. | **< 20ms** |
| **Agotamiento de Conexiones en Postgres** | Errores por superación de `max_connections` en producción. | **0** |

---

## 21. Casos de Estudio y Evaluación Práctica

### Escenario A — CRUD Backend en NestJS
- **Situación:** Implementar 20 endpoints para gestión de categorías y tags en `@testimonial-cms`.
- **Resolución Senior:** Crear el modelo en `schema.prisma` con mapeo a snake_case, generar la migración versionada, inyectar el singleton `PrismaService`, aplicar proyecciones `select` estrictas y escribir tests de integración sin crear capas de repositories artificiales si no aportan aislamiento real.

### Escenario B — Erradicación de N+1
- **Situación:** Endpoint que retorna 100 testimonios con sus respectivas etiquetas (`Tag`) ejecutando 101 consultas.
- **Resolución Senior:** Reemplazar el loop por una única consulta utilizando `include: { tags: true }` o evaluar `relationLoadStrategy: 'join'`, verificando en el log de Prisma que se emite una única consulta optimizada.

### Escenario C — Migración de 50 Millones de Filas
- **Situación:** Agregar una columna obligatoria (`sentimentScore Float`) en una tabla con 50M de registros en producción.
- **Resolución Senior:**
  1. *Expand:* Crear la columna como nullable (`sentimentScore Float?`) y desplegar con `migrate deploy`.
  2. *Backfill:* Ejecutar un script de actualización por lotes fuera de horas pico.
  3. *Switch:* El backend comienza a calcular y escribir el nuevo campo en todas las altas.
  4. *Contract:* En una migración posterior, alterar la columna a `NOT NULL` con valor predeterminado validado.

### Escenario D — Aislamiento Multi-Tenant en API Keys
- **Situación:** Endpoint `DELETE /api/v1/api-keys/:id`.
- **Resolución Senior:** Ejecutar `prisma.apiKey.deleteMany({ where: { id, tenantId } })` o verificar previamente pertenencia. Si el registro pertenece a otro tenant, retornar HTTP 404/403 sin alterar datos ajenos.

### Escenario E — Serverless / Lambda Connection Storm
- **Situación:** Picos de 500 invocaciones concurrentes colapsan PostgreSQL por agotamiento de conexiones.
- **Resolución Senior:** Configurar un connection pooler intermedio (**PgBouncer** o AWS RDS Proxy), reducir el `connection_limit=1` en la cadena de conexión de cada función y reutilizar la instancia de Prisma en contextos calientes (*warm starts*).

### Escenario F — Reporte Analítico Complejo con TypedSQL
- **Situación:** Dashboard que calcula el promedio móvil de testimonios aprobados por mes, porcentaje de retención y ratio de tags populares mediante Window Functions y CTEs.
- **Resolución Senior:** No forzar la API relacional de Prisma. Crear un archivo `prisma/sql/getMonthlyAnalytics.sql`, compilar con `npx prisma generate --sql` y consumir la consulta fuertemente tipada con `prisma.$queryRaw(getMonthlyAnalytics(tenantId))`.

---

## 22. Cheat Sheet — 30 Reglas de Oro de Prisma Senior

1. Prisma no reemplaza el conocimiento de SQL ni de PostgreSQL.
2. Detectá siempre la versión mayor (`npx prisma --version`) antes de configurar.
3. En aplicaciones persistentes (NestJS), reutilizá un único singleton de `PrismaService`.
4. Prohibido ejecutar `$disconnect()` al finalizar una solicitud HTTP.
5. Dimensioná el pool de conexiones considerando el total de réplicas desplegadas.
6. Prisma es un detalle de infraestructura de persistencia, no el dominio de negocio.
7. No construyas un Repository si solo reenvía llamadas idénticas a Prisma Client.
8. La nullability en el schema expresa invariantes de dominio; no abuses de campos opcionales.
9. Apoyá las validaciones de Zod con constraints reales en PostgreSQL (`UNIQUE`, `CHECK`, FK).
10. Diseñá los índices basándote en los filtros `WHERE` y ordenamientos `ORDER BY` reales.
11. Utilizá relaciones explícitas con tabla intermedia si la asociación contiene metadatos.
12. Aplicá siempre proyecciones mínimas obligatorias con `select`.
13. No incluyas relaciones arbitrarias con `include: true` sin justificación.
14. Erradicá el problema de consultas N+1 utilizando queries anidadas o `join strategy`.
15. Para listas masivas o feeds, adoptá paginación basada en cursor.
16. Preferí operaciones en lote (`createMany`, `updateMany`) frente a bucles de inserción.
17. Mantené las transacciones ACID ultracortas; prohibido I/O externo o hashing dentro de `tx`.
18. Protegé transacciones concurrentes con reintentos exponenciales ante deadlocks (`withRetry`).
19. Adoptá el patrón Transactional Outbox para coordinar bases de datos y eventos externos.
20. TypedSQL es una herramienta de ingeniería de primer nivel, no una derrota del ORM.
21. Nunca concatenes cadenas de texto en `$queryRawUnsafe`.
22. Versioná todas las migraciones en Git dentro de `prisma/migrations/`.
23. Ejecutá estrictamente `prisma migrate deploy` en entornos de Staging y Producción.
24. Prohibido utilizar `prisma db push` en bases de datos relacionales de producción.
25. Nunca edites el archivo SQL de una migración que ya fue aplicada en producción.
26. Aplicá la estrategia Expand-Contract para cambios de esquema sin tiempo de inactividad.
27. Los scripts de seed deben ser determinísticos e idempotentes mediante `upsert`.
28. En sistemas multi-tenant, exigí el filtro por `tenantId` en cada operación de base de datos.
29. Registrá las consultas lentas (> 100ms) sin imprimir credenciales ni datos personales en logs.
30. Probá la persistencia contra PostgreSQL real utilizando contenedores en pruebas de integración.

---

## 23. Árbol de Decisión de Persistencia

```text
                                INICIO
                                  │
                 ┌────────────────▼────────────────┐
                 │    ¿Qué tipo de consulta es?    │
                 └───────┬────────────────┬────────┘
                         │                │
          CRUD Estándar /│                │ Agregación Compleja /
          Relacional     │                │ Reportes / Window Functions
                         │                │
            ┌────────────▼──────┐   ┌─────▼──────────────────────┐
            │   Prisma Client   │   │ ¿Es estática o dinámica?   │
            │ (select + include)│   └──────┬──────────────┬──────┘
            └────────────┬──────┘          │              │
                         │        Estática │              │ Dinámica
                         │                 │              │
                         │      ┌──────────▼────┐   ┌─────▼────────────────┐
                         │      │    TypedSQL   │   │ $queryRaw parametrizado│
                         │      │ (sql/*.sql)   │   │ con Prisma.sql       │
                         │      └───────────────┘   └──────────────────────┘
                         │
          ┌──────────────▼──────────────┐
          │ ¿Involucra múltiples tablas │
          │  que deben ser atómicas?   │
          └───────┬──────────────┬──────┘
                  │              │
               Sí │              │ No
                  │              │
          ┌───────▼──────────┐   └────────────────────────┐
          │ $transaction     │                            │
          │ Ultracorto con   │                            │
          │ withRetry logic  │                            │
          └───────┬──────────┘                            │
                  │                                       │
                  └───────────────────┬───────────────────┘
                                      │
                       ┌──────────────▼──────────────┐
                       │   ¿Es un sistema SaaS?      │
                       └───────┬──────────────┬──────┘
                               │              │
                            Sí │              │ No
                               │              │
                ┌──────────────▼─────┐   ┌────▼─────────────┐
                │ Filtrado mandatorio│   │ Consulta directa │
                │ por tenantId       │   │ autorizada       │
                └──────────────┬─────┘   └────┬─────────────┘
                               │              │
                               └───────┬──────┘
                                       │
                                      FIN
```

---

## 24. Resultado Esperado y Regla de Oro

Una arquitectura de persistencia implementada con excelencia Senior es **fuertemente tipada, consciente de SQL, atómica, resiliente ante concurrencia, hermética en multi-tenancy, observable y capaz de evolucionar sin downtime**.

### Regla Final
> *"Un ingeniero Senior de Prisma no mide su maestría por cuántos métodos del cliente memoriza, sino por su capacidad de preservar la integridad relacional, el rendimiento de PostgreSQL y el aislamiento de los datos, eligiendo en cada instante la abstracción exacta que el problema de ingeniería demanda."*

---

## 25. Recursos Adicionales y Referencias Oficiales

1. **Documentación Oficial de Prisma ORM:**
   - [Prisma Schema Reference](https://www.prisma.io/docs/orm/prisma-schema)
   - [Prisma Client Best Practices & Connection Management](https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases-connections)
   - [Prisma Migrate in Production (Deploy Workflow)](https://www.prisma.io/docs/orm/prisma-migrate/workflows/deploy-to-production)
   - [Prisma Transactions and Concurrency Control](https://www.prisma.io/docs/orm/prisma-client/queries/transactions)
   - [Prisma TypedSQL Guide](https://www.prisma.io/docs/orm/prisma-client/using-raw-sql/typedsql)
   - [Prisma Driver Adapters for PostgreSQL](https://www.prisma.io/docs/orm/overview/databases/postgresql)
2. **Patrones de Arquitectura y Rendimiento:**
   - Martin Fowler — *Expand and Contract Pattern (Parallel Change)*
   - Chris Richardson — *Transactional Outbox Pattern for Microservices*
   - PostgreSQL Documentation — *Concurrency Control, Locks and Index Types*
   - OWASP Foundation — *SQL Injection Prevention Cheat Sheet*
