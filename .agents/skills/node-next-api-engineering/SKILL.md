---
name: node-next-api-engineering
description: >-
  Diseño, implementación, optimización y operación de APIs HTTP de alto rendimiento con Node.js, NestJS y Next.js (código SKL-API-NODE-NEXT-001). Usar cuando se requiera diseñar contratos REST y OpenAPI, semántica HTTP (RFC 9110/9111/9112), Problem Details (RFC 9457), arquitectura modular en NestJS (Modules, Controllers, Providers, Guards, Interceptors, Filters), idempotencia con Idempotency-Key, paginación por cursor, caché multicapa (ETag, stale-while-revalidate), resiliencia (timeouts, backoff con jitter, circuit breaker), seguridad OWASP API Top 10 (BOLA, SSRF) y observabilidad (OpenTelemetry, RED metrics, Pino).
---

# Especificación Técnica de Habilidad: Senior Node.js, NestJS & Next.js API Engineering

---

**Código de Skill:** SKL-API-NODE-NEXT-001  
**Nombre:** Senior Node.js, NestJS & Next.js API Engineering  
**Versión:** 1.1.0  
**Nivel:** Senior / Production Engineering  
**Dominio:** Backend / APIs / Node.js / NestJS / Next.js / Sistemas Distribuidos  
**Estándares principales:** HTTP Semantics RFC 9110 / HTTP Caching RFC 9111 / HTTP/1.1 RFC 9112 / Problem Details RFC 9457 / OpenAPI 3.2 / OWASP API Security Top 10:2023 / OpenTelemetry / SOLID / DRY / KISS / YAGNI / Agile DoD  

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, revisión, optimización y operación de APIs HTTP de alto rendimiento. |
| **Objetivo** | Construir APIs en Node.js, NestJS y Next.js eficientes, seguras, observables, resilientes, escalables y evolutivas. |
| **Protocolos** | HTTP/1.1, HTTP/2, HTTP/3 sobre TLS. |
| **Formato Principal** | JSON estructurado (RFC 8259). |
| **Arquitecturas** | REST, BFF (Backend-for-Frontend), API Gateway, Modular Monolith, Clean/Hexagonal Architecture, Microservicios. |
| **Runtime & Frameworks** | Node.js LTS (20+/24+) / NestJS 11+ (Fastify/Express) / Next.js App Router (Node Runtime). |
| **Modelo de Ejecución** | Event-driven, non-blocking I/O, asincronía cooperativa. |
| **Prioridades** | Correctitud → Seguridad → Contrato → Resiliencia → Observabilidad → Rendimiento → Escalabilidad → Simplicidad. |
| **Modelo de Calidad** | Production-ready / Zero-Trust. |

---

## 2. Filosofía de Diseño

Una API profesional no es solamente una colección de endpoints desorganizados. Debe ser simultáneamente:
```text
Contrato formal
+
Producto para desarrolladores
+
Frontera de seguridad (Security Boundary)
+
Sistema distribuido tolerante a fallos
+
Componente observable
+
Componente operable y mantenible
```

### 2.1. Principios Rectores
Toda implementación debe satisfacer:
- **API First / Contract First:** El diseño del contrato OpenAPI precede al código.
- **Secure by Design & Least Privilege:** Denegación por defecto y autorización autoritativa en cada endpoint.
- **Stateless:** Estados efímeros fuera del proceso de aplicación para permitir escalado horizontal.
- **Explicit over implicit & Fail fast / Fail safe:** Validación inmediata en fronteras de red.
- **Bounded Resource Consumption:** Límites estrictos de memoria, CPU, tiempo y payloads.
- **Observability by Design:** Trazabilidad, métricas y logs estructurados de origen.
- **Backward Compatibility:** Evolución continua sin romper contratos con clientes en producción.
- **Idempotency & Graceful Degradation:** Resiliencia ante fallos parciales de red.

### 2.2. Paradigmas de Programación Pragmáticos
- **Functional Core / Imperative Shell:** La lógica central de negocio debe residir en funciones o entidades puras y deterministas. Los efectos secundarios (HTTP, base de datos, colas, Redis, filesystem, reloj) se confinan al shell exterior (Controllers, Repositorios, Adaptadores).
- **Inyección de Dependencias Explícita (NestJS / Pure DI):** Facilitar desacoplamiento, pruebas automatizadas y sustitución de infraestructura mediante Providers y Tokens bien tipados.
- **Event-Driven Programming:** Aprovechar el Event Loop de Node.js coordinando I/O no bloqueante. El trabajo síncrono en cada callback debe ser mínimo.
- **Programación Declarativa:** Esquemas de validación (Zod / class-validator), decoradores OpenAPI (`@nestjs/swagger`), pipes de transformación y guards de autorización.

### 2.3. Metodología de Desarrollo en Cascada Inversa
```text
Contrato OpenAPI
  ↓
Threat Modeling & OWASP Review
  ↓
Modelo de Dominio & Validadores Zod / DTOs
  ↓
Implementación de Handlers / Controllers & Use Cases
  ↓
Tests Unitarios, Integración & Contrato
  ↓
Instrumentación de Observabilidad (Pino / OTel)
  ↓
Pruebas de Carga (k6 / Autocannon)
  ↓
Despliegue & Monitoreo en Producción
```

---

## 3. Arquitectura Cliente-Servidor

