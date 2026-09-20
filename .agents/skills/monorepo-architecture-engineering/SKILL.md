---
name: monorepo-architecture-engineering
description: >-
  Diseño, construcción, gobernanza y operación profesional de repositorios monolíticos de código con múltiples aplicaciones y paquetes (código SKL-MONOREPO-ARCH-001). Usar cuando se requiera coordinar aplicaciones (NestJS, Next.js, workers), librerías compartidas (UI, contratos, validación), tooling centralizado y pipelines de CI/CD en un único repositorio sin degradar modularidad, velocidad de compilación, ownership ni capacidad de despliegue independiente, utilizando pnpm/npm workspaces, orquestadores como Turborepo o Nx, grafos de dependencias explícitos, task caching determinista, affected execution, fronteras modulares estrictas y releases con Changesets.
---

# Especificación Técnica de Habilidad: Senior Monorepo Architecture & Engineering

---

**Código de Skill:** SKL-MONOREPO-ARCH-001  
**Nombre:** Senior Monorepo Architecture & Engineering  
**Versión:** 1.0.0  
**Nivel:** Senior / Staff / Production Engineering  
**Dominio:** Software Architecture / DevEx / CI/CD / JavaScript & TypeScript / Platform Engineering  
**Estándares:** ISO/IEC 26514 / IEEE 29148 / Agile DoD / Supply-Chain Security / Reproducible Builds  
**Ecosistema del proyecto:** Monorepo `@testimonial-cms` (`apps/api` en NestJS 11 + Prisma 6.5+, `apps/web` en Next.js 15 App Router, PostgreSQL 18, Redis 7, BullMQ, Nginx, Docker Compose, npm/pnpm workspaces, Turborepo / Nx).

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, construcción, gobernanza y operación profesional de repositorios monolíticos de código con múltiples aplicaciones y paquetes. |
| **Objetivo de Dominio** | Coordinar aplicaciones, librerías, tooling y pipelines dentro de un único repositorio sin degradar modularidad, velocidad de CI, ownership ni capacidad de despliegue independiente. |
| **Tipo de Proyecto** | Frontend / Backend / Full-Stack / Microservices / Modular Monolith / Platform Engineering. |
| **Arquitectura Recomendada** | Apps + Packages + Dependency Graph explícito (Directed Acyclic Graph - DAG). |
| **Package Manager Preferido JS/TS** | `pnpm` (soporte completo para `workspace:*`, store content-addressable, catalogs y strict dependency visibility). Compatible con `npm workspaces`. |
| **Orquestador de Tareas** | Turborepo o Nx según escala, complejidad y requisitos de gobernanza de fronteras modulares. |
| **Release Management** | Changesets cuando existe versionado y publicación de paquetes internos/públicos; inmutable Git SHA / container digests para deployables privados. |
| **CI/CD** | Affected Execution + Remote Cache + Parallel Matrix + Independent Deployments. |
| **Complejidad** | Alta / Staff / Platform Engineering. |
| **Prioridad** | Correctitud → Límites → Reproducibilidad → Seguridad → CI Performance → Developer Experience → Reutilización. |

---

## 2. Descripción y Filosofía de Diseño

Un monorepo es una estrategia de gestión de código fuente definida fundamentalmente como:

```text
multiple projects
       +
one repository
```

Bajo ningún concepto debe asumirse que un monorepo implica:

```text
one application
one deployment
one database
one team
one architecture
```

Dentro del repositorio coexisten proyectos heterogéneos con ciclos de vida, requerimientos no funcionales y cadencias de entrega independientes:

```text
web applications (Next.js 15 App Router)
backend services (NestJS 11 Modular Monolith)
background workers (BullMQ processors)
CLIs & administrative tooling
shared libraries (UI design system, tokens, utilities)
domain schemas & typed contracts (DTOs, Zod, OpenAPI)
client SDKs
infrastructure as code & Docker orchestration
```

### Principio Rector

> **«Compartí código, tooling y conocimiento; no compartas ownership, acoplamiento o despliegues accidentalmente.»**

La arquitectura del monorepo promueve activamente el balance entre centralización y autonomía:

```text
       ┌────────────────────────────────────────────────────────┐
       │                       COLOCATION                       │
       │           (Único repositorio, visibilidad)             │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                STRICT MODULE BOUNDARIES                │
       │        (Exports explícitos, tags, no deep imports)      │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                  DETERMINISTIC BUILDS                  │
       │          (Mismos inputs = exactamente mismo output)    │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                    DEPENDENCY GRAPH                    │
       │              (DAG computable, sin ciclos)              │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                   AFFECTED EXECUTION                   │
       │       (Construir y probar sólo lo que realmente cambió)│
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                      CACHE REUSE                       │
       │         (Local y Remote Cache con hashing estricto)    │
       └───────────────────────────┬────────────────────────────┘
                                   │
                                   ▼
       ┌────────────────────────────────────────────────────────┐
       │                INDEPENDENT DEPLOYABILITY               │
       │       (Rollout desacoplado por aplicación o servicio)  │
       └────────────────────────────────────────────────────────┘
```

---

### 2.1. Qué Problema Resuelve y Qué Nuevos Desafíos Introduce

#### Problemas que Resuelve:
- **Refactors atómicos multiplataforma**: Modificar un contrato compartido y actualizar backend y frontend en un único commit consistente.
- **Reutilización controlada**: Consumo directo de librerías locales sin ceremonias de empaquetado y publicación a registros externos durante el ciclo de desarrollo.
- **Tooling centralizado**: Gobernanza única de linters, formateadores, tipado y configuraciones base de TypeScript.
- **Visibilidad integral**: Facilidad de auditoría de seguridad, búsqueda global de código (`grep`) y detección de patrones obsoletos.
- **Onboarding acelerado**: Un único comando de clonado e instalación para disponer del ecosistema completo.

#### Nuevos Desafíos que Introduce (y que este Skill mitiga):
- **Grafo de dependencias expansivo**: Riesgo de dependencias circulares o transitivas no intencionadas.
- **Builds redundantes y CI lento**: Riesgo de recompilar todo el repositorio ante cambios triviales de documentación o código aislado.
- **Boundary violations**: Importación indiscriminada de detalles de implementación interna entre proyectos.
- **Ownership difuso**: Pérdida de claridad sobre quién es responsable de la estabilidad de paquetes compartidos.
- **Cache correctness**: Riesgo de cache poisoning o servir artefactos obsoletos si los inputs de entorno no están correctamente declarados.
- **Mega-paquetes monolíticos**: Degeneración en librerías `utils` o `common` que acumulan acoplamiento inmanejable.

---

### 2.2. Monorepo no es una Arquitectura de Aplicación

Es un antipatrón asumir que todos los proyectos dentro del monorepo deben converger en un mismo framework, base de datos o estrategia de infraestructura. Pueden convivir armónicamente:

```text
apps/web       ──► Next.js 15 App Router (Server-First, React 19)
apps/api       ──► NestJS 11 Modular Monolith (PostgreSQL 18, Prisma ORM)
apps/worker    ──► Node.js 24 LTS + BullMQ + Redis 7
apps/admin     ──► React 19 SPA / Vite
packages/ui    ──► Radix UI Primitives + Tailwind CSS
packages/types ──► Shared Domain Schemas & DTOs
```

Cada aplicación mantiene su propia frontera de despliegue, variables de entorno y estrategia de persistencia.

---

### 2.3. Workspaces vs Orquestador

Es mandatorio comprender la separación conceptual entre el gestor de workspaces y el orquestador de tareas:

