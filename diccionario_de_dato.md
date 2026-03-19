🗄️ Documentación Técnica: Diccionario de Datos

**Proyecto:** Testimonial CMS  
**Dominio:** Plataforma SaaS multi‑inquilino para la gestión, moderación y distribución de testimonios con embeds, API pública, analítica, webhooks y scoring.  
**Motor de Base de Datos:** PostgreSQL 16  
**Arquitecto Responsable:** [TU_NOMBRE]

---

## 1. Diccionario de Datos (Estructura de Tablas)

### Tabla: `tenants`

**Descripción:** Almacena las empresas o instituciones (inquilinos) que utilizan la plataforma.

| Campo         | Tipo de Dato | Restricciones (Constraints)         | Descripción                                   | Ejemplo                          |
|---------------|--------------|--------------------------------------|-----------------------------------------------|----------------------------------|
| `id`          | `UUID`       | PK, DEFAULT `gen_random_uuid()`     | Identificador único del inquilino.            | `550e8400-e29b-41d4-a716-446655440000` |
| `name`        | `TEXT`       | NOT NULL, UNIQUE                     | Nombre de la empresa.                          | `Academia X`                     |
| `is_active`   | `BOOLEAN`    | NOT NULL, DEFAULT `TRUE`             | Indica si el inquilino está activo.            | `true`                           |
| `created_at`  | `TIMESTAMP`  | NOT NULL, DEFAULT `now()`            | Fecha y hora de creación.                      | `2026-03-15 10:00:00`            |

---

### Tabla: `roles`

**Descripción:** Catálogo de roles del sistema (RBAC).

| Campo         | Tipo de Dato | Restricciones               | Descripción                     | Ejemplo      |
|---------------|--------------|------------------------------|---------------------------------|--------------|
| `id`          | `SMALLSERIAL`| PK                           | Identificador del rol.          | `1`          |
| `code`        | `TEXT`       | NOT NULL, UNIQUE             | Código único del rol.           | `'admin'`    |
| `description` | `TEXT`       |                              | Descripción opcional.           | `Administrador` |

---

### Tabla: `permissions`

**Descripción:** Catálogo de permisos específicos.

| Campo         | Tipo de Dato | Restricciones               | Descripción                     | Ejemplo               |
|---------------|--------------|------------------------------|---------------------------------|-----------------------|
| `id`          | `SMALLSERIAL`| PK                           | Identificador del permiso.      | `1`                   |
| `code`        | `TEXT`       | NOT NULL, UNIQUE             | Código único del permiso.       | `'create:testimonial'`|
| `description` | `TEXT`       |                              | Descripción opcional.           | `Crear testimonios`   |

---

### Tabla: `role_permissions`

**Descripción:** Relación muchos a muchos entre roles y permisos.

| Campo           | Tipo de Dato | Restricciones                          | Descripción                         | Ejemplo |
|-----------------|--------------|-----------------------------------------|-------------------------------------|---------|
| `role_id`       | `SMALLINT`   | PK, FK → `roles(id)`                   | Identificador del rol.              | `1`     |
| `permission_id` | `SMALLINT`   | PK, FK → `permissions(id)`              | Identificador del permiso.          | `1`     |

---

### Tabla: `users`

**Descripción:** Usuarios de la plataforma (pertenecen a un inquilino).

| Campo           | Tipo de Dato | Restricciones                           | Descripción                            | Ejemplo                          |
|-----------------|--------------|------------------------------------------|----------------------------------------|----------------------------------|
| `id`            | `UUID`       | PK, DEFAULT `gen_random_uuid()`         | Identificador único del usuario.       | `550e8400-e29b-41d4-a716-446655440001` |
| `tenant_id`     | `UUID`       | NOT NULL, FK → `tenants(id)`            | Inquilino al que pertenece.            | `550e8400-e29b-41d4-a716-446655440000` |
| `email`         | `TEXT`       | NOT NULL, UNIQUE                         | Correo electrónico (único global).     | `admin@academia.com`            |
| `password_hash` | `TEXT`       | NOT NULL                                 | Hash de la contraseña (bcrypt).        | `$2a$10$...`                    |
| `is_active`     | `BOOLEAN`    | DEFAULT `TRUE`                           | Usuario activo o desactivado.          | `true`                          |
| `created_at`    | `TIMESTAMP`  | DEFAULT `now()`                          | Fecha de creación.                     | `2026-03-15 10:00:00`           |

