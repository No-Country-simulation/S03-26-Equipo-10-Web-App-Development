---
name: docker-container-engineering
description: >-
  Diseño, construcción, securización, optimización y operación profesional de contenedores de producción con Docker y OCI (código SKL-DEVOPS-DKR-001). Usar cuando se requiera crear Dockerfiles multi-stage para Node.js 24 LTS (NestJS 11 y Next.js 15 standalone), gobernar BuildKit y cache mounts en monorepos npm workspaces, implementar seguridad non-root y read-only filesystem, diseñar redes aisladas y volúmenes en Docker Compose, configurar health checks deterministas, orquestar graceful shutdown y asegurar la cadena de suministro de imágenes (SBOM, vulnerability scanning con Trivy).
---

# Especificación Técnica de Habilidad: Senior Docker, Containerization & Production Architecture

---

**Código de Skill:** SKL-DEVOPS-DKR-001  
**Nombre:** Senior Docker, Containerization & Production Architecture  
**Versión:** 1.0.0  
**Nivel:** Senior / Staff / DevOps / Platform Engineering  
**Dominio:** DevOps / Platform Engineering / Backend / Cloud / Infraestructura  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD / Open Container Initiative (OCI) / Twelve-Factor App / CIS Docker Benchmark  
**Ecosistema del proyecto:** Monorepo `@testimonial-cms` (`apps/api` en NestJS 11 + Prisma 6.5+, `apps/web` en Next.js 15 App Router standalone, PostgreSQL 18, Redis 7, BullMQ, Nginx en `infra/nginx`, Docker Engine + BuildKit + Docker Compose).

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Docker, Containerización y Arquitectura de Contenedores de Producción. |
| **Objetivo de Dominio** | Diseñar, construir, securizar, ejecutar, distribuir y operar aplicaciones contenerizadas mediante Docker, aplicando principios de inmutabilidad, mínimo privilegio, reproducibilidad, aislamiento, observabilidad y eficiencia operativa. |
| **Tipo de Proyecto** | DevOps / Platform Engineering / Backend SaaS / Cloud / Infraestructura de Microservicios y Monolitos Modulares. |
| **Complejidad** | Alta / Production Engineering. |
| **Paradigma Operativo** | Infrastructure as Code (IaC) / Immutable Infrastructure / OCI Compliant Containers. |
| **Ámbito de Ejecución** | Desarrollo local, CI/CD pipelines, entornos de QA, Staging y Producción. |
| **Tecnología Principal** | Docker Engine 26+ / Docker BuildKit / Docker Compose v2. |
| **Compatibilidad Conceptual** | OCI Containers / Kubernetes (K8s) / AWS ECS / Nomad / Docker Swarm. |
| **Prioridad** | Inmutabilidad → Seguridad (Non-root) → Reproducibilidad → Aislamiento → Observabilidad → Eficiencia (Cache). |

---

## 2. Descripción y Filosofía de Diseño

El skill se enfoca en el diseño y operación profesional de infraestructura basada en contenedores mediante Docker, tratando al contenedor como una **unidad de despliegue inmutable, reproducible, efímera y aislada**.

Docker no debe utilizarse únicamente como un mecanismo superficial para «hacer que la aplicación corra dentro de un contenedor». El objetivo es construir un artefacto desplegable que pueda promocionarse entre desarrollo, integración, staging y producción sin modificar un solo bit de su contenido:

```text
Código fuente (Git Commit)
     │
     ▼
Docker Build (BuildKit)
     │
     ▼
Imagen versionada (Digest OCI inmutable)
     │
     ├──► Development  (compose.override.yaml)
     ├──► QA           (compose.qa.yaml)
     ├──► Staging      (staging registry digest)
     └──► Production   (production environment + secrets)
```

La configuración específica del entorno debe permanecer rigurosamente fuera de la imagen.

### Principios Rectores:
- **Inmutabilidad**: Una imagen desplegada no debe modificarse manualmente; cualquier cambio exige un nuevo commit y una nueva imagen.
- **Reproducibilidad**: El mismo commit y configuración de build deben producir artefactos equivalentes en cualquier máquina o runner de CI.
- **Mínimo privilegio**: Los procesos deben ejecutarse sin privilegios root (`USER node` o usuario dedicado sin login).
- **Separación Build / Runtime**: Compiladores, SDKs, TypeScript y herramientas de desarrollo no deben llegar a la imagen final de producción.
- **Ephemeral First**: El contenedor debe poder destruirse y reemplazarse en cualquier instante sin pérdida de datos persistentes ni caída de servicio.
- **Externalización del estado**: Bases de datos (PostgreSQL 18), colas (Redis 7) y uploads de medios (Cloudinary) residen fuera de la capa escribible del contenedor.
- **Configuración externa**: Variables de entorno, secretos y tokens se inyectan en runtime mediante el orquestador o Docker Secrets.
- **Observabilidad**: Logs directos hacia `stdout`/`stderr`, métricas accesibles y health checks deterministas.
- **Aislamiento**: Redes segmentadas internamente sin exposición innecesaria de puertos de infraestructura al exterior.

