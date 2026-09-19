---
name: layered-architecture-engineering
description: >-
  Diseño e implementación de arquitecturas modulares por capas en Node.js, NestJS y Next.js (código SKL-ARCH-LAYERED-001). Usar cuando se requiera gobernar dependencias explícitas, desacoplar transporte, aplicación, dominio e infraestructura, estructurar monolitos modulares Feature-First, implementar inversión de dependencias pragmática (IoC en NestJS, manual en Node, Server/Client boundaries en Next.js App Router), aislar persistencia y ORMs (Prisma), propagar contexto con AsyncLocalStorage, mapear errores a Problem Details RFC 9457 y evitar sobreingeniería ceremonial.
---

# Especificación Técnica de Habilidad: Senior Layered Architecture for Node.js, NestJS & Next.js

---

**Código de Skill:** SKL-ARCH-LAYERED-001  
**Nombre:** Senior Layered Architecture for Node.js, NestJS & Next.js  
**Versión:** 1.0.0  
**Nivel:** Senior / Staff / Production Engineering  
**Dominio:** Software Architecture / Backend / Full-Stack / Frontend Architecture  
**Ecosistema:** Node.js 24 LTS / NestJS 11 / Next.js 15 App Router / TypeScript Strict  
**Estándares:** ISO/IEC 26514 / IEEE 29148 / SOLID / Clean Architecture Pragmática / Modular Monolith / Twelve-Factor App / RFC 9457 Problem Details / OWASP API Security / Agile Definition of Done  
**Ecosistema del proyecto:** Monorepo `@testimonial-cms` (`apps/api` en NestJS 11 + Prisma 6.5+, `apps/web` en Next.js 15 App Router + React 19 + Tailwind CSS v3, PostgreSQL 18, BullMQ + Redis 7, Multi-tenant Row-Level Isolation con `tenant_id`).

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño e implementación de arquitecturas modulares por capas en aplicaciones Node.js, NestJS y Next.js. |
| **Objetivo de Dominio** | Separar transporte, aplicación, dominio, persistencia e infraestructura mediante dependencias explícitas y límites verificables sin incurrir en sobreingeniería accidental. |
| **Arquitectura Base** | Feature-First (Screaming Architecture) + Layered Architecture pragmática. |
| **Backend Default** | Transport / Presentation → Application (Use Cases) → Domain (Reglas puras, opcional) → Infrastructure / Persistence. |
| **Frontend Next.js** | Routing/Composition (`app/`) → Features/UI (`features/`) → Application/Data Logic → Server/External Infrastructure (`server/` o DAL con `server-only`). |
| **Inyección de Dependencias** | Manual/factories en Node.js puro; IoC container nativo en NestJS con injection tokens explícitos (`Symbol`); Server Component composition en Next.js. |
| **Persistencia** | Repositories / DAL desacoplados sólo cuando aportan una frontera real; ORM directo en casos CRUD simples donde la abstracción no agrega valor. |
| **Aislamiento Multi-Tenant** | Row-Level Isolation mandatorio (`tenant_id`) filtrado y validado en las capas de Aplicación e Infraestructura. |
| **Observabilidad** | Structured Logging (Pino) + Correlation Context (`AsyncLocalStorage` con `requestId`, `tenantId`, `traceId`) + Metrics + Tracing en outer layers. |
| **Testing** | Behavior-oriented (Use Cases aislados de HTTP) + Integration (PostgreSQL y Redis reales) + Contract + E2E críticos. |
| **Complejidad** | Alta / Production Engineering. |
| **Prioridad** | Correctitud → Cohesión → Límites → Testeabilidad → Observabilidad → Evolución → Simplicidad. |

---

## 2. Descripción y Filosofía de Diseño

La Skill se fundamenta en cinco pilares rectores:

```text
FEATURE-FIRST
+
LAYERED RESPONSIBILITIES
+
DEPENDENCY INVERSION
+
EXPLICIT BOUNDARIES
+
PRAGMATIC COMPLEXITY
```

No se basa en la generación refleja e indiscriminada de:
```text
controller/
service/
repository/
entity/
mapper/
interface/
```
creados automáticamente para cada recurso sin evaluar su complejidad intrínseca.

---

### 2.1. Regla Rectora

> **Las capas existen para controlar dependencias y responsabilidades, no para aumentar el número de archivos.**

La arquitectura correcta será la **menor cantidad de capas** que preserve:
```text
business rules (invariantes protegidas)
testability (casos de uso testeables sin transporte)
replaceable infrastructure (adaptadores intercambiables)
clear ownership (límites nítidos por feature)
framework isolation (núcleo inmune a cambios de framework)
```

---

### 2.2. Feature-First sobre Layer-First

Evitar como estructura principal en aplicaciones en crecimiento la organización global por tipo técnico:

```text
# ❌ ANTIPATRÓN: Layer-First Global (alta dispersión, acoplamiento difuso)
src/
├── controllers/
│   ├── users.controller.ts
│   ├── testimonials.controller.ts
│   └── webhooks.controller.ts
├── services/
│   ├── users.service.ts
│   ├── testimonials.service.ts
│   └── webhooks.service.ts
├── repositories/
├── dto/
└── entities/
```

Preferir la organización orientada a características (*Feature-First / Screaming Architecture*):

```text
# ✅ PATRÓN RECOMENDADO: Feature-First (alta cohesión, límites autónomos)
src/
└── modules/ (o features/)
    ├── users/
    │   ├── presentation/
    │   ├── application/
    │   ├── domain/
    │   └── infrastructure/
    ├── testimonials/
    ├── webhooks/
    └── analytics/
```
Cada feature encapsula sus propias responsabilidades, facilitando su comprensión, refactorización y eventual extracción a servicios independientes si la escala lo requiere.

---

### 2.3. Modelo Conceptual General

```text
┌─────────────────────────────────────────────────────────────┐
│                      Presentation                           │
│        HTTP Controllers / UI Components / Transport         │
└──────────────────────────────┬──────────────────────────────┘
                               │ invoca
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                       Application                           │
│            Use Cases / Workflows / Orchestration            │
└──────────────────────────────┬──────────────────────────────┘
                               │ orquesta / aplica
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Domain                              │
│       Entities / Value Objects / Business Invariants        │
└──────────────────────────────▲──────────────────────────────┘
                               │
                               │ implementa contratos / puertos
┌──────────────────────────────┴──────────────────────────────┐
│                     Infrastructure                          │
│     Prisma ORM / PostgreSQL / Redis / BullMQ / Cloudinary    │
└─────────────────────────────────────────────────────────────┘
```

