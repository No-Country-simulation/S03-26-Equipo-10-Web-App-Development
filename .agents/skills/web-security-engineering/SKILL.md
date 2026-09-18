---
name: web-security-engineering
description: >-
  Diseño, implementación, auditoría y endurecimiento de sistemas de autenticación, autorización y seguridad web adaptado a NestJS 11, Next.js 15 y PostgreSQL (código SKL-WEB-SEC-001). Usar cuando se requiera implementar sesiones híbridas seguras (cookies HttpOnly __Host-, Bearer fallback, Refresh Token Rotation con hash), mitigación estricta de BOLA/IDOR en arquitecturas multi-tenant, RBAC con roles y permisos atómicos, hashing de contraseñas con Argon2id, guardias perimetrales (CSRF Double-Submit, Rate Limiting, API Keys con timingSafeEqual), sanitización contra XSS/SSRF/SQLi, y cumplimiento de OWASP Top 10:2025 y ASVS 5.0.
---

# Especificación Técnica de Habilidad: Web Security, Authentication & Authorization Engineering

```text
Código de Skill:    SKL-WEB-SEC-001
Nombre:             Web Security, Authentication & Authorization Engineering
Versión:            1.1.0
Nivel:              Intermedio-Avanzado / Senior / Production Engineering
Estándar:           OWASP Top 10:2025 / OWASP ASVS 5.0.0 / OWASP API Security / OAuth Security BCP / Agile DoD
Dominio:            Seguridad Web / AppSec / Backend / Next.js / NestJS / Identity & Access Management
Contexto Proyecto:  @testimonial-cms (NestJS 11 API + Next.js 15 Web + Prisma ORM + PostgreSQL Multi-Tenant)
```

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, revisión y endurecimiento de sistemas de autenticación, autorización y seguridad web. |
| **Objetivo de Dominio** | Capacitar para construir y auditar aplicaciones web resistentes a fallas de autenticación, control de acceso (BOLA/IDOR), gestión de sesiones, inyección, XSS, CSRF, exposición de secretos y configuraciones inseguras. |
| **Arquitectura de Referencia** | Monorepo con **Backend NestJS 11** (`apps/api`) y **Frontend Next.js 15 App Router** (`apps/web`). |
| **Modelos de Identidad** | Autenticación híbrida: Cookies HttpOnly (`accessToken`, `refreshToken` rotativo) + Bearer Token para APIs/móviles + Developer API Keys. |
| **Modelos de Autorización** | Aislamiento Multi-Tenant por `tenantId` + RBAC granular (`Role`, `Permission`, `RolePermission`, `UserRole`). |
| **Criptografía y Secretos**| Hashing de contraseñas con **Argon2id**, hashes de Refresh Tokens con SHA-256, API Keys con verificación *constant-time* (`timingSafeEqual`). |
| **Referencia Principal** | OWASP Top 10:2025 + OWASP API Security Top 10:2023 + OWASP ASVS 5.0. |
| **Prioridad Técnica** | Seguridad ➔ Integridad de Tenant ➔ Menor Privilegio ➔ Auditabilidad ➔ Mantenibilidad ➔ Rendimiento. |
| **Complejidad** | Alta. |

---

## 2. Descripción y Filosofía de Diseño

La Skill establece criterios técnicos para construir aplicaciones bajo los paradigmas de **Secure by Design**, **Secure by Default** y **Defense in Depth**. La seguridad no es un middleware cosmético ni una capa agregada al final; debe integrarse estructuralmente en:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Defense in Depth en @testimonial-cms                 │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
      1. Network & Reverse Proxy   │ TLS 1.3, HSTS, WAF, Cloudflare/Nginx
                                   ▼
      2. HTTP Transport Boundary   │ Helmet (CSP, X-Content-Type-Options), CORS
                                   ▼
      3. Edge & Next.js Middleware │ Auth verification, route guards, anti-clickjacking
                                   ▼
      4. Perimeter API Guards      │ CsrfGuard, RateLimitGuard, ApiKeyGuard
                                   ▼
      5. Authentication Layer      │ JwtAuthGuard (Cookies HttpOnly / Bearer, User/Tenant active)
                                   ▼
      6. Authorization Layer       │ RolesGuard, AdminGuard, RequirePermissions
                                   ▼
      7. Validation & Sanitization │ ZodValidationPipe (Zod Schemas, Mass Assignment prevention)
                                   ▼
      8. Business Logic & Domain   │ Invariant checks, tenant-specific workflows
                                   ▼
      9. Persistence & Data Access │ Prisma Client (Mandatory tenantId filter, parameterized SQL)
                                   ▼
     10. Security Observability    │ Structured Pino Audit Logs, security alerts, metrics