---

### 2.1. Arquitectura de una Imagen Profesional Multi-Stage

Una imagen de producción debe tratarse como un artefacto de software compilado. Su estructura conceptual sigue el patrón:

```text
Source Code + Lockfiles
           │
           ▼
┌──────────────────────────────────────┐
│       Development / Base Stage       │
│      Node.js 24 LTS + Alpine/Slim    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│          Dependencies Stage          │
│       npm ci (BuildKit Cache)        │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│           Build / Test Stage         │
│ prisma generate + nest/next build    │
└──────────────────┬───────────────────┘
                   │
                   ▼
┌──────────────────────────────────────┐
│          Runtime Runner Stage        │
│   Non-root user + artefacto mínimo   │
└──────────────────────────────────────┘
```

La imagen final nunca contiene TypeScript, linters ni `devDependencies`.

---

### 2.2. Inmutabilidad y Reproducibilidad: "Build Once, Deploy Many"

No deben compilarse imágenes independientes para desarrollo, testing y producción. La variabilidad entre entornos se gestiona mediante:
```text
Environment Variables
Secrets
Configs
Volumes
Networking
Resource Limits
Feature Flags
```

El identificador operativo debe ser trazable de extremo a extremo:
```text
Git Commit SHA → CI Build ID → Image Tag → Image Digest (sha256:...) → Registry → Despliegue
```

---

### 2.3. Seguridad por Capas (*Defense in Depth*)

Docker no constituye por sí mismo una frontera de seguridad absoluta. La estrategia debe implementar defensa en profundidad:

```text
Host Security (OS endurecido, Kernel actualizado)
      │
      ▼
Docker Daemon (Rootless mode cuando aplique)
      │
      ▼
Namespaces / Cgroups (Aislamiento de PID, red, memoria y CPU)
      │
      ▼
Seccomp / AppArmor / SELinux (Filtrado de syscalls peligrosas)
      │
      ▼
Linux Capabilities (cap_drop: [ALL], sin CAP_SYS_ADMIN)
      │
      ▼
Container User (UID/GID != 0, usuario sin shell de login)
      │
      ▼
Filesystem (read_only: true, tmpfs para /tmp y /run)
      │
      ▼
Application Runtime (Node.js 24 LTS con dependencias auditadas)
```

---

### 2.4. Observabilidad y Resiliencia Efímera

Un contenedor debe considerarse 100% descartable. La resiliencia no se obtiene evitando que muera, sino permitiendo que la plataforma detecte fallos y lo sustituya instantáneamente:
```text
healthcheck determinista
restart: unless-stopped
graceful shutdown con propagación de SIGTERM
límites de memoria y CPU
rotación automática de logs
timeouts en dependencias remotas
```

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)

- **[RF-01] Dockerfile Declarativo y Reproducible**: Construir Dockerfiles declarativos que puedan compilarse limpiamente desde un clon fresco del repositorio.
- **[RF-02] Multi-Stage Build Riguroso**: Separar dependencias de build, generación de artefactos (Prisma/NestJS/Next.js) y runtime mínimo de producción.
- **[RF-03] Contexto de Build Optimizado (.dockerignore)**: Implementar `.dockerignore` excluyendo `.git`, `node_modules` locales, `.env`, logs y temporales.
- **[RF-04] Aprovechamiento de Build Cache**: Estructurar capas de modo que `package.json` y `package-lock.json` se copien e instalen antes del código fuente.
- **[RF-05] Ejecución No-Root Obligatoria**: La aplicación DEBE ejecutarse con el usuario `node` (UID 1000) o un usuario del sistema sin privilegios.
- **[RF-06] Inyección Externa de Configuración**: La configuración de entorno debe inyectarse en runtime sin quedar grabada en capas de la imagen.
- **[RF-07] Cero Secretos en Artefactos**: Ningún token, API key ni contraseña de base de datos debe incluirse en instrucciones `ARG`, `ENV` ni commits.
- **[RF-08] Persistencia Externalizada**: Datos persistentes (PostgreSQL, Redis, uploads) DEBEN residir en Named Volumes administrados o storage externo.
- **[RF-09] Redes Bridge de Usuario**: Los servicios deben comunicarse exclusivamente mediante redes Docker definidas con driver bridge.
- **[RF-10] Service Discovery por DNS**: Los servicios deben comunicarse mediante nombres de host internos (ej. `postgres:5432`, `redis:6379`) y nunca por IPs fijas.
- **[RF-11] Definición Declarativa en Docker Compose**: Infraestructura local y de despliegue modelada en archivos `compose.yaml` versionados.
- **[RF-12] Health Checks Deterministas**: Exponer y verificar endpoints de salud reales (`/health`, `pg_isready`, `redis-cli ping`).
- **[RF-13] Gobierno de Recursos (CPU / RAM)**: Definir límites estrictos de CPU, memoria y PIDs en Compose o Kubernetes para prevenir agotamiento del host.
- **[RF-14] Logging Hacia Streams Estándar**: Emitir logs estructurados exclusivamente a `stdout` y `stderr`.
- **[RF-15] Rotación de Logs**: Configurar directivas de rotación de logs en el daemon o en Compose (`max-size: "50m"`, `max-file: "3"`).
- **[RF-16] Escaneo Automatizado de Vulnerabilidades**: Analizar imágenes con herramientas estáticas (Trivy, Docker Scout) en CI antes de publicar.
- **[RF-17] Publicación en Container Registry**: Distribuir artefactos validados en registros OCI (GHCR, Docker Hub, ECR).
- **[RF-18] Trazabilidad OCI**: Etiquetar artefactos con versión semántica, SHA de Git y registrar su Digest SHA-256 inmutable.
- **[RF-19] Pipeline Automatizado**: Automatizar lint, test, build, scan y push dentro de GitHub Actions.
- **[RF-20] Graceful Shutdown y Manejo de Señales**: Configurar la forma exec en `CMD` para recibir `SIGTERM` y drenar conexiones de Prisma y Redis.