La dirección conceptual inmutable es:
```text
outer layers (Presentación, Infraestructura)
→ depend on →
inner abstractions (Aplicación, Dominio)
```

---

### 2.4. Dependencias e Inversión de Dependencias

Idealmente:
```text
Presentation
    ↓ (depende de)
Application
    ↓ (depende de)
Domain
```
y la capa de Infraestructura:
```text
Infrastructure → implements ports / interfaces requeridos por Application / Domain
```

**Regla de Oro**: El Dominio nunca debe importar:
```text
Domain
  ❌ PrismaClient
  ❌ @nestjs/common (@Injectable, HttpException)
  ❌ express (Request, Response)
  ❌ next / react
  ❌ axios / fetch
```

---

### 2.5. Clean Architecture no es Obligatoria

No toda aplicación ni todo módulo requiere:
```text
entities/ + value-objects/ + ports/ + adapters/ + mappers/ + use-cases/ + factories/
```

Aplicar una arquitectura en capas completa cuando existan:
- **Complex domain rules**: Reglas de negocio con múltiples estados, validaciones cruzadas y cálculo de invariantes.
- **Multiple adapters**: Necesidad de soportar múltiples canales (ej. REST + Webhooks + Workers BullMQ).
- **Long system lifetime**: Sistemas proyectados a evolucionar durante años con cambio previsible de librerías.
- **Independent testing needs**: Requisito de validar reglas de negocio en milisegundos sin levantar contenedores ni DB.

Para flujos CRUD triviales (ej. lectura directa de una lista con filtros simples), un flujo directo es perfectamente válido y deseable:
```text
Controller → Service / Query Handler → Prisma / ORM
```

---

### 2.6. Domain Layer es Opcional

No inventar "dominio" ceremonial.
- Si la lógica del módulo se resume en: `business logic ≈ CRUD con validación de schema`, **no debe crearse una capa de dominio independiente**. El caso de uso u orquestador en `application/` es suficiente.
- Si aparecen:
  ```text
  invariants (ej. un testimonio no puede aprobarse sin moderador asignado)
  state transitions (draft → pending → approved → published | rejected)
  pricing rules / quota limits (límite de testimonios por plan de tenant)
  eligibility / scoring decay (cálculo de score de social proof)
  authorization policies complejas
  ```
  entonces la **capa de dominio adquiere valor inmediato**.

---

### 2.7. Domain Model ≠ ORM Model

No asumir nunca la identidad entre modelos:
```text
Prisma Model (Database Schema)
              ≠
Domain Entity (Rich Business Invariants)
              ≠
HTTP Response / DTO (Contract Representation)
```

- El **modelo de Prisma** optimiza almacenamiento relacional, claves foráneas e índices.
- El **modelo de Dominio** encapsula comportamiento e impide estados inválidos.
- El **DTO de Transporte** optimiza el contrato expuesto al cliente, ocultando campos sensibles (`password_hash`, `tenant_id` interno) y respetando semántica HTTP.

---

### 2.8. Resiliencia y Observabilidad en Outer Layers

Toda arquitectura para producción debe contemplar:
```text
request context
structured logging
timeouts & retries
error translation
transactions
metrics & tracing
graceful shutdown
```
Estas preocupaciones **pertenecen a las capas exteriores** (Middleware, Interceptors, Filters, Adapters) y **nunca deben contaminar las funciones puras de negocio**.

---

### 2.9. Correlation Context con AsyncLocalStorage

En Node.js, utilizar `AsyncLocalStorage` para propagar de forma transparente:
```text
requestId
traceId
tenantId
userId
```
a través de toda la cadena de llamadas asíncronas, eliminando la necesidad de pasar estos metadatos manualmente como parámetros en cada función de dominio.

---

### 2.10. Separación y Mapeo de Errores

Separar rigurosamente los errores de negocio de su representación HTTP:
```text
Domain / Application Error (ej. TestimonialNotFoundError, InvariantViolationError)
                             │
                             ▼ (interceptado por)
                    Transport Exception Filter
                             │
                             ▼
            HTTP Response (404 Not Found / RFC 9457 Problem Details)
```

La capa de aplicación o dominio **nunca** debe instanciar ni lanzar excepciones del framework:
```typescript
// ❌ INCORRECTO en capa de Dominio o Aplicación
throw new NotFoundException('Testimonio no encontrado');

// ✅ CORRECTO: Error explícito de dominio o aplicación
throw new TestimonialNotFoundError(testimonialId, tenantId);
```

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales

- **[RF-01] Organización por Bounded Context / Feature**: El sistema DEBE organizar su código primario por módulo o feature de dominio antes que por agrupación técnica global.
- **[RF-02] Responsabilidad de Presentation**: La capa de transporte sólo debe procesar parsing de entrada, autenticación perimetral, validación de schemas, invocación de la capa de aplicación y serialización de respuestas.
- **[RF-03] Intención en Application Layer**: Los casos de uso DEBEN modelar intenciones concretas del negocio (ej. `ApproveTestimonialUseCase`, `RotateApiKeyUseCase`, `PublishTestimonialUseCase`).
- **[RF-04] Pureza del Dominio**: Cuando exista capa de dominio, sus clases, funciones y tipos NO DEBEN depender de librerías de infraestructura, frameworks web ni ORMs.
- **[RF-05] Aislamiento de Infraestructura**: Todo acceso a bases de datos, APIs de terceros (Cloudinary, Slack), colas de mensajería (BullMQ), filesystem o reloj del sistema DEBE implementarse en adaptadores de infraestructura.
- **[RF-06] Inyección Explícita de Dependencias**: Las dependencias externas DEBEN recibirse mediante constructores o parámetros de fábricas, prohibiéndose el uso de singletons globales ocultos.
- **[RF-07] Validación Perimetral Estricta**: Toda entrada externa no confiable (body, query, params, headers, webhooks, mensajes de cola) DEBE validarse en la frontera antes de alcanzar la capa de aplicación.
- **[RF-08] Encapsulamiento de Persistencia**: Las consultas complejas a base de datos y transacciones DEBEN encapsularse para evitar que detalles de Prisma o SQL se filtren a la lógica de negocio.
- **[RF-09] Frontera Transaccional Explícita**: Los casos de uso que requieran escrituras atómicas (ej. creación de testimonio + registro en Transactional Outbox) DEBEN delimitar explícitamente su transacción.
- **[RF-10] Mapeo de Errores en la Frontera**: La traducción de excepciones de negocio a códigos de estado HTTP (RFC 9457) DEBE residir exclusivamente en la capa de presentación.
- **[RF-11] API Pública de Módulo**: Cada módulo DEBE definir explícitamente sus símbolos exportados (`index.ts` o `exports` de NestJS Module), manteniendo los detalles internos privados.
- **[RF-12] Verificación de Límites**: Las restricciones de importación entre capas DEBEN ser auditables y verificables mediante linters o herramientas de arquitectura.

