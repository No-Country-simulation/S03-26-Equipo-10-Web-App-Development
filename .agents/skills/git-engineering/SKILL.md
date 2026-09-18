---
name: git-engineering
description: >-
  Ingeniería avanzada de versionado, branching, integración y gobernanza con Git (código SKL-DEV-GIT-001). Usar cuando se requiera diseñar o auditar flujos de trabajo (Trunk-Based, GitHub Flow, GitLab Flow, Git Flow), políticas de ramas y protección de main, commits atómicos con Conventional Commits, resolución avanzada de conflictos (rerere, merge vs rebase), recuperación de desastres (reflog, bisect, worktree, revert) y automatización con hooks locales (Husky, lint-staged) y pipelines CI/CD.
---

# Especificación Técnica de Habilidad: Senior Git Version Control, Branching & Governance Engineering

---

**Código de Skill:** SKL-DEV-GIT-001  
**Nombre:** Ingeniería Avanzada de Versionado, Branching, Integración y Gobernanza con Git  
**Versión:** 1.0.0  
**Nivel:** Senior / Staff-ready  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD / DevOps / Continuous Delivery / Conventional Commits 1.0.0  
**Dominio:** Git / Version Control / Software Configuration Management / DevOps  

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Ingeniería avanzada de versionado, branching, integración y gobernanza con Git. |
| **Objetivo de Dominio** | Capacitar al sistema para diseñar, operar y gobernar estrategias profesionales de Git adaptadas al ciclo de vida, tamaño del equipo, modelo de despliegue y criticidad del producto. |
| **Tipo de Proyecto** | Desarrollo de Software / Backend / Frontend / Mobile / Data / AI/ML / DevOps / Infraestructura / Open Source. |
| **Complejidad** | Alta. |
| **Nivel Esperado** | Senior / Staff Engineer. |
| **Unidad de Diseño Principal** | Commit atómico, rama de cambio, Pull/Merge Request y referencia Git. |
| **Principio Rector** | El workflow debe reducir el costo de integración y aumentar la trazabilidad, seguridad y frecuencia de entrega; no agregar ceremonias sin una necesidad operativa real. |

---

## 2. Descripción y Filosofía de Diseño

El skill se enfoca en Git como un **sistema distribuido de control de versiones y coordinación técnica**, no simplemente como una colección de comandos de terminal.

Un dominio Senior de Git implica comprender y gobernar:
- El grafo acíclico dirigido (DAG) de commits.
- Referencias locales, ramas (*branches*) y etiquetas (*tags*).
- El puntero `HEAD`, el árbol de trabajo (*working tree*) y el área de preparación (*staging area* / *index*).
- Las referencias remotas (*remote-tracking branches*) y sincronización.
- La semántica de integración mediante fusión (`merge`) o rebase (`rebase`).
- La trazabilidad inmutable de los cambios de negocio.
- Los mecanismos de recuperación de desastres ante fallos y descarte de código.
- Las estrategias de lanzamiento (*releases*) y control de versiones semántico.
- Las políticas de protección de ramas y gobernanza del repositorio.
- La integración con pipelines automatizados de CI/CD.
- La automatización de controles locales mediante Git Hooks.
- La seguridad criptográfica de la cadena de cambios (firmas GPG/SSH, escaneo de secretos).

La arquitectura del workflow debe minimizar simultáneamente:
```text
Divergencia entre ramas
+
Tiempo de ciclo (lead time) entre creación e integración
+
Tamaño de Pull/Merge Requests
+
Conflictos de merge
+
Cambios no auditados
+
Commits no reproducibles
+
Errores de integración en producción
+
Intervención manual durante releases
```

> [!NOTE]
> No existe un único workflow universalmente correcto. Git fue deliberadamente diseñado con flexibilidad, por lo que la estrategia de branching e integración debe responder al modelo organizacional, a la frecuencia de releases y a las restricciones operativas del producto.

### 2.1. Principios de Ingeniería Git

#### Principio 1 — Integrar temprano (Integrate Early)
Cuanto más tiempo diverge una rama respecto a `main`, mayor es el riesgo de conflictos complejos, duplicación de esfuerzo, decisiones arquitectónicas incompatibles y el temido *merge hell*. Las ramas de cambio deben ser de corta duración y alcance acotado.

#### Principio 2 — `main` representa un estado integrable
En organizaciones con Continuous Delivery, la rama troncal (`main`) debe mantenerse permanentemente:
- Compilable sin advertencias críticas.
- Con pruebas automatizadas en verde.
- Revisada y aprobada por pares.
- Potencialmente desplegable a producción en cualquier momento.

> [!TIP]
> Que un cambio esté integrado en `main` no significa que deba exponerse inmediatamente al usuario final. Para desarrollo incremental se deben utilizar **Feature Flags**, **Branch by Abstraction**, desacoplamiento por configuración o despliegues progresivos (*dark launches*).

#### Principio 3 — Separar integración de despliegue (`branch != environment`)
Una rama Git representa una línea de evolución lógica del código. Un ambiente representa una instancia física o virtual desplegada del software.
Por defecto:
```text
branch != environment
```
Debe preferirse el modelo de artefacto inmutable:
```text
Git commit en main
       ↓
CI Pipeline (build & test)
       ↓
Artefacto inmutable (imagen Docker / binario con SHA único)
       ↓
Despliegue a Dev ──> Despliegue a Staging ──> Despliegue a Producción
```
*Evitar reconstruir versiones diferentes desde ramas diferentes para cada entorno (`dev`, `staging`, `prod`), ya que esto rompe la garantía de haber probado en staging exactamente lo que se desplegará en producción.*

