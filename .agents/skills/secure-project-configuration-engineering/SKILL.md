---
name: secure-project-configuration-engineering
description: "Configuración reproducible, segura y profesional de proyectos JavaScript y TypeScript en Node.js, Next.js y React (código SKL-JS-CONFIG-001). Usar cuando se requiera gobernar contratos de runtime (Node 24 LTS, engines, .node-version), contratos de dependencias (package-lock.json inmutable, npm ci, save-exact, taxonomía dependencies vs devDependencies), seguridad de la cadena de suministro (allowScripts, npm audit signatures, prevención de ataques en install scripts), configuración desacoplada de TypeScript (NodeNext vs Bundler), ESLint Flat Config (eslint.config.mjs), validación fail-fast de variables de entorno con Zod, contenedores Docker multi-stage non-root y pipelines de CI/CD deterministas."
---

# SKL-JS-CONFIG-001: Secure Node.js / Next.js / React Project Configuration Engineering

```text
====================================================================================================
ESPECIFICACIÓN TÉCNICA DE HABILIDAD: SKL-JS-CONFIG-001
Secure Node.js / Next.js / React Project Configuration Engineering — Versión 1.0.0
Baseline Técnico: Node.js 24 LTS (Active) | npm 11+ | TypeScript 5.8+ | ESLint 9+ Flat Config
Estándares: npm Best Practices | Node.js Security Model | OWASP Software Supply Chain | Agile DoD
Host Monorepo: NestJS 11, Prisma ORM 6.5+, Next.js 15 App Router, React 18/19, Docker Multi-stage
Responsable: Facundo Nicolás González
Dominio: Node.js / Next.js / React / npm / TypeScript / Supply Chain Security / CI/CD
====================================================================================================
```

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Código de Habilidad** | `SKL-JS-CONFIG-001` |
| **Nombre de Habilidad** | Secure Node.js / Next.js / React Project Configuration Engineering |
| **Versión** | `1.0.0` |
| **Nivel Objetivo** | Senior / Production Engineering / Lead |
| **Habilidad Principal** | Configuración reproducible, segura y mantenible de proyectos JavaScript/TypeScript |
| **Objetivo de Dominio** | Garantizar entornos consistentes desde desarrollo local hasta producción, minimizando drift, vulnerabilidades de dependencias y configuraciones ambiguas |
| **Ecosistemas** | Node.js (NestJS / APIs), Next.js (App Router / SSR / Static), React (SPAs / Components) |
| **Package Manager** | `npm` (v11+) con soporte nativo de monorepo workspaces |
| **Gestión de Runtime** | Node.js LTS versionado explícitamente (`.node-version` + `engines`) |
| **Lockfile** | `package-lock.json` obligatorio e inmutable para aplicaciones |
| **Lenguaje Preferido** | TypeScript en modo estricto (`strict: true`) |
| **CI Install Strategy** | `npm ci` estricto y determinista |
| **Principio Rector** | **Reproducibilidad $\longrightarrow$ Seguridad $\longrightarrow$ Correctitud $\longrightarrow$ Simplicidad $\longrightarrow$ Eficiencia** |

---

## 2. Filosofía de Diseño

La configuración del proyecto **forma parte indisoluble de la arquitectura del software**.
No debe tratarse jamás como:
```text
archivos secundarios
+
scripts improvisados
+
dependencias instaladas "hasta que funcione"
```

