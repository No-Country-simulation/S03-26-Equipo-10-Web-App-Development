---
name: api-key-security-engineering
description: >-
  Diseño, implementación, seguridad y operación profesional de sistemas de API Keys en Node.js y NestJS (código SKL-APIKEY-SEC-001). Usar cuando se requiera autenticar clientes Machine-to-Machine / Developer APIs mediante credenciales de alta entropía (Prefijo + Public ID + Secret), sin persistencia en texto plano (HMAC-SHA-256 con pepper versionado), one-time reveal, verificación constant-time (timingSafeEqual), arquitectura NestJS (Guards, Decorators, Interceptors, Modules), autorización granular por scopes/tenant, rotación segura, revocación inmediata y rate limiting defensivo.
---

# Especificación Técnica de Habilidad: Senior API Key Security & Access Engineering

---

**Código de Skill:** SKL-APIKEY-SEC-001  
**Nombre:** Senior API Key Security & Access Engineering for NestJS & Node.js  
**Versión:** 1.1.0  
**Nivel:** Senior / Production Engineering  
**Dominio:** Backend / API Security / Authentication / Authorization / Platform Engineering  
**Tipo de Credencial:** Machine-to-Machine / Developer API Credential  
**Frameworks & Runtimes:** Node.js LTS / NestJS 11+ (Fastify/Express) / Prisma / TypeORM  
**Estándares:** OWASP API Security / OWASP REST Security / Least Privilege / Secure by Design / Zero Trust / Agile Definition of Done  

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, seguridad y operación profesional de sistemas de API Keys. |
| **Objetivo de Dominio** | Autenticar clientes de API mediante credenciales revocables, restringibles, auditables y de alta entropía. |
| **Casos de Uso** | Machine-to-Machine, Developer APIs, SaaS Integrations, Service Credentials. |
| **No recomendado para** | Autenticación primaria de usuarios humanos interactivos. |
| **Modelo de Seguridad** | Bearer Credential + Least Privilege + Zero Trust. |
| **Persistencia** | Public Identifier indexado + Cryptographic Secret Digest (HMAC-SHA-256 con pepper). |
| **Componentes NestJS** | `ApiKeysModule`, `ApiKeyGuard`, `ApiKeyScopesGuard`, `@RequireApiKeyScopes()`, `@CurrentApiKey()`. |
| **Autorización** | Scopes / Permissions / Resource Restrictions / Tenant Isolation. |
| **Resiliencia** | Revocation + Rotation con solapamiento + Cache Invalidation. |
| **Abuso** | Rate Limiting por clave (`@nestjs/throttler`) + Usage Quotas + Anomaly Detection. |
| **Observabilidad** | Audit Trail + Last Used debounced + Pino Structured Logging. |
| **Complejidad** | Alta. |
| **Prioridad** | Seguridad → Revocabilidad → Integridad → Trazabilidad → Performance → Developer Experience. |

---

## 2. Descripción y Filosofía de Diseño

Una API Key debe entenderse como:
```text
long-lived bearer credential
```
y no simplemente como un `random string` suelto en una base de datos.  
Quien posee la credencial puede utilizar todos los permisos asociados a ella. Por lo tanto:

```text
API KEY LEAK = IDENTITY COMPROMISE
```
hasta que la clave expire o sea revocada de forma inmediata.