#### Principio 4 — Commits pequeños, coherentes y reversibles
Un commit profesional representa una unidad lógica e indivisible de cambio:
- Puede revisarse de forma aislada.
- Puede revertirse limpiamente con `git revert`.
- Explica el *por qué* de la modificación en su mensaje.
- Pasa la suite de pruebas de forma autónoma.
- Está asociado a un ticket o requerimiento rastreable.

#### Principio 5 — La historia es una interfaz para humanos y herramientas
Un historial limpio, atómico y estructurado habilita:
- Depuración biseccional automatizada (`git bisect`).
- Generación automática de Changelogs y Release Notes.
- Versionado semántico guiado por commits (`semantic-release`).
- Auditorías regulatorias y forenses.
- Trazabilidad completa: `Issue ──> PR ──> Commit ──> Artifact ──> Release`.

#### Principio 6 — Los controles locales mejoran el feedback; CI impone las políticas
Los Git Hooks locales (`pre-commit`, `commit-msg`) aceleran el ciclo de desarrollo evitando esperas innecesarias en CI, pero pueden omitirse fácilmente mediante `--no-verify`. Por ende:
- **Git Hooks locales:** Rápido feedback para el desarrollador.
- **CI / Server-side rules:** Control autoritativo e ineludible de políticas de calidad y seguridad.

```text
Developer Machine
   │
   ├── pre-commit  ──> Formatter, Linter rápido, Gitleaks (archivos staged)
   ├── commit-msg  ──> Validación de Conventional Commits (commitlint)
   └── push
         │
         ▼
GitHub / GitLab Server
   │
   ├── Branch Protection / Rulesets (impide push directo a main)
   │
   ▼
CI Pipeline (Authoritative Enforcement)
   ├── Lint & Typecheck exhaustivo
   ├── Pruebas unitarias, de integración y E2E
   ├── Secret Scanning & SAST
   └── Build de producción
         │
         ▼
Pull / Merge Request Aprobado  ──>  Squash / Merge a main
```

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)

- **[RF-01] Modelo Mental de Objetos:** El practicante debe dominar el modelo interno de Git (`blob`, `tree`, `commit`, `annotated tag`), el rol del `working tree`, el `index` (staging), `HEAD` y el árbol de referencias antes de realizar operaciones destructivas.
- **[RF-02] Selección Justificada de Workflow:** Debe elegir el flujo de trabajo considerando la cadencia de despliegues, tamaño del equipo, arquitectura de software y requerimientos de soporte de versiones concurrentes.
- **[RF-03] Política de Ramas:** Debe definir y hacer cumplir nomenclatura, ciclo de vida, origen, destino y eliminación automática de ramas fusionadas.
- **[RF-04] Convención de Commits:** Debe producir commits atómicos y mensajes compatibles con la especificación de **Conventional Commits 1.0.0**.
- **[RF-05] Estrategias de Integración:** Debe dominar y aplicar con criterio técnico `merge` (con merge commit), `rebase`, `squash merge` y `cherry-pick`.
- **[RF-06] Revisión en Pull/Merge Requests:** Todo cambio destinado a ramas protegidas debe validarse mediante revisión de código por pares y validaciones automatizadas.
- **[RF-07] Automatización y Hooks:** Debe configurar controles locales (Husky, lint-staged, commitlint) y asegurar su réplica estricta en el servidor de integración continua.
- **[RF-08] Seguridad de Código y Secretos:** Debe impedir la filtración de credenciales (Gitleaks), prevenir force pushes no controlados y restringir accesos a ramas productivas.
- **[RF-09] Gestión de Releases y Etiquetas:** Debe etiquetar versiones mediante tags anotados y reproducibles vinculados a un commit inmutable del grafo.
- **[RF-10] Recuperación de Desastres:** Debe ser capaz de restaurar estados anteriores mediante `git reflog`, `git restore`, `git revert` y `git reset` sin pérdidas no deseadas de código.
- **[RF-11] Diagnóstico de Historia:** Debe dominar herramientas de análisis forense del historial: `git bisect`, `git blame`, `git log` avanzado y `git diff`.
- **[RF-12] Trabajo Paralelo Aislado:** Debe utilizar `git worktree` para atender tareas simultáneas urgentes (hotfixes) sin recurrir a clones duplicados del repositorio ni stashes complejos.

### 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Trazabilidad:** Todo cambio integrado en producción debe permitir rastrear el issue original, el Pull Request de discusión, los revisores y el pipeline que lo validó.
- **[RNF-02] Integridad de Ramas Críticas:** La rama principal (`main`) debe rechazar escrituras directas (`git push origin main`) y modificaciones que no hayan superado las revisiones.
- **[RNF-03] Mantenibilidad y Simplicidad:** El workflow seleccionado debe poder ser explicado y adoptado por un nuevo integrante del equipo en menos de 15 minutos.
- **[RNF-04] Escalabilidad:** La metodología debe absorber el incremento de desarrolladores sin aumentar exponencialmente los bloqueos ni los conflictos de integración.
- **[RNF-05] Recuperabilidad:** Ningún comando destructivo (`reset --hard`, `clean -fd`, `push --force`) debe ejecutarse sin una verificación previa de referencias de rescate.
- **[RNF-06] Verificación Automatizada:** Ninguna política objetiva (formato, lint, tipos, suite de pruebas) debe depender de la memoria de los revisores humanos.
- **[RNF-07] Reproducibilidad:** Una versión en producción debe poder reconstruirse de forma determinista a partir del tag Git correspondiente.
- **[RNF-08] Higiene de Seguridad:** La historia de Git nunca debe contener credenciales, certificados privados, variables de entorno sensibles o datos de producción.
- **[RNF-09] Rendimiento en Hooks Locales:** Los hooks de desarrollo local (`pre-commit`) deben ejecutarse en menos de 3 a 5 segundos; las pruebas pesadas o análisis lentos deben derivarse a CI.

