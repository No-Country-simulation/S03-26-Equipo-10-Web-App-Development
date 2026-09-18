---
name: nextjs-architecture-engineering
description: >-
  Diseño, implementación, revisión y evolución arquitectónica de aplicaciones Next.js de producción (código SKL-NEXT-ARCH-001). Usar cuando se requiera diseñar arquitecturas Modular Monolith con Feature-Oriented / Screaming Architecture, Server-First (RSC + Client Islands), Data Access Layer (DAL) con server-only, BFF, estrategias de renderizado y caching multicapa ('use cache', cacheLife), resiliencia multi-instancia, seguridad Zero-Trust y observabilidad con OpenTelemetry.
---

# Especificación Técnica de Habilidad: Senior Next.js Architecture & Application Engineering

---

**Código de Skill:** SKL-NEXT-ARCH-001  
**Nombre:** Senior Next.js Architecture & Application Engineering  
**Versión:** 1.0.0  
**Nivel:** Senior / Production Engineering  
**Dominio:** Next.js / React / Full-Stack / Arquitectura de Software / Infraestructura Web  
**Referencia de Framework:** Next.js 16.x / App Router  
**Estándares:** Next.js Architecture & Production Guidelines / React Server Components / OWASP / SOLID / DRY / KISS / YAGNI / Clean Architecture pragmática / Agile Definition of Done  

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, revisión y evolución arquitectónica de aplicaciones Next.js de producción. |
| **Objetivo de Dominio** | Construir aplicaciones Next.js modulares, mantenibles, server-first, seguras, observables y escalables. |
| **Arquitectura Base Recomendada** | Modular Monolith. |
| **Arquitectura de Código Recomendada** | Feature-Oriented / Screaming Architecture. |
| **Modelo de Renderizado** | Server Components + Client Islands + Static / Cached / Dynamic / Streaming. |
| **Modelo de Backend** | Server Components + Server Actions + Route Handlers / BFF según necesidad. |
| **Runtime** | Node.js por defecto; Edge cuando exista justificación concreta. |
| **Deployment** | Managed Serverless / Node Server / Docker / Multi-Instance. |
| **Complejidad** | Alta. |
| **Prioridad Técnica** | Correctitud → Seguridad → Límites arquitectónicos → Rendimiento → Observabilidad → Escalabilidad → Simplicidad. |

> [!NOTE]
> La documentación oficial vigente identifica Next.js como un framework React para construir aplicaciones web full-stack y mantiene App Router como el router troncal que incorpora Server Components y las capacidades modernas del framework.

---

## 2. Filosofía Arquitectónica

La Skill utilizará como arquitectura inicial preferida:
```text
MODULAR MONOLITH
+
SERVER-FIRST
+
FEATURE-ORIENTED CODE
+
THIN FRAMEWORK SHELL
```

La aplicación deberá mantener una sola unidad de despliegue mientras eso resulte suficiente, pero sus límites internos deberán permitir extraer módulos posteriormente sin una reescritura total.

> **Regla de Oro:** Distribuí responsabilidades dentro del código antes de distribuir procesos en la infraestructura.

No adoptar microservicios únicamente porque la aplicación crezca. El camino de madurez es:
```text
Monolith
  ↓
Modular Monolith
  ↓
Well-defined Domain Boundaries
  ↓
¿Necesidades independientes de infraestructura verificables?
  ↓
Service Extraction
```

### 2.1. Next.js no define por sí mismo la arquitectura de negocio
El sistema de archivos de Next define:
```text
routing
layouts
loading boundaries
error boundaries
API endpoints
metadata
```
pero no debe convertirse automáticamente en la arquitectura completa de negocio.

Next.js no impone cómo organizar o colocar internamente los archivos del proyecto; permite colocation, private folders, route groups, `src/` y organización por feature o route. Por lo tanto:
```text
src/app/
```
representará principalmente:
```text
routing
composition
rendering
framework integration
```
y **no** necesariamente todo el dominio de negocio.

---

## 3. Principio Rector: Framework como Shell

La aplicación **SHOULD** tratar a Next.js como:
```text
Delivery Mechanism
+
Rendering Engine
+
Routing System
+
Backend-for-Frontend (BFF) capability
```
y **nunca** como el lugar donde mezclar indiscriminadamente dentro de un `page.tsx`:
```text
SQL
business rules
authentication
React JSX
payments
emails
third-party APIs
cache
```

La lógica crítica del dominio debe poder sobrevivir conceptualmente aunque cambie:
- El framework (Next.js)
- El motor de base de datos
- El proveedor de hosting / nube
- La librería de UI / diseño

---

## 4. Arquitectura de Sistema Recomendada

La topología inicial preferida será:
```text
Browser (Web / Mobile WebView)
   │
   ▼
CDN / Edge / Reverse Proxy (WAF, TLS, Compression)
   │
   ▼
Next.js Application (Node.js Runtime)
   │
   ├── React Server Components (RSC)
   ├── Server Actions (Mutations)
   ├── Route Handlers / BFF (Public API & Webhooks)
   │
   ├── Application Layer (Use Cases & Orchestration)
   ├── Domain Modules (Entities, Value Objects, Pure Logic)
   └── Data Access Layer (DAL - server-only)
        │
        ├── Database (PostgreSQL / Connection Pool)
        ├── Redis (Distributed Cache & Locks)
        ├── Object Storage (S3 / Signed URLs)
        ├── Message Queue / Workers
        └── External Services (Stripe, Resend, etc.)
```

### 4.1. Arquitectura por Defecto: Modular Monolith
La primera opción **SHOULD** ser:
```text
1 repository
1 application
1 deployable
N bounded modules
```
Ejemplo:
```text
Auth
Billing
Projects
Notifications
Analytics
```
Cada módulo posee responsabilidades claramente delimitadas e interfaces públicas explícitas.

### 4.2. Cuándo Separar Servicios
Considerar la extracción a servicios externos únicamente cuando exista una necesidad verificable de:
- Escalado independiente por demanda desigual de recursos (CPU vs I/O).
- Despliegue con ciclo de vida independiente.
- Requisitos estrictos de seguridad o compliance aislado (PCI-DSS, HIPAA).
- Pila tecnológica especializada indispensable (Go, Python ML, Rust).
- Ownership claro por parte de equipos de ingeniería independientes.
- SLOs o latencias críticas diferenciadas.
- Workload de background intensivo o sockets persistentes.

Ejemplo:
```text
Next.js
├── auth module
├── project module
└── billing client
          │
          ▼
     Payments Service (PCI-DSS isolated)
```
> [!CAUTION]
> No separar `users-service`, `profile-service` y `preferences-service` bajo la falsa premisa de que “los microservicios escalan mejor”.

---

## 5. Server-First Architecture

La Skill **MUST** utilizar React Server Components (RSC) como opción predeterminada.