| Dimensión | Workspace Manager (`pnpm`, `npm`, `Yarn`) | Orquestador de Tareas (`Turborepo`, `Nx`) |
| :--- | :--- | :--- |
| **Responsabilidad** | Descubrimiento de paquetes, linking de dependencias locales en `node_modules`, resolución de lockfile único, aislamiento de dependencias. | Construcción del grafo de tareas (Task Graph), paralelización topológica, cálculo de proyectos afectados (`affected`), computación de hashes y caching (local y remoto). |
| **Visibilidad** | Conoce la estructura de carpetas y dependencias de `package.json`. | Conoce el orden de ejecución entre tareas (`build`, `test`, `lint`), sus entradas (`inputs`) y sus salidas (`outputs`). |
| **Frontera** | `pnpm-workspace.yaml` / `package.json#workspaces`. | `turbo.json` / `nx.json`. |

> **Regla de Oro:** Un repositorio pequeño o mediano puede operar de manera adecuada sólo con workspaces nativos; a medida que el pipeline de CI escala, la incorporación de un orquestador se vuelve indispensable para mantener tiempos constantes de ejecución.

---

### 2.4. Resiliencia, Caching y Observabilidad

1. **Task Determinism**: Toda tarea clasificada como cacheable debe ser puramente determinista:
   $$\text{Source Code} + \text{Dependencies Hash} + \text{Declared Environment Inputs} = \text{Deterministic Output Artifact}$$
2. **Cache Correctness**: El cálculo del hash de cache debe contemplar rigurosamente el código fuente, lockfile, flags de compilación, variables de entorno públicas y los artefactos de salida producidos por dependencias previas en el DAG.
3. **Remote Cache Trust Model**: El cache remoto es infraestructura de compilación compartida. Debe asegurarse mediante roles de lectura/escritura:
   - Ramas protegidas en CI (`main`, `staging`): Acceso Read/Write autenticado mediante token seguro.
   - Pull Requests provenientes de forks no confiables: Acceso Read-Only estricto para mitigar ataques de cache poisoning.
   - Entorno de desarrollo local: Configuración Read-Only por defecto o acceso controlado por SSO/token corporativo.
   - **Prohibición de Secretos**: Ningún secreto, token de base de datos o certificado de producción debe incorporarse jamás a los artefactos cacheados.
4. **Métricas de Rendimiento del Monorepo**: Monitoreo proactivo de:
   - Duración total de CI (p50, p95).
   - Tasa de acierto de cache (*Cache Hit Ratio* > 70%).
   - Duración de compilación en frío (*cold build*) vs en caliente (*cached build*).
   - Número de proyectos afectados por Pull Request típico.
   - Tasa de tests inestables (*flaky tests*) en el pipeline.

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales

- **[RF-01] Declaración Explícita de Workspaces:** El repositorio MUST declarar de forma inequívoca qué rutas forman parte del espacio de trabajo en la raíz (ej. `workspaces: ["apps/*", "packages/*", "tooling/*"]` o `pnpm-workspace.yaml`).
- **[RF-02] Segregación Apps vs Packages:** Separar taxativamente ejecutables y artefactos desplegables (`apps/`) de librerías y componentes reutilizables (`packages/`) y herramientas internas de repositorio (`tooling/`).
- **[RF-03] Grafo de Dependencias Explícito:** Toda dependencia entre proyectos MUST estar formalmente declarada en los archivos `package.json` correspondientes. Prohibido depender de dependencias transitivas derivadas del hoisting.
- **[RF-04] Protocolo de Dependencia Interna:** En entornos `pnpm`, utilizar el protocolo `workspace:*` (o versiones específicas de workspace) para garantizar la resolución inequívoca de paquetes locales.
- **[RF-05] Vocabulario Homogéneo de Tareas:** Todos los proyectos que componen el monorepo SHOULD implementar una convención unificada de scripts en `package.json`: `dev`, `build`, `test`, `lint`, `typecheck`, `clean`.
- **[RF-06] Ejecución Afectada (Affected Execution):** Los flujos de integración continua SHOULD determinar mediante análisis del historial de Git y del DAG qué proyectos específicos y dependientes directos han sido impactados por un cambio.
- **[RF-07] Task Caching Determinista:** Las tareas computacionalmente intensivas (`build`, `test`, `lint`, `typecheck`) MUST declarar explícitamente sus `inputs` (archivos fuente, variables de entorno) y sus `outputs` (directorios `dist/`, `.next/`, reportes de cobertura) para habilitar almacenamiento seguro en cache.
- **[RF-08] Despliegues Independientes (Independent Deployability):** Cada aplicación desplegable (`apps/api`, `apps/web`) MUST poseer la capacidad de construirse, empaquetarse en contenedor Docker y desplegarse sin requerir la compilación o despliegue forzoso del resto de las aplicaciones.
- **[RF-09] Gobierno de Fronteras Modulares (Boundary Enforcement):** La arquitectura MUST prevenir y rechazar mediante reglas automatizadas (ESLint, Nx tags o dependency-cruiser) importaciones prohibidas entre aplicaciones o hacia archivos privados de paquetes compartidos.
- **[RF-10] Gestión Aislada de Variables de Entorno:** Cada aplicación deployable MUST poseer su propio archivo `.env.example` y validar sus variables de entorno requeridas en tiempo de compilación o arranque mediante schemas tipados (ej. Zod).
- **[RF-11] Ownership Formal de Código:** Las rutas del monorepo (`apps/*`, `packages/*`, `infra/*`, `.github/*`) MUST contar con responsables explícitos definidos en un archivo `.github/CODEOWNERS`.
- **[RF-12] Gestión de Releases y Versionado:** Paquetes internos que requieran publicación o versionado formal SHOULD adoptar herramientas automatizadas como Changesets para gobernar SemVer, generación de changelogs y actualización de dependencias consumidoras.

---

### 3.2. Requerimientos No Funcionales

- **[RNF-01] Reproducibilidad Absoluta:** Las ejecuciones en CI MUST operar bajo instalaciones congeladas e inmutables (`npm ci` o `pnpm install --frozen-lockfile`), fijando la versión de Node.js (Node 24 LTS) y del gestor de paquetes.
- **[RNF-02] Escalabilidad del Pipeline de CI:** El tiempo de ejecución del pipeline de CI ante un cambio en una aplicación aislada no debe crecer linealmente al aumentar el número total de aplicaciones en el repositorio.
- **[RNF-03] Seguridad en la Cadena de Suministro:** Prevención rigurosa de cache poisoning, escaneo automatizado de secretos en commits y artefactos, auditoría de vulnerabilidades en dependencias (`npm audit`) y restricción de scripts de instalación no confiables (`ignore-scripts` / `allowScripts`).
- **[RNF-04] Mantenibilidad y Trazabilidad:** Un desarrollador recién incorporado debe poder identificar en menos de 5 minutos qué aplicaciones son desplegables, qué paquetes son compartidos, cómo compilar una app específica y quién es el owner técnico de cada módulo.
- **[RNF-05] Encapsulamiento de Paquetes:** Ningún paquete debe exponer sus módulos internos sin pasar por su API pública definida en el campo `exports` de su `package.json`. Prohibidos los deep imports tipo `import { x } from '@repo/ui/src/internal/button'`.
- **[RNF-06] Ergonomía y Developer Experience (DevEx):** El entorno local debe permitir levantar y depurar una única aplicación y sus dependencias directas de forma aislada sin forzar la ejecución del monorepo completo.

---

