---
name: github-engineering
description: Configuración adaptativa, gobernanza, seguridad y automatización profesional de repositorios GitHub (código SKL-DEV-GITHUB-001). Usar cuando se requiera diseñar o auditar repositorios GitHub, branch protection y rulesets, permisos mínimos de GITHUB_TOKEN, CODEOWNERS, pipelines de CI/CD, dependencias y supply chain con Dependabot y Dependency Review, escaneo de secretos y Push Protection, CodeQL/SAST, entornos de despliegue con OIDC y release management adaptado al tamaño del equipo y criticidad del sistema.
---

# Especificación Técnica de Habilidad: GitHub Repository Governance & DevSecOps Engineering

```text
Código de Skill:    SKL-DEV-GITHUB-001
Versión:            1.0.0
Nivel:              Senior / Staff-ready
Estándar:           ISO/IEC 26514 / IEEE 29148 / Agile DoD / DevSecOps / Continuous Delivery
Dominio:            GitHub / Repository Governance / CI-CD / Software Supply Chain / DevSecOps
```

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Configuración Adaptativa, Gobernanza y Automatización Profesional de Repositorios GitHub. |
| **Objetivo de Dominio** | Capacitar al practicante para diseñar, configurar, proteger y automatizar repositorios GitHub según el tamaño del equipo, criticidad, arquitectura, naturaleza del producto, workflow Git, duración y modelo de despliegue. |
| **Tipo de Proyecto** | Backend / Frontend / Full Stack / Mobile / Libraries / Open Source / Data / AI-ML / DevOps / IaC / Monorepo / Microservicios. |
| **Complejidad** | Alta. |
| **Nivel Esperado** | Senior / Staff Engineer. |
| **Unidad de Diseño** | Repositorio GitHub como boundary de código, gobernanza, automatización, seguridad y entrega. |
| **Principio Rector** | Configurar sólo los controles que reduzcan riesgo o costo operativo real, evitando tanto repositorios subgobernados como burocracia innecesaria (*Zero Decorative Bureaucracy*). |

---

## 2. Descripción y Filosofía de Diseño

La skill trata a **GitHub como una plataforma integral de ingeniería de software**, no simplemente como un alojamiento remoto de repositorios Git.

Un repositorio profesional en GitHub concentra múltiples responsabilidades interconectadas:

```text
       ┌─────────────────────────────────────────────────────────┐
       │               GitHub Repository Boundary               │
       ├─────────────────┬───────────────────────────────────────┤
       │ Source Control  │ Git hosting, refs, commit trees       │
       │ Code Review     │ PRs, inline comments, review threads  │
       │ Governance      │ Rulesets, branch protection, roles    │
       │ CI/CD           │ GitHub Actions, runners, matrices     │
       │ Security        │ Secret scanning, push protection, SAST│
       │ Supply Chain    │ Dependabot, dependency review, attest │
       │ Release Mgmt    │ Tags, SemVer, GitHub Releases, GHCR   │
       │ Coordination    │ Issues, projects, discussions         │
       │ Auditability    │ Audit log, provenance, commit signing │
       └─────────────────┴───────────────────────────────────────┘
```

La configuración correcta nunca surge de una checklist estática universal. Debe derivarse estrictamente del análisis contextual del sistema:

```text
 Project Context (Equipo, Ciclo de Vida, Criticidad, Arquitectura)
       ↓
 Risk Classification (C0: Sandbox → C3: Fintech/Health/Infra)
       ↓
 Collaboration Model (Solo Dev, Feature Teams, Open Source, Enterprise)
       ↓
 Git Workflow (GitHub Flow, Trunk-Based, Git Flow, Release-Driven)
       ↓
 Repository Governance (Rulesets, Branch Protection, CODEOWNERS, Roles)
       ↓
 CI/CD Requirements (Matrix, Linters, Test Suites, Build, Caching)
       ↓
 Security Controls (Least Privilege, Push Protection, SAST, Pinning)
       ↓
 Deployment Model (OIDC, Environments, Protection Rules, Rollback)
       ↓
 Tailored GitHub Configuration (Policy as Code in .github/ & Settings)
```

### 2.1. Principios Arquitectónicos

#### Principio 1 — Configuration by Context
No todo repositorio necesita dos aprobaciones obligatorias, GitHub Projects, CodeQL avanzado, deployment approvals manuales, CODEOWNERS, merge queues, Git LFS, GitHub Packages o múltiples environments. La skill exige **diagnosticar antes de prescribir**. Imponer fricción innecesaria degrada la velocidad del equipo sin reducir riesgos reales.

#### Principio 2 — Least Privilege
Cada usuario, workflow, token de automatización e integración debe poseer únicamente los permisos indispensables para cumplir su función. GitHub define roles progresivos a nivel de organización y repositorio:

```text
Read ──► Triage ──► Write ──► Maintain ──► Admin
```

- **Read**: Clonar, inspeccionar código, abrir issues y PRs.
- **Triage**: Gestionar issues y PRs (etiquetar, asignar, cerrar) sin permiso de escritura en ramas.
- **Write**: Pushear a ramas no protegidas, crear ramas, mergear PRs autorizados.
- **Maintain**: Administrar configuraciones del repositorio sin acceso a acciones destructivas o facturación.
- **Admin**: Acceso completo a settings, secrets, permisos y eliminación del repositorio.

*Regla crítica:* Nunca conceder permisos de `Admin` o `Write` cuando `Triage` o `Read` sean suficientes. En GitHub Actions, el token de ejecución `GITHUB_TOKEN` debe partir de lectura estricta (`contents: read`).

#### Principio 3 — Policy as Code
Toda regla, restricción o flujo operativo que pueda ser versionado debe residir en el repositorio dentro del árbol `.github/`:

```text
.github/
├── workflows/                     # Pipelines de CI, CD y seguridad
├── CODEOWNERS                     # Asignación declarativa de revisores por ruta
├── dependabot.yml                 # Mantenimiento automatizado de dependencias
├── ISSUE_TEMPLATE/                # Formularios estructurados de issues
│   ├── bug.yml
│   ├── feature.yml
│   └── config.yml
├── pull_request_template.md       # Plantilla de contexto y checklist de validación
└── dependency-review-config.yml   # Umbrales de licencias y vulnerabilidades
SECURITY.md                        # Política de divulgación responsable
CONTRIBUTING.md                    # Guía de contribución para colaboradores
CODE_OF_CONDUCT.md                 # Normas comunitarias
```

Las configuraciones que necesariamente residen en los menús de GitHub Settings (Rulesets, Environments, Webhooks) deben documentarse explícitamente en la documentación técnica del repositorio (`/docs/governance.md`).

#### Principio 4 — Defense in Depth
Ningún control individual debe ser el único responsable de prevenir fallos o incidentes de seguridad. La validación se estructura en capas sucesivas:

```text
1. Developer Workstation ──► Pre-commit hooks (Husky, lint-staged)
2. Push Event           ──► Push Protection (bloqueo de secretos en tránsito)
3. Pull Request         ──► Automated Status Checks (Lint, Typecheck, Tests, Build)
4. Static Analysis      ──► SAST / CodeQL + Dependency Review
5. Peer Review          ──► Human Code Review + CODEOWNERS approval
6. Target Branch Guard  ──► Rulesets (bloqueo de force-push, linear history, signed commits)
7. Deployment Gate      ──► Environment Protection Rules (aprobación manual, branch limits)
8. Cloud Ingestion      ──► OIDC federado (tokens efímeros de corto plazo sin claves estáticas)
```

#### Principio 5 — Automatizar Controles Deterministas
Toda verificación que pueda ser resuelta mediante algoritmos o herramientas deterministas debe delegarse a la máquina:
- Formato de código (`Prettier`, `Biome`).
- Análisis estático de sintaxis y tipado (`ESLint`, `tsc --noEmit`).
- Pruebas unitarias, de integración y de regresión (`Vitest`, `Jest`, `pytest`).
- Compilación y verificación de empaquetado (`next build`, `npm run build`).
- Escaneo de secretos en código (`Secret Scanning`, `TruffleHog`).
- Detección de vulnerabilidades en dependencias (`Dependency Review`, `Dependabot`).
- Convención de mensajes de commit (`commitlint`, Conventional Commits).

La revisión humana por pares (*Code Review*) no debe gastar energía en formato o errores sintácticos; debe concentrarse en:
1. Arquitectura y diseño del cambio.
2. Lógica de negocio y consistencia de dominio.
3. Implicaciones de seguridad contextual y modelos de amenaza.
4. Mantenibilidad y deuda técnica.
5. Impacto de rendimiento y resiliencia en runtime.