Los Client Components se introducirán **únicamente** cuando exista necesidad comprobada de:
- Estado local del cliente (`useState`, `useReducer`).
- Manejadores de eventos de navegador (`onClick`, `onChange`, `onSubmit`).
- Efectos de ciclo de vida (`useEffect`, `useLayoutEffect`).
- APIs del navegador (`window`, `navigator`, `localStorage`, `IntersectionObserver`).
- Hooks interactivos de librerías externas o animaciones complejas.

Los Server Components acceden a los datos directamente cerca de la fuente (DB/Cache), mantienen secretos seguros en el servidor y reducen drásticamente el JavaScript enviado al navegador.

### 5.1. Regla de Frontera
Estructurar el árbol favoreciendo componentes de servidor con pequeñas islas interactivas:
```text
Server Component (Layout / Page)
├── Server Component (Summary)
├── Server Component (Data Table)
└── Small Client Island (Filter Dropdown / Toggle Button)
```

Evitar colocar `'use client'` en la cima:
```text
'use client'
App
└── entire application (Antipatrón: convierte todo el subárbol en cliente)
```

### 5.2. Ejemplo Incorrecto
```tsx
'use client';

// ❌ Antipatrón: toda la pantalla, sus dependencias y consultas
// terminan compiladas en el bundle JavaScript cliente.
export default function Dashboard() {
  // Estado masivo y useEffects innecesarios...
}
```

### 5.3. Ejemplo Correcto
```tsx
// Server Component (por defecto, sin directiva)
import { RevenueChart } from '@/features/analytics/ui/revenue-chart';
import { DateRangePicker } from '@/features/analytics/ui/date-range-picker';
import { getDashboardMetrics } from '@/features/analytics/server/queries';

export default async function DashboardPage() {
  const metrics = await getDashboardMetrics();

  return (
    <main className="p-6">
      <RevenueChart metrics={metrics} />
      {/* DateRangePicker es la única frontera interactiva cliente */}
      <DateRangePicker />
    </main>
  );
}
```

La isla interactiva:
```tsx
'use client';

// Interactividad exclusivamente de cliente para capturar fechas y actualizar la URL
export function DateRangePicker() {
  // useState / handlers de UI interactivos...
  return <div>{/* UI del selector */}</div>;
}
```

---

## 6. Screaming Architecture

La estructura de carpetas y archivos **SHOULD** comunicar qué hace el producto antes de revelar qué framework o tecnología utiliza.

### Malo: Estructura centrada en tecnología
```text
src/
├── components/
├── hooks/
├── services/
├── utils/
├── controllers/
├── repositories/
└── types/
```
*A simple vista no es posible saber si es un e-commerce, un CRM médico o una plataforma educativa.*

### Bueno: Estructura centrada en dominio de negocio
```text
src/
├── app/
├── features/
│   ├── auth/
│   ├── billing/
│   ├── projects/
│   ├── analytics/
│   └── notifications/
└── shared/
```
*La arquitectura “grita” de inmediato las capacidades de negocio del sistema.*

---

## 7. Estructura Recomendada

Para aplicaciones de producción medianas y grandes:
```text
src/
├── app/
│   ├── (public)/
│   ├── (auth)/
│   ├── (dashboard)/
│   ├── api/
│   ├── layout.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   └── global-error.tsx
│
├── features/
│   ├── auth/
│   │   ├── application/        # Casos de uso y orquestación
│   │   ├── domain/             # Entidades, value objects, invariantes
│   │   ├── infrastructure/     # Repositorios, clientes DB / APIs externas
│   │   ├── server/             # DAL queries y Server Actions
│   │   ├── ui/                 # Componentes RSC e islas cliente
│   │   ├── schemas/            # Schemas Zod de validación
│   │   └── index.ts            # API pública del feature
│   │
│   ├── billing/
│   ├── projects/
│   └── analytics/
│
├── shared/
│   ├── ui/                     # Design system base (Button, Modal, Input)
│   ├── config/                 # Env vars y configuración tipada
│   ├── observability/          # Logger Pino, OTel wrappers
│   ├── errors/                 # Clases de error transversales
│   └── types/                  # Tipos globales utilitarios
│
├── instrumentation.ts          # Inicialización de OpenTelemetry
└── proxy.ts                    # Reverse proxy / BFF adapter si aplica
```

---

## 8. Responsabilidad de `app/`

La carpeta `src/app/` **SHOULD** ser una capa delgada de pegamento (*composition shell*). Una página ideal realiza tres pasos concisos:
```text
1. Leer parámetros de entrada de la ruta (params, searchParams)
   ↓
2. Invocar la función de aplicación/servidor del feature correspondiente
   ↓
3. Componer y renderizar los componentes de presentación
```

### Malo: Lógica de negocio dispersa en la página
```tsx
// ❌ Antipatrón
export default async function Page() {
  const users = await prisma.user.findMany();
  const payments = await stripe.paymentIntents.list();
  const activeUsers = users.filter(/* lógica de filtrado */).map(/* transformación */);
  // Cientos de líneas con consultas, reglas de negocio e integraciones externas...
  return <div>{/* JSX gigante */}</div>;
}
```

### Mejor: Delegación al feature correspondiente
```tsx
import { getBillingDashboard } from '@/features/billing/server/queries';
import { BillingDashboard } from '@/features/billing/ui/billing-dashboard';

interface PageProps {
  searchParams: Promise<{ period?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { period } = await searchParams;
  const dashboard = await getBillingDashboard({ period });

  return <BillingDashboard data={dashboard} />;
}
```

---

## 9. Colocation

Next.js permite colocar archivos junto a las rutas sin exponerlos como URLs públicas: un archivo solo es accesible vía web si se llama `page.tsx` o `route.ts`. 

- Usar **colocation local** (`_components`, hooks locales) únicamente para elementos acoplados exclusivamente a una pantalla específica:
```text
app/
└── dashboard/
    ├── page.tsx
    ├── loading.tsx
    ├── error.tsx
    └── _components/
        └── dashboard-header.tsx
```
- Si una capacidad representa un dominio de negocio reutilizable o transversal (`billing`, `auth`, `projects`), colocarla siempre dentro de `src/features/`.

---

## 10. Route Groups

Utilizar Route Groups marcados entre paréntesis:
```text
(public)
(auth)
(dashboard)
(admin)
```
para:
- Aplicar layouts diferenciados sin alterar la estructura de las URLs.
- Organizar el código por intenciones de navegación o responsabilidades de equipo.
- Aplicar middlewares o wrappers de contexto específicos.

