---
name: observability-reliability-engineering
description: >-
  Diseño e implementación de sistemas observables, monitoreables, trazables y resilientes adaptado a NestJS 11, Next.js 15 y PostgreSQL (código SKL-ARCH-OBS-001). Usar cuando se requiera instrumentar telemetría con OpenTelemetry, structured logging con nestjs-pino, contratos de error RFC 9457 Problem Details en ApiExceptionFilter, health checks desacoplados en @nestjs/terminus (liveness sin DB vs readiness con Prisma), observabilidad de base de datos y slow queries (>100ms), métricas de colas Outbox, y confiabilidad SRE (SLI/SLO/Error Budgets).
---

# Especificación Técnica de Habilidad: Observability, Monitoring, Error Handling & Reliability Engineering

```text
Código de Skill:    SKL-ARCH-OBS-001
Versión:            2.1.0
Nivel:              Senior / Production Engineering
Estándar:           OpenTelemetry / W3C Trace Context / RFC 9457 / HTTP / RED / USE / SLI / SLO / Error Budgets / OWASP / Agile DoD
Dominio:            Backend / Frontend / Distributed Systems / SRE / DevOps / Platform Engineering
Contexto Proyecto:  @testimonial-cms (NestJS 11 API + Next.js 15 Web + Prisma ORM + PostgreSQL + nestjs-pino + Terminus)
```

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño e implementación de sistemas observables, trazables, monitoreables y resilientes. |
| **Objetivo de Dominio** | Permitir comprender el estado interno de `@testimonial-cms` a partir de su telemetría, detectar degradaciones antes de fallos severos, reconstruir el flujo causal completo con `traceId` y minimizar el MTTR. |
| **Arquitectura de Referencia** | Monorepo con **Backend NestJS 11** (`apps/api`), **Frontend Next.js 15 App Router** (`apps/web`), **PostgreSQL 16+** y **Prisma ORM 6.5**. |
| **Herramientas de Telemetría** | OpenTelemetry Node SDK, `nestjs-pino`, `pino-http`, `@nestjs/terminus`, Prometheus y Grafana. |
| **Trazabilidad Distribuida** | W3C Trace Context (`traceparent`, `tracestate`) inyectado en `RequestContextMiddleware` y propagado a llamadas salientes. |
| **Contrato de Errores** | RFC 9457 Problem Details (`application/problem+json`) implementado en `ApiExceptionFilter` con códigos de error estables. |
| **Health Checks** | Desacoplamiento estricto de sondas en `HealthController`: `/health/live` (proceso) vs `/health/ready` (base de datos con `PrismaHealthIndicator`). |
| **Observabilidad de BD** | Detección de *slow queries* (> 100ms) en `PrismaService` y telemetría de transacciones con reintentos (`withRetry`). |
| **Sistemas Asíncronos** | Métricas de saturación y retraso en el patrón Transactional Outbox (`OutboxEvent`). |
| **Prioridad Operativa** | Correctitud ➔ Trazabilidad ➔ Detección ➔ Diagnóstico ➔ Recuperación ➔ Optimización. |
| **Complejidad** | Alta. |

---

## 2. Filosofía de Diseño: Reconstrucción Causal en Producción

La observabilidad no es tener dashboards coloridos ni saturar los discos con logs:
- ❌ **No es registrar texto libre con `console.log()`** (inútil para consultas analíticas o alertas automatizadas).
- ❌ **No es alertar cada anomalía transitoria** (provoca fatiga de alertas e indiferencia del equipo).
- ❌ **No es depender de reproducir el bug localmente** para saber qué falló en producción.

> **Principio Rector:** Todo fallo importante debe poder detectarse, localizarse, correlacionarse, explicarse y reconstruirse basándose exclusivamente en su telemetría externa, mediante un único `traceId` que atraviese desde el frontend en Next.js hasta PostgreSQL.