#### Principio 6 — Separar Código, Release y Deployment
GitHub debe modelar con claridad la frontera entre el historial de desarrollo, la identificación de versiones publicables y el despliegue en entornos de ejecución:

```text
 Commit (Cambio atómico)
   ↓
 Pull Request (Validación en aislamiento)
   ↓
 main (Fuente de verdad integrada)
   ↓
 Release / Git Tag (Versión inmutable de software, e.g. v1.4.0)
   ↓
 Artifact (Binario, contenedor Docker en GHCR, paquete npm)
   ↓
 Environment (development ──► staging ──► production)
   ↓
 Deployment (Proceso de entrega auditado con trazabilidad de commit)
```

*Regla crítica:* Una rama de Git no es un entorno (*environment*). Salvo arquitecturas heredadas que lo demanden explícitamente, no deben existir ramas `staging` o `production` si se puede compilar un artefacto inmutable en `main` y promocionarlo progresivamente a través de GitHub Environments.

---

## 3. Modelo de Decisión Adaptativo

Antes de aplicar cualquier cambio de configuración en GitHub, el repositorio debe ser diagnosticado en cuatro dimensiones fundamentales.

```text
               ┌──────────────────────────────────────────────┐
               │         4-Dimensional Context Matrix         │
               └───────┬──────────────┬──────────────┬────────┘
                       │              │              │
         ┌─────────────▼────┐   ┌─────▼────────┐   ┌─▼──────────────┐   ┌────────────────┐
         │ Dimensión A      │   │ Dimensión B  │   │ Dimensión C    │   │ Dimensión D    │
         │ Tamaño de Equipo │   │ Ciclo Vida   │   │ Criticidad     │   │ Tipo Proyecto  │
         ├──────────────────┤   ├──────────────┤   ├────────────────┤   ├────────────────┤
         │ A0: Solo Dev     │   │ Spike / PoC  │   │ C0: Sandbox    │   │ Backend / API  │
         │ A1: Pequeño (2-5)│   │ MVP          │   │ C1: Normal     │   │ Frontend / Web │
         │ A2: Mediano(5-20)│   │ Mediano Plazo│   │ C2: Business   │   │ Mobile Apps    │
         │ A3: Enterprise   │   │ Largo Plazo  │   │ C3: Critical   │   │ Libraries/IaC  │
         └──────────────────┘   └──────────────┘   └────────────────┘   └────────────────┘
```

### 3.1. Dimensión A — Tamaño y Modelo del Equipo

#### Nivel A0 — Solo Developer (1 desarrollador)
- **Perfil:** Velocidad de iteración máxima, mínimo riesgo de interferencia cruzada.
- **Configuración requerida:**
  - Rama `main` protegida contra eliminación accidental y force-push.
  - CI baseline básico (lint + tests + build).
  - PRs opcionales (posibilidad de pushear directo a `main` si CI valida o uso de PRs ligeros para orden personal).
  - Dependabot activo para parches de seguridad.
  - Secret scanning con Push Protection activo.
  - *Prohibido:* Requerir aprobaciones de terceros (bloquearía el avance al no haber otro integrante) o CODEOWNERS ficticio.

#### Nivel A1 — Equipo Pequeño (2 a 5 desarrolladores)
- **Perfil:** Comunicación directa y continua, pero necesidad de evitar sobreescrituras y regresiones.
- **Configuración requerida:**
  - PR obligatorio para integrar en `main`.
  - 1 aprobación requerida por PR.
  - Required status checks (CI verde antes del merge).
  - Eliminación automática de ramas fusionadas (`Automatically delete head branches`).
  - Bloqueo total de force-pushes y borrado en `main`.
  - Dependabot activo.
  - Environment de producción protegido si realiza despliegues continuos.
  - CODEOWNERS únicamente si existen módulos con dueño de dominio exclusivo (e.g. infraestructura).

#### Nivel A2 — Equipo Mediano (5 a 20 desarrolladores)
- **Perfil:** Múltiples features simultáneas, especialización por áreas, riesgo de cuellos de botella y desincronización.
- **Configuración requerida:**
  - GitHub Rulesets aplicados a ramas troncales y de release.
  - `CODEOWNERS` estructurado por dominios técnicos o módulos.
  - 1 a 2 aprobaciones obligatorias según la criticidad de la ruta afectada.
  - `Dismiss stale pull request approvals when new commits are pushed` activado.
  - Require linear history o merge mediante Squash forzado.
  - Dependency Review en PRs para evitar supply-chain attacks.
  - CodeQL / SAST habilitado en el pipeline de CI.
  - Separación formal de entornos: `staging` (automático) y `production` (con revisores requeridos).
  - Permisos asignados exclusivamente a través de GitHub Teams (no miembros individuales).
  - Reusable Workflows para compartir lógica común de CI/CD.

#### Nivel A3 — Organización Grande / Enterprise (20+ desarrolladores o múltiples equipos)
- **Perfil:** Cumplimiento normativo, auditoría estricta, gobernanza federada y estandarización a escala.
- **Configuración requerida:**
  - Rulesets centralizados a nivel Organización aplicados transversalmente a todos los repositorios.
  - Centralized Security Policies y Custom Repository Roles (e.g. Security Auditor, Release Manager).
  - Merge Queue para ramas de alta concurrencia de integración.
  - Commits firmados obligatorios (`Require signed commits` vía GPG/SSH).
  - Repositorio central `.github` para plantillas de flujos de trabajo (*Workflow Templates*) y community files.
  - Reusable workflows obligatorios con permisos inmutables y runners dedicados.

### 3.2. Dimensión B — Duración del Proyecto

| Tipo de Proyecto | Prioridad de Gobernanza | Configuración Clave |
| :--- | :--- | :--- |
| **Spike / Prototipo** | Velocidad y descarte rápido. | CI mínimo, repo privado, sin environments complejos, PRs opcionales. |
| **MVP** | Agilidad con base evolutiva. | `main` protegida, CI esencial, Dependabot, preview deployments automáticos. |
| **Mediano Plazo** | Estabilidad y trabajo en equipo. | PR obligatorio, status checks, CODEOWNERS, environments formales, SemVer. |
| **Largo Plazo** | Mantenibilidad, seguridad y auditoría. | Rulesets, SAST, SBOM, Dependency Review, releases reproducibles, rotación y OIDC. |

### 3.3. Dimensión C — Criticidad

- **C0 — Experimental / Sandbox:** Fallos sin impacto externo ni financiero. Enfoque en velocidad pura.
- **C1 — Aplicación Normal:** Fallos generan inconvenientes operativos moderados. CI completo, PR review obligatorio, Dependabot.
- **C2 — Business Critical:** Fallos paralizan operaciones o impactan directamente en ingresos. Rulesets estrictos, CodeQL, entornos con aprobación manual requerida, OIDC federado, rollback automatizado.
- **C3 — Security / Regulatory Critical (Fintech, Healthtech, Gov, Core Auth):** Auditoría estricta, commits firmados, múltiple revisión obligatoria, escaneo continuo de vulnerabilidades, retención de logs, attestations de artefactos criptográficos y permisos Zero Trust.

### 3.4. Dimensión D — Tipo de Proyecto
Ajuste según la naturaleza técnica del artefacto (Backend, Frontend, Mobile, Open Source, Library, ML/Data, IaC, Monorepo o Microservicios). Se detalla en la Fase 23.

---

## 4. Requerimientos del Skill

### 4.1. Requerimientos Funcionales (RF)