Debe concebirse formalmente como la articulación de **Cinco Contratos Centrales**:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                      LOS 5 CONTRATOS ARQUITECTÓNICOS                   │
├────────────────────────────────────────────────────────────────────────┤
│ 1. Runtime Contract       Versión exacta de motor Node.js y npm        │
│ 2. Dependency Contract    Árbol exacto e inmutable de dependencias     │
│ 3. Build Contract         Compilación tipada y optimizada sin drift    │
│ 4. Security Policy        Control de scripts, firmas y supply chain    │
│ 5. Environment Contract   Variables fuertemente tipadas y validadas    │
└────────────────────────────────────────────────────────────────────────┘
```

Una aplicación profesional en producción debe responder con certeza matemática a las siguientes preguntas:
- ¿Qué versión exacta de Node.js utiliza?
- ¿Qué versión exacta de npm gestiona el árbol?
- ¿Qué árbol exacto de dependencias se encuentra instalado en memoria y disco?
- ¿Qué dependencias llegan físicamente al artefacto de producción?
- ¿Qué scripts de ciclo de vida pueden ejecutarse durante `npm install`?
- ¿Qué variables de configuración existen en cada entorno?
- ¿Qué configuración es pública para los navegadores y cuál es privada de servidor?
- ¿Qué secretos existen y cómo se previenen fugas hacia logs o bundles?
- ¿Cómo se reproduce exactamente el artefacto compilado de forma determinista?

---

## 3. Principios Fundamentales

Toda configuración regida por esta habilidad debe satisfacer los siguientes principios operativos:

1. **Deterministic Installs**: Mismo árbol de dependencias en cualquier máquina, en cualquier momento.
2. **Explicit Runtime Versions**: Ningún entorno asume una versión implícita del sistema operativo.
3. **Minimal Dependency Surface**: Reducir al mínimo indispensable la cantidad de dependencias directas y transitivas.
4. **Least Privilege**: Ejecución de procesos y contenedores bajo usuarios sin privilegios administrativos (`non-root`).
5. **Fail-Fast Configuration**: El proceso aborta inmediatamente en el arranque si una variable requerida es inválida o inexistente.
6. **Immutable CI Installs**: `npm ci` como ley absoluta en integración y despliegue continuo.
7. **Separated Environments**: Fronteras inmutables entre desarrollo, testing, staging y producción.
8. **Auditable Supply Chain**: Verificación continua de vulnerabilidades, firmas de registry y procedencia (*provenance*).
9. **Reproducible Builds**: El artefacto resultante depende únicamente del código fuente y del lockfile versionado.

---

## 4. Runtime de Node.js

Los entornos de producción **MUST** utilizar una versión respaldada oficialmente:
$$\text{Active LTS} \quad\text{o}\quad \text{Maintenance LTS}$$
Queda terminantemente prohibido ejecutar aplicaciones en versiones **End-of-Life (EOL)** debido a la ausencia de parches de seguridad críticos.

### 4.1. Estado Actual de Referencia (Septiembre 2026)
- **Node.js 24.x**: Rama **Active LTS** (Elección de producción recomendada y baseline actual).
- **Node.js 26.x**: Rama **Current** (Para experimentación y validación de features emergentes).
- **Node.js 22.x**: Rama **Maintenance LTS**.
- **Node.js 20.x e inferiores**: Versiones en transición EOL o deprecadas.

> [!IMPORTANT]
> La habilidad no hardcodea una versión de por vida: al inicializar o auditar un proyecto, se debe validar el calendario de lanzamientos oficial (`nodejs.org/en/about/previous-releases`) para garantizar soporte activo.

---

## 5. Versionado del Runtime

Todo repositorio debe contener una fuente de verdad explícita e inequívoca de la versión requerida de Node.js en la raíz:

```text
# Archivo: .node-version
24.21.0
```
Alternativas reconocidas según la herramienta de gestión de herramientas del equipo:
- `.nvmrc`
- `.tool-versions` (asdf)
- `mise.toml`

**Regla:** Elegir una convención para el repositorio y mantenerla sincronizada en los runners de CI/CD.

### 5.1. Declaración de `engines` en `package.json`

En conjunción con `.node-version`, el manifiesto debe documentar el contrato de runtime:

```json
{
  "engines": {
    "node": ">=24.0.0 <25",
    "npm": ">=11.0.0 <12"
  }
}
```
Por defecto, npm trata el campo `engines` como una advertencia informativa. Para convertir cualquier discrepancia de runtime en un error fatal de instalación que detenga el proceso, se debe configurar `engine-strict=true`.

---

## 6. Configuración de `.npmrc`

Para una aplicación greenfield o endurecida (*hardened*) con npm, la política base del repositorio debe definirse en un archivo `.npmrc` en la raíz del proyecto:

```ini
save-exact=true
engine-strict=true
audit=true
fund=false
strict-peer-deps=true
strict-allow-scripts=true
```

### 6.1. Significado Técnico de las Directivas

- **`save-exact=true`**:
  Al instalar nuevas dependencias directas (`npm install zod`), npm las guarda en `package.json` con la versión exacta (`"zod": "4.1.0"`) en lugar de usar rangos con caret (`"zod": "^4.1.0"`). Esto obliga a los desarrolladores a realizar actualizaciones de dependencias directas de forma deliberada y trazable mediante Pull Requests.
- **`engine-strict=true`**:
  Rechaza de forma inmediata la instalación si el runtime activo no cumple con el rango declarado en `engines`.
- **`audit=true`**:
  Permite que npm envíe la descripción del árbol instalado al registry para contrastarlo contra la base de datos de vulnerabilidades conocidas (CVEs / GHSA).
  > [!NOTE]
  > `audit=true` $\neq$ verificación criptográfica de paquetes. La verificación de firmas y procedencia se ejecuta de forma complementaria mediante `npm audit signatures`.
- **`fund=false`**:
  Elimina el ruido visual de pedidos de financiamiento en la salida de la consola de CI/CD.
- **`strict-peer-deps=true`**:
  Convierte cualquier conflicto no resuelto o incompatibilidad de `peerDependencies` en un error que detiene la instalación, evitando comportamientos erráticos en tiempo de ejecución.
- **`strict-allow-scripts=true`**:
  Bloquea por defecto la ejecución de scripts de ciclo de vida (`preinstall`, `postinstall`) a menos que el paquete esté explícitamente aprobado en la política de scripts.

---

## 7. Pinning de Dependencias: Aplicaciones vs Librerías

La habilidad establece una distinción arquitectónica taxativa según la naturaleza del paquete:

```text
┌─────────────────────────────────┬─────────────────────────────────┐
│          APLICACIONES           │            LIBRERÍAS            │
├─────────────────────────────────┼─────────────────────────────────┤
│ Backend NestJS, Next.js, SPAs   │ Paquetes NPM públicos/privados  │
│ Controlan el entorno final      │ Consumidas por terceros         │
│ save-exact = true               │ Rangos semver flexibles (^, ~)  │
│ package-lock.json obligatorio   │ Sin lockfile en el paquete      │
│ Inmutabilidad absoluta          │ peerDependencies con rangos     │
└─────────────────────────────────┴─────────────────────────────────┘
```

### 7.1. Aplicaciones
Para aplicaciones finales (p. ej., `@testimonial-cms/api` y `@testimonial-cms/web`), fijar versiones exactas garantiza que ninguna actualización menor no testeada introduzca regresiones o incompatibilidades sutiles.

### 7.2. Librerías
Una librería publicada jamás debe fijar dependencias directas exactas de frameworks o utilidades compartidas. Paquetes como `react`, `react-dom` o `@nestjs/common` deben ubicarse en `peerDependencies` con rangos semver inclusivos:

```json
{
  "peerDependencies": {
    "react": ">=18.0.0 <20.0.0"
  }
}
```

### 7.3. La Verdadera Fuente de Reproducibilidad
Para una aplicación, el contrato reproducible supremo es la tríada:
$$\mathbf{package.json} \;+\; \mathbf{package\text{-}lock.json} \;+\; \mathbf{npm\;ci}$$
El archivo `package-lock.json` describe con precisión criptográfica (hashes SHA-512) el árbol exacto de dependencias directas y transitivas instalado.

---

## 8. El Archivo `package-lock.json`

- **MUST versionarse**: Debe registrarse obligatoriamente en el control de versiones (Git).
- **PROHIBIDO**: Jamás agregar `package-lock.json` al `.gitignore`.

### 8.1. Prohibición de Edición Manual
El archivo de bloqueo jamás debe ser editado manualmente mediante un editor de texto. Cualquier actualización debe originarse a través de comandos nativos de npm:
```bash
npm install zod@4.1.0
# o actualización controlada:
npm update zod
```

---

## 9. `npm install` vs `npm ci`

```text
┌──────────────────────────────────────┬──────────────────────────────────────┐
│             npm install              │                npm ci                │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ Diseñado para Desarrollo             │ Diseñado para CI / Build / Deploy    │
│ Resuelve y muta package-lock.json    │ Falla si el lockfile no coincide     │
│ Tolera discrepancias de manifiestos  │ Exige lockfile preexistente          │
│ Actualiza node_modules incremental   │ Elimina node_modules antes de iniciar│
│ Puede alterar el árbol de producción │ Inmutable: jamás modifica manifiestos│
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 9.1. Regla Mandatoria de CI
> [!CAUTION]
> **Queda terminantemente prohibido ejecutar `npm install` en pipelines de CI/CD, builds de Docker o scripts de despliegue.**
> Toda instalación en entornos automatizados debe realizarse mediante `npm ci`.

---

## 10. Taxonomía de Dependencias (Dependency Taxonomy)

Cada paquete del proyecto debe clasificarse deliberadamente en su categoría correspondiente:

1. **`dependencies`**:
   Paquetes físicamente indispensables para la ejecución del software en producción:
   - *Backend NestJS*: `@nestjs/core`, `@nestjs/common`, `@prisma/client`, `pino`, `zod`.
   - *Frontend Next.js*: `next`, `react`, `react-dom`, `lucide-react`.
2. **`devDependencies`**:
   Herramientas utilizadas exclusivamente durante las fases de desarrollo local, compilación, análisis estático, tipado y testing:
   - `typescript`, `eslint`, `prettier`, `vitest`, `jest`, `tsx`, `@types/node`, `@nestjs/cli`.
3. **`peerDependencies`**:
   Paquetes que el proyecto espera que sean provistos por el consumidor final o por el entorno anfitrión (esencial para plugins y componentes compartidos).
4. **`optionalDependencies`**:
   Paquetes cuyo fallo de instalación no impide que el sistema funcione (p. ej., optimizadores nativos de plataforma o bindings de GPU). No utilizar para ocultar dependencias rotas.

---

## 11. Remediación con `overrides`

PostgreSQL, NestJS o utilidades auxiliares pueden arrastrar dependencias transitivas con vulnerabilidades conocidas o desactualizadas. La sección `overrides` en el `package.json` raíz permite forzar una versión específica en todo el árbol de dependencias:

```json
{
  "overrides": {
    "picomatch": "4.0.4",
    "path-to-regexp": "8.3.0",
    "lodash": "4.17.21",
    "qs": "6.14.2"
  }
}
```

### 11.1. Política de Gobernanza de Overrides
Cada override incorporado al repositorio **SHOULD** estar documentado en un registro interno o comentario en la documentación de arquitectura, indicando:
1. **Motivo técnico / Identificador CVE**: (p. ej., `CVE-2024-XXXX`).
2. **Fecha de incorporación**.
3. **Condición de remoción**: (p. ej., *"Eliminar cuando `@nestjs/platform-express` actualice a `path-to-regexp` v8 en upstream"*).