### 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad de Privilegios**: Cero procesos de aplicación ejecutados con UID 0 en entornos de producción.
- **[RNF-02] Inmutabilidad Estricta**: Las imágenes de producción no se modifican ni se accede a ellas interactivamente para instalar dependencias.
- **[RNF-03] Reproducibilidad Determinista**: `package-lock.json` bloqueado y uso mandatorio de `npm ci`.
- **[RNF-04] Portabilidad Multi-Entorno**: El mismo contenedor corre sin alteraciones en cualquier host Linux/AMD64 o ARM64 compatible.
- **[RNF-05] Trazabilidad Completa**: Todo contenedor en ejecución puede rastrearse inequívocamente al commit de origen y ejecución de CI.
- **[RNF-06] Aislamiento de Red**: La base de datos y la cola no deben exponer puertos hacia la red pública del host en producción.
- **[RNF-07] Eficiencia de Build**: Tiempos de construcción incrementales mínimos mediante BuildKit y montajes de caché (`--mount=type=cache`).
- **[RNF-08] Mantenibilidad IaC**: Toda la infraestructura de contenedores reside declarativamente en el repositorio.
- **[RNF-09] Diagnóstico Externo**: Monitoreo y diagnóstico mediante `docker compose ps`, `logs`, `inspect` y `stats` sin alterar el contenedor.
- **[RNF-10] Tolerancia a Fallos**: La recreación forzada de un contenedor no destruye el estado de negocio ni requiere intervención manual.
- **[RNF-11] Auditoría de Cadena de Suministro**: Generación de SBOM (*Software Bill of Materials*) para verificar paquetes y licencias.
- **[RNF-12] Prohibición de Tags Ambiguos**: Producción jamás despliega referencias mutables como `:latest` sin fijar el Digest OCI.

---

## 4. Criterios de Aceptación — Definition of Done (DoD)

1. **Construcción**: `docker build` finaliza exitosamente desde un clon limpio sin warnings críticos ni dependencias de host.
2. **Reproducibilidad**: Se reconstruye con idéntico hash utilizando sólo el repo, lockfile y Dockerfile.
3. **Seguridad**:
   - `docker run --rm IMAGE id` retorna `uid=1000(node)` (distinto de 0).
   - Cero secretos encontrados en layers (`docker history IMAGE`).
   - Sin flag `--privileged` ni capabilities innecesarias (`cap_drop: [ALL]`).
   - Filesystem principal `read_only: true` con `tmpfs` para carpetas temporales.
4. **Aislamiento**: Redes separadas en Compose; PostgreSQL 18 y Redis 7 residen en `internal: true` sin mapping de puertos en producción.
5. **Persistencia**: Destruir contenedores con `docker compose down` y levantarlos con `up -d` preserva el 100% de los datos de PostgreSQL y Redis.
6. **Observabilidad**: Health check responde `healthy` en `docker compose ps`; logs JSON legibles en `docker compose logs`.
7. **Automatización**: Pipeline de CI ejecuta validación, escaneo Trivy y publica imagen firmada al registro.
8. **Operación**: Despliegue reproducible con `docker compose up -d` y parada limpia con `docker compose down`.

---

## 5. Ecosistema de Herramientas (Stack OCI)

| Categoría | Herramientas Estándar | Rol en Testimonial CMS |
| :--- | :--- | :--- |
| **Container Runtime** | Docker Engine 26+ / containerd | Ejecución local y servidores de despliegue. |
| **Build Engine** | Docker BuildKit / Buildx | Compilación multi-stage, cache mounts y multi-arch. |
| **Definición de Imagen** | Dockerfile con sintaxis `# syntax=docker/dockerfile:1` | Definición de `api.Dockerfile` y `web.Dockerfile`. |
| **Orquestación Local** | Docker Compose v2 (`compose.yaml`) | Levantado integral de NestJS, Next.js, Postgres y Redis. |
| **Registro de Contenedores** | GitHub Container Registry (GHCR) | Almacenamiento y versionado de imágenes inmutables. |
| **Vulnerability Scanning** | Trivy / Docker Scout / Grype | Auditoría de CVEs en dependencias del SO y Node. |
| **Reverse Proxy** | Nginx / Traefik | Terminación TLS, rate limiting y ruteo a Next.js y API. |
| **Métricas y Monitoreo** | cAdvisor / Prometheus / Grafana | Monitoreo de memoria, CPU y reinicios de contenedores. |
| **Agregación de Logs** | Docker local logging driver / Loki / Promtail | Rotación y centralización de logs sin saturar disco. |
| **Supply Chain Security** | Syft (SBOM) / Cosign (Firma OCI) | Trazabilidad y verificación de procedencia criptográfica. |