### 2.1. Principios Rectores
Todo sistema debe satisfacer:
- **High entropy:** Imposibilidad matemática de adivinación por fuerza bruta ($\ge 256$ bits).
- **Least privilege:** Permisos acotados estrictamente a la necesidad operativa mediante scopes.
- **One-time secret reveal:** El secreto solo se muestra al usuario una única vez al crearse.
- **No plaintext persistence:** Jamás persistir el secreto en texto plano en la base de datos ni en logs.
- **Explicit ownership:** Toda clave pertenece a un actor, organización o tenant conocido.
- **Explicit scopes:** Permisos declarativos claros por recurso y acción.
- **Fast revocation:** Revocación inmediata con invalidación de caché sincronizada.
- **Safe rotation:** Períodos de solapamiento (*grace period*) controlados para evitar caídas de servicio.
- **Deterministic lookup:** Búsqueda indexada en tiempo $O(1)$ por identificador público no secreto.
- **Auditability:** Registro inmutable de creación, rotación, uso y revocación.
- **Secret scanning compatibility:** Prefijos estándar detectables por herramientas de CI/CD (GitHub/Gitleaks).
- **Rate limiting & Fail closed:** Protección contra agotamiento de recursos.
- **Constant-time comparison:** Mitigación de ataques de temporización (*timing attacks*).
- **Secure transport:** Tránsito exclusivo por canales seguros HTTPS/TLS.

### 2.2. API Keys no son Autenticación de Usuario Humano
Las API keys deben autenticar: aplicaciones, servicios, scripts, integraciones y desarrolladores en entornos M2M.  
**No deben utilizarse para el inicio de sesión interactivo de usuarios humanos.**  
Para usuarios finales se deben priorizar: sesiones HttpOnly, OAuth 2.1, OpenID Connect (OIDC), Passkeys y MFA.

---

## 3. ¿Cuándo Usar API Keys?

Son apropiadas para:
- Integraciones servidor a servidor (*server-to-server*).
- Clientes CLI y scripts de automatización.
- APIs públicas de cara a desarrolladores externos.
- Credenciales de servicios de fondo y bots.
- Atribución de uso, facturación y medición (*metering*).

### 3.1. ¿Cuándo NO son Suficientes?
Para recursos de alto valor financiero, transferencias bancarias o funciones superadministrativas, complementar o sustituir con: OAuth con mTLS, credenciales de corta duración, identidades de carga de trabajo (*Workload Identity*) o firmas criptográficas por petición (Request Signing).

---

## 4. Modelo de Credencial Compuesto

La Skill utilizará un formato estructurado de tres partes:
```text
PREFIX + PUBLIC KEY ID + SECRET
```
Ejemplo ensamblado:
```text
ak_live_4Q7NZ2KM_yUiP8MEZJF8x7vK2mNq4L9pX1...
```

---

## 5. Anatomía de la Credencial

```text
ak_live_4Q7NZ2KM_yUiP8MEZJF...
│   │    │        │
│   │    │        └── Secret (Alta entropía, 256 bits, solo en posesión del cliente)
│   │    └─────────── Public Key ID (No secreto, indexado en DB para lookup O(1))
│   └──────────────── Environment (live / test / staging)
└──────────────────── Credential Type (ak = API Key, rk = Restricted Key)
```

---

## 6. Prefijo Semántico

Ejemplos: `ak_live_`, `ak_test_`, `rk_live_`.  
Permite comunicar el entorno y la sensibilidad de la credencial sin necesidad de consultar la base de datos.

### 6.1. Beneficio de Secret Scanning
Un prefijo reconocible permite configurar reglas de expresiones regulares para escáneres automáticos (GitHub Secret Scanning, Gitleaks, TruffleHog), bloqueando filtraciones accidentales en repositorios de código.

---

## 7. No Codificar Metadata Sensible en el Prefijo

- ✅ **Correcto:** `ak_live_`
- ❌ **Incorrecto:** `ak_live_customer_829_superadmin_`  
*El formato público no debe revelar nombres de clientes, roles internos ni identificadores privados.*

---

## 8. Public Key ID

Ejemplo: `4Q7NZ2KM`.  
- **Características:** No secreto, aleatorio, de longitud fija e indexado de forma única en la base de datos.
- **Función:** Localizar el registro en tiempo $O(1)$ sin realizar barridos de hashes costosos.

---

## 9. Generación del Secret

Debe generarse mediante un generador criptográficamente seguro (CSPRNG).  
- **Baseline mínimo:** $\ge 128$ bits de entropía.
- **Preferencia estándar:** **256 bits de entropía** (32 bytes aleatorios).

---

## 10. Generación en Node.js / NestJS

