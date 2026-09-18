---
name: node-backend-engineering
description: >-
  Diseño, construcción, optimización y operación profesional de backends Node.js en producción (código SKL-NODE-BACKEND-001). Usar cuando se requiera diseñar arquitecturas Modular Monolith Feature-Oriented, gobernar el modelo de ejecución de Node.js (Event Loop, libuv Worker Pool, Worker Threads), implementar patrones de resiliencia (timeouts, exponential backoff con jitter, circuit breakers, bulkhead, backpressure), persistencia relacional con PostgreSQL 18 y Prisma ORM con aislamiento multi-tenant estricto, colas durables con BullMQ y Redis 7, observabilidad de producción con AsyncLocalStorage, Pino y OpenTelemetry, seguridad OWASP y graceful shutdown con Node 24 LTS.
---

# Especificación Técnica de Habilidad: Senior Node.js Backend Engineering

---

**Código de Skill:** SKL-NODE-BACKEND-001  
**Nombre:** Senior Node.js Backend Engineering  
**Versión:** 1.0.0  
**Nivel:** Senior / Production Engineering  
**Dominio:** Node.js / Backend / APIs / Workers / Distributed Systems  
**Runtime recomendado:** Node.js LTS soportado  
**Baseline 2026:** Node.js 24 LTS+  
**Lenguaje preferido:** TypeScript (Strict Mode)  
**Arquitectura base:** Modular Monolith + Feature-Oriented  
**Paradigma base:** Event-Driven Runtime + Functional Core / Imperative Shell  
**Estándares:** Node.js Best Practices / OWASP API Security / Twelve-Factor App / OpenTelemetry / SOLID / DRY / KISS / YAGNI / Agile Definition of Done  
**Ecosistema del proyecto:** NestJS 11, Prisma 6.5+, PostgreSQL 18, BullMQ, Redis 7, Multi-tenant Row-Level Isolation (`tenant_id`)

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, construcción, optimización, seguridad y operación profesional de backends Node.js en entornos productivos de alta concurrencia. |
| **Objetivo** | Construir servicios robustos, escalables, trazables, seguros y mantenibles aprovechando al máximo el modelo de ejecución no bloqueante de Node.js. |
| **Arquitectura Default** | Modular Monolith (1 repositorio, 1 artefacto desplegable, límites modulares estrictos por bounded context). |
| **Arquitectura Interna** | Feature-Oriented con capas pragmáticas (Transport → Application / Use Cases → Domain → Infrastructure / Repositories). |
| **Modelo de Ejecución** | Event Loop cooperativo + Asynchronous Non-blocking I/O (epoll / kqueue / IOCP). |
| **Paralelismo de CPU** | `node:worker_threads` (Worker Pool acotado) o procesos worker dedicados para tareas CPU-bound pesadas. |
| **Escalado** | Escalado horizontal sin estado (Stateless Horizontal Scaling) detrás de Load Balancers y contenedores. |
| **Observabilidad** | Structured JSON Logs (Pino) + RED Metrics & Event Loop Lag + Distributed Tracing (OpenTelemetry) + Request Context (`AsyncLocalStorage`). |
| **Seguridad** | Secure by Design + Least Privilege + Aislamiento multi-tenant estricto por `tenant_id` + Defensas OWASP Top 10. |
| **Testing** | Behavior-oriented (Black-box) + Unit testing de lógica pura + Integration testing con PostgreSQL 18 y Redis reales + E2E crítico. |
| **Complejidad** | Alta / Production Engineering. |
| **Prioridad** | Correctitud → Seguridad → Resiliencia → Observabilidad → Rendimiento → Escalabilidad → Simplicidad. |

---

## 2. Filosofía de Diseño

Node.js no define una arquitectura de negocio ni impone patrones de software empresarial. Define fundamentalmente un **modelo de ejecución en tiempo de ejecución**:

```text
Event-driven
+
Non-blocking I/O
+
Single-Threaded Event Loop (JavaScript Execution)
+
libuv Thread Pool (Internal I/O Offloading)
+
Asynchronous Non-blocking OS APIs
+
Backpressure-aware Streams
+
Worker facilities (Threads & Processes)
```

Por lo tanto, la premisa cardinal de ingeniería establece:

```text
┌────────────────────────────────────────────────────────┐
│        NODE RUNTIME EXECUTION ARCHITECTURE             │
│                         ≠                              │
│           APPLICATION BUSINESS ARCHITECTURE            │
└────────────────────────────────────────────────────────┘
```

La Skill adopta como base arquitectónica de diseño:

```text
MODULAR MONOLITH
+
FEATURE BOUNDARIES (Screaming / Domain-Driven)
+
FUNCTIONAL CORE (Reglas puras, deterministas y testeables)
+
IMPERATIVE SHELL (I/O, Frameworks, Bases de Datos, Colas)
+
EXPLICIT DEPENDENCIES (Dependency Injection desacoplada)
```

---

## 3. Principios Rectores

Toda implementación debe regirse por los siguientes principios:

- **Explicit over implicit:** Las dependencias, configuraciones y flujos de datos deben ser explícitos; evitá magia invisible y variables globales ocultas.
- **Separation of concerns:** Separar claramente transporte (HTTP/WebSocket), orquestación de aplicación, dominio de negocio e infraestructura (DB/Redis).
- **Dependency inversion:** Los módulos de alto nivel no deben depender de detalles de bajo nivel. Ambos deben depender de abstracciones o contratos explícitos.
- **Fail fast:** Validá precondiciones, configuraciones y esquemas en el punto de entrada más temprano posible (bootstrap o request boundary).
- **Fail safe:** Si un componente secundario o dependencia externa falla, el sistema debe degradar su servicio sin comprometer la integridad ni la seguridad.
- **Bounded resource consumption:** Toda estructura de memoria, pool de conexiones, cola de mensajes, payload y nivel de concurrencia debe tener un límite superior explícito.
- **Non-blocking execution:** Ningún callback ejecutado en el Event Loop debe bloquear la CPU por encima del umbral tolerable (< 10 ms).
- **Backpressure:** Controlá activamente la disparidad de velocidad entre productores rápidos y consumidores lentos en streams y colas.
- **Idempotency:** Toda mutación o procesamiento de eventos que pueda ser reintentado debe ser idempotente por diseño.
- **Graceful degradation:** Preferí ofrecer respuestas parciales o cacheadas seguras antes que colapsar el servicio completo.
- **Least privilege:** Los procesos, usuarios de base de datos, credenciales y tokens deben contar exclusivamente con los permisos mínimos necesarios.
- **Defense in depth:** Múltiples capas de validación y control de seguridad; no confíes en que una capa anterior filtró toda amenaza.
- **Observable by design:** Si no podés medir la latencia, los errores, el consumo de memoria y el lag del Event Loop, el sistema no está listo para producción.
- **Stateless processes:** No almacenes sesiones de usuario, bloqueos ni estado crítico en la memoria volátil del proceso Node si el sistema corre en múltiples instancias.
- **KISS & YAGNI:** Diseñá para evolucionar, pero no construyas infraestructura distribuida especulativa antes de que el negocio lo requiera.

---

## 4. Modelo Mental Correcto de Node.js

Es imprescindible erradicar el mito simplista de que *"Node.js es un único hilo haciendo absolutamente todo"*.

El modelo mental preciso de un proceso Node.js en producción es el siguiente:

```text
                               ┌─────────────────────────────────────────┐
                               │             Node.js Process             │
                               └────────────────────┬────────────────────┘
                                                    │
        ┌───────────────────────────────────────────┴──────────────────────────────────────────┐
        │                                                                                      │
        ▼                                           ▼                                          ▼
┌──────────────────────────────┐        ┌──────────────────────────────┐        ┌──────────────────────────────┐
│     V8 Engine / Isolate      │        │       libuv Subsystem        │        │   Optional Parallel Units    │
│  ┌────────────────────────┐  │        │  ┌────────────────────────┐  │        │  ┌────────────────────────┐  │
│  │       Call Stack       │  │        │  │ Non-blocking OS I/O    │  │        │  │ Worker Threads         │  │
│  │ (Single-threaded JS)   │  │        │  │ (epoll / kqueue / IOCP)│  │        │  │ (node:worker_threads)  │  │
│  └───────────┬────────────┘  │        │  │ Sockets, TCP, HTTP     │  │        │  │ CPU-bound isolation    │  │
│              │               │        │  └────────────────────────┘  │        │  └────────────────────────┘  │
│  ┌───────────▼────────────┐  │        │  ┌────────────────────────┐  │        │  ┌────────────────────────┐  │
│  │       Event Loop       │  │        │  │ Default Worker Pool    │  │        │  │ Child Processes        │  │
│  │ (Phases: Timers, Poll, │◄─┼────────┼──┤ (uv_threadpool_size=4) │  │        │  │ (node:child_process)   │  │
│  │  Check, Close, etc.)   │  │        │  │ fs, crypto, dns.lookup,│  │        │  │ Memory / OS isolation  │  │
│  └────────────────────────┘  │        │  │ zlib compression       │  │        │  └────────────────────────┘  │
│                              │        │  └────────────────────────┘  │        │                              │
└──────────────────────────────┘        └──────────────────────────────┘        └──────────────────────────────┘
```

El Event Loop ejecuta el código JavaScript, atiende callbacks y coordina I/O no bloqueante. Operaciones del filesystem (`fs`), cálculo criptográfico costoso (`crypto.pbkdf2`, `scrypt`), compresión (`zlib`) y resolución síncrona de nombres (`dns.lookup`) son derivadas automáticamente por libuv a su Thread Pool interno.

---

## 5. Regla Principal del Runtime

> **REGLA DE ORO DEL RUNTIME:**  
> **No bloquees el Event Loop ni agotes el Worker Pool de libuv.**

Node.js escala eficientemente cuando el trabajo ejecutado por cliente en cada tick del Event Loop es **ultracorto** (medido en microsegundos o pocos milisegundos). Una operación síncrona pesada en el Call Stack principal provoca:
1. Caída drástica del throughput global del servidor.
2. Degradación inmediata de la latencia en percentiles críticos ($p_{95}$ y $p_{99}$).
3. Encolamiento de I/O de todos los demás clientes concurrentes.
4. Vulnerabilidad directa a Denegación de Servicio (ReDoS, parseo de JSON masivo).

La documentación canónica de Node.js clasifica el bloqueo del Event Loop tanto como una falla de rendimiento como un **vector de seguridad crítico**.

---

## 6. I/O-Bound vs CPU-Bound

Toda operación dentro del backend debe categorizarse inequívocamente según su naturaleza:

```text
                                        TIPO DE CARGA
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
             ┌─────────────────┐                             ┌─────────────────┐
             │    I/O-BOUND    │                             │    CPU-BOUND    │
             └────────┬────────┘                             └────────┬────────┘
                      │                                               │
   ┌──────────────────┴──────────────────┐         ┌──────────────────┴──────────────────┐
   │ • Consultas PostgreSQL (Prisma)     │         │ • Compresión pesada / Hashing       │
   │ • Operaciones en Redis              │         │ • Procesamiento de imágenes (Sharp) │
   │ • Llamadas HTTP externas (APIs)     │         │ • Parseo de JSON gigante (> 5MB)    │
   │ • Lectura/Escritura en S3 / Cloud   │         │ • Transformaciones masivas en RAM   │
   │ • Encolamiento de mensajes (BullMQ) │         │ • Expresiones regulares complejas   │
   └──────────────────┬──────────────────┘         └──────────────────┬──────────────────┘
                      │                                               │
                      ▼                                               ▼
             MECANISMO NODE.JS                               MECANISMO NODE.JS
   ┌─────────────────────────────────────┐         ┌─────────────────────────────────────┐
   │ APIs asíncronas basadas en Promises │         │ node:worker_threads (Worker Pool)   │
   │ Concurrency pooling + Timeouts      │         │ Procesos dedicados / BullMQ workers │
   │ Non-blocking OS I/O                 │         │ Servicios satélite especializados   │
   └─────────────────────────────────────┘         └─────────────────────────────────────┘
```

---

## 7. Worker Threads

El módulo nativo `node:worker_threads` permite ejecutar código JavaScript en paralelo en hilos del sistema operativo con su propio V8 Isolate.