```text
app/
├── (public)/
│   ├── layout.tsx              # Layout público (Landing, Header, Footer)
│   ├── page.tsx                # URL: /
│   └── pricing/page.tsx        # URL: /pricing
│
├── (auth)/
│   ├── layout.tsx              # Layout centrado sin navegación principal
│   ├── login/page.tsx          # URL: /login
│   └── register/page.tsx       # URL: /register
│
└── (dashboard)/
    ├── layout.tsx              # Layout con Sidebar, Topbar y Guard
    └── projects/page.tsx       # URL: /projects
```

---

## 11. Layouts

Los layouts (`layout.tsx`) **SHOULD** contener exclusivamente:
- Shell compartido de interfaz (Sidebars, Headers, Footers).
- Navegación principal.
- Providers de contexto indispensables (Theme, Toast container).
- Metadata estructural.

> [!WARNING]
> No convertir `layout.tsx` en un motor de permisos o cargador de datos universal. Ocultar componentes en el layout no sustituye la autorización estricta en cada Server Action, Route Handler o consulta DAL.

---

## 12. Data Access Layer (DAL)

Para proyectos de producción, la Skill **SHOULD** implementar una Data Access Layer (DAL) marcada con `server-only`.

```text
Feature UI / Page
       ↓
Application Use Case
       ↓
Data Access Layer (DAL)
       ↓
Database / External APIs
```

La DAL es responsable de:
1. Asegurar la ejecución exclusiva en servidor.
2. Validar autenticación y permisos sobre el objeto solicitado.
3. Transformar entidades internas a **DTOs mínimos y seguros** antes de devolverlos al árbol de renderizado.

### 12.1. Ejemplo de DAL
```typescript
import 'server-only';
import { db } from '@/shared/infrastructure/database';
import { requireProjectAccess } from '@/features/auth/server/authorization';
import { ProjectNotFoundError } from '@/features/projects/domain/errors';

export interface ProjectDTO {
  id: string;
  name: string;
  status: string;
}

/**
 * Recuperá un proyecto asegurando la autorización del solicitante y
 * retornando un DTO con datos saneados para el cliente.
 *
 * @param projectId Identificador del proyecto requerido.
 * @param viewerId Identificador del usuario que realiza la consulta.
 * @returns Representación segura del proyecto.
 */
export async function getProjectDTO(
  projectId: string,
  viewerId: string,
): Promise<ProjectDTO> {
  const project = await db.project.findUnique({
    where: { id: projectId },
  });

  if (!project) {
    throw new ProjectNotFoundError(projectId);
  }

  await requireProjectAccess({
    project,
    viewerId,
  });

  return {
    id: project.id,
    name: project.name,
    status: project.status,
  };
}
```

### 12.2. Regla de DTO
**Nunca** pasar objetos completos o entidades de ORM (`User`, `Account`, `PaymentRecord`) directamente a Client Components. Definir interfaces DTO con los campos mínimos requeridos para evitar la fuga accidental de hashes de contraseñas, tokens o PII sensible.

---

## 13. `server-only`

Todo módulo que contenga:
- Acceso a base de datos
- Claves de API privadas
- Secretos de entorno
- Lógica sensible de negocio o facturación
- Clientes de integración privada

**SHOULD** incluir obligatoriamente en su primera línea:
```typescript
import 'server-only';
```
Si accidentalmente este módulo es importado en un Client Component o en su grafo de dependencias, el compilador disparará un error de build inmediato.

---

## 14. `NEXT_PUBLIC_`

Regla estricta:
```text
NEXT_PUBLIC_*  ──>  Se inserta en texto plano en el bundle cliente durante el build.
```

Secretos de infraestructura:
```text
DATABASE_URL
STRIPE_SECRET_KEY
AUTH_SECRET
AWS_SECRET_ACCESS_KEY
INTERNAL_API_KEY
```
**MUST NOT** utilizar jamás el prefijo `NEXT_PUBLIC_`. Las variables de entorno en Next.js son privadas por defecto.

---

## 15. Estrategias de Obtención de Datos

Elegir una estrategia troncal consistente por proyecto:

- **Opción A — Data Access Layer (DAL):** Preferida para proyectos *greenfield*, monolitos modulares y aplicaciones Next.js full-stack donde la base de datos se consulta directamente en el servidor.
- **Opción B — HTTP APIs Externas:** Adecuada cuando existe un backend preexistente (NestJS, Go, Java), equipos backend independientes o una API REST/GraphQL compartida por múltiples clientes (Web, iOS, Android).

---

## 16. No llamar a tus propios Route Handlers desde Server Components

> [!CAUTION]
> **Antipatrón Crítico:** Hacer llamadas `fetch('https://mi-app.com/api/projects')` a Route Handlers dentro de la misma aplicación desde un Server Component.

```tsx
// ❌ Antipatrón
export default async function Page() {
  const response = await fetch('https://mi-app.com/api/projects');
  const projects = await response.json();
  return <ProjectsList data={projects} />;
}

// ✅ Correcto: invocar directamente la función de la DAL
import { getProjects } from '@/features/projects/server/queries';

export default async function Page() {
  const projects = await getProjects();
  return <ProjectsList data={projects} />;
}
```

*Razones:* Hacer llamadas HTTP internas añade un viaje de red innecesario, introduce problemas de autenticación de bucle cerrado y falla durante el prerendering estático porque el servidor web aún no está escuchando peticiones.

---

## 17. Server Actions

Las Server Actions (`'use server'`) **SHOULD** utilizarse primordialmente para:
- Mutaciones de datos.
- Envíos de formularios (`<form action={...}>`).
- Comandos iniciados por interacción de la interfaz de usuario.

> [!IMPORTANT]
> No utilizar Server Actions para obtención de datos en lecturas estándar de página; las Server Actions se encolan secuencialmente y degradan el tiempo de carga inicial.

### 17.1. Server Action ≠ Service Layer
La Server Action es un **adapter de entrada** (frontera de transporte), no la capa de negocio:
```text
UI (Form / Button)
       ↓
Server Action (Adapter HTTP / RPC)
       ↓
Application Use Case (Orchestration)
       ↓
Domain Logic (Invariants & Rules)
       ↓
Repository / DAL (Persistence)
```

### 17.2. Ejemplo de Server Action Limpia
```typescript
'use server';

import { revalidateTag } from 'next/cache';
import { CreateProjectSchema } from '../schemas/create-project';
import { createProjectUseCase } from '../application/create-project';
import { getCurrentUser } from '@/features/auth/server/session';

export async function createProjectAction(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error('No autorizado.');
  }

  const parseResult = CreateProjectSchema.safeParse({
    name: formData.get('name'),
  });

  if (!parseResult.success) {
    return {
      success: false,
      errors: parseResult.error.flatten().fieldErrors,
    };
  }

  const project = await createProjectUseCase({
    name: parseResult.data.name,
    ownerId: user.id,
  });

  revalidateTag(`user-projects:${user.id}`, 'max');
  return { success: true, projectId: project.id };
}
```