- **[RF-01] Context Discovery:** Antes de aplicar cualquier cambio de configuración en GitHub, se debe recolectar y documentar el contexto del proyecto (tipo, equipo, duración, criticidad, modelo de despliegue).
- **[RF-02] Visibility:** Definir conscientemente la visibilidad del repositorio (`public`, `private` o `internal`) evaluando implicaciones de propiedad intelectual y límites de funciones por plan.
- **[RF-03] Access Governance:** Configurar el acceso mediante el principio de mínimo privilegio utilizando GitHub Teams en organizaciones y evitando permisos administrativos directos a desarrolladores.
- **[RF-04] Branch Governance:** Proteger la default branch (`main`) mediante Rulesets modernos o Branch Protection rules proporcionadas a la criticidad.
- **[RF-05] Merge Strategy:** Definir explícitamente los métodos de fusión aceptados en el repositorio (Squash, Rebase o Merge Commit) según la política de historia del equipo.
- **[RF-06] Pull Request Governance:** Configurar plantillas de PR (`pull_request_template.md`), checklist de verificación y reglas de revisión proporcionales al riesgo.
- **[RF-07] Continuous Integration:** Implementar pipelines automatizados de CI que bloqueen el merge si fallan lint, formateo, tipado, tests o build.
- **[RF-08] GitHub Actions Security:** Declarar permisos explícitos y restrictivos en todos los workflows mediante la directiva `permissions:` a nivel de workflow y job.
- **[RF-09] Dependency Governance:** Habilitar Dependabot para actualizaciones de seguridad y versiones con agrupamiento inteligente de PRs.
- **[RF-10] Secret Management:** Prohibir cualquier credencial productiva en el código fuente o variables no encriptadas, integrando Secret Scanning con Push Protection.
- **[RF-11] Deployment Governance:** Aislar secretos y permisos de despliegue en GitHub Environments con Deployment Protection Rules en entornos críticos.
- **[RF-12] Release Governance:** Definir una estrategia de versionado semántico (SemVer) con tags y GitHub Releases inmutables y trazables.
- **[RF-13] Code Ownership:** Implementar `.github/CODEOWNERS` vinculando rutas críticas del repositorio a equipos responsables cuando exista ownership real.
- **[RF-14] Community Governance:** Proveer archivos estándar de comunidad (`README.md`, `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`) en repositorios públicos o colaborativos.
- **[RF-15] Supply Chain Security:** Analizar acciones de terceros (fijadas por commit SHA), dependencias transitivas mediante Dependency Review y generar attestations de artefactos.
- **[RF-16] Large Asset Handling:** Establecer una política explícita para archivos de gran volumen (bloquear datasets pesados en Git, evaluar Git LFS u Object Storage externo).

### 4.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Seguridad:** Ningún workflow debe poseer permisos `write-all` salvo que una tarea de administración de releases lo demande justificadamente y en aislamiento.
- **[RNF-02] Auditabilidad:** Todo commit introducido en ramas productivas debe ser trazable a un Pull Request aprobado o a una identidad verificada.
- **[RNF-03] Escalabilidad:** La configuración de gobernanza debe poder evolucionar de 1 a 50 desarrolladores sin requerir la reconstrucción del repositorio.
- **[RNF-04] Mantenibilidad:** La estructura de automatizaciones y políticas en `.github/` debe ser comprensible y legible para cualquier ingeniero recién incorporado.
- **[RNF-05] Reproducibilidad:** Cualquier versión liberada debe poder reconstruirse de forma determinista a partir de su commit tag y configuración declarativa.
- **[RNF-06] Resiliencia:** Los workflows no deben introducir dependencias frágiles que bloqueen la operación ante caídas menores de servicios externos secundarios.
- **[RNF-07] Observabilidad:** Los pipelines de CI/CD deben estructurar sus pasos en jobs claros con nombres significativos y logs limpios para facilitar el diagnóstico.
- **[RNF-08] Portabilidad:** Las políticas y scripts de validación deben poder ejecutarse localmente por los ingenieros sin depender exclusivamente del entorno de GitHub Actions.

---

