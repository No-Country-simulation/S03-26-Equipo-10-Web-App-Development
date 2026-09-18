# Módulo: Auth (`apps/api/src/modules/auth/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-09-18

---

## 1. Responsabilidad

Gestiona la **autenticación y sesiones** de usuarios dentro de un tenant. Emite y valida JWT, rota refresh tokens y protege rutas mediante guards.

**Scope**: Solo autenticación. La gestión de usuarios (CRUD, roles) está en `users/`.

---

## 2. Endpoints

| Método | Ruta | Descripción | Rate Limit | Guard |
|--------|------|-------------|------------|-------|
| `POST` | `/api/v1/auth/register-admin` | Registra nuevo admin + crea tenant | 10/min por IP | `RateLimitGuard`, `@Idempotent` |
| `POST` | `/api/v1/auth/login` | Login con email + contraseña | 5/min por IP | `RateLimitGuard` |
| `POST` | `/api/v1/auth/refresh` | Rota refresh token | 20/min por IP | `RateLimitGuard` |
| `POST` | `/api/v1/auth/logout` | Invalida refresh token y limpia cookies | — | — |
| `GET`  | `/api/v1/auth/me` | Retorna usuario autenticado actual | — | `JwtAuthGuard` |

---

## 3. DTOs (nestjs-zod)

| DTO | Campos | Validación |
|-----|--------|------------|
| `LoginDto` | `email`, `password` | email format, string |
| `RegisterAdminDto` | `tenantName`, `email`, `password` | min lengths, email format |
| `RefreshTokenDto` | `refreshToken` | string |

---

## 4. Servicios y Dependencias

```
AuthController
  └── AuthService
        ├── PrismaService (via DatabaseModule)
        └── [JWT config via ConfigModule]
```

**Guards reutilizables** (en `common/guards/`):
- `JwtAuthGuard` — valida Access Token JWT de cookie `accessToken`
- `RateLimitGuard` — limita peticiones por IP (configurable por decorator)

**Decorators** (en `common/decorators/`):
- `@CurrentUser()` — inyecta `AuthenticatedUser` desde el request
- `@RateLimit({ limit, windowSeconds, scope })` — configura rate limit por endpoint
- `@Idempotent()` — previene registro duplicado por mismo request

---

## 5. Estrategia de Sesión

```
POST /login
  → AuthService.login()
  → Valida credenciales (Argon2id hash)
  → Genera accessToken (JWT, 15 min)
  → Genera refreshToken (opaque, 7 días, almacenado hasheado en DB)
  → Establece cookies HttpOnly:
      - accessToken: SameSite=Strict, maxAge=15min
      - refreshToken: SameSite=Strict, path=/api/v1/auth/refresh, maxAge=7d

POST /refresh
  → Verifica refreshToken en DB (Refresh Token Rotation)
  → Invalida token anterior
  → Emite nuevo par de tokens
  → Actualiza cookies

POST /logout
  → Invalida refreshToken en DB
  → clearCookie('accessToken')
  → clearCookie('refreshToken')
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
| *(pendiente crear)* | Unit — AuthService | login happy path, login credenciales inválidas, refresh rotación |
| *(pendiente crear)* | Unit — JwtAuthGuard | token válido, token expirado, token ausente |

---

## 9. Módulos que importan Auth

- `app.module.ts` → registra `AuthModule` globalmente
- Todos los módulos que usan `JwtAuthGuard` o `@CurrentUser`

---

## 10. Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