- **Para qué usarlos:** Cálculos intensivos de CPU, transformaciones de datos pesadas, generación de reportes masivos en memoria, criptografía pesada no cubierta por libuv.
- **Para qué NO usarlos:** Para I/O normal (consultas a PostgreSQL o peticiones HTTP). Crear workers para resolver I/O consume memoria y añade sobrecarga de sincronización innecesaria; las APIs asíncronas integradas de Node.js son órdenes de magnitud más eficientes.

---

## 8. Worker Pool

Bajo ninguna circunstancia implementes el antipatrón de instanciar un worker por cada petición entrante:

```text
// ❌ ANTIPATRÓN PROHIBIDO
app.post('/process', (req, res) => {
  const worker = new Worker('./task.js'); // Destruye el rendimiento por sobrecarga de inicialización V8
});
```

En producción, utilizá un **Worker Pool acotado y reutilizable**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                         Piscina / Worker Pool                          │
│                                                                        │
│   Incoming Tasks ──► [ Bounded Queue (Max 100) ] ──► Backpressure / 429│
│                                │                                       │
│        ┌──────────────┬────────┼──────────────┬──────────────┐         │
│        ▼              ▼        ▼              ▼              ▼         │
│   ┌─────────┐    ┌─────────┐              ┌─────────┐   ┌─────────┐    │
│   │ Worker 1│    │ Worker 2│    ...       │Worker N-1│  │ Worker N│    │
│   └─────────┘    └─────────┘              └─────────┘   └─────────┘    │
│            (N = Math.max(1, os.availableParallelism() - 1))            │
└────────────────────────────────────────────────────────────────────────┘
```

Requisitos del pool:
- Tamaño máximo acotado (típicamente `os.availableParallelism() - 1`).
- Cola de tareas con límite superior (bounded queue) para rechazar tareas excedentes con HTTP 503 / 429.
- Timeouts por tarea para destruir workers que queden en loops infinitos.

---

## 9. Worker Threads y Memoria

A diferencia de los procesos separados, los Worker Threads comparten el mismo espacio de memoria virtual y permiten:
- **Transferencia de `ArrayBuffer`:** Transferencia de propiedad con costo de copia cero ($O(1)$).
- **`SharedArrayBuffer` con `Atomics`:** Memoria compartida de acceso concurrente.

> [!WARNING]
> El uso de memoria compartida (`SharedArrayBuffer`) introduce condiciones de carrera, bloqueos atómicos complejos y dificultades severas de depuración. **No la utilices si el paso de mensajes asíncrono (`postMessage`) o la transferencia de buffers resuelve el problema.**

---

## 10. Procesos

Separar en procesos de sistema operativo independientes cuando requieras:
- **Aislamiento de fallas (Fault Isolation):** Un crash por Out-Of-Memory (OOM) o error fatal no debe voltear la API de cara al usuario.
- **Ciclo de vida desacoplado:** Los workers de procesamiento asíncrono (ej. BullMQ Outbox Dispatcher) deben poder reiniciarse o desplegarse independientemente del servidor HTTP.
- **Perfiles de escalado diferenciados:** La API web escala según tráfico HTTP; los workers escalan según profundidad de colas de Redis.

**Regla de oro:** No instancies child processes dinámicamente por cada request HTTP.

---

## 11. Cluster vs Contenedores

Si bien `node:cluster` permite bifurcar múltiples workers que comparten el mismo puerto TCP, **no es la estrategia recomendada de escalado en arquitecturas modernas de producción**.

En entornos contenerizados (Docker, Kubernetes, ECS, Nomad):
- Ejecutá **un proceso Node.js por contenedor** (Single Process per Container).
- Delegá el balanceo de carga, monitoreo de liveness/readiness y reinicio a la infraestructura externa (Ingress Nginx, ALB, K8s kubelet).
- Reservá `node:cluster` únicamente para despliegues monolíticos sobre servidores bare-metal o máquinas virtuales aisladas sin orquestador.

---

## 12. Arquitectura Base: Modular Monolith

Para el backend de `@testimonial-cms`, la arquitectura fundacional es un **Modular Monolith**:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                    @testimonial-cms/api Monolith                        │
│                                                                         │
│   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                │
│   │     auth     │   │    users     │   │   tenants    │   Bounded      │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘   Modules      │
│          │                  │                  │                        │
│   ┌──────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐                │
│   │ testimonials │   │   webhooks   │   │  analytics   │                │
│   └──────┬───────┘   └──────┬───────┘   └──────┬───────┘                │
│          │                  │                  │                        │
│   ┌──────┴───────┐   ┌──────┴───────┐   ┌──────┴───────┐                │
│   │   api-keys   │   │feature-flags │   │    health    │                │
│   └──────────────┘   └──────────────┘   └──────────────┘                │
│                                                                         │
│   ────────────────────── Shared Infrastructure ───────────────────────  │
│     Database (Prisma)  │  Redis / BullMQ  │ Observability (Pino, OTel)  │
└─────────────────────────────────────────────────────────────────────────┘
```

1 repositorio, 1 artefacto desplegable, múltiples módulos con límites de contexto estrictos y comunicación mediante contratos tipados de TypeScript.

---

## 13. Evolución Arquitectónica

Seguí el camino de evolución prudente y justificado:

```text
Small Monolith ──► Feature Modules ──► Modular Monolith ──► Explicit Contracts ──► [¿Necesidad Operacional Real?] ──► Service Extraction
```

> [!IMPORTANT]
> **Nunca comiences un proyecto dividiéndolo prematuramente en microservicios.** Los microservicios resuelven problemas de escala organizacional y dominios de falla física independientes; no son una credencial de seniority y multiplican el costo de latencia, consistencia y observabilidad.

---

## 14. Feature-Oriented Architecture

Estructurá el código agrupado por dominio de negocio (Vertical Slices), no por tipo técnico de archivo:

```text
// ❌ ESTRUCTURA TÉCNICA GLOBAL (Difícil de escalar y mantener)
src/
├── controllers/
├── services/
├── repositories/
└── models/

// ✅ FEATURE-ORIENTED ARCHITECTURE (Cohesión alta, bajo acoplamiento)
src/modules/
├── auth/
├── testimonials/
├── webhooks/
└── tenants/
```

---

## 15. Estructura Recomendada del Proyecto

En el contexto de `@testimonial-cms` (NestJS 11 + TypeScript estricto):

```text
apps/api/src/
├── main.ts                       # Bootstrap, server listen, signal handlers, shutdown
├── app.module.ts                 # Composition Root principal que orquesta los módulos
│
├── config/
│   ├── env.schema.ts             # Validación fail-fast de variables de entorno con Zod
│   └── env.config.ts             # Configuración inmutable tipada y congelada
│
├── modules/
│   ├── testimonials/             # Bounded Module: Testimonios
│   │   ├── domain/               # Entidades puras, reglas de negocio, invariantes
│   │   ├── application/          # Casos de uso / Command Handlers / Ports
│   │   ├── infrastructure/       # Implementación Prisma, adapters externos
│   │   ├── transport/            # NestJS Controllers, DTOs de transporte
│   │   ├── dtos/                 # Schemas Zod de entrada/salida
│   │   ├── testimonials.module.ts# Módulo NestJS que expone la API pública
│   │   └── index.ts              # Barril con contratos públicos exportados
│   │
│   ├── webhooks/                 # Bounded Module: Webhook Dispatcher & Outbox
│   ├── auth/                     # Bounded Module: Autenticación y JWT
│   └── ...
│
├── infrastructure/
│   ├── database/                 # PrismaService, extensiones multi-tenant
│   ├── redis/                    # Conexión IoRedis y health check
│   └── queues/                   # Configuración BullMQ para colas durables
│
├── observability/
│   ├── logger/                   # Configuración Nestjs-pino y serializers seguros
│   ├── context/                  # AsyncLocalStorage para request/tenant context
│   ├── metrics/                  # RED metrics y tracking del Event Loop lag
│   └── tracing/                  # Instrumentación OpenTelemetry
│
└── shared/
    ├── errors/                   # Jerarquía de errores operacionales del dominio
    └── types/                    # Tipos utilitarios globales
```

---

## 16. Capas Pragmáticas

Dentro de cada módulo, organizá las responsabilidades de forma pragmática:

```text
Transport (Controller / HTTP / DTOs)
       │
       ▼
Application (Use Cases / Commands / Services)
       │
       ▼
Domain (Invariantes puras / Entidades / Reglas)
       ▲
       │
Infrastructure (Prisma Repositories / External APIs / Adapters)
```

> [!TIP]
> **No crees capas vacías.** Si un caso de uso es una lectura directa sin reglas de negocio (ej. listar categorías fijas), no construyas interfaces redundantes, adaptadores intermediarios y clases proxy simplemente para "cumplir la arquitectura". La simplicidad operativa manda.

---

## 17. Hexagonal / Clean Architecture

Implementá el patrón de Puertos y Adaptadores (Arquitectura Hexagonal) cuando existan:
- Reglas de negocio críticas que deban testearse de forma aislada sin dependencias de I/O.
- Múltiples adaptadores de persistencia o servicios externos intercambiables (ej. Cloudinary vs AWS S3).
- Larga vida útil esperada del módulo.

No impongas esta ceremonia en operaciones CRUD simples.

---

## 18. Domain-Driven Design (DDD)

Utilizá conceptos de DDD (Lenguaje Ubicuo, Bounded Contexts, Agregados, Value Objects y Domain Events) para dominios con complejidad sustantiva (como el ciclo de vida y moderación de testimonios o la máquina de estados del Outbox).

Evitá convertir entidades anémicas de base de datos en agregados DDD ceremoniales si el modelo sólo realiza inserciones y lecturas directas.

---

## 19. Functional Core / Imperative Shell

Adoptá el paradigma preferido para backends modernos en TypeScript:

```text
┌────────────────────────────────────────────────────────┐
│                   IMPERATIVE SHELL                     │
│  HTTP Request / Prisma DB / Redis / Timers / I/O       │
│                                                        │
│         ┌────────────────────────────────────┐         │
│         │          FUNCTIONAL CORE           │         │
│         │  Lógica pura, funciones puras,     │         │
│         │  sin efectos secundarios, sin I/O, │         │
│         │  100% determinista y testeable.    │         │
│         └────────────────────────────────────┘         │
│                                                        │
│  Escribe resultados a DB / Emite eventos a la red      │
└────────────────────────────────────────────────────────┘
```

El núcleo funcional no tiene noción de base de datos ni de HTTP; recibe datos puros y produce resultados puros.

---

## 20. Ejemplo de Core Puro vs Shell

```typescript
// ✅ FUNCTIONAL CORE: Función pura en src/modules/testimonials/domain/scoring.ts
export type ScoringWeights = {
  readonly contentWeight: number;
  readonly ratingWeight: number;
  readonly mediaBonus: number;
};

export function calculateTestimonialScore(
  rating: number,
  contentLength: number,
  hasMedia: boolean,
  weights: ScoringWeights,
): number {
  if (rating < 1 || rating > 5) {
    throw new RangeError('El rating debe encontrarse estrictamente entre 1 y 5.');
  }

  const normalizedContent = Math.min(contentLength / 500, 1.0);
  const baseScore = (rating / 5) * weights.ratingWeight + normalizedContent * weights.contentWeight;
  const totalScore = hasMedia ? baseScore + weights.mediaBonus : baseScore;

  return Number(Math.min(totalScore, 10.0).toFixed(2));
}

// ✅ IMPERATIVE SHELL: Caso de uso en src/modules/testimonials/application/moderate-testimonial.usecase.ts
export class ModerateTestimonialUseCase {
  constructor(
    private readonly repository: TestimonialRepository,
    private readonly outbox: OutboxService,
    private readonly logger: PinoLogger,
  ) {}

  async execute(command: ModerateCommand): Promise<TestimonialResult> {
    // 1. I/O: Obtener entidad de persistencia con aislamiento multi-tenant
    const testimonial = await this.repository.findById(command.tenantId, command.testimonialId);
    if (!testimonial) throw new EntityNotFoundError('Testimonio no hallado');

    // 2. FUNCTIONAL CORE: Ejecutar lógica pura de cálculo
    const newScore = calculateTestimonialScore(
      testimonial.rating,
      testimonial.content.length,
      testimonial.media.length > 0,
      DEFAULT_WEIGHTS,
    );

    // 3. I/O: Persistir mutación y registrar evento en la Outbox en una sola transacción
    const updated = await this.repository.updateStatusWithScore(
      command.tenantId,
      command.testimonialId,
      command.nextStatus,
      newScore,
    );

    this.logger.info({ testimonialId: updated.id, newScore }, 'Testimonio moderado con éxito');
    return updated;
  }
}
```