---

### Tabla: `user_roles`

**Descripción:** Asignación de roles a usuarios.

| Campo     | Tipo de Dato | Restricciones                    | Descripción                  | Ejemplo |
|-----------|--------------|-----------------------------------|------------------------------|---------|
| `user_id` | `UUID`       | PK, FK → `users(id)`             | Identificador del usuario.   | `...001`|
| `role_id` | `SMALLINT`   | PK, FK → `roles(id)`             | Identificador del rol.       | `1`     |

---

### Tabla: `refresh_tokens`

**Descripción:** Almacena tokens de refresco para autenticación JWT.

| Campo         | Tipo de Dato | Restricciones                    | Descripción                            | Ejemplo                          |
|---------------|--------------|-----------------------------------|----------------------------------------|----------------------------------|
| `id`          | `UUID`       | PK, DEFAULT `gen_random_uuid()`  | Identificador único del token.         | `...`                            |
| `user_id`     | `UUID`       | NOT NULL, FK → `users(id)`       | Usuario propietario del token.         | `...001`                         |
| `token_hash`  | `TEXT`       | NOT NULL                          | Hash del refresh token.                 | `$2a$10$...`                    |
| `expires_at`  | `TIMESTAMP`  | NOT NULL                          | Fecha de expiración.                   | `2026-04-01 10:00:00`            |
| `revoked`     | `BOOLEAN`    | DEFAULT `FALSE`                   | Indica si el token fue revocado.       | `false`                          |

---

### Tabla: `testimonial_status`

**Descripción:** Catálogo de estados posibles de un testimonio.

| Campo | Tipo de Dato | Restricciones        | Descripción               | Ejemplo      |
|-------|--------------|-----------------------|---------------------------|--------------|
| `id`  | `SMALLSERIAL`| PK                    | Identificador del estado. | `1`          |
| `code`| `TEXT`       | NOT NULL, UNIQUE      | Código del estado.        | `'published'`|

---

### Tabla: `testimonials`

**Descripción:** Tabla principal que almacena los testimonios.

| Campo          | Tipo de Dato    | Restricciones                              | Descripción                                   | Ejemplo                              |
|----------------|-----------------|---------------------------------------------|-----------------------------------------------|--------------------------------------|
| `id`           | `UUID`          | PK, DEFAULT `gen_random_uuid()`             | Identificador único del testimonio.           | `...002`                             |
| `tenant_id`    | `UUID`          | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.                        | `...000`                             |
| `content`      | `TEXT`          | NOT NULL                                     | Contenido del testimonio.                     | `"Excelente curso, lo recomiendo."`  |
| `author_name`  | `TEXT`          | NOT NULL                                     | Nombre del autor.                              | `Juan Pérez`                         |
| `rating`       | `INT`           | NOT NULL, CHECK (rating BETWEEN 1 AND 5)    | Puntuación de 1 a 5.                           | `5`                                  |
| `status_id`    | `SMALLINT`      | NOT NULL, FK → `testimonial_status(id)`     | Estado actual.                                 | `4` (`published`)                    |
| `score`        | `NUMERIC(10,4)` | DEFAULT `0`                                   | Puntaje calculado para ranking.                | `87.5300`                            |
| `created_at`   | `TIMESTAMP`     | DEFAULT `now()`                              | Fecha de creación.                             | `2026-03-15 10:00:00`                |
| `published_at` | `TIMESTAMP`     |                                               | Fecha de publicación (si aplica).              | `2026-03-16 09:00:00`                |

---

### Tabla: `categories`

**Descripción:** Categorías definidas por cada inquilino para clasificar testimonios.