```

> [!IMPORTANT]
> **OWASP Top 10:2025** sitúa a **Broken Access Control (A01)** como el riesgo más crítico de la industria. En arquitecturas SaaS multi-tenant como `@testimonial-cms`, la autorización y el aislamiento de datos por `tenantId` son controles de diseño estructural innegociables.

### 2.1. Principios Fundamentales

#### Zero Trust dentro de la aplicación
Nunca asumir que un dato o petición es confiable porque atravesó una frontera perimetral:
- ❌ *"Está autenticado → puede acceder a cualquier testimonio o clave"*
- ❌ *"Viene de nuestro frontend en Next.js → el formulario ya fue validado"*
- ❌ *"Tiene el UUID del objeto → es el legítimo propietario de los datos"*
- ❌ *"El JWT es válido → el usuario pertenece al tenant solicitado"*
- ✅ **Comprobar siempre:** Identidad válida + Tenant activo + Pertenencia del recurso + Rol/Permiso específico.

#### Least Privilege (Mínimo Privilegio)
Cada componente, token, usuario y proceso debe poseer estrictamente los permisos mínimos para operar:
- El `accessToken` tiene vida corta (15 minutos).
- Los tokens nunca contienen información administrativa sensible.
- Las API Keys se asocian a un tenant específico y se validan contra scopes concretos.
- Las consultas a base de datos solo acceden a las columnas requeridas (`select`).

---

## 3. Arquitectura de Autenticación & Gestión de Sesiones en `@testimonial-cms`

El sistema implementa un modelo de **autenticación híbrida**:
1. **Clientes Browser (Next.js 15 Web App):** Uso de **Cookies HttpOnly seguras** (`SameSite=Lax`, `Secure`, `Path=/`, prefijo `__Host-` en producción) para mitigar el robo de tokens por XSS.
2. **Clientes Externos / Machine-to-Machine / Mobile:** Soporte de cabecera `Authorization: Bearer <token>` o Developer API Keys.

```text
┌────────────────────────────────────────────────────────────────────────┐
│               Flujo de Autenticación y Rotación de Sesiones            │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │
      POST /api/v1/auth/login      │ (email, password)
                                   ▼
       1. Validación de Entrada    │ Zod schema (ZodValidationPipe)
                                   ▼
       2. Búsqueda de Usuario      │ Prisma: findUnique({ where: { email } })
                                   ▼
       3. Verificación Password    │ Argon2id verify(passwordHash, password)
                                   ▼
       4. Validación de Estado     │ user.isActive === true && tenant.isActive === true
                                   ▼
       5. Generación de Tokens     │ accessToken (15m JWT) + refreshToken (7d opaco criptográfico)
                                   ▼
       6. Persistencia de Sesión   │ Prisma: RefreshToken.create({ tokenHash, userId, expiresAt })
                                   ▼
       7. Emisión de Cookies       │ Set-Cookie: accessToken (HttpOnly, Secure, SameSite=Lax)
                                   │ Set-Cookie: refreshToken (HttpOnly, Secure, SameSite=Lax)
                                   │ Set-Cookie: csrfToken (Readable by client JS for CSRF header)
```

### 3.1. Hashing Criptográfico de Contraseñas con Argon2id

Se prohíbe el uso de MD5, SHA-1, SHA-256 plano o bcrypt de bajo costo. Se utiliza **Argon2id** (ganador de la Password Hashing Competition) para proteger los hashes contra ataques con hardware especializado (GPUs / ASICs):

```typescript
// src/modules/auth/services/password-hasher.service.ts
import * as argon2 from 'argon2';

export class PasswordHasherService {
  private readonly options: argon2.Options = {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB
    timeCost: 3,       // 3 iteraciones
    parallelism: 4,    // 4 hilos concurrentes
  };