```typescript
import { randomBytes } from 'node:crypto';

export function generateApiKeySecret(): string {
  // 32 bytes representan 256 bits de entropía real
  return randomBytes(32).toString('base64url');
}

export function generatePublicId(): string {
  // 8 a 12 caracteres alfanuméricos únicos
  return randomBytes(8).toString('base64url').slice(0, 10);
}
```

---

## 11. Formato Completo Ensamblado

```typescript
export function assembleApiKey(
  environment: 'live' | 'test',
  publicId: string,
  secret: string,
): string {
  return ['ak', environment, publicId, secret].join('_');
}
```

---

## 12. Checksum Opcional

Un checksum rápido (CRC32) es puramente opcional para detección de errores tipográficos (*typos*) en herramientas de desarrollo.

### 12.1. El Checksum no Aporta Seguridad
Un checksum no protege contra falsificación porque cualquier atacante puede recalcularlo. **Checksum $\ne$ Firma $\ne$ Verificación de secreto.**

---

## 13. Parser Liviano de Credenciales

Antes de golpear la base de datos o la caché, validar de forma económica: longitud total esperada, prefijo, separadores y alfabeto permitido. Esto descarta peticiones basura sin costo computacional.

```typescript
export interface ParsedApiKey {
  type: string;
  environment: 'live' | 'test';
  publicId: string;
  secret: string;
}

export function parseApiKey(rawKey: string): ParsedApiKey | null {
  if (!rawKey || typeof rawKey !== 'string') return null;

  const parts = rawKey.split('_');
  if (parts.length !== 4) return null;

  const [type, environment, publicId, secret] = parts;
  if (type !== 'ak' && type !== 'rk') return null;
  if (environment !== 'live' && environment !== 'test') return null;
  if (!publicId || publicId.length < 8 || publicId.length > 16) return null;
  if (!secret || secret.length < 32) return null;

  return { type, environment, publicId, secret };
}
```

---

## 14. Prohibición de Regex Complejas (Anti-ReDoS)

El validador de formato debe ser lineal y acotado para evitar ataques de denegación de servicio por expresiones regulares (*ReDoS*).

---

## 15. Modelo de Persistencia

> **Regla de oro:** **NUNCA** persistir la API Key completa ni el secreto en texto plano.

---

## 16. Esquema de Persistencia Relacional / Prisma

```prisma
model ApiKey {
  id               String    @id @default(uuid())
  publicId         String    @unique @map("public_id")
  secretDigest     String    @map("secret_digest")
  digestVersion    Int       @default(1) @map("digest_version")
  tenantId         String    @map("tenant_id")
  ownerId          String    @map("owner_id")
  name             String
  environment      String    // 'live' | 'test'
  status           String    @default("ACTIVE") // 'ACTIVE' | 'ROTATING' | 'REVOKED' | 'EXPIRED'
  scopes           String[]  @default([])
  ipAllowlist      String[]  @default([]) @map("ip_allowlist")
  expiresAt        DateTime? @map("expires_at")
  lastUsedAt       DateTime? @map("last_used_at")
  revokedAt        DateTime? @map("revoked_at")
  revocationReason String?   @map("revocation_reason")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@index([publicId, status])
  @@index([tenantId])
  @@map("api_keys")
}
```

---

## 17. Unicidad del Public ID

Constraint obligatoria en base de datos:
```sql
CONSTRAINT uq_api_keys_public_id UNIQUE (public_id)
```

---

## 18. Máquina de Estados Explícita

Modelar los estados de la credencial mediante un único enum o columna de estado:
`ACTIVE`, `ROTATING`, `REVOKED`, `EXPIRED`, `DISABLED`.  
*Evitar múltiples columnas booleanas inconsistentes (`isActive`, `isRevoked`, `isExpired`).*

---

## 19. Diferencia entre Hashing de Passwords y API Keys