| Campo       | Tipo de Dato | Restricciones                              | Descripción                     | Ejemplo        |
|-------------|--------------|---------------------------------------------|---------------------------------|----------------|
| `id`        | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador de la categoría.  | `...003`       |
| `tenant_id` | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.          | `...000`       |
| `name`      | `TEXT`       | NOT NULL, UNIQUE (tenant_id, name)          | Nombre de la categoría.         | `'Educación'`  |

---

### Tabla: `tags`

**Descripción:** Etiquetas definidas por cada inquilino.

| Campo       | Tipo de Dato | Restricciones                              | Descripción                 | Ejemplo      |
|-------------|--------------|---------------------------------------------|-----------------------------|--------------|
| `id`        | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador de la etiqueta.| `...004`     |
| `tenant_id` | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.       | `...000`     |
| `name`      | `TEXT`       | NOT NULL, UNIQUE (tenant_id, name)          | Nombre de la etiqueta.       | `'online'`   |

---

### Tabla: `testimonial_tags`

**Descripción:** Relación muchos a muchos entre testimonios y etiquetas.

| Campo            | Tipo de Dato | Restricciones                              | Descripción                     | Ejemplo |
|------------------|--------------|---------------------------------------------|---------------------------------|---------|
| `testimonial_id` | `UUID`       | PK, FK → `testimonials(id)`                 | Identificador del testimonio.   | `...002`|
| `tag_id`         | `UUID`       | PK, FK → `tags(id)`                         | Identificador de la etiqueta.   | `...004`|

---

### Tabla: `analytics_event_types`

**Descripción:** Catálogo de tipos de eventos de analítica.

| Campo | Tipo de Dato | Restricciones        | Descripción          | Ejemplo   |
|-------|--------------|-----------------------|----------------------|-----------|
| `id`  | `SMALLSERIAL`| PK                    | Identificador.       | `1`       |
| `code`| `TEXT`       | NOT NULL, UNIQUE      | Código del evento.   | `'view'`  |

---

### Tabla: `analytics_events`

**Descripción:** Registro de eventos de interacción con testimonios (views, clicks, plays).

| Campo            | Tipo de Dato | Restricciones                              | Descripción                          | Ejemplo                          |
|------------------|--------------|---------------------------------------------|--------------------------------------|----------------------------------|
| `id`             | `BIGSERIAL`  | PK                                          | Identificador único del evento.      | `1000001`                        |
| `tenant_id`      | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.               | `...000`                         |
| `testimonial_id` | `UUID`       | NOT NULL, FK → `testimonials(id)`           | Testimonio asociado.                 | `...002`                         |
| `event_type_id`  | `SMALLINT`   | NOT NULL, FK → `analytics_event_types(id)` | Tipo de evento.                      | `1` (`view`)                     |
| `created_at`     | `TIMESTAMP`  | DEFAULT `now()`                              | Fecha y hora del evento.             | `2026-03-16 10:05:00`            |

---

### Tabla: `webhook_events`

**Descripción:** Catálogo de eventos que pueden disparar webhooks.

| Campo | Tipo de Dato | Restricciones        | Descripción          | Ejemplo                    |
|-------|--------------|-----------------------|----------------------|----------------------------|
| `id`  | `SMALLSERIAL`| PK                    | Identificador.       | `1`                        |
| `code`| `TEXT`       | NOT NULL, UNIQUE      | Código del evento.   | `'testimonial.published'`  |

---

### Tabla: `webhooks`

**Descripción:** Configuración de webhooks por inquilino.

| Campo       | Tipo de Dato | Restricciones                              | Descripción                           | Ejemplo                              |
|-------------|--------------|---------------------------------------------|---------------------------------------|--------------------------------------|
| `id`        | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador del webhook.            | `...005`                             |
| `tenant_id` | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.                | `...000`                             |
| `url`       | `TEXT`       | NOT NULL                                     | URL del endpoint que recibe el evento.| `https://api.cliente.com/webhook`    |
| `event_id`  | `SMALLINT`   | NOT NULL, FK → `webhook_events(id)`         | Evento que activa el webhook.         | `1` (`testimonial.published`)        |
| `is_active` | `BOOLEAN`    | DEFAULT `TRUE`                               | Si el webhook está activo.            | `true`                               |
| `secret`    | `TEXT`       |                                              | Secreto para firmar la petición.      | `whsec_abc123`                       |
| `created_at`| `TIMESTAMP`  | DEFAULT `now()`                              | Fecha de creación.                    | `2026-03-15 10:00:00`                |