  async hash(password: string): Promise<string> {
    return argon2.hash(password, this.options);
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      return false; // Evita fugas de timing o excepciones no controladas
    }
  }
}
```

### 3.2. Rotación de Refresh Tokens (Refresh Token Rotation)
Para prevenir el secuestro permanente de sesiones si un token es filtrado:
1. Cada vez que se solicita un nuevo `accessToken` mediante `/auth/refresh`, el `refreshToken` presentado es **revocado inmediatamente**.
2. Se emite un nuevo par (`accessToken` + `refreshToken`).
3. **Detección de Reutilización Maliciosa:** Si un `refreshToken` que ya fue revocado se presenta nuevamente, se asume un compromiso de sesión y se revocan **todas las sesiones activas del usuario**:

```typescript
// Modelo Prisma de Sesión (apps/api/prisma/schema.prisma)
model RefreshToken {
  id        String   @id @default(uuid()) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  tokenHash String   @map("token_hash") // Hash SHA-256 del token, nunca texto plano
  expiresAt DateTime @map("expires_at")
  revoked   Boolean  @default(false)
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId], map: "idx_refresh_tokens_user")
  @@map("refresh_tokens")
}
```

---

## 4. Control de Acceso y Aislamiento Multi-Tenant (Mitigación BOLA / IDOR)

### 4.1. La Regla de Oro del Multi-Tenant
> **Ninguna consulta de lectura, actualización o eliminación en la base de datos puede ejecutarse utilizando únicamente el identificador del objeto (`id`). Siempre debe requerirse la clave compuesta o condición que involucre al `tenantId` del usuario autenticado.**

```typescript
// ❌ VULNERABILIDAD CRÍTICA BOLA (OWASP API1:2023):
@Delete(':id')
async deleteTestimonial(@Param('id') id: string) {
  return this.prisma.testimonial.delete({
    where: { id }, // Un atacante del Tenant B puede borrar testimonios del Tenant A
  });
}

// ✅ CONTROL DE ACCESO HERMÉTICO POR TENANT:
@Delete(':id')
async deleteTestimonial(
  @Param('id') id: string,
  @CurrentUser() user: AuthUser,
) {
  const result = await this.prisma.testimonial.deleteMany({
    where: {
      id,
      tenantId: user.tenantId, // Restricción estricta al tenant activo
    },
  });

  if (result.count === 0) {
    throw new NotFoundException('Testimonial not found in current tenant');
  }
}
```

### 4.2. Sistema de Roles y Permisos (RBAC)
El esquema relacional de `@testimonial-cms` estructura la autorización en dos capas:
1. **Roles:** Agrupaciones de alto nivel (`ADMIN`, `EDITOR`, `VIEWER`).
2. **Permisos Atómicos:** Capacidades concretas (`testimonials:approve`, `api_keys:create`, `webhooks:manage`).

```typescript
// Decorador de Permisos Requeridos
import { SetMetadata } from '@nestjs/common';
export const REQUIRE_PERMISSIONS_KEY = 'require_permissions';
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata(REQUIRE_PERMISSIONS_KEY, permissions);
```

```typescript
// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiRequest } from '../interfaces/auth-context.interface';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest<ApiRequest>();
    if (!user || !user.roles) {
      throw new ForbiddenException('User context missing or unauthenticated');
    }

    const hasRole = user.roles.some((role) => requiredRoles.includes(role));
    if (!hasRole) {
      throw new ForbiddenException(`Requires one of roles: [${requiredRoles.join(', ')}]`);
    }

    return true;
  }
}
```

---

## 5. Defensas Perimetrales y Guardias en NestJS 11

### 5.1. Protección CSRF: Double-Submit Cookie (`CsrfGuard`)
Para proteger las mutaciones originadas en navegadores web que utilizan cookies de sesión:
1. El backend emite una cookie `csrfToken` accesible por JavaScript con `SameSite=Lax`.
2. El cliente frontend en Next.js lee esa cookie e inyecta su valor en el header `x-csrf-token` en cada petición mutable (`POST`, `PUT`, `PATCH`, `DELETE`).
3. El `CsrfGuard` verifica que ambos valores coincidan exactamente:

```typescript
// src/common/guards/csrf.guard.ts
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    
    // Métodos seguros e idempotentes no requieren CSRF
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return true;
    }

    const csrfCookie = request.cookies?.['csrfToken'];
    const csrfHeader = request.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader) {
      throw new ForbiddenException('Missing CSRF protection token');
    }

    if (csrfCookie !== csrfHeader) {
      throw new ForbiddenException('Invalid CSRF token mismatch');
    }

    return true;
  }
}
```

### 5.2. Rate Limiting Defensivo (`RateLimitGuard`)
Mitigación de ataques de fuerza bruta, credential stuffing y DoS en endpoints sensibles:
- `/api/v1/auth/login`: Máximo 5 intentos por minuto por IP.
- `/api/v1/auth/refresh`: Máximo 20 solicitudes por minuto por IP.
- `/api/v1/testimonials/public/:slug`: Máximo 10 envíos por hora por IP para prevenir spam.

### 5.3. Cabeceras HTTP de Endurecimiento (`Helmet`)
Configuración en `apps/api/src/main.ts`:
- **Content-Security-Policy (CSP):** Restringe scripts, estilos y orígenes no autorizados.
- **X-Content-Type-Options:** `nosniff` (previene MIME sniffing).
- **X-Frame-Options:** `DENY` (previene ataques de Clickjacking).
- **Strict-Transport-Security (HSTS):** Fuerza conexiones TLS durante al menos 1 año.
- **Referrer-Policy:** `strict-origin-when-cross-origin`.

---

## 6. Validación de Entradas & Prevención de Mass Assignment

### 6.1. Validación Estricta con Zod en Fronteras
Se prohíbe pasar `req.body` directamente al ORM de persistencia (`prisma.user.create({ data: req.body })`). Todo payload debe ser validado por esquemas Zod fuertemente tipados:

```typescript
// apps/api/src/modules/testimonials/dto/create-testimonial.dto.ts
import { z } from 'zod';
import { createZodDto } from 'nestjs-zod';