```text
CLIENTE (Frontend Next.js, Móvil, Integración B2B)
   │
   │ HTTP Request (TLS, Headers, Body)
   ▼
SERVER / GATEWAY (NestJS / Node.js Standalone / Next.js BFF)
   │
   ├── Transport Layer (Parsing, Compression, CORS, TLS Termination)
   ├── Authentication Layer (Guards, API Key, JWT, Session Verification)
   ├── Validation Layer (Pipes, Zod / DTO Runtime Contract Checking)
   ├── Authorization Layer (Guards, RBAC / Scopes / Tenant Isolation)
   ├── Application Layer (Commands, Queries, Use Cases, Interceptors)
   ├── Domain Layer (Business Invariants & Pure Calculations)
   ├── Persistence Layer (Connection Pools, Repositories, TypeORM / Prisma / DAL)
   └── External Integrations (Queues, Webhooks, Third-party APIs)
   │
   ▼
HTTP Response (Status Code, ETag, Cache-Control, Problem Details RFC 9457)
```
El cliente y el servidor permanecen estrictamente desacoplados mediante un contrato de red explícito e inmutable.

---

## 4. Diseño REST y Modelado de Recursos

#### [RF-01] Las URLs Representan Recursos Sustantivos
- ❌ **Malo (Verbos RPC en URLs):**
  ```http
  POST /crearUsuario
  POST /eliminarProducto
  GET  /buscarPedido
  ```
- ✅ **Bueno (Sustantivos + Métodos HTTP):**
  ```http
  POST   /users
  DELETE /products/{id}
  GET    /orders/{id}
  ```

### 4.1. Convenciones de Enrutamiento
- Plural consistente: `/api/v1/users`, `/api/v1/orders`.
- Minúsculas y guiones medios (*kebab-case*): `/order-items`.
- Jerarquías poco profundas (máximo 2 niveles de anidamiento):
  ```http
  // ✅ Recomendado:
  GET /orders/{orderId}/items
  
  // ❌ Evitar anidamiento excesivo:
  GET /companies/1/departments/4/users/19/orders/81/items/2
  ```

---

## 5. Semántica Rigurosa de Métodos HTTP

| Método | Semántica | Safe | Idempotente | Uso Principal |
| :--- | :--- | :---: | :---: | :--- |
| **GET** | Lectura | **Sí** | **Sí** | Consulta de recursos. **Nunca debe mutar estado ni tener efectos secundarios.** |
| **POST** | Creación / Comando | No | No | Inserción de recursos o ejecución de comandos no idempotentes por defecto. |
| **PUT** | Reemplazo total | No | **Sí** | Sustitución completa de la representación del recurso. |
| **PATCH** | Modificación parcial | No | No* | Actualización de un subconjunto de campos del recurso. |
| **DELETE** | Eliminación | No | **Sí** | Borrado lógico o físico de un recurso. |
| **HEAD / OPTIONS** | Metadatos / Preflight | **Sí** | **Sí** | Inspección de cabeceras y negociación CORS. |

---

## 6. Idempotencia y Reintentos Seguros

Toda API distribuida debe contemplar la recepción de solicitudes duplicadas debido a cortes de red o reintentos del cliente.

#### [RF-02] Mutaciones Críticas Respaldadas por `Idempotency-Key`
```http
POST /api/v1/payments
Idempotency-Key: 80728944-7e8c-4f9a-9e12-3b8c4d2e1a0f
```

