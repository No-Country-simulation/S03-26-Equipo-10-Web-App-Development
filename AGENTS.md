# AGENTS.md — Testimonial CMS

> **Documento de Inducción Canónico para Agentes de IA**
> Leer este archivo antes de cualquier tarea. Tiempo estimado: < 3 minutos.

---

## 1. Identidad del Proyecto

| Atributo | Valor |
|----------|-------|
| **Nombre** | Testimonial CMS |
| **Tipo** | Plataforma SaaS multi-tenant de gestión de prueba social |
| **Versión** | 0.1.0 |
| **Monorepo** | npm workspaces (`apps/api`, `apps/web`) |
| **Licencia** | MIT — Proyecto educativo |

---

## 2. Stack Tecnológico

| Capa | Tecnología | Versión |
|------|-----------|---------|
| **Runtime** | Node.js LTS | 24.21.0 |
| **Backend** | NestJS | 11.x |
| **ORM** | Prisma | 6.5+ |
| **Base de datos** | PostgreSQL | 18+ |
| **Frontend** | Next.js (App Router) | 15.x |
| **UI** | React | 18.x |
| **Estilos** | Tailwind CSS + Radix UI | v3 |
| **Outbox** | Polling PostgreSQL en la API | cada 3 s |
| **Cuotas y caché pública** | Redis compartido en Compose y descartable en CI; alojamiento futuro pendiente | 7 |
| **Package manager** | npm | 11.19.0 |
| **Infraestructura** | Docker Compose | — |

---

## 3. Arquitectura (Resumen Ejecutivo)

- **Patrón**: Modular Monolith, N-Tier (NestJS Layers)
- **Comunicación**: REST síncrono (`/api/v1/`) + Transactional Outbox procesado mediante polling en la API
- **Multi-tenant**: aislamiento lógico por `tenant_id` en las consultas de recursos del tenant; no hay política PostgreSQL RLS
- **Auth**: JWT + familias de refresh tokens + RBAC (`admin`, `editor`); cookies HttpOnly en la web y Bearer explícito para clientes API
- **API keys**: HMAC-SHA-256 con pepper versionado para `ak_`; lector `tms_` temporal durante el corte
- **Webhooks**: ledger y polling PostgreSQL con entrega at least once; firma versionada y secreto cifrado por destino
- **Cuotas y caché**: Redis para contadores atómicos e invalidación por versión de tenant; no participa en la entrega durable

```
Monorepo Root
├── apps/api/        → @testimonial-cms/api  (NestJS 11 + Prisma)
├── apps/web/        → @testimonial-cms/web  (Next.js 15 App Router)
├── docs/            → Documentación técnica, dominio, producto, operaciones
├── .agents/         → 25 skills propias de ingeniería (SKL-*) + otras habilidades instaladas, reglas y prompts
├── infra/           → Docker + Nginx configs
└── scripts/         → Utilidades locales (PowerShell, Bash)
```

---

## 4. Mapa de Navegación del Contexto

Orden de lectura recomendado al comenzar una tarea nueva:

1. **`llm.txt`** → Resumen hiper-denso del proyecto (< 1 min)
2. **`docs/technical/01_architecture.md`** → Restricciones macro y diagramas C4
3. **`docs/domain/business_rules.md`** → Invariantes y reglas de negocio
4. **`docs/domain/diccionario_de_dato.md`** → ERD + estructura de tablas
5. **`.agents/skills/<skill>/SKILL.md`** → Skill técnica relevante para la tarea
6. **`docs/plan/<fecha>_<tarea>.md`** → Plan HITL activo (si existe)
7. **`docs/modules/<módulo>.md`** → Especificación del módulo afectado

---

## 5. Fronteras Operativas del Agente

### ✅ El agente PUEDE:

- Generar y modificar código dentro de `apps/api/src/modules/`
- Generar y modificar código dentro de `apps/web/src/features/`
- Crear o modificar tests unitarios y de integración
- Proponer migraciones Prisma (generar el archivo `.sql`)
- Crear y actualizar documentación en `docs/`
- Crear y actualizar archivos en `.agents/` (skills, rules, prompts)
- Actualizar `AGENTS.md` y `llm.txt` tras cambios arquitectónicos
- Sugerir comandos de commit siguiendo el estándar del proyecto

### 🚫 El agente NO PUEDE (requiere ACK humano explícito):

- Modificar `apps/api/prisma/schema.prisma` directamente
- Ejecutar `npx prisma migrate deploy` o `db push` en cualquier entorno
- Alterar archivos de infraestructura (`docker-compose.yml`, `infra/`)
- Modificar `package.json` raíz (workspaces, engines, overrides)
- Alterar `.husky/` o hooks de pre-commit
- **Persistir secretos, tokens, contraseñas o PII en ningún archivo de contexto**
- **Agrupar múltiples fases HITL en una sola ejecución sin ACK intermedio**

---

## 6. Módulos del Sistema

### Backend (`apps/api/src/modules/`)

| Módulo | Responsabilidad Principal |
|--------|--------------------------|
| `auth/` | JWT login/register, refresh token rotation, logout, `/me` |
| `users/` | CRUD usuarios, asignación de roles RBAC |
| `tenants/` | Provisioning, aislamiento por tenant y logo con limpieza durable de Cloudinary |
| `testimonials/` | Lifecycle de testimonios, moderación, scoring, tags, categorías |
| `webhooks/` | Outbox transaccional, polling, delivery HTTP, reintentos, HMAC signing |
| `analytics/` | Tracking de vistas y clicks en widgets |
| `business-intelligence/` | ETL horario independiente, migrador DW, panel admin/editor y métricas técnicas; caída OLAP aislada del CMS |
| `api-keys/` | Gestión de API Keys para acceso público |
| `feature-flags/` | Feature toggles por tenant |
| `health/` | Liveness + readiness probes |
| `database/` | PrismaService compartido |
| `shared/` | Cloud (Cloudinary), utilidades transversales |

