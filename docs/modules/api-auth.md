# Módulo: Auth (`apps/api/src/modules/auth/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-10-01

---

## 1. Responsabilidad

Gestiona la **autenticación y sesiones** de usuarios dentro de un tenant. Emite y valida JWT, rota refresh tokens y protege rutas mediante guards.

**Scope**: Solo autenticación. La gestión de usuarios (CRUD, roles) está en `users/`.

---

## 2. Endpoints

| Método | Ruta | Descripción | Rate Limit | Guard |
|--------|------|-------------|------------|-------|
| `POST` | `/api/v1/auth/register-admin` | Registra nuevo admin + crea tenant | 10/min por IP | `RateLimitGuard`; sin garantía `Idempotency-Key` |
| `POST` | `/api/v1/auth/login` | Login con email + contraseña | 5/min por IP | `RateLimitGuard` |
| `POST` | `/api/v1/auth/refresh` | Rota refresh token | 20/min por IP | `RateLimitGuard` |
| `GET` | `/api/v1/auth/csrf` | Entrega HMAC vinculado al refresh cookie activo | 60/min por IP | `RateLimitGuard` |
| `POST` | `/api/v1/auth/upgrade-session` | Consume una vez un refresh legado y establece cookies | 20/min por IP | `RateLimitGuard`, Origin |
| `POST` | `/api/v1/auth/logout` | Invalida refresh token y limpia cookies | — | — |
| `GET`  | `/api/v1/auth/me` | Retorna usuario autenticado actual | — | `JwtAuthGuard` |

---

## 3. DTOs (nestjs-zod)

| DTO | Campos | Validación |
|-----|--------|------------|
| `LoginDto` | `email`, `password` | email format, string |
| `RegisterAdminDto` | `tenantName`, `email`, `password` | min lengths, email format |
| `RefreshTokenDto` | `refreshToken` opcional | string de al menos 20 caracteres para Bearer y migración |

---

## 4. Servicios y Dependencias

```
AuthController
  └── AuthService
        ├── PrismaService (via DatabaseModule)
        └── [JWT config via ConfigModule]
```

**Guards reutilizables** (en `common/guards/`):
- `JwtAuthGuard` — valida Access Token JWT de cookie `accessToken` o Bearer explícito; las sesiones nuevas verifican que la familia no esté revocada
- `CsrfGuard` — exige HMAC de sesión en `x-csrf-token` para mutaciones con cookies y valida Origin
- `RateLimitGuard` — limita peticiones por IP (configurable por decorator)

**Decorators** (en `common/decorators/`):
- `@CurrentUser()` — inyecta `AuthenticatedUser` desde el request
- `@RateLimit({ limit, windowSeconds, scope })` — configura cuotas atómicas con TTL en Redis por IP confiable y, cuando corresponda, tenant y clave API. Los intentos fallidos de login también comparten Redis; una mutación con cuota responde 503 si no puede verificarse. Ver [operación de Redis](../operations/10_redis_quotas_cache.md).
- `register-admin` no usa `@Idempotent()` ni ofrece deduplicación por `Idempotency-Key`. La [remediación](../technical/08_http_idempotency_contract.md) reservó esa garantía para rutas con tenant y actor verificables; la unicidad del email se verifica por separado.

---

## 5. Estrategia de Sesión

```
POST /login o /register-admin con X-Auth-Mode: cookie
  → Devuelve { user }, sin tokens en el cuerpo
  → Crea familia de sesión y refresh token hasheado
  → Establece accessToken y refreshToken HttpOnly, SameSite=Strict, Path=/
  → Secure en producción; 15 minutos y 7 días, respectivamente

GET /csrf con refresh cookie activo
  → Devuelve HMAC-SHA-256 versionado sobre el refresh token y un secreto del servidor
  → La web lo guarda solo en memoria y lo envía en x-csrf-token

POST /refresh con X-Auth-Mode: cookie y CSRF válido
  → Reclama atómicamente el token anterior y crea uno nuevo en la misma familia
  → La reutilización revoca la familia y crea un AuditLog
  → Devuelve solo { user } y rota ambas cookies

POST /logout con X-Auth-Mode: cookie y CSRF válido
  → Revoca la familia y borra cookies usando los atributos de creación

X-Auth-Mode: bearer conserva { user, tokens } sin establecer cookies.
Durante 30 días desde AUTH_LEGACY_STARTED_AT se acepta además el modo
implícito previo; en producción sin esa fecha se exige modo explícito.
POST /upgrade-session consume una vez el refresh token de localStorage, lo
elimina antes de llamar a la API y establece cookies nuevas.

Las contraseñas nuevas se almacenan con Argon2id asincrónico de Node 24.
Un hash scrypt verificado se reemplaza por Argon2id al iniciar sesión.
```

---

## 6. Interfaz `AuthenticatedUser`

```typescript
// common/interfaces/auth-context.interface.ts
interface AuthenticatedUser {
  userId: string;      // UUID
  tenantId: string;    // UUID — SIEMPRE presente, usar para filtrar queries
  email: string;
  roles: string[];     // ['admin'] | ['editor']
}
```

> ⚠️ **Invariante crítica**: `tenantId` SIEMPRE debe propagarse a cualquier query downstream.

---

## 7. Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| `BR-SEC-001` | Contraseñas hasheadas con Argon2id; nunca en texto plano |
| `BR-SEC-002` | Refresh tokens almacenados hasheados en DB; rotación en cada uso |
| `BR-SEC-003` | Tokens en cookies HttpOnly únicamente; nunca en `localStorage` |

---

## 8. Tests Existentes

| Archivo | Tipo | Cobertura |
|---------|------|-----------|
| `auth-cookie-http.integration.spec.ts` | HTTP con PostgreSQL y Redis | registro, CSRF, refresh, logout, login |
| `auth-session-postgres.integration.spec.ts` | PostgreSQL | carrera de refresh, reutilización, auditoría y revocación |
| `password.service.spec.ts` | Unidad | Argon2id y verificación scrypt heredado |

---

## 9. Módulos que importan Auth

- `app.module.ts` → registra `AuthModule` globalmente
- Todos los módulos que usan `JwtAuthGuard` o `@CurrentUser`

---

## 10. Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
