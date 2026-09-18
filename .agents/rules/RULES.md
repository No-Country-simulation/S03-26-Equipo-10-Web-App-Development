# Reglas Operativas — @testimonial-cms
# Código: SKL-PRO-001 v1.1.0 — Cargadas automáticamente por Antigravity IDE
# Fecha de creación: 2026-09-18

---

## 1. Estructura de Código

- Todo código backend DEBE vivir dentro de un módulo NestJS en `apps/api/src/modules/`
- Todo código frontend DEBE vivir dentro de una feature en `apps/web/src/features/`
- No crear archivos de lógica fuera de la estructura Feature-Oriented
- Imports entre módulos: solo a través de barrel exports (`index.ts`) o mediante `Module.exports`
- No crear dependencias circulares entre módulos; usar `forwardRef` solo como último recurso

## 2. Multi-tenant (Regla Crítica)

- **Toda** query a la base de datos DEBE incluir filtro `WHERE tenant_id = ?`
- Nunca exponer datos cross-tenant bajo ninguna circunstancia
- Validar `tenant_id` en Guards (capa de transporte), no en Services (capa de negocio)
- Toda entidad nueva DEBE tener `tenant_id` como FK obligatoria (NOT NULL)

## 3. Seguridad

- Nunca persistir secretos, contraseñas, tokens o PII en archivos de contexto (AGENTS.md, llm.txt, docs/, .agents/)
- API Keys: almacenar SOLO el hash HMAC-SHA256 con pepper; nunca en texto plano
- Webhooks: firmar payload con HMAC-SHA256; verificar con `timingSafeEqual` (no `===`)
- JWT: access token en cookie HttpOnly `accessToken` (15 min), refresh en cookie path-scoped `refreshToken` (7 días)
- Validar todos los inputs de entrada con Zod DTOs (nestjs-zod) en controllers

## 4. Calidad de Código

- TypeScript strict mode obligatorio en todos los archivos
- Usar `npm ci` (nunca `npm install`) en entornos CI/CD
- Todo endpoint nuevo DEBE tener DTO con validación Zod o class-validator
- Todo service nuevo DEBE tener tests unitarios (coverage > 80%)
- Linter (`npm run lint`) y formatter (`npm run format`) sin advertencias antes de commit
- No dejar `console.log` en código de producción; usar el logger de NestJS

## 5. Base de Datos

- NUNCA ejecutar `prisma migrate deploy` o `prisma db push` sin ACK humano explícito
- NUNCA modificar `apps/api/prisma/schema.prisma` sin ACK humano explícito
- Toda migración DEBE ser zero-downtime (Expand-Migrate-Contract cuando aplica)
- Preferir `SELECT` con proyección explícita sobre `SELECT *`

## 6. Infraestructura

- NUNCA modificar `docker-compose.yml`, `infra/` o `.husky/` sin ACK humano
- NUNCA modificar `package.json` raíz (workspaces, engines, overrides) sin ACK humano
- Las variables de entorno secretas van SOLO en `.env` (ignorado por git); nunca en código

## 7. Flujo HITL (Human-in-the-Loop)

- Leer la sección "Contexto y Restricciones" del plan activo en `docs/plan/` antes de ejecutar
- Ejecutar **UNA sola fase** del plan marcada como `[Actual]`
- Al finalizar: proponer commit siguiendo el estándar y **detenerse**
- Esperar ACK humano explícito antes de avanzar a la siguiente fase
- Ante cualquier ambigüedad o contradicción: **preguntar al humano**, nunca asumir ni inventar
- Antipatrón prohibido: agrupar múltiples fases sin ACK intermedio

## 8. Documentación Incremental (Antipatrón 1 — evitar sobre-ingeniería)

- Documentar SOLO la porción del sistema afectada por el issue o feature actual
- No intentar documentar exhaustivamente todo el sistema legado antes de desarrollar
- Actualizar `docs/modules/<módulo>.md` tras cada feature que modifique ese módulo
- Actualizar `llm.txt` y `AGENTS.md` solo cuando haya cambios arquitectónicos reales

## 9. Commits

Usar **Conventional Commits** (referencia: `docs/collaboration/02_git_workflow.md`):
```
<tipo>[ámbito]: <descripción imperativa breve>
```
Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`