### 3.2. Requerimientos No Funcionales

- **[RNF-01] Mantenibilidad e Intercambiabilidad**: El reemplazo de un adaptador de infraestructura (ej. migrar de Cloudinary a S3 o cambiar el driver de email) NO DEBE requerir modificaciones en las reglas de dominio.
- **[RNF-02] Testeabilidad Desacoplada**: Los casos de uso y reglas de negocio DEBEN poder ejecutarse y probarse unitariamente en memoria sin requerir levantar el servidor HTTP ni la base de datos.
- **[RNF-03] Trazabilidad y Correlación**: Toda operación crítica DEBE registrar un identificador de correlación (`requestId` / `traceId`) y el identificador de inquilino (`tenant_id`).
- **[RNF-04] Eficiencia y Rendimiento**: No introducir abstracciones intermedias, mappers o copias de memoria cuando los modelos sean idénticos y no exista ganancia de desacople.
- **[RNF-05] Aislamiento de Frameworks**: Las APIs específicas de NestJS (`@Injectable`, `ExecutionContext`) o Next.js (`cookies()`, `headers()`) no deben penetrar en el núcleo de aplicación ni dominio.
- **[RNF-06] Type Safety Riguroso**: TypeScript debe operar bajo modo estricto (`strict: true`, `noUncheckedIndexedAccess: true`), tipando exhaustivamente todas las fronteras de entrada y salida.

---

## 4. Criterios de Aceptación — Definition of Done (DoD)

Toda feature o refactorización arquitectónica debe satisfacer:

- [ ] **Feature Ownership**: La totalidad del código pertenece a un módulo o feature identificable; no existen archivos huérfanos en directorios globales genéricos.
- [ ] **Presentation Limpia**: Los controladores y server actions no contienen lógica de cálculo de negocio, queries complejas directas ni mutaciones sin caso de uso.
- [ ] **Application Representativa**: Los casos de uso representan intenciones del usuario o del sistema con nombres de acción claros.
- [ ] **Dominio Libre de Framework**: Ningún archivo dentro de `domain/` importa paquetes de `@nestjs`, `prisma`, `@prisma/client`, `express`, `next` ni `react`.
- [ ] **Infraestructura Aislada**: Los clientes de base de datos (Prisma), clientes HTTP externos y brokers de colas residen en adaptadores de infraestructura.
- [ ] **Aislamiento Multi-Tenant**: Toda query y mutación exige y valida el `tenant_id` proveniente de la sesión autenticada.
- [ ] **Dependency Injection**: No existen instancias creadas mediante `new ConcreteService()` dentro de casos de uso; se inyectan abstracciones o puertos mediante constructores o tokens de NestJS.
- [ ] **Validación Perimetral**: Todo endpoint valida payloads mediante DTOs tipados (Pipes con Zod o Standard Schema).
- [ ] **Mapeo de Errores RFC 9457**: Los errores de negocio se traducen en `ApiExceptionFilter` produciendo respuestas estructuradas con `type`, `title`, `status` y `detail`.
- [ ] **Observabilidad**: Los logs estructurados contienen `requestId` y `tenantId` automáticamente mediante `AsyncLocalStorage`.
- [ ] **Testing Piramidal**: Cobertura unitaria para reglas puras de dominio y casos de uso con mocks/stubs; tests de integración reales con base de datos para repositorios de infraestructura.

---

## 5. Ecosistema de Herramientas y Perfiles

### 5.1. Perfil A — Node.js Puro / Express / Fastify

Node.js proporciona el modelo de ejecución concurrente asíncrono, pero no impone estructura de software. La composición y el ciclo de vida son responsabilidad directa de la arquitectura del proyecto.

#### Estructura Canónica

```text
src/
├── app.ts                      # Configuración de Express/Fastify, middleware y rutas
├── server.ts                   # Bootstrap de infraestructura, puertos y graceful shutdown
│
├── bootstrap/
│   ├── container.ts            # Composition Root: instanciación e inyección manual
│   └── shutdown.ts             # Cierre coordinado de pools de DB y servidores
│
├── config/
│   └── env.ts                  # Validación fail-fast de variables de entorno con Zod
│
├── modules/
│   └── testimonials/
│       ├── presentation/
│       │   ├── testimonials.routes.ts
│       │   └── testimonials.controller.ts
│       ├── application/
│       │   ├── approve-testimonial.use-case.ts
│       │   └── get-testimonials.query.ts
│       ├── domain/
│       │   ├── testimonial.entity.ts
│       │   └── testimonial.repository.ts   # Interfaz / Puerto
│       ├── infrastructure/
│       │   └── prisma-testimonial.repository.ts # Adaptador concreto
│       └── schemas/
│           └── testimonial.schema.ts
│
└── shared/
    ├── errors/                 # Jerarquía base de errores (DomainError, NotFoundError)
    └── observability/          # AsyncLocalStorage, Pino logger
```

#### Separación Crítica: `app.ts` vs `server.ts`

- **`app.ts`**: Crea la aplicación web, registra middlewares globales, mapea controladores y define el manejador global de errores. **No llama a `listen()`** ni escucha señales del sistema operativo (`SIGTERM`). Esto permite que los tests de integración importen `app` y utilicen `supertest` sin abrir puertos de red.
- **`server.ts`**: Punto de entrada de producción. Conecta a PostgreSQL y Redis, inicia el servidor HTTP mediante `app.listen()` y gestiona el ciclo de vida y apagado controlado (*graceful shutdown*).

#### Composición Manual y Functional Core / Imperative Shell

En Node.js puro, la inyección manual por constructores o fábricas funcionales es la solución idiomática más simple y eficiente:

```typescript
// bootstrap/container.ts — Composition Root Explícito
import { PrismaClient } from '@prisma/client';
import { PrismaTestimonialRepository } from '../modules/testimonials/infrastructure/prisma-testimonial.repository';
import { ApproveTestimonialUseCase } from '../modules/testimonials/application/approve-testimonial.use-case';
import { TestimonialsController } from '../modules/testimonials/presentation/testimonials.controller';

export function createContainer(prisma: PrismaClient) {
  // 1. Infraestructura
  const testimonialRepository = new PrismaTestimonialRepository(prisma);

  // 2. Aplicación
  const approveTestimonialUseCase = new ApproveTestimonialUseCase(testimonialRepository);

  // 3. Presentación
  const testimonialsController = new TestimonialsController(approveTestimonialUseCase);

  return {
    testimonialsController,
    testimonialRepository,
  };
}
```

---

### 5.2. Perfil B — NestJS (Adaptado a `apps/api`)

NestJS provee un contenedor de Inversión de Control (IoC), sistema modular, decoradores y un pipeline HTTP integral (Pipes, Guards, Interceptors, Filters).

```text
apps/api/src/
├── main.ts                     # Bootstrap, Swagger, Global Pipes & Filters
├── app.module.ts               # Módulo raíz que ensambla módulos de dominio
│
├── common/
│   ├── filters/
│   │   └── api-exception.filter.ts  # RFC 9457 Problem Details Mapper
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        # Autenticación perimetral
│   │   └── roles.guard.ts           # RBAC coarse-grained
│   ├── interceptors/
│   │   └── logging.interceptor.ts   # Correlación y métricas de latencia
│   └── observability/
│       └── request-context.service.ts # AsyncLocalStorage
│
└── modules/
    └── testimonials/
        ├── testimonials.module.ts   # Boundary modular y Composition Root
        │
        ├── presentation/
        │   ├── testimonials.controller.ts
        │   └── dto/
        │       ├── create-testimonial.dto.ts
        │       └── approve-testimonial.dto.ts
        │
        ├── application/
        │   ├── approve-testimonial.use-case.ts
        │   └── list-testimonials.use-case.ts
        │
        ├── domain/
        │   ├── testimonial.entity.ts
        │   ├── testimonial-status.vo.ts
        │   └── testimonial.repository.interface.ts
        │
        └── infrastructure/
            ├── persistence/
            │   └── prisma-testimonial.repository.ts
            └── outbox/
                └── bullmq-outbox.dispatcher.ts
```

#### Nest Module como Composition Boundary y Public API

El archivo `testimonials.module.ts` define los límites del módulo y encapsula sus implementaciones privadas:

```typescript
// apps/api/src/modules/testimonials/testimonials.module.ts
import { Module } from '@nestjs/common';
import { TestimonialsController } from './presentation/testimonials.controller';
import { ApproveTestimonialUseCase } from './application/approve-testimonial.use-case';
import { TESTIMONIAL_REPOSITORY } from './domain/testimonial.repository.interface';
import { PrismaTestimonialRepository } from './infrastructure/persistence/prisma-testimonial.repository';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [TestimonialsController],
  providers: [
    ApproveTestimonialUseCase,
    {
      provide: TESTIMONIAL_REPOSITORY,
      useClass: PrismaTestimonialRepository,
    },
  ],
  // Exportar únicamente los casos de uso que otros módulos tienen permitido invocar
  exports: [ApproveTestimonialUseCase],
})
export class TestimonialsModule {}
```

#### Tokens de Inyección en Runtime con `Symbol`

Dado que las interfaces de TypeScript se eliminan durante la compilación a JavaScript, no pueden usarse como tokens de inyección de dependencias en runtime. Se debe definir un `Symbol` o constante explícita:

```typescript
// domain/testimonial.repository.interface.ts
export const TESTIMONIAL_REPOSITORY = Symbol('TESTIMONIAL_REPOSITORY');

export interface TestimonialRepository {
  findById(id: string, tenantId: string): Promise<TestimonialEntity | null>;
  save(testimonial: TestimonialEntity): Promise<void>;
  findPending(tenantId: string): Promise<TestimonialEntity[]>;
}
```

Y su consumo en la capa de aplicación:

```typescript
// application/approve-testimonial.use-case.ts
import { Injectable, Inject } from '@nestjs/common';
import { TESTIMONIAL_REPOSITORY, TestimonialRepository } from '../domain/testimonial.repository.interface';
import { TestimonialNotFoundError } from '../domain/errors/testimonial-not-found.error';

@Injectable()
export class ApproveTestimonialUseCase {
  constructor(
    @Inject(TESTIMONIAL_REPOSITORY)
    private readonly repository: TestimonialRepository,
  ) {}

  async execute(command: { id: string; tenantId: string; moderatorId: string }): Promise<void> {
    const testimonial = await this.repository.findById(command.id, command.tenantId);
    if (!testimonial) {
      throw new TestimonialNotFoundError(command.id, command.tenantId);
    }

    // Regla de dominio: mutación de estado encapsulada con invariantes
    testimonial.approve(command.moderatorId);

    await this.repository.save(testimonial);
  }
}
```

#### Controlador NestJS Delgado

El controlador sólo conoce el protocolo HTTP y delega la ejecución:

```typescript
// presentation/testimonials.controller.ts
import { Controller, Patch, Param, Body, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApproveTestimonialUseCase } from '../application/approve-testimonial.use-case';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { CurrentTenant } from '../../../common/decorators/current-tenant.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@Controller('testimonials')
@UseGuards(JwtAuthGuard)
export class TestimonialsController {
  constructor(private readonly approveTestimonial: ApproveTestimonialUseCase) {}

  @Patch(':id/approve')
  @HttpCode(HttpStatus.NO_CONTENT)
  async approve(
    @Param('id') id: string,
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') moderatorId: string,
  ): Promise<void> {
    await this.approveTestimonial.execute({ id, tenantId, moderatorId });
  }
}
```

#### Reglas de los Componentes NestJS

1. **Pipes**: Usar exclusivamente para parsing y validación de tipos y esquemas de entrada en la frontera.
2. **Guards**: Limitar a autenticación perimetral (validación JWT) y chequeo grueso de roles (`admin`, `editor`). La autorización fina basada en reglas de negocio (ej. *"sólo el autor puede editar su testimonio si sigue en estado pendiente"*) pertenece al caso de uso o a la entidad de dominio.
3. **Interceptors**: Utilizar para preocupaciones transversales (medición de tiempos, logs estructurados, correlación `traceId`, envoltura de respuestas). Nunca para reglas de negocio.
4. **Exception Filters**: Centralizar el mapeo de excepciones internas a respuestas HTTP conformes a RFC 9457 Problem Details.
5. **No al uso indiscriminado de `@Global()`**: Cada módulo debe declarar explícitamente sus dependencias en `imports`, manteniendo el grafo de dependencias auditable.

