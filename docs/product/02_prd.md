# Product Requirements Document (PRD)

## 1. Resumen Ejecutivo
`Testimonial CMS` es una plataforma SaaS multi-tenant para recopilar, moderar y distribuir testimonios de clientes con foco en:
- Distribución mediante `embed` (widget embebible) y `API REST` pública.
- Engagement y analítica (views/clicks/plays) alimentando un ranking por `scoring`.
- Integraciones extensibles con `webhooks` confiables (outbox) y `feature flags`.

Este PRD define requisitos técnicos para el alcance inicial, alineados con arquitectura `NestJS + PostgreSQL + Redis` y frontend `Next.js` consumiendo la API.

## 2. Objetivos de Producto y Alcance
### 2.1 Objetivos
- Reducir el tiempo de integración (cliente y/o desarrollador consume testimonios vía embed/API).
- Mejorar rendimiento percibido en captación (ranking por engagement y reglas determinísticas).
- Dar trazabilidad y confiabilidad en integraciones externas (webhooks con reintentos y auditoría).

### 2.2 Alcance (in scope)
1. Multi-tenant (aislamiento por `tenant_id`) y seguridad por `API keys` y `RBAC`.
2. Gestión de testimonios con estados de moderación:
   - `draft` → `pending` → `approved`/`rejected` → `published`
3. Catálogos por tenant: `categories`, `tags` (N:N con testimonios).
4. Distribución:
   - `embed` embebible (script + atributos `tenant`/opciones).
   - `API REST` versionada para consulta pública (filtrado, ordenamiento, paginación).
5. Analítica:
   - endpoint para registrar eventos y cálculo de contadores/indicadores.
6. Scoring:
   - campo `score` en `testimonials`, recalculado periódicamente y/o por eventos según estrategia definida.
7. Webhooks:
   - configuración por tenant (URL + evento) y entrega asíncrona mediante `outbox_events`.
8. Feature flags por tenant para controlar visibilidad de features.

### 2.3 Fuera de alcance (out of scope)
- Multi-idioma de interfaz (solo contenido).
- Importación masiva avanzada (CSV/bulk ingestion).
- Recomendaciones con IA y automatizaciones complejas.
- Integraciones específicas (p. ej. formateo nativo para Slack como “tipo slack”); se soporta webhook genérico con payload consistente.

## 3. Audiencia y Personas
| Persona | Rol en el sistema | Necesidad principal |
|---|---|---|
| Admin (tenant) | Administra configuración, API keys, flags y revisa analítica | Controlar y operar la plataforma para su tenant |
| Editor (tenant) | Crea/edita/modea testimonios | Aprobar/rechazar contenido con flujo claro |
| Dev Cliente (integrador) | Consume API y/o embed | Integración simple con contrato estable |
| Visitante (público) | Consume testimonios vía embed y genera eventos | Ver testimonios relevantes y medir engagement |

## 4. Requisitos Funcionales
### 4.1 Tenancy, Auth y Autorización
- Cada solicitud se resuelve a un `tenant_id` a partir de:
  - `JWT` (usuarios internos del tenant) para el dashboard.
  - `API key` (hash almacenado) para la API pública.
- `RBAC`:
  - Roles por tenant: `admin`, `editor`.
  - Permisos se modelan por rol (catálogo `permissions`).
- Endpoints públicos deben aplicar `rate limiting` (por IP y/o API key).

### 4.2 Testimonios (CRUD + moderación)
Operaciones requeridas por tenant:
- Crear/editar testimonios: contenido textual y metadatos del autor + rating.
- Estados:
  - `draft`: editable por editor; no publicado.
  - `pending`: listo para revisión.
  - `approved`: aprobado para publicación.
  - `rejected`: rechazo (opcionalmente con motivo).
  - `published`: visible en embed y API pública.
- Reglas de transición:
  - Solo `editor/admin` puede cambiar estados.
  - Solo `approved` puede pasar a `published` (o transición definida por reglas del dominio).

### 4.3 Multimedia e ingestión (integraciones externas)
Soporte mínimo:
- Imagen/video:
  - Subida mediante `Cloudinary` (almacenando URLs y metadatos relevantes).
- Video (opcional según alcance inicial):
  - Importación/metadata desde `YouTube API` (guardando URL y datos necesarios para el embed).

Requisitos:
- Timeouts y retries para integración externa.
- Fallback controlado (guardar URL cuando falle metadata si se define).

### 4.4 Catálogos: categorías y tags
- CRUD de `categories` y `tags` por tenant.
- Asociación N:N: `testimonials_tags`.
- Validación:
  - Solo se asignan tags/categorías del mismo `tenant`.

### 4.5 Distribución pública: API REST y Embed
API REST (versionada):
- Base: `/api/v1/...`
- Autenticación: `Bearer <api_key>` (para endpoints consultables por el embed y por integradores).
- Endpoints de consulta:
  - `GET /testimonials` con filtros:
    - `status=published`
    - `tag`
    - `category`
    - `q` (búsqueda por texto, si aplica)
  - ordenamiento:
    - `sort=score:desc` (default) y/o `sort=published_at:desc`
  - paginación:
    - `page` + `limit` con `meta.total`.

Embed:
- Script embebible con configuración via atributos (ej. `data-tenant` y opciones como `data-limit`).
- El script consulta la API y renderiza testimonios.
- Contrato de eventos para registrar analítica (ver 4.6).

### 4.6 Analítica
Eventos soportados (mínimos):
- `view`
- `click`
- `play` (cuando aplique a multimedia)