## 4. Criterios de Aceptación — Definition of Done (DoD)

Una arquitectura o cambio estructural dentro del monorepo se considera terminado y apto para producción cuando satisface:

### Workspace y Gestión de Paquetes
- [ ] Existe una raíz de workspace formalmente declarada con un único lockfile versionado.
- [ ] Política estricta de runtime fijada (`.node-version` o `package.json#engines` apuntando a Node.js 24 LTS).
- [ ] La instalación en CI es determinista y no altera el lockfile.

### Topología y Fronteras
- [ ] Las aplicaciones ejecutables residen exclusivamente bajo `apps/`.
- [ ] Las librerías y componentes reutilizables residen exclusivamente bajo `packages/`.
- [ ] Queda verificado que **no existen importaciones directas entre aplicaciones** (cero imports de `apps/web` hacia `apps/api` o viceversa).
- [ ] Los paquetes compartidos poseen un propósito de dominio unificado y coherente.

### Tareas y Caching
- [ ] Las tareas fundamentales (`build`, `lint`, `typecheck`, `test`) presentan nombres homogéneos en todos los proyectos.
- [ ] Los artefactos de salida (`dist/`, `.next/`) están correctamente registrados en los outputs de la configuración de cache.
- [ ] Tareas con efectos secundarios no computables (despliegues, migraciones de base de datos) están expresamente excluidas del cache.
- [ ] Las variables de entorno que alteran los bundles están incluidas en los hashes de cache.

### CI/CD e Integración
- [ ] La ejecución de pruebas y builds en Pull Requests opera sobre el grafo de proyectos afectados (`affected`), reduciendo el tiempo total de cómputo.
- [ ] El pipeline cuenta con verificación completa (*full test suite*) en la rama principal o ejecuciones programadas nocturnas para prevenir desincronizaciones del grafo.
- [ ] Los permisos de tokens de CI se rigen por el principio de mínimo privilegio.

### Contenedores y Despliegue
- [ ] Cada aplicación desplegable genera su propia imagen OCI/Docker de forma aislada.
- [ ] El contexto de compilación de Docker se poda mediante herramientas de subworkspace (ej. `turbo prune`) para evitar transferir código innecesario de otras aplicaciones.
- [ ] Las migraciones de base de datos se ejecutan como un trabajo desacoplado del inicio concurrente de múltiples réplicas de la aplicación.

---

## 5. Ecosistema de Herramientas

### 5.1. Comparativa de Gestores de Paquetes

| Herramienta | Ventajas Principales | Cuándo Utilizarlo | Consideraciones |
| :--- | :--- | :--- | :--- |
| **pnpm** *(Preferido)* | • Content-addressable storage (ahorro masivo de disco).<br>• `workspace:*` protocol nativo.<br>• Aislamiento estricto (elimina phantom dependencies).<br>• Feature de *Catalogs* para sincronizar versiones. | Repositorios JS/TS de medianos a grandes, múltiples aplicaciones y librerías compartidas. | Requiere que dependencias mal configuradas declaren explícitamente sus peer dependencies. |
| **npm Workspaces** | • Cero dependencias adicionales (nativo en Node.js).<br>• Curva de aprendizaje inexistente.<br>• Soporte universal en plataformas CI estándar. | Proyectos pequeños o medianos con grafo de dependencias lineal y baja complejidad. | Hoisting plano por defecto; puede propiciar importaciones fantasmas accidentales si no se audita. |
| **Yarn Modern (v4+)** | • Plugins extensibles y reglas de constraints declarativas.<br>• Zero-installs opcional.<br>• Resolución determinista. | Equipos con infraestructura consolidada en Yarn y necesidad de constraints avanzadas. | Mayor fricción en configuraciones PnP con herramientas que esperan rutas físicas en disco. |

---

### 5.2. Matriz de Decisión: Turborepo vs Nx

| Capacidad Arquitectónica | Turborepo | Nx |
| :--- | :--- | :--- |
| **Filosofía de Adopción** | Ligero, baja ceremonia, configuración basada en `turbo.json`. | Plataforma integral de ingeniería de workspace, altamente extensible. |
| **Configuración de Tareas** | Scripts nativos de `package.json`. | `project.json` o scripts nativos inferidos por plugins. |
| **Task Graph & DAG** | Excelente, basado en dependencias entre tareas (`dependsOn: ["^build"]`). | Excelente y altamente granular con soporte de grafos dinámicos. |
| **Local & Remote Caching** | Nativo (Vercel Remote Cache o self-hosted compatible con API HTTP). | Nativo (Nx Cloud o self-hosted storage adapters). |
| **Affected Project Detection** | Soporte vía flags `--filter=...[origin/main]` o `--affected`. | Soporte maduro y granular vía comandos dedicados `nx affected`. |
| **Gobernanza de Fronteras** | Requiere ESLint (`eslint-plugin-boundaries`) o herramientas complementarias. | **Integrado de forma nativa** mediante tags en proyectos y reglas de linting estrictas. |
| **Generadores de Código** | Soporte básico vía `@turbo/gen`. | **Muy potente**: generación de apps, librerías y migraciones automatizadas. |
| **Recomendación de Uso** | Aplicaciones web y APIs en JS/TS donde se prioriza simplicidad, rapidez y mínima configuración. | Monorepos corporativos a gran escala, equipos heterogéneos y proyectos políglotas con gobernanza estricta. |

---

### 5.3. Release Tooling: Changesets

Para la gestión de versiones y publicación de paquetes en un monorepo, **Changesets** constituye el estándar de la industria:
- **Intención de Cambio Desacoplada**: Los desarrolladores introducen archivos Markdown efímeros en `.changeset/` describiendo si el cambio es `patch`, `minor` o `major`.
- **Automatización en CI**: Agrupa cambios, calcula SemVer de acuerdo a dependencias locales, genera `CHANGELOG.md` y publica automáticamente en registros de paquetes.
- **Prevención de Versionado Fantasma**: Evita incrementar ceremonialmente versiones en aplicaciones privadas que únicamente requieren versionado por Git SHA o container digest.

---

## 6. Metodología de Práctica en 68 Fases

### Fase 1 — Evaluación Estratégica: ¿Monorepo Conviene?
Validar activamente si los proyectos evolucionan juntos, si existe código compartido significativo y si el equipo cuenta con la madurez para gobernar límites modulares. No adoptar monorepo por imitación si un multi-repo desacoplado resuelve el problema con menor costo operativo.

### Fase 2 — Diseño de la Topología del Repositorio
Establecer una estructura canónica, limpia y extensible:
```text
repo-root/
├── apps/
│   ├── api/                 # NestJS 11 Modular Monolith
│   └── web/                 # Next.js 15 App Router
├── packages/
│   ├── ui/                  # Componentes visuales y tokens
│   ├── contracts/           # DTOs, schemas de Zod, OpenAPI
│   └── tsconfig/            # Configuraciones base de TypeScript
├── tooling/
│   ├── eslint-config/       # Reglas estandarizadas de linting
│   └── scripts/             # Scripts de mantenimiento y auditoría
├── docs/                    # Documentación técnica y arquitectura
├── .agents/                 # Habilidades y reglas operativas de IA
├── package.json             # Root workspace package.json
└── turbo.json               # Configuración del orquestador de tareas
```

### Fase 3 — Configuración del Root package.json
El archivo raíz MUST declararse como privado:
```json
{
  "name": "@testimonial-cms/monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*",
    "tooling/*"
  ],
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "dev": "turbo run dev"
  },
  "devDependencies": {
    "turbo": "^2.4.0",
    "prettier": "^3.5.0"
  }
}
```
Evitar instalar dependencias de runtime de las aplicaciones en el `package.json` raíz.