- **Contraseñas Humanas:** Tienen baja entropía y son vulnerables a ataques de diccionario. Requieren KDFs lentos y costosos en CPU/memoria (`Argon2id`, `scrypt`, `bcrypt`).
- **API Keys Criptográficas:** Tienen 256 bits de entropía real generada por CSPRNG. Un atacante no puede adivinarlas por fuerza bruta offline. Por tanto, KDFs pesados como Argon2id solo provocarían una vulnerabilidad de agotamiento de CPU (*DoS*) en un endpoint con alto tráfico.

---

## 20. Hashing Rápido con HMAC-SHA-256 y Pepper

Para secretos con $\ge 256$ bits de entropía, **HMAC-SHA-256** o **SHA-256 con Pepper server-side** es el estándar de producción:
- Tiempo de cómputo inferior a $10\,\mu\text{s}$.
- Resistente a volcados (*dumps*) de base de datos gracias al pepper externo.

```typescript
import { createHmac } from 'node:crypto';

export function computeSecretDigest(secret: string, pepper: string): string {
  return createHmac('sha256', pepper)
    .update(secret)
    .digest('hex');
}
```

---

## 21. Almacenamiento del Pepper en Secret Manager

El pepper criptográfico **NUNCA** debe residir en la base de datos junto a los hashes. Debe inyectarse desde un Secret Manager (AWS Secrets Manager, GCP Secret Manager, Vault) como variable de entorno segura:
```bash
API_KEY_PEPPER_V1="clave_criptografica_altamente_secreta_32_bytes"
```

---

## 22. Verificación en Tiempo Constante (`timingSafeEqual`)

> [!CAUTION]
> **Prohibido:** `computedDigest === storedDigest`. Los operadores `===` terminan la comparación en el primer byte dispar, permitiendo a un atacante inferir el digest carácter por carácter midiendo diferencias de nanosegundos (*Timing Attacks*).

```typescript
import { timingSafeEqual } from 'node:crypto';

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');

  if (bufA.length !== bufB.length) {
    return false;
  }

  return timingSafeEqual(bufA, bufB);
}
```

---

## 23. Servicio Troncal de API Keys en NestJS (`ApiKeyService`)

```typescript
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import {
  generatePublicId,
  generateApiKeySecret,
  assembleApiKey,
  computeSecretDigest,
  constantTimeEquals,
  parseApiKey,
} from './api-key.crypto';

export interface CreateApiKeyResult {
  id: string;
  publicId: string;
  rawKey: string; // Mostrado exactamente una sola vez
  name: string;
  expiresAt: Date | null;
}

export interface ApiKeyPrincipal {
  id: string;
  publicId: string;
  tenantId: string;
  ownerId: string;
  scopes: string[];
  environment: 'live' | 'test';
}

@Injectable()
export class ApiKeyService {
  private readonly logger = new Logger(ApiKeyService.name);
  private readonly pepper: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.pepper = this.config.getOrThrow<string>('API_KEY_PEPPER');
  }

  async createApiKey(dto: {
    tenantId: string;
    ownerId: string;
    name: string;
    scopes: string[];
    environment: 'live' | 'test';
    expiresAt?: Date;
  }): Promise<CreateApiKeyResult> {
    const publicId = generatePublicId();
    const secret = generateApiKeySecret();
    const rawKey = assembleApiKey(dto.environment, publicId, secret);
    const secretDigest = computeSecretDigest(secret, this.pepper);

    const record = await this.prisma.apiKey.create({
      data: {
        publicId,
        secretDigest,
        digestVersion: 1,
        tenantId: dto.tenantId,
        ownerId: dto.ownerId,
        name: dto.name,
        environment: dto.environment,
        status: 'ACTIVE',
        scopes: dto.scopes,
        expiresAt: dto.expiresAt ?? null,
      },
    });

    return {
      id: record.id,
      publicId: record.publicId,
      rawKey,
      name: record.name,
      expiresAt: record.expiresAt,
    };
  }

  async verifyApiKey(rawKey: string, clientIp?: string): Promise<ApiKeyPrincipal> {
    const parsed = parseApiKey(rawKey);
    if (!parsed) {
      throw new UnauthorizedException('Formato de API Key inválido.');
    }

    // Lookup O(1) directo por publicId
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { publicId: parsed.publicId },
    });

    if (!apiKey) {
      throw new UnauthorizedException('API Key no válida o inexistente.');
    }

    // Verificación de estado de ciclo de vida
    if (apiKey.status !== 'ACTIVE' && apiKey.status !== 'ROTATING') {
      throw new UnauthorizedException(`La API Key se encuentra en estado ${apiKey.status}.`);
    }

    // Verificación de expiración temporal
    if (apiKey.expiresAt && apiKey.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('La API Key ha caducado.');
    }

    // Verificación de IP allowlist si está configurada
    if (clientIp && apiKey.ipAllowlist.length > 0 && !apiKey.ipAllowlist.includes(clientIp)) {
      throw new UnauthorizedException('Petición originada desde una IP no autorizada.');
    }

    // Verificación criptográfica del secreto en tiempo constante
    const computedDigest = computeSecretDigest(parsed.secret, this.pepper);
    const isValid = constantTimeEquals(computedDigest, apiKey.secretDigest);

    if (!isValid) {
      throw new UnauthorizedException('Credenciales de API Key incorrectas.');
    }

    // Actualización asíncrona de último uso sin bloquear la petición
    this.touchLastUsed(apiKey.id);

    return {
      id: apiKey.id,
      publicId: apiKey.publicId,
      tenantId: apiKey.tenantId,
      ownerId: apiKey.ownerId,
      scopes: apiKey.scopes,
      environment: apiKey.environment as 'live' | 'test',
    };
  }

  private touchLastUsed(id: string): void {
    // Se ejecuta de fondo para no añadir latencia a la consulta
    this.prisma.apiKey
      .update({
        where: { id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(`No se pudo actualizar lastUsedAt para la clave ${id}: ${err.message}`);
      });
  }
}
```