---

### 5.3. Perfil C — Next.js App Router (Adaptado a `apps/web`)

Next.js 15 App Router introduce un paradigma de renderizado híbrido Server-First. No se debe forzar mecánicamente la estructura `Controller/Service/Repository` del backend en el cliente web.

#### Estructura Canónica en `apps/web`

```text
apps/web/src/
├── app/                        # Routing, layouts, page composition, boundaries
│   ├── layout.tsx
│   ├── page.tsx
│   └── dashboard/
│       └── testimonials/
│           ├── page.tsx        # Server Component (Data Fetching & Page Shell)
│           ├── loading.tsx     # Suspense Fallback
│           └── error.tsx       # Error Boundary
│
├── features/                   # Screaming Architecture por funcionalidad
│   └── testimonials/
│       ├── components/
│       │   ├── testimonial-card.tsx
│       │   ├── testimonial-list.tsx
│       │   └── testimonial-approve-button.tsx # Client Island ('use client')
│       ├── hooks/
│       │   └── use-testimonial-filters.ts
│       ├── api/
│       │   └── testimonials.client.ts   # Contratos con NestJS API
│       ├── schemas/
│       │   └── testimonial.schema.ts    # Zod schemas compartidos
│       └── types/
│           └── index.ts
│
├── shared/
│   ├── components/ui/          # Radix UI + Tailwind design system
│   ├── lib/                    # cn(), formatters, client utilities
│   └── api/                    # HTTP client base con manejo de auth cookies
│
└── server/                     # Data Access Layer (DAL) para Next.js Full-Stack
    ├── db/                     # Prisma (si accede directamente en server components)
    └── services/               # server-only business logic
```

#### Server Components como Predeterminado y Client Islands

- **Server Components**: Son el predeterminado en App Router. Tienen acceso directo a variables de entorno secretas y llamadas seguras de backend sin exponer lógica al navegador.
- **Client Components (`'use client'`)**: Deben restringirse a las hojas del árbol de componentes (*Client Islands*) donde se requiera interactividad (estado de React, listeners de eventos, hooks del navegador).

```tsx
// features/testimonials/components/testimonial-approve-button.tsx
'use client';

import { useTransition } from 'react';
import { Button } from '@/shared/components/ui/button';
import { approveTestimonialAction } from '../actions/approve-testimonial.action';

interface ApproveButtonProps {
  testimonialId: string;
}

export function TestimonialApproveButton({ testimonialId }: ApproveButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleApprove = () => {
    startTransition(async () => {
      await approveTestimonialAction(testimonialId);
    });
  };

  return (
    <Button onClick={handleApprove} disabled={isPending} variant="default" size="sm">
      {isPending ? 'Aprobando...' : 'Aprobar Testimonio'}
    </Button>
  );
}
```

#### Reglas de Oro para Next.js en Arquitectura por Capas

1. **Frontend-Only con Backend NestJS Externo**: Si Next.js consume la API de NestJS (`apps/api`), la capa `features/<feature>/api/` encapsula los llamados HTTP mediante `fetch` tipado con validación Zod.
2. **Prohibido invocar `localhost` vía HTTP a la misma aplicación**: Si una funcionalidad corre dentro del mismo runtime de Next.js, no debe crear un `Route Handler` para luego llamarlo con `fetch('http://localhost:3000/api/...')` desde un Server Component. Debe invocar directamente la función del servicio o DAL en el servidor.
3. **Protección con `server-only`**: Cualquier archivo que interactúe con base de datos, secrets o APIs internas debe incluir `import 'server-only'` para que el compilador impida su inclusión accidental en bundles de cliente.

---

## 6. Metodología de Práctica en 15 Fases

Toda implementación o refactorización arquitectónica debe seguir rigurosamente este flujo:

```text
[Fase 01: Identificar Dominios/Features]
                 │
                 ▼
[Fase 02: Identificar Casos de Uso]
                 │
                 ▼
[Fase 03: Definir Fronteras de Entrada]
                 │
                 ▼
[Fase 04: Diseñar Application Layer]
                 │
                 ▼
[Fase 05: Extraer Dominio si Existen Reglas]
                 │
                 ▼
[Fase 06: Diseñar Puertos Necesarios]
                 │
                 ▼
[Fase 07: Implementar Infrastructure Adapters]
                 │
                 ▼
[Fase 08: Ensamblar Composition Root]
                 │
                 ▼
[Fase 09: Configurar Validación Perimetral]
                 │
                 ▼
[Fase 10: Modelar Errores de Negocio]
                 │
                 ▼
[Fase 11: Implementar Mapeo de Errores HTTP]
                 │
                 ▼
[Fase 12: Delimitar Fronteras Transaccionales]
                 │
                 ▼
[Fase 13: Instrumentar Observabilidad Exterior]
                 │
                 ▼
[Fase 14: Auditar Reglas de Arquitectura]
                 │
                 ▼
[Fase 15: Ejecutar Pirámide de Tests]
```

### Fase 1: Identificar Dominios y Features
Antes de crear carpetas técnicas, listar las funcionalidades de negocio (`testimonials`, `auth`, `webhooks`, `tenants`, `analytics`). Evitar organizar inicialmente por carpetas globales `controllers/` o `services/`.

### Fase 2: Identificar Casos de Uso Concretos
Desglosar las operaciones del módulo en acciones con intención:
- `CreateTestimonial`
- `ApproveTestimonial`
- `RejectTestimonial`
- `CalculateTenantSocialProofScore`

### Fase 3: Definir Fronteras de Entrada
Determinar qué canales disparan la operación: HTTP REST Controller, Server Action de Next.js, Worker BullMQ o Webhook Provider.

### Fase 4: Diseñar la Capa de Aplicación
Crear clases o funciones dedicadas con nombre representativo (ej. `approve-testimonial.use-case.ts`), evitando acumular 3.000 líneas en un único `testimonials.service.ts` omnisciente.

### Fase 5: Extraer Dominio Sólo si Existen Reglas Reales
Evaluar si existen reglas independientes de persistencia y transporte. Si el flujo es un CRUD directo, delegar a persistencia sin forzar clases de dominio ceremoniales. Si hay transiciones de estado e invariantes, modelar entidades ricas.

