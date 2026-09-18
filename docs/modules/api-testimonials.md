# Módulo: Testimonials (`apps/api/src/modules/testimonials/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-09-18

---

## 1. Responsabilidad

Es el **módulo core del dominio**. Gestiona el ciclo de vida completo de los testimonios: creación pública, moderación, scoring, organización por tags/categorías y publicación. Es el productor principal de eventos para el módulo de webhooks.

---

## 2. Lifecycle de Testimonios

```
draft ──► pending ──► approved ──► published
                  └──► rejected
```

| Transición | Actor | Acción |
|------------|-------|--------|
| `→ pending` | Cliente externo | `POST /api/v1/testimonials/public` |
| `pending → approved` | Editor/Admin | `POST /api/v1/testimonials/:id/approve` |
| `pending → rejected` | Editor/Admin | `POST /api/v1/testimonials/:id/reject` |
| `approved → published` | Editor/Admin | `POST /api/v1/testimonials/:id/publish` (emite evento webhook) |

---

## 3. Endpoints

| Método | Ruta | Descripción | Guard |
|--------|------|-------------|-------|
| `POST` | `/api/v1/testimonials/public` | Envío público de testimonio | Ninguno (API Key opcional) |
| `GET` | `/api/v1/testimonials` | Lista testimonios del tenant (paginado) | `JwtAuthGuard` |
| `GET` | `/api/v1/testimonials/:id` | Obtiene testimonio por ID | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials` | Crea testimonio (admin) | `JwtAuthGuard` |
| `PATCH` | `/api/v1/testimonials/:id` | Actualiza testimonio | `JwtAuthGuard` |
| `DELETE` | `/api/v1/testimonials/:id` | Elimina testimonio | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials/:id/approve` | Aprueba testimonio | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials/:id/reject` | Rechaza testimonio | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials/:id/publish` | Publica testimonio | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials/:id/image` | Sube imagen asociada | `JwtAuthGuard` |
| `POST` | `/api/v1/testimonials/:id/video` | Adjunta video URL | `JwtAuthGuard` |
| `GET` | `/api/v1/tags` | Lista tags del tenant | `JwtAuthGuard` |
| `GET` | `/api/v1/categories` | Lista categorías del tenant | `JwtAuthGuard` |

---

## 4. DTOs (nestjs-zod)

| DTO | Campos clave | Validación |
|-----|-------------|------------|
| `CreateTestimonialDto` | `authorName`, `content`, `rating`, `categoryId?`, `tagIds?[]` | name 2-120, content 10-1000, rating 1-5 |
| `UpdateTestimonialDto` | Todos opcionales, mismas reglas | — |
| `ModerateTestimonialDto` | `reason?` | max 500 chars |
| `SubmitPublicTestimonialDto` | `authorName`, `content`, `rating`, `imageBase64?`, `videoUrl?` | url format para video |
| `PublicTestimonialsQueryDto` | `q?`, `tag?`, `category?`, `sort?`, `page?`, `limit?` | sort: `score:desc` \| `publishedAt:desc` |
| `UploadImageDto` | `imageBase64` | string (base64) |
| `AttachVideoDto` | `videoUrl` | url format |

---

## 5. Servicios

| Servicio | Responsabilidad |
|----------|----------------|
| `TestimonialsService` | Lógica de ciclo de vida, moderación, queries principales |
| `TagsService` | CRUD de tags por tenant |
| `CategoriesService` | CRUD de categorías por tenant |
| `ScoringService` | Cálculo del score de relevancia (recency + rating + engagement) |

---

## 6. Módulos Importados

```typescript
@Module({
  imports: [
    AnalyticsModule,    // trackea impresiones al publicar
    FeatureFlagsModule, // controla features por tenant (ej: video testimonials)
    WebhooksModule,     // emite evento testimonial.published al OutboxHandler
    CloudModule,        // Cloudinary para imágenes
    TenantsModule,      // resolución de tenant activo
  ],
  exports: [TestimonialsService],
})
```

---

## 7. Integración con Webhooks

Al ejecutar `publishTestimonial()`, `TestimonialsService` debe:

1. Cambiar estado a `published` en la misma transacción
2. Llamar a `WebhookOutboxHandler.emit('testimonial.published', payload)`
3. El handler escribe el evento en `outbox_events` **en la misma transacción**

> ⚠️ Si el evento no se escribe atómicamente, se puede perder. Ver ADR-0002.

---

## 8. Scoring

El `ScoringService` calcula un `score` numérico para ordenamiento:

```
score = f(rating, recency_decay, engagement_factor)
recency_decay = e^(-λ * days_since_published)  // half-life ~30 días
```

El score se recalcula al publicar y puede recalcularse con un job periódico.

---

## 9. Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| `BR-VAL-001` | Contenido mínimo 10 chars |
| `BR-VAL-002` | Rating entero 1-5 |
| `BR-FLOW-001` | Lifecycle secuencial (no saltar estados, no revertir `published`) |
| `BR-SEC-001` | Toda query filtrada por `tenant_id` del usuario autenticado |

---

## 10. Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