---

## 4. Criterios de Aceptación — Definition of Done (DoD)

La competencia bajo este skill se considera alcanzada cuando el practicante es capaz de:
1. Justificar la selección de un workflow (Trunk-Based, GitHub Flow, GitLab Flow o Git Flow) según el contexto específico del producto y del equipo.
2. Configurar una política de ramas completa: nomenclatura, permisos de acceso, estrategia de fusión y eliminación tras el merge.
3. Proteger la rama `main` mediante reglas de branch protection o rulesets (revisiones requeridas, status checks obligatorios, resolución de hilos de discusión).
4. Redactar commits atómicos y claros bajo la convención Conventional Commits.
5. Explicar y aplicar las diferencias técnicas entre `merge`, `rebase`, `squash`, `reset`, `revert` y `restore`.
6. Recuperar commits o ramas aparentemente eliminadas utilizando `git reflog`.
7. Aislar y localizar regresiones de código de forma automatizada mediante `git bisect`.
8. Resolver conflictos de integración de manera semántica sin descartar código legítimo de terceros.
9. Integrar herramientas de calidad y escaneo de secretos locales (Husky, lint-staged, Gitleaks) y replicar sus validaciones en CI.
10. Crear releases trazables mediante tags anotados asociados a commits reproducibles.
11. Demostrar por qué una rama Git no debe confundirse con un ambiente de infraestructura.
12. Aplicar `git push --force-with-lease` de forma segura en ramas de trabajo personales y entender por qué está vedado en ramas públicas.
13. Resolver con solvencia técnica: commits incorrectos, descartes accidentales de código y rebases interrumpidos.

---

## 5. Ecosistema de Herramientas — Stack

### 5.1. Núcleo
- **Git CLI:** Herramienta primaria y universal.
- **OpenSSH:** Autenticación segura mediante claves SSH (`ed25519`).
- **GPG / SSH Commit Signing:** Firma criptográfica de autoría en commits y tags.

### 5.2. Plataformas de Colaboración
- **GitHub:** Branch Protection Rules, Repository Rulesets, Merge Queues, CODEOWNERS, GitHub Actions.
- **GitLab:** Protected Branches, Merge Request Approvals, GitLab CI/CD.
- **Bitbucket / Azure DevOps:** Branch Policies, PR Reviewers, Pipelines.

### 5.3. Automatización de Hooks y Calidad de Código
- **Ecosistema JS/TS:** Husky, lint-staged, commitlint, ESLint / Biome, Prettier.
- **Ecosistema Multi-lenguaje:** Pre-commit framework (Python/Polyglot), Lefthook (Go/Ultrarrápido), scripts POSIX nativos en `.git/hooks/`.

### 5.4. Seguridad del Repositorio
- **Gitleaks:** Detección de claves de API, tokens y secretos en el árbol de trabajo y en el historial.
- **Secret Scanning nativo:** Protección push en GitHub/GitLab.
- **SAST & SCA:** CodeQL, Snyk, Dependabot / Renovate.

### 5.5. Clientes Visuales y Terminal (Herramientas de Productividad)
- **Terminal interactivo:** `lazygit`, `tig`.
- **IDEs y Editores:** VS Code GitLens, JetBrains Git Tool.
- **Clientes GUI dedicados:** GitKraken, Fork, Tower, Sublime Merge.
> *El uso de herramientas visuales es válido para agilizar inspecciones, pero nunca sustituye el entendimiento de los comandos y del modelo de datos de Git.*

---

## 6. Metodología de Práctica — Paso a Paso

### Fase 1 — Selección del Paradigma de Branching

#### 6.1. Centralized Workflow
```text
main:  ●───●───●───●───●
```
- **Uso:** Equipos unipersonales, prototipos descartables, scripts utilitarios.
- **Ventajas:** Cero complejidad de ramas.
- **Desventajas:** Nulo aislamiento; colisiones continuas en equipos medianos.

#### 6.2. Feature Branch Workflow
```text
main:        ●───────────────────────● (merge)
              \                     /
feat/auth:     ●──────●──────●─────●
```
- **Uso:** Equipos que requieren revisión de código por pares mediante PRs y ejecución de CI por cada cambio aislado.
- **Regla Senior:** Una feature branch debe representar una unidad de cambio integrable, no una epopeya de tres meses de desarrollo.

#### 6.3. GitHub Flow
```text
main:        ●───────────────────────● (deploy a prod)
              \                     /
feat/login:    ●──────●──────● (PR)
```
- **Uso:** Aplicaciones SaaS, APIs web, microservicios, equipos que practican Continuous Delivery con despliegues a producción frecuentes desde `main`.
- **Ventajas:** Extremadamente simple, pocas ramas activas, integración continua fluida.