---

### Tabla: `webhook_deliveries`

**Descripción:** Historial de entregas de webhooks (para reintentos y monitoreo).

| Campo          | Tipo de Dato | Restricciones                              | Descripción                             | Ejemplo                          |
|----------------|--------------|---------------------------------------------|-----------------------------------------|----------------------------------|
| `id`           | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador de la entrega.            | `...006`                         |
| `webhook_id`   | `UUID`       | NOT NULL, FK → `webhooks(id)`               | Webhook asociado.                       | `...005`                         |
| `status`       | `TEXT`       | NOT NULL                                     | Estado de la entrega (success, failed). | `'success'`                      |
| `attempts`     | `INT`        | DEFAULT `0`                                  | Número de intentos realizados.          | `1`                              |
| `response_code`| `INT`        |                                              | Código HTTP de respuesta.               | `200`                            |
| `created_at`   | `TIMESTAMP`  | DEFAULT `now()`                              | Fecha de la entrega.                    | `2026-03-16 10:05:00`            |

---

### Tabla: `feature_flags`

**Descripción:** Catálogo de flags de funcionalidad.

| Campo | Tipo de Dato | Restricciones        | Descripción           | Ejemplo                |
|-------|--------------|-----------------------|-----------------------|------------------------|
| `id`  | `UUID`       | PK, DEFAULT `gen_random_uuid()` | Identificador del flag.| `...007`               |
| `name`| `TEXT`       | NOT NULL, UNIQUE       | Nombre del flag.       | `'enable_analytics'`   |

---

### Tabla: `tenant_feature_flags`

**Descripción:** Asignación de feature flags a inquilinos (con estado activado/desactivado).

| Campo             | Tipo de Dato | Restricciones                              | Descripción                    | Ejemplo |
|-------------------|--------------|---------------------------------------------|--------------------------------|---------|
| `tenant_id`       | `UUID`       | PK, FK → `tenants(id)`                      | Inquilino.                     | `...000`|
| `feature_flag_id` | `UUID`       | PK, FK → `feature_flags(id)`                | Flag de funcionalidad.         | `...007`|
| `enabled`         | `BOOLEAN`    | DEFAULT `TRUE`                               | Indica si está activado.       | `true`  |

---

### Tabla: `api_keys`

**Descripción:** Claves de API para acceso externo (por inquilino).

| Campo       | Tipo de Dato | Restricciones                              | Descripción                     | Ejemplo                          |
|-------------|--------------|---------------------------------------------|---------------------------------|----------------------------------|
| `id`        | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador de la clave.      | `...008`                         |
| `tenant_id` | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino propietario.          | `...000`                         |
| `key_hash`  | `TEXT`       | NOT NULL                                     | Hash de la clave API.           | `$2a$10$...`                    |
| `is_active` | `BOOLEAN`    | DEFAULT `TRUE`                               | Si la clave está activa.        | `true`                           |
| `created_at`| `TIMESTAMP`  | DEFAULT `now()`                              | Fecha de creación.              | `2026-03-15 10:00:00`            |

---

### Tabla: `outbox_events`

**Descripción:** Almacena eventos para el patrón outbox (publicación asíncrona).