---

## 12. Supply Chain Security: Scripts de Instalación

Los scripts del ciclo de vida de los paquetes (`preinstall`, `install`, `postinstall`, `prepare`) representan una de las superficies de ataque más críticas en el ecosistema JavaScript:
- Un paquete comprometido en el registry puede intentar ejecutar código arbitrario en la máquina del desarrollador o en el runner de CI durante la fase de instalación.

### 12.1. Política Moderna de npm 11 (`allowScripts`)
npm 11 introduce la capacidad de auditar y restringir qué paquetes tienen autorización para ejecutar install scripts:

```bash
# Listar dependencias que solicitan ejecutar scripts
npm install-scripts ls

# Aprobar explícitamente un paquete legítimo (ej. prisma o sharp)
npm install-scripts approve prisma
npm install-scripts approve @swc/core

# Denegar un paquete sospechoso
npm install-scripts deny suspicious-package
```

### 12.2. Recomendación Senior
Para proyectos de alta seguridad, activar en `.npmrc`:
```ini
strict-allow-scripts=true
```
y mantener una lista blanca (*allowlist*) de dependencias auditadas.

### 12.3. No Usar Ciegamente `--ignore-scripts`
Ejecutar ciegamente `npm install --ignore-scripts` como política universal rompe dependencias legítimas que requieren descargas binarias o generación de código (p. ej., `prisma generate` o `@swc/core`). La estrategia profesional consiste en:
$$\text{Allowlist Auditada} \;+\; \text{Revisión de Dependencias}$$

---

## 13. Verificación de la Cadena de Suministro en CI

El pipeline de CI/CD debe incorporar dos niveles complementarios de verificación:

```bash
# 1. Auditoría de vulnerabilidades conocidas
npm audit --audit-level=high

# 2. Verificación criptográfica de firmas de registry y procedencia
npm audit signatures
```

### 13.1. La Auditoría no es Seguridad Absoluta
`npm audit` detecta únicamente vulnerabilidades registradas en bases de datos públicas. No protege frente a:
- Malware de día cero (*zero-day*).
- Ataques de *typosquatting* (paquetes con nombres similares).
- Secuestro de cuentas de mantenedores (*maintainer takeover*).
- Código malicioso insertado recientemente sin reporte de seguridad.

**Defensa en Profundidad:** Debe complementarse con revisión de cambios en el lockfile, escaneo de dependencias en Pull Requests (GitHub Dependency Review) y reducción activa de la superficie de dependencias.

---

## 14. Protocolo para Agregar Dependencias

Antes de ejecutar `npm install <paquete>`, someter la decisión a las siguientes preguntas:
1. ¿El problema de negocio realmente justifica agregar un paquete externo?
2. ¿La plataforma web moderna, Node.js o TypeScript ya ofrecen esta capacidad de forma nativa?
3. ¿Cuántas dependencias transitivas arrastra? (Verificar en `bundlephobia` o `npm view <pkg> dependencies`).
4. ¿Ejecuta scripts de instalación (`postinstall`)?
5. ¿Tiene un historial de mantenimiento activo y autores verificados?

### 14.1. Principio KISS Aplicado a Dependencias
Queda terminantemente prohibido instalar micro-librerías triviales (estilo `left-pad`, `is-number`, `is-even`) para operaciones elementales que se resuelven con métodos nativos de JavaScript moderno (`String.prototype.padStart`, `Array.prototype.flat`, `structuredClone`, `crypto.randomUUID`).

---

## 15. Estrategia de Actualización de Dependencias

Evitar el antipatrón de ejecutar `npm update` indiscriminadamente sobre todo el proyecto seguido de un commit masivo sin trazabilidad.

### 15.1. Flujo Gradual de Actualización
$$\text{Patch (Bugfixes)} \longrightarrow \text{Minor (Nuevas features compatibles)} \longrightarrow \text{Major (Breaking changes aislados)}$$

### 15.2. Automatización con Dependabot / Renovate
- Agrupar actualizaciones de bajo riesgo (*patch* y *minor* de desarrollo) en un PR semanal.
- Tratar las actualizaciones de versiones *Major* en Pull Requests individuales con pruebas exhaustivas.
- Prohibir el auto-merge en paquetes críticos sin intervención humana.

---

## 16. Manifiesto `package.json` — Base Node.js

Estructura canónica de un servicio backend Node.js (p. ej., `@testimonial-cms/api`):

```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=24.0.0 <25",
    "npm": ">=11.0.0 <12"
  },
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "audit": "npm audit --audit-level=high",
    "audit:signatures": "npm audit signatures"
  }
}
```

### 16.1. Prohibición de `npx` dentro de Scripts de `package.json`
Evitar scripts como `"dev": "npx tsx watch src/server.ts"`.
Cuando una herramienta está instalada como `devDependency`, npm inyecta automáticamente `node_modules/.bin` en el `PATH` de ejecución del script. Usar `npx` dentro de un script de `package.json` es redundante y puede provocar descargas inesperadas desde la red si el binario local no se encuentra.

---

## 17. Manifiesto `package.json` — Next.js

Estructura canónica de una aplicación frontend Next.js (p. ej., `@testimonial-cms/web`):

```json
{
  "name": "web",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check .",
    "test": "vitest run"
  },
  "dependencies": {
    "next": "15.5.14",
    "react": "19.0.0",
    "react-dom": "19.0.0"
  }
}
```

### 17.1. Deprecación de `next lint` y Adopción de ESLint Flat Config
Next.js deprecó el comando integrado `next lint` en sus versiones recientes.
- La estrategia moderna consiste en ejecutar directamente `eslint .` gobernado por `eslint.config.mjs`.

---

## 18. React Standalone (SPAs con Vite)

Para aplicaciones React independientes que no requieren el framework Next.js:
- Seguir la recomendación oficial de React y utilizar **Vite con TypeScript**:
```bash
npm create vite@latest my-spa -- --template react-ts
```

### 18.1. Scripts de React + Vite
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "format:check": "prettier --check ."
  }
}
```

---

## 19. Regla General de TypeScript: Desacoplamiento de `tsconfig`

> [!CAUTION]
> **Queda terminantemente prohibido utilizar un único archivo `tsconfig.json` idéntico para Node.js, Next.js y React/Vite.**
> Cada runtime tiene un sistema de resolución de módulos, un target de ECMAScript y una gestión de JSX completamente disímiles.

---

## 20. TypeScript para Node.js (Backend)

Configuración recomendada para Node.js 24+ con módulos ECMAScript nativos (`ESM`):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src/**/*.ts"]
}
```

### 20.1. El Rol de `skipLibCheck`
`skipLibCheck: true` no desactiva la comprobación estricta de tipos de tu código fuente; únicamente omite la validación interna de los archivos de declaración (`.d.ts`) de librerías en `node_modules`, acelerando sustancialmente los tiempos de compilación.

---

## 21. TypeScript en Next.js

Para aplicaciones Next.js:
- Mantener la base generada por `create-next-app` y robustecer con flags de seguridad sin alterar la resolución que Next espera:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## 22. TypeScript en React + Vite