#### 6.4. GitLab Flow
Combina feature branches con ramas de promoción formal entre ambientes o ramas de versión estable.
- **Variante por Ambientes:** `feature/*` ──> `main` ──> `pre-production` ──> `production`.
- **Uso:** Entornos donde las promociones entre servidores requieren aprobaciones de QA manual o compliance regulatorio.
- **Regla:** El flujo de cambios debe ser estrictamente descendente; nunca introducir cambios directamente en `production` sin pasar por `main`.

#### 6.5. Git Flow (Workflow Tradicional / Heredado)
```text
main:        ●───────────────────────────────────────────────● (v1.0.0)
              \                                             /
develop:       ●──────●──────●────────●──────●─────────────●
                       \      \      /      /
feature/*:              ●──────●    ●──────●
```
- **Estructura:** `main`, `develop`, `feature/*`, `release/*`, `hotfix/*`.
- **Uso:** Software empaquetado, aplicaciones de escritorio, firmware, productos con ciclos de congelamiento (*feature freeze*) y soporte concurrente de múltiples versiones anteriores.
- **Advertencia:** Para servicios web modernos y SaaS con despliegue continuo, Git Flow introduce una burocracia de merges y ramas permanente que ralentiza la entrega sin aportar valor.

#### 6.6. Trunk-Based Development (TBD)
```text
              feat/a (vida: < 2 días)
              /   \
trunk (main): ●────●───────●──────●──────●───────●
                    \    /
                     feat/b
```
- **Modelo:** Ramas de vida extremadamente corta (pocas horas o 1-2 días como máximo) o commits directos al trunk respaldados por suites de CI muy rápidas y confiables.
- **Uso:** Equipos de alto rendimiento, microservicios, SaaS de escala, despliegues continuos múltiples por día.
- **Habilitador Técnico:** Requiere uso intensivo de **Feature Flags** para desacoplar el despliegue del código de la activación de la funcionalidad.

#### 6.7. Forking Workflow
```text
upstream/project:  ●───────────────────● (PR aceptado)
                     \               /
fork/mi-usuario:      ●──────●──────●
```
- **Uso:** Proyectos Open Source o entornos corporativos donde los colaboradores externos no tienen permisos de escritura en el repositorio central.

#### 6.8. Release Branching
- **Modelo:** `release/v2.4`, `release/v2.5` ramificadas desde `main` en momentos específicos para dar soporte de parches y mantenimiento a clientes que no pueden actualizar a la última versión.

#### 6.9. Environment Branching
- **Uso Excepcional:** Solo cuando la infraestructura de despliegue esté rígidamente atada a GitOps por rama.  
- **Riesgo:** Alta propensión a divergencia y pérdida de parches entre entornos. Preferir siempre la promoción del mismo artefacto inmutable.

#### 6.10. OneFlow
- Simplificación de Git Flow con una única rama duradera (`main`) y ramas efímeras para features, releases o hotfixes.

#### 6.11. Stacked PRs (Cambios Apilados)
- División metódica de una funcionalidad grande en una serie encadenada de PRs pequeños e integrables:
  `main` ──> `PR-1 (refactor base)` ──> `PR-2 (modelo de datos)` ──> `PR-3 (endpoints)` ──> `PR-4 (UI)`.

#### 6.12. Matriz de Decisión Arquitectónica

| Contexto del Proyecto | Estrategia Recomendada |
| :--- | :--- |
| **Startup / SaaS / API Web con CD** | **Trunk-Based Development** o **GitHub Flow** |
| **Microservicios con pipelines maduros** | **Trunk-Based Development** |
| **Empresa con QA manual y promociones formales** | **GitLab Flow (con ramas de entorno)** |
| **Software de escritorio / Móvil / Firmware** | **Release Branching** o **Git Flow** |
| **Producto con soporte de múltiples versiones (LTS)** | **Release Branching** desde `main` |
| **Proyectos Open Source / Colaboradores externos** | **Forking Workflow** |
| **Monorepos de alta concurrencia** | **Trunk-Based Development + Merge Queue** |

---

### Fase 2 — Política de Ramas y Nomenclatura

#### 6.13. Nomenclatura Estandarizada
Formato general:
```text
<tipo>/<ticket-opcional>-<descripcion-kebab-case>
```

Prefijos reglamentarios:
- `feat/`: Nuevas capacidades o funcionalidades de negocio (`feat/PROJ-102-oauth-login`).
- `fix/`: Corrección de errores en ramas de desarrollo (`fix/PROJ-405-null-pointer-cart`).
- `hotfix/`: Corrección urgente aplicada directamente sobre producción (`hotfix/CVE-2026-auth-bypass`).
- `refactor/`: Reestructuración de código sin cambio de comportamiento (`refactor/PROJ-220-dal-queries`).
- `perf/`: Mejoras específicas de rendimiento (`perf/PROJ-310-index-lookups`).
- `docs/`: Documentación técnica exclusivamente (`docs/api-contracts`).
- `test/`: Incorporación o ajuste de pruebas (`test/payment-webhooks`).
- `chore/`: Tareas de mantenimiento o actualización de dependencias (`chore/deps-bump-major`).
- `release/`: Estabilización de versiones programadas (`release/v3.2.0`).

> [!CAUTION]
> **Prohibido:** Nombres personales o informales: `juan-branch`, `cambios-finales`, `prueba-test`, `nueva-rama`.

---

### Fase 3 — Commits Profesionales y Atómicos