### Frontend

- `apps/web/src/features/`: pantallas y adaptadores HTTP de administración, autenticación y páginas públicas activas.
- `apps/web/src/app/`: composición de rutas; las rutas preparatorias simples permanecen en `app/`.
- `apps/web/src/hooks/use-session.ts`: mecanismo de sesión usado por las rutas activas.

---

## 7. Reglas de Negocio Críticas

> Ver detalle completo en `docs/domain/business_rules.md`

- **Ciclo de vida del testimonio**: `draft → pending → approved → published | rejected`
- **Contenido mínimo**: ≥ 10 caracteres, rating entre 1 y 5
- **Aislamiento multi-tenant**: Toda query DEBE filtrar por `tenant_id`
- **Webhook delivery**: At least once; los destinos nuevos usan firma `X-TMS-Signature` sobre los bytes exactos y secreto cifrado. Los destinos legados tienen una ventana de migración.
- **API Keys**: `ak_` usa HMAC-SHA-256 con pepper externo y scopes; `tms_` permanece como lector legado temporal por 30 días desde el primer despliegue compatible.

---

## 8. Estándar de Commits

Usar **Conventional Commits** (ver referencia completa en `docs/collaboration/02_git_workflow.md`):

```
<type>(<scope>): <descripción en español rioplatense, voseo formal>

[cuerpo opcional en español rioplatense]

[Closes #<issue>]
```

**Reglas de idioma**:
- `type` y `scope` → **inglés** (`feat`, `fix`, `auth`, `testimonials`...)
- `description`, `body`, `footer` → **español rioplatense con voseo formal**
- No usar tuteo (`implementa`), ustedeo (`implemente`) ni infinitivo (`implementar`)

**Tipos permitidos**: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

**Ejemplos**:
```bash
feat(api): agregá el endpoint de moderación de testimonios
fix(webhooks): corregí el timeout en el procesador de outbox
docs(modules): incorporá la especificación del módulo testimonials
test(auth): incorporá los tests unitarios de rotación de refresh token
refactor(scoring): extraé la lógica de decay a una función pura
```

---

## 9. Flujo HITL Obligatorio

Al trabajar con un plan en `docs/plan/`:

1. Leer la sección **"Contexto y Restricciones"** del plan
2. Ejecutar **SOLO** la fase marcada como `[Actual]`
3. Al finalizar: mostrar commit sugerido y **detenerse**
4. Esperar ACK humano antes de avanzar a la siguiente fase
5. Si hay ambigüedad o contradicción → **preguntar**, nunca asumir

> **Antipatrón prohibido**: Agrupar múltiples fases en una sola ejecución.

---

## 10. Skills Disponibles (`.agents/skills/`)

Catálogo de 25 skills propias de ingeniería con código SKL; no representa el total de habilidades instaladas en el directorio.

| Skill | Código | Dominio |
|-------|--------|---------|
| `react-interface-engineering` | SKL-REACT-UI-001 | React / Frontend |
| `nextjs-frontend-engineering` | SKL-NEXT-FRONTEND-001 | Next.js Frontend |
| `nextjs-architecture-engineering` | SKL-NEXT-ARCH-001 | Next.js Architecture |
| `tailwind-architecture-engineering` | SKL-FE-TW-001 | Tailwind CSS |
| `css-architecture-engineering` | SKL-FE-CSS-001 | CSS Architecture |
| `web-rendering-performance-engineering` | SKL-FE-ARCH-002 | Web Performance |
| `web-seo-accessibility-engineering` | SKL-WEB-SEO-A11Y-001 | SEO + A11y |
| `node-next-api-engineering` | SKL-API-NODE-NEXT-001 | Node.js APIs |
| `node-backend-engineering` | SKL-NODE-BACKEND-001 | Node.js Backend |
| `web-security-engineering` | SKL-WEB-SEC-001 | Security |
| `api-key-security-engineering` | SKL-APIKEY-SEC-001 | API Keys |
| `webhook-architecture-engineering` | SKL-WEBHOOK-ARCH-001 | Webhooks |
| `postgresql-database-engineering` | SKL-DB-POSTGRES-001 | PostgreSQL |
| `relational-database-sql-engineering` | SKL-DB-SQL-001 | SQL |
| `prisma-persistence-engineering` | SKL-ARCH-PRISMA-001 | Prisma ORM |
| `observability-reliability-engineering` | SKL-ARCH-OBS-001 | Observability |
| `javascript-typescript-engineering` | SKL-JSTS-PRO-001 | TypeScript |
| `secure-project-configuration-engineering` | SKL-JS-CONFIG-001 | Configuration |
| `git-engineering` | SKL-DEV-GIT-001 | Git |
| `github-engineering` | SKL-DEV-GITHUB-001 | GitHub |
| `layered-architecture-engineering` | SKL-ARCH-LAYERED-001 | Architecture / Full-Stack |
| `cognitive-interface-engineering` | SKL-UX-PSYCH-001 | UX / Cognitive Interface |
| `docker-container-engineering` | SKL-DEVOPS-DKR-001 | DevOps / Containers |
| `monorepo-architecture-engineering` | SKL-MONOREPO-ARCH-001 | Architecture / DevOps / Monorepo |
| `cicd-pipeline-engineering` | SKL-DEVOPS-CICD-001 | CI/CD / DevSecOps / Despliegue y recuperación |

---

*Última actualización: 2026-10-09 — Versión del framework: SKL-PRO-001 v1.1.0*