En aplicaciones empaquetadas por bundler:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  },
  "include": ["src"]
}
```

---

## 23. ESLint Moderno: Flat Config (`eslint.config.mjs`)

A partir de ESLint 9, el formato **Flat Config** (`eslint.config.mjs` o `eslint.config.js`) es el estándar por defecto de la industria:
- Elimina la complejidad de archivos `.eslintrc.*` heredados.

### 23.1. Linter $\neq$ Formatter
Separar responsabilidades con nitidez:
- **ESLint**: Gobierna la **corrección técnica**, prevención de bugs y calidad de código.
- **Prettier**: Gobierna el **formateo estético** (espaciado, comillas, saltos de línea).
- Utilizar `eslint-config-prettier` para desactivar cualquier regla de ESLint que entre en conflicto con Prettier.

---

## 24. Seguridad Estática en Código

Plugins como `eslint-plugin-security` aportan valor para alertar sobre patrones riesgosos (`RegExp` complejas o acceso inseguro a propiedades).
> [!WARNING]
> Un linter estático jamás sustituye un análisis de seguridad real (SAST/DAST). No confiar en reglas de linter para prevenir vulnerabilidades de inyección SQL, XSS o control de acceso.

---

## 25. Variables de Entorno: Regla General

Separar estrictamente:
1. **Configuración Pública**: Valores visibles por el usuario (URLs de assets, nombres de aplicación).
2. **Configuración Privada**: Valores internos del servidor (puertos, niveles de log).
3. **Secretos**: Credenciales confidenciales (contraseñas de base de datos, API keys, private keys).

### 25.1. Protección Absoluta de Secretos en Git
El archivo `.gitignore` debe contener obligatoriamente:
```gitignore
.env
.env.local
.env.*.local
*.env
```
Mantener un único archivo `.env.example` versionado con valores ficticios documentales.

---

## 26. Archivo `.env.example` Canónico

```dotenv
# Entorno y Servidor
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# Persistencia (Ejemplo seguro sin credenciales reales)
DATABASE_URL=postgresql://user:password@localhost:5432/app_dev

# Seguridad y Autenticación
JWT_SECRET=super_secret_jwt_key_at_least_32_chars_long
CORS_ORIGIN=http://localhost:3001
```

---

## 27. Soporte Nativo de `.env` en Node.js 24

Node.js moderno incluye soporte nativo para carga de archivos de entorno:
```bash
node --env-file=.env dist/server.js
```
### 27.1. Consecuencia
En Node.js 24+, la librería externa `dotenv` ya **NO** debe instalarse de forma automática por costumbre. Usarla únicamente si el framework (p. ej., ciertas configuraciones de NestJS `@nestjs/config`) o flujos heredados lo requieren explícitamente.

---

## 28. Validación del Entorno con Zod (Fail-Fast)

Cargar variables en `process.env` no garantiza que sean válidas. Se debe compilar un esquema con validación obligatoria en el arranque del servidor:

```typescript
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
});

export type Env = z.infer<typeof EnvSchema>;

// Falla inmediatamente en tiempo de arranque si alguna variable es inválida
export const env: Env = EnvSchema.parse(process.env);
```

### 28.1. Principio Fail-Fast
Si `DATABASE_URL` no está definida o no es una URL válida, el proceso **debe abortar de inmediato al iniciar**. Es inaceptable descubrir una variable faltante cuando un usuario ejecuta la primera petición HTTP.

---

## 29. Variables de Entorno en Next.js

- Variables sin prefijo (`DATABASE_URL`, `STRIPE_SECRET_KEY`): Disponibles **únicamente** en Server Components, Route Handlers y Server Actions.
- Variables con prefijo `NEXT_PUBLIC_*`: Se incrustan físicamente en el bundle de JavaScript que se envía al navegador.

### 29.1. Prohibición Absoluta
> [!CAUTION]
> Jamás prefijar credenciales privadas con `NEXT_PUBLIC_*`:
> ```dotenv
> # GRAVE ERROR DE SEGURIDAD:
> NEXT_PUBLIC_DATABASE_PASSWORD=...
> NEXT_PUBLIC_STRIPE_SECRET=...
> ```

### 29.2. Incrustación en Build-Time
Las variables `NEXT_PUBLIC_*` se resuelven e incrustan durante el comando `next build`. Si compilas en un entorno de staging con variables de staging, promover el mismo contenedor a producción conservará los valores públicos de staging a menos que el build esté desacoplado conscientemente.

---

## 30. Variables de Entorno en React + Vite

Vite expone al código del cliente únicamente aquellas variables que comienzan con el prefijo `VITE_`:
```dotenv
VITE_API_URL=https://api.example.com
```
Cualquier variable con prefijo `VITE_` es pública y visible para cualquier persona que inspeccione el código fuente en el navegador. Jamás almacenar claves secretas con prefijo `VITE_`.

---

## 31. Gestión de Entornos

Reconocer formalmente cuatro entornos:
1. `development`: Entorno local con recarga en caliente y logs detallados.
2. `test`: Entorno automatizado aislado para tests unitarios y de integración.
3. `staging`: Réplica exacta de la infraestructura y configuración de producción.
4. `production`: Entorno real optimizado, asegurado y con observabilidad completa.

### 31.1. No Implementar Lógica Arquitectónica Basada en Entorno
Evitar bifurcaciones en el código como:
```typescript
// ANTIPATRÓN:
if (process.env.NODE_ENV === 'production') {
  // Arquitectura o flujo completamente diferente
}
```
El modelo del sistema debe ser idéntico en todos los entornos; lo único que varía son las URLs, credenciales, cuotas de recursos y niveles de log.

---

## 32. Separación Build-Time vs Runtime

- **Build Configuration**: Herramientas necesarias para compilar el código (`typescript`, `next build`, `vite build`, variables `NEXT_PUBLIC_*` / `VITE_*`).
- **Runtime Configuration**: Variables y secretos leídos en tiempo de ejecución por el proceso en producción (`DATABASE_URL`, `PORT`, `JWT_SECRET`).

En SPAs puras (React + Vite), el 100% de la configuración queda horneada en los archivos estáticos durante el build.

---

## 33. Archivo `.gitignore` Mínimo y Robusto

```gitignore
# Dependencias
node_modules/

# Salidas de compilación
dist/
build/
.next/
out/
coverage/

# Entornos y Secretos
.env
.env.local
.env.*.local
*.pem
*.key

# Logs
*.log
npm-debug.log*