#### 6.14. Especificación de Conventional Commits 1.0.0
Estructura obligatoria:
```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Tipos principales:
- `feat`: Añade una nueva funcionalidad al sistema (corresponde a MINOR en SemVer).
- `fix`: Corrige un error o defecto del software (corresponde a PATCH en SemVer).
- `perf`: Modificación orientada a optimizar el rendimiento.
- `refactor`: Cambio interno de código que no añade funcionalidades ni repara bugs.
- `test`: Incorporación o corrección de pruebas unitarias o de integración.
- `docs`: Modificaciones en documentación o READMEs.
- `build`: Cambios que afectan el sistema de compilación o dependencias externas.
- `ci`: Modificaciones en archivos y scripts de integración continua.
- `chore`: Tareas auxiliares que no modifican código de producción ni tests.
- `revert`: Reversión de un commit previo.

#### 6.14.1. Idioma y Registro del Mensaje de Commit

Los mensajes de commit se redactan en **español rioplatense** con **voseo formal**.

- El `type` (`feat`, `fix`, `refactor`, etc.) y el `scope` (`auth`, `webhooks`, `testimonials`, etc.) van **siempre en inglés** — garantizan compatibilidad con `semantic-release`, `commitlint` y herramientas de análisis automático.
- El `description`, `body` y `footer` van en **español rioplatense con voseo**.

**Imperativo con voseo — referencia rápida:**

| Tuteo ❌ | Voseo ✅ | Ejemplo de commit |
|----------|---------|-------------------|
| `implementa` | `implementá` | `feat(auth): implementá el login con OAuth2` |
| `agrega` | `agregá` | `feat(api): agregá el endpoint de moderación` |
| `añade` | `añadí` | `feat(api): añadí la validación de rating` |
| `corrige` | `corregí` | `fix(webhooks): corregí el timeout en outbox` |
| `extrae` | `extraé` | `refactor(scoring): extraé el decay a función pura` |
| `remueve` | `remové` | `feat(api)!: remové el endpoint deprecado` |
| `actualiza` | `actualizá` | `chore(deps): actualizá Prisma a 6.5` |
| `incorpora` | `incorporá` | `test(auth): incorporá casos de token expirado` |
| `previene` | `evitá` | `fix(checkout): evitá el doble clic en el botón` |

> [!NOTE]
> `type` y `scope` siempre en inglés. Solo `description`, `body` y `footer`
> en español rioplatense con voseo. No usar tuteo (`implementa`), ustedeo
> (`implemente`) ni infinitivo (`implementar`).

Ejemplo completo:
```text
feat(auth): implementá el inicio de sesión con Google OAuth2

Se integra el flujo Authorization Code con PKCE para autenticar
usuarios corporativos contra el Identity Provider de Google.

Closes #142
```

#### 6.15. Declaración de Breaking Changes
Indicar cambios incompatibles hacia atrás mediante el signo de exclamación `!` tras el tipo o una sección `BREAKING CHANGE:` en el pie:
```text
feat(api)!: remové el endpoint deprecado /v1/auth/token

BREAKING CHANGE: Las integraciones deben migrar obligatoriamente a /v2/auth/oauth.
```

#### 6.16. Atomicidad de Commits
Un commit debe resolver un único problema o introducir una única mejora lógica.

```text
❌ Mega-commit incorrecto:
feat: agregá login, modificá colores del dashboard, actualizá Prisma y corregí el checkout

✅ Commits atómicos correctos:
feat(auth): agregá la validación de tokens JWT
test(auth): incorporá los casos de prueba de expiración de sesión
refactor(database): extraé el cliente de Prisma a módulo compartido
fix(checkout): evitá el doble clic en el botón de pago
```

#### 6.17. Plantilla `.gitmessage`
Configurar en la raíz del proyecto para orientar al equipo:
```text
# <type>(<scope>): <descripción concisa en español rioplatense, voseo formal, modo imperativo>
#
# ✅ Correcto (voseo):  feat(auth): implementá el inicio de sesión con OAuth2
# ❌ Tuteo:             feat(auth): implementa el inicio de sesión con OAuth2
# ❌ Infinitivo:        feat(auth): implementar el inicio de sesión con OAuth2
# ❌ Inglés:            feat(auth): implement google oauth login
# ❌ Ustedeo:           feat(auth): implemente el inicio de sesión con OAuth2
#
# Explicá el POR QUÉ del cambio y qué problema resuelve en el negocio.
# Describí las decisiones arquitectónicas no evidentes a partir del diff.
#
# Closes #000
# BREAKING CHANGE: <descripción del cambio incompatible>
```
Activar localmente:
```bash
git config commit.template .gitmessage
```

---

### Fase 4 — Staging Profesional

Inspeccionar metódicamente antes de confirmar cualquier cambio:
```bash
# 1. Comprobar el estado general del working tree
git status

# 2. Revisar diferencias exactas en archivos no preparados
git diff

# 3. Preparar fragmentos lógicos atómicos de forma interactiva
git add -p