```text
Browser / Next.js 15 Client (error.tsx muestra Ref: 4bf92f3577b3)
 │
 ├── RequestContextMiddleware (Genera/extrae W3C traceparent y requestId)
 │
 ├── LoggingInterceptor (Pino registra entrada/salida estructurada con duración)
 │
 ├── TestimonialController ➔ TestimonialService (Lógica de dominio)
 │
 ├── PrismaService [Span DB] (Ejecuta SELECT / UPDATE; si > 100ms emite WARN)
 │
 └── ApiExceptionFilter (Si ocurre fallo, emite RFC 9457 JSON y log ERROR con traceId)
```

---

## 3. Jerarquía de Gestión Estratégica (SRE) en `@testimonial-cms`

```text
Objective: Garantizar alta disponibilidad y confianza en la captura y visualización de testimonios.
   ↓
Key Results:
   - KR1: Reducir el MTTR de incidentes de API a < 15 minutos.
   - KR2: Mantener el Availability SLO de la API de testimonios en ≥ 99.95% mensual.
   - KR3: Cero errores 5xx no clasificados expuestos a clientes.
   ↓
KPIs Operativos: MTTD (< 3m), MTTA (< 5m), MTTR (< 15m), Change Failure Rate (< 5%).
   ↓
SLIs (Service Level Indicators):
   - SLI 1 (Disponibilidad): (Peticiones exitosas sin 5xx / Total peticiones válidas) * 100.
   - SLI 2 (Latencia): Porcentaje de consultas públicas con duración < 200ms.
   ↓
SLO (Service Level Objective): 99.95% de éxito en 30 días móviles.
   ↓
Error Budget: 1 - 0.9995 = 0.05% de fallos permitidos al mes.
   ↓
Alerting por Burn Rate: Alertas accionables cuando la tasa de consumo del presupuesto supere 14.4x (SEV-1).
```

---

## 4. Logging Estructurado con `nestjs-pino`

### 4.1. Configuración Central y Sanitización
En `apps/api/src/main.ts`, el logger `nestjs-pino` se inicializa con formateo JSON y serializadores de sanitización para eliminar secretos y PII:

```typescript
// Configuración conceptual de Pino en NestJS
import { LoggerModule } from 'nestjs-pino';

export const pinoConfig = LoggerModule.forRoot({
  pinoHttp: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        'req.body.apiKey',
        'req.body.creditCard',
      ],
      censor: '[REDACTED]',
    },
    customProps: (req: any) => ({
      traceId: req.requestContext?.correlationId || req.id,
      tenantId: req.user?.tenantId,
      userId: req.user?.userId,
    }),
  },
});
```

### 4.2. Enriquecimiento del `LoggingInterceptor`
`LoggingInterceptor` debe registrar la **plantilla de ruta normalizada** (baja cardinalidad) en lugar de URLs con IDs dinámicos:

```typescript
// apps/api/src/common/interceptors/logging.interceptor.ts
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Logger } from 'nestjs-pino';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    const { method, route } = request;
    const path = route?.path || request.url; // Ruta parametrizada (/api/v1/testimonials/:id)

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          const duration = Date.now() - startTime;
          this.logger.log({
            event: 'http.request_completed',
            http: {
              method,
              route: path,
              statusCode: response.statusCode,
              durationMs: duration,
            },
            traceId: request.requestContext?.correlationId,
            tenantId: request.user?.tenantId,
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          const status = error?.status ?? 500;
          this.logger.warn({
            event: 'http.request_failed',
            http: {
              method,
              route: path,
              statusCode: status,
              durationMs: duration,
            },
            error: {
              message: error.message,
              code: error.code || 'UNHANDLED_EXCEPTION',
            },
            traceId: request.requestContext?.correlationId,
            tenantId: request.user?.tenantId,
          });
        },
      }),
    );
  }
}
```

---

## 5. Contrato de Errores RFC 9457 en `ApiExceptionFilter`

En APIs REST profesionales, las respuestas de error deben adherirse a **RFC 9457 Problem Details** (`Content-Type: application/problem+json`), prohibiendo absolutamente la exposición de stack traces en producción:

```typescript
// apps/api/src/common/filters/api-exception.filter.ts
import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { ApiRequest } from '../interfaces/auth-context.interface';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<ApiRequest>();

    const status = exception instanceof HttpException 
      ? exception.getStatus() 
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const payload = exception instanceof HttpException ? exception.getResponse() : undefined;
    const traceId = request.requestContext?.correlationId || request.header('x-request-id') || 'unknown';

    // Construcción del contrato estándar RFC 9457
    const problemDetails = {
      type: `https://api.testimonialcms.com/errors/${this.resolveErrorCode(status, payload).toLowerCase()}`,
      title: this.resolveTitle(status),
      status,
      detail: this.resolveSafeDetail(status, payload, exception),
      instance: request.url,
      code: this.resolveErrorCode(status, payload),
      traceId, // Referencia para el usuario y soporte técnico
      timestamp: new Date().toISOString(),
      invalidParams: this.resolveInvalidParams(payload),
    };

    response
      .status(status)
      .header('Content-Type', 'application/problem+json')
      .json(problemDetails);
  }

  private resolveErrorCode(status: number, payload: unknown): string {
    if (payload && typeof payload === 'object' && 'code' in payload) {
      return String((payload as any).code);
    }
    switch (status) {
      case HttpStatus.BAD_REQUEST: return 'VALIDATION_ERROR';
      case HttpStatus.UNAUTHORIZED: return 'AUTH_INVALID_TOKEN';
      case HttpStatus.FORBIDDEN: return 'ACCESS_FORBIDDEN';
      case HttpStatus.NOT_FOUND: return 'RESOURCE_NOT_FOUND';
      case HttpStatus.CONFLICT: return 'STATE_CONFLICT';
      case HttpStatus.TOO_MANY_REQUESTS: return 'RATE_LIMITED';
      default: return 'INTERNAL_SERVER_ERROR';
    }
  }

  private resolveTitle(status: number): string {
    switch (status) {
      case 400: return 'Bad Request';
      case 401: return 'Unauthorized';
      case 403: return 'Forbidden';
      case 404: return 'Not Found';
      case 409: return 'Conflict';
      case 422: return 'Unprocessable Content';
      case 429: return 'Too Many Requests';
      default: return 'Internal Server Error';
    }
  }

  private resolveSafeDetail(status: number, payload: unknown, exception: unknown): string {
    if (status >= 500 && process.env.NODE_ENV === 'production') {
      return 'An unexpected internal error occurred. Please contact support referencing the traceId.';
    }
    if (typeof payload === 'object' && payload !== null && 'message' in payload) {
      return Array.isArray((payload as any).message) ? 'Validation failed' : String((payload as any).message);
    }
    return exception instanceof Error ? exception.message : 'Operation failed';
  }

  private resolveInvalidParams(payload: unknown) {
    if (payload && typeof payload === 'object' && 'message' in payload && Array.isArray((payload as any).message)) {
      return (payload as any).message;
    }
    return undefined;
  }
}
```

---

## 6. Health Checks de Alta Fidelidad en NestJS (`@nestjs/terminus`)

### 6.1. Desacople Crítico: Liveness vs Readiness
En `@testimonial-cms`, `HealthController` debe separar las sondas para evitar fallos en cascada:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                        Estrategia de Probes K8s / Docker               │
├─────────────────┬──────────────────────────────────────────────────────┤
│ GET /health/live│ Liveness Probe: ¿El event loop y la memoria de Node   │
│                 │ están sanos? NO CONSULTA A POSTGRESQL.               │
│                 │ (Si la BD cae temporalmente, el proceso NO se reinicia)│
├─────────────────┼──────────────────────────────────────────────────────┤
│ GET /health/ready│ Readiness Probe: ¿Podemos atender consultas activas? │
│                 │ Evalúa PostgreSQL vía PrismaHealthIndicator.         │
│                 │ (Si la BD cae, el proxy saca el pod sin matarlo).    │
└─────────────────┴──────────────────────────────────────────────────────┘
```