---

## 21. Separar Transporte y Negocio

**Regla inviolable:** Jamás pases objetos de transporte (`req`, `res`, `FastifyRequest`, `Express.Request`) a las capas de aplicación o dominio.

```typescript
// ❌ INCORRECTO: Acoplamiento directo del negocio al protocolo HTTP
async function approveTestimonial(req: FastifyRequest, res: FastifyReply) {
  const user = req.user;
  // Reglas de negocio mezcladas con HTTP...
}

// ✅ CORRECTO: El caso de uso recibe un Command / DTO tipado e independiente
export interface ApproveTestimonialCommand {
  readonly tenantId: string;
  readonly testimonialId: string;
  readonly moderatorId: string;
  readonly reason?: string;
}

async function approveTestimonial(command: ApproveTestimonialCommand): Promise<Testimonial> {
  // Negocio desacoplado de HTTP
}
```

---

## 22. Responsabilidad del Controller

El Controller debe ser una capa delgada con cuatro responsabilidades exactas:
1. Parsear y validar el input de transporte (headers, params, body, query).
2. Extraer el contexto de seguridad autenticado (`tenantId`, `userId`, `roles`).
3. Invocar la operación de aplicación correspondiente.
4. Mapear el resultado a la respuesta de transporte con su código HTTP semántico.

---

## 23. Service Layer Orientado a la Intención

Evitá agrupar cientos de métodos dispares en un único servicio monolítico gigante (`TestimonialService` de 2000 líneas). Preferí agrupar o nombrar use-cases orientados a la intención del negocio:
- `create-testimonial.usecase.ts`
- `moderate-testimonial.usecase.ts`
- `publish-outbox-events.job.ts`

---

## 24. Repository Pattern Pragmatico

Utilizá un Repository cuando aporte una frontera real de aislamiento entre el modelo de negocio y el cliente de persistencia (Prisma).

En `@testimonial-cms`, el repositorio asegura de forma declarativa e inquebrantable el filtro `tenant_id` en cada consulta:

```typescript
export interface TestimonialRepository {
  findById(tenantId: string, id: string): Promise<TestimonialEntity | null>;
  save(tenantId: string, entity: TestimonialEntity): Promise<void>;
}
```

---

## 25. ORM e Infraestructura de Datos

Prisma 6.5+ es un detalle de implementación de infraestructura.
- **No expongas modelos Prisma directamente a clientes externos.** Los modelos de datos contienen columnas internas (`password_hash`, `tenant_id`, flags de auditoría, claves foráneas técnicas) que no pertenecen a la API pública.
- Mapeá explícitamente de Modelo Prisma → Entidad de Dominio → DTO de Respuesta.

---

## 26. Separación Estricta de DTOs

Mantené fronteras claras entre representaciones de datos:

```text
┌───────────────────────┐
│     Prisma Model      │  (Estructura relacional en PostgreSQL)
└───────────┬───────────┘
            │
            ▼ (Mapper de Infraestructura)
┌───────────────────────┐
│ Domain / App Model    │  (Entidad con métodos e invariantes)
└───────────┬───────────┘
            │
            ▼ (Mapper de Presentación)
┌───────────────────────┐
│     Response DTO      │  (Contrato público seguro sin datos sensibles)
└───────────────────────┘
```

---

## 27. Inyección de Dependencias (DI)

Favorecé dependencias explícitas inyectadas a través de constructores o funciones factory.
- En NestJS, utilizá los decoradores `@Injectable()` y módulos limpios sin recurrir a service locators dinámicos ni dependencias circulares.
- En código puro o librerías utilitarias, preferí factories funcionales o closures.

---

## 28. Inyección mediante Factory / Closure

Para componentes desacoplados fuera del contenedor de NestJS:

```typescript
export interface CreateUserDependencies {
  readonly userRepository: UserRepository;
  readonly passwordHasher: PasswordHasher;
  readonly logger: PinoLogger;
}

export function makeCreateUser({ userRepository, passwordHasher, logger }: CreateUserDependencies) {
  return async function createUser(input: CreateUserInput): Promise<UserOutput> {
    const hash = await passwordHasher.hash(input.password);
    const user = await userRepository.create({ ...input, passwordHash: hash });

    logger.info({ userId: user.id, tenantId: user.tenantId }, 'Usuario creado');
    return { id: user.id, email: user.email, tenantId: user.tenantId };
  };
}
```

---

## 29. Clases con Propósito

Utilizá clases en TypeScript cuando proporcionen valor real:
- Encapsulación de estado mutable controlado.
- Ciclo de vida claro de recursos (conexión, sockets, timers, workers).
- Inyección de dependencias estándar de NestJS.

No utilices clases vacías como simples contenedores de funciones estáticas cuando un módulo o función pura sea más simple y legible.

---

## 30. Composition Root

Toda aplicación debe contar con un punto de inicio centralizado (Composition Root) donde se arme el grafo de dependencias de todo el sistema. En NestJS, este rol lo desempeñan `app.module.ts` y los módulos raíz de infraestructura.

---

## 31. app.ts vs server.ts (Arranque Desacoplado)

Separá la **configuración de la aplicación** del **arranque del servidor HTTP**:

```text
┌────────────────────────────────────────────────────────┐
│                        main.ts                         │
│  - Carga configuración y valida variables de entorno  │
│  - Invoca bootstrapApp()                               │
│  - Inicia server.listen(port)                          │
│  - Registra listeners de señales OS (SIGTERM, SIGINT)  │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│                   bootstrapApp()                       │
│  - Instancia NestFactory.create()                      │
│  - Registra Middlewares, Pipes, Interceptors, Filters  │
│  - Configura Swagger / OpenAPI                         │
│  - Retorna la instancia de INestApplication            │
│  (¡Permite tests de integración sin abrir puertos TCP!)│
└────────────────────────────────────────────────────────┘
```

---

## 32. TypeScript Estricto en Producción

El archivo `tsconfig.json` debe mantener activadas las banderas más rigurosas del compilador:

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}
```

---

## 33. ES Modules (ESM)

En proyectos modernos basados en Node 24+, utilizá ESM nativo (`"type": "module"` en `package.json`). Mantené consistencia absoluta en todo el monorepo y evitá mezclar sintaxis CommonJS (`require`/`module.exports`) con ESM (`import`/`export`).

---

## 34. Async/Await y Flujos Asíncronos

Utilizá `async`/`await` de forma declarativa y predecible. Recordá que marcar una función con `async` no paraleliza nada por sí mismo; simplemente envuelve el retorno en una promesa y secuencia la ejecución del cuerpo en microticks.

---

## 35. Paralelización de I/O Independiente

Identificá operaciones de I/O que no dependan entre sí y ejecútalas de forma concurrente:

```typescript
// ❌ INCORRECTO: Latencia acumulativa secuencial innecesaria (t = t1 + t2 + t3)
const tenant = await getTenant(tenantId);
const flags = await getFeatureFlags(tenantId);
const metrics = await getTenantMetrics(tenantId);

// ✅ CORRECTO: Ejecución concurrente en el Event Loop (t = max(t1, t2, t3))
const [tenant, flags, metrics] = await Promise.all([
  getTenant(tenantId),
  getFeatureFlags(tenantId),
  getTenantMetrics(tenantId),
]);
```

---

## 36. Concurrencia Acotada (Bounded Concurrency)

> [!CAUTION]
> **`Promise.all()` con arrays grandes es un vector de denegación de servicio y saturación de memoria.** Si mapeás 50,000 elementos con `Promise.all()`, intentarás abrir 50,000 conexiones concurrentes contra la base de datos, agotando el pool de Prisma o colapsando PostgreSQL.

Utilizá un limitador de concurrencia (`p-limit` o procesamiento en lotes):

```typescript
import pLimit from 'p-limit';

export async function processBatchWithLimit<T, R>(
  items: readonly T[],
  limitConcurrency: number,
  handler: (item: T) => Promise<R>,
): Promise<R[]> {
  const limit = pLimit(limitConcurrency);
  return Promise.all(items.map((item) => limit(() => handler(item))));
}
```

---

## 37. Backpressure en Flujos de Alto Volumen

Cuando un productor genera datos más rápido de lo que un consumidor puede procesar o enviar a la red, el buffer en RAM crece indefinidamente hasta provocar un Out-Of-Memory (`heap out of memory`).

En Node.js, goberná el flujo respetando el retorno de `stream.write()` y el evento `'drain'`, o utilizá abstracciones de alto nivel como `pipeline`.

---

## 38. Procesamiento con Streams

Para archivos grandes, exportaciones CSV masivas o subidas de imágenes, utilizá siempre `node:stream/promises`:

```typescript
import { pipeline } from 'node:stream/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import { createGzip } from 'node:zlib';

export async function compressExportFile(sourcePath: string, destPath: string): Promise<void> {
  await pipeline(createReadStream(sourcePath), createGzip(), createWriteStream(destPath));
}
```

---

## 39. Límites Estrictos de Memoria

Toda colección o estructura de datos cuyo crecimiento dependa del tráfico entrante debe tener un límite de tamaño:
- `Map` o `Set` en memoria.
- Buffers de acumulación de logs o eventos.
- Arrays de procesamiento en batch.
- Listeners registrados en EventEmitters.

---

## 40. Caché en Memoria del Proceso (L1)

> [!WARNING]
> Jamás utilices `const cache = new Map<string, unknown>()` global sin una política estricta de tamaño máximo (LRU) y tiempo de vida (TTL).

Utilizá librerías especializadas como `lru-cache`:

```typescript
import { LRUCache } from 'lru-cache';

export const localTenantConfigCache = new LRUCache<string, TenantConfig>({
  max: 1000, // Máximo 1,000 tenants cacheados en RAM
  ttl: 1000 * 60 * 5, // 5 minutos de TTL
});
```

---

## 41. Estrategia de Caché Multicapa

Implementá la jerarquía de almacenamiento según necesidad:

```text
┌────────────────────────────────────────────────────────┐
│ L1: In-Process Memory (LRU Cache, TTL < 1 min, < 50MB) │
└───────────────────────────┬────────────────────────────┘
                            │ (Miss)
                            ▼
┌────────────────────────────────────────────────────────┐
│ L2: Distributed Cache (Redis 7 Cluster, TTL 5m - 24h)  │
└───────────────────────────┬────────────────────────────┘
                            │ (Miss)
                            ▼
┌────────────────────────────────────────────────────────┐
│ L3: Database of Record (PostgreSQL 18 + Prisma)        │
└────────────────────────────────────────────────────────┘
```

---

## 42. Uso Apropiado de Redis 7

Redis es fundamental para:
- Caché distribuida compartida entre réplicas del backend.
- Rate limiting con contadores atómicos y ventana deslizante.
- Mecanismo de cola y almacenamiento para BullMQ.
- Locks distribuidos cuidadosamente diseñados (Redlock / SET NX PX).

No introduzcas Redis únicamente porque "un backend moderno debe tener Redis". Si la carga no lo amerita, evitá la sobrecarga operativa.

---

## 43. Disciplina de Invalidación de Caché

Cada vez que diseñes una clave de caché, respondé explícitamente:
1. **¿Qué dato exacto contiene?** (Namespace claro: `tenant:{id}:testimonials:approved`).
2. **¿Cuánto vive?** (TTL defensivo; jamás almacenes claves sin expiración).
3. **¿Cómo y cuándo se invalida?** (Mutación en el use case emite invalidación inmediata).
4. **¿Qué ocurre ante un cache miss?** (Consulta atómica a la base de datos).

---

## 44. Mitigación de Cache Stampede

Cuando expira una clave de alto tráfico, cientos de peticiones simultáneas intentan recalcularla contra la base de datos al mismo tiempo, colapsándola.

Mitigaciones requeridas:
- **Jitter en el TTL:** Añadí una variación pseudoaleatoria del $\pm 10\%$ al TTL para evitar expiraciones en bloque.
- **Request Coalescing / Single-Flight:** Asegurá que una sola promesa esté en vuelo para la misma clave; las demás esperan el resultado de esa misma promesa.
- **Background Refresh (Stale-While-Revalidate):** Serví el valor antiguo mientras un worker asíncrono regenera el nuevo.

---

## 45. Connection Pooling en PostgreSQL

El backend jamás debe abrir una nueva conexión a PostgreSQL por cada petición entrante.
- Configurá el connection pool de Prisma considerando el número de réplicas:

$$\text{Pool Size por Réplica} \le \frac{\text{max\_connections en PostgreSQL} - \text{reservadas}}{\text{Número de Réplicas}}$$

- En entornos de alta concurrencia, interponé **PgBouncer** en modo transaction pooling.

---

## 46. Prevención y Detección de N+1

El antipatrón N+1 ocurre cuando se consulta una lista de $N$ elementos y luego se ejecuta una consulta adicional por cada elemento:

```typescript
// ❌ INCORRECTO: 1 consulta para testimonios + N consultas para autores (N+1)
const testimonials = await prisma.testimonial.findMany({ where: { tenant_id: tenantId } });
for (const t of testimonials) {
  t.author = await prisma.user.findUnique({ where: { id: t.userId } });
}