Requisitos:
- Endpoint:
  - `POST /analytics/events` (asociado a `tenant_id` y `testimonial_id`).
- Datos mínimos por evento:
  - `event_type`, `testimonial_id`, `source` (`embed`/`dashboard`), `timestamp`.
- Anti-inflado básico:
  - Validación y controles de rate limiting.
- Persistencia:
  - Guardar eventos (OLTP) y/o contadores con estrategia definida.

### 4.7 Scoring (ranking)
- El ranking se materializa como `testimonials.score`.
- La fórmula usa métricas de engagement (views/clicks/play) + rating + recencia.
- Estrategia de cálculo (permitida):
  - Recalculación periódica por `worker/cron`.
  - Alternativamente, recalcular por evento con límites (si se decide).
- Requisitos:
  - Determinismo (misma entrada produce mismo resultado).
  - No romper API: cambios en score deben ser transparentes para el consumidor.

### 4.8 Webhooks (event-driven confiable)
Configuración (por tenant):
- Modelo: `webhooks` con:
  - `url`, `event_id` (catálogo), `is_active`, `secret` (opcional para firma).

Eventos disparados:
- Transición `published` de un testimonial:
  - evento: `testimonial.published`

Entrega:
- Implementación con `outbox_events` para consistencia:
  - la transición de `published` crea un registro en `outbox_events` en la misma transacción.
- Worker:
  - procesa eventos pending,
  - envía `POST` al `webhook.url`,
  - guarda `webhook_deliveries` (estado, intentos, response_code),
  - aplica retry con backoff exponencial y maneja fallos persistentes.

Contratos:
- Payload JSON consistente con datos mínimos (id, tenant, testimonial, status).
- Firma HMAC (si se usa `secret`): header `X-Signature` y verificación en el receptor del cliente.

### 4.9 Feature flags
- Flags por tenant para controlar disponibilidad de:
  - `enable_analytics`
  - `enable_webhooks`
  - `enable_scoring`
- Reglas:
  - La decisión de activación vive en backend.
  - El front debe reflejar el estado con datos del backend (sin depender de hardcode).

### 4.10 API keys
- Generación/revocación por admin.
- Almacenamiento:
  - guardar `key_hash` (no plaintext).
- Uso:
  - middleware resuelve `tenant_id` desde la API key.
- Seguridad:
  - rate limiting y aislamiento por tenant.

## 5. Requisitos No Funcionales
### 5.1 Rendimiento
- Endpoints públicos para listado:
  - objetivo p95 < 200ms en condiciones normales.
- Embed:
  - latencia de red + render razonable; minimizar llamadas duplicadas.
- Caching:
  - Redis para consultas frecuentes (por tenant + filtros).
  - TTL corto y validación por invalidados cuando cambian testimonios publicados o score.

### 5.2 Seguridad (OWASP aplicado)
- Autenticación:
  - `JWT` (access token) + `refresh tokens` rotados y hasheados.
- Autorización:
  - `RBAC` y aislamiento por `tenant_id` basado en el token (nunca en input del cliente).
- Validación:
  - DTO + `ValidationPipe` global en NestJS.
- Protección de API pública:
  - rate limiting por IP y/o API key.
- Logging:
  - logs estructurados, sin `console.log`.
- Manejo de errores:
  - respuestas consistentes con códigos HTTP correctos.

### 5.3 Fiabilidad y resiliencia
- Webhooks y eventos:
  - `outbox_events` para evitar pérdidas de eventos.
  - retry con backoff y auditoría por `webhook_deliveries`.
- Timeouts:
  - timeouts a llamadas externas (Cloudinary/YouTube/webhook).
- Idempotencia:
  - protección ante duplicados en endpoints críticos (por ejemplo usando `Idempotency-Key` en creación y/o eventos).

## 6. Métricas de Éxito
- Engagement:
  - CTR = `clicks / views` en testimonios publicados.
  - Top testimonios por `score`.
- Analítica:
  - tasa de recepción/consistencia de eventos `view/click/play`.
- Webhooks:
  - % de entregas exitosas.
  - latencia de entrega desde publicación a recepción.
- Calidad:
  - tasa de errores 4xx/5xx por endpoint.

## 7. Dependencias y Restricciones
- Base de datos: `PostgreSQL` (OLTP y consultas con filtros).
- Caché: `Redis` (reducción de carga y velocidad en listados).
- Multimedia:
  - `Cloudinary` para almacenamiento/transformación.
  - `YouTube API` para metadata (si se habilita).
- Embed:
  - debe funcionar sin dependencias del framework (script estándar).

## 8. Contrato de API (consistencia)
- Versionado: `/api/v1`.
- Respuestas:
  - forma estándar `success/data/error`.
- Paginación:
  - `meta.total`, `meta.page`, `meta.limit`.
- Errores:
  - codes consistentes (p. ej. `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`).

## 9. Glosario
- `Tenant`: cliente (empresa) aislado por `tenant_id`.
- `Testimonio`: entidad administrable con estado de moderación y métricas.
- `Moderación`: flujo `pending` → `approved/rejected` → `published`.
- `Embed`: widget embebible que consulta la API.
- `Webhook`: callback HTTP a URL externa ante eventos.
- `Scoring`: ranking materializado en `testimonials.score`.
- `Outbox`: tabla `outbox_events` que garantiza consistencia evento→entrega.
- `Feature flag`: toggle por tenant para habilitar/deshabilitar funcionalidades.