```typescript
// apps/api/src/modules/health/controllers/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import { PrismaHealthIndicator } from '../services/prisma-health.indicator';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaHealthIndicator: PrismaHealthIndicator,
  ) {}

  /**
   * Sonda de Liveness: Evalúa únicamente el proceso de Node.js
   * Jamás debe depender de dependencias de red externas.
   */
  @Get('live')
  @HealthCheck()
  checkLiveness() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024), // 300 MB max heap
    ]);
  }

  /**
   * Sonda de Readiness: Evalúa la capacidad de atender tráfico con la base de datos
   */
  @Get('ready')
  @HealthCheck()
  checkReadiness() {
    return this.health.check([
      () => this.prismaHealthIndicator.isHealthy('database'),
    ]);
  }
}
```

---

## 7. Observabilidad de Base de Datos en `PrismaService`

`PrismaService` instrumenta la captura de consultas lentas (*slow queries*) que exceden los 100ms, emitiendo una advertencia con Pino:

```typescript
// src/modules/database/prisma.service.ts
this.$on('query', (e: Prisma.QueryEvent) => {
  if (e.duration > 100) {
    this.logger.warn({
      event: 'database.slow_query',
      query: e.query,
      durationMs: e.duration,
      target: e.target,
    }, `Slow Query detected [${e.duration}ms]`);
  }
});
```

---

## 8. Observabilidad en Sistemas Asíncronos: Transactional Outbox

El patrón Transactional Outbox (`OutboxEvent`) en `@testimonial-cms` requiere métricas operativas específicas:

```text
┌───────────────────────────┬──────────────────────────────────────────────────────┐
│ Señal Operativa           │ Umbral / Alerta                                      │
├───────────────────────────┼──────────────────────────────────────────────────────┤
│ Pending Outbox Events     │ Conteo de filas con status = 'PENDING'.              │
│                           │ Alerta si > 500 eventos acumulados.                  │
├───────────────────────────┼──────────────────────────────────────────────────────┤
│ Age of Oldest Event       │ NOW() - MIN(createdAt) de eventos pendientes.        │
│                           │ Alerta si > 2 minutos (indica worker atascado).      │
├───────────────────────────┼──────────────────────────────────────────────────────┤
│ DLQ / Failed Events Rate  │ Eventos que alcanzaron status = 'FAILED'.            │
│                           │ Disparo inmediato de alerta SEV-2 en canal Slack.    │
└───────────────────────────┴──────────────────────────────────────────────────────┘
```

---

## 9. Frontend Observability & Resiliencia en Next.js 15 (`apps/web`)

### 9.1. Manejo de Errores en `error.tsx` con Referencia de Soporte
El componente de error de cliente en Next.js debe capturar el `error.digest` generado automáticamente por el runtime y presentarlo al usuario para soporte:

```tsx
// apps/web/src/app/error.tsx
'use client';

import { useEffect } from 'react';
import { Button } from '@/components/ui/button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Registrar en servicio de telemetría de frontend
    console.error('Unhandled Client Error:', {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="flex h-[80vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">Algo salió mal</h2>
        <p className="text-muted-foreground max-w-[480px] text-base">
          Ocurrió un problema inesperado al procesar tu solicitud. Nuestro equipo técnico fue notificado.
        </p>
        {error.digest && (
          <p className="font-mono text-xs text-gray-500">
            Código de referencia del incidente: <span className="font-semibold text-gray-700">{error.digest}</span>
          </p>
        )}
      </div>
      <Button onClick={() => reset()} variant="outline">
        Intentar nuevamente
      </Button>
    </div>
  );
}
```

---

## 10. Catálogo de 40 Antipatrones (OBS-01 a OBS-40)