---

## 24. Guard de Autenticación de API Keys en NestJS (`ApiKeyGuard`)

```typescript
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ApiKeyService } from './api-key.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Respetar rutas públicas con decorador @Public()
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];
    const xApiKey = request.headers['x-api-key'];

    let rawKey: string | null = null;

    if (authHeader && typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      rawKey = authHeader.slice(7).trim();
    } else if (xApiKey && typeof xApiKey === 'string') {
      rawKey = xApiKey.trim();
    }

    if (!rawKey) {
      throw new UnauthorizedException('API Key ausente en la cabecera Authorization o X-API-Key.');
    }

    const clientIp = request.ip || request.connection?.remoteAddress;
    const principal = await this.apiKeyService.verifyApiKey(rawKey, clientIp);

    // Adjuntar la entidad de seguridad tipada al objeto de request
    request.apiKey = principal;

    return true;
  }
}
```

---

## 25. Decoradores Personalizados de NestJS

### 25.1. `@RequireApiKeyScopes()`
```typescript
import { SetMetadata } from '@nestjs/common';

export const API_KEY_SCOPES_KEY = 'api_key_scopes';
export const RequireApiKeyScopes = (...scopes: string[]) =>
  SetMetadata(API_KEY_SCOPES_KEY, scopes);
```

### 25.2. `@CurrentApiKey()`
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ApiKeyPrincipal } from './api-key.service';

export const CurrentApiKey = createParamDecorator(
  (data: keyof ApiKeyPrincipal | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const apiKey = request.apiKey as ApiKeyPrincipal;

    return data ? apiKey?.[data] : apiKey;
  },
);
```

### 25.3. `@Public()`
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

## 26. Guard de Autorización por Scopes (`ApiKeyScopesGuard`)

```typescript
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { API_KEY_SCOPES_KEY } from '../decorators/require-scopes.decorator';
import { ApiKeyPrincipal } from '../services/api-key.service';