### 6.1. Implementación Idiomática en NestJS con Interceptor
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  ConflictException,
  Inject,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createHash } from 'node:crypto';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(@Inject('IDEMPOTENCY_STORE') private readonly store: any) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey || request.method !== 'POST') {
      return next.handle();
    }

    const payloadHash = createHash('sha256')
      .update(JSON.stringify(request.body ?? {}))
      .digest('hex');

    const record = await this.store.get(idempotencyKey);

    if (record) {
      if (record.payloadHash !== payloadHash) {
        throw new ConflictException(
          'La clave de idempotencia ya fue utilizada con un cuerpo de solicitud diferente.',
        );
      }
      // Retornar la respuesta original en caché sin reprocesar
      return of(record.response);
    }

    return next.handle().pipe(
      tap(async (response) => {
        await this.store.set(
          idempotencyKey,
          { payloadHash, response },
          86400, // TTL de 24 horas
        );
      }),
    );
  }
}
```

---

## 7. Catálogo Semántico de Códigos de Estado HTTP

| Código | Significado | Escenario de Uso |
| :--- | :--- | :--- |
| **200 OK** | Éxito con contenido | Respuesta a GET, PUT o PATCH exitosos. |
| **201 Created** | Recurso creado | Respuesta a POST con cabecera `Location: /api/v1/orders/{id}`. |
| **202 Accepted** | Aceptado asíncrono | Tarea encolada para procesamiento posterior de larga duración. |
| **204 No Content** | Éxito sin cuerpo | Respuesta exitosa a DELETE o actualizaciones sin retorno. |
| **304 Not Modified** | Caché válida | El recurso no ha cambiado (`If-None-Match` coincide con `ETag`). |
| **400 Bad Request** | Petición malformada | Error sintáctico de JSON o cabeceras incompatibles. |
| **401 Unauthorized** | No autenticado | Credencial ausente, inválida o expirada. |
| **403 Forbidden** | No autorizado | Credencial válida pero sin permisos sobre el recurso/tenant. |
| **404 Not Found** | No encontrado | El recurso solicitado no existe o está oculto por seguridad. |
| **409 Conflict** | Conflicto de estado | Invariante rota, clave de idempotencia duplicada con payload dispar. |
| **412 Precondition Failed** | Precondición fallida | Concurrencia optimista (`If-Match` no coincide con la versión actual). |
| **422 Unprocessable Entity** | Error semántico | JSON sintácticamente válido pero rechaza validación de negocio (Zod). |
| **429 Too Many Requests** | Límite de tasa | Rate limit o cuota excedida (`Retry-After` presente). |
| **500 Internal Server Error** | Error no controlado | Excepción imprevista o bug en el código del servidor. |
| **502 Bad Gateway** | Upstream inválido | Error en servidor intermedio o servicio downstream. |
| **503 Service Unavailable** | Servicio indisponible | Sobrecarga temporal, mantenimiento o saturación de cola (*load shedding*). |
| **504 Gateway Timeout** | Timeout upstream | La base de datos o servicio externo no respondió dentro del latency budget. |

> **Prohibición estricta:** **NUNCA** devolver `{ "success": false, "error": "...", "status": 200 }`. Los errores deben utilizar códigos de estado HTTP 4xx y 5xx.

---

## 8. Formato de Cargas Útiles JSON

#### [RF-03] Respuestas Consistentes y Tipadas
- Para recursos individuales, retornar directamente el objeto sin envoltorios innecesarios:
  ```json
  {
    "id": "usr_123",
    "name": "Facundo",
    "email": "facundo@example.com"
  }
  ```
- Para colecciones y listados con paginación, estandarizar:
  ```json
  {
    "data": [
      { "id": "usr_123", "name": "Facundo" }
    ],
    "meta": {
      "total": 150,
      "page": 1,
      "limit": 25,
      "nextCursor": "eyJpZCI6..."
    }
  }
  ```

### 8.1. Convenciones de Datos
- Propiedades en **`camelCase`**.
- Fechas y timestamps en **ISO 8601 UTC** estricto: `2026-09-18T00:55:00.000Z`.
- Valores monetarios en enteros de menor denominación (*minor units*) o decimal seguro:
  ```json
  { "amountMinor": 159900, "currency": "ARS" }
  ```
  *Prohibido utilizar floats primitivos de JavaScript para cálculos financieros.*

---

## 9. Arquitectura de Errores con Problem Details (RFC 9457)

#### [RF-04] Adopción de `application/problem+json`
```http
HTTP/1.1 422 Unprocessable Entity
Content-Type: application/problem+json
```
```json
{
  "type": "https://errors.example.com/validation-error",
  "title": "La solicitud contiene datos inválidos",
  "status": 422,
  "detail": "El correo electrónico provisto no cumple con el formato corporativo.",
  "instance": "/requests/req_01JM9K...",
  "code": "VALIDATION_FAILED",
  "errors": [
    {
      "field": "email",
      "message": "Debe ingresar una dirección de correo válida."
    }
  ]
}
```

### 9.1. Implementación Idiomática en NestJS (Global Exception Filter)
```typescript
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const isHttp = exception instanceof HttpException;
    const status = isHttp ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const exceptionResponse = isHttp ? exception.getResponse() : null;

    const requestId = request.headers['x-request-id'] || 'req_unknown';

    // Log estructurado del error
    if (status >= 500) {
      this.logger.error({
        requestId,
        url: request.url,
        method: request.method,
        error: exception instanceof Error ? exception.stack : exception,
      });
    }

    const problem = {
      type: `https://api.miapp.com/errors/${this.resolveErrorCode(status)}`,
      title: isHttp ? exception.message : 'Error interno del servidor',
      status,
      detail: status >= 500 ? 'Ocurrió un error inesperado al procesar la solicitud.' : this.extractDetail(exceptionResponse),
      instance: `/requests/${requestId}`,
      code: this.resolveErrorCode(status),
      ...(status === 422 && typeof exceptionResponse === 'object' && 'errors' in (exceptionResponse as any)
        ? { errors: (exceptionResponse as any).errors }
        : {}),
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .send(problem);
  }

  private resolveErrorCode(status: number): string {
    switch (status) {
      case 400: return 'BAD_REQUEST';
      case 401: return 'UNAUTHENTICATED';
      case 403: return 'UNAUTHORIZED';
      case 404: return 'NOT_FOUND';
      case 409: return 'CONFLICT';
      case 422: return 'VALIDATION_ERROR';
      case 429: return 'RATE_LIMIT_EXCEEDED';
      default: return 'INTERNAL_ERROR';
    }
  }

  private extractDetail(res: any): string {
    if (typeof res === 'string') return res;
    if (res && typeof res === 'object' && 'message' in res) {
      return Array.isArray(res.message) ? res.message.join('; ') : res.message;
    }
    return 'Revisá los datos provistos.';
  }
}
```

---

## 10. Operaciones Asincrónicas de Larga Duración

Para procesos pesados que superen unos pocos segundos (generación de informes masivos, exportaciones, análisis de video), **no mantener la conexión HTTP abierta**.
```text
POST /api/v1/reports
  ↓
HTTP 202 Accepted
Location: /api/v1/jobs/job_123
Retry-After: 10
  ↓