export const CreateTestimonialSchema = z.object({
  authorName: z.string().trim().min(2).max(100),
  authorEmail: z.string().trim().email().max(255),
  content: z.string().trim().min(10).max(5000),
  rating: z.number().int().min(1).max(5),
  metadata: z.record(z.unknown()).optional(),
}).strict(); // .strict() rechaza campos no autorizados (Mass Assignment defense)

export class CreateTestimonialDto extends createZodDto(CreateTestimonialSchema) {}
```

---

## 7. Seguridad en Next.js 15 Frontend (`apps/web`)

### 7.1. Prohibición de Tokens en LocalStorage
- ❌ **Inseguro:** Almacenar el JWT en `window.localStorage` o `window.sessionStorage`. Cualquier script malicioso inyectado por XSS puede leer y exfiltrar la sesión completa del usuario.
- ✅ **Seguro:** Las cookies de sesión son `HttpOnly`. El código JavaScript en el navegador **no puede leerlas**, bloqueando la exfiltración directa de tokens.

### 7.2. Prevención de Cross-Site Scripting (XSS) en Testimonios
Los testimonios provienen de usuarios finales no confiables. Para evitar Stored XSS:
1. En React/Next.js, confiar en el escape automático por defecto de JSX.
2. **Prohibido** utilizar `dangerouslySetInnerHTML` salvo que el contenido sea sanitizado previamente con una librería homologada como `DOMPurify`.
3. Para embeds o widgets de testimonios en sitios de terceros: utilizar `<iframe>` con atributos de sandbox restrictivos (`sandbox="allow-scripts"`).

```tsx
// Renderizado seguro en Next.js
export function TestimonialCard({ content, authorName }: TestimonialProps) {
  return (
    <div className="rounded-lg border p-4 shadow-sm">
      <p className="text-gray-800">{content}</p> {/* Escapado automáticamente por React */}
      <span className="font-medium text-gray-900">{authorName}</span>
    </div>
  );
}
```

---

## 8. Observabilidad de Seguridad & Auditoría (`AuditLog`)

### 8.1. Registro Estructurado de Eventos de Seguridad
Los incidentes y anomalías de seguridad deben emitirse a través de `nestjs-pino` con contexto estructurado sin exponer contraseñas:

```json
{
  "timestamp": "2026-09-18T04:30:15.012Z",
  "severity": "WARN",
  "event": "security.auth_login_failed",
  "reason": "INVALID_CREDENTIALS",
  "email_hash": "a591a6d40bf420404a011733cfb7b190d62c65bf0bcda32b57b277d9ad9f146e",
  "ip": "190.210.45.12",
  "user_agent": "Mozilla/5.0 ...",
  "trace_id": "4bf92f3577b34da6a3ce929d0e0e4736"
}
```

### 8.2. Entidad `AuditLog` en Base de Datos
Las acciones de alto impacto administrativo (eliminación de testimonios, rotación de API Keys, cambios de roles) se persisten en PostgreSQL:

```prisma
model AuditLog {
  id         String   @id @default(uuid()) @db.Uuid
  tenantId   String   @map("tenant_id") @db.Uuid
  userId     String?  @map("user_id") @db.Uuid
  action     String   // e.g. "API_KEY_REVOKED", "TESTIMONIAL_DELETED"
  entityType String   @map("entity_type")
  entityId   String   @map("entity_id")
  metadata   Json?
  ipAddress  String?  @map("ip_address")
  createdAt  DateTime @default(now()) @map("created_at")

  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  user       User?    @relation(fields: [userId], references: [id], onDelete: SetNull)

  @@index([tenantId, createdAt], map: "idx_audit_logs_tenant_created")
  @@map("audit_logs")
}
```

---

## 9. Catálogo de Antipatrones Específicos del Proyecto

| # | Antipatrón | Causa Común | Consecuencia Técnica | Solución Profesional en @testimonial-cms |
| :- | :--- | :--- | :--- | :--- |
| **01** | **BOLA en Endpoints** | `where: { id }` en Prisma sin `tenantId` | Un usuario de un Tenant puede leer/borrar datos de otro Tenant. | Exigir siempre `where: { id, tenantId: user.tenantId }`. |
| **02** | **Tokens en LocalStorage** | Facilitar el acceso desde el frontend | Exfiltración total de la sesión del usuario si ocurre XSS. | Usar cookies `HttpOnly`, `Secure` y `SameSite=Lax`. |
| **03** | **`data: req.body` directo** | Rapidez al programar CRUDs | Mass Assignment: atacantes inyectan `isAdmin` o cambian `tenantId`. | Validar con esquemas Zod estrictos (`.strict()`) y mapear explícitamente. |
| **04** | **Falta de Double-Submit CSRF** | Confiar en que `SameSite=Lax` cubre todo | Peticiones fraudulentas mutables desde sitios web de terceros. | Aplicar `CsrfGuard` validando cookie `csrfToken` contra header `x-csrf-token`. |
| **05** | **Hashes con SHA-256 plano** | Pereza de configurar librerías nativas | Vulnerable a ataques de fuerza bruta masiva por GPU. | Usar exclusivamente **Argon2id** para contraseñas. |
| **06** | **Refresh Tokens sin Hash** | Guardar el token en texto plano en DB | Si la base de datos se filtra, todas las sesiones son comprometidas. | Almacenar solo el hash SHA-256 del token en la tabla `refresh_tokens`. |
| **07** | **Exponer Stack Traces** | No atrapar excepciones en `main.ts` | Fuga de rutas internas, queries SQL y versiones de librerías. | `ApiExceptionFilter` centralizado que retorna RFC 9457 sin stacks. |
| **08** | **CORS con `origin: *` y credenciales** | Configuración perezosa en desarrollo | Navegadores rechazan la petición o se exponen cookies a cualquier web. | Vincular CORS estrictamente a `appConfig.corsOrigin`. |
| **09** | **Login sin Rate Limiting** | Olvidar ataques automatizados | Vulnerable a Credential Stuffing y ataques de diccionario. | `RateLimitGuard` limitando a 5 intentos/minuto por IP. |
| **10** | **Comparación de API Keys con `===`** | Uso de operadores comunes | Ataque de temporización (*Timing Attack*) para deducir la clave byte a byte. | Utilizar siempre `crypto.timingSafeEqual()`. |

---

## 10. Definition of Done (DoD) de Seguridad

Un endpoint, servicio o módulo se considera seguro y apto para producción cuando:

- [ ] **Autenticación:** Protegido por `JwtAuthGuard` o `ApiKeyGuard` salvo que sea explícitamente público (`@Public()`).
- [ ] **Aislamiento Multi-Tenant:** Toda consulta de lectura y escritura valida que el registro pertenece a `user.tenantId`.
- [ ] **Autorización:** Roles y permisos verificados con `@Roles()` o `@RequirePermissions()`.
- [ ] **Validación Zod:** Todos los payloads entrantes poseen un DTO respaldado por un esquema Zod estricto.
- [ ] **Prevención CSRF:** Los métodos mutables (`POST`, `PUT`, `PATCH`, `DELETE`) pasan por `CsrfGuard`.
- [ ] **Protección contra Fuerza Bruta:** Endpoints de autenticación y formularios públicos tienen rate limiting activo.
- [ ] **Contraseñas Seguras:** Hasheadas exclusivamente con Argon2id.
- [ ] **Cookies Seguras:** Emitidas con flags `HttpOnly`, `Secure`, `SameSite=Lax`.
- [ ] **Cero Fuga de Stacks:** Las respuestas de error no contienen stack traces ni queries internas.
- [ ] **Auditoría:** Los cambios de estado críticos generan un registro en `AuditLog`.
- [ ] **Pruebas Automatizadas:** Existen tests de integración que intentan acceder con tokens inválidos o de otro tenant y comprueban el rechazo con HTTP 401/403/404.

---

## 11. Cheat Sheet — 20 Reglas de Oro de Seguridad en `@testimonial-cms`

1. Nunca confíes en un `id` sin verificar su `tenantId` correspondiente.
2. Almacená contraseñas únicamente con **Argon2id**.
3. Almacená tokens de sesión en cookies **HttpOnly**, nunca en `localStorage`.
4. Rotá los Refresh Tokens en cada uso y revocá todo si detectás reutilización.
5. Persistí solo el hash SHA-256 de los tokens de sesión y API Keys en PostgreSQL.
6. Protegé todos los endpoints mutables basados en cookies con `CsrfGuard`.
7. Rechazá campos no declarados en el payload mediante Zod `.strict()`.
8. Nunca pases `req.body` directo a Prisma; mapeá siempre las propiedades validadas.
9. Compará tokens y secretos con `crypto.timingSafeEqual`.
10. Limitá la tasa de peticiones en endpoints de login y registro para evitar fuerza bruta.
11. Mantené `accessToken` con vida corta (15 minutos) y `refreshToken` con vida finita (7 días).
12. Exigí que tanto el `User` como el `Tenant` estén activos en cada validación de JWT.
13. Sanitizá y escapá todo testimonio de usuario antes de renderizarlo en el frontend.
14. Prohibido usar `dangerouslySetInnerHTML` sin sanitización estricta con DOMPurify.
15. Restringí los orígenes de CORS al dominio del frontend (`appConfig.corsOrigin`).
16. Mantené cabeceras de seguridad activas en la API mediante `helmet()`.
17. Ocultá los stack traces y detalles internos en respuestas HTTP de producción.
18. Registrá eventos de seguridad estructurados con `nestjs-pino` sin volcar contraseñas.
19. Auditá acciones administrativas en la tabla `audit_logs`.
20. Asumí que la red interna no es confiable: aplicá Zero Trust en cada capa.

---

## 12. Árbol de Decisión de Acceso y Seguridad

```text
                             SOLICITUD HTTP
                                   │
                 ┌─────────────────▼─────────────────┐
                 │    ¿Es un endpoint público?       │
                 │   (Formulario público, health)    │
                 └─────────┬─────────────────┬───────┘
                           │                 │
                        Sí │                 │ No
                           │                 │
              ┌────────────▼──────┐   ┌──────▼────────────────────────┐
              │ - RateLimitGuard  │   │ ¿Tipo de Credencial Presentada?│
              │ - Zod Validation  │   └──────┬─────────────────┬──────┘
              │ - Validar slug    │          │                 │
              │   público activo  │   Cookie │                 │ Header Bearer /
              └───────────────────┘   HttpOnly                 │ API Key
                                             │                 │
                                  ┌──────────▼──────┐   ┌──────▼──────────────────┐
                                  │ - CsrfGuard     │   │ - ApiKeyGuard / JWT     │
                                  │   (Double-Cookie│   │ - Validar firma y scopes│
                                  │ - JwtAuthGuard  │   └──────┬──────────────────┘
                                  └──────────┬──────┘          │
                                             │                 │
                                             └────────┬────────┘
                                                      │
                                       ┌──────────────▼──────────────┐
                                       │ ¿User y Tenant están activos?│
                                       └───────┬──────────────┬──────┘
                                               │              │
                                            No │              │ Sí
                                               │              │
                                    ┌──────────▼──────┐ ┌─────▼──────────────────┐
                                    │ 401 Unauthorized│ │ ¿Posee el Rol/Permiso? │
                                    └─────────────────┘ └──────┬──────────┬──────┘
                                                               │          │
                                                            No │          │ Sí
                                                               │          │
                                                    ┌──────────▼─────┐ ┌──▼───────────────┐
                                                    │ 403 Forbidden  │ │ Ejecutar consulta│
                                                    └────────────────┘ │ con tenantId     │
                                                                       │ mandatorio       │
                                                                       └──────────────────┘
```