### Fase 6: Diseñar Puertos / Interfaces Necesarios
Definir abstracciones para las dependencias requeridas por el caso de uso (`TestimonialRepository`, `NotificationSender`, `MediaStorage`).

### Fase 7: Implementar Adaptadores de Infraestructura
Crear las implementaciones concretas que interactúan con tecnologías externas: `PrismaTestimonialRepository`, `CloudinaryMediaStorage`, `BullMqOutboxDispatcher`.

### Fase 8: Configurar el Composition Root
Conectar las abstracciones con sus adaptadores concretos en el módulo (`testimonials.module.ts` en NestJS o `container.ts` en Node.js puro).

### Fase 9: Validación Perimetral
Configurar DTOs y esquemas Zod en la capa de presentación para que ningún dato no validado alcance la capa de aplicación.

### Fase 10: Modelar Errores de Negocio
Crear subclases de error explícitas (`TestimonialNotFoundError`, `InvalidStatusTransitionError`) sin referencias a códigos HTTP.

### Fase 11: Mapear Errores a Transporte
Configurar en la capa de presentación los Exception Filters necesarios para mapear las excepciones de negocio a respuestas estandarizadas RFC 9457.

### Fase 12: Delimitar Transacciones
Enriquecer casos de uso que requieran atomicidad (ej. mutar testimonio y registrar mensaje en tabla Outbox) encapsulándolos en transacciones de base de datos (`prisma.$transaction`).

### Fase 13: Instrumentar Observabilidad en Outer Layers
Añadir logging estructurado, correlación mediante `AsyncLocalStorage` y métricas en interceptores y middlewares, sin ensuciar la lógica de negocio.

### Fase 14: Auditar Reglas de Arquitectura
Verificar con linters o herramientas de análisis de dependencias que no existan ciclos ni violaciones de capas (ej. capas internas importando infraestructura).

### Fase 15: Implementar Pirámide de Pruebas
1. Tests unitarios rápidos para lógica pura de dominio y casos de uso con dependencias mockeadas en memoria.
2. Tests de integración con base de datos real (PostgreSQL en Docker) para adaptadores de infraestructura.
3. Tests E2E para flujos críticos de la API.

---

## 7. Catálogo de Antipatrones (LAYER-01 a LAYER-30)

| Código | Antipatrón | Riesgo / Consecuencia | Remediación Arquitectónica |
| :--- | :--- | :--- | :--- |
| **LAYER-01** | **Estructura global por controllers/services** | Dispersión de archivos, acoplamiento difuso entre dominios y fricción en merges. | Adoptar Feature-First (`src/modules/<feature>/`). |
| **LAYER-02** | **Carpetas vacías por convención ciega** | Complejidad accidental y navegación innecesaria sin valor técnico. | Crear carpetas (`domain/`, `ports/`) sólo cuando contengan código real. |
| **LAYER-03** | **DDD ceremonial para CRUD trivial** | Sobrecarga de código, mappers inútiles y lentitud de desarrollo. | Utilizar flujo directo Controller → Service/Query → ORM. |
| **LAYER-04** | **Interface para cada clase sin justificación** | Indirección innecesaria donde sólo existe y existirá una única implementación. | Crear interfaces únicamente cuando se requiera inversión de dependencias o tests aislados. |
| **LAYER-05** | **Controlador con lógica de negocio** | Imposibilidad de reutilizar reglas en otros canales (workers, CLIs, webhooks). | Mover la lógica a un caso de uso u orquestador en `application/`. |
| **LAYER-06** | **Repositorio con reglas de negocio** | Reglas dispersas en SQL o queries de Prisma difíciles de testear unitariamente. | Dejar al repositorio únicamente la persistencia; evaluar reglas en la entidad o use case. |
| **LAYER-07** | **ORM Model como Response DTO universal** | Fuga accidental de datos sensibles (`tenant_id`, `password_hash`, tokens). | Mapear explícitamente a un DTO de respuesta en la capa de presentación. |
| **LAYER-08** | **Objetos `Request`/`Response` dentro del dominio** | Acoplamiento absoluto al transporte HTTP; imposibilidad de probar sin emular HTTP. | Pasar exclusivamente primitivos o DTOs limpios a casos de uso y dominio. |
| **LAYER-09** | **`HttpException` lanzada desde el dominio** | Dominio acoplado a semántica web. | Lanzar errores tipados de dominio y mapearlos en Exception Filters. |
| **LAYER-10** | **Acceso global directo a Prisma desde cualquier archivo** | Imposibilidad de auditar transacciones, cache o aislamiento multi-tenant. | Centralizar consultas en el servicio de persistencia del módulo correspondiente. |
| **LAYER-11** | **Imports directos a submódulos privados de otra feature** | Acoplamiento espagueti y ruptura de los límites modulares. | Consumir únicamente la API pública expuesta por el módulo (`exports` o `index.ts`). |
| **LAYER-12** | **`shared/` o `common/` como vertedero** | Pérdida de cohesión y creación de dependencias circulares invisibles. | Exigir justificación estricta: sólo código agnóstico al dominio puede ser compartido. |
| **LAYER-13** | **`common/` con lógica de dominio** | Fragmentación de las reglas de negocio fuera de sus módulos naturales. | Retornar la regla al módulo al que pertenece conceptualmente. |
| **LAYER-14** | **Service genérico monolítico de 3.000 líneas** | Clase Dios inmanejable, conflictos constantes de Git y tests frágiles. | Dividir en casos de uso atómicos por intención (`approve`, `create`, `list`). |
| **LAYER-15** | **Repository genérico CRUD como abstracción universal** | Abstracción con fugas que limita las capacidades del motor relacional y Prisma. | Diseñar repositorios específicos para las necesidades del modelo de dominio. |
| **LAYER-16** | **Mappers obligatorios para modelos idénticos** | Pérdida de rendimiento y boilerplate inútil. | Retornar el modelo directamente si no hay transformación ni divergencia de contrato. |
| **LAYER-17** | **DI container manual montado encima de NestJS** | Redundancia, confusión operativa y conflicto de ciclos de vida. | Aprovechar el contenedor nativo de `@nestjs` y sus providers. |
| **LAYER-18** | **Declarar todos los módulos de NestJS como `@Global()`** | Destrucción de la modularidad y dependencias invisibles. | Importar explícitamente los módulos necesarios en cada `Module`. |
| **LAYER-19** | **Inyección de interfaces TypeScript sin token en runtime** | NestJS lanza error en runtime (`Cannot resolve dependency`). | Utilizar `@Inject(SYMBOL_TOKEN)` para inyectar implementaciones de interfaces. |
| **LAYER-20** | **Guards conteniendo todas las reglas de negocio** | Reglas de negocio atrapadas en la capa de transporte HTTP. | Limitar Guards a autenticación y autorización perimetral; delegar reglas al use case. |
| **LAYER-21** | **Interceptors ejecutando mutaciones de dominio** | Efectos colaterales ocultos fuera del flujo transaccional principal. | Restringir Interceptors a preocupaciones de observabilidad, timing y logging. |
| **LAYER-22** | **`'use client'` colocado en la raíz de toda la página Next.js** | Pérdida total de los beneficios de SSR, aumento masivo del bundle JS y waterfalls. | Mantener las páginas como Server Components y crear islas de cliente pequeñas. |
| **LAYER-23** | **Llamada HTTP a `localhost` desde un Server Component propio** | Overhead innecesario de red local, serialización JSON y consumo de sockets. | Invocar directamente la función de base de datos o servicio en el servidor. |
| **LAYER-24** | **Prisma o secretos de DB importados en Client Components** | Fuga crítica de credenciales de base de datos al navegador del usuario. | Aislar el acceso a datos en el servidor y proteger módulos con `import 'server-only'`. |
| **LAYER-25** | **Feature-Sliced Design (FSD) hiperceremonial en proyectos simples** | Fatiga cognitiva y sobrecarga de carpetas sin escala que lo justifique. | Usar estructura pragmática `app/` + `features/` + `shared/`. |
| **LAYER-26** | **Monorepo concebido como requisito obligatorio de capas** | Complejidad de tooling sin necesidad real. | La arquitectura por capas se sostiene perfectamente dentro de un único paquete bien estructurado. |
| **LAYER-27** | **Compartir entidades ORM entre backend y frontend** | Rompe el encapsulamiento de persistencia e introduce tipos acoplados a la DB en el cliente. | Compartir únicamente contratos DTO o schemas de validación (Zod). |
| **LAYER-28** | **Mocks para todo y cero integration tests** | Tests unitarios que pasan pero el sistema falla en producción con PostgreSQL real. | Balancear pirámide: usar mocks para use cases y PostgreSQL real para integración. |
| **LAYER-29** | **Arquitectura documentada pero no verificada por tooling** | Degradación paulatina de los límites por imports prohibidos. | Implementar ESLint boundaries o tests de arquitectura (`dependency-cruiser`). |
| **LAYER-30** | **Abstracción prematura antes de que exista razón de cambio** | Código complejo que resuelve problemas inexistentes (violación de YAGNI). | Seguir la regla de tres: abstraer sólo cuando el segundo o tercer adaptador lo demanden. |