GET /api/v1/jobs/job_123
  ↓
{ "status": "completed", "resultUrl": "https://storage.example.com/reports/..." }
```

---

## 11. Estrategias de Paginación

Toda colección potencialmente grande debe estar paginada obligatoriamente.

### Offset Pagination (`limit` / `offset`)
Apropiada para paneles administrativos pequeños con saltos a páginas específicas:
```http
GET /users?limit=25&offset=50
```

### Cursor Pagination (`cursor` / `limit`)
**Recomendada para datasets de alto volumen, feeds y APIs públicas:**
```http
GET /events?limit=50&cursor=eyJpZCI6IjEyMyIsImNyZWF0ZWRBdCI6MTcwMDAwMDAwfQ==
```
- **Ventajas:** Escala de forma constante sin importar la profundidad de la consulta; inmune a desplazamientos por inserciones concurrentes; elimina la lentitud de sentencias `OFFSET` en SQL.

---

## 12. Filtrado, Ordenamiento y Selección de Campos

```http
GET /api/v1/orders?status=pending&sort=-createdAt&fields=id,total,status&limit=50
```
- **Allowlist obligatoria:** Validar campos de ordenamiento permitidos antes de consultar la base de datos:
  ```typescript
  const ALLOWED_SORT_FIELDS = new Set(['createdAt', 'total', 'status']);
  if (!ALLOWED_SORT_FIELDS.has(sortField)) {
    throw new BadRequestException(`Campo de ordenamiento no permitido: ${sortField}`);
  }
  ```
- **Prohibición estricta:** **Nunca** interpolar strings directamente en `ORDER BY ${req.query.sort}` en consultas SQL.

---

## 13. Estrategias de Versionado de APIs

#### [RF-05] APIs Públicas con Estrategia de Evolución Explícita
- **URL Path Versioning (Recomendado para la mayoría de sistemas):**
  `/api/v1/users` y `/api/v2/users`. Explícito, compatible con proxies y fácil de enrutar tanto en NestJS (`enableVersioning({ type: VersioningType.URI })`) como en Next.js.
- **Header / Media-Type Versioning:** `Accept: application/vnd.miapp.v2+json`.

### 13.1. Política de Cambios Breaking y Deprecación
- Nunca eliminar un campo o alterar tipos sin emitir una nueva versión mayor de API.
- Todo endpoint deprecado debe incluir cabeceras estándar de aviso:
  ```http
  Deprecation: @1773800000
  Sunset: Tue, 01 Dec 2026 00:00:00 GMT
  Link: <https://api.miapp.com/v2/orders>; rel="successor-version"
  ```

---

## 14. Caché Multicapa (L0 - L4)

```text
L0: Request-local Memoization (Map efímero / AsyncLocalStorage)
L1: In-Memory Cache de Proceso (LRU Cache acotada, TTL estricto)
L2: Distributed Cache (Redis Cluster con serialización JSON / MessagePack)
L3: HTTP Reverse Proxy (Nginx / Cloudflare / Varnish con Cache-Control)
L4: Edge / CDN (Cloudflare Workers, AWS CloudFront para assets y JSON estático)
```

### 14.1. Concurrencia Optimista con ETag y Condicionales
```http
// Respuesta de lectura
HTTP/1.1 200 OK
ETag: "rev-01jm9k..."
Cache-Control: private, max-age=60

// Petición condicional del cliente
PUT /api/v1/documents/doc_123
If-Match: "rev-01jm9k..."

// Si el documento cambió entretanto:
HTTP/1.1 412 Precondition Failed
```

---

## 15. Caching en Next.js App Router

En Route Handlers (`app/api/**/route.ts`), las peticiones `GET` no deben asumirse automáticamente cacheadas:
- Configurar revalidación explícita:
  ```typescript
  export const dynamic = 'force-dynamic'; // Para APIs transaccionales
  export const revalidate = 60;          // Para datos con TTL
  ```
- En componentes y funciones de backend: usar `'use cache'`, `cacheLife()` y `cacheTag()`.

---

## 16. Event Loop de Node.js: Respeto Irrestricto

#### [RF-06] NUNCA Bloquear el Event Loop en Request Handlers
- Prohibido parsing o serialización de JSON gigantescos síncronos (> 50 MB en un único tick).
- Prohibidas expresiones regulares con complejidad exponencial (*Catastrophic Backtracking / ReDoS*).
- Prohibido el uso de APIs síncronas (`fs.readFileSync`, `crypto.pbkdf2Sync`, `zlib.gzipSync`).
- Tareas pesadas de cálculo matemático, procesamiento de imágenes o cifrado masivo deben delegarse a **Worker Threads** o a un worker service externo.

---

## 17. Concurrencia Limitada y Asincronía Cooperativa

```typescript
import pLimit from 'p-limit';

// ✅ Bounded Concurrency: Limitar a 10 operaciones concurrentes
const limit = pLimit(10);
const results = await Promise.all(
  items.map((item) => limit(() => processItem(item))),
);
```
*Prohibido disparar `Promise.all()` sobre cientos de miles de promesas sin límite.*

---

## 18. Trabajo Intensivo de CPU y Worker Pools

Para tareas de procesamiento de imágenes, parsing pesado o compresión masiva:
- No crear un `new Worker()` por petición.
- Utilizar un pool reutilizable de Workers (`piscina`).

---

## 19. Procesamiento con Streams y Backpressure

Para descarga o exportación de grandes archivos:
```typescript
import { pipeline } from 'node:stream/promises';

await pipeline(
  readableFileStream,
  transformCsvStream,
  responseStream,
);
```
*Garantiza que un productor rápido no desborde la memoria RAM de un cliente lento.*

---

## 20. Latency Budgets y Timeouts Estrictos

Toda llamada externa (base de datos, Redis, API de terceros) debe poseer un timeout no negociable:
```typescript
const response = await fetch('https://api.pagos.com/v1/charge', {
  signal: AbortSignal.timeout(2500), // Latency budget de 2.5s
});
```

### 20.1. Interceptor de Timeout en NestJS con RxJS
```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';
import { Observable, throwError, TimeoutError } from 'rxjs';
import { catchError, timeout } from 'rxjs/operators';