// ✅ CORRECTO: 1 consulta optimizada con JOIN relacional
const testimonials = await prisma.testimonial.findMany({
  where: { tenant_id: tenantId },
  include: { user: true },
});
```

Instrumentá queries lentas (> 100 ms) en Prisma mediante el middleware `$use` o eventos de log `$on('query')`.

---

## 47. Transacciones de Persistencia y Límites de Bloqueo

Utilizá transacciones de base de datos (`prisma.$transaction`) únicamente para garantizar consistencia atómica entre múltiples mutaciones relacionales.

> [!CAUTION]
> **Nunca mantengas una transacción de base de datos abierta mientras esperas una respuesta HTTP externa, el envío de un email o la confirmación de una cola.** Si la API externa tarda 3 segundos, mantendrás bloqueos en PostgreSQL y agotarás el pool de conexiones de toda la aplicación.

---

## 48. Configuración y Validación de Entorno

Toda configuración debe validarse al inicializar el proceso mediante un esquema tipado y estricto.

```typescript
// src/config/env.schema.ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(3001),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  PEPPER_SECRET: z.string().min(32),
});

export type EnvConfig = z.infer<typeof envSchema>;
```

---

## 49. Fail Fast en Bootstrap

Si una variable de entorno obligatoria falta o tiene un formato inválido, el proceso de Node.js **debe abortar de inmediato en el arranque** con código de salida 1.

```typescript
export function validateEnv(): EnvConfig {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Error fatal en configuración de variables de entorno:', parsed.error.format());
    process.exit(1);
  }
  return Object.freeze(parsed.data);
}
```

---

## 50. Validación en Tiempo de Ejecución (Runtime Validation)

TypeScript desaparece en tiempo de ejecución. Toda frontera externa del sistema que reciba datos no confiables debe validarse en runtime con esquemas Zod o NestJS validation pipes:
- Cuerpos de peticiones HTTP, headers y query parameters.
- Payloads de mensajes provenientes de colas BullMQ.
- Webhooks entrantes de terceros.
- Respuestas recibidas de APIs externas.

---

## 51. Validación ≠ Sanitización Universal

> [!IMPORTANT]
> Un validador de esquemas (como Zod) garantiza que un campo sea de tipo `string` o tenga longitud mínima. **No garantiza inmunidad contra SQL Injection, Command Injection, XSS, SSRF ni Path Traversal.** Esos riesgos exigen controles defensivos específicos en la capa de ejecución correspondiente.

---

## 52. Prevención de Inyección SQL

- Utilizá siempre los métodos parametrizados del ORM Prisma.
- Si requerís ejecutar SQL crudo mediante `$queryRaw`, utilizá exclusivamente los tagged template literals de Prisma (`prisma.$queryRaw\`SELECT * FROM users WHERE id = ${id}\``), los cuales envían los parámetros de forma separada al motor de PostgreSQL mediante prepared statements.
- **Jamás construyas consultas mediante concatenación o interpolación de strings crudos.**

---

## 53. Prevención de Inyección de Comandos del Sistema

Bajo ninguna circunstancia utilices `child_process.exec()` pasando parámetros de usuario sin sanear. Si es estrictamente indispensable ejecutar un binario del sistema, utilizá `child_process.spawn()` con `shell: false` y un array de argumentos explícitos y validados:

```typescript
import { spawn } from 'node:child_process';

// ✅ CORRECTO: Los argumentos van en un array sin invocar un intérprete de shell
const child = spawn('/usr/bin/convert', [sanitizedInputPath, sanitizedOutputPath], {
  shell: false,
  timeout: 5000,
});
```

---

## 54. Prevención de Path Traversal

Cuando interactúes con el sistema de archivos:
- No aceptes rutas proporcionadas directamente por el usuario.
- Utilizá identificadores lógicos opacos (ej. UUIDv4).
- Si debés resolver una ruta, verifícala usando `path.resolve` y comprobá que comience estrictamente con el directorio base permitido:

```typescript
import path from 'node:path';

export function resolveSafePath(baseDir: string, userPath: string): string {
  const safePath = path.resolve(baseDir, userPath);
  if (!safePath.startsWith(path.resolve(baseDir))) {
    throw new SecurityError('Acceso denegado: intento de path traversal detectado.');
  }
  return safePath;
}
```

---

## 55. Arquitectura Orientada a Eventos: In-Process vs Distribuida

Distinguí con total precisión conceptual:
- **Evento In-Process:** Notificación interna en memoria del mismo proceso Node.js (efímera).
- **Evento Distribuido:** Mensaje serializado persistido en un broker de mensajería durable (resiliente a reinicios).

---

## 56. Uso Correcto de `EventEmitter`

`node:events` (`EventEmitter`) es adecuado para coordinar módulos dentro del mismo proceso en tiempo real (ej. streaming interno o hooks desacoplados).

> [!CAUTION]
> **`EventEmitter` NO es un Message Broker.** No provee persistencia, no soporta reintentos tras caídas del servidor y pierde todos los eventos encolados en memoria si el proceso sufre un crash o reinicio.

---

## 57. Message Brokers y Colas Durables

Para desacoplamiento entre servicios, entrega garantizada y absorción de picos de carga, utilizá brokers y sistemas de colas durables respaldados por almacenamiento persistente:
- **BullMQ sobre Redis 7:** Para trabajos en background, procesamiento diferido y el Transactional Outbox de `@testimonial-cms`.
- **RabbitMQ:** Para enrutamiento complejo AMQP y colas tradicionales.
- **Kafka / Redpanda:** Para streaming de eventos de alto rendimiento con retención temporal y repetición de log (event replay).

---

## 58. Criterios de Selección: RabbitMQ vs Kafka vs BullMQ

| Criterio | BullMQ + Redis 7 | RabbitMQ | Apache Kafka |
| :--- | :--- | :--- | :--- |
| **Caso de uso óptimo** | Background jobs, tareas programadas, Outbox dentro del stack Node.js. | Mensajería empresarial con enrutamiento AMQP flexible y DLQ. | Ingesta masiva de eventos, event sourcing, replay de streams históricos. |
| **Modelo** | Job Queue con persistencia Redis. | Smart Broker / Dumb Consumer (ACKs inmediatos). | Dumb Broker / Smart Consumer (Log particionado con offsets). |
| **Sobrecarga operativa**| Mínima (usa la misma instancia de Redis). | Media (requiere cluster Erlang/RabbitMQ). | Alta (requiere ZooKeeper/KRaft y tuning JVM). |

---

## 59. Transactional Outbox Pattern