---

## 8. Evaluación y KPIs de Calidad Arquitectónica

### 8.1. Integridad de Límites

| Métrica | Meta | Método de Medición |
| :--- | :--- | :--- |
| **Imports de frameworks en `domain/`** | **0** | Regla de ESLint `no-restricted-imports` auditando la carpeta `domain/`. |
| **Imports ilegales entre submódulos privados** | **0** | Auditoría con `dependency-cruiser` o ESLint boundary plugins. |
| **Ciclos de dependencia circulares** | **0** | `npx madge --circular apps/api/src apps/web/src`. |
| **Controladores con acceso directo a Prisma/DB** | **0** | Auditoría de imports en `*.controller.ts`. |
| **Secretos o clientes de DB en Client Components** | **0** | Verificación en build de Next.js y análisis estático de bundles. |
| **Filtro `tenant_id` omitido en queries de persistencia** | **0** | Revisión estricta de código y tests de aislamiento multi-tenant. |

### 8.2. Testeabilidad y Mantenibilidad

- **Casos de uso ejecutables sin transporte HTTP**: 100% de los casos de uso deben contar con pruebas unitarias pasando dependencias stub/mock en memoria.
- **Reglas de dominio aisladas de infraestructura**: Las pruebas de entidades y value objects deben ejecutarse en milisegundos sin I/O ni contenedores.
- **Trazabilidad de requests críticas**: 100% de las solicitudes HTTP y mensajes de cola procesados deben contar con `requestId` / `tenantId` en logs estructurados.
- **Dependencias remotas con timeout explícito**: 100% de las integraciones externas (Cloudinary, webhooks, Redis) deben configurar timeouts defensivos y manejo de errores.

---

## 9. Recursos Adicionales, Checklists y Reglas de Decisión

### 9.1. Árbol de Decisión: ¿Cuántas capas necesito?

```text
¿La funcionalidad consiste únicamente en un CRUD simple con filtros estándar?
│
├── SÍ  ──► [ARQUITECTURA DE 3 CAPAS]
│           Presentation (Controller / Route)
│                ↓
│           Application (Service / Query Handler)
│                ↓
│           Persistence / ORM (Prisma directo con validación de tenant_id)
│
└── NO  ──► ¿Existen invariantes ricas, múltiples estados o reglas independientes de DB?
            │
            ├── SÍ  ──► [ARQUITECTURA DE 4 CAPAS COMPLETA]
            │           Presentation (Controller / Action)
            │                ↓
            │           Application (Use Cases / Command Handlers)
            │                ↓
            │           Domain (Entities, Value Objects, Pure Invariants)
            │                ↑ (implementa interfaces / ports)
            │           Infrastructure (Repositories, Prisma, External APIs)
            │
            └── NO  ──► Mantener el caso de uso en Application orquestando directamente
                        los adaptadores de persistencia sin crear entidades de dominio ceremoniales.
```

---

### 9.2. Matriz de Conceptos por Framework

