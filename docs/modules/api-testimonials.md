# Módulo: Testimonials (`apps/api/src/modules/testimonials/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-10-02

> Contrato activo de límites: JSON general hasta 1 MiB. Los POST de subida de imagen y envío público con imagen aceptan un cuerpo JSON de hasta 14 MiB para transportar base64; la imagen decodificada se valida a un máximo de 10 MiB antes de persistir o llamar a Cloudinary. Los listados administrativos de testimonios, categorías y etiquetas responden `{ items, meta: { page, limit, total } }`; `page` por defecto es 1 y `limit` por defecto es 20, máximo 100.

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
| `→ pending` | Cliente externo | `POST /api/v1/public/testimonials/:slug/submit` |
| `pending → approved` | Editor/Admin | `POST /api/v1/testimonials/:id/approve` |
| `pending → rejected` | Editor/Admin | `POST /api/v1/testimonials/:id/reject` |
| `approved → published` | Editor/Admin | `POST /api/v1/testimonials/:id/publish` (emite evento webhook) |

---

## 3. Endpoints

| Método | Ruta | Descripción | Guard |
|--------|------|-------------|-------|
| `POST` | `/api/v1/public/testimonials/:slug/submit` | Envío público de testimonio | `RateLimitGuard` y control de Origin; sin API Key |
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

**Contrato implementado en código:** `Idempotency-Key` en creación y publicación administrativa vincula reserva, mutación, outbox y resultado en la misma transacción según el [contrato HTTP](../technical/08_http_idempotency_contract.md); la migración está preparada, pero su aplicación y la concurrencia en PostgreSQL no están verificadas. El envío público con marca reciente de navegador devuelve `409 PUBLIC_SUBMISSION_RECENT_BROWSER`, distinto del `429` del límite por IP, sin afirmar una escritura inexistente.

| DTO | Campos clave | Validación |
|-----|-------------|------------|
| `CreateTestimonialDto` | `authorName`, `content`, `rating`, `categoryId?`, `tagIds?[]` | name 2-120, content 10-1000, rating 1-5 |
| `UpdateTestimonialDto` | Todos opcionales, mismas reglas | — |
| `ModerateTestimonialDto` | `reason?` | max 500 chars |
| `SubmitPublicTestimonialDto` | `authorName`, `content`, `rating`, `imageBase64?`, `videoUrl?` | Video: URL HTTPS de `youtube.com/watch` (también `www` y `m`) o `youtu.be` con ID de 11 caracteres; se guarda URL canónica. |
| `PublicTestimonialsQueryDto` | `q?`, `tag?`, `category?`, `sort?`, `page?`, `limit?` | `page`: entero 1–10 000 (default 1); `limit`: entero 1–100 (default 20); `q` hasta 200 y tag/categoría hasta 80 caracteres; sort: `score:desc` \| `publishedAt:desc`. Inválidos: 400. |
| `UploadImageDto` | `imageBase64` | string (base64) |
| `AttachVideoDto` | `videoUrl` | URL de YouTube con las mismas reglas que el envío público. |

El envío público devuelve `201` con `{ success: true, data: { id, status, failedMedia } }`. `status: 'success'` lleva `failedMedia: []`; si una imagen o un video falla después de confirmar texto y outbox, `status: 'partial'` incluye `'image'` y/o `'video'`. En ambos casos se establece la marca de navegador. La web confirma la recepción del texto e indica el medio faltante sin pedir reenviar el formulario completo. Una actualización o eliminación que pierde el testimonio tras la lectura inicial devuelve 404; un estado cambiado con la fila aún presente devuelve 409.

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