### Fase 4 — Convención de Scopes en Nombres de Paquetes
Utilizar prefijos de organización coherentes:
- `@testimonial-cms/api`
- `@testimonial-cms/web`
- `@testimonial-cms/ui`
- `@testimonial-cms/contracts`
- `@testimonial-cms/tsconfig`

Esto evita colisiones en el namespace global de paquetes y previene confusiones al publicar paquetes externos.

### Fase 5 — Definición Estricta de Public APIs (`exports`)
Los paquetes compartidos deben gobernar con precisión sus puntos de entrada en su `package.json`:
```json
{
  "name": "@testimonial-cms/contracts",
  "version": "1.0.0",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "default": "./dist/index.js"
    },
    "./testimonials": {
      "types": "./dist/testimonials/index.d.ts",
      "import": "./dist/testimonials/index.js"
    }
  }
}
```
Queda estrictamente prohibido importar archivos privados no expuestos mediante deep imports.

### Fase 6 — Prohibición de Importaciones Cross-App
Las aplicaciones nunca deben importar código fuente directo de otras aplicaciones:
```typescript
// ❌ PROHIBIDO en apps/web:
import { TestimonialService } from '../../apps/api/src/modules/testimonials/testimonials.service';

// ✅ CORRECTO: Extraer el modelo común a un paquete compartido:
import { TestimonialResponseDto } from '@testimonial-cms/contracts';
```

### Fase 7 — Arquitectura de Capas de Dependencias (DAG)
El flujo de dependencias debe respetar un grafo dirigido acíclico estricto:
```text
           [ apps/web ]          [ apps/api ]
                 │                     │
                 ▼                     ▼
          [ packages/ui ]     [ packages/contracts ]
                 │                     │
                 └──────────┬──────────┘
                            ▼
                  [ packages/tokens ]
                            │
                            ▼
                  [ tooling/tsconfig ]
```
Nunca una capa inferior puede apuntar o depender de una capa superior (ej. un paquete de dominio no puede depender de React o Next.js).

### Fase 8 — Erradicación del Antipatrón packages/utils Monolítico
Descomponer utilidades en paquetes cohesivos y con responsabilidad única:
- `packages/date-utils`
- `packages/validation`
- `packages/crypto-utils`

Evitar convertir carpetas llamadas `common`, `shared` o `utils` en contenedores genéricos de código sin cohesión funcional.

### Fase 9 — Gobierno y Aislamiento de Base de Datos
En arquitecturas con múltiples servicios o microservicios, cada servicio debe gobernar sus propias migraciones y esquemas. Un paquete centralizado `packages/database` sólo es admisible si múltiples aplicaciones (ej. API backend y CLI administrativo) pertenecen deliberadamente al mismo límite de dominio y comparten el mismo esquema relacional.

### Fase 10 — Contratos Tipados Entre Servicios
Priorizar definiciones formales de contratos (Zod Schemas, OpenAPI, Protocol Buffers o AsyncAPI) como fuente de verdad. Generar clientes tipados (`@testimonial-cms/api-client`) a partir de la especificación OpenAPI en lugar de compartir entidades ORM internas entre backend y frontend.

### Fase 11 — Configuración del Descubrimiento de Workspaces
Definir con exactitud las rutas activas de paquetes en el manifiesto correspondiente (`pnpm-workspace.yaml` o `package.json#workspaces`), garantizando que subdirectorios temporales o de prueba no queden registrados accidentalmente.

### Fase 12 — Uso Riguroso del Protocolo `workspace:*`
Al vincular paquetes locales con `pnpm`, utilizar explícitamente el protocolo de workspace:
```json
{
  "dependencies": {
    "@testimonial-cms/contracts": "workspace:*",
    "@testimonial-cms/ui": "workspace:*"
  }
}
```
Esto asegura que el gestor resuelva el paquete local presente en el repositorio y prevenga descargas accidentales desde el registro público.

### Fase 13 — Política Equilibrada de Versiones de Dependencias
Diferenciar dependencias compartidas de infraestructura de dependencias específicas de aplicación:
- **Single Version Policy**: Recomendada para herramientas de desarrollo transversal (`typescript`, `eslint`, `prettier`, `@types/node`).
- **Flexible Version Policy**: Permitir versiones independientes en librerías de aplicación (`react`, frameworks específicos) cuando una app requiera compatibilidad progresiva durante procesos de migración.

### Fase 14 — Centralización con pnpm Catalogs
Aprovechar la funcionalidad de *Catalogs* de `pnpm` para gobernar versiones compartidas en un único punto sin dispersión:
```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
catalog:
  typescript: ^5.8.0
  zod: ^3.24.0
```

Consumo en paquetes locales:
```json
{
  "dependencies": {
    "zod": "catalog:"
  }
}
```

### Fase 15 — Centralización de Tooling Compartido
Empaquetar configuraciones repetitivas en paquetes internos:
- `packages/tsconfig`: Provee `base.json`, `nextjs.json`, `nestjs.json`.
- `tooling/eslint-config`: Provee reglas estandarizadas de ESLint compartidas entre web y api.

### Fase 16 — Convención Unificada de Scripts (Task Vocabulary)
Garantizar que todos los proyectos implementen comandos semánticos idénticos:
- `build`: Genera los artefactos de producción.
- `lint`: Ejecuta el análisis estático de código.
- `typecheck`: Compila tipos TypeScript (`tsc --noEmit`).
- `test`: Corre la suite de pruebas unitarias.
- `dev`: Inicia el entorno de desarrollo con hot-reload.

### Fase 17 — Construcción del Task Graph Topológico
Definir relaciones entre tareas en el orquestador. La compilación de una aplicación dependiente debe esperar a que sus librerías internas asociadas hayan completado su compilación previa (`dependsOn: ["^build"]`).