## 5. Ecosistema de Herramientas de GitHub

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      GitHub Ecosystem Classification                   │
├─────────────────┬──────────────────────────────────────────────────────┤
│ Plataforma Base │ Repositories, Organizations, Teams, PRs, Issues,     │
│                 │ Discussions, Projects, Releases                      │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Gobernanza      │ Rulesets (Bypass lists, conditions), Branch          │
│                 │ Protection, CODEOWNERS, Environments, Roles          │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Seguridad       │ Secret Scanning, Push Protection, CodeQL (SAST),     │
│                 │ Security Advisories, Dependabot Alerts, SECURITY.md  │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Supply Chain    │ Dependabot Updates, Dependency Review, GHCR          │
│                 │ (Packages), Artifact Attestation, Action SHA Pinning │
├─────────────────┼──────────────────────────────────────────────────────┤
│ Despliegue      │ GitHub Actions, Environments, OIDC (AWS, GCP, Azure),│
│                 │ Deployment Protection Rules, Concurrency Groups      │
└─────────────────┴──────────────────────────────────────────────────────┘
```

---

## 6. Metodología de Práctica en 30 Fases

### Fase 1 — Discovery del Proyecto
Antes de modificar cualquier opción en GitHub Settings o crear flujos en `.github/`, completar el diagnóstico formal del repositorio:

```text
# Repository Assessment Form
PROJECT_NAME=ecommerce-backend-api
PROJECT_TYPE=Backend API
ARCHITECTURE=Modular Monolith (NestJS / Prisma / Postgres)
TEAM_SIZE=6 (Equipo Mediano - A2)
EXPECTED_LIFETIME=Largo Plazo (> 2 años)
CRITICALITY=C2 (Business Critical)
VISIBILITY=private
GIT_WORKFLOW=GitHub Flow con Squash Merges
DEPLOYMENT_MODEL=Cloud Containerized (AWS ECS vía OIDC)
NUMBER_OF_ENVIRONMENTS=2 (staging, production)
PACKAGE_ECOSYSTEM=npm (Node.js 22 LTS)
PUBLIC_CONTRIBUTORS=false
LARGE_FILES=false
CLOUD_PROVIDER=AWS
```

#### Cuestionario Obligatorio de Diagnóstico
1. **Producto:** ¿Es un prototipo desechable o un producto que soportará clientes reales? ¿Se distribuye como paquete o se despliega en infraestructura de red?
2. **Equipo:** ¿Cuántos ingenieros realizan commits semanalmente? ¿Existen roles de Tech Lead o especialistas de DevOps/Seguridad?
3. **Seguridad:** ¿El sistema procesa credenciales, datos personales (PII) o transacciones financieras? ¿Qué proveedor cloud aloja el servicio?
4. **Arquitectura:** ¿Es monorepo, microservicio individual, monolito, biblioteca o modelo de machine learning?

### Fase 2 — Configuración Base del Repositorio
Configurar en GitHub Settings:
- **Repository Name:** En minúsculas con guiones medios (`kebab-case`), descriptivo del artefacto (`auth-service`, `customer-portal-web`).
- **Description:** Resumen en una línea del propósito del repositorio.
- **Topics:** Etiquetas semánticas clave (`nodejs`, `nestjs`, `typescript`, `api`, `aws`).
- **Default Branch:** Establecer `main` como rama troncal universal (evitar términos obsoletos).
- **Visibility:** Seleccionar `private` por defecto para código propietario o corporativo.

### Fase 3 — Features del Repositorio
Desactivar las características que no aporten valor para evitar superficies de confusión:
- **Issues:** Mantener activo si el backlog se gestiona en GitHub. Desactivar en microservicios puramente técnicos si la organización utiliza Jira de forma estricta.
- **Projects:** Activar únicamente si GitHub Projects es la herramienta oficial de seguimiento de tareas del equipo (evitar sincronizaciones dobles con Jira/Linear sin automatizar).
- **Discussions:** Habilitar para comunidades open source o foros de RFCs técnicos. Desactivar en equipos pequeños con comunicación interna centralizada (Slack/Teams).
- **Wiki:** Desactivar por defecto. La documentación técnica debe residir en el código fuente (`/docs`) versionada mediante Pull Requests.

### Fase 4 — Estrategia de Merge (Merge Strategy)
Definir un único modelo coherente según el flujo de trabajo:

```text
┌─────────────────────────┬────────────────────────────────────────────────────────┐
│ Estrategia              │ Recomendación de Uso                                   │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ Squash and merge        │ (Predeterminada para SaaS / GitHub Flow)               │
│                         │ Convierte el PR completo en 1 commit lógico en main.   │
│                         │ Mantiene el historial limpio, lineal y fácil de revertir.│
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ Rebase and merge        │ Para equipos con alta disciplina de commits atómicos.  │
│                         │ Requiere que cada commit individual en la rama sea     │
│                         │ testeable y de calidad de producción.                 │
├─────────────────────────┼────────────────────────────────────────────────────────┤
│ Merge commit            │ Para Git Flow clásico o release branches donde la      │
│                         │ topología de ramificación tenga valor histórico real.  │
└─────────────────────────┴────────────────────────────────────────────────────────┘
```

*Configuración recomendada para la mayoría de aplicaciones web:*
- ✅ Allow Squash merging (con opción predeterminada de usar el título y descripción del PR).
- ❌ Desmarcar Allow merge commits.
- ❌ Desmarcar Allow rebase merging.

### Fase 5 — Automatic Branch Cleanup
Habilitar en Settings -> General:
- ✅ **Automatically delete head branches:** Elimina automáticamente la rama origen una vez que el PR es fusionado. Previene acumulación de cientos de ramas obsoletas y referencias huérfanas.

---

### Fase 6 — Rulesets y Branch Protection
Los **GitHub Rulesets** representan el estándar moderno de gobernanza sobre ramas y tags, superando a las clásicas Branch Protection Rules al permitir:
- Múltiples reglas concurrentes con combinación acumulativa.
- Bypass lists granulares basadas en roles, equipos o GitHub Apps autorizadas.
- Reglas aplicables a múltiples ramas mediante patrones (`main`, `release/*`).

#### Configuración de Ruleset Base para `main` (Nivel A1/A2/A3)
- **Target:** Branch name pattern `refs/heads/main`.
- **Enforcement status:** Active.
- **Restricciones nucleares:**
  - ✅ Restrict deletions (impide eliminar la rama).
  - ✅ Block force pushes (bloquea `git push --force` y sobreescrituras).
  - ✅ Require a pull request before merging:
    - Required approvals: 1 (Equipo Pequeño) a 2 (Fintech / Enterprise).
    - Dismiss stale pull request approvals when new commits are pushed: Activado.
    - Require review from Code Owners: Activado en módulos sensibles.
    - Require conversation resolution: Activado (todas las conversaciones deben cerrarse).
  - ✅ Require status checks to pass:
    - Require branches to be up to date before merging: Activado (evita merges desactualizados).
    - Checks requeridos: `CI / Validate Code (Lint, Test, Build)`.
  - ○ Require signed commits (Activado en entornos C3 con auditoría criptográfica).

---

### Fase 7 — Perfiles de Gobernanza por Equipo
Ver [Sección 7: Perfiles Predefinidos](#7-perfiles-de-configuración-predefinidos) para el detalle operativo de los perfiles `SOLO`, `TEAM` y `CRITICAL`.

---

### Fase 8 — CODEOWNERS
Crear `.github/CODEOWNERS` para definir revisores automáticos y autorizados por área técnica:

```gitignore
# .github/CODEOWNERS
# Sintaxis: <patrón de ruta> <dueño(s)>

# Dueños globales por defecto del repositorio
*                   @mi-organizacion/tech-leads

# Backend y APIs
/apps/api/          @mi-organizacion/backend-team
/prisma/            @mi-organizacion/backend-team @mi-organizacion/dba-leads

# Frontend y UI
/apps/web/          @mi-organizacion/frontend-team
/packages/ui/       @mi-organizacion/design-system-team

# Infraestructura, Cloud y CI/CD
/infra/             @mi-organizacion/devops-team
/.github/           @mi-organizacion/devops-team @mi-organizacion/security-leads

# Seguridad y Políticas
SECURITY.md         @mi-organizacion/security-leads
/.agents/skills/    @mi-organizacion/tech-leads
```

> [!CAUTION]
> **Protección del propio archivo CODEOWNERS:** Proteger siempre la ruta `/.github/` mediante un equipo con privilegios de arquitectura o seguridad. Si cualquier desarrollador puede modificar `CODEOWNERS` sin restricción, podría auto-aprobarse cambios críticos o deshabilitar la supervisión.

---

### Fase 9 — Pull Request Governance
Estandarizar el contexto que todo colaborador debe aportar al abrir una propuesta de cambio mediante `.github/pull_request_template.md`:

```markdown
<!-- .github/pull_request_template.md -->
## 📌 Contexto & Motivación
<!-- Explicá brevemente qué problema resuelve este cambio y por qué es necesario. -->

Relacionado con Issue: #

## 🛠️ Cambios Realizados
<!-- Lista concisa de las modificaciones principales introducidas. -->
- 

## 🧪 Estrategia de Validación
<!-- Marcá las comprobaciones realizadas antes de solicitar review. -->
- [ ] Pruebas unitarias ejecutadas y aprobadas (`npm run test`)
- [ ] Pruebas de integración o E2E validadas localmente
- [ ] Linter y verificación de tipos sin errores (`npm run lint`, `npm run typecheck`)
- [ ] Verificado en entorno local / preview deployment

## ⚠️ Riesgos & Plan de Rollback
<!-- ¿Existe riesgo de rotura de contratos de API o migraciones destructivas? -->
- **Nivel de Riesgo:** Bajo / Medio / Alto
- **Plan de Reversión:** Revert del commit vía PR / Feature Flag deshabilitada
```

---

### Fase 10 — Issue Templates (Formularios YAML)
Crear formularios modernos en `.github/ISSUE_TEMPLATE/` con validación de campos obligatorios.

#### 1. Reporte de Bug (`.github/ISSUE_TEMPLATE/bug.yml`):
```yaml
name: "🐛 Reporte de Bug"
description: Notificar un fallo inesperado o error de comportamiento en la aplicación
labels: ["bug", "triage"]
body:
  - type: markdown
    attributes:
      value: "Gracias por reportar el fallo. Por favor completá los detalles para facilitar su reproducción."
  - type: textarea
    id: description
    attributes:
      label: Descripción del Fallo
      description: ¿Qué ocurrió de forma anómala?
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: Pasos para Reproducir
      description: 1. Ir a...\n2. Hacer click en...\n3. Ver error...
    validations:
      required: true
  - type: input
    id: environment
    attributes:
      label: Entorno y Versión
      placeholder: "Node.js 22.x, Chrome 130, Docker, commit SHA..."
    validations:
      required: true
```

#### 2. Solicitud de Funcionalidad (`.github/ISSUE_TEMPLATE/feature.yml`):
```yaml
name: "✨ Propuesta de Funcionalidad"
description: Proponer una nueva característica, endpoint o mejora de sistema
labels: ["enhancement", "proposal"]
body:
  - type: textarea
    id: problem
    attributes:
      label: Problema de Usuario o Negocio
      description: ¿Qué limitación actual se busca resolver?
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Solución Propuesta
      description: Detalle técnico o funcional del cambio propuesto.
    validations:
      required: true
```

#### 3. Configuración de Soporte (`.github/ISSUE_TEMPLATE/config.yml`):
```yaml
blank_issues_enabled: false
contact_links:
  - name: Canal de Soporte del Equipo
    url: https://discord.gg/ejemplo
    about: Si tenés dudas generales de configuración, consultá en nuestra comunidad.
```

---

### Fase 11 — Estructura de GitHub Actions
Organizar los workflows en `.github/workflows/` de forma modular y con propósitos específicos:

```text
.github/workflows/
├── ci.yml                 # Integración continua (lint, typecheck, tests, build)
├── security-scan.yml      # CodeQL y auditoría estática
├── dependency-review.yml  # Análisis de dependencias en Pull Requests
├── release.yml            # Generación de tag y release ante merges en main
└── deploy-prod.yml        # Despliegue en producción condicionado por Environment
```

---

### Fase 12 — Pipeline de CI Baseline (Completo y Endurecido)
Pipeline determinista de integración continua en `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# Cancelar ejecuciones obsoletas del mismo PR ante nuevos pushes
concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Principio de Least Privilege: Solo lectura de código
permissions:
  contents: read

jobs:
  validate:
    name: Validate Code (Lint, Test, Build)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Setup Node.js runtime
        uses: actions/setup-node@39370e3970a6d050c480ffad4ff0ed4d3fdee5af # v4.1.0
        with:
          node-version: 22
          cache: 'npm'

      - name: Install dependencies strictly
        run: npm ci

      - name: Lint and Format Check
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Run Test Suite
        run: npm run test:coverage
        env:
          CI: true

      - name: Build Application
        run: npm run build
```

---

### Fase 13 — Seguridad en GitHub Actions (Least Privilege)
Tratar a los workflows de GitHub Actions como **código de producción con acceso a secretos y despliegues**.

```yaml
# ❌ PELIGROSO: Concede permisos de escritura absolutos a todos los recursos
permissions: write-all

# ✅ SEGURO: Bloquea todo por defecto y especifica sólo lo necesario
permissions:
  contents: read

# Si un job específico necesita crear un comentario o publicar un release,
# se escalan permisos exclusivamente en ese job:
jobs:
  publish-release:
    runs-on: ubuntu-latest
    permissions:
      contents: write   # Para crear tags y releases en GitHub
      packages: write   # Para publicar imágenes en GHCR
```

---

### Fase 14 — Seguridad de Actions de Terceros (Full SHA Pinning)
En entornos críticos (C2/C3), nunca confiar ciegamente en tags mutables como `@v4` o `@main`, ya que un atacante que comprometa la cuenta del creador de la Action puede alterar el código ejecutado en tu pipeline.

```yaml
# ❌ VULNERABLE A MODIFICACIÓN MALICIOSA DEL TAG:
uses: actions/checkout@v4

# ✅ INMUTABLE Y CRIPTOGRÁFICAMENTE AUDITABLE:
uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
```

*Automatización:* Dependabot se encarga de actualizar automáticamente estos SHA hashes cuando se publica una nueva versión segura.

---

### Fase 15 — Secrets y Variables
Diferenciar estrictamente los alcances de configuración en GitHub:

```text
┌──────────────────────┬────────────────────────────────────────────────────────┐
│ Tipo                 │ Uso Destinado                                          │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Repository Variables │ Datos no sensibles comunes: AWS_REGION, APP_ENV, PORT. │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Repository Secrets   │ Credenciales globales necesarias en múltiples flujos.  │
├──────────────────────┼────────────────────────────────────────────────────────┤
│ Environment Secrets  │ Credenciales de máximo riesgo (claves productivas,     │
│                      │ tokens de pago). Aisladas exclusivamente para el       │
│                      │ Environment de Producción con revisión obligatoria.   │
└──────────────────────┴────────────────────────────────────────────────────────┘
```

---

### Fase 16 — Despliegues Cloud mediante OIDC (Zero Permanent Keys)
Eliminar el almacenamiento de claves permanentes de AWS (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) o Service Accounts de GCP en GitHub Secrets. Utilizar **OpenID Connect (OIDC)** para intercambiar tokens criptográficos temporales:

```yaml
# .github/workflows/deploy-aws.yml
name: Deploy to Production

on:
  push:
    branches: [main]

permissions:
  id-token: write   # Requerido obligatoriamente para solicitar el token OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: production   # Sujeto a reglas de protección del entorno

    steps:
      - name: Checkout code
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Configure AWS Credentials via OIDC
        uses: aws-actions/configure-aws-credentials@ececac1a45f371a57523bc0e85b23052255476d6 # v4.1.0
        with:
          role-to-assume: arn:aws:iam::123456789012:role/GitHubActionsProductionDeployRole
          aws-region: us-east-1
          audience: sts.amazonaws.com

      - name: Deploy container to ECS
        run: |
          aws ecs update-service --cluster prod-cluster --service api-service --force-new-deployment
```

---

### Fase 17 — Environments y Deployment Protection Rules
Crear entornos de ejecución en Settings -> Environments:
1. **`staging`**:
   - Deployment automático ante fusiones en `main`.
   - Variables asociadas al entorno de pruebas.
2. **`production`**:
   - **Required reviewers:** Requiere la aprobación explícita de al menos 1 Tech Lead o Release Manager.
   - **Deployment branches:** Restringido exclusivamente a la rama `main` o tags `v*`.
   - **Environment secrets:** Credenciales aisladas que los desarrolladores estándar no pueden ver ni utilizar en PRs comunes.

---

### Fase 18 — Dependabot Version & Security Updates
Crear `.github/dependabot.yml` para gestionar actualizaciones semanales agrupadas:

```yaml
# .github/dependabot.yml
version: 2
updates:
  # Actualización de dependencias del proyecto (npm)
  - package-ecosystem: "npm"
    directory: "/"
    schedule:
      interval: "weekly"
      day: "monday"
      time: "06:00"
      timezone: "America/Argentina/Buenos_Aires"
    open-pull-requests-limit: 10
    groups:
      production-dependencies:
        patterns:
          - "*"
        exclude-patterns:
          - "@types/*"
          - "eslint*"
          - "prettier*"
      development-dependencies:
        dependency-type: "development"
        patterns:
          - "@types/*"
          - "eslint*"
          - "prettier*"
          - "typescript"

  # Actualización de GitHub Actions
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    groups:
      github-actions:
        patterns:
          - "*"
```

---

### Fase 19 — Dependency Review en Pull Requests
Bloquear la incorporación de paquetes vulnerables o licencias incompatibles antes de que entren a `main`:

```yaml
# .github/workflows/dependency-review.yml
name: 'Dependency Review'

on: [pull_request]

permissions:
  contents: read

jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2

      - name: Run Dependency Review
        uses: actions/dependency-review-action@5a2ce3f5b92ee19cbb1541a4984c76d92160ad44 # v4.3.4
        with:
          fail-on-severity: high
          deny-licenses: GPL-3.0, AGPL-3.0
```

---

### Fase 20 — Secret Scanning y Push Protection
Activar en Settings -> Code security and analysis:
- ✅ **Secret scanning:** Analiza commits históricos en busca de claves filtradas.
- ✅ **Push protection:** Bloquea activamente el comando `git push` del desarrollador en el instante en que intenta subir una clave privada o token reconocido.

---

### Fase 21 — Code Scanning / CodeQL (SAST)
Habilitar análisis estático de vulnerabilidades de seguridad:
- **Default Setup:** Recomendado para proyectos estándar de JavaScript/TypeScript, Python, Go. GitHub gestiona los triggers y actualizaciones automáticamente.
- **Advanced Setup:** Usar cuando el proyecto requiere compilar código con flags personalizados (C++, Java) o consultar reglas SARIF de escáneres externos (`Snyk`, `SonarCloud`).

---

### Fase 22 — Security Policy (`SECURITY.md`)
Publicar la política de reporte responsable en la raíz del proyecto:

```markdown
<!-- SECURITY.md -->
# Política de Seguridad

## Versiones Soportadas
Actualmente solo la última versión liberada en producción recibe parches de seguridad.

| Versión | Soportada          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |
| < 1.0   | :x:                |

## Reporte de Vulnerabilidades
**No reportes fallos de seguridad mediante Issues públicos.**

Por favor, enviá un reporte confidencial utilizando el mecanismo de **Private Vulnerability Reporting** de este repositorio en GitHub, o escribinos directamente a: `security@mi-empresa.com`.

Nos comprometemos a acusar recibo dentro de las 48 horas hábiles y coordinar la divulgación responsable una vez que el parche esté disponible.
```

---

### Fase 23 — Adaptación Específica por Naturaleza de Proyecto

#### 23.1. Backend / APIs
- Compilación de imágenes Docker con escaneo de vulnerabilidades (`Trivy`).
- Publicación de imágenes versionadas en GitHub Container Registry (`ghcr.io`).
- Migraciones de base de datos (`prisma migrate deploy`) orquestadas en jobs aislados de CD.

#### 23.2. Frontend
- Validación estricta de bundle-size y análisis de Web Vitals.
- Generación de **Preview Deployments** automáticos por PR (Vercel, Cloudflare Pages o Netlify).
- Pruebas visuales de componentes (Playwright / Cypress) en PRs.

#### 23.3. Mobile (React Native / Flutter / iOS / Android)
- Gestión de certificados y keystores en Secrets protegidos con rotación.
- Compilación en runners dedicados de macOS/Linux.
- Generación y retención de artefactos (`.ipa`, `.aab`) como release assets.

#### 23.4. Open Source
- Archivos comunitarios obligatorios (`LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`).
- Issues forms y Discussions activas para canalizar el soporte.
- Automatización de `stale` para archivar issues inactivos.

#### 23.5. Library / SDK
- Pruebas en matriz con múltiples versiones de runtime (Node.js 18, 20, 22).
- Release automatizado con **Changesets** o **Release-Please**.
- Publicación condicionada de paquetes en npm / PyPI con token de procedencia segura (npm provenance).

#### 23.6. Data Science / Machine Learning
- **Separación de responsabilidades:**
  - Código, scripts de entrenamiento y schemas en Git.
  - Datasets pesados (>100 MB) alojados en Object Storage (AWS S3, GCS) y versionados con herramientas dedicadas (**DVC**).
  - Modelos compilados y pesos registrados en Model Registries (MLflow, Hugging Face, WandB).
  - Git LFS únicamente para assets binarios inmutables de tamaño moderado indispensables en el repositorio.

#### 23.7. Infrastructure as Code (Terraform / Pulumi)
- Validación de sintaxis (`terraform fmt -check`, `terraform validate`).
- Análisis estático de seguridad de IaC con `trivy` o `checkov`.
- **Flujo Plan/Apply:**
  - En PR: Se ejecuta `terraform plan` y se publica el resultado como comentario auditado.
  - En `main`: Se aplica `terraform apply` únicamente previa aprobación en el Environment protegido.

#### 23.8. Monorepos
- Implementar filtrado de rutas (`dorny/paths-filter`) para ejecutar pipelines únicamente en los servicios modificados.
- Aprovechar herramientas de caché distribuido (Turborepo, Nx).

---

### Fase 24 — Reusable Workflows (`workflow_call`)
Evitar la duplicación de flujos de CI entre decenas de repositorios de una organización mediante workflows compartidos:

```yaml
# .github/workflows/reusable-node-ci.yml en org/.github
name: Reusable Node CI

on:
  workflow_call:
    inputs:
      node-version:
        required: false
        type: string
        default: '22'
    secrets:
      NPM_TOKEN:
        required: false

jobs:
  run-ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node-version }}
      - run: npm ci
      - run: npm test
```

---

### Fase 25 — Workflow Templates a Nivel Organización
Publicar plantillas oficiales en el repositorio `.github` de la organización dentro de `.github/workflow-templates/`. Esto permite que cualquier equipo, al crear un nuevo servicio, seleccione el pipeline homologado con un solo click.

---

### Fase 26 — Release Management & SemVer
Implementar versionado semántico formal (`vX.Y.Z`):
- `MAJOR`: Cambios incompatibles con la API existente.
- `MINOR`: Nuevas funcionalidades retrocompatibles.
- `PATCH`: Corrección de errores retrocompatible.

Herramientas recomendadas para automatizar changelogs y tags basados en Conventional Commits:
- `release-please` (Google).
- `semantic-release`.
- `@changesets/cli` (especialmente en monorepos).

---

### Fase 27 — GitHub Packages & Container Registry (GHCR)
Aprovechar `ghcr.io` para alojar imágenes Docker vinculadas directamente a los commits y releases del repositorio con autenticación transparente mediante `GITHUB_TOKEN`.

---

### Fase 28 — Portfolio y Proyectos Personales
Para desarrolladores individuales:
- Priorizar señal técnica limpia: `README.md` impecable con arquitectura y demo visual, badges de CI verde, tests automatizados y código prolijo.
- **Evitar burocracia ficticia:** No crear CODEOWNERS con un solo usuario ni configurar aprobaciones obligatorias que impidan avanzar de forma ágil.

---

### Fase 29 — Matriz Adaptativa Contextual

| Contexto de Proyecto | Nivel Gobernanza | Pipeline CI | Escaneo de Seguridad | Estrategia de Despliegue |
| :--- | :--- | :--- | :--- | :--- |
| **Hackathon / Spike** | Mínima | Lint básico | Push Protection | PaaS automático (Render/Vercel) |
| **Portfolio Personal** | Liviana | Lint + Tests | Dependabot | Automático / Preview |
| **MVP Startup** | Media | Completo | Dependabot + Secret Scanning | CD automático con staging |
| **SaaS B2B (C2)** | Alta | Completo + SAST | CodeQL + Dependency Review | Staging auto + Prod con approval |
| **Fintech / C3** | Máxima | Exhaustivo | DevSecOps total + Firmas | Multi-gate approval + OIDC |
| **Open Source** | Media-Alta | Matrices multi-SO | Dependabot + Security Policy | Releases automatizadas SemVer |
| **Library / SDK** | Media | Multi-runtime | Dependency Scanning | Publicación en npm/PyPI |
| **Data / ML Prod** | Alta | Tests + Data checks | Secret scanning + SAST | Despliegue de modelo vía Registry |
| **IaC / Infra** | Muy Alta | Plan en PR / SAST | IaC Security Scanning (Trivy) | Manual production gate |

---

### Fase 30 — Árbol Meta-Configurativo Completo

```text
mi-repositorio-profesional/
│
├── .github/
│   ├── CODEOWNERS                      # Asignación declarativa de revisores
│   │
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml                     # Formulario de bugs
│   │   ├── feature.yml                 # Formulario de mejoras
│   │   └── config.yml                  # Configuración general de issues
│   │
│   ├── workflows/
│   │   ├── ci.yml                      # Validación continua de código
│   │   ├── security-scan.yml           # CodeQL / SAST
│   │   ├── dependency-review.yml       # Análisis de dependencias en PR
│   │   ├── release.yml                 # Automatización de releases SemVer
│   │   └── deploy-prod.yml             # Despliegue OIDC en producción
│   │
│   ├── pull_request_template.md        # Plantilla de Pull Request
│   ├── dependabot.yml                  # Actualización de dependencias
│   └── dependency-review-config.yml    # Reglas de bloqueo de dependencias
│
├── docs/                               # Documentación arquitectónica
├── .editorconfig                       # Estandarización de indentación
├── .gitignore                          # Exclusiones de Git
├── .gitattributes                      # Normalización de saltos de línea y LFS
│
├── README.md                           # Visión general y puesta en marcha
├── LICENSE                             # Términos de licenciamiento
├── SECURITY.md                         # Procedimiento de divulgación segura
├── CONTRIBUTING.md                     # Guía para contribuyentes
└── CODE_OF_CONDUCT.md                  # Normas de convivencia del proyecto
```

---

## 7. Perfiles de Configuración Predefinidos

### 7.1. PROFILE — SOLO (Desarrollador Individual / Portfolio)
```text
Gobernanza de Ramas:
  - main: Eliminación bloqueada, force-push bloqueado.
  - PRs: Opcionales (útiles para feature branches ordenadas).
  - Aprobadores requeridos: 0.

Automatización & CI:
  - Workflow: ci.yml (Lint, Tests, Build).
  - Permisos de Actions: permissions: contents: read.

Seguridad:
  - Dependabot activo (frecuencia semanal).
  - Secret Scanning y Push Protection habilitados.

Despliegue:
  - Despliegue continuo automático a PaaS (Vercel, Render, Railway).
```

### 7.2. PROFILE — TEAM (Startup / Producto SaaS / 2 a 15 Devs)
```text
Gobernanza de Ramas (Ruleset):
  - main: Protegida. Eliminación y force-push bloqueados.
  - PRs: Obligatorios para cualquier cambio hacia main.
  - Aprobadores requeridos: 1 aprobación de par.
  - Dismiss stale approvals: Habilitado ante nuevos commits.
  - Status Checks obligatorios: CI / Validate Code debe pasar antes del merge.
  - Resoluciones de conversación: Todas las conversaciones resueltas.
  - Branch cleanup: Eliminación automática de head branches fusionadas.

Automatización & CI:
  - Workflows: ci.yml, dependency-review.yml, release.yml.
  - Estrategia de merge: Squash and merge mandatorio.

Seguridad:
  - Dependabot con agrupamiento inteligente.
  - Dependency Review bloqueando vulnerabilidades altas o críticas.
  - Secret Scanning + Push Protection.
  - CodeQL default setup.

Gobernanza & Roles:
  - CODEOWNERS asignado a rutas de arquitectura crítica e infraestructura.
  - Environments: staging (despliegue automático) y production (con secretos aislados).
```

### 7.3. PROFILE — CRITICAL (Fintech / Enterprise / C2-C3)
```text
Gobernanza de Ramas (Rulesets Organizacionales):
  - main y release/*: Bloqueo absoluto de force-push y bypass individual.
  - PRs: Mínimo 2 aprobaciones independientes requeridas.
  - CODEOWNERS obligatorio: Aprobación mandatoria del Code Owner de la ruta afectada.
  - Merge Queue: Activada para integración serializada y re-testeo sobre estado actual.
  - Commits firmados: Require signed commits (GPG/SSH) obligatorio.

Automatización & CI:
  - Actions Pinning: Todas las Actions fijadas por commit SHA inmutable de 40 caracteres.
  - Permisos GITHUB_TOKEN: Mínimo privilegio estricto por job.
  - Workflows reusables con templates centralizados en repo .github.

Seguridad:
  - CodeQL con suites de seguridad avanzadas.
  - Secret Scanning con Push Protection sin opción de bypass para desarrolladores.
  - Dependency Review con bloqueo de licencias no autorizadas (e.g. AGPL).
  - Attestations criptográficas de artefactos y contenedores en GHCR.

Despliegue:
  - Conexión cloud exclusiva mediante OIDC (sin claves permanentes).
  - Environment production protegido con 2 aprobadores requeridos y ventana de despliegue.
```

---

## 8. Catálogo Exhaustivo de Antipatrones

| # | Antipatrón | Causa Raíz Común | Consecuencia Técnica | Solución Profesional |
| :- | :--- | :--- | :--- | :--- |
| **01** | **Burocracia Decorativa** | Copiar configuraciones corporativas en proyectos individuales o spikes. | Fricción sin valor, auto-bloqueo al requerir aprobaciones imposibles, abandono de CI. | Aplicar el perfil `SOLO`; configurar únicamente protecciones contra borrado accidental. |
| **02** | **Rama `main` sin Protección** | Desconocimiento de Rulesets o prisa por desplegar rápido. | Sobreescritura del historial por `push --force`, pérdida accidental de código productivo. | Activar Ruleset bloqueando force-push y deletion como baseline innegociable. |
| **03** | **Permisos de Admin Globales** | Asignación perezosa de accesos a todo el equipo. | Violación de Least Privilege; riesgo de borrado de repo o alteración de secretos. | Conceder rol `Write` o `Triage` mediante GitHub Teams; reservar `Admin` a leads. |
| **04** | **`permissions: write-all`** | Evitar errores de permisos en GitHub Actions por conveniencia. | Escalada de privilegios; si una dependencia se compromete, puede alterar releases. | Configurar `permissions: contents: read` a nivel raíz y escalar por job individual. |
| **05** | **Credenciales Cloud Estáticas** | Usar `AWS_ACCESS_KEY` permanente en Secrets. | Riesgo de filtración, costo operativo de rotación, falta de trazabilidad temporal. | Implementar federación de identidades mediante GitHub OIDC con roles IAM efímeros. |
| **06** | **Dependabot Caótico** | Habilitar Dependabot sin agrupación ni schedule semanal. | Inundación de 40 PRs individuales simultáneos, fatiga de alertas y revisión nula. | Configurar `groups` en `dependabot.yml` para consolidar PRs en lotes coherentes. |
| **07** | **CODEOWNERS Fantasma** | Asignar usuarios que abandonaron la empresa o no revisan. | Bloqueo absoluto de merges por falta de firmas o firmas automáticas sin lectura. | Auditar trimestralmente `CODEOWNERS` y asignar siempre GitHub Teams, nunca individuos. |
| **08** | **Misma Aprobación para Todo** | Exigir 2 aprobaciones para corregir un typo en la documentación. | Cuellos de botella y ralentización severa de entregas de bajo riesgo. | Diferenciar reglas por criticidad de ruta o utilizar CODEOWNERS adaptativo. |
| **09** | **Secretos Globales para Todo** | Colocar claves de producción a nivel de Repository Secrets. | Cualquier PR de una feature branch podría leer o comprometer credenciales productivas. | Aislar credenciales críticas en GitHub Environments protegidos por reviewers. |
| **10** | **Actions de Terceros sin Evaluar** | Usar `@master` o acciones no verificadas de usuarios desconocidos. | Ataque a la cadena de suministro (Supply Chain); exfiltración silenciosa de secretos. | Fijar Actions por commit SHA inmutable (`@<full-sha>`) y auditar creadores. |
| **11** | **Ramas como Entornos Físicos** | Crear ramas `dev`, `stage`, `prod` sincronizadas a mano con merges. | Desviación de código (*branch drift*), historial caótico y merges conflictivos. | Utilizar Trunk-Based/GitHub Flow con artefactos inmutables promovidos por Environments. |
| **12** | **Datasets Gigantescos en Git** | Subir archivos de 5 GB (`git add data.csv`) confundiéndolo con storage. | Repositorio hinchado, clonados lentos, superación de límites duros de GitHub (100 MB). | Utilizar almacenamiento de objetos (S3/GCS) + DVC o Git LFS para binarios estrictos. |
| **13** | **Branch Protection Desactualizado** | No migrar a Rulesets modernos de GitHub. | Políticas fragmentadas, duplicación de reglas e incapacidad de evaluar bypass limpio. | Migrar a GitHub Rulesets para consolidar gobernanza de ramas y tags. |
| **14** | **Workflow Monolítico Gigante** | Crear un solo `ci.yml` de 2000 líneas que compila, testea y despliega todo. | Imposibilidad de reintentar fallos parciales, pipelines frágiles e incomprensibles. | Desacoplar en jobs modulares (`ci.yml`, `security.yml`, `deploy.yml`) con dependencias `needs:`. |
| **15** | **Duplicación de Pipelines** | Copiar y pegar archivos YAML entre 30 microservicios. | Inconsistencias de seguridad y costo altísimo para actualizar un runner o versión de Node. | Centralizar flujos mediante Reusable Workflows en el repositorio `.github` de la org. |
| **16** | **Desproteger `.github/`** | Proteger código en `/src/` pero permitir edición libre de `.github/`. | Un atacante puede alterar los workflows para puentear validaciones y exfiltrar datos. | Añadir la regla `/.github/ @org/platform-leads` en `CODEOWNERS` con aprobación requerida. |

---

## 9. Definition of Done (DoD) de la Gobernanza de Repositorio

La configuración de un repositorio en GitHub se considera terminada y lista para producción cuando:

- [ ] **Contexto Diagnosticado:** Se documentó la matriz de decisión (Tipo, Equipo, Duración, Criticidad, Arquitectura).
- [ ] **Visibilidad Adecuada:** Configurada conscientemente en `private`, `internal` o `public`.
- [ ] **Acceso y Roles:** Permisos asignados mediante GitHub Teams bajo principio de mínimo privilegio.
- [ ] **Protección de `main`:** Ruleset activo bloqueando force-push, deletion y exigiendo checks de CI verdes.
- [ ] **Estrategia de Merge:** Definida de forma consistente (Squash Merge por defecto en SaaS).
- [ ] **Branch Cleanup:** Habilitada la eliminación automática de ramas fusionadas.
- [ ] **CI Determinista:** Pipeline en `.github/workflows/ci.yml` validando lint, tipos, pruebas y build.
- [ ] **Seguridad de Workflows:** Todos los flujos declaran `permissions:` restrictivos (partiendo de `contents: read`).
- [ ] **Inmutabilidad de Acciones:** Actions de terceros fijadas por SHA completo en proyectos C2/C3.
- [ ] **Zero Hardcoded Secrets:** Push Protection y Secret Scanning activos; credenciales eliminadas del código.
- [ ] **Despliegues con OIDC:** Conexión a nubes públicas configurada sin credenciales de larga duración.
- [ ] **Environments Protegidos:** Secretos productivos encapsulados con aprobación manual requerida.
- [ ] **Mantenimiento de Dependencias:** Archivo `.github/dependabot.yml` configurado con grupos y horarios.
- [ ] **Dependency Review:** Flujo de análisis de dependencias bloqueando vulnerabilidades críticas en PRs.
- [ ] **SAST Habilitado:** CodeQL o análisis estático integrado en el ciclo de revisión.
- [ ] **Plantillas de PR e Issues:** `pull_request_template.md` e issue forms YAML disponibles en `.github/`.
- [ ] **CODEOWNERS Realista:** Rutas críticas y el propio directorio `/.github/` asignados a dueños verificados.
- [ ] **Archivos de Comunidad:** `README.md`, `SECURITY.md` y `LICENSE` incorporados.
- [ ] **Zero Burocracia Innecesaria:** Ningún control fue añadido por estética sin mitigar un riesgo concreto.

---

## 10. Métricas de Evaluación y KPIs

| Métrica | Definición / Fórmula | Objetivo Senior |
| :--- | :--- | :--- |
| **Incidentes de Force-Push en main** | Intentos exitosos de sobreescritura del historial troncal. | **0** |
| **Fugas de Secretos en Repositorio** | Claves productivas o tokens detectados en commits. | **0** (bloqueados por Push Protection) |
| **Bypass de CI en Producción** | Cambios integrados a `main` sin validación automatizada previa. | **0** |
| **Workflows con Permisos Excesivos** | Cantidad de jobs ejecutándose con `permissions: write-all`. | **0** |
| **Tiempo de Ciclo de CI (P95)** | Duración total de validación del pipeline principal de PR. | **< 10 minutos** |
| **Adopción de SHA Pinning** | Porcentaje de Actions de terceros referenciadas por commit hash. | **100%** (en proyectos C2/C3) |
| **Ramas Abandonadas Huérfanas** | Ramas remotas fusionadas no eliminadas tras 7 días. | **0** (automático) |
| **Trazabilidad de Despliegue** | Porcentaje de deployments vinculables a un commit y PR auditados. | **100%** |
| **Resolución de Alertas de Seguridad** | Tiempo medio de remediación (MTTR) de alertas de Dependabot altas/críticas. | **< 72 horas** |

---

## 11. Casos de Estudio y Evaluación Práctica

El practicante Senior debe poder aplicar configuraciones diametralmente distintas y precisas ante los siguientes cinco escenarios de ingeniería:

### Escenario A — Portfolio Individual
- **Contexto:** 1 desarrollador, FastAPI backend, duración 6 meses, criticidad baja (C0/C1), despliegue en Render.
- **Configuración correcta:**
  - Perfil `SOLO`.
  - Settings: `main` con bloqueo de force-push y borrado.
  - CI: Un único workflow `ci.yml` ejecutando `ruff check`, `pytest` y validación de build.
  - PR: Opcional (permite push directo si CI valida o uso de ramas simples sin revisores obligatorios).
  - Secretos: Render webhook secret para deploy automático ante push a `main`.
  - Dependabot: Activo semanalmente.
  - *Errores evitados:* No crear CODEOWNERS ficticio, no exigir 2 aprobaciones de PR, no crear Jira ni Projects complejos.

### Escenario B — Startup SaaS en Crecimiento
- **Contexto:** 6 desarrolladores, Next.js + FastAPI, criticidad media-alta (C2), entornos staging y producción.
- **Configuración correcta:**
  - Perfil `TEAM`.
  - Ruleset en `main`: PR obligatorio con 1 aprobación, required status checks (`Lint, Typecheck, Test, Build`), conversación resuelta obligatoria, bloqueo de force-push.
  - Merge Strategy: Squash merge obligatorio con auto-delete branches.
  - Environments: `staging` con despliegue continuo ante push a `main`; `production` con deployment approval requerido de un lead.
  - Seguridad: Dependabot agrupado semanal, Dependency Review en PRs, Secret Scanning con Push Protection activo.
  - CODEOWNERS: `/infra/` y `/.github/` asignados a leads.

### Escenario C — Fintech con Microservicios
- **Contexto:** 40 desarrolladores, microservicios en AWS, criticidad máxima (C3), auditoría estricta.
- **Configuración correcta:**
  - Perfil `CRITICAL`.
  - Rulesets organizacionales: Mínimo 2 aprobaciones por PR, CODEOWNERS mandatorio, commits firmados (`Require signed commits`), Merge Queue para serializar integración.
  - Actions Security: SHA pinning completo en todas las acciones, flujos reusables corporativos, `permissions: contents: read` estricto.
  - Despliegues: OIDC federado con AWS IAM (sin claves estáticas), Environment `production` con doble aprobación y ventana temporal.
  - Seguridad: CodeQL SAST avanzado, Dependency Review bloqueando severidad alta/crítica y licencias copyleft, Private Vulnerability Reporting habilitado.

### Escenario D — Librería Open Source
- **Contexto:** Paquete público en npm mantenido por comunidad distribuida.
- **Configuración correcta:**
  - Archivos de comunidad completos: `LICENSE` (MIT/Apache 2.0), `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`.
  - CI: Matriz de pruebas en Node.js 18, 20 y 22 corriendo sobre Ubuntu, macOS y Windows.
  - PRs: Plantilla clara solicitando tests unitarios para cualquier bugfix.
  - Release: `Release-Please` o `Changesets` automatizando SemVer y publicación en npm con procedencia criptográfica (npm provenance).
  - Issue Forms: Formularios estructurados para evitar reportes sin reproducción.

### Escenario E — Computer Vision / Machine Learning
- **Contexto:** Código fuente: 50 MB, Datasets de entrenamiento: 300 GB, Modelos compilados: 8 GB.
- **Configuración correcta:**
  - **Desacoplamiento arquitectónico de almacenamiento:**
    - Git: Contiene exclusivamente código Python, scripts de entrenamiento, pruebas, Dockerfile y archivos `.dvc`.
    - DVC (Data Version Control) + AWS S3 / Cloud Storage: Almacena los 300 GB de imágenes y datasets versionados por hash.
    - Model Registry (MLflow / Hugging Face / S3): Almacena los 8 GB de binarios de modelos.
    - Git LFS: Solo si existen pequeñas muestras o pesos fijos (<100 MB) que requieran viajar con el código.
  - CI: Validación de linting (`ruff`), formateo, pruebas unitarias de inferencia con fixtures mínimos y comprobación de integridad de pipelines de datos.
  - *Error evitado:* Jamás ejecutar `git add dataset/` sobre cientos de gigabytes.

---

## 12. Algoritmo de Decisión del Skill

```text
                               INICIO
                                 │
                     ┌───────────▼───────────┐
                     │ Diagnóstico de Contexto│
                     │  (Equipo, C0-C3, App)  │
                     └───────────┬───────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 │ ¿Cuál es el tamaño del equipo?│
                 └───────┬───────────────┬───────┘
                         │               │
                  1 Dev  │               │ 2+ Devs
                         │               │
               ┌─────────▼─────┐   ┌─────▼──────────┐
               │ Perfil SOLO   │   │ Perfil TEAM /  │
               │ - Main prot.  │   │ CRITICAL       │
               │ - CI esencial │   │ - PR obligat.  │
               │ - PR opcional │   │ - 1-2 Reviews  │
               │ - No review req│  │ - Status checks│
               └─────────┬─────┘   └─────┬──────────┘
                         │               │
                         └───────┬───────┘
                                 │
                  ┌──────────────▼──────────────┐
                  │ ¿Despliega en infraestructura│
                  │        o en la Nube?        │
                  └───────┬──────────────┬──────┘
                          │              │
                     Sí   │              │ No (Library/OSS)
                          │              │
               ┌──────────▼─────┐  ┌─────▼──────────┐
               │ - Environments │  │ - Multi-runtime│
               │ - OIDC Cloud   │  │   test matrix  │
               │ - Protected    │  │ - SemVer tags  │
               │   prod secrets │  │ - NPM / Package│
               │ - Deploy gates │  │   provenance   │
               └──────────┬─────┘  └─────┬──────────┘
                          │              │
                          └───────┬──────┘
                                  │
                   ┌──────────────▼──────────────┐
                   │   ¿Criticidad C2 o C3?      │
                   └───────┬──────────────┬──────┘
                           │              │
                      Sí   │              │ No (C0/C1)
                           │              │
               ┌───────────▼────┐  ┌──────▼─────────┐
               │ - SHA Pinning  │  │ - Default SAST │
               │ - CodeQL Adv.  │  │ - Dependabot   │
               │ - Dep. Review  │  │   semanal      │
               │ - CODEOWNERS   │  │ - Configuración│
               │ - Signed comm. │  │   liviana      │
               └───────────┬────┘  └──────┬─────────┘
                           │              │
                           └───────┬──────┘
                                   │
                     ┌─────────────▼─────────────┐
                     │  Generar árbol .github/   │
                     │   y aplicar Settings      │
                     └─────────────┬─────────────┘
                                   │
                                  FIN
```

---

## 13. Resultado Esperado y Regla de Oro

Una implementación realizada por un profesional Senior o Staff Engineer **no genera siempre el mismo repositorio idéntico**. Genera la configuración **mínima suficiente y estrictamente adaptada** para gobernar el riesgo real y potenciar la productividad del equipo.

```text
Proyecto pequeño / Prototipo  ──► Gobernanza ágil y ligera
Producto en crecimiento       ──► Gobernanza automatizada y testing continuo
Sistema de negocio crítico    ──► Defensa en profundidad y validaciones multicapa
Organización grande           ──► Gobernanza federada, templates y observabilidad
```

### Regla de Oro
> *"El código correcto, revisado por las personas correctas, validado por los controles automatizados correctos, con los permisos de ejecución mínimos necesarios, debe generar el artefacto inmutable correcto y alcanzar exclusivamente el entorno correcto."*

---

## 14. Recursos Adicionales y Referencias Oficiales

1. **GitHub Documentation:**
   - [Managing rulesets for repositories](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
   - [Repository roles and permissions](https://docs.github.com/en/organizations/managing-user-access-to-your-organizations-repositories/managing-repository-roles/repository-roles-for-an-organization)
   - [About code owners (CODEOWNERS)](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners)
   - [GitHub Actions Security Hardening](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
   - [Using OpenID Connect (OIDC) with GitHub Actions](https://docs.github.com/en/actions/deployment/security-hardening-your-deployments/about-security-hardening-with-openid-connect)
   - [Configuring Dependabot version updates](https://docs.github.com/en/code-security/dependabot/dependabot-version-updates/configuring-dependabot-version-updates)
   - [About Secret Scanning and Push Protection](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
   - [About CodeQL and Code Scanning](https://docs.github.com/en/code-security/code-scanning/introduction-to-code-scanning/about-code-scanning-with-codeql)
2. **Estándares y Modelos de Seguridad:**
   - OWASP Top 10 CI/CD Security Risks
   - SLSA Framework (Supply-chain Levels for Software Artifacts)
   - NIST SP 800-218 (Secure Software Development Framework - SSDF)
   - ISO/IEC 26514 / IEEE 29148 Standard Specifications
