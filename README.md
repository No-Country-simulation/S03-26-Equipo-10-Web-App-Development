# testimonial-cms

Monorepo para un CMS de testimonios con `Next.js` en frontend/admin, `NestJS` en backend y `Postgres + Prisma` como base de datos.

## Estructura

```text
apps/
  api/   -> API REST con NestJS + Prisma
  web/   -> Frontend de prueba para registro, login y dashboard admin
docs/    -> documentación funcional, técnica y de dominio
init.sql -> modelo de datos de referencia del proyecto
```

## Requisitos

- Node.js 20+
- npm 10+
- Docker / Docker Compose

## Fuente de verdad de la base

- `docker-compose.yml` solo levanta `Postgres` con persistencia y healthcheck.
- El schema de la aplicación se aplica con `Prisma` desde `apps/api/prisma`.
- `init.sql` se conserva como referencia del modelo de datos y del alcance documental; no se monta automáticamente en Docker para evitar drift con Prisma.

## Puesta en marcha

1. Copiar variables de entorno:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

2. Levantar Postgres:

```bash
docker compose up -d postgres
```

3. Instalar dependencias:

```bash
npm install
```

4. Generar cliente Prisma, migrar y seed:

```bash
npm run db:generate --workspace @testimonial-cms/api
npm run db:migrate --workspace @testimonial-cms/api
npm run db:seed --workspace @testimonial-cms/api
```

5. Levantar frontend y backend:

```bash
npm run dev
```

## Endpoints principales

- `GET /api/v1/health`
- `POST /api/v1/auth/register-admin`
- `POST /api/v1/auth/login`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/users`
- `POST /api/v1/users`
- `GET /api/v1/testimonials`
- `POST /api/v1/testimonials`

## Flujo mínimo disponible

- `http://localhost:3000/admin/register` crea un tenant + admin y guarda la sesión local.
- `http://localhost:3000/admin/login` inicia sesión contra la API real.
- `http://localhost:3000/admin` muestra tenant, usuarios y testimonios del tenant autenticado.

## Buenas prácticas del compose actual

- Imagen liviana: `postgres:16-alpine`
- Volumen persistente nombrado
- `healthcheck` con `pg_isready`
- `restart: unless-stopped`
- `PGDATA` separado dentro del volumen
- `no-new-privileges` activado

## Scripts raíz

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run format`