Para resolver el problema del doble commit en sistemas distribuidos (*Dual-Write Problem*):

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Transaction                          │
│                                                                        │
│   1. INSERT / UPDATE en tabla de negocio (ej. testimonials)            │
│   2. INSERT en tabla outbox_events (con estado = 'PENDING')            │
│                                                                        │
│                                 COMMIT                                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   Outbox Processor (BullMQ Worker)                     │
│  - Lee eventos 'PENDING' con SELECT ... FOR UPDATE SKIP LOCKED         │
│  - Despacha HTTP POST o mensaje al broker                              │
│  - Marca evento como 'PUBLISHED' o incrementa reintentos               │
└────────────────────────────────────────────────────────────────────────┘
```

Garantiza entrega **At-Least-Once** sin inconsistencias de estado.

---

## 60. Consumidores Idempotentes (Idempotent Consumers)

Dado que los sistemas de eventos en red garantizan entrega At-Least-Once, un consumidor puede recibir el mismo mensaje múltiples veces debido a caídas de red o reintentos.

Todo consumidor crítico debe verificar si el identificador único del evento (`eventId`) ya fue procesado antes de ejecutar su efecto secundario:

```typescript
export async function handleIncomingEvent(event: DomainEvent): Promise<void> {
  const isDuplicate = await redis.set(`processed:event:${event.id}`, '1', 'EX', 86400, 'NX');
  if (!isDuplicate) {
    logger.warn({ eventId: event.id }, 'Evento duplicado ignorado.');
    return;
  }
  // Procesar lógica del evento...
}
```

---

## 61. Background Jobs con BullMQ

Encolá en BullMQ toda tarea que:
- Demande más de 200 ms de procesamiento.
- Dependa de servicios de red externos (envío de emails, subida a S3, webhooks de salida).
- Requiera reintentos automáticos tras fallos.
- Deba ejecutarse de forma diferida o programada.

---

## 62. Limitaciones de `setInterval` en Producción

`setInterval()` o `node-cron` dentro del proceso HTTP fallan gravemente en producción cuando existen múltiples réplicas del contenedor:
1. **Ejecución duplicada:** Si corren 4 réplicas, la tarea programada se disparará 4 veces en paralelo.
2. **Falta de durabilidad:** Si el contenedor se reinicia a las 23:59, la tarea de medianoche se pierde para siempre.

---

## 63. Cron Distribuido

Para tareas programadas en entornos multi-réplica:
- Utilizá **BullMQ Repeatable Jobs**, coordinados mediante Redis.
- O implementá bloqueos distribuidos temporales (*Distributed Advisory Locks*) sobre PostgreSQL o Redis para asegurar que una única instancia gane el derecho de ejecutar la tarea.

---

## 64. Idempotencia en la Ejecución de Jobs

Todo worker de BullMQ debe diseñarse bajo la asunción de que el proceso puede morir abruptamente a mitad de la ejecución. Al reiniciar, el job se reejecutará desde el principio; el código debe verificar el estado actual en la base de datos antes de reintentar mutaciones irreversibles.

---

## 65. Timeouts Obligatorios en Dependencias Remotas

> [!CAUTION]
> **Toda llamada de red externa sin timeout configurado es una bomba de tiempo que puede congelar tu backend.** Si un proveedor tarda 10 minutos en responder o deja la conexión colgada, tu socket permanecerá abierto consumiendo recursos.

Utilizá siempre `AbortSignal.timeout()`:

```typescript
export async function fetchWithStrictTimeout(url: string, timeoutMs = 3000): Promise<Response> {
  try {
    return await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') {
      throw new GatewayTimeoutError(`Llamada HTTP a ${url} superó el timeout de ${timeoutMs}ms.`);
    }
    throw error;
  }
}
```

---

## 66. Cancelación y Propagación con AbortController

Propagá la señal de cancelación de la petición HTTP entrante (`req.signal`) hacia las operaciones de I/O subsecuentes. Si el cliente cierra el navegador o cancela la conexión, abortá las consultas pendientes contra PostgreSQL y APIs externas para ahorrar cómputo y conexiones:

```typescript
export async function getTestimonialsWithCancel(tenantId: string, signal: AbortSignal) {
  // Prisma soporta AbortSignal en consultas avanzadas o drivers nativos
  if (signal.aborted) throw new RequestCancelledError();
  // Continuar I/O...
}
```

---

## 67. Política de Reintentos (Retry Policy)

**Regla fundamental:** Solo reintentá fallos transitorios de infraestructura:
- Conexión reseteada (`ECONNRESET`, `ETIMEDOUT`).
- Respuestas HTTP 429 (Too Many Requests con `Retry-After`), 502, 503 y 504.
- Deadlocks temporales de base de datos (`40P01` en PostgreSQL).

**Nunca reintentes errores semánticos o de negocio:** 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found ni 422 Unprocessable Entity.

---

## 68. Exponential Backoff con Full Jitter

Evitá reintentar a intervalos fijos o con simple backoff determinista, ya que provoca que miles de clientes sincronizados ataquen al servidor recuperado al unísono (*Thundering Herd*).

Implementá **Full Jitter**:

$$t_{\text{sleep}} = \text{random}(0, \, \min(t_{\text{max}}, \, t_{\text{base}} \times 2^{\text{attempt}}))$$

```typescript
export function calculateBackoffWithJitter(attempt: number, baseMs = 100, maxMs = 5000): number {
  const exponentialLimit = Math.min(maxMs, baseMs * Math.pow(2, attempt));
  return Math.floor(Math.random() * exponentialLimit);
}
```

---

## 69. Reintentos e Idempotencia

```text
┌────────────────────────────────────────────────────────┐
│                   REGLA INQUEBRANTABLE                 │
│                                                        │
│                     RETRY POLICY                       │
│                          +                             │
│               NON-IDEMPOTENT OPERATION                 │
│                          =                             │
│          CATASTROFE DE DATOS DUPLICADOS                │
└────────────────────────────────────────────────────────┘
```

Antes de activar reintentos automáticos sobre peticiones `POST` o mutaciones de base de datos, asegurá un identificador de idempotencia (`Idempotency-Key`).

---

## 70. Circuit Breaker Pattern

Cuando un servicio externo falla de manera consecutiva, continuar enviándole tráfico satura los recursos locales y empeora la recuperación del servicio upstream.

Estados del Circuit Breaker:
- **CLOSED (Normal):** El tráfico fluye normalmente. Si la tasa de fallas supera el umbral (ej. 50% en 10 peticiones), transiciona a OPEN.
- **OPEN (Abierto):** Las peticiones fallan inmediatamente en el cliente (Fast-Fail) sin tocar la red, ejecutando un fallback o retornando error 503.
- **HALF-OPEN (Semi-abierto):** Tras un período de enfriamiento (ej. 30s), se permite un número acotado de peticiones de prueba. Si responden bien, el circuito se CIERRA; si fallan, vuelve a abrirse.

---

## 71. Bulkhead Pattern (Aislamiento de Recursos)

Aislá los pools de conexiones y la capacidad de concurrencia para que el fallo o saturación de un componente no arrastre al resto del backend:
- Pool de Prisma para la API pública independiente del pool de workers de BullMQ.
- Asignación de cupos de memoria y descriptores de archivo diferenciados.

---

## 72. Load Shedding

Cuando el servidor detecta que el Event Loop lag o el consumo de memoria supera los umbrales de seguridad, es preferible **rechazar deliberadamente nuevas peticiones entrantes** con HTTP 503 (`Service Unavailable`) y cabecera `Retry-After`, antes que permitir que todas las peticiones se degraden y el proceso colapse por OOM.

---

## 73. Fallbacks Seguros (Fail-Safe vs Fail-Closed)

- **En operaciones de datos auxiliares (Fail-Safe):** Si el servicio de recomendaciones falla, retorná una lista estática de productos populares.
- **En operaciones de seguridad y autorización (Fail-Closed):** Si el servicio de verificación de permisos o el RBAC falla o arroja timeout, **denegá el acceso de forma absoluta**. Jamás permitas una operación por default ante una falla de red.

---

## 74. Teorema CAP en Sistemas Distribuidos

Ante una partición de red inevitable ($P$):
- ¿Elegís **Consistencia ($CP$):** Rechazar peticiones para evitar datos divergentes?
- ¿O elegís **Disponibilidad ($AP$):** Responder con datos potencialmente obsoletos?

---

## 75. Node.js es Ateo respecto a CAP

Node.js es únicamente el motor de ejecución de cómputo; no determina si tu sistema es $CP$ o $AP$. Esa propiedad la determinan la base de datos (PostgreSQL 18 en modo transaccional es fuertemente consistente $CP$; DynamoDB o Cassandra con réplicas eventuales son $AP$) y los protocolos de sincronización elegidos.

---

## 76. Consistencia Eventual

Aceptable para:
- Proyecciones de lectura de testimonios públicos en widgets.
- Métricas agregadas y analíticas de impresiones/clicks.
- Actualización de índices de búsqueda.

Inaceptable para:
- Registro de usuarios, autenticación y rotación de tokens de refresco.
- Asignación de roles RBAC y permisos de moderación.
- Cambios de planes de facturación y cuotas de tenants.

---

## 77. Sagas para Transacciones Distribuidas

Cuando una operación involucre múltiples servicios independientes sin posibilidad de una transacción ACID local:
- Diseñá una **Saga Orquestada**.
- Definí transacciones compensatorias para cada paso que reviertan los efectos secundarios si un paso posterior fracasa.

---

## 78. Networking y Abstracción de Conexiones

No intentes manipular sockets TCP crudos de bajo nivel salvo necesidad extrema. Confiá en librerías de alto rendimiento auditadas (como `undici`, el motor oficial detrás del `fetch` nativo de Node.js).

---

## 79. Configuración Consciente de Keep-Alive

Reutilizar sockets TCP mediante HTTP Keep-Alive es vital para mitigar el costo del handshake TLS en microservicios y llamadas a PostgreSQL/Redis. Configurá explícitamente:
- `keepAlive: true`
- `keepAliveMsecs: 1000`
- `maxSockets`: límite superior adaptado a la concurrencia esperada.

---

## 80. Límites Estrictos de Payloads

Toda API pública debe rechazar payloads gigantescos antes de parsearlos en memoria:
- Límite de body JSON: máximo 1 MB (configurable a 10 MB sólo en endpoints de carga multimedia).
- Límite de headers: `maxHeaderSize` configurado en el servidor HTTP (ej. 16 KB).
- Paginación obligatoria con tope máximo: `take: Math.min(query.limit ?? 20, 100)`.

---

## 81. Cabeceras de Seguridad HTTP (Hardening)

Utilizá `helmet` para inyectar cabeceras defensivas estándar:
- `Content-Security-Policy` (CSP)
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

> [!NOTE]
> Instalar `helmet()` es sólo un paso básico de hardening; no sustituye la sanitización de inputs ni la autorización granular.

---

## 82. Rate Limiting Multi-Tenant

Implementá limitación de tasa por múltiples dimensiones:
- Por dirección IP para endpoints de autenticación pública (`/api/v1/auth/login`).
- Por `tenantId` para consumo general del SaaS.
- Por API Key para accesos públicos a widgets.

Utilizá almacenamiento compartido en Redis 7 para que el contador sea coherente a través de todas las réplicas del contenedor.

---

## 83. Autenticación vs Autorización

- **Autenticación (AuthN):** Valida la identidad del sujeto (vía JWT Access Token verificado criptográficamente).
- **Autorización (AuthZ):** Valida si el sujeto autenticado tiene permisos suficientes para ejecutar la acción solicitada sobre el recurso específico.

Ambas comprobaciones deben ejecutarse **estrictamente en el servidor** en cada petición.

---

## 84. Principio de Menor Privilegio (Least Privilege)

- El usuario de base de datos de la API en PostgreSQL no debe ser superusuario (`postgres`), sino un usuario con permisos limitados al esquema del tenant.
- El contenedor Docker debe ejecutarse bajo un usuario sin privilegios (`USER node`), jamás como `root`.
- Los tokens y credenciales de APIs de terceros deben tener scopes acotados a la acción mínima necesaria.

---

## 85. Node.js Permission Model

Node 24 cuenta con un **Permission Model** nativo que permite restringir las capacidades del proceso mediante banderas de arranque:

```bash
node --permission --allow-fs-read=/app/public --allow-net=api.sendgrid.com,postgres.internal dist/main.js
```

---

## 86. El Permission Model es Defense-in-Depth

El Permission Model de Node.js es una capa complementaria de defensa en profundidad; no sustituye el aislamiento a nivel de kernel proporcionado por namespaces de Linux, perfiles Seccomp, AppArmor y contenedores Docker.

---

## 87. Gestión Segura de Secretos

- Jamás almacenes contraseñas, secretos JWT o peppers en el repositorio Git, Dockerfiles ni artefactos compilados.
- Inyectá secretos en tiempo de ejecución a través de variables de entorno montadas desde gestores dedicados (AWS Secrets Manager, HashiCorp Vault, Kubernetes Secrets).
- Asegurá que ningún secreto se filtre en logs de consola ni trazas de error.

---

## 88. Seguridad en la Cadena de Suministro (Supply Chain)

- Ejecutá `npm audit` en el pipeline de CI/CD.
- Congelá versiones con `package-lock.json` inmutable y utilizá siempre `npm ci` en lugar de `npm install`.
- Evitá la instalación de paquetes superfluos o abandonados para tareas triviales.

---

## 89. Logging Estructurado con Pino

Utilizá logs en formato JSON estructurado:

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
```

Los logs estructurados permiten indexación, correlación y alertas en herramientas como Loki, Elasticsearch o Datadog.

---

## 90. Contexto de Request y Trazabilidad

Cada petición que ingrese al backend debe recibir o generar un identificador único de correlación (`requestId` / `x-correlation-id`). Toda traza, log y evento generado a lo largo del procesamiento debe incluir dicho ID.

---

## 91. AsyncLocalStorage para Propagación de Contexto

Evitá pasar manualmente `requestId`, `tenantId` y `userId` como argumentos a través de decenas de funciones y servicios. Utilizá la API nativa `node:async_hooks`:

```typescript
import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContextStore {
  readonly requestId: string;
  readonly tenantId?: string;
  readonly userId?: string;
}

export const requestContext = new AsyncLocalStorage<RequestContextStore>();

export function getRequestContext(): RequestContextStore | undefined {
  return requestContext.getStore();
}
```

---

## 92. Serializadores Seguros y Logging con Contexto

Integrá el store de `AsyncLocalStorage` con Pino para que cada log incluya automáticamente el contexto sin esfuerzo manual:

```typescript
export function logInfo(message: string, meta?: Record<string, unknown>): void {
  const store = requestContext.getStore();
  logger.info({ ...store, ...meta }, message);
}
```

---

## 93. Lista Negra Estricta de Campos (Data Redaction)

Configurá Pino para redactar o enmascarar automáticamente información sensible antes de que llegue a stdout:
- `password`, `password_hash`, `newPassword`
- `authorization`, `cookie`, `set-cookie`
- `jwt`, `token`, `refreshToken`, `apiKey`
- `creditCard`, `cvv`, `pan`

---

## 94. Métricas Clave de Salud del Servicio

Instrumentá métricas estándar de observabilidad:
- **RED Metrics:** Rate (requests/seg), Errors (5xx rate), Duration (latencia p50, p95, p99).
- **Métricas del Runtime:** Uso de CPU, Resident Set Size (RSS), Heap Used vs Heap Total, pausas del Garbage Collector (GC).
- **Métricas de Recursos:** Saturación del pool de conexiones de Prisma, jobs pendientes en BullMQ.

---

## 95. Event Loop Lag: La Métrica Reina

El **Event Loop Lag** mide el retraso que experimenta una función programada en ejecutarse debido a que el hilo principal estuvo ocupado atendiendo código síncrono.

```typescript
import { monitorEventLoopDelay } from 'node:perf_hooks';

const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

export function getEventLoopLag(): { p50: number; p99: number; max: number } {
  return {
    p50: Number((histogram.percentile(50) / 1e6).toFixed(2)), // Convertido a milisegundos
    p99: Number((histogram.percentile(99) / 1e6).toFixed(2)),
    max: Number((histogram.max / 1e6).toFixed(2)),
  };
}
```

Si el $p_{99}$ supera los 50 ms, el sistema está experimentando bloqueos severos del Event Loop.

---

## 96. Trazabilidad Distribuida con OpenTelemetry

Instrumentá peticiones HTTP entrantes, consultas de Prisma y publicaciones de eventos con estándares W3C Trace Context (`traceparent`). Esto permite rastrear una transacción a través de múltiples servicios y workers.

---

## 97. Diagnóstico Desacoplado con `diagnostics_channel`

