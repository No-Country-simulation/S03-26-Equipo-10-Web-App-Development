# Configuración local

Esta guía describe el checkout actual. El contrato exacto de dependencias está en `package.json`, `.node-version`, `.npmrc` y `package-lock.json` de la raíz.

## Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | 24.21.0 |
| npm | 11.19.0 |
| PostgreSQL | 18 |
| Docker Compose | Necesario solo para los servicios locales en contenedores |

React 18, Next.js 15, NestJS 11 y Prisma 6.5 son dependencias de los workspaces; `npm ci` las instala. Redis 7 está disponible en Compose, aunque la API actual procesa el outbox con polling PostgreSQL y usa una caché local en memoria.

## Preparar el checkout

```bash
git clone https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development.git
cd S03-26-Equipo-10-Web-App-Development
nvm install
nvm use
npm install --global npm@11.19.0
npm ci
```

`npm ci` usa el lockfile sin modificarlo y `engine-strict` rechaza otras versiones de Node o npm. No borres `package-lock.json` para resolver errores de instalación. Revisá primero la versión activa con `node --version` y `npm --version`.

Copiá los ejemplos y completá los valores locales fuera de Git:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

La raíz `.env` alimenta Docker Compose; `apps/api/.env` alimenta NestJS; `apps/web/.env.local` define la URL pública incorporada al build web. La API requiere `DATABASE_URL` y `JWT_SECRET` de al menos 32 caracteres. `NEXT_PUBLIC_API_URL` debe apuntar a la API accesible desde el navegador. No subas estos archivos reales al repositorio.

## Base descartable para desarrollo

```bash
docker compose up -d postgres
npm run db:generate --workspace @testimonial-cms/api
npm run db:migrate --workspace @testimonial-cms/api
npm run db:seed --workspace @testimonial-cms/api
```

Aplicá las migraciones solo a una base local descartable preparada para desarrollo. Si tenés datos de PostgreSQL 16 que preservar, seguí primero la [guía de respaldo y restauración](../operations/04_postgresql_18_compose_upgrade.md); conservá el volumen anterior. No ejecutes `docker compose down -v` sobre una base con datos que necesites.

## Ejecutar y verificar

```bash
npm run dev
```

Web escucha en `http://localhost:3000`; la API en `http://localhost:4000/api/v1`. Comprobá `http://localhost:4000/api/v1/health/live` y `http://localhost:4000/api/v1/health/ready`. Readiness requiere una conexión funcional a PostgreSQL.

Las verificaciones locales de las dos apps se ejecutan desde la raíz:

```bash
npm run typecheck
npm run lint
npm test
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run build
```

La suite de API omite cinco pruebas PostgreSQL si no recibe `TEST_DATABASE_URL`. En CI la variable es obligatoria, la base es descartable y se aplican allí las migraciones antes de las pruebas. El workflow también audita dependencias, verifica firmas y prueba el arranque de las imágenes. Su resultado debe comprobarse en GitHub Actions; una ejecución local sin Docker no lo acredita.

## Comandos por workspace

```bash
npm run typecheck --workspace @testimonial-cms/api
npm run lint --workspace @testimonial-cms/api
npm run test --workspace @testimonial-cms/api
npm run build --workspace @testimonial-cms/api

npm run typecheck --workspace @testimonial-cms/web
npm run lint --workspace @testimonial-cms/web
npm run test --workspace @testimonial-cms/web
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run build --workspace @testimonial-cms/web
```

Consultá [README.md](../../README.md) para los flujos del producto y [CI](../../.github/workflows/ci.yml) para el orden de verificación automatizado.