| Código | Antipatrón | Causa Común | Consecuencia en @testimonial-cms | Solución Profesional |
| :--- | :--- | :--- | :--- | :--- |
| **OBS-01** | `console.log` en NestJS | Pereza del programador | Bloqueo síncrono del event loop; sin formato JSON. | Inyectar `Logger` de `nestjs-pino`. |
| **OBS-02** | Loggear tokens o claves | Serializar `req.headers` enteros | Exposición de credenciales de API Keys en logs. | Configurar `pinoHttp.redact` centralizado. |
| **OBS-03** | Rutas dinámicas en logs | Registrar `/testimonials/uuid` | Explosión de cardinalidad en métricas y dashboards. | Registrar la ruta parametrizada `/testimonials/:id`. |
| **OBS-04** | Stack traces en la API | Devolver el error nativo en prod | Fuga de estructura de tablas de Postgres y código. | Retornar RFC 9457 Problem Details sin stack. |
| **OBS-05** | Sin `traceId` en errores | Responder `{ success: false }` | Soporte no puede vincular el reclamo con el log. | Inyectar `traceId` en cada respuesta HTTP de error. |
| **OBS-06** | Liveness atado a PostgreSQL | `/health` único consultando DB | Reinicio destructivo en bucle si Postgres se reinicia. | Separar `/health/live` (solo Node) de `/health/ready`. |
| **OBS-07** | Ignorar slow queries | No medir duración en Prisma | Degradación silenciosa de queries bajo concurrencia. | Escuchar eventos `$on('query')` y alertar si > 100ms. |
| **OBS-08** | Return 200 con `{error: true}`| Diseño deficiente de endpoints | Métricas HTTP indican salud cuando el servicio falla. | Emitir status codes semánticos (400, 404, 500). |
| **OBS-09** | Catch silencioso (`catch {}`) | Ocultar errores imprevistos | Pérdida irrecuperable de la causa raíz de fallos. | Capturar, encadenar con `cause` y loggear con Pino. |
| **OBS-10** | Sin observabilidad en Outbox | No monitorear `OutboxEvent` | Mensajes acumulados y webhooks no despachados. | Medir conteo de pendientes y edad del evento más viejo. |
| **OBS-11** | Alertas sobre causas volátiles| Alertar si CPU sube al 75% | Despertar guardias sin impacto real en el cliente. | Alertar sobre síntomas (aumento de 5xx o latencia p95). |
| **OBS-12** | Alertas sin Runbook | Alertas con solo el nombre | Mayor tiempo de respuesta y estrés operativo. | Enlace obligatorio al procedimiento de mitigación. |
| **OBS-13** | Promedios en lugar de p95/p99 | Usar promedio de latencia | Ocultar clientes sufriendo demoras de 10 segundos. | Usar histogramas con percentiles en Grafana. |
| **OBS-14** | Reiniciar procesos por timeout| Creer que reiniciar sana la app| Aumenta la contención al iniciar réplicas. | Aplicar Circuit Breakers y reintentos con jitter. |
| **OBS-15** | Sin correlación en Next.js | No mostrar digest en errores | El usuario ve "error" sin código de referencia. | Mostrar `error.digest` en `apps/web/src/app/error.tsx`. |

---

## 11. Definition of Done (DoD) de Confiabilidad

Un módulo o endpoint en `@testimonial-cms` se considera observable y apto para producción cuando:

- [ ] **Logging:** Todas las solicitudes registran JSON estructurado mediante `LoggingInterceptor` con `trace_id` y ruta normalizada.
- [ ] **Redaction:** Verificado que contraseñas, tokens JWT y cabeceras `authorization` aparecen como `[REDACTED]`.
- [ ] **Contrato de Errores:** Excepciones capturadas por `ApiExceptionFilter` emitiendo `application/problem+json` sin stacks.
- [ ] **Trazabilidad:** `RequestContextMiddleware` asegura la presencia de `x-request-id` y `x-correlation-id` en cada petición.
- [ ] **Health Checks:** Sonda `/health/live` responde sin interactuar con PostgreSQL; `/health/ready` valida la base de datos.
- [ ] **Slow Query Alerts:** Consultas a Prisma que superan 100ms emiten una advertencia en el log con duración y consulta.
- [ ] **Outbox Tracking:** Eventos asíncronos en `OutboxEvent` tienen trazabilidad de estado (`PENDING`, `COMPLETED`, `FAILED`).
- [ ] **Frontend Error Boundaries:** Vistas de Next.js (`error.tsx`) presentan el `error.digest` para soporte técnico.
- [ ] **Métricas RED:** Expuestas métricas de Rate, Errors y Duration con percentiles p95 y p99.
- [ ] **Alertas Accionables:** Alertas de producción vinculadas a Runbooks de remediación documentados.