Utilizá el módulo nativo `node:diagnostics_channel` para emitir telemetría y diagnósticos de rendimiento sin acoplar el código de negocio a librerías de monitoreo externas.

---

## 98. Health Checks Desacoplados (/live vs /ready)

Separá conceptual y técnicamente los endpoints de salud:
- **Liveness Probe (`/api/v1/health`):** Retorna `200 OK` si el proceso Node.js está vivo y responde peticiones. **No debe consultar la base de datos.** Si la base de datos cae temporalmente, el liveness probe no debe fallar para evitar reinicios en cascada innecesarios.
- **Readiness Probe (`/api/v1/health/ready`):** Consulta activamente PostgreSQL (Prisma) y Redis. Retorna `200 OK` sólo si todas las dependencias críticas están listas para aceptar tráfico. Si falla, el orquestador (K8s/ALB) deja de enviarle tráfico sin destruir el contenedor.

---

## 99. Errores Operacionales vs Errores de Programación

- **Errores Operacionales:** Fallas esperadas en el funcionamiento normal del sistema (validación incorrecta, entidad no encontrada, timeout de API externa, rate limit alcanzado). Se manejan mediante tipos de error específicos y se mapean a respuestas semánticas.
- **Errores de Programación:** Bugs reales del código (acceso a `undefined`, llamadas a funciones inexistentes, violación de invariantes críticas). Son señales de un estado potencialmente corrupto.

---

## 100. Preservación de Causalidad (`Error Cause`)

Nunca captures un error de infraestructura para re-lanzar un error genérico perdiendo el stack trace original. Utilizá siempre la opción nativa `{ cause }`:

```typescript
try {
  await prisma.testimonial.create({ data });
} catch (error) {
  throw new PersistenceOperationError('No fue posible persistir el testimonio.', { cause: error });
}
```

---

## 101. Manejador de Errores Centralizado (Error Mapper)

Implementá un filtro global de excepciones en NestJS (`ExceptionFilter`) que transforme los errores del dominio en contratos Problem Details (RFC 9457):

```json
{
  "type": "https://errors.testimonial-cms.com/not-found",
  "title": "Testimonio no hallado",
  "status": 404,
  "detail": "El testimonio con ID 42 no existe para el tenant provisto.",
  "instance": "/api/v1/testimonials/42",
  "traceId": "c8a412b7-8902-4f67-8fa2-58e1c6b38942"
}
```

---

## 102. Gestión de `uncaughtException`

> [!CAUTION]
> Cuando se dispara un evento `uncaughtException`, el proceso Node.js se encuentra en un estado desconocido y potencialmente corrupto. **Nunca te limites a capturarlo con `console.log()` y continuar la ejecución normal.**

Acción requerida:
1. Registrar el error en el logger estructurado sincrónicamente.
2. Detener la recepción de nuevo tráfico.
3. Finalizar el proceso con `process.exit(1)` para que el supervisor externo lo reinicie limpiamente.

---

## 103. Gestión de `unhandledRejection`

Tratá toda promesa rechazada no capturada como una excepción no controlada: registrá el motivo del fallo, la traza completa y forzá la terminación controlada del proceso.

---

## 104. Graceful Shutdown (Apagado Elegante)

El backend debe capturar las señales del sistema operativo `SIGTERM` y `SIGINT` para apagarse de forma ordenada sin perder peticiones de clientes en vuelo:

```text
┌────────────────────────────────────────────────────────┐
│                   SEÑAL SIGTERM                        │
│                         │                              │
│                         ▼                              │
│   1. Marcar el servicio como NOT READY (/health/ready) │
│   2. Dejar de aceptar nuevas conexiones HTTP           │
│   3. Esperar que finalicen las peticiones en vuelo     │
│      (con un timeout de drenaje máximo de 10s)         │
│   4. Pausar y cerrar workers de BullMQ                 │
│   5. Cerrar pools de Prisma y conexiones Redis         │
│   6. Vaciar buffers de logs y trazas de OpenTelemetry  │
│   7. process.exit(0)                                   │
└────────────────────────────────────────────────────────┘
```

---

## 105. Procesos Desechables (Disposable Processes)

Diseñá cada instancia de Node.js bajo los preceptos de *Twelve-Factor App*:
- Procesos rápidos de iniciar (tiempo de arranque en frío < 3 segundos).
- Procesos rápidos de apagar de forma ordenada.
- Resiliencia delegada en la infraestructura externa y no en un único proceso inmortal.

---

## 106. Supervisión Externa de Procesos

No implementes lógica de reinicio automático dentro del propio código Node.js. Confiá en supervisores probados del sistema operativo y orquestadores: Docker restart policies, systemd, o Kubernetes pods.

---

## 107. Filosofía de Testing: Pruebas de Comportamiento

Priorizá pruebas centradas en el **comportamiento observable** (Black-box testing) antes que pruebas acopladas a la estructura interna o llamadas a métodos privados. Si refactorizás la implementación interna pero el comportamiento externo no cambia, los tests no deberían romperse.

---

## 108. Pruebas Unitarias (Unit Tests)

Reservá los tests unitarios puros para:
- Funciones de cálculo matemático y algoritmos de scoring.
- Invariantes de negocio puras en el dominio.
- Máquinas de estado del ciclo de vida de testimonios.

---

## 109. Pruebas de Casos de Uso (Use-Case Tests)

Testeá la orquestación del caso de uso inyectando dobles de prueba (Mocks o In-Memory Fakes) para los repositorios de Prisma y los servicios de red externos.

---

## 110. Pruebas de Integración con Infraestructura Real

Para componentes de persistencia críticos (Prisma Repositories) y procesadores de colas (BullMQ):
- Ejecutá las pruebas contra una base de datos **PostgreSQL 18 real** y una instancia de **Redis 7 real** (levantadas mediante Testcontainers o Docker Compose local).
- Verificá que las restricciones relacionales (`FOREIGN KEY`, `CHECK`, aislamiento multi-tenant por `tenant_id`) funcionen exactamente como en producción.

---

## 111. Pruebas End-to-End (E2E)

Validá los flujos de negocio más valiosos del sistema:
- Flujo completo de registro de administrador, login, emisión de JWT y refresco de tokens.
- Recepción de testimonio público, encolamiento en Outbox, moderación y publicación.

---

## 112. Runners de Pruebas

El stack del proyecto utiliza **Jest / Vitest** plenamente integrado con NestJS y soporte nativo para TypeScript. Para proyectos utilitarios ligeros, el runner nativo `node:test` de Node 24 es también una alternativa aprobada.

---

## 113. Pruebas de Carga (Load Testing)

Antes de promover cambios arquitectónicos a producción, ejecutá pruebas de carga con herramientas como **k6** o **autocannon**:
- Medí el throughput máximo sostenible (RPS).
- Evaluá los percentiles de latencia $p_{50}$, $p_{95}$ y $p_{99}$.
- Verificá que el Event Loop lag se mantenga dentro de los límites saludables bajo saturación.

---

## 114. Cuidado con los Benchmarks Sintéticos

No justifiques decisiones arquitectónicas basándote en afirmaciones genéricas de internet como *"el framework X es 3 veces más rápido que Y"*. El tiempo consumido en I/O de base de datos, serialización de datos y lógica de negocio domina el 95% de la latencia total; medí siempre tu carga de trabajo real.

---

## 115. Perfilado de Rendimiento (Profiling)

Ante problemas de degradación de latencia o consumo excesivo de memoria:
- Generá perfiles de CPU (`node --cpu-prof`).
- Analizá gráficos de llama (Flamegraphs) con herramientas como `clinic.js` o `0x`.
- Capturá Heap Snapshots para diagnosticar memory leaks identificando objetos retenidos en closures o maps.

---

## 116. Selección de Frameworks

- **NestJS 11 (Elección de este proyecto per ADR-0001):** Ideal para arquitecturas empresariales, equipos multidisciplinarios, inyección de dependencias madura y convenciones estandarizadas.
- **Fastify:** Adecuado para microservicios de altísimo rendimiento orientados a esquemas JSON.
- **Express:** Adecuado para aplicaciones heredadas o servicios de simplicidad extrema.

---

## 117. Monolitos vs Microservicios: Criterio Real

La extracción de un módulo hacia un microservicio independiente sólo se justifica ante una necesidad operacional demostrable:
- Requisitos de escalabilidad masivamente asimétricos.
- Requisitos de aislamiento de fallas físicas críticas.
- Diferentes equipos de ingeniería con ciclos de despliegue completamente autónomos.

---

## 118. Comunicación Intra-Monolith

Dentro del Modular Monolith, los módulos deben comunicarse mediante **llamadas a funciones TypeScript ordinarias** e inyección de contratos.

> [!WARNING]
> **No crees llamadas HTTP artificiales contra `localhost`** (ej. módulo `testimonials` haciendo un fetch HTTP a `http://localhost:3000/api/v1/users`) para comunicar módulos dentro del mismo proceso. Destruye el rendimiento, añade serialización innecesaria y complica el manejo de errores.

---

## 119. Comunicación Distribuida

Cuando los procesos estén físicamente desacoplados (ej. servidor HTTP vs worker de procesamiento de outbox):
- Utilizá colas durables (BullMQ) para comandos asíncronos.
- Utilizá HTTP REST firmado criptográficamente (HMAC-SHA256) para webhooks hacia el exterior.

---

## 120. Despliegue en Entornos Serverless

Si parte del backend se despliega en arquitecturas serverless (AWS Lambda / Cloud Run):
- Evaluá el impacto de los arranques en frío (*Cold Starts*).
- Gestioná el número de conexiones a PostgreSQL interponiendo proxies como PgBouncer o Prisma Accelerate.
- Evitá depender de memoria persistente en disco o estado compartido en RAM.

---

## 121. Contenedores de Producción (Docker Hardening)

El `Dockerfile` de producción debe respetar las mejores prácticas de seguridad:
- Basado en imágenes mínimas (`node:24-alpine` o Chainguard).
- Construcción multi-stage separando dependencias de build de dependencias de producción.
- Ejecución bajo el usuario sin privilegios `USER node`.
- Declaración explícita de `HEALTHCHECK`.

---

## 122. Estrategias de Despliegue

Adoptá despliegues con cero tiempo de inactividad (*Zero-Downtime Deployments*):
- **Rolling Updates:** Reemplazo gradual de réplicas asegurando que las nuevas instancias pasen el readiness probe antes de retirar las antiguas.
- **Blue-Green / Canary:** Para releases mayores con validación progresiva de tráfico.

---

## 123. Migraciones de Base de Datos Zero-Downtime

Separá el despliegue del código de la ejecución de migraciones de base de datos.
- Aplicá la regla de **Expand-Contract**:
  1. *Expand:* Añadí nuevas columnas o tablas como opcionales/compatibles hacia atrás.
  2. *Migrate:* Desplegá el nuevo código que escribe en las nuevas estructuras.
  3. *Contract:* Una vez estabilizado, remové las columnas o estructuras obsoletas en una migración separada.

---

## 124. Contratos de API Formales

Toda API pública debe estar respaldada por un contrato OpenAPI 3.1 formal generado automáticamente mediante Swagger (`@nestjs/swagger`) y tipado riguroso con TypeScript.

---

## 125. Versionado de APIs

Utilizá versionado explícito en la URI (`/api/v1/`). Cualquier cambio que rompa compatibilidad hacia atrás exige una nueva versión mayor (`/api/v2/`) y un período formal de deprecación.

---

## 126. Código Limpio y Expresivo

- Escribí funciones pequeñas, cohesivas y con una única responsabilidad clara.
- Nombres de variables y funciones explícitos que revelen su intención.
- Minimizá mutaciones innecesarias de estado; preferí inmutabilidad (`readonly`, `Object.freeze`).

---

## 127. Uso Obligatorio de Guard Clauses

Eliminá el anidamiento profundo de bloques `if/else` aplicando retornos tempranos (*Early Returns*):