---

## 18. Seguridad de Server Actions

Toda Server Action exportada es un endpoint POST público accesible desde la red por cualquier cliente HTTP (Postman, curl o atacantes). Los identificadores cifrados generados por Next.js **no** proporcionan seguridad.

Dentro de cada Server Action se debe cumplir la secuencia obligatoria:
```text
1. Autenticar al usuario emisor
   ↓
2. Validar sintáctica y semánticamente el payload (Zod)
   ↓
3. Autorizar si el usuario posee permiso sobre la operación y el recurso
   ↓
4. Ejecutar el caso de uso
```

---

## 19. Route Handlers

Utilizar `route.ts` cuando exista una necesidad real de protocolo HTTP estándar:
- APIs públicas consumidas por clientes externos o móviles.
- Receptores de Webhooks (Stripe, GitHub, etc.).
- Callbacks de autenticación OAuth.
- Generación de respuestas dinámicas binarias (PDFs, imágenes, streams de audio, RSS).
- Endpoints de salud operacional (`/api/health/live`, `/api/health/ready`).

### 19.1. No Crear REST Interno Innecesario
Si únicamente un Server Component necesita consultar datos, crear una función DAL/Query en TypeScript. No crear endpoints HTTP internos para consumirlos internamente.

---

## 20. Backend for Frontend (BFF)

Next.js es una plataforma idónea para operar como Backend for Frontend (BFF):
```text
Browser Client
      │
      ▼
Next.js (BFF Layer)
      ├── Sesión segura basada en HTTP-only cookies
      ├── Agregación y moldeado de datos específicos para la vista
      ├── Ocultación de tokens de backend y claves privadas
      │
      ├── Service A (Users)
      ├── Service B (Billing)
      └── Service C (Analytics)
```

---

## 21. Cuándo Extraer un Backend Separado

Mantener un backend independiente (Fastify, NestJS, Go) cuando existan requerimientos de:
- API pública de producto consumida masivamente por terceros.
- Conexiones persistentes y WebSockets masivos sostenidos.
- Procesamiento pesado en segundo plano y colas duraderas.
- Políticas de escalado diferenciadas (servidor web liviano vs backend intensivo).
- Requisitos estrictos de networking privado (VPC peeing, VPNs dedicadas).

---

## 22. Rendering Strategy

No calificar la aplicación con una etiqueta única (e.g. “toda mi app es SSR”). Una arquitectura madura combina estrategias por ruta o por sección:

```text
               ┌── Static (SSG / Pre-rendered en build o cache)
               ├── Cached Dynamic ('use cache' con TTL explícito)
Rendering ─────┼── Dynamic (SSR bajo demanda para datos de sesión)
               └── Streaming (Suspense para carga progresiva no bloqueante)
```

### 22.1. Static
Para contenido público, estable y compartido por todos los usuarios: Landing pages, documentación técnica, blogs, páginas de términos.

### 22.2. Cached Dynamic
Para datos que cambian periódicamente pero toleran revalidación controlada: Catálogo de productos, estadísticas agregadas, perfiles públicos.

### 22.3. Dynamic
Para datos altamente personalizados o en tiempo real: Bandeja de entrada, paneles transaccionales, configuración de cuenta.

### 22.4. Streaming
Utilizar límites `<Suspense>` para aislar componentes con I/O lenta y evitar que retrasen el First Contentful Paint (FCP) de la página:
```tsx
import { Suspense } from 'react';
import { AnalyticsMetrics } from '@/features/analytics/ui/metrics';
import { AnalyticsSkeleton } from '@/features/analytics/ui/skeleton';

export default function AnalyticsPage() {
  return (
    <section>
      <h1>Panel de Métricas</h1>
      <Suspense fallback={<AnalyticsSkeleton />}>
        <AnalyticsMetrics />
      </Suspense>
    </section>
  );
}
```

---

## 23. Evitar Waterfalls de Datos

### Malo: Consultas secuenciales dependientes innecesarias
```typescript
// ❌ Antipatrón: 3 viajes de red secuenciales
const user = await getUser();
const projects = await getProjects();
const notifications = await getNotifications();
```

### Bueno: Carga en paralelo
```typescript
// ✅ Correcto: Concurrencia paralela
const [user, projects, notifications] = await Promise.all([
  getUser(),
  getProjects(),
  getNotifications(),
]);
```
*Alternativamente, permitir que componentes independientes dentro del árbol resuelvan sus propios datos bajo límites `<Suspense>` separados.*

---

## 24. Cache Architecture

Toda decisión de caché debe responder seis preguntas obligatorias:
1. ¿Qué se cachea exactamente?
2. ¿Por qué motivo?
3. ¿Quién lo comparte (público vs privado por usuario)?
4. ¿Cuánto dura (TTL)?
5. ¿Cómo se invalida ante una mutación?
6. ¿Qué impacto ocurre si el contenido queda *stale*?

### 24.1. Cache Components
En versiones modernas con `cacheComponents: true`:
```typescript
// next.config.ts
const nextConfig = {
  cacheComponents: true,
};
export default nextConfig;
```

Permite el uso de las directivas declarativas:
- `'use cache'`
- `cacheLife()`
- `cacheTag()`

### 24.2. Ejemplo de Cache Declarativa
```typescript
import { cacheLife, cacheTag } from 'next/cache';
import { productRepository } from '../infrastructure/repository';

export async function getProductsCatalog() {
  'use cache';

  cacheLife('hours');
  cacheTag('catalog', 'products');

  return productRepository.findAllAvailable();
}
```

### 24.3. Invalidación Precisa
Invalidar selectivamente mediante tags tras mutaciones:
```typescript
import { revalidateTag } from 'next/cache';

export async function updateProductStockAction(productId: string) {
  // ... mutación en DB ...
  revalidateTag(`product:${productId}`, 'max');
  revalidateTag('catalog', 'max');
}
```

### 24.4. Protección de Datos Privados
**Nunca** cachear globalmente respuestas que dependan de sesiones, permisos de usuario, tokens de autorización o identificadores de tenant.

---

## 25. Route Handler Caching

Los Route Handlers (`route.ts`) no están cacheados por defecto. Las peticiones `GET` solo se cachean si se configura explícitamente la directiva o cabeceras `Cache-Control`. No asumir comportamientos implícitos de versiones heredadas.

---

## 26. Client-Side Fetching

Utilizar librerías de fetching en cliente (SWR / TanStack Query) únicamente cuando existan requerimientos de:
- Polling frecuente de alta cadencia.
- Consumo de Web APIs del navegador (e.g. geolocalización continua).
- Interacciones optimistas inmediatas en interfaces complejas tipo SPA.

No convertir una aplicación Server Components en una SPA cliente por costumbre.

---

## 27. Jerarquía del Estado