# 4. Verificar exactamente qué entrará en el commit preparado
git diff --staged
```
> [!NOTE]
> `git add .` no está prohibido, pero solo es admisible cuando el desarrollador ya verificó `git status` y tiene la certeza absoluta de no incluir artefactos residuales o archivos no deseados.

---

### Fase 5 — Sincronización e Integración

#### 6.18. Actualización con `fetch --prune`
```bash
git fetch --prune origin
```
Descarga las referencias remotas actualizadas y purga del seguimiento local aquellas ramas que ya fueron eliminadas en el repositorio central.

#### 6.19. Rebase sobre `main`
Para mantener ramas de trabajo actualizadas con la rama troncal sin introducir commits de merge innecesarios:
```bash
git fetch origin
git rebase origin/main
```
> [!CAUTION]
> **Regla de Oro del Rebase:** **Nunca** rebasear ramas públicas compartidas sobre las cuales otros colaboradores estén construyendo trabajo. Reescribir la historia publicada rompe los clones de los compañeros de equipo.

---

### Fase 6 — Estrategias de Fusión (Merge Strategies)

```text
┌────────────────────────────┐
│        MERGE COMMIT        │
│  Preserva el grafo visual  │
│  completo de la rama.      │
│  Ideal para releases.      │
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│        SQUASH MERGE        │
│  Condensa todo el PR en un │
│  único commit en main.     │
│  Ideal para GitHub Flow.   │
└─────────────┬──────────────┘
              │
┌─────────────▼──────────────┐
│    REBASE FAST-FORWARD     │
│  Historial 100% lineal.    │
│  No genera merge commits.  │
│  Ramas cortas obligatorias.│
└────────────────────────────┘
```

---

### Fase 7 — Protocolo de Pull / Merge Requests

Todo PR/MR profesional debe documentar su intención con claridad:

```markdown
## Descripción del Cambio
Explica qué resuelve este cambio y qué componentes afecta.

## Motivación / Contexto
¿Por qué se tomó esta decisión técnica o de diseño?

## Validación Realizada
- [ ] Pruebas unitarias ejecutadas localmente
- [ ] Pruebas de integración aprobadas
- [ ] Linter y verificación de tipos en verde
- [ ] Verificación manual en navegador / cliente HTTP

## Evaluación de Riesgos y Rollback
¿Qué impacto potencial existe ante un fallo y cómo se revierte el cambio?

## Issue Relacionado
Closes #123
```

---

### Fase 8 — Branch Protection y Gobernanza

La rama `main` debe configurarse en la plataforma Git con las siguientes reglas indispensables:
- **Require Pull Request before merging:** Prohibir pushes directos.
- **Require approvals:** Mínimo 1 aprobación de pares.
- **Require review from Code Owners (`CODEOWNERS`).**
- **Require status checks to pass:** Pipelines de CI obligatorios antes del merge.
- **Require conversation resolution:** No fusionar con hilos de revisión abiertos.
- **Block force pushes & branch deletion.**
- **Merge Queue (para monorepos de alta frecuencia):** Serializa y prueba los PRs en cola antes de incorporarlos a la rama protegida.

---

### Fase 9 — Git Hooks con Husky y lint-staged

```text
.husky/
├── pre-commit   ──> Ejecuta lint-staged (Linter, Formatter, Secret Scan)
├── commit-msg   ──> Ejecuta commitlint para validar Conventional Commits
└── pre-push     ──> Ejecuta typecheck rápido o suite básica de tests
```

Configuración de `package.json` con `lint-staged`:
```json
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*": [
      "gitleaks protect --staged --verbose"
    ]
  }
}
```

---

### Fase 10 — Gestión de Releases y Etiquetas (Tags)

Toda versión productiva debe estar asociada a un tag anotado:
```bash
# Crear tag anotado con mensaje explícito
git tag -a v1.4.0 -m "release: versión 1.4.0 con soporte OAuth2"

# Publicar el tag al repositorio central
git push origin v1.4.0
```
Para firmas criptográficas de seguridad:
```bash
git tag -s v1.4.0 -m "release: v1.4.0 firmado"
```

---

### Fase 11 — Flujos de Hotfix Urgente

- **En Trunk-Based / GitHub Flow:**
  Se crea una rama corta desde `main` (`hotfix/CVE-xxx`), se somete a revisión exprés, se fusiona a `main` tras pasar CI y se despliega inmediatamente (*Fix-forward*).
- **En Git Flow:**
  Se crea la rama desde `main` (`hotfix/v1.0.1`), se valida y se fusiona simultáneamente hacia `main` (con nuevo tag) y hacia `develop` para sincronizar la línea de desarrollo.

---

### Fase 12 — Recuperación y Operaciones Avanzadas

#### 6.22. `git restore` (Descarte seguro de cambios locales)
```bash
# Descartar modificaciones no preparadas en un archivo
git restore src/auth/service.ts

# Quitar un archivo del área de preparación (unstage)
git restore --staged src/auth/service.ts
```

#### 6.23. `git revert` (Reversión segura en historial compartido)
```bash
# Crea un nuevo commit que aplica los cambios inversos exactos del commit indicado
git revert 7f8a1bc
```

#### 6.24. `git reset` (Manejo de referencias locales)
- `git reset --soft HEAD~1`: Deshace el último commit pero conserva los cambios en staging.
- `git reset HEAD~1`: Deshace el último commit y deja los cambios en el working tree sin preparar.
- `git reset --hard HEAD~1`: **Destructivo.** Elimina el commit, staging y todas las modificaciones locales del working tree.

#### 6.25. `git reflog` (El salvavidas definitivo)
Registra cada movimiento de `HEAD` en la máquina local:
```bash
# Listar las referencias recientes
git reflog