@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
  constructor(private readonly timeoutMs: number = 5000) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      timeout(this.timeoutMs),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException('Presupuesto de tiempo excedido.'));
        }
        return throwError(() => err);
      }),
    );
  }
}
```

---

## 21. Políticas de Retry con Exponential Backoff y Jitter

- Reintentar **únicamente** ante errores transitorios: cortes de red, `502 Bad Gateway`, `503 Service Unavailable`, `504 Gateway Timeout` o `429 Too Many Requests` respetando `Retry-After`.
- **Prohibido reintentar:** `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found` o `422 Unprocessable Entity`.
- **Fórmula con Jitter:**
  `delay = min(maxDelay, baseDelay * 2^attempt) + random(0, 100)ms`.

---

## 22. Circuit Breaker

Implementar máquinas de estados (Closed ──> Open ──> Half-Open) ante dependencias remotas inestables para fallar rápidamente (*fast-fail*) y proteger el proceso de agotamiento de sockets.

---

## 23. Bulkhead y Aislamiento de Recursos

Dividir pools de conexiones por criticidad: un colapso en el servicio de analítica o notificaciones no debe agotar las conexiones del pool transaccional de pagos.

---

## 24. Load Shedding

Ante saturación del servidor, rechazar peticiones entrantes de forma ordenada devolviendo **HTTP 503 Service Unavailable** con cabecera `Retry-After` antes de agotar la memoria del proceso y provocar un reinicio por OOM (*Out Of Memory*).

---

## 25. Políticas de Fallback

Los fallbacks deben ser semánticamente seguros:
- ✅ *Si falla el motor de recomendaciones: mostrar productos más vendidos.*
- ❌ *Si falla el servicio de autorización: nunca conceder acceso por omisión (Fail-Closed obligatorio).*

---

## 26. Rate Limiting Multi-Nivel

Aplicar límites de consumo por IP, `userId`, `apiKey` o inquilino (`tenantId`):
- Algoritmos recomendados: **Sliding Window Log** o **Token Bucket** respaldados por Redis.
- En NestJS: Utilizar `@nestjs/throttler` con almacenamiento Redis.

---

## 27. Arquitectura de API Gateway

Delegar en un Gateway externo (Kong, Nginx, AWS API Gateway, Cloudflare) terminación TLS, WAF, compresión y rate limiting perimetral. Evitar saturar el código de Node.js con tareas que el proxy resuelve en C/Rust.

---

## 28. Seguridad OWASP API Top 10

- **API1:2023 — Broken Object Level Authorization (BOLA):** Verificar obligatoriamente que el usuario autenticado posee permisos sobre el objeto `id` consultado y pertenece al mismo `tenantId`.
- **API2:2023 — Broken Authentication:** Sesiones robustas con cookies `__Host-` o tokens de corta duración.
- **API3:2023 — Broken Object Property Level Authorization:** Evitar *mass-assignment* con DTOs de entrada estrictos y serialización de salida sin entidades de base de datos crudas.
- **API4:2023 — Unrestricted Resource Consumption:** Límites estrictos de tamaño de body (`1mb`), tamaño de página (`max: 100`) y timeout.
- **API5:2023 — Broken Function Level Authorization (BFLA):** Validar permisos a nivel de método HTTP y endpoint mediante Guards.
- **API7:2023 — Server-Side Request Forgery (SSRF):** Validar URLs contra allowlists y bloquear IPs privadas o de metadatos de nube (`169.254.169.254`).

### 28.1. Guard de Autorización Granular en NestJS (Mitigación BOLA/BFLA)
```typescript
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermission = this.reflector.get<string>('permission', context.getHandler());
    if (!requiredPermission) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const resourceId = request.params.id;

    if (!user) throw new ForbiddenException('Usuario no autenticado.');

    // Validar autorización granular a nivel de objeto e inquilino
    const hasAccess = user.permissions.includes(requiredPermission) &&
      (!resourceId || (await this.verifyObjectOwnership(user, resourceId)));

    if (!hasAccess) {
      throw new ForbiddenException('No poseés permisos para acceder a este recurso.');
    }

    return true;
  }

  private async verifyObjectOwnership(user: any, resourceId: string): Promise<boolean> {
    // Verificación contra la capa de persistencia asegurando tenantId
    return true;
  }
}
```

---

## 29. Validación en Tiempo de Ejecución

Validar rigurosamente cada borde de entrada (`body`, `params`, `query`, `headers`).

### 29.1. Validación con Zod
```typescript
export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
```

### 29.2. Pipe de Validación Zod en NestJS
```typescript
import { PipeTransform, ArgumentMetadata, BadRequestException } from '@nestjs/common';
import { ZodSchema } from 'zod';

export class ZodValidationPipe implements PipeTransform {
  constructor(private schema: ZodSchema) {}