Adoptar la siguiente jerarquía de menor a mayor complejidad:
```text
1. URL State (searchParams, pathname, hash)
      ↓
2. Server State (RSC props, DAL queries)
      ↓
3. Local Component State (useState, useReducer)
      ↓
4. Global Client State (Zustand, Context API)
```
No introducir gestores de estado global cliente a menos que exista estado transversal que no pueda residir en la URL ni en el servidor.

---

## 28. URL como Estado

Filtros de búsqueda, ordenamiento, selección de pestañas y páginas activas **SHOULD** residir en los parámetros de la URL (`/projects?status=active&page=2`):
- Permite compartir enlaces directamente (*shareable*).
- Compatible con marcadores del navegador (*bookmarkable*).
- Compatible de forma nativa con Server Components y renderizado inicial en servidor.
- Resistente a recargas de página (*refresh-safe*).

---

## 29. Client Providers

Colocar los providers de contexto cliente lo más abajo posible en el árbol de componentes.
Evitar envolver `<html>` o `<body>` en un `EverythingProvider` cliente gigante, ya que esto degrada las capacidades de renderizado en servidor de toda la aplicación.

---

## 30. Domain Layer

Cuando una aplicación posee lógica de negocio compleja, encapsularla en modelos y entidades puras libres de dependencias de framework (`src/features/<name>/domain/`):
- Value Objects: `Money`, `EmailAddress`, `DateRange`.
- Entidades con invariantes: `Project`, `Subscription`.
- Reglas puras: `calculateProration(plan, daysUsed)`.

---

## 31. Application Layer

Representa los casos de uso del sistema. Orquesta la interacción entre el dominio y los puertos de infraestructura:
```typescript
export interface ArchiveProjectCommand {
  projectId: string;
  actorId: string;
}

export async function archiveProjectUseCase(
  command: ArchiveProjectCommand,
): Promise<void> {
  const project = await projectRepository.getById(command.projectId);
  if (!project) {
    throw new ProjectNotFoundError(command.projectId);
  }

  project.archive(command.actorId);
  await projectRepository.save(project);
}
```

---

## 32. Infrastructure Layer

Contiene las implementaciones técnicas concretas de los adaptadores externos:
```text
src/features/billing/infrastructure/
├── stripe-payment-gateway.ts
├── prisma-subscription-repository.ts
└── resend-invoice-notifier.ts
```

---

## 33. Dependency Direction (Dirección de Dependencias)

```text
Framework Shell (app/)
        ↓
Feature Public API (features/billing/index.ts)
        ↓
Application Layer (Use Cases)
        ↓
Domain Layer (Entities & Rules)
        ↑ (Inversión de dependencias)
Infrastructure Implementations (Repositories, DB, APIs)
```

El dominio y los casos de uso de negocio no deben importar `next/headers`, `next/navigation`, `cookies()` ni `NextRequest`.

---

## 34. Feature Boundaries (Límites de Módulos)

Un módulo nunca debe importar detalles privados internos de otro módulo.

```typescript
// ❌ Malo: Acoplamiento a la infraestructura privada de otro feature
import { internalStripeHelper } from '@/features/billing/infrastructure/stripe-client';

// ✅ Bueno: Consumo a través del contrato público expuesto
import { getSubscriptionStatus } from '@/features/billing';
```

---

## 35. `shared/` no es un Basurero

La carpeta `src/shared/` contendrá únicamente utilidades y componentes genuinamente transversales y probados:
```text
src/shared/
├── ui/              # Componentes de diseño puros (Button, Input, Table)
├── errors/          # Clases base de error (AppError, DomainError)
├── config/          # Parseo tipado de variables de entorno
└── observability/   # Logger estructurado y telemetría
```

---

## 36. Principios SOLID Pragmáticos

- **Single Responsibility (SRP):** Un Server Component compone UI; una Server Action recibe y valida mutaciones; un Use Case ejecuta reglas de negocio.
- **Dependency Inversion (DIP):** Los casos de uso dependen de interfaces de repositorio cuando existe variabilidad real o necesidad estricta de mocks.
- *Evitar ceremonias excesivas de interfaces redundantes para operaciones triviales.*

---

## 37. KISS (Keep It Simple, Stupid)

Preferir la composición directa de funciones antes que construir capas abstractas artificiales (`ControllerFactoryManagerProvider`). Si una consulta solo requiere una función DAL limpia, no implementar un pipeline de CQRS con Mediators y Command Buses.

---

## 38. YAGNI (You Aren't Gonna Need It)

No introducir arquitecturas multi-región, buses de eventos distribuidos (Kafka), CQRS o microservicios basados en necesidades hipotéticas futuras. Diseñar fronteras limpias que permitan evolucionar, sin añadir complejidad operativa prematura.

---

## 39. DRY (Don't Repeat Yourself)

No duplicar reglas de negocio ni invariantes de dominio. Sin embargo, una duplicación cosmética o superficial entre dos vistas es preferible a una abstracción prematura incorrecta que acople conceptos con ciclos de cambio dispares.

---

## 40. Serverless ≠ Arquitectura de Dominio

Serverless es un modelo de ejecución y despliegue en infraestructura, no una arquitectura de software. Es completamente viable y recomendado ejecutar un **Modular Monolith** sobre infraestructura Serverless.

---

## 41. Edge Runtime

No adoptar el Edge Runtime por defecto bajo la asunción de que siempre es más rápido.
Evaluar cuidadosamente:
- Compatibilidad de librerías (ausencia de APIs nativas de Node.js como `net`, `tls`, `crypto` completa).
- Localidad de la base de datos: Si la base de datos reside en una única región (`us-east-1`), ejecutar una función Edge a miles de kilómetros introduce una latencia de ida y vuelta mayor que la latencia ahorrada en la entrega inicial.

---

## 42. Self-Hosting y Reverse Proxies

En despliegues con Docker o servidores Node.js dedicados, **SHOULD** existir un reverse proxy (Nginx, Traefik, Cloudflare) delante de la instancia de Next.js:
```text
Internet  ──>  CDN / WAF  ──>  Reverse Proxy (Nginx)  ──>  Next.js Server
```
El reverse proxy debe encargarse de terminación TLS, buffers de peticiones, protección ante ataques de conexión lenta (*Slowloris*) y compresión pesada.

---

## 43. Infraestructura Horizontal y Multi-Instancia

Al ejecutar múltiples instancias de Next.js en paralelo tras un Load Balancer:

```text
                   Load Balancer
            ┌────────────┼────────────┐
            ▼            ▼            ▼
       Instancia A  Instancia B  Instancia C
```

### 43.1. Shared Cache
La memoria de proceso local no está compartida. Las invalidaciones de caché en memoria no sincronizan automáticamente. Para arquitecturas horizontales se requiere un adaptador de caché externa (e.g. Redis).