---

## 6. Metodología de Práctica en 35 Fases

```text
[Fase 01: Análisis de la Aplicación] ──► [Fase 02: .dockerignore] ──► [Fase 03: Multi-stage Dockerfile]
                     │
                     ▼
[Fase 04: Selección Imagen Base] ──► [Fase 05: Optimización Cache] ──► [Fase 06: Secretos en Build]
                     │
                     ▼
[Fase 07: Usuario No-Root] ──► [Fase 08: Read-Only Filesystem] ──► [Fase 09: Reducción Capabilities]
                     │
                     ▼
[Fase 10: No-New-Privileges] ──► [Fase 11: Redes DNS Internas] ──► [Fase 12: Red Pública vs Privada]
                     │
                     ▼
[Fase 13: Gestión de Puertos] ──► [Fase 14: Reverse Proxy Nginx] ──► [Fase 15: Volúmenes Persistentes]
                     │
                     ▼
[Fase 16: Externalizar Estado] ──► [Fase 17: Variables de Entorno] ──► [Fase 18: Docker Secrets]
                     │
                     ▼
[Fase 19: Docker Compose Base] ──► [Fase 20: Separación Entornos] ──► [Fase 21: Perfiles Auxiliares]
                     │
                     ▼
[Fase 22: Dev vs Prod Parity] ──► [Fase 23: Health Checks] ──► [Fase 24: Límites de Recursos]
                     │
                     ▼
[Fase 25: Graceful Shutdown] ──► [Fase 26: Logging a stdout] ──► [Fase 27: Métricas de Contenedor]
                     │
                     ▼
[Fase 28: Escaneo Trivy] ──► [Fase 29: SBOM y Supply Chain] ──► [Fase 30: Versionado Semántico & Digest]
                     │
                     ▼
[Fase 31: Registry GHCR] ──► [Fase 32: Pipeline CI/CD] ──► [Fase 33: Multi-Arch Buildx]
                     │
                     ▼
[Fase 34: Validación Estática] ──► [Fase 35: Pruebas de Resiliencia y Caos]
```

### Fase 1: Analizar la Aplicación Antes de Contenerizar
Mapear dependencias del monorepo: Node.js 24 LTS, dependencias nativas de Prisma (OpenSSL), puertos (NestJS: 4000, Next.js: 3000, PostgreSQL: 5432, Redis: 6379), rutas persistentes y variables requeridas.

### Fase 2: Configurar `.dockerignore` Óptimo
Evitar transferir archivos innecesarios al contexto del daemon:
```dockerignore
.git
.github
node_modules
apps/*/node_modules
dist
build
.next
coverage
*.log
.env
.env.*
!.env.example
tmp
.cache
```

### Fase 3: Diseñar el Dockerfile Multi-Stage Canónico

#### Dockerfile para `apps/api` (NestJS 11 + Prisma 6.5+)
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/api/prisma ./apps/api/prisma
COPY apps/api/prisma.config.ts ./apps/api/prisma.config.ts
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS builder
COPY apps/api ./apps/api
RUN npm run prisma:generate --workspace=@testimonial-cms/api
RUN npm run build --workspace=@testimonial-cms/api
RUN npm prune --production

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/apps/api/prisma ./prisma
COPY apps/api/package.json ./package.json

USER node
EXPOSE 4000
CMD ["node", "dist/main.js"]
```

#### Dockerfile para `apps/web` (Next.js 15 App Router Standalone)
```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS dependencies
COPY package.json package-lock.json tsconfig.base.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN --mount=type=cache,target=/root/.npm npm ci

FROM dependencies AS builder
COPY apps/web ./apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@testimonial-cms/web

FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
WORKDIR /app

COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

### Fase 4: Selección de Imagen Base
Utilizar `node:24-bookworm-slim` para compatibilidad binaria garantizada con OpenSSL y Prisma Engines, evitando los problemas de `musl` en Alpine.

### Fase 5: Optimizar el Build Cache
Copiar siempre los manifiestos de dependencias (`package.json`, lockfiles) antes del código fuente. Emplear `--mount=type=cache,target=/root/.npm` para acelerar builds en CI.

### Fase 6: Secretos en Build
Nunca pasar secretos en `ARG` ni `ENV`. Para acceder a registros privados de npm durante el build, usar `RUN --mount=type=secret,id=npmrc`.

### Fase 7: Usuario No-Root
Aprovechar el usuario predeterminado `USER node` provisto por la imagen oficial de Node.js.

