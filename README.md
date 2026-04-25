# Testimonial CMS - Social Proof Management Platform

**Proyecto educativo**: Plataforma SaaS multi-tenant para recolectar, moderar, analizar y distribuir testimonios y reseñas de clientes de forma centralizada.

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org)
[![NestJS](https://img.shields.io/badge/NestJS-Backend-E0234E.svg)](https://nestjs.com)
[![Next.js](https://img.shields.io/badge/Next.js-v14.x-black.svg)](https://nextjs.org)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791.svg)](https://postgresql.org)

## 📚 Documentación

| Documento | Audiencia | Descripción |
|-----------|-----------|-------------|
| [docs/](docs/) | 👤 Todos | Directorio principal de toda la documentación técnica y producto |
| [docs/technical/01_architecture.md](docs/technical/01_architecture.md) | 🏗️ Arquitectos | Guía completa de Clean Architecture y dependencias |
| [docs/adr/](docs/adr/) | 🏗️ Arquitectos | Decisiones arquitectónicas (NestJS, Outbox, Multi-tenant) |
| [diccionario_de_dato.md](diccionario_de_dato.md) | 💾 Data | Estructura de base de datos, relaciones y Diagrama ERD |

## 📋 Descripción

### Stack Tecnológico

| Categoría | Tecnología | Versión | Propósito |
|-----------|-----------|---------|-----------|
| **Backend Framework**| NestJS | 10.x | API REST principal bajo Clean Architecture |
| **Frontend/Admin** | Next.js | 14.x | Panel de control e interfaces (React) |
| **Database** | PostgreSQL | 16 | Persistencia relacional de datos central |
| **ORM** | Prisma | 5.x | Acceso a datos tipo-seguro y migraciones |
| **Caché & Colas** | Redis | 7 | Almacenamiento rápido en memoria |
| **Job Queue** | BullMQ | - | Procesamiento asíncrono (Outbox, webhooks) |
| **Runtime** | Node.js | 20.x | Entorno de ejecución de servidor |
| **Deployment** | Docker + Compose | - | Containerización |

Testimonial CMS es una plataforma que resuelve el problema de la gestión dispersa de la prueba social. Este proyecto implementa un CMS que:

- ✅ **Centraliza** testimonios escritos y en video en un solo panel de control
- ✅ Soporta arquitectura **Multi-tenant** (Row-Level) aislando los datos de cada cliente
- ✅ Facilita la **distribución ágil** mediante widgets insertables en sitios externos
- ✅ Proporciona integraciones vía **Webhooks** resilientes usando el Patrón Outbox
- ✅ **Modera testimonios** con flujos de aprobación y estados internos
- ✅ Implementa **Clean Architecture** (Hexagonal/Onion) estricta en el backend
- ✅ Expone una **API pública** documentada para desarrolladores
- ✅ Rastrea **Analíticas de visualización** y clicks en los widgets

## 🏗️ Arquitectura

```mermaid
graph TB
    Customer["👤 Cliente Externo<br>(Widget)"] -->|Envía testimonio| API["⚙️ Backend API<br>(NestJS)"]
    Tenant["🏢 Empresa / Tenant<br>(Admin Panel)"] -->|Configura y Modera| API
    
    API --> DB[("💾 PostgreSQL<br>(Prisma)")]
    API --> Cache[("⚡ Redis")]
    API --> Worker["⏳ Outbox Worker<br>(BullMQ)"]
    
    Worker -->|Lee pending events| DB
    Worker -->|POST /webhook| Webhook["🔗 Sistemas de Terceros<br>(Slack, CRM)"]

    style API fill:#E0234E,color:#fff
    style DB fill:#336791,color:#fff
    style Worker fill:#FF9800,color:#fff
```

> 📐 Diagramas detallados y guía de arquitectura en [docs/technical/01_architecture.md](docs/technical/01_architecture.md)

## 🚀 Quick Start

### 1. Requisitos previos

- Node.js 20.11+
- npm 10.5+
- Docker & Docker Compose

### 2. Instalación

```bash
# Clonar repositorio
git clone https://github.com/tu-usuario/testimonial-cms.git
cd testimonial-cms

# Instalar dependencias del monorepo
npm install

# Configurar variables de entorno
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 3. Inicializar base de datos

```bash
# Levantar PostgreSQL vía Docker Compose
docker compose up -d postgres

# Generar cliente Prisma
npm run db:generate --workspace @testimonial-cms/api

# Aplicar migraciones al esquema de DB
npm run db:migrate --workspace @testimonial-cms/api

# Poblar con datos semilla (Seed)
npm run db:seed --workspace @testimonial-cms/api
```

### 4. Ejecutar aplicación localmente

```bash
# Levantar frontend y backend simultáneamente
npm run dev
```

Abre `http://localhost:3000` para el panel de administración y `http://localhost:4000/api/v1` para la API.

### 5. Desplegar con Docker

```bash
# Levantar infraestructura (DB)
docker-compose up -d

# Ver logs
docker-compose logs -f
```

### 6. Validar instalación

Ve a `http://localhost:3000/admin/register` para crear tu primer Tenant y usuario administrador. Luego inicia sesión.

## 📁 Estructura del Proyecto

```
testimonial-cms/
├── apps/
│   ├── api/                 # Backend NestJS (Clean Architecture)
│   │   ├── src/
│   │   │   ├── common/      # Utilidades globales, guards, interceptors
│   │   │   ├── prisma/      # Servicio de base de datos
│   │   │   ├── infrastructure/ # Adaptadores compartidos
│   │   │   └── modules/     # Módulos de dominio (testimonials, auth)
│   │   └── prisma/          # Esquemas y migraciones
│   └── web/                 # Frontend Next.js
├── docs/                    # Documentación extensa
│   ├── adr/                 # Architectural Decision Records
│   ├── technical/           # Documentación técnica
│   ├── product/             # Documentación de producto
│   └── operations/          # Despliegue y observabilidad
├── scripts/                 # Utilidades
├── docker-compose.yml       # Infraestructura local
├── diccionario_de_dato.md   # Diccionario de base de datos
└── package.json             # Monorepo configs
```

## 🔧 Configuración de Integraciones

### Webhooks y Patrón Outbox

El sistema notifica a servicios externos de manera segura:
1. **Configuración**: El tenant registra una URL de webhook.
2. **Procesamiento**: Al aprobarse un testimonio, se inserta transaccionalmente un evento en `outbox_events`.
3. **Despacho**: Un worker (`BullMQ`) lee el evento y hace un POST seguro. Garantiza "Al menos una entrega" (At-least-once delivery) y reintentos ante fallas.

## 🧪 Testing

### Tests unitarios y de integración

```bash
# Ejecutar todos los tests en los workspaces
npm run test

# Pruebas específicas
npm run test --workspace @testimonial-cms/api
npm run test --workspace @testimonial-cms/web
```

### Test funcional del flujo

Flujo esperado:
1. Cliente hace POST `/api/v1/testimonials` → Se guarda en estado `pending`.
2. Admin aprueba en panel → Estado cambia a `published`.
3. Worker dispara webhook configurado.

## 📊 Endpoints de la API

### `POST /api/v1/testimonials`
Recibe un testimonio desde un widget público.

**Request:**
```json
{
  "content": "Excelente servicio, lo recomiendo al 100%.",
  "author_name": "Facundo",
  "rating": 5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440002",
    "status": "pending",
    "created_at": "2026-04-25T14:00:00Z"
  }
}
```

### `GET /api/v1/health`
Verifica conexión a Postgres y Redis.

## 🛡️ Controles y Limitaciones

### Row-Level Security (Multi-tenant)
- Estricto aislamiento de datos: todas las consultas filtran por el `tenant_id` en el request.
- No hay cruce de información entre empresas.

### Rate Limiting y Validación
- Límites de peticiones API con Guards de NestJS.
- Entradas públicas sanitizadas con DTOs y `class-validator` para evitar inyecciones.

## 🔐 Variables de Entorno

Edita los archivos `.env` basándote en `.env.example`:

```bash
# Postgres DB
POSTGRES_DB=testimonial_cms
POSTGRES_USER=postgres
POSTGRES_PASSWORD=change-this-local-password
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:change-this-local-password@localhost:5432/testimonial_cms?schema=public

# API y Web
WEB_PORT=3000
API_PORT=4000
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## 📈 Roadmap

- [x] Arquitectura base Multi-tenant (NestJS + Prisma)
- [x] Esquema relacional y diccionarios
- [x] Módulo Auth y Tenant provisioning
- [x] Patrón Outbox para Webhooks
- [x] Documentación 360 y modelado Mermaid
- [ ] Panel de control Frontend (Next.js)
- [ ] Widgets embeddables en React/VanillaJS
- [ ] Analíticas avanzadas de impresiones

## 🤝 Contribuir

Pull requests son bienvenidos. Asegúrate de correr `npm run format` y `npm run lint` antes de realizar un commit.

## 📄 Licencia

MIT License - Proyecto educativo de código abierto

## 👤 Autor

**Equipo 10**

---

⭐ Si este proyecto te fue útil, dale una star en GitHub!