@Injectable()
export class ApiKeyScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredScopes = this.reflector.getAllAndOverride<string[]>(
      API_KEY_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredScopes || requiredScopes.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const principal: ApiKeyPrincipal = request.apiKey;

    if (!principal) {
      throw new ForbiddenException('Contexto de API Key ausente.');
    }

    const hasAllScopes = requiredScopes.every((scope) =>
      principal.scopes.includes(scope),
    );

    if (!hasAllScopes) {
      throw new ForbiddenException(
        `La API Key no posee los scopes requeridos: ${requiredScopes.join(', ')}`,
      );
    }

    return true;
  }
}
```

---

## 27. Uso en Controladores NestJS

```typescript
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiKeyScopesGuard } from '../guards/api-key-scopes.guard';
import { RequireApiKeyScopes } from '../decorators/require-scopes.decorator';
import { CurrentApiKey } from '../decorators/current-api-key.decorator';
import { ApiKeyPrincipal } from '../services/api-key.service';

@Controller('api/v1/testimonials')
@UseGuards(ApiKeyGuard, ApiKeyScopesGuard)
export class TestimonialsApiController {
  @Get()
  @RequireApiKeyScopes('testimonials:read')
  async listTestimonials(@CurrentApiKey('tenantId') tenantId: string) {
    // Aislamiento estricto por inquilino mitigando BOLA/IDOR
    return { tenantId, items: [] };
  }

  @Post()
  @RequireApiKeyScopes('testimonials:write')
  async createTestimonial(
    @CurrentApiKey() key: ApiKeyPrincipal,
    @Body() payload: any,
  ) {
    return { success: true, createdBy: key.publicId };
  }
}
```

---

## 28. Rate Limiting por API Key con `@nestjs/throttler`

Para limitar el consumo por credencial en lugar de únicamente por IP:
```typescript
import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class ApiKeyThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Si la petición viene autenticada por API Key, usar el publicId como tracker
    if (req.apiKey?.publicId) {
      return `apikey:${req.apiKey.publicId}`;
    }
    // Fallback a la IP de origen
    return req.ips?.length ? req.ips[0] : req.ip;
  }
}
```

---

## 29. Interceptor de Auditoría y Métricas en NestJS

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class ApiKeyAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ApiKeyAudit');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.apiKey;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        if (apiKey) {
          const durationMs = Date.now() - start;
          this.logger.log({
            event: 'apikey.used',
            publicId: apiKey.publicId,
            tenantId: apiKey.tenantId,
            environment: apiKey.environment,
            route: request.route?.path || request.url,
            method: request.method,
            durationMs,
          });
        }
      }),
    );
  }
}
```

---

## 30. Proceso de Rotación Segura con Solapamiento

```text
Clave Antigua (ACTIVE)
       ↓
Emitir Nueva Clave (ACTIVE) -> Clave Antigua pasa a ROTATING
       ↓
El cliente actualiza sus sistemas con la nueva clave
       ↓
Monitorear que el tráfico en la clave antigua descienda a 0
       ↓
Revocar la clave antigua definitivamente (REVOKED)
```

---

## 31. Revocación Inmediata

```typescript
async revokeApiKey(publicId: string, reason: string): Promise<void> {
  await this.prisma.apiKey.update({
    where: { publicId },
    data: {
      status: 'REVOKED',
      revokedAt: new Date(),
      revocationReason: reason,
    },
  });

  // Invalidar en Redis si existe capa de caché distribuida
  await this.cacheStore.del(`apikey:${publicId}`);
}
```

---

## 32. Matriz de Antipatrones Específicos en NestJS y Node.js