### Fase 8: Endurecimiento de Filesystem (`read_only`)
Configurar `read_only: true` en el contenedor y montar `/tmp` y `/run` en `tmpfs` para que la aplicación escriba temporales en memoria RAM efímera.

### Fase 9: Reducción Drástica de Linux Capabilities
Configurar `cap_drop: [ALL]` en el servicio. Node.js en puertos no privilegiados (>1024) no requiere capabilities de Linux.

### Fase 10: Prevención de Escalamiento (`no-new-privileges`)
Añadir `security_opt: ["no-new-privileges:true"]` para bloquear exploits que utilicen binarios setuid.

### Fase 11: Redes Bridge de Usuario con DNS Interno
Definir redes bridge explícitas para que los servicios se resuelvan por nombre (`postgres`, `redis`, `api`).

### Fase 12: Separación de Red Pública y Red de Datos
PostgreSQL y Redis deben operar en `data_network` con directiva `internal: true`, impidiendo acceso directo desde Internet.

### Fase 13: Publicación Selectiva de Puertos
En producción, no publicar el puerto `5432` ni `6379` en el host. Sólo el proxy Nginx expone los puertos 80 y 443.

### Fase 14: Terminación TLS y Reverse Proxy con Nginx
Centralizar SSL/TLS, compresión gzip/brotli y buffers en Nginx (`infra/nginx/nginx.conf`).

### Fase 15: Persistencia con Named Volumes
Mapear datos de PostgreSQL a `postgres_data:/var/lib/postgresql/data` y Redis a `redis_data:/data`.

### Fase 16: Externalización del Estado
Garantizar que todo archivo subido por clientes (imágenes/videos) se envíe a Cloudinary o S3; nunca almacenarlos en el disco local del contenedor.

### Fase 17: Gestión de Configuración no Sensible
Definir variables generales (`NODE_ENV=production`, `PORT=4000`, `LOG_LEVEL=info`) mediante directiva `environment`.

### Fase 18: Inyección Segura de Secretos
Inyectar `DATABASE_URL`, `JWT_SECRET`, `REDIS_PASSWORD` y `CLOUDINARY_API_SECRET` mediante Docker Compose Secrets (`/run/secrets/...`) o variables inyectadas por el entorno de CI/CD.

### Fase 19: Archivo `compose.yaml` Base de Producción
Configurar el ensamble multi-servicio con dependencias saludables (`condition: service_healthy`).

### Fase 20: Separación de Entornos (`compose.override.yaml`)
- `compose.yaml`: Base canónica de servicios.
- `compose.override.yaml`: Montajes de código fuente local para desarrollo con recarga en caliente.
- `compose.prod.yaml`: Endurecimiento de seguridad y configuración productiva.

### Fase 21: Perfiles de Compose (`profiles`)
Agrupar servicios auxiliares (pgAdmin, Mailpit, herramientas de debug) bajo `profiles: [debug]`, manteniéndolos apagados en producción.

### Fase 22: Paridad Desarrollo / Producción
Alinear versiones de Node.js (24 LTS), PostgreSQL (18) y Redis (7) en local y producción para erradicar el *"en mi máquina funcionaba"*.

### Fase 23: Health Checks Deterministas
```yaml
healthcheck:
  test: ["CMD", "wget", "-qO-", "http://localhost:4000/api/v1/health"]
  interval: 15s
  timeout: 5s
  retries: 3
  start_period: 20s
```

### Fase 24: Gobierno de Recursos
Asignar `mem_limit: 512m`, `cpus: 1.0` y `pids_limit: 200` para evitar que fugas de memoria o ataques DoS colapsen el host.

### Fase 25: Graceful Shutdown y Propagación de Señales
Usar la forma exec `CMD ["node", "dist/main.js"]`. Al recibir `SIGTERM`, NestJS cierra los listeners HTTP, BullMQ pausa workers y Prisma cierra el connection pool dentro de `stop_grace_period: 30s`.

### Fase 26: Logging sin Fugas a `stdout`
Logs en formato JSON estructurado hacia `stdout`. Configurar `logging: { driver: "json-file", options: { "max-size": "50m", "max-file": "3" } }`.

### Fase 27: Métricas del Contenedor
Recolectar métricas de CPU, RAM y E/S mediante cAdvisor exportando a Prometheus y paneles de Grafana.

### Fase 28: Escaneo de Vulnerabilidades con Trivy
Ejecutar en pipeline CI:
```bash
trivy image --severity HIGH,CRITICAL --exit-code 1 testimonial-cms/api:1.0.0
```

### Fase 29: Generación de SBOM (Software Bill of Materials)
Generar el inventario de componentes con Syft: `syft testimonial-cms/api:1.0.0 -o spdx-json > sbom.json`.

### Fase 30: Versionado Semántico y Digest Inmutable
Etiquetar imágenes como `api:0.1.0` y `api:git-${GITHUB_SHA::7}`, desplegando en producción mediante el Digest OCI `@sha256:...`.

### Fase 31: Publicación en Registro Central (GHCR)
Publicar artefactos validados en `ghcr.io/no-country-simulation/testimonial-cms/api`.