### 43.2. Cifrado de Server Actions
Configurar explícitamente la variable de entorno:
```bash
NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="clave_secreta_compartida"
```
para que una Server Action despachada por el cliente pueda ser descifrada y resuelta por cualquiera de las instancias del pool.

### 43.3. Deployment ID y Version Skew
Configurar `deploymentId` para detectar discrepancias de versión (*version skew*) entre bundles de cliente antiguos y servidores recién desplegados durante rollouts progresivos.

### 43.4. Coordinación de Invalidación
Asegurar que las llamadas a `revalidateTag()` o `revalidatePath()` notifiquen a todas las instancias activas mediante Redis pub/sub o almacenamiento compartido.

---

## 44. Infraestructura de Streaming

Para aprovechar las ventajas de `<Suspense>` y Streaming:
- Toda la cadena de proxies, balanceadores y CDNs debe admitir *chunked transfer encoding* y deshabilitar el buffering de respuestas para rutas dinámicas.
- Si un proxy intermedio espera la respuesta completa antes de enviarla, el beneficio de Streaming se pierde por completo.

---

## 45. Tareas en Segundo Plano (Background Work)

**No** utilizar Server Actions para ejecutar procesos pesados o prolongados (procesamiento de video, envíos masivos de correo, sincronizaciones complejas):
- Utilizar colas de mensajes (BullMQ, SQS) con procesos *workers* desacoplados.
- Emplear motores de flujos de trabajo duraderos (*durable workflows*).

---

## 46. Cargas de Archivos (Uploads)

Para archivos medianos o grandes:
```text
Browser  ──(1. Solicitar URL firmada)──>  Next.js Server
Browser  <──(2. Pre-signed S3 URL)─────── Next.js Server
Browser  ──(3. Subida directa PUT)──────>  Object Storage (AWS S3 / GCS)
```
Evitar transitar archivos pesados por la memoria de la instancia de Next.js.

---

## 47. Seguridad Zero-Trust

La arquitectura **MUST** contemplar:
- Control de acceso basado en roles/atributos (RBAC / ABAC) evaluado dentro de cada operación sensible.
- Sanitización y validación estricta en runtime (Zod).
- Headers de seguridad HTTP: Content Security Policy (CSP), HSTS, X-Frame-Options, X-Content-Type-Options.
- Cookies de sesión marcadas como `HttpOnly`, `Secure` y `SameSite=Lax/Strict`.
- Auditoría contra el top 10 de OWASP.

---

## 48. Arquitectura de Manejo de Errores

Distinguir entre dos categorías fundamentales:

| Tipo | Naturaleza | Manejo |
| :--- | :--- | :--- |
| **Expected Errors** | Validaciones fallidas, recurso no encontrado, permisos insuficientes. | Retornar códigos o mensajes de negocio controlados al cliente sin romper el árbol. |
| **Unexpected Errors** | Caída de base de datos, bugs de código, excepciones no controladas. | Capturar en boundaries (`error.tsx`), registrar en observabilidad y mostrar interfaz de contingencia segura. |

### 48.1. Boundaries de Resiliencia
Utilizar los archivos estándar de App Router:
- `loading.tsx`: Estados de carga inmediatos con skeletons.
- `error.tsx`: Límites de captura de errores para subárboles con opción de recuperación (`reset()`).
- `not-found.tsx`: UI personalizada para recursos inexistentes (`notFound()`).
- `global-error.tsx`: Límite de contingencia final ante fallos en el root layout.

---

## 49. Observabilidad

### 49.1. Instrumentation
Implementar `instrumentation.ts` en la raíz de `src/` para inicializar proveedores de telemetría antes de procesar peticiones:
```typescript
// src/instrumentation.ts
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initObservability } = await import('@/shared/observability');
    await initObservability();
  }
}
```

### 49.2. OpenTelemetry
Configurar exportadores OTel estándar para correlacionar trazas distribuidas entre el frontend y los servicios backend.

---

## 50. Logging Estructurado

Utilizar logging estructurado en formato JSON con metadatos contextuales:
```typescript
import { logger } from '@/shared/observability/logger';

logger.info({
  event: 'project.created',
  projectId: project.id,
  userId: user.id,
  traceId: getTraceId(),
}, 'Proyecto creado satisfactoriamente.');
```
**MUST NOT** utilizar `console.log()` en código de producción.

---

## 51. Arquitectura de Rendimiento

Priorizar las optimizaciones de mayor impacto arquitectónico:
1. Minimizar el bundle JavaScript enviado al cliente eliminando `'use client'` innecesarios.
2. Eliminar *waterfalls* de datos en servidor y cliente.
3. Optimizar consultas SQL e indexación en base de datos.
4. Definir estrategias explícitas de caché y streaming.
5. Utilizar optimizadores nativos de Next.js:
   - `next/image`: Formatos modernos (WebP/AVIF) y dimensiones adaptativas.
   - `next/font`: Optimización y auto-hospedaje de tipografías sin peticiones externas de bloqueo.
   - `next/script`: Estrategias de carga no bloqueante para scripts de terceros (`strategy="afterInteractive" | "lazyOnload"`).

---

## 52. Gestión de Memoria

- Evitar la creación de caches globales ilimitadas en memoria de proceso (`new Map()` sin límite de tamaño ni TTL).
- Monitorear el consumo de heap y realizar profiling ante incrementos anómalos de memoria durante los builds o en runtime.

---

## 53. Configuración de TypeScript Estricto

Configurar `tsconfig.json` con el nivel más riguroso de verificación:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "forceConsistentCasingInFileNames": true
  }
}
```
> Prohibido el uso de `any` para resolver problemas de tipos arquitectónicos.

---

## 54. Validación en Runtime

Todo dato que cruce la frontera del sistema hacia el servidor debe validarse en tiempo de ejecución:
- `searchParams` y `params` de rutas.
- Payloads de Server Actions (`FormData` o JSON).
- Cuerpos de peticiones de Route Handlers y Webhooks.
- Respuestas de APIs de terceros.

Utilizar Zod, Valibot o ArkType de forma sistemática.

---

## 55. Convenciones de Documentación y Docstrings

Los comentarios y docstrings **SHOULD** redactarse en español rioplatense formal con voseo cuando aporten justificación técnica, contexto arquitectónico o restricciones no evidentes.

```typescript
// ❌ Comentario redundante:
// Obtené el usuario por su ID.
const user = await getUser(id);