| Campo          | Tipo de Dato | Restricciones                              | Descripción                              | Ejemplo                          |
|----------------|--------------|---------------------------------------------|------------------------------------------|----------------------------------|
| `id`           | `UUID`       | PK, DEFAULT `gen_random_uuid()`             | Identificador del evento.                | `...009`                         |
| `tenant_id`    | `UUID`       | NOT NULL, FK → `tenants(id)`                | Inquilino asociado.                      | `...000`                         |
| `event_type`   | `TEXT`       | NOT NULL                                     | Tipo de evento (ej: testimonial.published).| `'testimonial.published'`        |
| `payload`      | `JSONB`      | NOT NULL                                     | Datos del evento en formato JSON.        | `{"id":"...002","author":"Juan"}`|
| `status`       | `TEXT`       | DEFAULT `'pending'`, CHECK (status IN ('pending','processed','failed')) | Estado del procesamiento. | `'pending'`                      |
| `attempts`     | `INT`        | DEFAULT `0`                                  | Número de intentos.                      | `0`                              |
| `created_at`   | `TIMESTAMP`  | DEFAULT `now()`                              | Fecha de creación.                       | `2026-03-16 10:05:00`            |
| `processed_at` | `TIMESTAMP`  |                                              | Fecha de procesamiento exitoso.          | `2026-03-16 10:05:01`            |

---

## 2. Integridad Referencial y Lógica de Búsqueda

### 🔗 Políticas de Claves Foráneas (Referential Integrity)

| Relación (Origen -> Destino)                      | Política ON DELETE | Política ON UPDATE | Justificación                                                                 |
|---------------------------------------------------|--------------------|---------------------|-------------------------------------------------------------------------------|
| `users.tenant_id -> tenants.id`                   | `NO ACTION` (implícito) | `NO ACTION` | No se permite eliminar un inquilino si tiene usuarios.                        |
| `refresh_tokens.user_id -> users.id`               | `NO ACTION`        | `NO ACTION`         | Evita borrar usuarios con tokens activos.                                     |
| `testimonials.tenant_id -> tenants.id`             | `NO ACTION`        | `NO ACTION`         | No se puede eliminar inquilino con testimonios asociados.                     |
| `testimonials.status_id -> testimonial_status.id`  | `NO ACTION`        | `NO ACTION`         | Los estados son catálogos fijos, no se eliminan.                              |
| `categories.tenant_id -> tenants.id`               | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `tags.tenant_id -> tenants.id`                     | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `testimonial_tags.testimonial_id -> testimonials.id`| `CASCADE` (implícito por PK compuesta, pero sin especificar, es NO ACTION) | `NO ACTION` | Si se elimina un testimonio, se borrarán sus relaciones (debería ser CASCADE, pero aquí no se definió; en la práctica se recomienda agregar ON DELETE CASCADE). |
| `testimonial_tags.tag_id -> tags.id`                | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `analytics_events.tenant_id -> tenants.id`          | `NO ACTION`        | `NO ACTION`         | No se puede borrar inquilino con eventos.                                     |
| `analytics_events.testimonial_id -> testimonials.id`| `NO ACTION`        | `NO ACTION`         | No se elimina testimonio con eventos asociados (o se debería usar CASCADE).  |
| `webhooks.tenant_id -> tenants.id`                  | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `webhook_deliveries.webhook_id -> webhooks.id`      | `NO ACTION`        | `NO ACTION`         | No se puede borrar webhook con entregas pendientes.                           |
| `tenant_feature_flags.tenant_id -> tenants.id`      | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `tenant_feature_flags.feature_flag_id -> feature_flags.id` | `NO ACTION` | `NO ACTION`         | Ídem.                                                                         |
| `api_keys.tenant_id -> tenants.id`                  | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |
| `outbox_events.tenant_id -> tenants.id`             | `NO ACTION`        | `NO ACTION`         | Ídem.                                                                         |

> **Nota:** En el script no se definen explícitamente políticas `ON DELETE`/`ON UPDATE`. Por defecto PostgreSQL usa `NO ACTION` (equivalente a `RESTRICT` en el momento de la verificación). Se recomienda, para las relaciones de detalle (como `testimonial_tags`), agregar `ON DELETE CASCADE` para mantener la integridad al eliminar testimonios o etiquetas.

### ⚡ Estrategia de Indexación