### Fase 32: Pipeline CI/CD en GitHub Actions
Automatizar en `.github/workflows/docker.yml`: Checkout → Test → Buildx → Trivy Scan → Push GHCR.

### Fase 33: Build Multi-Arquitectura con Buildx
Construir para `linux/amd64` y `linux/arm64` permitiendo compatibilidad nativa en servidores cloud y Apple Silicon.

### Fase 34: Validación Estática de Configuración
Verificar sintaxis antes de desplegar con `docker compose config` y `docker inspect`.

### Fase 35: Pruebas de Resiliencia y Caos
Validar el comportamiento del sistema simulando caídas de Redis, cortes de PostgreSQL y límites de RAM excedidos.

---

## 7. Estructura Recomendada de Infraestructura en el Repositorio

```text
monorepo/
├── apps/
│   ├── api/
│   │   └── Dockerfile           # Referencia canónica de la API NestJS
│   └── web/
│       └── Dockerfile           # Referencia canónica de la Web Next.js
│
├── infra/
│   ├── docker/
│   │   ├── api.Dockerfile       # Build multi-stage optimizado
│   │   └── web.Dockerfile       # Build standalone optimizado
│   ├── nginx/
│   │   └── nginx.conf           # Reverse Proxy, SSL y Rate Limiting
│   └── monitoring/
│       └── prometheus.yml
│
├── compose.yaml                 # Definición base multi-servicio
├── compose.override.yaml        # Overrides locales para desarrollo
├── compose.prod.yaml            # Baseline endurecido de producción
├── .dockerignore                # Exclusiones de build global
└── .env.example                 # Plantilla de configuración documentada
```

---

## 8. Baseline de Seguridad para Producción (`compose.prod.yaml`)

```yaml
services:
  api:
    image: ghcr.io/no-country-simulation/testimonial-cms/api:0.1.0@sha256:7f83b...
    restart: unless-stopped
    read_only: true
    cap_drop:
      - ALL
    security_opt:
      - no-new-privileges:true
    tmpfs:
      - /tmp:rw,noexec,nosuid,size=64m
    environment:
      NODE_ENV: production
      PORT: 4000
    secrets:
      - db_password
      - jwt_secret
    networks:
      - application_net
      - data_net
    deploy:
      resources:
        limits:
          cpus: '1.0'
          memory: 512M
          pids: 200
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost:4000/api/v1/health"]
      interval: 15s
      timeout: 5s
      retries: 3
      start_period: 20s

  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    networks:
      - data_net
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: testimonial_cms
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD_FILE: /run/secrets/db_password
    secrets:
      - db_password
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d testimonial_cms"]
      interval: 10s
      timeout: 5s
      retries: 5

networks:
  application_net:
    driver: bridge
  data_net:
    driver: bridge
    internal: true

volumes:
  postgres_data:
    driver: local

secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
```

---

## 9. Catálogo de Antipatrones (DKR-01 a DKR-20)

