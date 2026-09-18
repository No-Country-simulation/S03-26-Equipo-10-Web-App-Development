# Módulo: Webhooks (`apps/api/src/modules/webhooks/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-09-18
# ADR de referencia: docs/adr/0002-patron-outbox-para-eventos-y-webhooks.md

---

## 1. Responsabilidad

Implementa el **Patrón Transactional Outbox** para entrega confiable de eventos a sistemas externos. Garantiza **At-Least-Once Delivery** con firma HMAC-SHA256. Es el módulo más crítico para la integridad de las integraciones.

---

## 2. Arquitectura del Módulo

```
Módulo Productor (ej: TestimonialsModule)
  └── WebhookOutboxHandler.emit('event.name', payload)
        └── OutboxService.save()  ← escribe en outbox_events (MISMA transacción)

OutboxProcessor (BullMQ Job)
  └── Lee outbox_events WHERE status = 'pending'
  └── HttpWebhookDispatcher.dispatch()
        ├── HttpResilienceService (timeouts, backoff, circuit breaker)
        └── POST endpoint externo (firmado con HMAC-SHA256)
  └── Actualiza outbox_events.status → 'delivered' | 'failed'

WebhookEventsListener
  └── Escucha eventos del EventEmitter de NestJS
  └── Ruta alternativa de entrada para eventos internos

WebhooksBootstrapService
  └── Re-encola pending events al iniciar la aplicación (recovery)
```

---

## 3. Endpoints de Gestión

| Método | Ruta | Descripción | Guard |
|--------|------|-------------|-------|
| `GET` | `/api/v1/webhooks` | Lista webhook endpoints del tenant | `JwtAuthGuard` |
| `POST` | `/api/v1/webhooks` | Registra nuevo endpoint webhook | `JwtAuthGuard` |
| `PATCH` | `/api/v1/webhooks/:id` | Actualiza URL o configuración | `JwtAuthGuard` |
| `DELETE` | `/api/v1/webhooks/:id` | Elimina endpoint webhook | `JwtAuthGuard` |

---

## 4. Servicios

| Servicio | Responsabilidad |
|----------|----------------|
| `WebhooksService` | CRUD de `webhook_endpoints` por tenant |
| `OutboxService` | Escritura de eventos en `outbox_events` (producer) |
| `OutboxProcessor` | Job BullMQ que procesa eventos pendientes (consumer) |
| `WebhookOutboxHandler` | Orquestador: recibe eventos de dominio y los persiste en outbox |
| `WebhooksBootstrapService` | Recovery: re-encola eventos `pending` al arrancar |
| `HttpWebhookDispatcher` | Realiza el POST HTTP al endpoint externo |
| `HttpResilienceService` | Timeouts, reintentos con backoff exponencial, circuit breaker |
| `WebhookEventsListener` | Listener de EventEmitter interno de NestJS |
| `LoggerService` | Logging estructurado específico del módulo |

---

## 5. Tabla `outbox_events`

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | UUID | PK |
| `tenant_id` | UUID | FK → tenants |
| `event_type` | TEXT | Ej: `testimonial.published` |
| `payload` | JSONB | Datos del evento |
| `status` | ENUM | `pending` \| `delivered` \| `failed` |
| `attempts` | INT | Número de intentos de entrega |
| `last_error` | TEXT | Último mensaje de error |
| `created_at` | TIMESTAMPTZ | — |
| `delivered_at` | TIMESTAMPTZ | Timestamp de entrega exitosa |

---

## 6. Seguridad de Webhooks

### Firma HMAC-SHA256

```
signature = HMAC-SHA256(signingSecret, rawBody)
header: X-Webhook-Signature: sha256=<hex>
```

**Verificación en el consumer externo**:
```typescript
const expected = crypto
  .createHmac('sha256', secret)
  .update(rawBody)
  .digest('hex');
const isValid = crypto.timingSafeEqual(
  Buffer.from(`sha256=${expected}`),
  Buffer.from(receivedSignature)
);
```

> ⚠️ Usar siempre `timingSafeEqual`. El operador `===` es vulnerable a timing attacks.

### Anti-replay

Incluir `timestamp` en el payload. El consumer DEBE rechazar eventos con `timestamp` > 5 minutos de diferencia con `Date.now()`.

---

## 7. Política de Reintentos

```
Intento 1: inmediato
Intento 2: +30s
Intento 3: +2min
Intento 4: +8min
Intento 5: +30min
> 5 intentos fallidos → status = 'failed' → DLQ (Dead Letter Queue)
```

Implementado en `HttpResilienceService` con exponential backoff y full jitter.

---

## 8. Eventos Soportados

| Evento | Producido por | Payload principal |
|--------|---------------|-------------------|
| `testimonial.published` | TestimonialsModule | `{ testimonialId, tenantId, authorName, content, rating, publishedAt }` |

*(Agregar nuevos eventos aquí al implementarlos)*

---

## 9. Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| `BR-WEB-001` | At-least-once delivery garantizado |
| `BR-WEB-002` | `outbox_events` escrito en la misma transacción DB que el evento de dominio |
| `BR-WEB-003` | Todos los POST firmados con HMAC-SHA256 del signing secret del tenant |
| `BR-SEC-001` | Queries de endpoints filtradas por `tenant_id` |

---

## 10. Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