| Tabla               | Nombre del Índice                 | Columnas                | Tipo    | Justificación                                               |
|---------------------|-----------------------------------|-------------------------|---------|-------------------------------------------------------------|
| `users`             | `idx_users_tenant`                | `tenant_id`             | B‑Tree  | Acelera búsquedas de usuarios por inquilino.                |
| `testimonials`      | `idx_testimonials_tenant_status`  | `tenant_id, status_id`  | B‑Tree  | Optimiza consultas de testimonios por inquilino y estado.   |
| `testimonials`      | `idx_testimonials_score`          | `score DESC`            | B‑Tree  | Ordenamiento rápido por ranking (scoring).                  |
| `analytics_events`  | `idx_analytics_testimonial`       | `testimonial_id`        | B‑Tree  | Filtrado de eventos por testimonio.                         |
| `analytics_events`  | `idx_analytics_tenant_time`       | `tenant_id, created_at` | B‑Tree  | Consultas de analítica por inquilino y período.             |
| `outbox_events`     | `idx_outbox_status`               | `status`                | B‑Tree  | Búsqueda rápida de eventos pendientes para el worker.       |

---

## 3. Objetos de Lógica Programable

### 🛡️ Triggers (Disparadores)

Actualmente no se han definido triggers en el esquema. Se podrían implementar en el futuro para:

- Auditoría automática de cambios.
- Actualización del campo `score` en `testimonials` al recibir nuevos eventos de analítica.
- Invalidación de caché vía outbox.

### ⚙️ Funciones y Procedimientos Almacenados

Tampoco se han definido funciones almacenadas en esta versión. No obstante, se podrían crear procedimientos para:

- Recalcular el `score` de todos los testimonios (vía cron).
- Limpiar eventos viejos de `analytics_events`.
- Procesar el outbox (worker).

---

## 4. Modelo de Seguridad (RBAC)

Aplicando el **Principio de Menor Privilegio (PoLP)**.

| Rol Sugerido | Perímetro de Acción              | Permisos (Grants)                                        | Justificación                                               |
|--------------|----------------------------------|----------------------------------------------------------|-------------------------------------------------------------|
| `admin`      | Administración completa          | Todos los permisos sobre todas las tablas del inquilino. | Gestión de usuarios, configuración de webhooks, feature flags. |
| `editor`     | Gestión de testimonios           | CRUD sobre testimonios, tags, categorías; no puede configurar webhooks ni feature flags. | Encargado de crear y moderar testimonios.                   |
| `api_client` | Acceso solo vía API pública      | Lectura de testimonios publicados (SELECT sobre vistas o tablas específicas). | Clientes externos que consumen la API con API keys.         |
| `reporting`  | Solo consultas de analítica      | SELECT sobre `analytics_events` y vistas de métricas.   | Usuarios de BI/reportes.                                    |

Los permisos específicos se asignan a través de la tabla `permissions` y se asocian a roles mediante `role_permissions`. Los usuarios heredan permisos vía `user_roles`.

---

## 5. Ejemplos de Implementación (DDL Snippet)

```sql
-- Ejemplo de creación de tabla compleja: testimonials
CREATE TABLE testimonials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    content TEXT NOT NULL,
    author_name TEXT NOT NULL,
    rating INT NOT NULL,
    status_id SMALLINT NOT NULL,
    score NUMERIC(10,4) DEFAULT 0,
    created_at TIMESTAMP DEFAULT now(),
    published_at TIMESTAMP,
    CONSTRAINT fk_testimonial_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
    CONSTRAINT fk_testimonial_status FOREIGN KEY (status_id) REFERENCES testimonial_status(id),
    CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
);

-- Ejemplo de índice compuesto
CREATE INDEX idx_testimonials_tenant_status
ON testimonials(tenant_id, status_id);
```

---

### 💡 Tips para el llenado:

1. **Consistencia**: Se ha mantenido `snake_case` para todos los nombres de campos y tablas.

2. **Precisión**: Los tipos de datos reflejan exactamente lo definido en el script SQL (UUID, SMALLSERIAL, TEXT, etc.).

3. **Diagramas**: Se recomienda adjuntar un diagrama Entidad‑Relación (ER) que muestre las relaciones entre tablas, especialmente las de muchos a muchos y las dependencias con `tenant_id`.