### Fase 18 — Configuración Canónica de Turborepo (`turbo.json`)
```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig*.json", "package.json"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**"]
    },
    "typecheck": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "tsconfig*.json"]
    },
    "lint": {
      "inputs": ["src/**", ".eslintrc*", "eslint.config.*"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["src/**", "test/**", "jest.config.*", "vitest.config.*"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### Fase 19 — Aislamiento de Side Effects en el Cache
Nunca configurar como cacheables tareas con efectos secundarios destructivos o que interactúen con servicios externos:
- Despliegues a producción (`deploy`).
- Migraciones de base de datos (`prisma migrate deploy`).
- Publicación de paquetes en npm (`changeset publish`).
- Notificaciones externas o invocaciones de webhooks.

### Fase 20 — Declaración Exhaustiva de Entradas de Cache (Cache Inputs)
Toda variable de entorno que altere el bundle resultante (ej. `NEXT_PUBLIC_API_URL`, `FEATURE_FLAG_ANALYTICS`) MUST declararse explícitamente en la sección `env` o `globalEnv` de la configuración del orquestador para prevenir entrega de bundles desactualizados.

### Fase 21 — Protección y Exclusión de Secretos en Artefactos
Garantizar que credenciales de infraestructura, tokens de base de datos (`DATABASE_URL`) y llaves privadas no queden incluidas en las variables hasheadas para builds estáticos ni persistidas dentro de los directorios de salida (`dist/`, `.next/`).

### Fase 22 — Gobernanza del Cache Local
Asegurar que los desarrolladores aprovechen el cache en sus estaciones locales mediante directorios `.turbo/cache` o equivalentes, asegurando que estos directorios estén estrictamente incorporados en el `.gitignore`.

### Fase 23 — Estrategia de Remote Cache en Pipelines
Integrar Remote Cache cuando el equipo supere 3 integrantes o los pipelines de CI superen los 10 minutos de compilación repetitiva, compartiendo artefactos deterministas entre diferentes máquinas de CI y desarrolladores.

### Fase 24 — Modelo de Confianza del Cache Remoto
Restringir permisos de escritura en el cache remoto únicamente a ramas canónicas verificadas (`main`). Deshabilitar permisos de escritura en Pull Requests externos (evitando ataques de inyección de binarios maliciosos o *cache poisoning*).

### Fase 25 — Ejecución Afectada con Turborepo
Optimizar los jobs de CI ejecutando únicamente las tareas que impactan los cambios introducidos:
```bash
# Ejecutar verificación de todo lo modificado respecto a la rama principal:
turbo run lint typecheck test build --filter=...[origin/main]
```

### Fase 26 — Detección Afectada con Nx
En entornos configurados con Nx, utilizar el comando especializado:
```bash
nx affected -t lint test build --base=origin/main --head=HEAD
```

### Fase 27 — Estrategia de Historial Git en CI (Evitar Shallow Clone Ciego)
Al configurar `actions/checkout` en GitHub Actions, no usar `fetch-depth: 1` si se requiere calcular affected projects:
```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0 # Asegura acceso al historial para comparar ramas
```

### Fase 28 — Suite de Validación Global Periódica (Safety Net)
Complementar el análisis de proyectos afectados con una ejecución completa de la suite de pruebas y builds de todo el repositorio (ej. ejecución nocturna *Nightly Build*), garantizando que no existan dependencias no detectadas por cambios en archivos de configuración.

### Fase 29 — Sinergia entre Affected y Remote Cache
- `Affected`: Reduce el tamaño del grafo a ejecutar.
- `Remote Cache`: Evita recomputar tareas idénticas dentro del grafo reducido.
La combinación de ambas estrategias maximiza la velocidad del feedback loop en CI.

### Fase 30 — Paralelización y Control de Recursos
Ajustar la concurrencia máxima de tareas según la capacidad de memoria y CPU de los runners de CI (`turbo run build --concurrency=4`), evitando caídas por *Out of Memory* (OOM) en compilaciones concurrentes de NestJS y Next.js.

### Fase 31 — Topología de Entornos de Despliegue
Establecer convenciones claras de ambientes: `local`, `preview` (Pull Requests efímeros), `staging` y `production`.

### Fase 32 — Desacoplamiento de Variables con `.env.example`
Cada aplicación ejecutable mantiene su propio `.env.example` localizado dentro de su propio directorio (`apps/api/.env.example`, `apps/web/.env.example`). No crear un archivo `.env` monolítico en la raíz para todo el monorepo.

### Fase 33 — Validación de Configuración en Runtime con Zod
Implementar validación fail-fast al arrancar cada aplicación:
```typescript
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string().url(),
});