| Código | Antipatrón | Riesgo Operativo / Vulnerabilidad | Remediación Arquitectónica |
| :--- | :--- | :--- | :--- |
| **DKR-01** | **Ejecutar procesos como root** | Escape de privilegios con impacto total sobre el kernel del host. | Añadir `USER node` en la etapa final de ejecución. |
| **DKR-02** | **Uso de `--privileged` indiscriminado** | Anula las fronteras de aislamiento y expone dispositivos del host. | Eliminar `--privileged` y agregar capacidades atómicas mínimas si hiciera falta. |
| **DKR-03** | **Secretos embebidos en Dockerfiles** | Fuga permanente de credenciales en el historial público de la imagen. | Inyectar secretos en runtime mediante variables seguras o Docker Secrets. |
| **DKR-04** | **Tokens en directivas `ARG`** | Secretos accesibles en metadatos e historial de inspección. | Utilizar `--mount=type=secret` de BuildKit para credenciales de build. |
| **DKR-05** | **Herramientas de desarrollo en runtime** | Aumento de la superficie de ataque y tamaño de imagen innecesario. | Aplicar multi-stage builds copiando sólo el `dist/` compilado. |
| **DKR-06** | **Copiar todo el código antes de `npm ci`** | Invalida el caché de capas en cada cambio menor de código. | Copiar primero `package.json` y lockfiles, ejecutar `npm ci` y luego copiar el código. |
| **DKR-07** | **Omitir `.dockerignore`** | Transferencia de gigabytes inútiles y fuga accidental de `.env` y `.git`. | Mantener `.dockerignore` exhaustivo en la raíz del monorepo. |
| **DKR-08** | **Uso de `:latest` como identidad de despliegue** | Imposibilidad de saber qué código corre y fallos impredecibles en despliegues. | Versionar con SemVer + commit SHA y fijar el Digest SHA-256 en producción. |
| **DKR-09** | **Direcciones IP fijas hardcodeadas** | Fallos de conectividad al recrearse los contenedores con nuevas IPs. | Utilizar nombres DNS automáticos provistos por las redes bridge de Docker. |
| **DKR-10** | **Publicar puertos de bases de datos al host** | Exposición de PostgreSQL y Redis a escaneos y ataques de fuerza bruta en Internet. | Remover mapeos de puertos (`ports:`) en producción y aislar en `data_net`. |
| **DKR-11** | **Persistir datos en la capa escribible del contenedor** | Pérdida definitiva de testimonios o registros al recrear el contenedor. | Montar siempre Named Volumes (`volumes:`) para datos persistentes. |
| **DKR-12** | **Bind mounts de código fuente en producción** | Ruptura de la inmutabilidad y riesgo de manipulación de archivos en vivo. | El código debe residir inmutable dentro de la imagen; bind mounts sólo en desarrollo. |
| **DKR-13** | **Imágenes compiladas por separado para cada entorno** | Pérdida de reproducibilidad: lo que se probó en QA no es lo que corre en Prod. | *Build once, deploy many*: promocionar el mismo Digest inmutable. |
| **DKR-14** | **Logs acumulados en archivos locales sin rotación** | Agotamiento del espacio en disco y caída catastrófica del servidor. | Emitir logs a `stdout` y configurar el driver `local` o `json-file` con límites estrictos. |
| **DKR-15** | **Contenedor tratado como máquina virtual** | Múltiples daemons descontrolados (SSH, cron, app) sin supervisión. | Un proceso principal por contenedor con ciclo de vida definido. |
| **DKR-16** | **Modificaciones manuales dentro del contenedor en vivo** | Pérdida de trazabilidad y reaparición del problema al reiniciar. | Modificar en Git → compilar nueva imagen en CI → desplegar nuevo contenedor. |
| **DKR-17** | **Compilación directa en el servidor de producción** | Desperdicio de CPU, fallos por falta de memoria y riesgo en producción. | Compilar y escanear en CI/CD; producción sólo descarga y ejecuta la imagen. |
| **DKR-18** | **Elegir Alpine ciegamente por menor peso** | Incompatibilidad binaria con dependencias nativas compiladas en glibc (Prisma). | Usar Debian Slim (`node:24-bookworm-slim`) para máxima estabilidad con Node.js y Prisma. |
| **DKR-19** | **Confiar en `depends_on` sin healthcheck** | La aplicación arranca antes de que la base de datos acepte conexiones y crashea. | Usar `condition: service_healthy` vinculado a un healthcheck real. |
| **DKR-20** | **Montar `/var/run/docker.sock` indiscriminadamente** | Otorga control root indirecto sobre todo el host Docker. | Prohibir el montaje del socket salvo en herramientas de monitoreo debidamente auditadas. |

---

## 10. Evaluación y KPIs de Calidad en Contenedores

| Métrica | Objetivo de Producción | Método de Verificación |
| :--- | :--- | :--- |
| **Build Reproducible desde clon limpio** | **100%** | Ejecución de `docker compose build` en runner sin caché. |
| **Procesos ejecutándose como root** | **0** | `docker compose exec api id` retorna UID != 0. |
| **Secretos expuestos en capas de imagen** | **0** | Inspección con `docker history` y escaneo con Trivy/TruffleHog. |
| **Vulnerabilidades Críticas (CVEs)** | **0** | Reporte de Trivy en pipeline de CI/CD. |
| **Puertos internos de DB expuestos al host** | **0 en Prod** | Verificación de `docker compose ps` (columna PORTS sin bindings externos). |
| **Trazabilidad de imagen hacia Git Commit** | **100%** | Etiqueta `org.opencontainers.image.revision` coincidente con SHA. |
| **Servicios con Health Check determinista** | **100%** | Estado `healthy` en todos los contenedores de `docker compose ps`. |
| **Logs sin política de rotación** | **0** | Configuración `max-size` y `max-file` verificada en daemon o compose. |
| **Recreación de contenedor sin pérdida de datos** | **100%** | Test de resiliencia: `docker compose down && docker compose up -d`. |

---

## 11. Matriz de Competencia Técnica

- **Junior**: Domina comandos básicos (`docker build`, `run`, `ps`, `logs`), mapeo de puertos y bind mounts locales de desarrollo.
- **Mid-Level**: Implementa multi-stage builds, optimiza el build cache con `.dockerignore`, ejecuta procesos como non-root, diseña redes bridge personalizadas y configura health checks en Docker Compose.
- **Senior**: Diseña estrategias de despliegue inmutable (*build once, deploy many*), endurece el runtime (`read_only`, `cap_drop`, `no-new-privileges`), gobierna recursos (CPU/RAM/PIDs), gestiona secretos mediante BuildKit y almacenes externos, implementa escaneo de vulnerabilidades y SBOM en CI/CD, y garantiza resiliencia con graceful shutdown sin pérdida de datos.

---

## 12. Checklist Senior de Revisión (30 Puntos Críticos)