// ✅ Comentario con contexto arquitectónico:
// Volvé a validar el permiso acá aunque el layout ya haya comprobado
// la sesión. Esta operación puede invocarse independientemente desde
// una Server Action y no debe depender de controles de presentación.
await requireProjectPermission(userId, projectId);
```

### 55.1. Formato de Docstrings
```typescript
/**
 * Obtené la vista pública de un proyecto asegurando la autorización del solicitante.
 *
 * Aplicá siempre la validación de permisos antes de construir el DTO y devolvé
 * únicamente los campos que el consumidor necesita en la interfaz. No retornes
 * la entidad de persistencia completa para evitar fugas de información privada.
 *
 * @param projectId Identificador unívoco del proyecto solicitado.
 * @param viewerId Identificador del usuario que intenta acceder al recurso.
 * @returns Representación segura en formato DTO para el contexto de renderizado.
 */
export async function getPublicProject(
  projectId: string,
  viewerId: string,
): Promise<ProjectDTO> {
  // ...
}
```

---

## 56. Convenciones de Nomenclatura

- Acciones y Casos de Uso: Verbo en imperativo + Sustantivo (`createProject`, `archiveSubscription`, `getCurrentUser`).
- Repositorios y Adaptadores: Sustantivo descriptivo (`ProjectRepository`, `BillingSummary`).
- Evitar nombres genéricos ambiguos: `handleData`, `processStuff`, `utils.ts`, `helper2.ts`, `serviceManager.ts`.

---

## 57. Estrategia Integral de Testing

```text
                     ┌── E2E Tests (Playwright: flujos críticos de usuario)
                     ├── Integration Tests (Server Actions, Route Handlers, DB)
Niveles de Prueba ───┼── Component Tests (React Testing Library: islas cliente)
                     ├── Use Case / Application Tests (Lógica de orquestación)
                     └── Domain Unit Tests (Invariantes y reglas de negocio puras)