# Recuperar un commit descartado tras un rebase fallido o un reset erróneo
git switch -c rama-de-rescate HEAD@{2}
```

#### 6.26. `git cherry-pick`
Aplica un commit específico de otra rama sobre la rama activa:
```bash
git cherry-pick 9a4b2c1
```
*Utilizar como herramienta quirúrgica para parches o backports; no como metodología normal de integración.*

#### 6.27. `git bisect` (Depuración biseccional automatizada)
```bash
git bisect start
git bisect bad                 # La versión actual falla
git bisect good v1.2.0         # La versión v1.2.0 funcionaba bien

# Automatizar la búsqueda mediante script de test
git bisect run npm test
```

#### 6.28. `git rerere` (Reuse Recorded Resolution)
Habilitar para que Git memorice cómo resolviste un conflicto y aplique la misma solución automáticamente en futuros rebases o merges:
```bash
git config --global rerere.enabled true
```

#### 6.29. `git worktree` (Múltiples ramas activas simultáneamente)
Permite trabajar en un hotfix urgente sin tocar tu working tree actual ni usar `stash`:
```bash
# Crear un directorio paralelo enlazado a la rama de hotfix
git worktree add ../mi-app-hotfix hotfix/seguridad-urgente

# Al terminar el trabajo
git worktree remove ../mi-app-hotfix
```

---

### Fase 13 — Política de Force Push

- **Prohibición:** Prohibido terminantemente ejecutar `git push --force` en ramas compartidas o protegidas.
- **Alternativa Segura para Ramas Personales:**
  ```bash
  git push --force-with-lease origin feat/mi-rama
  ```
  `--force-with-lease` verifica que nadie haya subido nuevos commits a la rama remota antes de sobrescribirla, evitando borrar accidentalmente trabajo de compañeros.

---

### Fase 14 — Pipeline de CI/CD para Pull Requests

Secuencia obligatoria de validación en CI antes de autorizar el merge:
```text
1. Checkout limpio
   ↓
2. Verificación de lockfile e instalación de dependencias (npm ci)
   ↓
3. Linter y verificación de formato
   ↓
4. Verificación estricta de tipos de compilador (tsc --noEmit)
   ↓
5. Suite de pruebas unitarias y de integración
   ↓
6. Escaneo de secretos (Gitleaks) y análisis estático (SAST)
   ↓