| Concepto Arquitectónico | Perfil Node.js Puro | Perfil NestJS 11 (`apps/api`) | Perfil Next.js 15 (`apps/web`) |
| :--- | :--- | :--- | :--- |
| **Composition Root** | `bootstrap/container.ts` | `*.module.ts` de NestJS | Server Component tree & `server/` composition |
| **Dependency Injection** | Manual / Factories funcionales | Contenedor IoC nativo con tokens `Symbol` | Inyección por parámetros en Server Components |
| **Presentation Layer** | Express/Fastify Router + Controller | `@Controller()` NestJS con DTOs | App Router (`page.tsx`, `actions`, `components`) |
| **Application Layer** | Clases Use Case o funciones comando | Clases `@Injectable()` Use Case | Server Actions o funciones de servicio en `server/` |
| **Domain Layer** | Clases / funciones puras TypeScript | Clases / funciones puras TypeScript | Modelos de interfaz o reglas de cliente (si aplica) |
| **Infrastructure Layer** | Adaptadores DB/HTTP implementando ports | `@Injectable()` Providers (`PrismaRepository`) | Data Access Layer (DAL) con `import 'server-only'` |
| **Validación Perimetral** | Zod middleware en rutas | `ValidationPipe` / Standard Schema | Zod en Server Actions y formulación client-side |
| **Error Mapping** | Error Middleware global | `ApiExceptionFilter` (RFC 9457) | `error.tsx` boundaries & serialización de actions |
| **Context Propagation** | `AsyncLocalStorage` nativo | `AsyncLocalStorage` en Interceptor/Service | React `cache()` / request scope en servidor |

---

### 9.3. Checklists Operativos por Capa

#### Checklist — Controller / Presentation
- [ ] Sólo conoce detalles del transporte (HTTP, rutas, códigos de estado, cookies).
- [ ] La entrada se valida perimetralmente antes de invocar la lógica.
- [ ] No ejecuta consultas SQL ni invoca métodos de Prisma directamente.
- [ ] No contiene bifurcaciones complejas de cálculo de negocio.
- [ ] Invoca una única operación o caso de uso de aplicación.
- [ ] Mapea la respuesta o delega el error al filtro correspondiente.

#### Checklist — Use Case / Application
- [ ] Su nombre denota una intención de negocio explícita (verbo + sustantivo).
- [ ] No recibe objetos `Request` ni `Response` de Express ni decoradores de transporte.
- [ ] Sus dependencias externas son explícitas y se reciben en el constructor.
- [ ] Modela y lanza errores tipados representativos del dominio.
- [ ] Gestiona la frontera transaccional cuando la operación requiere atomicidad.
- [ ] Asegura que el `tenant_id` se propague a todas las operaciones subyacentes.

#### Checklist — Domain (si existe)
- [ ] Es código TypeScript puro: cero imports de infraestructura, frameworks u ORMs.
- [ ] Las invariantes se protegen dentro de los métodos de la entidad o Value Object.
- [ ] No puede crearse una entidad en un estado inconsistente o inválido.
- [ ] Se prueba unitariamente en memoria en milisegundos.

#### Checklist — Repository / Persistence
- [ ] Encapsula los detalles de acceso a PostgreSQL y Prisma.
- [ ] Toda consulta o mutación exige obligatoriamente el parámetro `tenant_id`.
- [ ] Oculta la complejidad de joins, transacciones y optimizaciones de consultas.
- [ ] Cuenta con pruebas de integración contra una base de datos real en CI.

---

### 9.4. Cheat Sheet — Las 30 Reglas de Oro

1. **Organizá primero por feature**: La cohesión funcional supera a la agrupación por tipo técnico.
2. **Las capas son fronteras de responsabilidad**, no carpetas ceremoniales obligatorias.
3. **El controlador sólo conoce el transporte**: Nunca decide reglas de negocio.
4. **El caso de uso expresa intención**: Un archivo por cada intención clara del sistema.
5. **El dominio sólo existe si hay reglas reales**: No crees entidades vacías para simples CRUDs.
6. **La infraestructura implementa detalles**: La base de datos y la red son periféricos sustituibles.
7. **La dirección de dependencias es inmutable**: El núcleo nunca depende de las capas externas.
8. **Nunca pases `req` o `res` al dominio ni a los casos de uso**.
9. **Nunca expongas entidades del ORM como DTOs públicos de transporte**.
10. **Validá estrictamente en la frontera**: Entrada inválida jamás debe cruzar el controlador.
11. **Persistí invariantes también en la base de datos**: Usa constraints de DB además de validaciones de código.
12. **El patrón Repository no es obligatorio en CRUDs simples**.
13. **Los mappers no son obligatorios si los modelos son estructuralmente idénticos**.
14. **En Node.js puro, la composición manual es superior a containers mágicos complejos**.
15. **En NestJS, aprovechá el contenedor IoC nativo**: No inventes contenedores paralelos.
16. **El módulo de NestJS es la frontera y el Composition Root de la feature**.
17. **Las interfaces en NestJS requieren tokens `Symbol` en runtime**.
18. **Evitá `@Global()` en NestJS**: Declará explícitamente las dependencias de cada módulo.
19. **En Next.js App Router, los Server Components son el predeterminado**.
20. **Usá `'use client'` únicamente para definir islas de interactividad**.
21. **En Next.js Server Components, accedé al DAL directamente sin llamadas HTTP a `localhost`**.
22. **Protegé el código de base de datos en Next.js con `import 'server-only'`**.
23. **El directorio `shared/` no es un vertedero**: Sólo aloja código reutilizable agnóstico al negocio.
24. **Protegé las fronteras arquitectónicas con reglas de linter automatizadas**.
25. **Los tests de dominio y use cases deben correr sin levantar servidores web**.
26. **Los adaptadores de base de datos requieren pruebas de integración reales**.
27. **La observabilidad (logs, métricas, tracing) reside en las capas exteriores**.
28. **El principio YAGNI aplica estrictamente a la arquitectura**: No abstraigas prematuramente.
29. **Extraé una capa únicamente cuando exista una razón concreta para que evolucione independientemente**.
30. **El aislamiento multi-tenant por `tenant_id` es no negociable en todas las capas**.

---

### 9.5. Regla Rectora Final y Resultado Esperado

```text
FEATURE
│
├── PRESENTATION  (Transport, DTOs, HTTP/UI Context)
│        ↓
├── APPLICATION   (Use Cases, Workflows, Orchestration, Transaction Boundary)
│        ↓
├── DOMAIN        (Pure Invariants, State Transitions — Opcional según complejidad)
│        ▲
└── INFRASTRUCTURE (Prisma, PostgreSQL, Redis, BullMQ, External APIs — Implementa contratos)
```

Construir software bajo **SKL-ARCH-LAYERED-001** asegura que:
- **Node.js, NestJS y Next.js sean herramientas de soporte** para la entrega de valor, no restricciones que condicionen la lógica del negocio.
- **Cada feature tenga ownership claro**, límites explícitos y contratos transparentes.
- **La persistencia, el transporte y la infraestructura puedan evolucionar, optimizarse o sustituirse** sin requerir la reescritura de las reglas de negocio de la aplicación.