```

### 57.1. Architecture Tests
Implementar reglas automatizadas (ESLint boundaries, `dependency-cruiser`) para garantizar:
- El dominio no importa módulos de `next/*` ni infraestructura.
- Un módulo `features/A` no accede a los internals privados de `features/B`.
- Módulos marcados como cliente no importan librerías o código de servidor.

---

## 58. Pipeline de CI/CD

El flujo mínimo para validar cambios antes de su integración a ramas principales:
```text
1. Instalar dependencias
   ↓
2. Typecheck estricto (tsc --noEmit)
   ↓
3. Linter y Architecture boundaries check
   ↓
4. Pruebas Unitarias y de Integración
   ↓
5. Compilación de producción (next build)
   ↓
6. Pruebas E2E sobre artefacto compilado
   ↓
7. Escaneo de vulnerabilidades y secretos
   ↓
8. Despliegue automatizado
```

---

## 59. Modelo de Evolución Arquitectónica

```text
Nivel 1: Small App
└── src/app/ + src/components/ + src/lib/

Nivel 2: Growing App
└── src/app/ + src/features/ + src/shared/

Nivel 3: Modular Monolith
└── src/features/<name>/ (domain, application, infrastructure, server, ui)

Nivel 4: Distributed Services
└── Extracción selectiva de microservicios solo ante demandas operativas comprobadas.
```

---

## 60. Matriz de Antipatrones Arquitectónicos

- ⚠️ **NEXT-01:** Marcar toda la aplicación o el layout raíz con `'use client'`.
- ⚠️ **NEXT-02:** Utilizar `useEffect` para cargar datos que un Server Component puede resolver directamente.
- ⚠️ **NEXT-03:** Consultar Route Handlers internos propios (`/api/*`) desde Server Components.
- ⚠️ **NEXT-04:** Colocar toda la lógica de negocio y consultas SQL dentro de `page.tsx`.
- ⚠️ **NEXT-05:** Colocar lógica de negocio pesada directamente dentro de Server Actions.
- ⚠️ **NEXT-06:** Asumir que una Server Action es privada por estar dentro de una carpeta protegida.
- ⚠️ **NEXT-07:** Confiar la seguridad exclusivamente a comprobaciones de UI en `layout.tsx`.
- ⚠️ **NEXT-08:** Pasar entidades completas del ORM desde Server Components a Client Components.
- ⚠️ **NEXT-09:** Importar secretos o clientes de backend en módulos accesibles por el cliente.
- ⚠️ **NEXT-10:** Utilizar variables con prefijo `NEXT_PUBLIC_` para credenciales o secretos.
- ⚠️ **NEXT-11:** Crear carpetas técnicas genéricas gigantescas (`/components`, `/services`, `/utils`) sin dominio.
- ⚠️ **NEXT-12:** Utilizar `shared/` como repositorio basurero de código no clasificado.
- ⚠️ **NEXT-13:** Mezclar adaptadores de infraestructura y persistencia dentro del dominio puro.
- ⚠️ **NEXT-14:** Introducir Redux o Zustand sin una necesidad demostrable de estado transversal.
- ⚠️ **NEXT-15:** Utilizar Edge Runtime por tendencia sin justificarlo con latencia y compatibilidad reales.
- ⚠️ **NEXT-16:** Confundir despliegues Serverless con arquitectura de microservicios.
- ⚠️ **NEXT-17:** Desacoplar microservicios antes de haber establecido límites modulares limpios en el monolito.
- ⚠️ **NEXT-18:** Cachear datos sin definir tiempos de vida (TTL) ni estrategias de invalidación.
- ⚠️ **NEXT-19:** Cachear datos privados o transaccionales sin segmentar por identidad de usuario o tenant.
- ⚠️ **NEXT-20:** Asumir que la caché en memoria de proceso se comparte automáticamente entre instancias.
- ⚠️ **NEXT-21:** Desplegar múltiples instancias sin coordinar claves de cifrado de Server Actions ni invalidaciones.
- ⚠️ **NEXT-22:** Ejecutar trabajos en segundo plano prolongados dentro del ciclo de vida del request HTTP.
- ⚠️ **NEXT-23:** Intentar consultar la base de datos directamente desde Client Components.
- ⚠️ **NEXT-24:** Diseñar abstracciones genéricas excesivas ante necesidades hipotéticas futuras.
- ⚠️ **NEXT-25:** Acoplar la lógica de dominio a tipos del framework como `NextRequest`, `cookies()` o `next/navigation`.

---

## 61. Definition of Done (DoD) Arquitectónica

Una funcionalidad se considera lista para producción cuando satisface:

### Arquitectura y Límites
- Pertenece a un módulo o feature de negocio claramente identificado.
- `src/app/` actúa exclusivamente como composition shell y capa de rutas.
- Las dependencias respetan el flujo unidireccional hacia el dominio.
- No existen dependencias cruzadas ilegales entre internals de features.

### Servidor vs Cliente
- Server Components implementados como primera opción por defecto.
- `'use client'` restringido a pequeñas islas interactivas.
- Props serializables mínimas transferidas de servidor a cliente.

### Acceso a Datos y Mutaciones
- DAL protegida mediante `server-only`.
- DTOs estrictos sin fuga de datos sensibles.
- Cero llamadas circulares a Route Handlers internos propios.
- Server Actions con autenticación, validación Zod y autorización explícita.

### Rendimiento y Caching
- Ausencia de waterfalls secuenciales innecesarios.
- Directivas de caché explícitas con invalidación verificada.
- Skeletons y boundaries `<Suspense>` aplicados a operaciones lentas.

### Seguridad y Operaciones
- Secretos estrictamente server-side (sin `NEXT_PUBLIC_` no intencionales).
- Variables de cifrado multi-instancia configuradas.
- Logging estructurado en formato JSON e instrumentación OpenTelemetry inicializada.
- `next build` y pruebas de integración/E2E aprobadas en CI.

---

## 62. Indicadores Clave de Desempeño (KPIs)

| Métrica | Objetivo de Calidad |
| :--- | :--- |
| **Features sin ownership o dominio definido** | 0 |
| **Secretos o claves privadas expuestos al cliente** | 0 |
| **Server Actions sin validación/autorización explícita** | 0 |
| **Route Handlers privados por mera suposición** | 0 |
| **Llamadas internas redundantes a Route Handlers propios** | 0 |
| **Client Components injustificados** | Mínimo técnico indispensable |
| **Usos injustificados de `any` en TypeScript** | 0 |
| **Entradas de caché sin TTL o política de invalidación** | 0 |
| **Violaciones de dependencias entre módulos** | 0 |
| **Errores no controlados sin trazabilidad en observabilidad** | 0 |
| **Compilaciones fallidas de `next build` en rama principal** | 0 |
| **Hallazgos críticos o altos de seguridad conocidos** | 0 |

---

## 63. Protocolo Senior de Diseño de Features

Antes de iniciar la codificación de cualquier capacidad, responder:
1. ¿Qué dominio de negocio representa esta funcionalidad?
2. ¿Es una capacidad de negocio pura o solamente un componente de UI?
3. ¿Dónde está delimitada su frontera arquitectónica?
4. ¿Quién es el dueño de sus datos y de sus invariantes?
5. ¿Debe ejecutarse en el servidor o requiere ejecución en cliente?
6. ¿Justifica estrictamente la directiva `'use client'`?
7. ¿Lee directamente de la base de datos (DAL) o de un servicio externo?
8. ¿La operación solicitada es una consulta (*Query*) o una mutación (*Command*)?
9. ¿Corresponde exponer una Server Action o un Route Handler público?
10. ¿Qué permisos y roles específicos requiere el actor para ejecutarla?
11. ¿Qué información exacta puede transmitirse al cliente de forma segura?
12. ¿Puede cachearse el resultado y cómo se invalidará ante cambios?
13. ¿Qué parte puede prerenderizarse estáticamente y cuál requiere streaming dinámico?
14. ¿Cómo responderá el sistema si una dependencia aguas abajo falla?
15. ¿Cómo se registrará en los logs y cómo se correlacionará en trazas distribuidas?
16. ¿Qué desacoplamiento se necesita hoy para extraer este módulo como servicio mañana si fuera necesario?

---

## 64. Cheat Sheet — Las 25 Reglas Esenciales

1. Empezá con un Modular Monolith antes de considerar sistemas distribuidos.
2. Organizá el código por features de negocio, no solo por carpetas técnicas.
3. Tratá a `src/app/` como una cáscara delgada de composición y routing.
4. Los Server Components son la opción predeterminada por diseño.
5. Confiná `'use client'` a las hojas interactivas del árbol de componentes.
6. Nunca consultes tus propios Route Handlers desde Server Components.
7. Implementá una Data Access Layer (DAL) protegida con `server-only`.
8. Nunca envíes entidades completas de persistencia a componentes cliente.
9. Diseñá y utilizá DTOs mínimos y específicos para la vista.
10. Las Server Actions son adaptadores de transporte para mutaciones, no el dominio.
11. Validá y autorizá dentro de cada Server Action y Route Handler.
12. Considerá todo Route Handler como un endpoint HTTP público.
13. No intentes reemplazar un backend dedicado complejo cuando el workload exige independencia.
14. Usá Next.js como BFF para agregar y moldear servicios hacia la interfaz web.
15. No confundas el modelo serverless con la arquitectura del dominio.
16. Justificá el uso de Edge Runtime mediante mediciones reales de latencia y compatibilidad.
17. Evitá waterfalls de datos ejecutando operaciones independientes en paralelo.
18. Empleá Suspense y Streaming para desacoplar operaciones de I/O lentas.
19. Toda entrada en caché debe tener TTL explícito y estrategia de invalidación.
20. En entornos multi-instancia, coordiná la clave de cifrado de Server Actions y la caché externa.
21. Marcá módulos con secretos o persistencia con `import 'server-only'`.
22. Instrumentá la aplicación con OpenTelemetry y logging estructurado en JSON.
23. Aplicá SOLID, DRY, KISS y YAGNI con criterio pragmático.
24. Definí límites internos limpios antes de plantear la extracción a microservicios.
25. La arquitectura debe comunicar claramente el producto, no el framework subyacente.

---

## 65. Regla Rectora

La aplicación debe poder comprenderse y auditarse con claridad en dos planos:

### A nivel de Infraestructura y Transporte
```text
Browser Client
     ↓
Next.js Delivery & Runtime Shell
     ↓
Application Layer
     ↓
Domain Layer
     ↓
Infrastructure Layer
```

### A nivel de Dominio de Negocio
```text
Auth
Billing
Projects
Analytics
Notifications
```
y **no** meramente como una colección desarticulada de:
```text
pages / components / hooks / utils / services
```

---

## 66. Resultado Esperado

Una aplicación diseñada, estructurada y operada bajo la especificación técnica **SKL-NEXT-ARCH-001** es:
- **Server-First:** Carga ligera de JavaScript cliente y ejecución óptima de datos en servidor.
- **Feature-Oriented & Modular:** Código organizado por dominios de negocio fácilmente mantenibles y extraíbles.
- **Segura por Diseño (Zero-Trust):** Fronteras protegidas con `server-only`, DTOs mínimos y autorización granular.
- **Observable y Operable:** Trazas OTel, logs estructurados y métricas de producción listas para diagnóstico.
- **Cache-Aware & Streaming-Capable:** Carga progresiva y uso inteligente y controlado de cachés.
- **Apta para Escalamiento Horizontal:** Multi-instancia coordinada, sin estado volátil huérfano.
- **Evolutiva y Predecible:** Fácil de extender sin generar un monolito accidental inmanejable.

> **Meta Definitiva:** Construir una arquitectura Next.js modular, robusta y limpia que aproveche de forma pragmática las mejores capacidades del framework moderno, preserve la independencia de la lógica de negocio y permita evolucionar desde una sola aplicación hasta un ecosistema distribuido con mínimo rozamiento técnico.