- ⚠️ **APIKEY-01:** Hashing simple SHA-256 directo de la clave completa sin Public ID ni salt/pepper.
- ⚠️ **APIKEY-02:** Barridos lineales $O(N)$ en base de datos comparando hashes uno a uno.
- ⚠️ **APIKEY-03:** Actualización síncrona y bloqueante de `lastUsedAt` en la base de datos dentro del flujo crítico del Guard.
- ⚠️ **APIKEY-04:** Comparar digests con el operador `===` en lugar de `crypto.timingSafeEqual`.
- ⚠️ **APIKEY-05:** Confundir la autenticación de API Keys con la autenticación de usuarios humanos (JWT).
- ⚠️ **APIKEY-06:** Enviar o aceptar API Keys en parámetros de consulta de la URL (`?api_key=...`).
- ⚠️ **APIKEY-07:** Mostrar el secreto al usuario en consultas posteriores de administración (viola el *one-time reveal*).
- ⚠️ **APIKEY-08:** Omitir la validación de scopes asumiendo que tener una clave válida otorga acceso universal a todos los endpoints.
- ⚠️ **APIKEY-09:** Registrar la clave en texto plano en los logs de Pino o consola.
- ⚠️ **APIKEY-10:** Reutilizar la misma API Key entre diferentes entornos (`live` vs `test`).

---

## 33. Definition of Done (DoD) para API Keys en Producción

Una implementación de API Keys se considera lista para producción cuando satisface:
- **Estructura Compuesta:** Generación mediante CSPRNG con Prefijo, Public ID y Secret de 256 bits.
- **Seguridad Criptográfica:** Digest generado con HMAC-SHA-256 y pepper versionado fuera de DB.
- **Verificación Constant-Time:** Uso estricto de `crypto.timingSafeEqual()`.
- **Integración NestJS:** `ApiKeyGuard` y `ApiKeyScopesGuard` protegiendo endpoints con `@RequireApiKeyScopes()`.
- **Lookup O(1):** Índice único en base de datos sobre `public_id`.
- **Revelado Único:** El secreto solo se entrega en la respuesta del comando de creación.
- **Aislamiento de Inquilino:** Todo recurso consultado filtra obligatoriamente por `req.apiKey.tenantId`.
- **Rate Limiting:** Límites aplicados por `publicId` mediante `@nestjs/throttler`.
- **Observabilidad:** Registro de eventos de auditoría sin filtración de secretos.

---

## 34. Cheat Sheet — Las 20 Reglas de Oro

1. Una API Key es una credencial bearer confidencial para máquinas.
2. Nunca la uses para inicio de sesión interactivo de humanos.
3. Generá el secreto con CSPRNG (mínimo 256 bits de entropía).
4. Separá el `public_id` indexable del `secret` confidencial.
5. Usá prefijos semánticos (`ak_live_`, `ak_test_`) para habilitar secret scanning.
6. Mostrá el secreto en texto plano exactamente una sola vez (*one-time reveal*).
7. Nunca persistas el secreto de la clave en texto plano.
8. Para alta entropía, HMAC-SHA-256 es óptimo, seguro y rápido.
9. El pepper debe residir en un Secret Manager, jamás en la base de datos.
10. Buscá registros en tiempo $O(1)$ mediante el `public_id`.
11. Compará siempre digests con `crypto.timingSafeEqual`.
12. Jamás envíes o aceptes API Keys en query params de la URL.
13. Exigí HTTPS/TLS estricto para todo el tráfico.
14. En NestJS, encapsulá la lógica en un `ApiKeysModule` con Guards e Interceptors.
15. Protegé endpoints con `@RequireApiKeyScopes()` y `ApiKeyScopesGuard`.
16. Aislá el acceso a datos por `tenantId` para mitigar BOLA.
17. Diseñá soporte de fechas de expiración programadas.
18. Garantizá revocación inmediata e invalidación de caché sincronizada.
19. Permití períodos de solapamiento controlados para rotación sin caídas de servicio.
20. Aplicá Rate Limiting por `publicId` y registrá en logs sin volcar secretos.

---

## 35. Resultado Esperado

Un módulo de API Keys implementado bajo la especificación técnica **SKL-APIKEY-SEC-001** es:
- **Matemáticamente imposible de adivinar por fuerza bruta.**
- **Irrecuperable desde la base de datos (solo digests con pepper persistidos).**
- **Idóneo para NestJS mediante Guards, Decorators y DI modular.**
- **Protegido contra ataques de temporización (constant-time verification).**
- **Auditado y observable en producción con trazabilidad completa de uso.**
