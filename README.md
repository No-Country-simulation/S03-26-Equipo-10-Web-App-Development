# testimonial-cms

Monorepo inicial para un CMS de testimonios con `Next.js` en frontend/admin, `NestJS` en backend y `Postgres + Prisma` como base de datos.

## Estructura

```text
apps/
  api/   -> API REST con NestJS + Prisma
  web/   -> Landing pública + admin con Next.js
```

## Requisitos

- Node.js 20+
- npm 10+
- Docker / Docker Compose

## Puesta en marcha

1. Copiar variables de entorno:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

2. Levantar Postgres:

```bash
docker compose up -d
```

3. Instalar dependencias:

```bash
npm install
```

4. Generar cliente Prisma y correr migraciones:

```bash
npm run db:generate --workspace @testimonial-cms/api
npm run db:migrate --workspace @testimonial-cms/api
```

5. Levantar frontend y backend:

```bash
npm run dev
```

## Endpoints iniciales

- `GET /api/health`
- `GET /api/auth/session`
- `GET /api/testimonials`
- `GET /api/testimonials/published`
- `POST /api/testimonials` protegido con guard placeholder
- `PATCH /api/testimonials/:id/status` protegido con guard placeholder

## Flujo admin placeholder

- `http://localhost:3000/admin/login` crea una cookie local de sesión demo.
- El middleware del frontend protege `/admin`.
- El backend protege endpoints de escritura con el header `x-admin-preview: true` mientras se completa auth real.

## Scripts raíz

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run test`
- `npm run format`