```typescript
// ❌ INCORRECTO: Anidamiento profundo tipo "Pyramid of Doom"
function processTestimonial(testimonial: Testimonial | null, user: User | null) {
  if (testimonial) {
    if (user) {
      if (user.isActive) {
        if (testimonial.status === 'PENDING') {
          // Lógica...
        }
      }
    }
  }
}

// ✅ CORRECTO: Guard clauses limpias con fail-fast
function processTestimonial(testimonial: Testimonial | null, user: User | null) {
  if (!testimonial) throw new NotFoundError('Testimonio no hallado.');
  if (!user) throw new UnauthorizedError('Usuario no hallado.');
  if (!user.isActive) throw new ForbiddenError('El usuario se encuentra inactivo.');
  if (testimonial.status !== 'PENDING') throw new BusinessRuleError('El testimonio no está pendiente.');

  // Lógica principal al nivel cero de indentación
}
```

---

## 128. Principios SOLID Pragmáticos

- **Single Responsibility (SRP):** Un módulo o clase debe tener una única razón de cambio de negocio.
- **Dependency Inversion (DIP):** Los casos de uso dependen de abstracciones de persistencia, no de Prisma directamente.
- **Interface Segregation (ISP):** Interfaces pequeñas y específicas para cada consumidor.

---

## 129. DRY (Don't Repeat Yourself) Revisitado

DRY significa **no duplicar conocimiento de negocio ni decisiones de diseño**. No significa forzar una abstracción prematura sólo porque dos líneas de código se ven sintácticamente parecidas en módulos de dominios dispares.

---

## 130. KISS (Keep It Simple, Stupid)

Antes de incorporar una nueva tecnología o patrón arquitectónico, cuestioná críticamente:
- ¿Qué problema concreto del negocio resuelve hoy?
- ¿Podemos resolverlo limpiamente con una función pura o una consulta optimizada en PostgreSQL?

---

## 131. YAGNI (You Aren't Gonna Need It)

No agregues soporte para múltiples bases de datos, brokers hipotéticos ni arquitecturas distribuidas complejas basadas en especulaciones de lo que el sistema "podría llegar a requerir en dos años". Construí el código más simple y desacoplado que permita evolucionar cuando la necesidad sea real.

---

## 132. Convención de Idioma en Commits

Siguiendo el estándar canónico del proyecto (`SKL-DEV-GIT-001` y `AGENTS.md`):
- `type` y `scope` en **inglés** (`feat`, `fix`, `refactor`, `test`, `chore`, etc.).
- `description`, `body` y `footer` estrictamente en **español rioplatense con voseo formal**.
- **Prohibido:** Tuteo (`implementa`), ustedeo (`implemente`) e infinitivo (`implementar`).

```bash
# ✅ Ejemplo correcto
git commit -m "feat(testimonials): agregá el cálculo de score puro y desacoplado del transporte"
```

---

## 133. Convención de Comentarios en el Código

Los comentarios que expliquen el *por qué* de decisiones de diseño no evidentes deben escribirse en **español rioplatense formal con voseo**:

```typescript
// ✅ CORRECTO: Explicación de contexto con voseo formal
// Conservá un intento para el proveedor de failover secundario.
// Si agotás todo el presupuesto contra el principal,
// la recuperación ya no tendrá tiempo útil para ejecutarse.
const primaryRetries = totalRetries - 1;
```

---

## 134. Docstrings (TSDoc)

Utilizá documentación formal TSDoc en español rioplatense con voseo para describir use cases, funciones críticas de seguridad y adaptadores:

```typescript
/**
 * Publicá un evento pendiente de la outbox hacia la cola de BullMQ.
 *
 * Verificá la idempotencia antes de despacharlo porque el worker
 * puede reintentar la operación tras un timeout de red.
 *
 * @param event Evento persistido en estado PENDING.
 * @throws {OutboxDispatchError} Si Redis no confirma la recepción.
 */
export async function publishOutboxEvent(event: OutboxEvent): Promise<void> {
  // ...
}
```

---

## 135. Definition of Done (Criterios de Aceptación para Producción)

Una funcionalidad de backend se considera lista para producción únicamente cuando satisface:

### 1. Arquitectura y Diseño
- [ ] Pertenece a un módulo acotado claro (`src/modules/[feature]`).
- [ ] No existen dependencias circulares entre módulos.
- [ ] El transporte HTTP está completamente desacoplado del dominio de negocio.
- [ ] No se pasan objetos de request/response (`FastifyRequest`, `Express.Request`) a los use cases.

### 2. Runtime de Node.js
- [ ] No existen operaciones síncronas bloqueantes en el Event Loop.
- [ ] Tareas pesadas de CPU clasificadas y derivadas a Worker Threads o workers externos.
- [ ] Concurrencia acotada en todas las operaciones en lote (`p-limit` o batches).
- [ ] Memoria acotada: caches con TTL/LRU, buffers limitados.
- [ ] Streams utilizados para el manejo de archivos y payloads masivos.

### 3. Persistencia y Base de Datos
- [ ] Toda consulta a PostgreSQL incluye obligatoriamente el filtro de aislamiento `tenant_id`.
- [ ] Connection pool de Prisma configurado acorde a la infraestructura.
- [ ] Consultas analizadas para prevenir el problema N+1.
- [ ] Transacciones de base de datos ultracortas, sin llamadas de red externas en su interior.

### 4. Resiliencia
- [ ] Toda llamada HTTP externa cuenta con un timeout estricto (`AbortSignal.timeout`).
- [ ] Política de reintentos configurada con Exponential Backoff y Full Jitter sólo para fallos transitorios.
- [ ] Operaciones reintentadas protegidas con mecanismos de idempotencia.
- [ ] Circuit Breaker configurado para dependencias remotas inestables.
- [ ] Fallback seguro aplicado (Fail-Closed en seguridad, Fail-Safe en datos auxiliares).

### 5. Seguridad
- [ ] Esquemas de validación en tiempo de ejecución (Zod) en todas las fronteras de entrada.
- [ ] Protección contra SQL Injection garantizada mediante consultas parametrizadas de Prisma.
- [ ] Sin uso de `child_process.exec()` con strings no saneados.
- [ ] Sin riesgos de Path Traversal en el manejo de archivos.
- [ ] Secretos inyectados por variables de entorno; sin contraseñas ni tokens en el repositorio.
- [ ] Límites estrictos de tamaño en el body de peticiones HTTP.

### 6. Observabilidad
- [ ] Logging estructurado en formato JSON con Pino.
- [ ] Contexto de petición (`requestId`, `tenantId`, `userId`) propagado mediante `AsyncLocalStorage`.
- [ ] Información sensible (passwords, tokens, tarjetas) enmascarada en los logs.
- [ ] Monitoreo activo de métricas de salud y Event Loop lag.
- [ ] Endpoints `/api/v1/health` (liveness) y `/api/v1/health/ready` (readiness) desacoplados.

### 7. Ciclo de Vida y Operación
- [ ] Manejo de señales `SIGTERM` y `SIGINT` para Graceful Shutdown ordenado.
- [ ] Manejo seguro de `uncaughtException` y `unhandledRejection` con salida limpia y reinicio supervisado.
- [ ] Proceso completamente sin estado local en RAM, listo para escalado horizontal.

### 8. Testing
- [ ] Pruebas unitarias para reglas puras y cálculos de dominio.
- [ ] Pruebas de integración con PostgreSQL 18 y Redis 7 reales.
- [ ] Pruebas E2E para flujos críticos de negocio.
- [ ] Pruebas de carga ejecutadas para endpoints de alto tráfico.

---

## 136. Catálogo de Antipatrones

| Código | Antipatrón | Consecuencia en Producción |
| :--- | :--- | :--- |
| **NODE-01** | God `server.ts` / `main.ts`. | Acoplamiento extremo, imposibilidad de ejecutar tests de integración sin abrir puertos de red. |
| **NODE-02** | Lógica de negocio en controllers. | Código duplicado, difícil de testear, acoplado al framework de transporte. |
| **NODE-03** | Dominio dependiente de objetos HTTP (`req`, `res`). | Imposibilidad de invocar la lógica desde colas, CLI o sockets. |
| **NODE-04** | Variables globales mutables ocultas. | Condiciones de carrera entre peticiones concurrentes, memory leaks. |
| **NODE-05** | Arquitectura Hexagonal / DDD por pura ceremonia en CRUDs simples. | Sobreingeniería, decenas de archivos vacíos, lentitud en el desarrollo. |
| **NODE-06** | Microservicios prematuros por moda. | Latencia de red distribuida, fallas de consistencia, costo operacional inviable. |
| **NODE-07** | Creer que Node.js es simplemente "un único hilo". | Comprensión errónea del modelo de I/O de libuv y desaprovechamiento de workers. |
| **NODE-08** | Asumir que todo `async` corre en el thread pool de libuv. | Bloqueo inadvertido del Event Loop al ejecutar CPU pesada en funciones `async`. |
| **NODE-09** | Tareas intensivas de CPU en el Event Loop principal. | Caída vertical de throughput, latencias $p_{99}$ inaceptables, DoS. |
| **NODE-10** | Uso de APIs síncronas (`fs.readFileSync`, etc.) durante peticiones HTTP. | Congelamiento absoluto de todas las peticiones concurrentes en el servidor. |
| **NODE-11** | Instanciar un `new Worker()` por cada petición entrante. | Sobrecarga extrema de memoria y CPU por inicialización continua de V8 Isolates. |
| **NODE-12** | `Promise.all()` ilimitado sobre colecciones grandes. | Agotamiento de conexiones a la base de datos, colapso de PostgreSQL. |
| **NODE-13** | Cargar archivos enteros o buffers masivos en memoria RAM. | Out-Of-Memory (`heap out of memory`), reinicio abrupto del contenedor. |
| **NODE-14** | Caché en memoria con `Map` sin límite de tamaño ni TTL. | Fuga de memoria progresiva hasta la caída del proceso. |
| **NODE-15** | Utilizar `EventEmitter` como si fuera un Message Broker durable. | Pérdida irrecuperable de eventos y tareas ante cualquier reinicio del servidor. |
| **NODE-16** | Tareas programadas críticas con `setInterval()` en servidores multi-réplica. | Ejecución duplicada concurrente en cada réplica y pérdida de tareas al reiniciar. |
| **NODE-17** | Reintentos automáticos sobre operaciones no idempotentes. | Duplicación de pagos, órdenes o registros en la base de datos. |
| **NODE-18** | Reintentos con intervalos fijos sin Jitter. | *Thundering herd*: avalancha de peticiones sincronizadas que saturan el backend. |
| **NODE-19** | Fallback de seguridad configurado como *Fail-Open*. | Brecha de seguridad crítica: permitir acceso no autorizado ante caídas de red. |
| **NODE-20** | Asumir que usar Node.js implica consistencia eventual ($AP$). | Error conceptual: la consistencia depende de la base de datos y la transacción. |
| **NODE-21** | Concatenación de strings crudos para consultas SQL. | Vulnerabilidad crítica de Inyección SQL. |
| **NODE-22** | Creer que validar con Zod previene inyecciones SQL o de comandos. | Falsa sensación de seguridad; Zod valida tipos, no la semántica de la consulta. |
| **NODE-23** | Enviar errores internos o stack traces en respuestas al cliente. | Fuga de información sensible sobre la infraestructura interna. |
| **NODE-24** | `console.log()` como único mecanismo de observabilidad. | Pérdida de contexto de petición, logs desestructurados e imposibles de indexar. |
| **NODE-25** | Ignorar el Event Loop lag como métrica de salud. | Incapacidad para detectar degradaciones críticas de CPU antes del colapso. |
| **NODE-26** | Ignorar `uncaughtException` y continuar ejecutando el proceso. | Corrupción de estado en memoria y comportamiento impredecible del servidor. |
| **NODE-27** | Apagado abrupto sin manejo de `SIGTERM` (Graceful Shutdown). | Peticiones de clientes cortadas a la mitad, transacciones incompletas. |
| **NODE-28** | Almacenar estado de sesión en memoria local en clusters multi-instancia. | Inconsistencia de sesión: el usuario es deslogueado al caer en otra réplica. |
| **NODE-29** | Instalar paquetes npm externos para cualquier utilidad trivial de 2 líneas. | Inflado de la superficie de ataque de la cadena de suministro (*supply chain*). |
| **NODE-30** | Optimización prematura sin haber medido ni perfilado el sistema. | Complejidad innecesaria en código que no representa ningún cuello de botella real. |

---

## 137. Métricas y KPIs de Producción

