# Módulo: Testimonials (`apps/api/src/modules/testimonials/`)

# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica

# Última actualización: 2026-10-15

> Contrato activo de límites: JSON general hasta 1 MiB. Los POST de subida de imagen y envío público con imagen aceptan un cuerpo JSON de hasta 14 MiB para transportar base64; la imagen decodificada se valida a un máximo de 10 MiB antes de persistir o llamar a Cloudinary. Los listados administrativos de testimonios, categorías y etiquetas responden por HTTP `{ success: true, data: [], meta: { page, limit, total } }` (internamente, el servicio devuelve `{ items, meta }`); `page` por defecto es 1 y `limit` por defecto es 20, máximo 100.

---

## 1. Responsabilidad

Es el **módulo core del dominio**. Gestiona el ciclo de vida completo de los testimonios: creación pública, moderación, scoring, organización por tags/categorías y publicación. Es el productor principal de eventos para el módulo de webhooks.

---

## 2. Lifecycle de Testimonios

```
draft ──► pending ──► approved ──► published
                  └──► rejected
```

| Transición             | Actor           | Acción                                                         |
| ---------------------- | --------------- | -------------------------------------------------------------- |
| `→ pending`            | Cliente externo | `POST /api/v1/public/testimonials/:slug/submit`                |
| `pending → approved`   | Editor/Admin    | `POST /api/v1/testimonials/:id/approve`                        |
| `pending → rejected`   | Editor/Admin    | `POST /api/v1/testimonials/:id/reject`                         |
| `approved → published` | Editor/Admin    | `POST /api/v1/testimonials/:id/publish` (emite evento webhook) |

---

## 3. Endpoints

| Método   | Ruta                                       | Descripción                             | Guard                                             |
| -------- | ------------------------------------------ | --------------------------------------- | ------------------------------------------------- |
| `POST`   | `/api/v1/public/testimonials/:slug/submit` | Envío público de testimonio             | `RateLimitGuard` y control de Origin; sin API Key |
| `GET`    | `/api/v1/testimonials`                     | Lista testimonios del tenant (paginado) | `JwtAuthGuard`                                    |
| `GET`    | `/api/v1/testimonials/summary`             | Cantidades globales por estado          | JWT + admin/editor + feature testimonials         |
| `GET`    | `/api/v1/testimonials/:id`                 | Obtiene testimonio por ID               | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials`                     | Crea testimonio (admin)                 | `JwtAuthGuard`                                    |
| `PATCH`  | `/api/v1/testimonials/:id`                 | Actualiza testimonio                    | `JwtAuthGuard`                                    |
| `DELETE` | `/api/v1/testimonials/:id`                 | Elimina testimonio                      | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials/:id/approve`         | Aprueba testimonio                      | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials/:id/reject`          | Rechaza testimonio                      | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials/:id/publish`         | Publica testimonio                      | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials/:id/image`           | Sube imagen asociada                    | `JwtAuthGuard`                                    |
| `POST`   | `/api/v1/testimonials/:id/video`           | Adjunta video URL                       | `JwtAuthGuard`                                    |
| `GET`    | `/api/v1/tags`                             | Lista tags del tenant                   | `JwtAuthGuard`                                    |
| `GET`    | `/api/v1/categories`                       | Lista categorías del tenant             | `JwtAuthGuard`                                    |

---

## Búsqueda y resumen administrativos (fase 3)

Los endpoints de testimonios requieren sesión activa, rol `admin`/`editor` y feature `testimonials`; categorías y etiquetas requieren sesión y esos roles. El tenant se obtiene de la identidad verificada, nunca de la query.

| Endpoint                                     | Query / respuesta                                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/v1/testimonials`                   | `page` 1–10 000 (default 1), `limit` 1–100 (default 20); `q` hasta 200 caracteres, trim, búsqueda parcial sin distinguir mayúsculas en autor **o** contenido; `status` draft/pending/approved/published/rejected; `categoryId` UUID; `tagIds` UUID repetible (máximo 20 entradas, deduplicadas, **AND**); `sort` createdAt:desc (default) o score:desc. |
| `GET /api/v1/testimonials/summary`           | `{ success:true, data:{ total, byStatus:{ draft,pending,approved,published,rejected } } }`. Ceros explícitos, cantidades de todo el tenant, sin depender de la página. Ruta declarada antes de `/:testimonial_id`.                                                                                                                                      |
| `GET /api/v1/categories`, `GET /api/v1/tags` | Misma paginación, `q` hasta 200 caracteres sobre nombre, trim y comparación sin distinguir mayúsculas. Cada elemento añade `testimonialCount`, cantidad de asociaciones **en todo el tenant**, sin aplicar los filtros del listado de testimonios. Orden nombre ascendente, ID ascendente.                                                              |

Filtros antes de `skip/take`; `meta.total` usa las mismas condiciones y tenant. Ambos órdenes de testimonios desempatan por ID descendente. Sin filtros se conserva el contrato previo y el orden reciente. Arrays en campos escalares, estados/órdenes desconocidos, UUID inválidos y límites excedidos producen 400. `tagIds` puede enviarse como `?tagIds=uuid1&tagIds=uuid2`. No es una búsqueda de texto completo: «relevancia» ordena el puntaje existente; no calcula relevancia textual ni usa IA.