7. Compilación de producción (Build check)
```

---

### Fase 15 — Automatización de Releases y Semantic Versioning

Con Conventional Commits implementado, herramientas como `semantic-release` o `release-please` determinan de forma desatendida el incremento de versión:
- Si hay al menos un `fix:` ──> Incremento **PATCH** (`1.0.0` ──> `1.0.1`).
- Si hay al menos un `feat:` ──> Incremento **MINOR** (`1.0.0` ──> `1.1.0`).
- Si hay un `BREAKING CHANGE:` o tipo con `!` ──> Incremento **MAJOR** (`1.0.0` ──> `2.0.0`).

---

## 7. Matriz de Antipatrones en Git

- ⚠️ **Antipatrón 1 — Ramas de Larga Duración (*Long-Lived Feature Branches*):** Ramas activas durante semanas que divergen y culminan en un infierno de resolución de conflictos.
- ⚠️ **Antipatrón 2 — Ramas Nombradas por Desarrollador:** Ramas llamadas `juan`, `pedro`, `facundo`. Las ramas deben representar cambios técnicos o de negocio, no personas.
- ⚠️ **Antipatrón 3 — Crear rama `develop` sin justificación real:** Copiar la estructura de Git Flow en aplicaciones web continuas donde solo añade burocracia.
- ⚠️ **Antipatrón 4 — Ramas fijadas a Entornos por defecto (`dev`, `staging`, `prod`):** Tratar las ramas como ambientes en lugar de promover el mismo artefacto inmutable.
- ⚠️ **Antipatrón 5 — Force Push indiscriminado sobre ramas compartidas:** `git push --force origin main` sobrescribiendo commits de otros colaboradores.
- ⚠️ **Antipatrón 6 — Rebase de Historial Público Compartido:** Reescribir commits que otros compañeros ya tomaron como base para sus propias ramas.
- ⚠️ **Antipatrón 7 — Mega-Commits:** Confirmar cientos de archivos con cambios heterogéneos bajo un mensaje genérico.
- ⚠️ **Antipatrón 8 — Mensajes de Commit Vacíos o Ambigüos:** Mensajes como `fix`, `update`, `changes`, `wip`, `final2`.
- ⚠️ **Antipatrón 9 — Commits Directos sobre `main` sin Revisión ni CI:** Subir cambios sin pasar por la validación del equipo y de los tests.
- ⚠️ **Antipatrón 10 — Confiar en los Git Hooks Locales como Única Barrera:** Omitir la réplica de los controles en el pipeline de CI.
- ⚠️ **Antipatrón 11 — Confundir `git reset` con `git revert`:** Usar reset para alterar historia ya compartida públicamente.
- ⚠️ **Antipatrón 12 — Uso de `cherry-pick` como Estrategia Habitual de Sincronización:** Emplearlo como sustituto de un merge ordenado duplicando la identidad de los commits.
- ⚠️ **Antipatrón 13 — `git add .` sin Inspección Previa:** Preparar archivos residuales, logs o credenciales por omisión de `git status`.
- ⚠️ **Antipatrón 14 — Versionado de Secretos y Llaves Privadas:** Subir archivos `.env` o credenciales a Git; borrar el archivo en un commit posterior no lo elimina del historial histórico.
- ⚠️ **Antipatrón 15 — Resolver Conflictos Aceptando Automáticamente un Lado:** Pulsar *"Accept Current"* o *"Accept Incoming"* en el editor sin entender la intención semántica de ambos cambios.
- ⚠️ **Antipatrón 16 — Obsesión por el Historial Limpio a Costa de la Integridad:** Forzar rebases peligrosos en ramas públicas solo por mantener un grafo lineal.

---

## 8. Evaluación y KPIs Técnicos

| Indicador de Gestión Git | Meta Senior |
| :--- | :--- |
| **Commits directos sobre `main` evadiendo la política** | 0 |
| **Force pushes accidentales sobre ramas protegidas** | 0 |
| **Secretos o credenciales incorporados al historial** | 0 |
| **Pull Requests fusionados sin validación obligatoria de CI** | 0 |
| **Ramas abandonadas o inactivas durante más de 30 días** | < 5% |
| **Commits alineados a Conventional Commits en ramas protegidas** | 100% |
| **Releases en producción asociadas a tags anotados inequívocos** | 100% |
| **Tiempo de vida promedio de una rama de cambio en Continuous Delivery** | Horas / Máximo 2 días |
| **Pull Requests vinculados a un ticket o requerimiento formal** | ≥ 95% |
| **Roturas accidentales de la rama `main` tras un merge** | Tendencia a 0 |
| **Cambios productivos auditables de punta a punta** | 100% |

### 8.1. Escenarios de Evaluación Práctica

- **Escenario A — Flujo de Feature Estándar:** Crear rama desde `main`, producir 3 commits atómicos, sincronizar con `fetch --prune` y rebase, emitir PR, pasar CI y fusionar.
- **Escenario B — Corrección de Commit Local No Publicado:** Enmendar el último mensaje o añadir un archivo omitido mediante `git commit --amend` o rebase interactivo (`git rebase -i`).
- **Escenario C — Corrección de Commit Erróneo Ya Publicado:** Revertir el cambio de forma limpia y transparente mediante `git revert <sha>` sin romper la historia compartida.
- **Escenario D — Recuperación de Código Perdido:** Localizar y rescatar un commit huérfano tras un `reset --hard` erróneo utilizando `git reflog` y `git switch -c`.
- **Escenario E — Localización de Regresión:** Aislar el commit exacto que introdujo una falla mediante búsqueda binaria automatizada con `git bisect run`.
- **Escenario F — Hotfix Urgente en Producción:** Ejecutar el procedimiento de hotfix reglamentario según el workflow adoptado por la organización.
- **Escenario G — Trabajo Concurrente sin Mezcla:** Manejar un cambio de contexto imprevisto utilizando `git worktree` para trabajar en dos ramas al mismo tiempo en carpetas independientes.
- **Escenario H — Conflicto Repetitivo:** Configurar `git rerere` para resolver un conflicto complejo una sola vez y permitir que Git lo resuelva automáticamente en operaciones posteriores.

---

## 9. Recursos Adicionales y Criterio de Dominio Senior

### Documentación Primaria y Estándares
- **Git Official Documentation & Pro Git Book** (Scott Chacon & Ben Straub).
- **Conventional Commits 1.0.0 Specification.**
- **GitHub Flow & Repository Rulesets Documentation.**
- **GitLab Flow & Merge Request Guidelines.**
- **Trunk-Based Development Portal** (Paul Hammant).
- **Semantic Versioning 2.0.0 (SemVer).**

### Resumen Arquitectónico del Flujo de Trabajo

```text
                    ┌─────────────────────────┐
                    │   Selección de Flujo    │
                    │   (TBD / GitHub Flow)   │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │    Política de Ramas    │
                    │    (feat/PROJ-xxx)      │
                    └────────────┬────────────┘
                                 │
                                 ▼
┌──────────────┐    ┌─────────────────────────┐
│ Working Tree │ ─▶ │  Commits Atómicos       │
│ & Staging    │    │  Conventional Commits   │
└──────────────┘    └────────────┬────────────┘
                                 │
                        Git Hooks Locales
                        (Husky / lint-staged)
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Feature Branch Remota  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Pull / Merge Request  │
                    └────────────┬────────────┘
                                 │
                        CI Checks & Review
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │ Protected Branch (main) │
                    └────────────┬────────────┘
                                 │
                          Tag / Release
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │   Artefacto Inmutable   │
                    └────────────┬────────────┘
                                 │
                        Despliegues Continuos
                     (Dev ──> Stage ──> Prod)
```

### Regla Rectora Senior
El dominio avanzado de Git no consiste en memorizar más comandos de consola. Consiste en saber responder con certeza antes de cada operación:
```text
1. ¿Qué historia o rama estoy modificando?
2. ¿Quién más en el equipo depende actualmente de esta historia?
3. ¿Hacia dónde se está moviendo el puntero HEAD y qué referencias cambian?
4. ¿Qué información o archivos podrían perderse si ejecuto este comando?
5. ¿Cómo recuperaría el estado anterior si la operación falla?
6. ¿Cómo se integrará este cambio en la rama principal sin generar fricción?
7. ¿Qué mecanismo automatizado (hook o CI) evitará que un error humano llegue a producción?
```
> Un Ingeniero Senior no utiliza Git solamente para almacenar código; diseña y gobierna un sistema confiable de integración, trazabilidad, recuperación y entrega continua alrededor del código.