| Métrica / KPI | Meta de Producción |
| :--- | :--- |
| **Operaciones bloqueantes de CPU en el Event Loop** | **0** |
| **Concurrencia asíncrona ilimitada (`Promise.all` masivo)** | **0** |
| **Cachés en memoria sin límite de tamaño (LRU) o TTL** | **0** |
| **Peticiones HTTP sin identificador de correlación (`requestId`)** | **0** |
| **Llamadas a servicios remotos externos sin timeout configurado** | **0** |
| **Workers de background jobs críticos sin manejo de idempotencia** | **0** |
| **Errores fatales (`uncaughtException`) ignorados sin salida limpia** | **0** |
| **Instancias en producción sin manejo de Graceful Shutdown (`SIGTERM`)** | **0** |
| **Secretos o credenciales persistidos en código o imágenes Docker** | **0** |
| **Hallazgos críticos de seguridad OWASP en auditorías** | **0** |
| **Consultas con el problema N+1 conocidas en endpoints de producción** | **0** |
| **Consultas a la base de datos sin filtro de aislamiento `tenant_id`** | **0** |
| **Event Loop Lag en el percentil 99 ($p_{99}$)** | **< 20 ms** |
| **Latencia $p_{95}$ en endpoints críticos de lectura** | **< 150 ms** |

---

## 138. Protocolo Senior de Diseño (Preguntas Previas a la Implementación)

Antes de escribir una sola línea de código para una nueva funcionalidad, respondé:

```text
1.  ¿Qué dominio de negocio representa y a qué bounded module pertenece?
2.  ¿La operación es I/O-bound o CPU-bound?
3.  ¿Existe algún riesgo de bloquear el Event Loop con parseos o cálculos pesados?
4.  ¿Cuál es el tamaño máximo de payload que el endpoint puede recibir?
5.  ¿Cuánta memoria RAM puede llegar a consumir el procesamiento en el peor escenario?
6.  ¿Qué nivel de concurrencia máxima soporta la base de datos para esta operación?
7.  ¿La operación puede ser cancelada si el cliente desconecta el socket?
8.  ¿Qué timeout defensivo necesita cada llamada de red externa involucrada?
9.  ¿Qué ocurre si la dependencia externa falla o arroja un error 503?
10. ¿La operación puede reintentarse con seguridad?
11. ¿Es una mutación idempotente? ¿Qué sucede si se ejecuta dos veces con el mismo input?
12. ¿Requiere una transacción atómica en PostgreSQL?
13. ¿Requiere publicar un evento de negocio durable? ¿Se utilizó el patrón Outbox?
14. ¿Qué ocurre si el proceso sufre un crash inmediatamente después del commit de la base de datos?
15. ¿Los datos deben almacenarse en caché? ¿Cuál es la clave, el TTL y la estrategia de invalidación?
16. ¿Qué estado vive en memoria volátil y cómo impacta si existen 10 réplicas del contenedor?
17. ¿Cómo se garantiza el aislamiento multi-tenant estricto por tenant_id?
18. ¿Qué información exacta debe registrarse en los logs estructurados?
19. ¿El logger enmascara automáticamente contraseñas, tokens y datos sensibles?
20. ¿Cómo se correlaciona la traza entre el servidor HTTP y el worker de background?
21. ¿Qué métricas específicas revelarán si la feature está funcionando correctamente?
22. ¿Cómo se apaga de forma limpia la operación ante una señal SIGTERM?
23. ¿Cómo probamos el camino de falla en los tests de integración con PostgreSQL real?
```

---

## 139. Matriz de Decisión Tecnológica

| Necesidad de Ingeniería | Primera Opción Recomendada | Justificación Técnica |
| :--- | :--- | :--- |
| **I/O concurrente (DB, HTTP, Redis)** | APIs asíncronas de Node.js (`async`/`await`) | El Event Loop de Node.js está optimizado para I/O no bloqueante. |
| **Cómputo intensivo de CPU en JavaScript** | Worker Threads con Worker Pool (`node:worker_threads`) | Aísla el trabajo pesado fuera del Event Loop en hilos paralelos de V8. |
| **Manipulación o exportación de grandes volúmenes de datos** | Streams (`node:stream/promises` y `pipeline`) | Procesa los datos en fragmentos acotados (chunks) evitando picos de RAM. |
| **Caché compartida y contadores efímeros** | Redis 7 | Estructuras en memoria ultrarrápidas, atómicas y compartidas entre réplicas. |
| **Tareas en background durables y diferidas**| BullMQ sobre Redis 7 | Soporte nativo para colas durables, reintentos con backoff y control de concurrencia. |
| **Consistencia entre persistencia y eventos** | Transactional Outbox Pattern | Evita inconsistencias de doble escritura garantizando entrega At-Least-Once. |
| **Reintentos seguros ante fallas transitorias**| Exponential Backoff con Full Jitter + Idempotencia | Previene el thundering herd y asegura que no existan mutaciones duplicadas. |
| **Dependencia externa remota inestable** | Circuit Breaker + Timeout estricto | Fast-fail temprano para evitar saturación de sockets locales. |
| **Propagación de contexto por petición** | `AsyncLocalStorage` (`node:async_hooks`) | Mantiene el contexto (`requestId`, `tenantId`) sin requerir prop-drilling manual. |
| **Hardening de procesos locales** | Node.js Permission Model + Contenedor Non-root | Reduce la superficie de ataque aplicando el principio de menor privilegio. |
| **Arquitectura de aplicación base** | Modular Monolith (NestJS 11) | Excelente balance entre cohesión, velocidad de desarrollo y simplicidad operativa. |
| **Dominio de negocio con reglas complejas** | Functional Core / Imperative Shell + DDD pragmático | Separa la lógica pura del transporte e I/O, maximizando la testeabilidad. |

---

## 140. Cheat Sheet — Las 30 Reglas de Oro

1. **Entendé el Event Loop** antes de intentar optimizar el rendimiento de Node.js.
2. **No bloquees el Event Loop** ni agotes el thread pool interno de libuv.
3. **Clasificá toda operación:** I/O-bound usa APIs asíncronas; CPU-bound usa Worker Threads.
4. **Worker Threads son para CPU, no para I/O común:** crear workers para peticiones de base de datos es un desperdicio.
5. **Controlá la concurrencia:** jamás ejecutes `Promise.all()` ilimitado sobre arrays grandes.
6. **Usá Streams para grandes volúmenes de datos:** procesá por chunks y respetá el backpressure.
7. **Limitá memoria y tamaños de payload:** establecé topes máximos en bodies, colecciones y paginación.
8. **Empezá siempre con un Modular Monolith:** no dividas en microservicios sin una justificación operacional probada.
9. **Organizá el código por dominios (Feature-Oriented):** no por capas técnicas globales.
10. **Mantené el protocolo de transporte fuera del dominio:** nunca pases objetos HTTP a los casos de uso.
11. **Inyección de dependencias explícita:** evitá variables globales mágicas y service locators ocultos.
12. **Las funciones y closures son suficientes:** no uses clases complejas donde una función pura resuelve el problema.
13. **No obligues el patrón Repository para CRUDs triviales:** la simplicidad manda si no hay reglas que aislar.
14. **Hexagonal y DDD sólo cuando aporten valor real:** no apliques ceremonia arquitectónica en modelos anémicos.
15. **Validá toda frontera externa en runtime con Zod:** TypeScript no existe en tiempo de ejecución.
16. **Validar un esquema no previene inyecciones:** parametrizá siempre las consultas y desconfiá del input.
17. **`EventEmitter` no es un broker de mensajería:** los eventos en memoria mueren si el proceso se reinicia.
18. **Los background jobs críticos deben ser durables e idempotentes:** tolerá duplicados y reintentos.
19. **Toda llamada remota exige un timeout estricto:** jamás permitas que una conexión quede colgada.
20. **Reintentos exigen backoff con jitter e idempotencia:** de lo contrario, duplicarás mutaciones o tumbarás el servicio.
21. **Toda caché en memoria requiere límite de tamaño y TTL:** previene fugas de memoria silenciosas.
22. **El estado local en RAM no es estado distribuido:** diseñá procesos sin estado para permitir escalado horizontal.
23. **Propagá el contexto con `AsyncLocalStorage`:** correlacioná peticiones sin contaminar las firmas de métodos.
24. **Logs estructurados en JSON, métricas RED y trazabilidad distribuida:** observabilidad real de producción.
25. **Medí el Event Loop lag:** es el pulsorreal de la salud de tu servidor Node.js.
26. **Ante un error de programación fatal (`uncaughtException`), finalizá limpiamente:** no intentes parchar un estado corrupto.
27. **Los procesos deben ser desechables y supervisados externamente:** reinicio rápido gestionado por Docker/K8s.
28. **Comunican intra-monolito con funciones TypeScript:** cero HTTP artificial contra `localhost`.
29. **SOLID, DRY, KISS y YAGNI se aplican con pragmatismo:** no sacrifiques la claridad en nombre de dogmas teóricos.
30. **La mejor arquitectura es la más simple que garantice seguridad, límites acotados y operabilidad confiable.**

---

## 141. Regla Rectora de Arquitectura

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                          A NIVEL RUNTIME                                │
│                                                                         │
│   Incoming Request                                                      │
│          │                                                              │
│          ▼                                                              │
│     Event Loop ───► Non-blocking OS I/O (epoll / kqueue / IOCP)         │
│          │                                                              │
│          ├───► libuv Worker Pool (fs, crypto, dns, zlib)                │
│          └───► Dedicated Worker Pool (CPU-bound heavy tasks)            │
├─────────────────────────────────────────────────────────────────────────┤
│                        A NIVEL APLICACIÓN                               │
│                                                                         │
│   Transport Layer (Controllers / HTTP / Validation Pipes)               │
│          │                                                              │
│          ▼                                                              │
│   Application Layer (Use Cases / Command Handlers / Ports)              │
│          │                                                              │
│          ▼                                                              │
│   Domain Layer (Functional Core / Pure Invariants / Entities)           │
│          ▲                                                              │
│          │ (Dependency Inversion)                                       │
│   Infrastructure Adapters (Prisma / Redis / BullMQ / External APIs)     │
├─────────────────────────────────────────────────────────────────────────┤
│                       A NIVEL ORGANIZACIÓN                              │
│                                                                         │
│   Bounded Modules (src/modules/):                                       │
│   • auth                                                                │
│   • testimonials                                                        │
│   • webhooks                                                            │
│   • tenants                                                             │
│   • users                                                               │
│   • analytics                                                           │
│   (¡Dominio de negocio primero, no carpetas puramente técnicas!)        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 142. Resultado Esperado

Una aplicación construida e instrumentada bajo los estándares de **SKL-NODE-BACKEND-001** es:

- **Event-loop aware & Non-blocking:** Respeta religiosamente el modelo cooperativo de Node.js, manteniendo el Event Loop libre de trabajo síncrono pesado.
- **CPU & Memory-bounded:** Delimita el uso de recursos con pools de workers, streams con backpressure y cachés LRU con límites estrictos.
- **Feature-oriented & Modular:** Organizada en módulos de negocio desacoplados dentro de un monolito modular mantenible y legible.
- **Dependency-explicit & Framework-decoupled:** Aísla las reglas de negocio del framework de transporte (NestJS) y del ORM (Prisma).
- **Multi-tenant Safe:** Aplica aislamiento estricto por `tenant_id` en todas y cada una de las operaciones de base de datos.
- **Resilient & Idempotent:** Equipada con timeouts, reintentos con exponential backoff y full jitter, circuit breakers y procesamiento de eventos idempotente.
- **Observable & Traceable:** Provee logs estructurados en JSON con contexto de request enriquecido mediante `AsyncLocalStorage`, métricas de Event Loop lag y trazabilidad OpenTelemetry.
- **Secure-by-Design:** Valida todas las fronteras externas en tiempo de ejecución con Zod, aplica el principio de menor privilegio y mitiga activamente las vulnerabilidades del OWASP Top 10.
- **Gracefully Terminable:** Responde a señales `SIGTERM` y `SIGINT` drenando el tráfico ordenadamente sin corromper datos ni abortar transacciones.
- **Operationally Boring:** Funciona de manera predecible, estable y silenciosa en producción, facilitando el diagnóstico rápido ante cualquier anomalía.