Resumen, catálogos y testimonios recientes son consultas separadas sobre datos vivos; no se promete un snapshot histórico ni una reserva de posiciones entre páginas concurrentemente modificadas. No hay consultas individuales por testimonio para obtener sus etiquetas/categoría.

`GET /api/v1/testimonials/:id` conserva la lectura aislada por tenant y 404 para inexistentes/ajenos. `DELETE` conserva admin para cualquier testimonio y editor sólo para propios, sin una restricción adicional por estado en el contrato vigente. La eliminación de asociaciones de etiquetas y del testimonio es transaccional. Si tiene actividad registrada, devuelve 409 con código `TESTIMONIAL_HAS_ACTIVITY`, conserva el registro, sus etiquetas y los eventos; el frontend explica el ocultamiento para publicados. Decisión humana confirmada el 2026-10-15. Una referencia concurrente que impide borrar produce conflicto y revierte la transacción. Después de borrar un publicado sin actividad se invalida la caché pública del tenant. No se altera el esquema ni se amplían permisos para acomodar controles. La tabla RBAC histórica de `business_rules.md` propone restricciones de eliminación por estado distintas del servicio actual; esta fase conserva el contrato implementado conforme al plan aprobado y registra la divergencia, sin presentar ambas fuentes como equivalentes.

## 4. DTOs (nestjs-zod)

**Contrato implementado en código:** `Idempotency-Key` en creación y publicación administrativa vincula reserva, mutación, outbox y resultado en la misma transacción según el [contrato HTTP](../technical/08_http_idempotency_contract.md); la migración está preparada, pero su aplicación y la concurrencia en PostgreSQL no están verificadas. El envío público con marca reciente de navegador devuelve `409 PUBLIC_SUBMISSION_RECENT_BROWSER`, distinto del `429` del límite por IP, sin afirmar una escritura inexistente.

| DTO                          | Campos clave                                                   | Validación                                                                                                                                                                            |
| ---------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CreateTestimonialDto`       | `authorName`, `content`, `rating`, `categoryId?`, `tagIds?[]`  | name 2-120, content 10-1000, rating 1-5                                                                                                                                               |
| `UpdateTestimonialDto`       | Todos opcionales, mismas reglas                                | —                                                                                                                                                                                     |
| `ModerateTestimonialDto`     | `reason?`                                                      | max 500 chars                                                                                                                                                                         |
| `SubmitPublicTestimonialDto` | `authorName`, `content`, `rating`, `imageBase64?`, `videoUrl?` | Video: URL HTTPS de `youtube.com/watch` (también `www` y `m`) o `youtu.be` con ID de 11 caracteres; se guarda URL canónica.                                                           |
| `PublicTestimonialsQueryDto` | `q?`, `tag?`, `category?`, `sort?`, `page?`, `limit?`          | `page`: entero 1–10 000 (default 1); `limit`: entero 1–100 (default 20); `q` hasta 200 y tag/categoría hasta 80 caracteres; sort: `score:desc` \| `publishedAt:desc`. Inválidos: 400. |
| `UploadImageDto`             | `imageBase64`                                                  | string (base64)                                                                                                                                                                       |
| `AttachVideoDto`             | `videoUrl`                                                     | URL de YouTube con las mismas reglas que el envío público.                                                                                                                            |

El envío público devuelve `201` con `{ success: true, data: { id, status, failedMedia } }`. `status: 'success'` lleva `failedMedia: []`; si una imagen o un video falla después de confirmar texto y outbox, `status: 'partial'` incluye `'image'` y/o `'video'`. En ambos casos se establece la marca de navegador. La web confirma la recepción del texto e indica el medio faltante sin pedir reenviar el formulario completo. Una actualización o eliminación que pierde el testimonio tras la lectura inicial devuelve 404; un estado cambiado con la fila aún presente devuelve 409.

---

## 5. Servicios

| Servicio              | Responsabilidad                                                 |
| --------------------- | --------------------------------------------------------------- |
| `TestimonialsService` | Lógica de ciclo de vida, moderación, queries principales        |
| `TagsService`         | CRUD de tags por tenant                                         |
| `CategoriesService`   | CRUD de categorías por tenant                                   |
| `ScoringService`      | Cálculo del score de relevancia (recency + rating + engagement) |

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

| ID            | Regla                                                             |
| ------------- | ----------------------------------------------------------------- |
| `BR-VAL-001`  | Contenido mínimo 10 chars                                         |
| `BR-VAL-002`  | Rating entero 1-5                                                 |
| `BR-FLOW-001` | Lifecycle secuencial (no saltar estados, no revertir `published`) |
| `BR-SEC-001`  | Toda query filtrada por `tenant_id` del usuario autenticado       |

---

## 10. Historial de Cambios

| Fecha      | Cambio                            |
| ---------- | --------------------------------- |
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