export const env = envSchema.parse(process.env);
```

### Fase 34 — Cero Persistencia de Secretos en Git
Los secretos y contraseñas nunca deben comitearse al repositorio. Emplear gestores de secretos dedicados (GitHub Secrets, AWS Secrets Manager, Vault) inyectados en runtime.

### Fase 35 — Principio Build Once, Deploy Many (Backend)
Las aplicaciones backend (NestJS) deben compilarse en una única imagen OCI inmutable cuyo comportamiento se adapte en runtime mediante variables de entorno inyectadas por el orquestador.

### Fase 36 — Estrategia de Configuración para Aplicaciones Web en Navegador
Para artefactos frontend estáticos (SPAs) donde las variables públicas se incrustan en el build, evaluar endpoints de configuración dinámica (`/api/config`) o inyección en tiempo de renderizado de servidor (Next.js SSR) para permitir reutilización de imágenes entre staging y producción.

### Fase 37 — Fronteras de Variables en Server-Rendered Frontend (Next.js)
Distinguir estrictamente las variables de servidor (privadas) de las variables expuestas al navegador con prefijo `NEXT_PUBLIC_`. Nunca exponer secretos de base de datos o llaves maestras en variables públicas.

### Fase 38 — Entornos de Preview Efímeros en Pull Requests
Configurar despliegues de previsualización automáticos por cada PR para que diseñadores, QA y stakeholders puedan validar los cambios visuales y funcionales sin bloquear el ambiente de staging.

### Fase 39 — Pipeline de CI Estandarizado y Multietapa
Estructurar el workflow de GitHub Actions en etapas ordenadas lógicamente:
1. Checkout con historial Git.
2. Setup de Node.js 24 con cache de gestor de paquetes.
3. Instalación determinista (`npm ci` / `pnpm install --frozen-lockfile`).
4. Cálculo del grafo afectado.
5. Ejecución en paralelo: `lint`, `typecheck`, `test`.
6. Compilación de artefactos: `build`.
7. Pruebas de integración o E2E para las aplicaciones afectadas.

### Fase 40 — Despliegue como Efecto Secundario Controlado
Garantizar que la etapa de despliegue sea un paso explícito de CI/CD ejecutado únicamente tras el éxito total de las etapas de validación, sin depender de tareas cacheadas inseguras.

### Fase 41 — Matriz de Despliegues Independientes
Configurar condicionales en el pipeline de entrega para disparar únicamente el despliegue del componente afectado:
- Si sólo cambia `apps/api` ──► Desplegar backend.
- Si sólo cambia `apps/web` ──► Desplegar frontend.
- Si cambia `packages/contracts` ──► Validar y desplegar ambos si corresponde.

### Fase 42 — Contenedorización Específica por Aplicación
Cada aplicación ejecutable genera su propio artefacto de producción:
- `testimonial-api:sha-1234`
- `testimonial-web:sha-1234`
No crear una imagen monolítica gigantesca que contenga todo el repositorio.

### Fase 43 — Optimización del Contexto de Compilación con `turbo prune`
Reducir el peso del contexto de Docker construyendo un subworkspace podado que contenga únicamente el código de la app a compilar y sus paquetes dependientes:
```bash
npx turbo prune @testimonial-cms/api --docker
```

### Fase 44 — Dockerfiles Multi-Stage para Monorepos
Implementar Dockerfiles con etapas claras (`prune`, `deps`, `builder`, `runner`), ejecutando en producción bajo un usuario no privilegiado (`USER node`) y optimizando capas de cache con BuildKit.

### Fase 45 — Orquestación Desacoplada de Migraciones de Base de Datos
Las migraciones relacionales (`prisma migrate deploy`) deben ejecutarse como un job aislado o init-container antes del rollout de la nueva versión del servicio, evitando condiciones de carrera si múltiples réplicas de NestJS inician en paralelo.

### Fase 46 — Estrategia de Versionado de Aplicaciones
Para aplicaciones privadas desplegables, utilizar el Git SHA, commit timestamp o build ID como identificador de versión en lugar de obligar al uso de versiones SemVer ceremoniales en `package.json`.

### Fase 47 — Versionado de Librerías con Changesets
Para paquetes que deban mantener compatibilidad y changelogs detallados:
```bash
npx changeset
```
Permite documentar cambios de forma colaborativa durante el desarrollo del PR.

### Fase 48 — Versiones Independientes vs Coordinadas (Fixed)
- **Independent**: Cada paquete evoluciona a su propio ritmo SemVer. Recomendado para librerías especializadas.
- **Fixed**: Todos los paquetes avanzan a la par (ej. versión `2.0.0` simultánea). Recomendado sólo cuando existe un ecosistema fuertemente acoplado de SDKs.

### Fase 49 — Conventional Commits para Trazabilidad
Exigir formato de commit estandarizado para facilitar la auditoría del monorepo y la automatización de release notes:
```text
feat(api): agregá el endpoint de moderación de testimonios
fix(web): corregí el parpadeo en el tema oscuro del dashboard
```

### Fase 50 — Asignación de Ownership con `.github/CODEOWNERS`
Definir equipos y personas responsables por ruta:
```text
/apps/api/              @testimonial-cms/backend-team
/apps/web/              @testimonial-cms/frontend-team
/packages/contracts/    @testimonial-cms/architecture-guild
/.github/workflows/     @testimonial-cms/platform-team
```

### Fase 51 — Branch Protection y Rulesets
Exigir aprobación de los code owners respectivos y paso obligatorio de los checks de CI antes de autorizar el merge a la rama principal.

### Fase 52 — Auditoría Continua de Seguridad en Dependencias
Automatizar en el pipeline:
- `npm audit --audit-level=high`
- Escaneo de secretos con GitGuardian o TruffleHog.
- Revisión de dependencias nuevas mediante Dependency Review Action.

### Fase 53 — Hardening de Scripts del Gestor de Paquetes
Revisar minuciosamente paquetes que ejecuten scripts de ciclo de vida (`postinstall`, `preinstall`), aplicando directivas de seguridad para evitar ejecución de código arbitrario no confiable durante `npm install`.

### Fase 54 — Autenticación en CI mediante OIDC
Reemplazar credenciales estáticas de larga duración (ej. AWS Access Keys) por Workload Identity Federation (OIDC) en GitHub Actions para interactuar de forma segura con la infraestructura cloud.

### Fase 55 — Gobierno de Fronteras Modulares (Module Boundaries)
Definir taxonomía de tipos y scopes para cada proyecto del monorepo:
- **Scopes**: `scope:web`, `scope:api`, `scope:shared`.
- **Types**: `type:app`, `type:ui`, `type:contracts`, `type:tooling`.

Establecer la regla fundamental: Los paquetes de tipo `contracts` o `ui` no pueden importar paquetes de tipo `app`.

### Fase 56 — Automatización de Restricción de Imports
Implementar herramientas de análisis estático como `eslint-plugin-boundaries` o `dependency-cruiser` para romper el build si se detectan importaciones ilegales en el código fuente.

### Fase 57 — Detección Proactiva de Dependencias Circulares
Configurar scripts de CI que ejecuten `madge` o analizadores de grafos para impedir ciclos entre módulos o paquetes:
```bash
npx madge --circular --extensions ts,tsx apps/ packages/
```

### Fase 58 — Estrategia Piramidal de Pruebas
- **Pruebas en Packages**: Foco en tests unitarios puros, validaciones de esquema y componentes aislados.
- **Pruebas en Apps**: Foco en pruebas de integración, endpoints HTTP y flujos E2E críticos.

### Fase 59 — Testing de Contratos de Integración
Implementar pruebas que validen que las respuestas reales de la API coinciden con los contratos tipados definidos en `@testimonial-cms/contracts`, garantizando compatibilidad entre frontend y backend.

### Fase 60 — Segmentación Eficiente de Pruebas E2E (Playwright / Cypress)
Evitar ejecutar la suite completa de pruebas E2E en cada commit. Ejecutar sólo los tests asociados a las aplicaciones modificadas en el PR y reservar la suite global para merge a `main`.

### Fase 61 — Ergonomía del Flujo de Trabajo Local
Permitir a los desarrolladores ejecutar tareas acotadas a su ámbito de trabajo:
```bash
# Iniciar únicamente el frontend web y compilar sus dependencias locales:
npm run dev --workspace=@testimonial-cms/web
```

### Fase 62 — Infraestructura Local Contenerizada
Utilizar Docker Compose para levantar servicios de soporte (PostgreSQL 18, Redis 7) de forma rápida y determinista para desarrollo local, sin requerir conexión obligatoria a internet o bases de datos compartidas.

### Fase 63 — Scaffolding Estandarizado con Generadores
Para repositorios con alto volumen de creación de paquetes, proveer scripts de scaffolding o generadores (ej. Plop.js o Nx generators) para crear nuevos paquetes con la estructura correcta de `package.json`, `tsconfig.json` y linters.

### Fase 64 — Plantillas Adaptables sin Rigidez Dogmática
Los generadores y plantillas deben proporcionar un punto de partida consistente, permitiendo evolucionar la configuración de cada paquete de acuerdo a sus requerimientos técnicos particulares.

### Fase 65 — Telemetría y Métricas del Sistema de Compilación
Registrar métricas del tiempo de build de cada tarea, tiempos de cola de CI y tamaño del grafo para detectar cuellos de botella antes de que degraden la productividad del equipo.

### Fase 66 — Diagnóstico de Degradación del Cache Hit Ratio
Si la tasa de aciertos de cache cae por debajo del 60%, auditar:
- Generación de timestamps dinámicos en archivos fuente durante la compilación.
- Modificaciones no intencionadas en el lockfile.
- Tareas declaradas como cacheables sin inputs delimitados.

### Fase 67 — Optimización de la Ruta Crítica del Task Graph
Identificar qué paquete o tarea bloquea el mayor número de proyectos dependientes y optimizar su compilación en primer lugar (ej. acelerar la generación de tipos de contratos para desbloquear simultáneamente web y api).

### Fase 68 — Gobernanza del Crecimiento del Repositorio
Evaluar semestralmente el número de paquetes, profundidad del grafo y tiempo medio de build. Si una herramienta o librería compartida ya no se utiliza o agrega fricción innecesaria, proceder a su deprecación y remoción ordenada.

---

## 7. Catálogo de 30 Antipatrones

| Código | Antipatrón | Detección | Impacto | Mitigación Técnica |
| :--- | :--- | :--- | :--- | :--- |
| **MONO-01** | **Monorepo = Monolito** | Asumir que todos los servicios deben compartir base de datos, framework y despliegue. | Acoplamiento inmanejable y pérdida de agilidad de entrega. | Separar formalmente deployables independientes y preservar límites de dominio. |
| **MONO-02** | **Monorepo = Microservicios** | Forzar arquitecturas distribuidas complejas sólo porque los proyectos conviven en un repo. | Sobrecarga de red, serialización innecesaria y latencia. | Mantener arquitectura de Monolito Modular cuando sea apropiado. |
| **MONO-03** | **Sobreingeniería de Orquestador** | Instalar orquestadores pesados en proyectos de dos carpetas donde bastan workspaces simples. | Fricción innecesaria de configuración y mantenimiento. | Utilizar npm/pnpm workspaces nativos hasta que la escala justifique Turborepo o Nx. |
| **MONO-04** | **Rebuild Completo Indiscriminado** | Ejecutar siempre `test` y `build` en todo el repo ante cualquier cambio en CI. | CI extremadamente lento, alto consumo de cómputo y frustración del equipo. | Configurar comandos con affected execution (`--filter=...[origin/main]`). |
| **MONO-05** | **Base de Diff Incorrecta en CI** | Comparar affected contra `HEAD~1` en flujos de PR donde la base real es `origin/main`. | Tareas omitidas por evaluar sólo el último commit del PR. | Configurar siempre `--base=origin/main` en pipelines de Pull Request. |
| **MONO-06** | **Shallow Clone Roto en CI** | Usar `fetch-depth: 1` e intentar calcular diffs de Git para affected. | Fallo silencioso o ejecución de todo el grafo por falta de historial. | Configurar `fetch-depth: 0` en el checkout de GitHub Actions. |
| **MONO-07** | **Remote Cache sin Modelo de Confianza** | Permitir que cualquier PR o fork externo escriba en el cache remoto de compilación. | Riesgo crítico de cache poisoning e inyección de código malicioso. | Restringir permisos de escritura únicamente a la rama `main` de CI. |
| **MONO-08** | **Cachear Despliegues** | Registrar el comando `deploy` como tarea cacheable en el orquestador. | Despliegue omitido por considerar que el comando ya se ejecutó previamente. | Configurar `"cache": false` para toda tarea con efectos secundarios externos. |
| **MONO-09** | **Cachear Migraciones de DB** | Marcar la ejecución de migraciones relacionales como tarea determinista cacheada. | Base de datos desactualizada en producción al no correr el comando. | Configurar migraciones como jobs desacoplados sin almacenamiento en cache. |
| **MONO-10** | **Omitir Variables en Cache Keys** | Bundle frontend dependiente de `NEXT_PUBLIC_API_URL` sin declarar la variable en inputs. | Entrega de artefactos estáticos compilados con URLs de entornos erróneos. | Declarar todas las variables de entorno en la clave `env` de `turbo.json`. |
| **MONO-11** | **Secretos en Artefactos Cacheados** | Almacenar variables secretas o archivos `.env` dentro de los outputs cacheados. | Fuga de credenciales accesibles para cualquier miembro o runner con acceso al cache. | Inyectar secretos en runtime y asegurar que queden fuera de directorios de build. |
| **MONO-12** | **Dependencias Ocultas en el Root** | Instalar paquetes de aplicación en el `package.json` raíz y usarlos implícitamente. | Builds fallidos al containerizar aplicaciones de forma individual. | Cada app y paquete debe declarar explícitamente sus dependencias en su propio manifiesto. |
| **MONO-13** | **Phantom Dependencies por Hoisting** | Importar módulos presentes en `node_modules` raíz no declarados en el package local. | Inestabilidad en entornos de producción y fallos de resolución de módulos. | Adoptar `pnpm` o linters que verifiquen que todo import esté en `package.json`. |
| **MONO-14** | **Importaciones Cross-App Directas** | `apps/web` importando archivos internos de `apps/api`. | Acoplamiento letal entre aplicaciones independientes y fallos de compilación. | Extraer código compartido a `packages/*` y aplicar reglas de linting estrictas. |
| **MONO-15** | **Deep Imports hacia Internos de Packages** | Importar `packages/ui/src/internal/Button` saltándose el index o `exports`. | Ruptura de código ante refactors internos de la librería. | Configurar campo `exports` estricto en `package.json` de cada paquete. |
| **MONO-16** | **Mega-paquete packages/utils Basurero** | Un único paquete `utils` con dependencias mezcladas de backend, frontend y bases de datos. | Dependencias infladas y recompilaciones continuas para todo el repositorio. | Descomponer en paquetes específicos y pequeños con propósito único. |
| **MONO-17** | **Database Package Omnisciente** | Un `packages/database` que permite a cualquier servicio consultar cualquier tabla. | Violación de límites de dominio e imposibilidad de evolucionar esquemas. | Cada microservicio gobierna sus migraciones; restringir acceso directo a tablas ajenas. |
| **MONO-18** | **Archivo .env Global Monolítico** | Un único archivo `.env` en la raíz con variables para todas las aplicaciones. | Contaminación de variables, secretos expuestos y confusión de configuración. | Mantener `.env.example` individual y localizado por cada aplicación. |
| **MONO-19** | **Secretos de Producción en Git** | Comitear `.env.production` al repositorio. | Fuga crítica de credenciales de bases de datos y servicios cloud. | Bloquear en `.gitignore` y utilizar GitHub Secrets o AWS Secrets Manager. |
| **MONO-20** | **Single Version Policy Rígida Universal** | Exigir que todas las apps usen exactamente la misma versión de cada librería externa. | Bloqueo de actualizaciones y migraciones complejas entre diferentes equipos. | Aplicar versiones únicas en tooling de desarrollo; permitir flexibilidad temporal en apps. |
| **MONO-21** | **Deriva Accidental de Dependencias** | Proyectos usando versiones incompatibles de TypeScript o librerías fundamentales sin control. | Errores sutiles de compilación y comportamientos dispares entre proyectos. | Utilizar *Catalogs* de pnpm o herramientas de syncpack para auditar versiones. |
| **MONO-22** | **Publicación Innecesaria de Paquetes Privados** | Publicar en registros npm externos paquetes que sólo se utilizan internamente. | Fricción de pipeline, costos y potencial fuga de lógica de negocio propietaria. | Mantener `"private": true` en paquetes de uso exclusivo interno. |
| **MONO-23** | **SemVer Ceremonial en Aplicaciones** | Incrementar versiones `1.2.3` en apps privadas que se despliegan continuamente. | Burocracia inútil que no aporta valor operativo. | Identificar despliegues de aplicaciones privadas mediante Git Commit SHA. |
| **MONO-24** | **Despliegue Todo-o-Nada** | Desplegar todas las aplicaciones del monorepo ante un cambio en una sola de ellas. | Sobrecarga de infraestructura, riesgo de regresiones y tiempos de entrega lentos. | Implementar matrices de despliegue condicional basadas en los proyectos modificados. |
| **MONO-25** | **Imagen Docker Monolítica Única** | Construir una imagen de 2GB que contiene todas las apps del repositorio. | Transferencias lentas, alto consumo de recursos y superficies de ataque ampliadas. | Generar imágenes OCI individuales y optimizadas mediante `turbo prune`. |
| **MONO-26** | **Migraciones Concurrentes desde Réplicas** | Ejecutar `prisma migrate` en el entrypoint de cada réplica de la API al arrancar. | Condiciones de carrera en la base de datos y deadlocks en el arranque. | Ejecutar migraciones en un step o contenedor de inicialización previo e independiente. |
| **MONO-27** | **Tipos Compartidos Sustituyendo Contratos** | Importar interfaces internas de Prisma desde el frontend asumiendo compatibilidad. | Acoplamiento entre esquema de persistencia interna y el contrato público de API. | Utilizar DTOs explícitos y schemas de Zod como contratos de comunicación. |
| **MONO-28** | **Límites Documentados pero no Automatizados** | Redactar reglas de arquitectura en un archivo Markdown sin chequeos en CI. | Violaciones continuas de fronteras arquitectónicas con el paso del tiempo. | Automatizar reglas mediante ESLint (`no-restricted-imports`), Nx tags o linters de arquitectura. |
| **MONO-29** | **Confianza Ciega en Affected sin Safety Net** | Depender exclusivamente de affected sin correr jamás la suite completa. | Desincronización silenciosa si un archivo no rastreado rompe proyectos dependientes. | Ejecutar builds y tests completos periódicamente (ej. Nightly CI jobs). |
| **MONO-30** | **Medir Éxito sólo por Código Compartido** | Forzar la compartición de código trivial aumentando acoplamiento innecesario. | Fragilidad: un cambio pequeño rompe múltiples sistemas sin beneficio real. | Priorizar modularidad y límites claros por encima de la reutilización forzada. |

---

## 8. Evaluación y KPIs de Calidad en Monorepos

### 8.1. Métricas de Correctitud Arquitectónica

| Métrica | Definición | Meta |
| :--- | :--- | :--- |
| **Imports Cross-App** | Número de importaciones directas entre aplicaciones bajo `apps/*`. | **0** (Violación bloqueante). |
| **Dependencias Circulares** | Ciclos detectados en el grafo de módulos o paquetes mediante análisis estático. | **0** (Violación bloqueante). |
| **Boundary Violations** | Violaciones a las reglas de acceso entre capas (ej. contratos importando UI). | **0** (Violación bloqueante). |
| **Phantom Dependencies** | Uso de dependencias en código fuente no declaradas en el `package.json` del proyecto. | **0** (Violación bloqueante). |
| **Proyectos sin CODEOWNER** | Rutas en `apps/` o `packages/` sin un responsable formal asignado en `CODEOWNERS`. | **0**. |

---

### 8.2. Métricas de Seguridad

| Métrica | Definición | Meta |
| :--- | :--- | :--- |
| **Secretos Versionados** | Detección de claves, contraseñas o tokens en el historial o diffs de Git. | **0** (Rechazo inmediato de commit/PR). |
| **Secretos en Build Outputs** | Archivos confidenciales persistidos en carpetas `dist/` o cacheadas. | **0**. |
| **Permisos Excesivos en CI** | Jobs de CI operando con permisos mayores a `contents: read` sin justificación. | **0**. |
| **Cache Writes No Confiables** | Escrituras de cache remoto autorizadas en Pull Requests de ramas no verificadas. | **0**. |

---

### 8.3. Métricas de CI y Rendimiento

- **CI Pipeline Duration (p50 / p95):** Tiempo total de feedback en PRs (< 8 minutos p50, < 15 minutos p95).
- **Cache Hit Ratio:** Proporción de tareas resueltas desde cache (> 70% en ejecuciones continuas).
- **Affected Project Count:** Promedio de proyectos ejecutados en PRs aislados (debe ser significativamente menor al total del repo).
- **Flaky Test Rate:** Porcentaje de fallos de CI atribuibles a tests inestables (< 1%).

---

### 8.4. Métricas de Developer Experience (DevEx)

- **First Dev Command:** Tiempo requerido desde `git clone` hasta el primer `npm run dev` funcional (< 5 minutos).
- **Local Task Isolation:** Capacidad de levantar una app sin requerir la compilación de aplicaciones no relacionadas.
- **Documentation Drift:** Frecuencia de desactualización entre la estructura física de directorios y la documentación técnica de inducción.

---

## 9. Recursos Adicionales, Checklists Senior y Regla Rectora Final

### 9.1. Checklist Senior: ¿Necesitamos un Monorepo?
Marcar afirmativamente:
- [ ] Existen múltiples proyectos con relaciones de dominio directas.
- [ ] Los proyectos comparten código funcional significativo (contratos, componentes visuales, lógica de dominio).
- [ ] Los cambios transversales (cross-project refactors) son frecuentes y deben ser atómicos.
- [ ] La infraestructura de CI puede comprender y optimizar la ejecución del grafo.
- [ ] El equipo dispone de mecanismos para automatizar y hacer cumplir límites arquitectónicos.
- [ ] El repositorio permite y garantiza el despliegue independiente de cada aplicación.
*(Si la mayoría resulta falsa, evaluar un enfoque multi-repo desacoplado).*

---

### 9.2. Checklist Senior: Selección de Tooling

- **Workspaces Únicamente (`npm` / `pnpm`):**
  - Repositorio con menos de 5 proyectos.
  - Grafo lineal simple y tiempos de CI actualmente inferiores a 3 minutos.
  - No se requiere remote cache ni cálculo sofisticado de affected.
- **Turborepo:**
  - Ecosistema puramente JavaScript y TypeScript.
  - Se busca mínima configuración y adopción inmediata basada en `package.json`.
  - Necesidad de task graph, local/remote caching y ejecución afectada rápida.
- **Nx:**
  - Monorepo corporativo a gran escala con decenas de proyectos.
  - Requisito mandatorio de gobernanza estricta de fronteras mediante tags y linters integrados.
  - Necesidad de generadores de código avanzados y CI distribuido en la nube.

---

### 9.3. Checklist Senior: Incorporación de un Nuevo Package
Antes de crear una nueva carpeta en `packages/*`, verificar:
- [ ] ¿Representa un concepto de dominio o técnico cohesivo y bien delimitado?
- [ ] ¿Tiene al menos dos proyectos consumidores reales o define una frontera arquitectónica crítica?
- [ ] ¿Cuenta con un owner técnico claramente asignado en `CODEOWNERS`?
- [ ] ¿Tiene definida su Public API en el campo `exports` de `package.json`?
- [ ] ¿Están tipadas y aisladas sus dependencias sin acoplarse a frameworks de aplicación?
- [ ] ¿Su creación disminuye el acoplamiento global en lugar de aumentar la complejidad accidental?

---

### 9.4. Checklist Senior: Pull Request en Monorepo
- [ ] Grafo de affected verificado: sólo se ejecutan las tareas indispensables para el cambio.
- [ ] No se violan reglas de importación entre aplicaciones o capas prohibidas.
- [ ] El lockfile permanece consistente y no se introdujeron dependencias fantasma.
- [ ] Tareas deterministas completaron con éxito (`lint`, `typecheck`, `test`, `build`).
- [ ] Se incluyó un changeset si el cambio impacta un paquete con versionado SemVer.
- [ ] Los revisores asignados por `CODEOWNERS` aprobaron el Pull Request.

---

### 9.5. Checklist Senior: Despliegue de Producción
- [ ] Se despliegan exclusivamente las aplicaciones afectadas por el commit.
- [ ] El artefacto generado es inmutable y está identificado unívocamente por Git SHA o container digest.
- [ ] Las variables de entorno son inyectadas externamente en runtime por la plataforma de hosting.
- [ ] Las migraciones de base de datos se ejecutan en un paso previo y desacoplado del inicio de réplicas.
- [ ] Existen health checks de liveness y readiness operativos y monitoreo activo.

---

### Regla Rectora Final

La arquitectura profesional de un monorepo se rige por:

```text
                  REPOSITORY
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
      APPS        PACKAGES       TOOLING
  (Deployable   (Reusable APIs  (Centralized
  independently)  & Contracts)   Governance)
        │             │             │
        └─────────────┼─────────────┘
                      ▼
                  TASK GRAPH
        ├── Explicit Dependencies
        ├── Affected Execution
        ├── Deterministic Caching
        └── Controlled CI/CD
```

y **NUNCA** por:

```text
  Meter todo en un solo repositorio Git
                  │
                  ▼
         Compartir todo sin límites
                  │
                  ▼
         Recompilar todo en cada push
                  │
                  ▼
         Desplegar todo simultáneamente
```

---

### Resultado Esperado

Un repositorio gobernado bajo la habilidad **SKL-MONOREPO-ARCH-001** es:
- **Modular y Acíclico:** Fronteras claras con contratos explícitos y sin referencias cruzadas ilegales.
- **Determinista y Eficiente:** Cache local y remoto confiable con tiempos de CI sub-lineales respecto al tamaño del repositorio.
- **Desacoplado en Producción:** Despliegues y rollbacks independientes para cada aplicación.
- **Seguro y Reproducible:** Cero secretos en código o artefactos y cadena de suministro de dependencias auditada.
- **Ergonómico:** Flujo de desarrollo ágil donde cada desarrollador interactúa con su proyecto sin sobrecarga innecesaria del resto del ecosistema.