```text
[ ] 1. ¿Existe un archivo .dockerignore que excluye .git, node_modules y .env?
[ ] 2. ¿El Dockerfile aprovecha eficientemente el build cache copiando package.json primero?
[ ] 3. ¿Se utiliza multi-stage build separando dependencias de compilación del runner final?
[ ] 4. ¿La imagen final contiene únicamente los archivos de runtime indispensables?
[ ] 5. ¿La imagen base utiliza una versión fijada y soportada (Node.js 24 LTS)?
[ ] 6. ¿Las dependencias se instalan estrictamente con npm ci respetando el lockfile?
[ ] 7. ¿El contenedor ejecuta su proceso con un usuario no-root (node / UID 1000)?
[ ] 8. ¿No existen secretos, contraseñas ni tokens hardcodeados en la imagen?
[ ] 9. ¿Los secretos requeridos durante el build utilizan --mount=type=secret de BuildKit?
[ ] 10. ¿El filesystem del contenedor corre en modo read-only en producción?
[ ] 11. ¿Se eliminaron todas las capabilities de Linux mediante cap_drop: [ALL]?
[ ] 12. ¿Se configuró no-new-privileges:true en los parámetros de seguridad?
[ ] 13. ¿Se evita terminantemente el flag --privileged?
[ ] 14. ¿Se evita montar /var/run/docker.sock en contenedores de aplicación?
[ ] 15. ¿Las redes están segmentadas (pública, aplicación y datos interna)?
[ ] 16. ¿Los servicios se comunican mediante nombres de host DNS y no por IPs fijas?
[ ] 17. ¿Los puertos de bases de datos y colas no están expuestos al exterior en producción?
[ ] 18. ¿La persistencia se gestiona exclusivamente mediante Named Volumes administrados?
[ ] 19. ¿Las carpetas temporales (/tmp, /run) utilizan tmpfs montado en memoria RAM?
[ ] 20. ¿Los servicios críticos exponen health checks deterministas con start_period razonable?
[ ] 21. ¿El proceso principal maneja SIGTERM y ejecuta graceful shutdown en forma exec?
[ ] 22. ¿Se definieron límites superiores de memoria, CPU y PIDs para cada servicio?
[ ] 23. ¿Todos los logs se emiten hacia stdout y stderr en formato JSON estructurado?
[ ] 24. ¿Existe una directiva explícita de rotación de logs (max-size y max-file)?
[ ] 25. ¿La imagen es escaneada automáticamente en CI/CD con Trivy antes de publicarse?
[ ] 26. ¿La imagen está identificada con tags inmutables (SemVer + Git SHA) y Digest SHA-256?
[ ] 27. ¿Existe trazabilidad bidireccional entre la imagen desplegada y el commit de Git?
[ ] 28. ¿El pipeline de CI/CD es el único responsable de compilar y publicar la imagen?
[ ] 29. ¿Se promociona el mismo artefacto inmutable entre staging y producción?
[ ] 30. ¿Toda la infraestructura puede levantarse declarativamente sin pasos manuales?
```

---

## 13. Resultado Esperado del Skill

Al aplicar **SKL-DEVOPS-DKR-001**, el monorepo de Testimonial CMS opera bajo una arquitectura de contenedores donde:
- **Las imágenes son artefactos inmutables y auditables**, construidos una sola vez y promovidos con total confianza.
- **La seguridad está garantizada por defecto**: procesos sin privilegios root, sistemas de archivos de solo lectura y bases de datos completamente aisladas de la red pública.
- **La resiliencia operativa es automática**: contenedores efímeros que se reinician sin pérdida de datos, responden a health checks y se apagan de forma limpia sin corromper transacciones.

---

## 14. Recursos Adicionales y Referencias

- **Docker Documentation**: [https://docs.docker.com/](https://docs.docker.com/)
- **Dockerfile Reference & Best Practices**: [https://docs.docker.com/develop/develop-images/dockerfile_best-practices/](https://docs.docker.com/develop/develop-images/dockerfile_best-practices/)
- **BuildKit Documentation**: [https://docs.docker.com/build/buildkit/](https://docs.docker.com/build/buildkit/)
- **Docker Compose Specification**: [https://compose-spec.io/](https://compose-spec.io/)
- **Open Container Initiative (OCI)**: [https://opencontainers.org/](https://opencontainers.org/)
- **CIS Docker Benchmark**: Recomendaciones de seguridad para endurecimiento de hosts y contenedores.
- **Trivy Vulnerability Scanner**: [https://aquasecurity.github.io/trivy/](https://aquasecurity.github.io/trivy/)

---

## 15. Regla Arquitectónica Final

> **Una implementación Docker de nivel Senior cumple la siguiente propiedad fundamental:**  
> **Cualquier contenedor puede ser destruido, reconstruido y reemplazado en cualquier instante sin alterar el estado persistente del sistema, sin requerir configuración manual interactiva y sin depender de supuestos implícitos del servidor donde se ejecuta.**

```text
Docker Senior
≠
"Saber escribir Dockerfiles"

Docker Senior
=
Build reproducible y multi-stage
+
Imagen mínima, no-root y auditable
+
Runtime endurecido (read-only, cap_drop)
+
Configuración externa e inyección segura de secretos
+
Persistencia externalizada y redes segmentadas
+
Observabilidad, health checks y graceful shutdown
+
Trazabilidad Supply-Chain (SBOM + escaneo de vulnerabilidades)
+
Despliegue automatizado e inmutable
```