  transform(value: unknown, metadata: ArgumentMetadata) {
    const parseResult = this.schema.safeParse(value);
    if (!parseResult.success) {
      throw new BadRequestException({
        message: 'Validación de esquema fallida.',
        errors: parseResult.error.flatten().fieldErrors,
      });
    }
    return parseResult.data;
  }
}
```

---

## 30. Seguridad en el Transporte y Red

- **TLS 1.3:** Obligatorio para tráfico público; cifrado robusto sin suites obsoletas.
- **mTLS:** Recomendado para comunicaciones entre microservicios de backend (*zero-trust*).
- **Hardening HTTP:** Configurar límites estrictos de cabeceras, tiempos de lectura (*read timeout*) y keep-alive para mitigar ataques tipo Slowloris.
- **Request Smuggling:** Garantizar parsing coherente de cabeceras `Content-Length` y `Transfer-Encoding` entre el proxy y Node.js.

---

## 31. Persistencia y Base de Datos

#### [RF-07] Connection Pooling Obligatorio
Configurar pools dimensionados a la capacidad de la base de datos y la concurrencia de réplicas.
- **Prevención de N+1:** Usar `JOIN`, `WHERE IN (...)` o `DataLoader`.
- **Query Plans:** Analizar índices y tiempos de ejecución en endpoints críticos (`EXPLAIN ANALYZE`).
- **Transacciones Atómicas:** Confinadas exclusivamente a operaciones de base de datos; nunca mantener transacciones abiertas mientras se realizan llamadas HTTP remotas.

---

## 32. Teorema CAP y Consistencia

- **Sistemas CP:** Priorizan consistencia ante particiones de red (pagos, inventario crítico, permisos).
- **Sistemas AP:** Priorizan disponibilidad aceptando consistencia eventual (analítica, feeds, notificaciones).

---

## 33. Contratos de Consistencia Eventual

Si una escritura actualiza un modelo de lectura de forma asíncrona, el contrato de la API debe documentar que puede existir un retraso de propagación.

---

## 34. Tareas Programadas Distribuidas (Cron Jobs)

- **Idempotencia:** Un cron debe poder ejecutarse múltiples veces sin corromper datos.
- **Distributed Locks:** Coordinar con Redis (`redlock`) o advisory locks de Postgres para que solo una réplica ejecute la tarea.
- **Seguridad:** Proteger endpoints de cron con secretos de servidor (`Authorization: Bearer <cron-secret>`).

---

## 35. Tríada Arquitectónica: Criterio de Selección

```text
┌──────────────────────────────────────────────────────────────────────────┐
│                             CRITERIO SENIOR                              │
├─────────────────────────┬─────────────────────────┬──────────────────────┤
│      NODE.JS PURO       │         NESTJS          │  NEXT.JS ROUTE.TS    │
│    (Fastify/Express)    │  (Modular Architecture) │        (BFF)         │
├─────────────────────────┼─────────────────────────┼──────────────────────┤
│ • Microservicios rápidos│ • Monolitos modulares   │ • BFF para web apps  │
│ • Gateways ultralivianos│ • Dominios complejos    │ • Server Mutations   │
│ • Sockets / WebSockets  │ • Clean / Hexagonal     │ • Webhooks ligeros   │
│ • Mínimo cold-start     │ • Inyección DI avanzada │ • Autenticación web  │
│ • Máximo control I/O    │ • Swagger automático    │ • Mismo deploy UI    │
└─────────────────────────┴─────────────────────────┴──────────────────────┘
```

- **Usar NestJS:** Cuando la aplicación posee lógica de negocio compleja, múltiples módulos de dominio interconectados, requerimientos de OpenAPI tipado con decoradores, y se busca una estructura arquitectónica estandarizada para equipos medianos y grandes.
- **Usar Node.js Dedicado Ligero (Fastify puro):** Cuando se requiere latencia ultra-baja, microservicios específicos de I/O masivo o procesamiento de streaming.
- **Usar Next.js Route Handlers:** Cuando la API existe exclusivamente para nutrir la interfaz de usuario web, actuar como BFF o manejar callbacks de OAuth/Stripe vinculados a la sesión de la web.

---

## 36. Logging Estructurado con Pino

En NestJS, integrar `nestjs-pino` para logging no bloqueante en formato JSON:
```typescript
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        redact: ['req.headers.authorization', 'req.headers.cookie', 'req.body.password'],
        genReqId: (req) => req.headers['x-request-id'] || crypto.randomUUID(),
      },
    }),
  ],
})
export class AppModule {}
```

---

## 37. Métricas y Modelo RED

Monitorear por cada endpoint:
- **Rate:** Volumen de peticiones por segundo (RPS).
- **Errors:** Cantidad y porcentaje de respuestas HTTP 4xx y 5xx.
- **Duration:** Percentiles de latencia p50, p95 y p99.
- **Event Loop Lag:** Retraso en milisegundos en la atención del ciclo de eventos de Node.

---

## 38. Trazabilidad Distribuida con OpenTelemetry

Propagar cabeceras `traceparent` (W3C Trace Context) a través de todas las capas para reconstruir la traza completa de cada petición:
`Navegador ──> Gateway ──> API NestJS ──> Base de Datos ──> Servicio de Pago`.

---

## 39. Health Checks Diferenciados

```http
GET /health/live   ──> HTTP 200 (¿El proceso está vivo?)
GET /health/ready  ──> HTTP 200 / 503 (¿Conexión a DB y Redis listas para recibir tráfico?)
```
En NestJS, implementar mediante el módulo oficial `@nestjs/terminus`.

---

## 40. Definición de Objetivos de Nivel de Servicio (SLOs)

- **Disponibilidad:** 99.9% de peticiones exitosas (no 5xx).
- **Latencia:** p95 < 200 ms, p99 < 500 ms.
- *No diseñar basadas en promedios que ocultan la cola de degradación.*

---

## 41. Documentación de Contratos con OpenAPI 3.2 y Swagger

### 41.1. Controladores NestJS con Decoradores Swagger
```typescript
import { Controller, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from '@nestjs/swagger';

@ApiTags('Payments')
@Controller('api/v1/payments')
export class PaymentsController {
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Procesar un nuevo cobro transaccional de forma idempotente' })
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Clave única para evitar cobros dobles' })
  @ApiResponse({ status: 201, description: 'Pago creado satisfactoriamente' })
  @ApiResponse({ status: 409, description: 'Conflicto por clave de idempotencia reutilizada' })
  @ApiResponse({ status: 422, description: 'Datos de pago inválidos (Problem Details)' })
  async createPayment(@Body() input: CreatePaymentDto) {
    // ...
  }
}
```

---

## 42. Webhooks Idempotentes y Asincrónicos

```text
Proveedor Externo (Stripe, GitHub)
       │ HTTP POST (Headers con firma criptográfica)
       ▼
Webhook Controller (NestJS / Next.js)
       │
       ├── 1. Verificar firma HMAC (Buffer raw del body)
       ├── 2. Validar timestamp para mitigar ataques de replay
       ├── 3. Persistir evento en tabla idempotente (eventId)
       │
       ▼
HTTP 200 OK / 202 Accepted (Respuesta inmediata en < 200ms)
       │
       ▼
Queue / Worker de fondo (Procesamiento asíncrono y reintentos)
```

---

## 43. Código Limpio y Guard Clauses

```typescript
// ✅ Bueno: Guard clauses de salida temprana
if (!user) throw new UserNotFoundError();
if (!user.isActive) throw new UserInactiveError();
if (!order) throw new OrderNotFoundError();
if (order.status !== 'pending') throw new InvalidOrderStateError();

return this.paymentService.process(order);
```

---

## 44. Principios SOLID en APIs Backend

- **SRP:** El Controller solo maneja HTTP (status, headers, params); el Servicio o Caso de Uso orquesta las reglas de negocio; el Repositorio encapsula SQL.
- **DIP:** Inyectar interfaces o tokens abstractos en lugar de implementaciones rígidas.

---

## 45. Principio DRY Aplicado con Pragmatismo

Eliminar duplicaciones de reglas de negocio críticas. Mantener duplicaciones superficiales entre DTOs de distintas versiones cuando el desacoplamiento evite cambios en cascada no deseados.

---

## 46. Principio KISS

Preferir soluciones directas. No incorporar microservicios, buses de eventos Kafka o CQRS para una API CRUD de 5 modelos de datos.

---

## 47. Principio YAGNI

No construir arquitecturas multi-tenant o multi-región complejas hasta que el requerimiento de negocio esté verificado y financiado.

---

## 48. Convenciones de Docstrings y Documentación

Los comentarios y docstrings deben escribirse en **español rioplatense formal con voseo** cuando aporten justificación técnica o restricciones no evidentes:

```typescript
/**
 * Calculá el límite efectivo de resultados permitido para una consulta.
 *
 * Aplicá siempre el máximo definido por el servidor aunque el cliente
 * solicite una cantidad superior. De esta manera evitás respuestas
 * excesivas y reducís el riesgo de consumo descontrolado de recursos.
 *
 * @param requestedLimit Límite solicitado por el cliente.
 * @param maxLimit Máximo absoluto admitido por la API.
 * @returns El límite efectivo que podés utilizar en la consulta SQL.
 */
export function resolvePageLimit(requestedLimit: number, maxLimit: number): number {
  return Math.min(requestedLimit, maxLimit);
}
```

---

## 49. Estructura de Módulos Recomendada

### Para un Backend en NestJS (Modular Architecture / Clean Code)
```text
src/
├── common/
│   ├── decorators/       # @CurrentUser(), @RequirePermissions()
│   ├── filters/          # ProblemDetailsFilter (RFC 9457)
│   ├── guards/           # JwtAuthGuard, PoliciesGuard
│   ├── interceptors/     # IdempotencyInterceptor, TimeoutInterceptor
│   └── pipes/            # ZodValidationPipe
├── modules/
│   ├── auth/
│   ├── users/
│   └── orders/
│       ├── dto/          # CreateOrderDto, OrderResponseDto
│       ├── entities/     # OrderEntity (Persistencia)
│       ├── orders.controller.ts
│       ├── orders.service.ts
│       └── orders.module.ts
├── config/               # Validación de variables de entorno
└── main.ts               # Bootstrap con FastifyAdapter
```

---

## 50. Estrategia Integral de Testing

- **Unit Tests:** Pruebas aisladas de servicios y dominio con mocks de repositorios.
- **Integration Tests:** Pruebas de controladores con base de datos real (Testcontainers / Postgres de testing).
- **Contract Tests:** Verificación de que las respuestas coincidan con la especificación OpenAPI generada.
- **Load Tests:** Pruebas de carga sostenida y estrés con `k6` o `autocannon` para validar percentiles de latencia y Event Loop lag.

---

## 51. Definition of Done (DoD) para APIs de Producción

Una API en Node.js, NestJS o Next.js está lista para producción cuando satisface:

### Contrato y Protocolo
- Rutas diseñadas con sustantivos y métodos HTTP semánticos.
- Errores formateados bajo **Problem Details (RFC 9457)**.
- Documentación OpenAPI 3 actualizada y validada con contract tests.
- Códigos de estado HTTP semánticamente exactos (prohibido 200 con error).

### Rendimiento y Resiliencia
- Event Loop sin bloqueos síncronos pesados.
- Presupuestos de latencia garantizados con timeouts en cada I/O remoto.
- Idempotencia respaldada por `Idempotency-Key` en operaciones críticas.
- Paginación por cursor para colecciones de alto volumen.
- Connection pooling calibrado y ausencia comprobada de queries N+1.

### Seguridad
- Autenticación y autorización granular evaluadas en cada endpoint (mitigación BOLA/IDOR).
- Rate limiting activo por IP/token/tenant.
- Entradas validadas estrictamente en tiempo de ejecución.
- Ausencia de datos sensibles o secretos en respuestas y logs.

### Observabilidad y Operación
- Logging estructurado en formato JSON con Pino y `requestId`.
- Trazas distribuidas propagando `traceparent` (OpenTelemetry).
- Métricas RED instrumentadas.
- Endpoints de salud (`/live` y `/ready`) diferenciados.

---

## 52. Matriz de Antipatrones en APIs Backend

- ⚠️ **API-01:** Devolver siempre HTTP 200 con `{ "success": false }`.
- ⚠️ **API-02:** Verbos de acción en las URLs (`/createUser`, `/deleteOrder`).
- ⚠️ **API-03:** Peticiones GET con efectos secundarios o mutaciones en base de datos.
- ⚠️ **API-04:** Colecciones sin límites máximos de paginación server-side.
- ⚠️ **API-05:** Bloquear el Event Loop con tareas intensivas de CPU.
- ⚠️ **API-06:** Reintentos de red sin Exponential Backoff, Jitter ni Idempotencia.
- ⚠️ **API-07:** Dependencias remotas sin timeout explícito.
- ⚠️ **API-08:** Fallbacks inseguros que conceden permisos o silencian errores críticos.
- ⚠️ **API-09:** Autenticar sin autorizar a nivel de objeto e inquilino (vulnerabilidad BOLA).
- ⚠️ **API-10:** Logging con `console.log()` sin estructura ni correlación.
- ⚠️ **API-11:** Registro de contraseñas, secretos o tokens en los logs.
- ⚠️ **API-12:** Circular Dependency Hell en NestJS debido a mal diseño de módulos y abuso de `forwardRef()`.
- ⚠️ **API-13:** Fuga de entidades de ORM directamente hacia los controladores de NestJS sin DTOs de salida.
- ⚠️ **API-14:** Omitir el filtro global de excepciones exponiendo stack traces o el formato predeterminado de NestJS.
- ⚠️ **API-15:** Utilizar Next.js como backend universal ignorando requerimientos de workers y conexiones persistentes.

---

## 53. Indicadores Clave de Desempeño (KPIs)

| Indicador de Calidad | Meta de Ingeniería |
| :--- | :--- |
| **Peticiones sin correlation ID (`X-Request-Id`)** | 0 |
| **Endpoints públicos sin especificación OpenAPI** | 0 |
| **Consultas a colecciones sin límite de paginación** | 0 |
| **Llamadas I/O remotas sin timeout configurado** | 0 |
| **Vulnerabilidades BOLA / IDOR reportadas** | 0 |
| **Secretos o PII volcados en registros de log** | 0 |
| **Errores 5xx sin traza en observabilidad** | 0 |
| **Percentil p95 en endpoints críticos sin carga pesada** | < 200 ms |
| **Retardo del Event Loop (*lag*) bajo carga normal** | < 10 ms |

---

## 54. Protocolo Senior de Diseño de Endpoints

Antes de implementar un endpoint en Node.js, NestJS o Next.js, responder:
1. ¿Qué recurso de negocio representa?
2. ¿Qué método HTTP corresponde y cuál es su semántica?
3. ¿Es una operación segura (*safe*) o idempotente?
4. ¿Qué autorización y permisos sobre el objeto exige?
5. ¿Qué esquema de validación y límites de tamaño aplican a la entrada?
6. ¿Qué código HTTP devuelve en caso de éxito?
7. ¿Cómo falla y qué Problem Details (RFC 9457) emite?
8. ¿Qué timeout estricto rige a sus dependencias externas?
9. ¿Cómo se comporta ante reintentos de red (`Idempotency-Key`)?
10. ¿El resultado es cacheable y cómo se invalida?
11. ¿Cómo se registra y correlaciona en observabilidad (Pino + OTel)?

---

## 55. Matriz de Decisión de Arquitectura Backend

```text
¿El servicio requiere lógica empresarial compleja, Clean Architecture, múltiples módulos y Swagger automático?
  ├── SÍ ──> NestJS (con FastifyAdapter para máximo rendimiento)
  └── NO  ──> ¿La API pertenece exclusivamente a la experiencia web frontend (BFF / Webhooks de UI)?
                ├── SÍ ──> Next.js Route Handlers (app/api/**/route.ts)
                └── NO ──> Microservicio en Node.js puro (Fastify / Hono)
```

---

## 56. Cheat Sheet — Las 25 Reglas Esenciales

1. Diseñá el contrato OpenAPI antes de escribir el controlador.
2. Usá sustantivos en las URLs y acciones mediante métodos HTTP.
3. Respetá la semántica de métodos seguros e idempotentes.
4. Usá `Idempotency-Key` para peticiones `POST` de mutación crítica.
5. Nunca devuelvas HTTP 200 para comunicar un error.
6. Estandarizá los errores con Problem Details (RFC 9457).
7. En NestJS, implementá un Global Exception Filter para capturar y sanear excepciones.
8. Paginá toda colección con límites superiores controlados (preferí cursor pagination).
9. Versioná de forma explícita ante cambios incompatibles (*breaking*).
10. Toda llamada de red saliente debe tener un timeout estricto.
11. Los reintentos exigen backoff exponencial, jitter e idempotencia.
12. Aplicá Circuit Breakers ante servicios downstream inestables.
13. No bloquees el Event Loop con tareas de cómputo intensivo.
14. Derivá el trabajo pesado de CPU a Worker Threads.
15. Usá Streams y pipelines para transferir grandes volúmenes de datos.
16. Controlá la concurrencia y memoria con límites máximos (`p-limit`).
17. Cacheá únicamente cuando tengas TTL e invalidación definidas.
18. Usá `ETag` y peticiones condicionales (`If-None-Match`, `If-Match`).
19. Rate limiting y límites de tamaño de payload son obligatorios.
20. Mitigá activamente las vulnerabilidades del OWASP API Top 10 (especialmente BOLA).
21. Exigí TLS estricto en tránsito y mTLS en redes internas.
22. Emití logs estructurados en JSON con Pino, métricas RED y trazas OTel.
23. Los cron jobs distribuidos exigen idempotencia, locks y observabilidad.
24. En NestJS, usá DTOs con validación estricta y desacoplá las entidades de base de datos de las respuestas HTTP.
25. Nunca optimices ni distribuyas una arquitectura sin mediciones reales.

---

## 57. Resultado Esperado

Una API diseñada e implementada bajo la especificación **SKL-API-NODE-NEXT-001** es:
- **Correcta, predecible y tipada.**
- **Modular y desacoplada (NestJS / Clean Architecture).**
- **Segura por diseño (OWASP API Top 10 blindado).**
- **Idempotente y tolerante ante fallos de red.**
- **Observable, trazable y operable en producción.**
- **Cache-aware y eficiente en el consumo de recursos.**
- **Documentada mediante contratos OpenAPI formales.**

> **Objetivo Final:** Construir la API más simple, robusta y mantenible posible, capaz de satisfacer con precisión su contrato, tolerar contingencias de red, proteger sus recursos ante abusos y evolucionar con seguridad en producción sin romper a sus consumidores.
