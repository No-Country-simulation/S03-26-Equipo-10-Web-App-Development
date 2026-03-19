# Guía de Configuración del Entorno de Desarrollo

## Tabla de Contenidos

- [Visión General](#visión-general)
- [Diagrama de Flujo de Configuración](#diagrama-de-flujo-de-configuración)
- [Prerrequisitos](#prerrequisitos)
- [Configuración Paso a Paso](#configuración-paso-a-paso)
  - [1. Clonar el Repositorio](#1-clonar-el-repositorio)
  - [2. Instalar Dependencias](#2-instalar-dependencias)
  - [3. Configurar Variables de Entorno](#3-configurar-variables-de-entorno)
  - [4. Inicializar Base de Datos](#4-inicializar-base-de-datos)
  - [5. Iniciar Servicios](#5-iniciar-servicios)
  - [6. Verificar Instalación](#6-verificar-instalación)
- [Configuración Avanzada](#configuración-avanzada)
  - [Docker Compose (Recomendado)](#docker-compose-recomendado)
  - [Configuración IDE](#configuración-ide)
  - [Herramientas de Desarrollo](#herramientas-de-desarrollo)
- [Ejecución del Proyecto](#ejecución-del-proyecto)
- [Ejecución de Tests](#ejecución-de-tests)
- [Solución de Problemas Comunes](#solución-de-problemas-comunes)
- [Recursos Adicionales](#recursos-adicionales)
- [Checklist de Verificación](#checklist-de-verificación)

---

## Visión General

Esta guía te ayudará a configurar un entorno de desarrollo completo para **Testimonial CMS** en tu máquina local. El proceso incluye:

1. Instalación de dependencias del sistema
2. Configuración del repositorio
3. Configuración de base de datos y servicios (PostgreSQL, Redis)
4. Inicio de la aplicación (backend y frontend)
5. Verificación de funcionalidad

**Tiempo estimado**: 15-30 minutos  
**Nivel de dificultad**: Principiante a Intermedio

---

## Diagrama de Flujo de Configuración

```mermaid
flowchart TD
    A[Inicio] --> B{¿Tiene Docker?}
    
    B -->|Sí| C[Usar Docker Compose<br>Recomendado]
    B -->|No| D[Configuración Manual]
    
    C --> E[Clonar Repositorio]
    D --> E
    
    E --> F[Instalar Dependencias]
    F --> G[Configurar .env]
    G --> H{¿Usa Docker?}
    
    H -->|Sí| I[docker compose up -d]
    H -->|No| J[Iniciar Servicios Manualmente]
    
    I --> K[Ejecutar Migraciones]
    J --> K
    
    K --> L[Iniciar Aplicación]
    L --> M[Verificar Instalación]
    M --> N[¡Listo para Desarrollar!]
    
    style C fill:#d4f7e2,stroke:#22c55e
    style I fill:#d4f7e2,stroke:#22c55e
    style N fill:#dbeafe,stroke:#3b82f6,stroke-width:2px
```

---

## Prerrequisitos

### Software Requerido

| Software | Versión Mínima | Instalación | Verificación |
|----------|----------------|-------------|--------------|
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) | `git --version` |
| **Node.js** | 20.x | [nvm](https://github.com/nvm-sh/nvm) o [official](https://nodejs.org/) | `node -v` |
| **npm** | 10.x | Viene con Node.js | `npm -v` |
| **Docker** | 24.x | [docker.com](https://www.docker.com/) | `docker --version` |
| **Docker Compose** | 2.x | Viene con Docker Desktop | `docker compose version` |
| **PostgreSQL** | 16 (usar Docker recomendado) | [postgresql.org](https://www.postgresql.org/) | `psql --version` |
| **Redis** | 7.x | [redis.io](https://redis.io/) | `redis-cli --version` |

### Cuentas Requeridas

| Servicio | Propósito | Registro |
|----------|-----------|----------|
| **GitHub** | Acceso al repositorio | [github.com/join](https://github.com/join) |
| **Cloudinary** | Almacenamiento de imágenes/videos | [cloudinary.com](https://cloudinary.com/) |
| **YouTube** | Metadatos de videos (opcional) | [console.developers.google.com](https://console.developers.google.com/) |

### Verificación de Prerrequisitos

Ejecuta este script para verificar que tienes todo instalado:

```bash
#!/bin/bash
# scripts/verify-prerequisites.sh

echo "🔍 Verificando prerrequisitos..."

# Colores para salida
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Función para verificar comando
check_command() {
  if command -v $1 &> /dev/null; then
    echo -e "${GREEN}✓ $1 está instalado${NC}"
    $1 --version | head -n 1
    return 0
  else
    echo -e "${RED}✗ $1 NO está instalado${NC}"
    return 1
  fi
}

# Verificar comandos
check_command git
check_command node
check_command npm
check_command docker
check_command "docker compose"
check_command psql
check_command redis-cli

# Verificar versión de Node.js
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -ge 20 ]; then
  echo -e "${GREEN}✓ Node.js versión compatible (v$NODE_VERSION)${NC}"
else
  echo -e "${RED}✗ Node.js versión incompatible (v$NODE_VERSION). Se requiere v20+${NC}"
  exit 1
fi

# Verificar espacio en disco
DISK_SPACE=$(df -h / | awk 'NR==2 {print $4}' | sed 's/G//')
if (( $(echo "$DISK_SPACE > 5" | bc -l) )); then
  echo -e "${GREEN}✓ Espacio en disco suficiente ($DISK_SPACE GB)${NC}"
else
  echo -e "${RED}✗ Espacio en disco insuficiente ($DISK_SPACE GB). Se requieren al menos 5 GB${NC}"
fi

echo -e "\n${GREEN}✅ Todos los prerrequisitos verificados correctamente${NC}"
echo "Puedes continuar con la configuración del proyecto."
```

Ejecuta el script:
```bash
chmod +x scripts/verify-prerequisites.sh
./scripts/verify-prerequisites.sh
```

---

## Configuración Paso a Paso

### 1. Clonar el Repositorio

```bash
# Clonar el repositorio
git clone https://github.com/tu-organizacion/testimonial-cms.git
cd testimonial-cms

# Configurar upstream (para mantener tu fork sincronizado)
git remote add upstream https://github.com/tu-organizacion/testimonial-cms.git

# Verificar remotos
git remote -v
# Deberías ver:
# origin    https://github.com/tu-usuario/testimonial-cms.git (fetch)
# origin    https://github.com/tu-usuario/testimonial-cms.git (push)
# upstream  https://github.com/tu-organizacion/testimonial-cms.git (fetch)
# upstream  https://github.com/tu-organizacion/testimonial-cms.git (push)
```

### 2. Instalar Dependencias

El proyecto usa workspaces de npm (monorepo). Instala todas las dependencias desde la raíz:

```bash
npm install

# Verificar instalación
npm list --depth=0
# Deberías ver todas las dependencias instaladas sin errores
```

**Nota**: Si encuentras errores durante la instalación:
```bash
# Limpiar caché e intentar nuevamente
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### 3. Configurar Variables de Entorno

El proyecto tiene varios archivos `.env`:

- Raíz: variables compartidas (pocas)
- `apps/api/.env`: backend (NestJS)
- `apps/frontend/.env`: frontend (Next.js)

Copia los archivos de ejemplo:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env
```

**Contenido mínimo de `.env`** (raíz, principalmente para Docker):
```env
# Docker Compose
POSTGRES_PASSWORD=postgres
REDIS_PASSWORD=
```

**Contenido de `apps/api/.env`**:
```env
# Servidor
NODE_ENV=development
PORT=3000

# Base de Datos
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/testimonial_cms_dev
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=testimonial_cms_dev
DATABASE_USER=postgres
DATABASE_PASSWORD=postgres

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=tu_secreto_super_seguido_de_al_menos_32_caracteres_random
JWT_EXPIRES_IN=15m
REFRESH_TOKEN_EXPIRES_IN=7d

# Cloudinary (obligatorio para subida de imágenes)
CLOUDINARY_CLOUD_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# YouTube (opcional, para metadatos)
YOUTUBE_API_KEY=tu_youtube_api_key

# API Keys
API_KEY_SALT=otro_secreto_para_hashear_api_keys
```

**Contenido de `apps/frontend/.env`**:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

**Generar JWT_SECRET seguro**:
```bash
# En macOS/Linux
openssl rand -base64 32

# En Windows (PowerShell)
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | ForEach-Object {[char]$_})
```

### 4. Inicializar Base de Datos

#### Opción A: Usando Docker (Recomendado)

```bash
# Iniciar servicios de base de datos con Docker Compose
docker compose up -d postgres redis

# Esperar a que los servicios estén listos
sleep 10

# Ejecutar migraciones (Prisma)
npx prisma migrate dev

# Ejecutar seed de datos de ejemplo
npm run db:seed
```

#### Opción B: Configuración Manual

```bash
# Crear base de datos (asumiendo PostgreSQL local)
createdb -U postgres testimonial_cms_dev

# Ejecutar migraciones
npx prisma migrate dev

# Ejecutar seed
npm run db:seed
```

**Verificar base de datos**:
```bash
# Conectar a PostgreSQL
psql -U postgres -d testimonial_cms_dev

# Ver tablas creadas
\dt

# Salir
\q
```

### 5. Iniciar Servicios

#### Opción A: Con Docker Compose (Recomendado)

```bash
# Iniciar todos los servicios (PostgreSQL, Redis, y la aplicación)
docker compose up -d

# Ver logs en tiempo real
docker compose logs -f

# Detener servicios
docker compose down
```

#### Opción B: Manualmente (sin Docker para la app)

```bash
# Terminal 1: Backend (NestJS)
cd apps/api
npm run dev

# Terminal 2: Frontend (Next.js)
cd apps/frontend
npm run dev
```

### 6. Verificar Instalación

```bash
# Verificar que el backend responde
curl http://localhost:3000/api/v1/health

# Deberías ver:
# {"status":"ok","timestamp":"YYYY-MM-DDT14:30:00.000Z"}

# Verificar que el frontend está accesible (abrir navegador en http://localhost:3001)
# También puedes usar curl
curl http://localhost:3001

# Ejecutar tests de salud
npm run test:health

# Verificar conexión a base de datos
npm run db:test-connection
```

**Acceder a la aplicación**:
- Frontend: http://localhost:3001
- API Docs (Swagger): http://localhost:3000/api/docs
- Backend (directo, si lo necesitas): http://localhost:3000

**Credenciales de prueba** (después de ejecutar seed):
```
Admin:
Email: admin@demo.com
Password: Admin123!

Editor:
Email: editor@demo.com
Password: Editor123!
```

---

## Configuración Avanzada

### Docker Compose (Recomendado)

**Archivo `docker-compose.yml` completo**:
```yaml
version: '3.8'

services:
  # Base de datos PostgreSQL
  postgres:
    image: postgres:16-alpine
    container_name: testimonial-cms-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRES_DB: testimonial_cms_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Cache Redis
  redis:
    image: redis:7-alpine
    container_name: testimonial-cms-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Backend (NestJS)
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile.dev
    container_name: testimonial-cms-api
    ports:
      - "3000:3000"
      - "9229:9229" # Node.js debugger
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres}@postgres:5432/testimonial_cms_dev
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=${JWT_SECRET}
      - CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
      - CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
      - CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}
      - YOUTUBE_API_KEY=${YOUTUBE_API_KEY}
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /app/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    command: npm run dev --workspace=api

  # Frontend (Next.js)
  frontend:
    build:
      context: .
      dockerfile: apps/frontend/Dockerfile.dev
    container_name: testimonial-cms-frontend
    ports:
      - "3001:3001"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1
    volumes:
      - ./apps/frontend:/app/apps/frontend
      - ./packages:/app/packages
      - /app/node_modules
    depends_on:
      - api
    command: npm run dev --workspace=frontend

volumes:
  postgres_data:
  redis_data:
```

**Construir e iniciar con Docker**:
```bash
# Construir imágenes
docker compose build

# Iniciar todos los servicios
docker compose up -d

# Ver estado de servicios
docker compose ps

# Ver logs del backend
docker compose logs -f api

# Acceder a la shell del contenedor de backend
docker compose exec api sh

# Detener servicios
docker compose down

# Eliminar volúmenes (¡CUIDADO! Borra datos)
docker compose down -v
```

### Configuración IDE

#### VS Code (Recomendado)

**Archivo `.vscode/settings.json`**:
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.autoSave": "onFocusChange",
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "tailwindCSS.includeLanguages": {
    "typescript": "javascript",
    "typescriptreact": "javascript"
  },
  "path-intellisense.mappings": {
    "@/*": "${workspaceFolder}/apps/frontend/src/*"
  },
  "git.confirmSync": false,
  "git.autofetch": true
}
```

**Extensiones recomendadas** (`.vscode/extensions.json`):
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "bradlc.vscode-tailwindcss",
    "prisma.prisma",
    "ms-azuretools.vscode-docker",
    "ms-vscode-remote.remote-containers",
    "eamodio.gitlens",
    "christian-kohler.path-intellisense",
    "formulahendry.auto-close-tag",
    "formulahendry.auto-rename-tag",
    "dsznajder.es7-react-js-snippets",
    "vitest.explorer"
  ]
}
```

#### WebStorm / IntelliJ IDEA

1. **Configurar Prettier**:
   - Settings → Languages & Frameworks → JavaScript → Prettier
   - Marcar "On save"
   - Ruta: `node_modules/prettier`

2. **Configurar ESLint**:
   - Settings → Languages & Frameworks → JavaScript → Code Quality Tools → ESLint
   - Marcar "Automatic ESLint configuration"
   - Ruta: `node_modules/eslint`

3. **Configurar TypeScript**:
   - Settings → Languages & Frameworks → TypeScript
   - Marcar "Use TypeScript Service"
   - Ruta: `node_modules/typescript`

### Herramientas de Desarrollo

#### Scripts Útiles (definidos en package.json raíz)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev:api\" \"npm run dev:frontend\"",
    "dev:api": "npm run dev --workspace=api",
    "dev:frontend": "npm run dev --workspace=frontend",
    
    "build": "npm run build:api && npm run build:frontend",
    "build:api": "npm run build --workspace=api",
    "build:frontend": "npm run build --workspace=frontend",
    
    "start": "node apps/api/dist/main.js",
    
    "db:migrate": "prisma migrate dev",
    "db:push": "prisma db push",
    "db:studio": "prisma studio",
    "db:seed": "tsx packages/scripts/seed.ts",
    "db:reset": "npm run db:migrate:reset && npm run db:seed",
    "db:test-connection": "tsx packages/scripts/test-db-connection.ts",
    
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,css,md}\"",
    "type-check": "tsc --noEmit",
    
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:health": "tsx scripts/health-check.ts",
    
    "docker:up": "docker compose up -d",
    "docker:down": "docker compose down",
    "docker:logs": "docker compose logs -f",
    "docker:shell:api": "docker compose exec api sh",
    
    "prepare": "husky install"
  }
}
```

#### Alias de Shell Recomendados

Agrega esto a tu `~/.bashrc`, `~/.zshrc` o `~/.profile`:

```bash
# Alias para Testimonial CMS
alias tcd='cd ~/projects/testimonial-cms'  # Cambia ruta según tu setup
alias tdev='npm run dev'
alias tbuild='npm run build'
alias ttest='npm test'
alias tlint='npm run lint'
alias tdb='npm run db:studio'
alias tdocker='docker compose'
alias tlogs='docker compose logs -f api'
alias tshell='docker compose exec api sh'

# Alias para git
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gpl='git pull'
alias gb='git branch'
alias gco='git checkout'
```

Luego ejecuta:
```bash
source ~/.bashrc  # o ~/.zshrc
```

---

## Ejecución del Proyecto

### Modos de Ejecución

| Modo | Comando | Propósito | Puertos |
|------|---------|-----------|---------|
| **Desarrollo** | `npm run dev` | Hot reload, source maps | API:3000, Frontend:3001 |
| **Producción** | `npm start` (después de build) | Ejecutar versión compilada | API:3000 |
| **Testing** | `npm test` | Ejecutar tests | N/A |
| **Build** | `npm run build` | Compilar para producción | N/A |
| **Docker** | `docker compose up` | Entorno aislado | API:3000, Frontend:3001, DB:5432, Redis:6379 |

### Acceso a Servicios

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| **Frontend** | http://localhost:3001 | Usuarios del seed |
| **API Docs** | http://localhost:3000/api/docs | N/A |
| **Backend** | http://localhost:3000 | Solo API |
| **Prisma Studio** | Ejecutar `npm run db:studio` | N/A |
| **PostgreSQL** | localhost:5432 | postgres/postgres |
| **Redis** | localhost:6379 | Sin contraseña |

### Flujo de Trabajo Típico

```bash
# 1. Iniciar servicios (primera vez o después de cambios)
docker compose up -d

# 2. Verificar que todo está funcionando
npm run test:health

# 3. Desarrollar (cambios se reflejan automáticamente)
# Edita archivos en apps/api/ o apps/frontend/ - los servidores se recargan

# 4. Ejecutar tests específicos durante desarrollo
npm run test:watch -- tests/unit/services/scoring.service.spec.ts

# 5. Formatear y lintear antes de commit
npm run format
npm run lint:fix

# 6. Commit con mensaje convencional
git add .
git commit -m "feat(api): add endpoint to moderate testimonials"
git push origin feat/123-add-moderation
```

---

## Ejecución de Tests

### Estructura de Tests

```
tests/
├── unit/                    # Tests unitarios
│   ├── api/
│   ├── services/
│   └── utils/
├── integration/             # Tests de integración
│   ├── api/
│   ├── database/
│   └── webhooks/
├── e2e/                     # Tests end-to-end (Playwright)
│   ├── dashboard/
│   └── embed/
└── fixtures/                # Datos de prueba
    ├── testimonials.json
    ├── tenants.json
    └── users.json
```

### Comandos de Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests en modo watch (durante desarrollo)
npm run test:watch

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar solo tests unitarios
npm run test:unit

# Ejecutar solo tests de integración
npm run test:integration

# Ejecutar solo tests E2E
npm run test:e2e

# Ejecutar tests específicos por nombre
npm test -- -t "should create a testimonial"

# Ejecutar tests en un archivo específico
npm test tests/unit/services/scoring.service.spec.ts

# Abrir UI de Vitest
npx vitest --ui
```

### Ejemplo de Test de Salud

```typescript
// scripts/health-check.ts
import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { createClient } from 'redis';

async function checkHealth() {
  console.log('🔍 Verificando salud del sistema...\n');

  // Verificar API
  try {
    const response = await axios.get('http://localhost:3000/api/v1/health', { timeout: 5000 });
    if (response.data.status === 'ok') {
      console.log('✅ API: OK');
      console.log(`   Timestamp: ${response.data.timestamp}\n`);
    } else {
      console.log('❌ API: Respuesta inesperada\n');
      process.exit(1);
    }
  } catch (error) {
    console.log('❌ API: No responde\n');
    process.exit(1);
  }

  // Verificar Base de Datos
  try {
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Base de Datos: OK\n');
    await prisma.$disconnect();
  } catch (error) {
    console.log('❌ Base de Datos: No conecta\n');
    process.exit(1);
  }

  // Verificar Redis
  try {
    const redis = createClient({ url: 'redis://localhost:6379' });
    await redis.connect();
    await redis.ping();
    console.log('✅ Redis: OK\n');
    await redis.quit();
  } catch (error) {
    console.log('❌ Redis: No conecta\n');
    process.exit(1);
  }

  console.log('🎉 ¡Todos los servicios están saludables!\n');
  console.log('Accede a la aplicación en http://localhost:3001');
  console.log('Documentación de API en http://localhost:3000/api/docs\n');
}

checkHealth().catch(console.error);
```

---

## Solución de Problemas Comunes

### Problema 1: "Port 3000 already in use"

**Síntomas**:
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solución**:
```bash
# En macOS/Linux
lsof -ti:3000 | xargs kill -9

# En Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force

# O cambiar el puerto en .env
PORT=3002
```

### Problema 2: "Database connection failed"

**Síntomas**:
```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solución**:
```bash
# Verificar si PostgreSQL está corriendo
# macOS (con brew)
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql

# Windows (Services.msc)
# Verificar en servicios

# Si no está corriendo, iniciarlo
# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql
```

### Problema 3: "npm install fails with permission errors"

**Síntomas**:
```
npm ERR! Error: EACCES: permission denied, mkdir '/usr/local/lib/node_modules'
```

**Solución**:
```bash
# Opción 1: Usar nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# Opción 2: Configurar npm para usar directorio local
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
# Agregar a ~/.bashrc: export PATH=~/.npm-global/bin:$PATH
source ~/.bashrc
```

### Problema 4: "Docker compose up fails with permission denied"

**Síntomas**:
```
Got permission denied while trying to connect to the Docker daemon socket
```

**Solución**:
```bash
# Agregar tu usuario al grupo docker
sudo usermod -aG docker $USER

# Aplicar cambios (requiere logout/login o reinicio)
newgrp docker

# Verificar
docker ps
```

### Problema 5: "Module not found" después de clonar

**Síntomas**:
```
Error: Cannot find module 'express' or its corresponding type declarations
```

**Solución**:
```bash
# Eliminar node_modules y reinstalar
rm -rf node_modules package-lock.json apps/*/node_modules
npm install

# Si persiste, reinstalar globalmente
npm install -g typescript @prisma/cli
```

### Problema 6: "Prisma migrate fails with authentication error"

**Síntomas**:
```
Error: P1001: Can't reach database server at `localhost:5432`
```

**Solución**:
```bash
# Verificar que DATABASE_URL en .env es correcto
# Asegurar que el usuario/contraseña coinciden con los de PostgreSQL

# Si usas Docker, espera a que el contenedor esté listo
sleep 10
# O usa docker compose logs postgres para ver errores
```

### Problema 7: "Cloudinary upload fails"

**Síntomas**:
```
Error: Cloudinary upload failed: Missing required parameter - file
```

**Solución**:
```bash
# Verificar que las variables CLOUDINARY_* están configuradas en .env
# Asegurar que el archivo de prueba existe y tiene permisos de lectura
```

---

## Recursos Adicionales

### Documentación del Proyecto

| Documento | Descripción | Enlace |
|-----------|-------------|--------|
| **README** | Información general | [./README.md](./README.md) |
| **CONTRIBUTING** | Guía para contribuir | [./CONTRIBUTING.md](./CONTRIBUTING.md) |
| **CODING_STANDARDS** | Estándares de código | [./CODING_STANDARDS.md](./CODING_STANDARDS.md) |
| **GIT_WORKFLOW** | Flujo de trabajo de Git | [./GIT_WORKFLOW.md](./GIT_WORKFLOW.md) |
| **ARCHITECTURE** | Arquitectura técnica | [../technical/architecture.md](../technical/architecture.md) |
| **API_DOCS** | Documentación de API | http://localhost:3000/api/docs |

### Herramientas Externas

| Herramienta | Propósito | Enlace |
|-------------|-----------|--------|
| **Prisma Docs** | ORM y migraciones | https://www.prisma.io/docs |
| **NestJS Docs** | Framework backend | https://docs.nestjs.com |
| **Next.js Docs** | Framework frontend | https://nextjs.org/docs |
| **Tailwind CSS** | Framework de estilos | https://tailwindcss.com/docs |
| **Vitest** | Testing unitario | https://vitest.dev |
| **Playwright** | Testing E2E | https://playwright.dev |

---

## Checklist de Verificación

Antes de considerar tu entorno configurado, verifica:

### ✅ Prerrequisitos
- [ ] Git instalado y configurado (`git config --global user.name`)
- [ ] Node.js v20+ instalado (`node -v`)
- [ ] Docker y Docker Compose instalados (`docker --version`)
- [ ] Espacio en disco suficiente (> 5 GB libre)

### ✅ Configuración del Proyecto
- [ ] Repositorio clonado correctamente
- [ ] Dependencias instaladas sin errores (`npm install`)
- [ ] Archivos `.env` creados y configurados
- [ ] JWT_SECRET generado y configurado
- [ ] Credenciales de Cloudinary configuradas

### ✅ Base de Datos
- [ ] PostgreSQL corriendo y accesible
- [ ] Base de datos creada (`testimonial_cms_dev`)
- [ ] Migraciones ejecutadas sin errores
- [ ] Seed ejecutado (`npm run db:seed`)
- [ ] Conexión verificada (`npm run db:test-connection`)

### ✅ Servicios
- [ ] Backend inicia sin errores (`npm run dev:api`)
- [ ] Frontend inicia sin errores (`npm run dev:frontend`)
- [ ] API responde en http://localhost:3000/api/v1/health
- [ ] Frontend accesible en http://localhost:3001
- [ ] Redis corriendo y accesible
- [ ] Docker containers saludables (`docker compose ps`)

### ✅ Tests y Calidad
- [ ] Tests de salud pasan (`npm run test:health`)
- [ ] Tests unitarios pasan (`npm test`)
- [ ] Linting sin errores (`npm run lint`)
- [ ] Formateo aplicado (`npm run format`)

### ✅ Desarrollo
- [ ] Cambios en código se reflejan automáticamente
- [ ] IDE configurado con extensiones recomendadas
- [ ] Alias de shell configurados (opcional)

---

## 🎉 ¡Felicidades!

Si has completado todos los pasos y verificaciones, ¡tu entorno de desarrollo para **Testimonial CMS** está listo!

**Próximos pasos**:
1. Revisa la [Guía para Contribuir](./CONTRIBUTING.md)
2. Explora los [issues abiertos](https://github.com/tu-organizacion/testimonial-cms/issues)
3. ¡Empieza a codear! 🚀

**Necesitas ayuda?**
- Revisa la sección [Solución de Problemas](#solución-de-problemas-comunes)
- Únete a nuestro [Discord](https://discord.gg/tu-servidor)
- Abre un [issue](https://github.com/tu-organizacion/testimonial-cms/issues/new)

---

> **Nota final**: Esta guía se actualiza regularmente. Si encuentras errores o tienes sugerencias para mejorarla, ¡por favor abre un issue o PR! La mejor documentación es la que evoluciona con el proyecto y su comunidad.