# Sistema y Editores
.DS_Store
Thumbs.db
.vscode/*
!.vscode/extensions.json
!.vscode/settings.json
```

---

## 34. Archivos que SÍ Deben Versionarse

- `package.json`
- `package-lock.json`
- `.npmrc`
- `.node-version` (o `.nvmrc`)
- `tsconfig.json` y `tsconfig.base.json`
- `eslint.config.mjs`
- Archivos de configuración de Prettier
- `.env.example`
- `Dockerfile` y `.dockerignore`
- Workflows de CI/CD (`.github/workflows/*.yml`)

---

## 35. Husky y Git Hooks

Husky es excelente para brindar retroalimentación ultrarrápida al desarrollador antes de confirmar cambios en local.
> [!NOTE]
> Un Git hook local **NO** es una barrera de seguridad. Un desarrollador puede saltearse los hooks ejecutando `git commit --no-verify`. El pipeline de CI/CD es la única autoridad de seguridad inmutable.

### 35.1. Pre-commit Liviano
Mantener los hooks de pre-commit breves (< 3 segundos):
- Lint y formateo de archivos staged mediante `lint-staged`.
- Detección rápida de secretos.
- Jamás ejecutar la suite completa de tests de integración o el build de producción en cada commit.

---

## 36. Configuración de `lint-staged`

```json
{
  "lint-staged": {
    "*.{js,jsx,ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md,yml,yaml}": [
      "prettier --write"
    ]
  }
}
```

---

## 37. Scripts de npm como API del Repositorio

Los scripts del `package.json` deben actuar como la interfaz de usuario para los desarrolladores. Un ingeniero recién incorporado debe poder inferir cómo desarrollar, validar, compilar y ejecutar el proyecto inspeccionando únicamente `package.json`.

### 37.1. Convención Canónica
```json
{
  "scripts": {
    "dev": "npm run dev:watch",
    "build": "tsc -p tsconfig.build.json",
    "start": "node dist/main.js",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --max-warnings=0",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "audit": "npm audit --audit-level=high",
    "audit:signatures": "npm audit signatures"
  }
}
```

---

## 38. Producción en Node Backend: Artefacto Mínimo

Para preparar el contenedor o entorno de ejecución de producción:
1. Instalar dependencias completas y compilar TypeScript en la etapa de build.
2. En el artefacto de ejecución final, instalar **únicamente** las dependencias de producción:
```bash
npm ci --omit=dev
```
La bandera `--omit=dev` descarta físicamente todo el toolchain de desarrollo del disco en producción.

---

## 39. Docker Multi-Stage para Node.js

Patrón de empaquetado seguro y optimizado:

```dockerfile
# ---------------------------------------------------------
# ETAPA 1: BUILD
# ---------------------------------------------------------
FROM node:24-alpine AS build

WORKDIR /app

# Copiar manifiestos y lockfile para aprovechar caché de capas
COPY package*.json ./
COPY .npmrc ./

# Instalar todas las dependencias (incluyendo devDependencies)
RUN npm ci

# Copiar código fuente y compilar
COPY . .
RUN npm run build

# ---------------------------------------------------------
# ETAPA 2: PRODUCCIÓN (Runtime Mínimo)
# ---------------------------------------------------------
FROM node:24-alpine AS production

ENV NODE_ENV=production

WORKDIR /app

# Copiar manifiestos e instalar exclusivamente dependencias de producción
COPY package*.json ./
COPY .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

# Copiar únicamente el código compilado desde la etapa de build
COPY --from=build /app/dist ./dist

# Ejecución bajo usuario no privilegiado (prohibido root)
USER node

EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### 39.1. Principios de la Imagen de Producción
- Basada en una versión Active LTS de Node.js.
- Excluye código fuente innecesario y archivos de configuración de desarrollo.
- Excluye compiladores y toolchains de build (`typescript`, linters).
- Se ejecuta obligatoriamente bajo el usuario `USER node`.
- Cero credenciales o secretos embebidos en las capas de la imagen.

---

## 40. Compilación de Producción en Next.js

Para Next.js:
- El comando `next build` **requiere** las `devDependencies` (TypeScript, Tailwind, etc.).
- Por ello, la etapa de build ejecuta `npm ci` completo.
- Para reducir el artefacto de servidor, habilitar en `next.config.js`:
```javascript
module.exports = {
  output: 'standalone',
};
```
Esto genera una carpeta `.next/standalone` autocontenida con las dependencias mínimas requeridas para el servidor Node.js.

---

## 41. Producción de SPAs en React (Vite)

Una aplicación cliente pura generada con Vite produce archivos estáticos en `dist/`:
- Una vez ejecutado `npm run build`, Node.js y `node_modules` **NO** son necesarios en producción.
- El directorio `dist/` debe servirse mediante una red CDN (Cloudflare, CloudFront) o un servidor web estático ultra ligero (Nginx, Caddy).

---

## 42. Pipeline de Integración Continua (CI Pipeline)

Secuencia mínima e inmutable de pasos en CI:

```text
1. Checkout de código
   ↓
2. Configuración de versión exacta de Node.js (según .node-version)
   ↓
3. npm ci (Instalación limpia y determinista)
   ↓
4. npm audit signatures (Verificación criptográfica de procedencia)
   ↓
5. npm run typecheck (Comprobación estricta de tipos de TypeScript)
   ↓
6. npm run lint (Análisis estático de calidad con ESLint)
   ↓
7. npm test (Ejecución de suite de tests unitarios y de integración)
   ↓
8. npm run build (Compilación del artefacto de producción)
   ↓
9. npm audit --audit-level=high (Auditoría de vulnerabilidades)
   ↓
10. Empaquetado y publicación de artefactos
```

---

## 43. Caché Inteligente en CI

- **CORRECTO**: Cachear el directorio de caché de descargas de npm (`~/.npm`).
- **INCORRECTO**: Cachear la carpeta `node_modules/` para saltearse `npm ci`. Cachear `node_modules` arrastra estado oculto y destruye la garantía de reproducibilidad de la compilación.

---

## 44. Monorepos con `npm workspaces`

Para estructurar monorepos (p. ej., `@testimonial-cms`):

```text
testimonial-cms/
├── apps/
│   ├── api/                   # Backend NestJS (@testimonial-cms/api)
│   └── web/                   # Frontend Next.js (@testimonial-cms/web)
├── packages/
│   ├── contracts/             # DTOs y tipos compartidos
│   └── config/                # Configuraciones base de ESLint / TS
├── package.json               # Manifiesto raíz con workspaces
└── package-lock.json          # Lockfile único centralizado
```

### 44.1. Manifiesto Raíz
```json
{
  "name": "testimonial-cms",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ]
}
```

### 44.2. Compartir Configuración sin Mezclar Responsabilidades
Se debe compartir: configuraciones base de ESLint, configuraciones base de TypeScript, contratos de tipos y esquemas Zod.
Jamás convertir paquetes compartidos en un "cajón de sastre" que acople dominios no relacionados.

---

## 45. Modelo de Permisos Nativo de Node.js (`--permission`)

Node.js moderno incorpora un Permission Model nativo (anteriormente experimental):
> [!NOTE]
> La directiva obsoleta `--drop-permissions` no representa el modelo actual. El estándar actual es la bandera `--permission` combinada con permisos granulares:

```bash
node \
  --permission \
  --allow-fs-read=./dist,./config \
  --allow-net=api.stripe.com,localhost \
  dist/server.js
```

### 45.1. Comprensión del Modelo de Seguridad
El modelo de permisos de Node.js **NO es un sandbox impenetrable** contra código deliberadamente malicioso; está concebido como una capa de defensa en profundidad (*seat belt*) para prevenir accesos accidentales o bugs en dependencias de confianza. Debe combinarse con permisos de sistema operativo, contenedores y usuarios no privilegiados.

---

## 46. Prevención de Path Traversal en el Sistema de Archivos

Una comprobación ingenua como `targetPath.startsWith(SAFE_ROOT)` es vulnerable a ataques de prefijo (p. ej., si `SAFE_ROOT = "/app/public"`, un target `/app/public-malicious/file` comenzará con la misma cadena).

### 46.1. Implementación Segura y Canónica
```typescript
import path from 'node:path';
import { readFile } from 'node:fs/promises';

const SAFE_ROOT = path.resolve(process.cwd(), 'public');

export async function safeReadFile(userPath: string): Promise<string> {
  // 1. Resolver ruta absoluta del destino
  const target = path.resolve(SAFE_ROOT, userPath);

  // 2. Calcular la ruta relativa respecto a la raíz permitida
  const relative = path.relative(SAFE_ROOT, target);

  // 3. Validar si intenta escapar mediante '../' o si es absoluta fuera de raíz
  const escapesRoot = relative.startsWith('..') || path.isAbsolute(relative);

  if (escapesRoot) {
    throw new Error('Acceso denegado: la ruta solicitada está fuera del directorio permitido.');
  }

  return readFile(target, 'utf8');
}
```

---

## 47. Ejecución Segura de Procesos Hijos (`child_process`)

> [!CAUTION]
> Jamás invocar comandos del sistema concatenando entradas de usuario con `exec`:
> ```typescript
> // GRAVE VULNERABILIDAD DE INYECCIÓN DE COMANDOS:
> exec(`convert ${userInput}`);
> ```

**Patrón Seguro:** Utilizar siempre `spawn` o `execFile` con argumentos separados en un array y deshabilitando la invocación de shell (`shell: false`):

```typescript
import { spawn } from 'node:child_process';

const child = spawn('convert', [validatedImagePath, '-resize', '800x600', outputPath], {
  shell: false,
});
```

---

## 48. Prohibición de `eval` y Funciones Dinámicas

Queda terminantemente prohibido el uso de:
- `eval(userInput)`
- `new Function(userInput)`
- Módulos `vm` como presunto sandbox seguro frente a código no confiable (el módulo nativo `vm` de Node.js no está diseñado para aislar código hostil).

---

## 49. Manejo de Secretos en Tiempo de Ejecución

Los secretos de producción jamás deben residir en:
- El repositorio Git.
- Archivos `.env` en imágenes de Docker.
- Capas de contenedores.
- Código empaquetado del cliente.
- Mensajes de log.

**Mecanismos Válidos:** Inyección mediante variables de entorno en el orquestador (Kubernetes Secrets, ECS Task Definitions, HashiCorp Vault, AWS Secrets Manager).

---

## 50. Sanitización de Logs de Configuración

> [!CAUTION]
> Jamás volcar el objeto de entorno completo en la inicialización:
> ```typescript
> // VULNERABILIDAD: Expone contraseñas y tokens en texto plano en los logs
> logger.info(process.env);
> ```

### 50.1. Registro Seguro y Controlado
```typescript
logger.info(
  {
    environment: env.NODE_ENV,
    port: env.PORT,
    logLevel: env.LOG_LEVEL,
    nodeVersion: process.version,
  },
  'Configuración de aplicación inicializada con éxito',
);
```

---

## 51. Ciclo de Vida del Proceso y Graceful Shutdown

Tanto `uncaughtException` como `unhandledRejection` indican que el proceso de Node.js se encuentra en un estado potencialmente inconsistente y corrupto:
- Jamás capturar excepciones globales simplemente para "seguir ejecutando" como si nada hubiera ocurrido.

### 51.1. Manejo de Señales (`SIGTERM`, `SIGINT`)
Cuando el orquestador solicita detener el contenedor, se debe ejecutar un apagado ordenado:

```typescript
async function gracefulShutdown(signal: string) {
  logger.info({ signal }, 'Iniciando apagado ordenado del servicio...');

  // 1. Dejar de recibir nuevo tráfico cerrando el servidor HTTP
  await app.close();

  // 2. Finalizar trabajos pendientes y cerrar conexiones de base de datos
  await prisma.$disconnect();

  // 3. Salir limpiamente con código 0
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
```

---

## 52. Principio de Aplicación Desechable (Disposable Apps)

Siguiendo la metodología Twelve-Factor App:
- Los procesos deben maximizar la robustez con un **inicio rápido** y un **apagado limpio**.
- Si un proceso entra en un estado corrupto, debe terminar rápidamente (`process.exitCode = 1`) y delegar en el supervisor externo (Kubernetes, Docker restart policy) el levantamiento de una nueva instancia limpia.

---

## 53. Testing Automatizado de Configuración

La configuración y los esquemas de validación de entorno deben contar con tests unitarios automatizados:

```typescript
import { describe, it, expect } from 'vitest';
import { EnvSchema } from './env.schema';

describe('EnvSchema Configuration', () => {
  it('rechaza el inicio si DATABASE_URL no es válida', () => {
    expect(() => {
      EnvSchema.parse({
        NODE_ENV: 'test',
        DATABASE_URL: 'invalid-url',
      });
    }).toThrow();
  });

  it('asigna el puerto 3000 por defecto si no se especifica', () => {
    const result = EnvSchema.parse({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://localhost:5432/test',
    });
    expect(result.PORT).toBe(3000);
  });
});
```

---

## 54. Gestión de Dependencias de Testing

Si una librería se importa en el código de producción (p. ej., `zod` para validación de DTOs), debe figurar mandatoriamente en `dependencies`. No mover paquetes utilizados en runtime a `devDependencies` simplemente porque también se usan en los tests.

---

## 55. Dependencias Exclusivas del Build

Herramientas como `typescript`, `eslint`, `prettier` y `vitest` jamás deben ser importadas por el código de runtime y pertenecen estrictamente a `devDependencies`.

---

## 56. Protección Contra Publicaciones Accidentales

Para evitar que el código fuente propietario o privado sea publicado por error en el registry público de npm, los archivos `package.json` de aplicaciones y del monorepo raíz deben contener mandatoriamente:

```json
{
  "private": true
}
```

---

## 57. Seguridad en el npm Registry

En organizaciones que operan con registries privados (Artifactory, GitHub Packages, Nexus):
- Configurar scopes explícitos (`@company:registry=...`).
- Exigir autenticación de doble factor (2FA) para todas las cuentas de desarrollador en npm.

---

## 58. `.npmrc` Seguro con Registries Privados

Jamás incrustar tokens de autenticación en texto plano en el archivo `.npmrc` versionado en Git:

```ini
# CORRECTO: Inyección mediante variable de entorno en CI
@company:registry=https://npm.pkg.github.com/
//npm.pkg.github.com/:_authToken=${NPM_TOKEN}
```

---

## 59. Dependencias desde Git o URLs Arbitrarias

Evitar dependencias referenciadas directamente mediante URLs de Git o tarballs remotos (`"pkg": "git+https://..."`):
- Dificultan la auditoría de procedencia (*provenance*), reducen la reproducibilidad de compilación y no cuentan con verificación de firmas de registry.
- Exigir siempre paquetes versionados mediante semver desde el registry oficial.

---

## 60. Optimización de Performance sin Comprometer Seguridad

- Aprovechar la caché de descargas de npm en CI (`actions/cache`).
- Mantener un árbol de dependencias reducido y podado.
- Jamás desactivar chequeos de auditoría de seguridad o verificaciones de lockfile para "ahorrar unos segundos" en el pipeline de CI.

---

## 61. Los 25 Antipatrones de Configuración (CONFIG-01 a CONFIG-25)

### ⚠️ [CONFIG-01] — No versionar `package-lock.json`
*Ignorar el lockfile en Git introduce drift instantáneo entre desarrolladores y destruye la reproducibilidad en producción.*

### ⚠️ [CONFIG-02] — Ejecutar `npm install` en CI en lugar de `npm ci`
*Permite la mutación no auditada de dependencias durante la fase de integración continua.*

### ⚠️ [CONFIG-03] — Utilizar versiones EOL de Node.js
*Ejecutar en producción versiones sin parches de seguridad para vulnerabilidades críticas del motor V8 y libuv.*

### ⚠️ [CONFIG-04] — No declarar el runtime compatible (`engines`)
*Dejar que el proyecto se ejecute sobre versiones incompatibles de Node.js o npm.*

### ⚠️ [CONFIG-05] — Instalar paquetes sin analizar necesidad
*Incorporar librerías de 50 dependencias transitivas para resolver un problema de 3 líneas de código.*

### ⚠️ [CONFIG-06] — Usar `^` indiscriminadamente en aplicaciones
*Permitir que las dependencias directas de una aplicación final se actualicen silenciosamente sin validación explícita.*

### ⚠️ [CONFIG-07] — Colocar todas las herramientas en `dependencies`
*Llevar linters, compiladores y suites de test al contenedor final de producción.*

### ⚠️ [CONFIG-08] — Colocar librerías de runtime en `devDependencies`
*Provocar que la aplicación falle en producción con `MODULE_NOT_FOUND` al ejecutar `npm ci --omit=dev`.*

### ⚠️ [CONFIG-09] — Versionar archivos `.env` con credenciales reales
*Filtrar secretos corporativos y claves de acceso en el historial de Git.*

### ⚠️ [CONFIG-10] — Exponer secretos en `NEXT_PUBLIC_*`
*Incrustar tokens privados de servidor en el bundle de JavaScript que se descarga en los navegadores de los clientes.*

### ⚠️ [CONFIG-11] — Exponer secretos en `VITE_*`
*Almacenar claves secretas de base de datos o APIs privadas bajo el prefijo público de Vite.*

### ⚠️ [CONFIG-12] — Confiar ciegamente en TypeScript para validar `process.env`
*Creer que declarar `declare namespace NodeJS { interface ProcessEnv ... }` valida los valores en tiempo de ejecución. Usar Zod.*

### ⚠️ [CONFIG-13] — Compartir el mismo `tsconfig.json` para Node, Next y React
*Mezclar resoluciones incompatibles (`NodeNext` vs `Bundler`) provocando errores sutiles de compilación.*

### ⚠️ [CONFIG-14] — Crear archivos `.eslintrc` heredados en proyectos nuevos
*Ignorar el estándar moderno de Flat Config (`eslint.config.mjs`) adoptado a partir de ESLint 9.*

### ⚠️ [CONFIG-15] — Usar `next lint` en lugar de `eslint .`
*Depender de un comando deprecado por Next.js que no se alinea con la configuración moderna.*

### ⚠️ [CONFIG-16] — Ejecutar install scripts de dependencias sin revisión
*Permitir que cualquier paquete ejecute código arbitrario en `postinstall` sin una allowlist controlada.*

### ⚠️ [CONFIG-17] — Asumir que `npm audit` detecta todo tipo de malware
*Olvidar que `npm audit` solo conoce vulnerabilidades previamente reportadas.*

### ⚠️ [CONFIG-18] — Ejecutar `npm audit fix --force` automáticamente
*Romper la aplicación al aplicar breaking changes arbitrarios sin supervisión técnica.*

### ⚠️ [CONFIG-19] — Mantener `overrides` olvidados sin documentación
*Arrastrar parches temporales de dependencias transitivas durante años sin verificar si upstream ya lo resolvió.*

### ⚠️ [CONFIG-20] — Usar `npx` dentro de scripts de `package.json`
*Añadir sobrecarga innecesaria y riesgo de descargas remotas cuando el binario ya existe en `node_modules/.bin`.*

### ⚠️ [CONFIG-21] — Instalar `dotenv` en Node 24+ por costumbre
*Agregar una dependencia innecesaria cuando Node cuenta con soporte nativo mediante `--env-file`.*

### ⚠️ [CONFIG-22] — Ejecutar contenedores Docker de producción como `root`
*Permitir que una vulnerabilidad de ejecución remota comprometa el host subyacente. Usar `USER node`.*

### ⚠️ [CONFIG-23] — Incluir el toolchain de compilación en la imagen final
*Aumentar el peso de la imagen de producción en cientos de megabytes y ampliar la superficie de ataque.*

### ⚠️ [CONFIG-24] — Utilizar la bandera inexistente `--drop-permissions`
*Confundir la sintaxis del Permission Model moderno de Node.js (`node --permission`).*

### ⚠️ [CONFIG-25] — Usar `startsWith()` ingenuamente contra Path Traversal
*Creer que una comparación de cadenas simple protege contra rutas que escapan del directorio permitido.*

---

## 62. Definition of Done (DoD para Configuración de Proyectos)

Un proyecto se considera certificado y listo para producción cuando cumple:

### Runtime y Contratos
- [ ] Versión de Node.js soportada oficialmente (Active LTS).
- [ ] Archivo `.node-version` (o `.nvmrc`) presente en la raíz.
- [ ] Campo `engines` definido con rangos estrictos en `package.json`.
- [ ] Archivo `.npmrc` configurado con `engine-strict=true`.

### Dependencias y Cadena de Suministro
- [ ] Archivo `package-lock.json` versionado en Git.
- [ ] El comando `npm ci` ejecuta limpiamente sin advertencias ni modificaciones.
- [ ] Dependencias clasificadas correctamente en `dependencies` vs `devDependencies`.
- [ ] Ninguna librería de runtime ubicada por error en `devDependencies`.
- [ ] Todos los `overrides` cuentan con justificación técnica y condición de retiro.
- [ ] Scripts de instalación auditados con `strict-allow-scripts` o allowlist explícita.
- [ ] Verificación de firmas con `npm audit signatures` superada en CI.
- [ ] Cero tokens de autenticación de npm versionados en el código.

### TypeScript y Calidad de Código
- [ ] Modo estricto activado (`strict: true`) en todos los `tsconfig`.
- [ ] Configuraciones de TypeScript especializadas y desacopladas (NodeNext vs Bundler).
- [ ] ESLint configurado mediante Flat Config (`eslint.config.mjs`).
- [ ] Separación nítida entre Linter (ESLint) y Formatter (Prettier).
- [ ] Comprobación de tipos (`tsc --noEmit`) sin advertencias ni errores.

### Variables de Entorno y Seguridad
- [ ] Archivo `.env.example` actualizado y documentado.
- [ ] Todos los archivos `.env` reales excluidos en `.gitignore`.
- [ ] Esquema Zod implementado para validación en tiempo de arranque (*fail-fast*).
- [ ] Cero secretos o credenciales privadas expuestas en `NEXT_PUBLIC_*` o `VITE_*`.
- [ ] Cero llamadas a `process.env` registradas íntegramente en logs de producción.

### CI/CD y Empaquetado en Producción
- [ ] Pipeline de CI configurado con `npm ci` y sin mutación de manifiestos.
- [ ] Dockerfile implementado con arquitectura multi-stage.
- [ ] Contenedor de producción ejecutándose obligatoriamente bajo `USER node`.
- [ ] Artefacto de producción instalado mediante `npm ci --omit=dev`.
- [ ] Manejo de señales de terminación (`SIGTERM`, `SIGINT`) con apagado ordenado.

---

## 63. KPIs e Indicadores Clave de Rendimiento

| Métrica / Indicador | Meta Objetivo | Método de Medición |
| :--- | :--- | :--- |
| **Builds de CI no reproducibles** | **0** | Registros de ejecución en runners de CI |
| **Lockfiles no versionados en Git** | **0** | Auditoría de repositorios |
| **Dependencias con vulnerabilidad crítica/alta**| **0** | Reporte de `npm audit` en cada PR |
| **Secretos expuestos en el repositorio** | **0** | Escaneo de secretos (TruffleHog / GitGuardian) |
| **Secretos filtrados en el bundle cliente** | **0** | Análisis estático de bundles de Next/Vite |
| **Runtimes EOL ejecutándose en producción** | **0** | Auditoría de infraestructura y contenedores |
| **Variables de entorno sin validación Zod** | **0** | Revisión de código en módulos de configuración |
| **Overrides de dependencias sin justificar**| **0** | Auditoría de `package.json` |
| **Install scripts desconocidos en producción**| **0** | Monitoreo de `npm install-scripts` |
| **Paquetes de runtime en `devDependencies`** | **0** | Pruebas de ejecución con `--omit=dev` |
| **CI utilizando `npm install` por error** | **0** | Validación estricta de workflows de GitHub Actions |
| **Proyectos nuevos con configuración legacy**| **0** | Auditoría de `eslint.config.mjs` |
| **Contenedores Docker ejecutándose como root**| **0** | Inspección de manifiestos de Docker y K8s |

---

## 64. Protocolo Senior para Agregar una Dependencia (14 Preguntas)

Antes de instalar cualquier paquete, responder formalmente:
1. ¿Qué problema concreto de negocio o arquitectura resuelve este paquete?
2. ¿La plataforma web, Node.js nativo o TypeScript ya proveen esta solución?
3. ¿Debe ubicarse en `dependencies`, `devDependencies` o `peerDependencies`?
4. ¿Cuántas dependencias transitivas introduce en el árbol?
5. ¿Ejecuta scripts de ciclo de vida durante la instalación (`preinstall`, `postinstall`)?
6. ¿Tiene vulnerabilidades críticas o historial de incidentes de seguridad reportados?
7. ¿Cuenta con mantenimiento activo, commits recientes y autores respaldados?
8. ¿Requiere compilación de código nativo C/C++ o descarga de binarios de red?
9. ¿Afectará el tamaño final del bundle del cliente (`bundle size`)?
10. ¿Afectará el tiempo de arranque en frío (*cold start*) de funciones serverless o contenedores?
11. ¿Afectará el tamaño y tiempo de construcción de la imagen de Docker?
12. ¿Es totalmente compatible con nuestra versión de Node.js LTS declarada en `engines`?
13. ¿Puede fijarse su versión exacta mediante `save-exact`?
14. ¿Qué plan de contingencia existe si el paquete deja de ser mantenido en el futuro?

---

## 65. Protocolo Senior para Configuración de Entornos (10 Preguntas)

Antes de declarar una nueva variable de entorno:
1. ¿Es una variable pública (cliente) o privada (servidor)?
2. ¿Es una configuración requerida en tiempo de compilación (*build-time*) o de ejecución (*runtime*)?
3. ¿Contiene credenciales secretas, claves privadas o información sensible?
4. ¿Quién es responsable de proporcionar su valor en producción (Secret Manager, CI, Infra)?
5. ¿Debe contar con un valor por defecto seguro para entornos de desarrollo local?
6. ¿Es estrictamente obligatoria para que el proceso pueda iniciar?
7. ¿Cómo está tipada y validada en el esquema Zod?
8. ¿Existe riesgo de que su valor aparezca accidentalmente en logs o trazas de error?
9. ¿Existe riesgo de que termine expuesta al navegador mediante `NEXT_PUBLIC_*` o `VITE_*`?
10. ¿Puede modificarse su valor sin necesidad de recompilar el artefacto del software?

---

## 66. Cheat Sheet — Las 25 Reglas de Oro de Configuración

1. Usar siempre **Node.js Active LTS** en producción.
2. Versionar explícitamente el runtime mediante `.node-version`.
3. Versionar obligatoriamente `package-lock.json` en Git.
4. Ejecutar **únicamente `npm ci`** en entornos de CI/CD y producción.
5. Clasificar con precisión matemática `dependencies` vs `devDependencies`.
6. En aplicaciones finales, utilizar versiones fijas exactas (`save-exact=true`).
7. En librerías públicas, definir `peerDependencies` con rangos semver inclusivos.
8. Jamás ejecutar `npm audit fix --force` de manera automática.
9. Verificar firmas criptográficas y procedencia con `npm audit signatures`.
10. Bloquear scripts de instalación arbitrarios mediante `strict-allow-scripts=true`.
11. Documentar rigurosamente el motivo y condición de retiro de cada `override`.
12. No instalar micro-paquetes para operaciones soportadas nativamente por JavaScript.
13. No utilizar `npx` dentro de los scripts de `package.json`.
14. Validar las variables de entorno en tiempo de arranque mediante esquemas Zod (*fail-fast*).
15. Jamás versionar archivos con secretos reales en Git.
16. Recordar que toda variable con prefijo `NEXT_PUBLIC_*` es pública y visible en el navegador.
17. Recordar que toda variable con prefijo `VITE_*` es pública y visible en el cliente.
18. Desacoplar y especializar los archivos `tsconfig.json` según el runtime (NodeNext vs Bundler).
19. Activar siempre el modo estricto de TypeScript (`strict: true`).
20. Utilizar Flat Config (`eslint.config.mjs`) como estándar moderno de linting.
21. Separar la corrección técnica (ESLint) del formateo estético (Prettier).
22. Desacoplar la etapa de compilación del artefacto mínimo de producción en Docker.
23. Ejecutar contenedores de producción bajo usuarios no privilegiados (`USER node`).
24. Comprender que el Permission Model de Node.js es defensa en profundidad, no un sandbox.
25. Tratar la configuración reproducible como un pilar soberano de la arquitectura de software.

---

## 67. La Regla Rectora

Un proyecto de software profesional debe permitir que cualquier ingeniero recién incorporado pase de:
```bash
git clone <repo-url>
```
a:
```bash
npm ci
npm run build
npm test
```
de forma inmediata y determinista, **sin requerir**:
- Instalaciones manuales ocultas o dependencias globales en el sistema operativo.
- Suposiciones sobre versiones implícitas de Node.js o npm.
- Modificaciones manuales en archivos de configuración.
- Claves secretas de producción en archivos locales.
- Trucos o pasos mágicos no documentados en el repositorio.

La infraestructura local de desarrollo, los ejecutores de CI/CD y los contenedores de producción **deben partir exactamente del mismo contrato versionado**.

---

## 68. Resultado Esperado

Un proyecto estructurado bajo las directrices de la habilidad **`SKL-JS-CONFIG-001`** es:
- **Reproducible**: Idéntico comportamiento de compilación e instalación en cualquier entorno.
- **Determinista**: Cero drift de dependencias a lo largo del tiempo.
- **Strictly Typed**: Validación rigurosa de tipos en código y en variables de entorno.
- **Supply-Chain Aware**: Control absoluto sobre scripts de instalación, firmas y dependencias transitivas.
- **Environment-Safe**: Fronteras inmutables entre desarrollo, testing y producción.
- **Secret-Safe**: Cero fugas de credenciales en repositorios, logs o artefactos de cliente.
- **Auditable**: Contratos de runtime y dependencias completamente documentados.
- **CI-Ready**: Pipelines ultrarrápidos y seguros basados en `npm ci` y comprobaciones estáticas.
- **Minimal**: Artefactos de producción ligeros sin herramientas de desarrollo sobrantes.
- **Production-Ready**: Ejecución no privilegiada con apagado ordenado y máxima resiliencia.

El objetivo final de esta habilidad no es saturar el repositorio de archivos de configuración arbitrarios, sino **hacer explícitas, auditables y seguras todas las decisiones técnicas que determinan cómo el software se instala, compila, valida, protege y ejecuta en producción**.