---

## 12. Cheat Sheet — 20 Reglas de Oro de Observabilidad en `@testimonial-cms`

1. La observabilidad es la capacidad de explicar el porqué de un fallo sin reproducirlo en producción.
2. Usá siempre `nestjs-pino` para logging estructurado en stdout; prohibido `console.log()`.
3. Inyectá `traceId` en cada log, trace y respuesta de error.
4. Redactá de forma centralizada todas las contraseñas, tokens y cabeceras de autorización.
5. Registrá rutas parametrizadas (`/testimonials/:id`), nunca URLs con UUIDs resueltos (control de cardinalidad).
6. Emití respuestas de error bajo el estándar **RFC 9457 Problem Details** (`application/problem+json`).
7. Jamás expongas stack traces ni consultas SQL crudas al cliente en producción.
8. Desacoplá la sonda `/health/live` de la base de datos para evitar reinicios en cascada.
9. Utilizá `/health/ready` para retirar instancias del balanceador si PostgreSQL se degrada.
10. Capturá y alertá sobre *slow queries* de Prisma que superen los 100ms.
11. Preservá la causa original de las excepciones mediante la propiedad `cause`.
12. Monitoreá la edad del evento más antiguo en la tabla `outbox_events`.
13. Mostrá el `error.digest` en `error.tsx` de Next.js como código de referencia para soporte.
14. Medí latencia utilizando percentiles (p50, p95, p99), nunca dependas de promedios simples.
15. Definí siempre el SLI antes de fijar el SLO de un servicio.
16. Alertá sobre síntomas percibidos por el usuario (SLO Burn Rate), no sobre fluctuaciones técnicas aisladas.
17. Toda alerta crítica debe incluir un Runbook con instrucciones de diagnóstico y rollback.
18. Configurá timeouts estrictos y reintentos con backoff exponencial y jitter en llamadas remotas.
19. Asigná siempre un equipo dueño a cada alerta de producción.
20. Si un error llega a producción y no podés diagnosticarlo con la telemetría existente, tu observabilidad está incompleta.

---

## 13. Árbol de Decisión de Diagnóstico de Incidentes

```text
                               INCIDENTE REPORTADO
                                        │
                       ┌────────────────▼────────────────┐
                       │  ¿Se dispone del traceId /      │
                       │        error.digest?            │
                       └────────┬───────────────┬────────┘
                                │               │
                             Sí │               │ No
                                │               │
                ┌───────────────▼────┐   ┌──────▼────────────────────────┐
                │ Filtrar en Loki /  │   │ Consultar Dashboard RED       │
                │ Tempo por trace_id │   │ - Identificar pico de 5xx     │
                └───────────────┬────┘   │ - Aislar ruta afectada        │
                                │        └──────┬────────────────────────┘
                                │               │
                                └───────┬───────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │   ¿Dónde se generó el fallo? │
                         └───────┬──────────────┬──────┘
                                 │              │
                   En PostgreSQL │              │ En Lógica / API Externa
                                 │              │
                ┌────────────────▼───┐   ┌──────▼────────────────────────┐
                │ - Inspeccionar log │   │ - Inspeccionar código RFC 9457│
                │   de slow query    │   │ - Evaluar timeout o respuesta │
                │ - Verificar pool y │   │   de proveedor externo        │
                │   deadlocks P2028  │   └──────┬────────────────────────┘
                └────────────────┬───┘          │
                                 │              │
                                 └──────┬───────┘
                                        │
                         ┌──────────────▼──────────────┐
                         │    Ejecutar Mitigación      │
                         │    conforme al Runbook      │
                         └──────────────┬──────────────┘
                                        │
                                       FIN
```
