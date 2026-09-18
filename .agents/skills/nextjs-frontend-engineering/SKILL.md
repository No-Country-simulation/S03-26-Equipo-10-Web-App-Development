---
name: nextjs-frontend-engineering
description: >-
  Diseño, implementación, revisión y optimización de frontends profesionales con Next.js (código SKL-NEXT-FRONTEND-001). Usar cuando se requiera construir interfaces con App Router, arquitectura Server-First + Feature-Oriented, Server Components por defecto y Client Islands ('use client'), data fetching y contratos con backend externo, validación de APIs con Zod, jerarquía de estado (URL > Server > Local), Core Web Vitals, accesibilidad WCAG 2.2 AA y seguridad client-side (OWASP).
---

# Especificación Técnica de Habilidad: Senior Next.js Frontend Application Engineering

---

**Código de Skill:** SKL-NEXT-FRONTEND-001  
**Nombre:** Senior Next.js Frontend Application Engineering  
**Versión:** 1.0.0  
**Nivel:** Senior / Production Engineering  
**Dominio:** Next.js / React / TypeScript / Frontend Architecture / Web Performance / UX  
**Router:** App Router  
**Arquitectura recomendada:** Server-First + Feature-Oriented + Component-Driven  
**Backend:** Externo / independiente  
**Estándares:** Next.js Production Guidelines / React / WCAG 2.2 / Core Web Vitals / OWASP Client-Side / TypeScript Strict / SOLID / DRY / KISS / YAGNI / Agile DoD  

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, revisión y optimización de frontends profesionales con Next.js. |
| **Objetivo** | Construir interfaces mantenibles, rápidas, accesibles, seguras, observables y escalables. |
| **Arquitectura Base** | Feature-Oriented / Screaming Architecture. |
| **Modelo de Renderizado** | Server Components por defecto + Client Islands. |
| **Origen de Datos** | APIs / backend externos independientes. |
| **Responsabilidad del Frontend** | Presentación, interacción, navegación, data orchestration y UX. |
| **Responsabilidad Externa** | Persistencia, negocio, autorización autoritativa, jobs y dominio. |
| **Estado** | URL → Server Data → Local State → Shared Client State. |
| **Tipado** | TypeScript Strict. |
| **Complejidad** | Alta. |
| **Prioridad** | Correctitud → Accesibilidad → UX → Seguridad → Rendimiento → Mantenibilidad → Simplicidad. |

---

## 2. Alcance Estricto

Esta Skill gobierna:
```text
Next.js Frontend
```
y **NO** convierte Next.js en:
```text
database layer
domain backend
job worker
message broker
business service
system of record
```

La topología principal será:
```text
Browser
   │
   ▼
Next.js Frontend (BFF / UI Shell)
   │
   ├── Routing & Layouts
   ├── Server Rendering (RSC & Streaming)
   ├── Client Interactivity (Islands)
   ├── UI State Management
   ├── Presentation Cache
   ├── SEO & Metadata
   └── Frontend Observability
   │
   ▼
External API / Backend (Core Domain & DB)
```

---

## 3. Regla Rectora de Fronteras

El frontend puede:
```text
mostrar
transformar para presentación
ordenar
filtrar
formatear
navegar
optimizar UX
```
pero **NO** debe convertirse en autoridad de:
```text
precio
saldo
permisos
facturación
estado transaccional
inventario
reglas regulatorias
```

> **Regla de oro:** El frontend puede decidir cómo representar una regla; el backend decide si esa regla es válida.

---

## 4. Arquitectura Principal

La Skill utilizará:
```text
SERVER-FIRST
+
FEATURE-ORIENTED
+
COMPONENT-DRIVEN
+
PROGRESSIVE ENHANCEMENT
```
Next.js App Router utiliza Server Components, Suspense y capacidades modernas de React como base arquitectónica.

---

## 5. Organización por Features

Para aplicaciones medianas y grandes, preferir:
```text
src/
├── app/
├── features/
│   ├── auth/
│   ├── dashboard/
│   ├── projects/
│   ├── billing/
│   └── notifications/
├── shared/
└── instrumentation-client.ts
```
frente a una estructura global técnica plana (`components/`, `hooks/`, `services/`, `utils/`, `types/`).  
La arquitectura debe comunicar **qué hace el producto** antes que qué clase de archivo técnico contiene.

---

## 6. Estructura Recomendada

```text
src/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   └── pricing/
│   │
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   │
│   ├── (app)/
│   │   ├── dashboard/
│   │   ├── projects/
│   │   └── settings/
│   │
│   ├── layout.tsx
│   ├── loading.tsx
│   ├── error.tsx
│   ├── not-found.tsx
│   ├── robots.ts
│   └── sitemap.ts
│
├── features/
│   ├── projects/
│   │   ├── api/
│   │   ├── model/
│   │   ├── ui/
│   │   ├── hooks/
│   │   ├── schemas/
│   │   └── index.ts
│   │
│   ├── auth/
│   └── notifications/
│
├── shared/
│   ├── api/
│   ├── ui/
│   ├── hooks/
│   ├── config/
│   ├── lib/
│   ├── styles/
│   └── types/
│
└── instrumentation-client.ts
```

---

## 7. Responsabilidad de `app/`

`app/` debe encargarse principalmente de:
```text
routing
layouts
composition
metadata
loading boundaries
error boundaries
route-specific orchestration
```
No debe contener toda la lógica de presentación reutilizable ni estado de negocio disperso.

---

## 8. Route Groups

Utilizar Route Groups para organizar experiencias y layouts distintos sin alterar la estructura de la URL pública:
```text
app/
├── (marketing)/    # Header público, footer, landing
├── (auth)/         # Layout centrado sin navegación
└── (app)/          # Shell con sidebar y sesión protegida
```

---

## 9. Private Folders

Utilizar carpetas privadas (`_components`, `_hooks`, `_lib`) dentro de un segmento de ruta cuando el código sea estrictamente local a esa pantalla:
```text
app/
└── projects/
    ├── page.tsx
    ├── loading.tsx
    └── _components/
        └── projects-header.tsx
```

---

## 10. Colocation

Colocar junto a la ruta:
- Componentes locales específicos.
- Skeletons locales.
- Estados vacíos de esa pantalla.
- Adaptadores de ruta específicos.  
Mover a `features/` en cuanto la capacidad sea compartida o represente una entidad de dominio real.

---

## 11. Server Components como Default

Layouts y Pages son **Server Components por defecto**.  
Utilizarlos para:
- Obtener datos de APIs externas sin exponer claves privadas.
- Renderizar HTML directamente en el servidor.
- Generar etiquetas SEO y metadatos.
- Reducir el JavaScript enviado al navegador a 0 KB para UI estática.
- Streaming progresivo de contenido con `Suspense`.

---

## 12. Client Components

Introducir `'use client';` **única y exclusivamente** cuando exista:
- Manejo de eventos (`onClick`, `onChange`, `onSubmit`).
- Manejo de estado local o ciclo de vida (`useState`, `useReducer`, `useEffect`).
- APIs del navegador (`window`, `localStorage`, `navigator`, `ResizeObserver`).
- Hooks interactivos personalizados.
- Librerías de UI de terceros que dependan del contexto del cliente.

---

## 13. `'use client'` Define una Frontera

`'use client'` no es una simple anotación de función; define un límite de empaquetado (*bundling boundary*). Una vez que un módulo se marca como Client Component, **todos sus imports y componentes descendientes se incluyen en el bundle de JavaScript del navegador**.  
*La frontera de `'use client'` debe mantenerse lo más abajo y pequeña posible en el árbol de componentes.*

---

## 14. Patrón Client Island

```text
// ✅ BUENO: Client Island aislada (Poco JS al cliente)
Server Page
├── Server Header
├── Server ProductList (Cero JS al cliente)
└── Client FilterControls ('use client' sólo aquí)

// ❌ MALO: Contaminar toda la página
'use client'
EntirePage
├── Header
├── ProductList
└── FilterControls
```

---

## 15. Serializable Props

Los datos que cruzan la frontera de Server Component a Client Component **deben ser 100% serializables**:
```typescript
// ✅ DTO plano serializable a JSON
type ProductCardDTO = {
  id: string;
  name: string;
  price: number;
};
```
*Evitar pasar: instancias de clases con métodos, clientes de bases de datos, funciones de callback arbitrarias o símbolos privados.*

---

## 16. Arquitectura de Datos

Para una aplicación frontend con backend independiente:
```text
Next Server Component (RSC) ──(Red rápida / interna)──> Backend API
```
es casi siempre preferible a:
```text
Browser ──(Red móvil / latencia alta)──> Backend API
```
para la carga inicial de datos.

---

## 17. API Client Centralizado

Crear una capa de cliente HTTP tipada y centralizada:
```text
shared/api/
├── api-client.ts     # Wrapper sobre fetch con tipado y control de errores
├── api-error.ts      # Normalización de códigos de error y respuestas
└── endpoints.ts      # Rutas remotas tipadas
```
o por feature: `features/projects/api/get-projects.ts`.

---

## 18. Nunca Dispersar `fetch`

```typescript
// ❌ MALO: fetch disperso en botones, hooks y páginas con URLs duras
const res = await fetch('/api/v1/projects');

// ✅ MEJOR: Función tipada con manejo centralizado de errores
export async function getProjects(input: GetProjectsInput): Promise<ProjectPage> {
  return apiClient.get('/projects', { params: input });
}
```

---

## 19. El API Client no es Service Layer de Negocio

El cliente de API en el frontend se encarga de:
- Llamadas HTTP y serialización.
- Inyección de cabeceras de autorización y correlación.
- Normalización de errores HTTP y de red.
- Validación de esquemas de respuesta.  
**No debe contener reglas de precios, validación regulatoria de negocio ni cálculos de facturación.**

---

## 20. Runtime Validation de Respuestas de API

Aunque el backend provea tipos en TypeScript, la respuesta de red sigue siendo **dato no confiable en runtime**:
```typescript
import { z } from 'zod';

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  status: z.enum(['active', 'archived']),
  updatedAt: z.string().datetime(),
});

export type ProjectDTO = z.infer<typeof ProjectSchema>;
```

---

## 21. Detección Temprana de Errores de Contrato

Si el backend devuelve `{ "id": 123 }` pero el frontend espera `id: string`, **nunca enmascarar el error con un cast forzado (`as Project`)**. Validar con Zod para fallar de forma ruidosa y controlada en desarrollo antes de causar errores inexplicables en la UI.

---

## 22. Data Fetching en Server Components

```typescript
export default async function ProjectsPage() {
  const projects = await getProjects();
  return <ProjectsView projects={projects} />;
}
```
Aprovecha el soporte nativo de I/O asíncrono directo en Server Components sin necesidad de `useEffect` ni estados de carga manuales para la vista inicial.

---

## 23. Data Fetching en Client Components

Utilizar fetching en el cliente solo cuando exista:
- Polling periódico de datos en tiempo real.
- Dependencia estricta de eventos o sensores del navegador.
- Revalidación continua tras foco de ventana (*revalidate on focus*).
- Mutaciones optimistas complejas en el cliente.

---

## 24. TanStack Query (React Query) / SWR

No introducirlos mecánicamente por defecto.  
Adoptarlos si existe una necesidad justificada de:
- Caché interactiva en el cliente y deduplicación de peticiones en el browser.
- Paginación infinita interactiva con scroll virtual.
- Actualizaciones optimistas reversibles.  
*No utilizarlos para duplicar datos estáticos que los Server Components ya manejan de forma nativa.*

---

## 25. Propiedad Única del Estado de Servidor (Ownership)

Una misma fuente de datos no debe estar duplicada simultáneamente en:
```text
RSC cache + React Query cache + React Context + useState local
```
Definir siempre una única fuente de verdad para cada dato.

---

## 26. Jerarquía de Estado

Resolver el estado respetando la siguiente precedencia:
```text
1. URL State (Search Params / Pathname)
   ↓
2. Remote / Server State (RSC / Cache)
   ↓
3. Local Component State (useState / useReducer)
   ↓
4. Shared Client State (Context / Compound Component)
   ↓
5. Global Client Store (Zustand - sólo cuando sea inevitable)
```

---

## 27. URL State Primero

Filtros, ordenamientos, pestañas seleccionadas y paginación deben vivir en los **Search Params de la URL** (`/projects?status=active&page=2`):
- Son compartibles por enlace (*shareable*).
- Soportan marcadores y favoritos del navegador.
- Funcionan con los botones de "Atrás" y "Adelante" del navegador.
- Son legibles tanto por el servidor en la carga inicial como por el cliente.

---

## 28. `useState` para Estado Estrictamente Local

Reservar `useState` para detalles efímeros de la UI que no aportan valor fuera del componente:
- Modales o dropdowns abiertos/cerrados.
- Texto temporal mientras el usuario escribe en un campo no confirmado.
- Elemento enfocado o resaltado en una lista local.

---

## 29. `useReducer`

Utilizar `useReducer` cuando el componente posea múltiples transiciones de estado relacionadas o actúe como una máquina de estados finita (evitando estados imposibles).

---

## 30. React Context

Limitar `Context` a estado transversal de bajo volumen y bajo cambio:
- Preferencias de tema visual (oscuro / claro).
- Idioma y localización actual.
- Contexto de componentes compuestos (*Compound Components* como un Accordion o Tabs).  
*No utilizar Context como un almacén universal para datos del servidor que cambian continuamente.*

---

## 31. Zustand / Redux

Incorporar gestores de estado global tipo Zustand únicamente ante **estado cliente mutable y complejo compartido a través de ramas distantes del árbol de componentes**.  
*No instalar Zustand solo porque el proyecto se considera "grande".*

---

## 32. Estado Derivado (Derived State)

**Nunca almacenar en estado lo que puede calcularse al vuelo durante el render:**
```typescript
// ❌ MALO: Estado redundante propenso a desincronización
const [fullName, setFullName] = useState(`${firstName} ${lastName}`);

// ✅ MEJOR: Cálculo directo en tiempo de renderizado
const fullName = `${firstName} ${lastName}`;
```

---

## 33. Evitar `useEffect` Innecesarios

No usar `useEffect` para transformar datos ni para sincronizar un estado en base a otro prop. Los `Effects` existen para sincronizar la aplicación con sistemas externos (event listeners del DOM, WebSockets, timers), no para dirigir el flujo interno de datos de React.

---

## 34. Navegación

- Usar `<Link href="...">` para navegación declarativa estándar (activa prefetching automático).
- Usar `router.push()` únicamente cuando la navegación sea la consecuencia imperativa de una acción del usuario (ej. tras confirmar un pago o enviar un formulario).

---

## 35. Prefetching Prudente

`<Link>` precarga automáticamente las rutas en segundo plano. En páginas con cientos de enlaces (tablas masivas o listados largos), desactivar o ajustar `prefetch={false}` para no saturar el ancho de banda del usuario ni la CPU del dispositivo.

---

## 36. Layouts Persistentes

Utilizar `layout.tsx` para la estructura visual compartida: barras de navegación, encabezados, paneles laterales y proveedores. Los layouts preservan su estado y no se re-renderizan innecesariamente durante la navegación entre rutas hijas.

---

## 37. No Convertir `layout.tsx` en un God Component

Evitar colocar en el layout raíz:
- Fetching de datos de todas las secciones del sistema.
- Decenas de proveedores globales no esenciales.
- Lógica de modales y banners ajenos a la estructura.

---

## 38. Posicionamiento Óptimo de Proveedores (Providers)

Colocar los proveedores de contexto cliente lo más abajo posible en la jerarquía del árbol. No envolver todo `app/layout.tsx` con un proveedor si este solo es requerido dentro de `(app)/dashboard/`.

---

## 39. Los Cuatro Estados de la UI (Loading, Error, Empty, Success)

Toda vista que consuma datos asíncronos debe diseñar explícitamente:
1. **Loading State:** Skeletons que respeten la geometría final.
2. **Error State:** Mensaje comprensible con acción de reintento.
3. **Empty State:** Explicación clara de por qué no hay datos y cómo crearlos.
4. **Success State:** La visualización de los datos finales.

---

## 40. `loading.tsx`

Usar `loading.tsx` para definir la pantalla de carga inmediata a nivel de segmento de ruta mientras se resuelven los datos del Server Component principal.

---

## 41. Aislamiento con `Suspense`

Utilizar límites de `<Suspense>` para aislar componentes secundarios o lentos:
```tsx
<Suspense fallback={<AnalyticsChartSkeleton />}>
  <SlowAnalyticsChart />
</Suspense>
```
*Nunca bloquear el renderizado de una pantalla completa por culpa de un widget accesorio.*

---

## 42. Streaming de UI

Diseñar la experiencia siguiendo el patrón de streaming progresivo:
```text
Shell visual rápido (Layout, Header)
↓
Contenido principal prioritario
↓
Widgets secundarios y gráficos diferidos
```

---

## 43. Eliminación de Waterfalls

```typescript
// ❌ MALO: Peticiones secuenciales innecesarias
const user = await getUser();
const projects = await getProjects();
const alerts = await getAlerts();

// ✅ MEJOR: Peticiones paralelas en el servidor
const [user, projects, alerts] = await Promise.all([
  getUser(),
  getProjects(),
  getAlerts(),
]);
```

---

## 44. Estrategia de Caché Explícita

Para cada dato consumido en el frontend, definir conscientemente:
- ¿Es información pública o privada del usuario?
- ¿Se toleran datos obsoletos (*stale data*) y durante cuántos segundos?
- ¿Qué evento invalida esta caché?

---

## 45. Cache Components (`'use cache'`)

En versiones modernas de Next.js, habilitar Cache Components para marcar de forma granular y explícita bloques de código cacheados con directivas como `'use cache'`, `cacheLife()` y `cacheTag()`.

---

## 46. Prevención de Fugas de Datos Privados en Caché

Tener extremo cuidado de **nunca almacenar en cachés compartidas o públicas** datos que dependan de la sesión del usuario (perfiles, dashboards con métricas privadas, notificaciones personales).

---

## 47. Coexistencia Estático / Dinámico

Una misma aplicación Next.js moderna combina:
- Páginas de marketing 100% estáticas.
- Catálogos con revalidación periódica.
- Dashboards privados 100% dinámicos con streaming.
- Widgets interactivos en el cliente.

---

## 48. Estrategia de SEO con la Metadata API

Configurar siempre metadatos estáticos o dinámicos:
```typescript
export const metadata: Metadata = {
  title: 'Proyectos | SaaS Platform',
  description: 'Gestión centralizada de proyectos y métricas de equipo.',
};

// O dinámico en base a parámetros:
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProject(params.id);
  return { title: `${project.name} | SaaS Platform` };
}
```

---

## 49. Checklist de Metadatos Esenciales

- `title` y `title.template`
- `description` descriptivo y conciso (máx. 160 caracteres)
- URL canónica (`alternates.canonical`)
- Directivas de indexación (`robots`)
- Open Graph (`openGraph.title`, `openGraph.images`)
- Twitter Cards (`twitter.card`, `twitter.title`)

---

## 50. Títulos Únicos por Pantalla

Cada página debe tener un título representativo. Esto optimiza el posicionamiento en buscadores y permite que tecnologías asistivas (lectores de pantalla) anuncien el cambio de contexto tras una navegación SPA.

---

## 51. Convenciones de Archivos de Metadatos

Aprovechar las convenciones basadas en archivos de Next.js:
- `favicon.ico`, `icon.png`, `apple-icon.png`
- `manifest.json` (PWA)
- `robots.ts`
- `sitemap.ts`
- `opengraph-image.tsx` (generación dinámica de imágenes para redes sociales)

---

## 52. Generación Dinámica de Sitemap (`sitemap.ts`)

Las rutas indexables dinámicas deben listarse programáticamente en `app/sitemap.ts` con sus fechas de última modificación (`lastModified`) y prioridades.

---

## 53. `robots.ts`

Controla qué motores de búsqueda pueden rastrear cada sección.  
*Advertencia:* **`Disallow ≠ Seguridad privada`**. Una ruta oculta en `robots.txt` sigue siendo accesible si un usuario conoce su URL.

---

## 54. Accesibilidad como Requisito de Calidad (WCAG 2.2 AA)

La accesibilidad web no es un extra visual opcional; es un requisito funcional de ingeniería de primer orden.

---

## 55. HTML Semántico

Utilizar las etiquetas nativas del estándar HTML:
`<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<button>`, `<label>`, `<input>`.  
*Evitar construir interfaces enteras mediante `<div>` y `<span>` con manejadores de click.*

---

## 56. Distinción entre Botón y Enlace

```text
Acción o mutación (abrir modal, enviar formulario, cambiar estado) ──> <button>
Navegación o cambio de URL (ir a otra página o ancla) ──────────────> <Link> / <a>
```
*Nunca utilizar un `<div onClick>` para navegar ni un `<a href="#">` para disparar una acción.*

---

## 57. Soporte Integral de Teclado (Keyboard First)

Toda interacción del usuario debe poder completarse íntegramente sin ratón:
- Navegación secuencial con `Tab` y `Shift + Tab`.
- Activación con `Enter` y `Space`.
- Cierre de modales y menús desplegables con `Escape`.
- Selección en listas, tabs y menús con `Flechas de dirección`.

---

## 58. Gestión del Foco (Focus Management)

- Al abrir un modal, atrapar el foco dentro del mismo (*focus trap*).
- Al cerrarlo, devolver el foco al botón disparador original.
- Al fallar la validación de un formulario, trasladar el foco al primer campo con error.
- En transiciones de ruta, garantizar que el foco no quede en el vacío.

---

## 59. Uso Apropiado de ARIA

> **Primera regla de ARIA:** Si puedes resolverlo con HTML semántico nativo, **no uses ARIA**.  
> Un atributo ARIA mal configurado es peor para la accesibilidad que no tener ningún atributo ARIA.

---

## 60. Reglas de Accesibilidad en ESLint

Configurar `eslint-config-next` con el plugin `jsx-a11y` activo y resolver todas las advertencias de contraste, roles y etiquetas faltantes en tiempo de desarrollo.

---

## 61. Diseño Responsive Fluido

Diseñar las interfaces como sistemas elásticos pensados para dispositivos móviles, tablets, pantallas estándar y monitores ultrawide, evitando suposiciones de resolución fija.

---

## 62. Enfoque Mobile-First

Estructurar los estilos CSS desde la vista móvil e incrementar la complejidad hacia pantallas mayores mediante breakpoints ascendentes (`base` → `sm` → `md` → `lg` → `xl`).

---

## 63. Jerarquía del Sistema de Diseño (Design System)

Organizar los componentes de interfaz en capas coherentes:
```text
Design Tokens (Colores, Spacing, Tipografía)
  ↓
Primitives (Button, Input, Badge, Dialog)
  ↓
Patterns / Layouts (FormField, DataTable, ConfirmModal)
  ↓
Feature Components (ProjectCard, TestimonialCard, BillingSummary)
  ↓
Pages (Composición en app/)
```

---

## 64. Componentes Primitivos

Componentes visuales puros y desacoplados de cualquier lógica de negocio: `Button`, `Input`, `Dialog`, `Popover`, `Select`, `Tooltip`.

---

## 65. Componentes de Feature

Componentes que conocen el modelo visual de un dominio específico: `ProjectCard`, `TestimonialItem`, `InvoiceRow`. Viven dentro de su respectiva carpeta en `features/`.

---

## 66. Primitivas Headless (Radix UI / shadcn/ui)

Adoptar librerías accesibles *headless* como base arquitectónica.  
*Advertencia:* **Instalar Radix UI no garantiza un producto accesible automáticamente**. Siempre se deben verificar contrastes de color, etiquetas visibles, focus rings y comportamiento en pantallas pequeñas.

---

## 67. Estrategia de Estilos

La Skill no impone una herramienta única (Tailwind CSS, CSS Modules, Vanilla CSS). Lo fundamental es mantener coherencia, evitar especificidades conflictivas y no cargar librerías CSS-in-JS que degraden el rendimiento de los Server Components.

---

## 68. Erradicar Clases y Estilos Arbitrarios Repetidos

Si combinaciones idénticas de espaciado, bordes y colores aparecen dispersas por el código, deben abstraerse en variables CSS, clases semánticas o componentes reutilizables.

---

## 69. Design Tokens Centralizados

Definir una paleta armónica y unificada para:
- Colores (fondos, bordes, estados primarios, secundarios, error, éxito).
- Escala de espaciado (`space-2`, `space-4`, `space-8`).
- Radios de borde (`radius-sm`, `radius-md`, `radius-lg`).
- Tipografías y sombras.

---

## 70. Optimización de Imágenes (`next/image`)

Utilizar siempre `<Image>` de Next.js para imágenes en producción:
- Convierte automáticamente a formatos modernos (WebP / AVIF).
- Evita saltos de diseño (*Cumulative Layout Shift*) reservando el espacio exacto con `width` y `height` o `fill`.
- Carga perezosa (*lazy loading*) nativa automática para imágenes fuera de la pantalla inicial.

---

## 71. Textos Alternativos Significativos (`alt`)

- Toda imagen que transmita información debe tener un atributo `alt` descriptivo.
- Las imágenes puramente decorativas deben llevar `alt=""` explícito y `aria-hidden="true"`.

---

## 72. Restricción de Imágenes Remotas (`remotePatterns`)

Configurar de forma estricta los hostnames externos permitidos en `next.config.mjs` bajo `images.remotePatterns`, evitando comodines inseguros que permitan a atacantes utilizar el optimizador de imágenes como proxy arbitrario.

---

## 73. Fuentes Web con `next/font`

Utilizar `next/font/google` o `next/font/local`:
- Descarga y hospeda las fuentes localmente en tiempo de compilación (cero peticiones externas a Google Fonts en runtime).
- Ajusta automáticamente las métricas de fuentes fallback para eliminar el parpadeo de texto y el CLS.

---

## 74. Auditoría de Scripts de Terceros

Evaluar críticamente cualquier script externo (analytics, chats, heatmaps, widgets):
¿Aporta valor proporcional al JavaScript que añade? ¿Bloquea el hilo principal? ¿Respeta la privacidad del usuario? Diferir su carga utilizando `<Script strategy="lazyOnload">`.

---

## 75. Vigilancia del Bundle de Cliente

Monitorear constantemente no solo el tamaño en disco de los archivos `.js`, sino el costo de **descarga, parseo y ejecución** en dispositivos móviles de gama media.

---

## 76. Análisis de Dependencias con Bundle Analyzer

Utilizar `@next/bundle-analyzer` ante incrementos de tamaño para detectar librerías sobredimensionadas y reemplazar importaciones gigantes por alternativas modulares.

---

## 77. Carga Dinámica con `next/dynamic`

Utilizar importaciones dinámicas para componentes pesados que no se requieren en la vista inicial:
```typescript
const HeavyChart = dynamic(() => import('@/features/analytics/ui/heavy-chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false, // Sólo si depende estrictamente de APIs del browser
});
```

---

## 78. No Abusar del Lazy Loading

Dividir el código en exceso genera waterfalls de red y sobrecarga la experiencia con micro-spinners parpadeantes. Aplicar `dynamic()` únicamente en piezas pesadas con beneficio medible.

---

## 79. React Compiler y Criterio de Memoización

No llenar el código indiscriminadamente con `useMemo`, `useCallback` y `React.memo` por reflejo sin contar con un perfil de rendimiento que justifique su costo. React moderno y el React Compiler optimizan el árbol de renderizado de forma automática.

---

## 80. Métricas Core Web Vitals

Monitorear y optimizar:
- **LCP (Largest Contentful Paint):** Carga del elemento visual principal (< 2.5s).
- **INP (Interaction to Next Paint):** Respuesta interactiva a eventos de usuario (< 200ms).
- **CLS (Cumulative Layout Shift):** Estabilidad visual sin desplazamientos inesperados (< 0.1).

---

## 81. Monitorización de Usuarios Reales (RUM)

Implementar `useReportWebVitals()` o integraciones de telemetría para medir el rendimiento real de los usuarios en producción bajo condiciones de red y hardware heterogéneas.

---

## 82. Presupuestos de Rendimiento (Performance Budgets)

Establecer presupuestos máximos para el peso de scripts iniciales, imágenes y fuentes para evitar la degradación gradual del frontend a lo largo de los sucesivos despliegues.

---

## 83. Skeletons de Alta Fidelidad

Un skeleton debe imitar fielmente la geometría, dimensiones y jerarquía del componente final para que el reemplazo de datos no altere el layout visual de la página.

---

## 84. Seguridad Frontend (Enfoque Client-Side)

El frontend no puede imponer seguridad autoritativa, pero debe blindar al usuario contra:
- Cross-Site Scripting (XSS).
- Exposición de claves privadas y tokens de servicio.
- URLs no confiables y Clickjacking.
- Fugas de información en logs y herramientas de analítica.

---

## 85. Nunca Almacenar Secretos en el Frontend

> **Regla de oro:** Todo valor prefijado con `NEXT_PUBLIC_*` se incrusta en texto plano en el JavaScript público del navegador.

**Nunca** colocar en variables de frontend: claves secretas de API, credenciales de base de datos, claves privadas de firma de tokens ni credenciales de microservicios internos.

---

## 86. Gestión de Tokens de Sesión

- Si el backend utiliza cookies `HttpOnly`, `Secure` y `SameSite`, priorizar este mecanismo.
- **Evitar almacenar tokens JWT sensibles en `localStorage`**, dado que cualquier script de terceros o vulnerabilidad XSS puede acceder a ellos sin restricción.

---

## 87. Autenticación en la Interfaz vs Autorización Real

El frontend presenta la sesión, oculta botones y redirige rutas protegidas.  
*Advertencia:* **Ocultar un botón en la interfaz no constituye una medida de seguridad**. El backend debe validar de forma autoritativa cada petición entrante.

---

## 88. Permisos Visuales en UI

Ocultar acciones para las que el usuario carece de permisos mejora la experiencia de usuario (UX), pero no exime al servidor de rechazar peticiones no autorizadas con HTTP 403 Forbidden.

---

## 89. Prevención de Cross-Site Scripting (XSS)

React escapa strings automáticamente en las plantillas JSX. El riesgo de XSS reaparece en:
- `dangerouslySetInnerHTML`
- Inserción de HTML proveniente de editores de texto enriquecido (*Rich Text*).
- URLs con esquemas maliciosos (`javascript:...`).
- Librerías externas que manipulen el DOM directamente.

---

## 90. Restricción Estricta de `dangerouslySetInnerHTML`

Utilizarlo únicamente con contenido verificado o sanitizado mediante librerías consolidadas (ej. `DOMPurify` / `isomorphic-dompurify`). **Nunca inyectar entradas del usuario directamente en el DOM.**

---

## 91. Validación de URLs Externas

Al renderizar enlaces provistos por usuarios o fuentes externas, validar que el protocolo sea estrictamente seguro (`http:` o `https:`), bloqueando esquemas arbitrarios como `javascript:` o `data:`.

---

## 92. Content Security Policy (CSP)

Coordinar cabeceras CSP restrictivas para impedir la carga de scripts no autorizados, evaluando el uso de nonces para scripts en línea.

---

## 93. Formularios Accesibles y Resilientes

Combinar semántica nativa de HTML, retroalimentación inmediata en el cliente y validación estricta y autoritativa en el backend.

---

## 94. Validación Nativa y Schemas en Cliente

Aprovechar validaciones nativas de HTML (`required`, `type="email"`, `min`, `max`) y complementarlas con esquemas de Zod para reglas de negocio visuales que aporten feedback en tiempo real.

---

## 95. Validación Duplicada Justificada

Tener validación en el frontend y en el backend no viola el principio DRY:
- **Frontend:** Aporta feedback visual inmediato y previene tráfico innecesario.
- **Backend:** Garantiza la integridad de los datos y la seguridad inquebrantable del sistema.

---

## 96. React Hook Form

Utilizar `react-hook-form` con resolvers de Zod para formularios complejos con múltiples campos interdependientes o validaciones dinámicas, minimizando los re-renders innecesarios.

---

## 97. Estados del Ciclo de Vida de Formularios

Todo formulario debe comunicar claramente sus 5 estados:
- **Idle:** Formulario listo para escribir.
- **Pending / Submitting:** Envío en progreso con indicador visual.
- **Success:** Confirmación explícita de éxito.
- **Validation Error:** Errores asociados al campo específico.
- **Server Error:** Notificación clara ante caídas de red o fallos del servidor.

---

## 98. El Estado `disabled` en Botones

Desactivar un botón con `disabled` puede impedir que tecnologías asistivas lean el botón o que usuarios descubran por qué no pueden avanzar. En su lugar, considerar el uso de `aria-disabled="true"` acompañado de mensajes explicativos de los campos pendientes.

---

## 99. Interfaz Optimista (Optimistic UI)

Aplicar actualizaciones optimistas en acciones rápidas, reversibles y con baja probabilidad de error: marcar como favorito, dar "me gusta" o reordenar elementos en una lista local.

---

## 100. No Utilizar Optimistic UI para Acciones Críticas

**Nunca** aplicar interfaces optimistas en operaciones irreversibles o críticas: transferencias bancarias, eliminación de cuentas, cambios de permisos o transacciones de pago.

---

## 101. Estados Vacíos Explicativos (Empty States)

No limitarse a mostrar un texto plano de "Sin datos". Un estado vacío debe explicar: qué debería aparecer aquí, por qué está vacío y qué acción inmediata puede tomar el usuario para poblarlo.

---

## 102. Experiencia ante Errores (Error UX)

Nunca mostrar un mensaje técnico crudo como "Error 500". Proporcionar un mensaje comprensible, una vía de recuperación (botón de reintentar) y un identificador de referencia para soporte técnico si aplica.

---

## 103. Error Boundaries (`error.tsx`)

Implementar archivos `error.tsx` en segmentos de ruta para atrapar fallos inesperados de renderizado sin desmoronar la aplicación entera, permitiendo reintentar el render con `reset()`.

---

## 104. Rutas no Encontradas (`not-found.tsx`)

Personalizar pantallas 404 útiles que orienten al usuario de vuelta a las secciones principales del producto.

---

## 105. Componentes de Carga y Error Responsivos

Skeletons, alertas, banners y modales de error deben someterse a las mismas pruebas de adaptabilidad móvil, navegación por teclado y contraste que las pantallas exitosas.

---

## 106. Observabilidad del Frontend

Monitorear en producción: errores no controlados de JavaScript, promesas rechazadas, caídas en llamadas a la API, métricas Core Web Vitals reales y embudos de conversión interrumpidos.

---

## 107. Instrumentación Cliente (`instrumentation-client.ts`)

Aprovechar el soporte de instrumentación cliente de Next.js para inicializar proveedores de telemetría, monitoreo de errores (Sentry, OpenTelemetry) y analíticas antes de la ejecución del árbol principal.

---

## 108. Datos Prohibidos en Telemetría y Analítica

**Nunca enviar a plataformas de analítica externa:** contraseñas, tokens de autenticación, números de tarjetas de crédito o información personal confidencial (PII) sin consentimiento explícito.

---

## 109. Eventos de Analítica Semánticos

Registrar eventos orientados a intención de negocio (`project_created`, `pricing_plan_selected`) en lugar de eventos técnicos sin contexto (`button_id_clicked`).

---

## 110. Feature Flags en Frontend

Los feature flags en la interfaz son herramientas de experimentación y entrega continua (*progressive rollout*); **no constituyen mecanismos de seguridad**. Las características ocultas en la UI deben estar igualmente protegidas en el backend.

---

## 111. Estrategia de Testing Integral

Una suite frontend balanceada incluye:
- **Unit Tests:** Lógica pura, mappers, utilidades y formateadores.
- **Component Tests:** Comportamiento e interacción observable de componentes aislados.
- **Integration Tests:** Flujos combinados de múltiples componentes y páginas.
- **E2E Tests:** Recorridos críticos completos en navegadores reales.

---

## 112. Tests Unitarios

Reservados para funciones puras: validadores de esquemas, formateadores de moneda/fechas, transformadores de View Models y máquinas de estado.

---

## 113. Tests de Componentes

Probar el comportamiento observable por el usuario: renderizado de estados, interacción por teclado, disparo de eventos de callback y transiciones visuales.

---

## 114. Principios de React Testing Library

Escribir pruebas que se asemejen a la forma en que los usuarios interactúan con la interfaz: consultar elementos por **rol semántico** (`getByRole`), **etiqueta asociada** (`getByLabelText`) o **texto visible**, evitando selectores acoplados a detalles de implementación (clases CSS o IDs internos).

---

## 115. Tests End-to-End con Playwright

Automatizar flujos de negocio vitales: autenticación, creación de entidades, navegación entre vistas protegidas y envíos de formularios clave.

---

## 116. Cobertura de Estados Adversos

Las pruebas deben verificar deliberadamente los caminos de fallo: caídas de red, respuestas HTTP 401/403/500, esquemas inválidos y respuestas vacías.

---

## 117. Pruebas de Regresión Visual

Aplicar capturas visuales automatizadas en componentes del sistema de diseño y páginas públicas para detectar desajustes involuntarios de CSS entre despliegues.

---

## 118. Pruebas Automatizadas de Accesibilidad

Integrar librerías automatizadas (`axe-core`, `@axe-core/playwright`) en el pipeline de CI para auditar árboles de accesibilidad y detectar violaciones de contraste y etiquetado.

---

## 119. TypeScript Estricto

Configurar TypeScript bajo reglas estrictas:
```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

## 120. Prohibición de `any`

Evitar `any` como atajo de desarrollo. Utilizar `unknown` en datos entrantes de red y estrechar el tipo mediante validación con esquemas Zod o type guards explícitos.

---

## 121. Modelos de Vista Propios del Frontend (View Models)

Crear tipos de TypeScript adaptados a las necesidades específicas de la interfaz:
```typescript
export interface ProjectCardViewModel {
  readonly id: string;
  readonly title: string;
  readonly formattedDate: string;
  readonly badgeLabel: string;
  readonly isArchived: boolean;
}
```
*No forzar a la UI a trabajar directamente con estructuras rígidas diseñadas para la base de datos.*

---

## 122. Desacoplamiento mediante Mappers

```text
API Response DTO ──> Mapper Puro (Unit-tested) ──> UI View Model
```
Si el backend renombra una propiedad, solo se actualiza el mapper sin tener que modificar decenas de componentes visuales.

---

## 123. Ejemplo de Mapper Desacoplado

```typescript
export function toProjectCardViewModel(dto: ProjectDTO): ProjectCardViewModel {
  return {
    id: dto.id,
    title: dto.name,
    formattedDate: new Intl.DateTimeFormat('es-AR').format(new Date(dto.updatedAt)),
    badgeLabel: dto.status === 'active' ? 'Activo' : 'Archivado',
    isArchived: dto.status === 'archived',
  };
}
```

---

## 124. Diseño de APIs de Componentes

Los componentes reutilizables deben exponer interfaces:
- Pequeñas y con un propósito único (*Single Responsibility*).
- Tipadas estrictamente.
- Altamente componibles mediante `children`.

---

## 125. Evitar la Explosión de Props Booleanos

```tsx
// ❌ MALO: Múltiples flags booleanos contradictorios
<Button primary danger small rounded outline loading />

// ✅ MEJOR: Variantes explícitas y excluyentes
<Button variant="danger" size="sm" isLoading />
```

---

## 126. Composición sobre Configuración

```tsx
// ✅ MEJOR: Composición flexible y legible
<Card>
  <Card.Header title="Proyectos" />
  <Card.Content>
    <ProjectList items={projects} />
  </Card.Content>
</Card>
```
Evita crear mega-componentes configurables con 30 props donde el código se vuelve inmanejable.

---

## 127. Evitar el Prop Drilling Excesivo

No propagar props a través de 5 niveles de componentes intermedios que no los utilizan. Rediseñar la frontera del componente mediante composición (`children`) o contexto local acotado.

---

## 128. Custom Hooks Reutilizables

Un custom hook debe encapsular comportamiento reactivo reutilizable (gestión de listeners, lógica de filtros, debouncing). **No debe convertirse en una capa de servicios de negocio disfrazada.**

---

## 129. Nombres Claros para Custom Hooks

Usar nombres descriptivos que expresen su intención técnica:
`useProjectFilters`, `useDebounce`, `useMediaQuery`, `useIntersectionObserver`.  
*Evitar nombres genéricos como `useHelpers` o `useUtils`.*

---

## 130. Principios SOLID en el Frontend

- **SRP:** Un componente se ocupa de presentar una pieza visual; un hook se ocupa de un comportamiento reactivo.
- **DIP:** Los componentes de presentación dependen de contratos de datos abstractos (View Models), no de clientes HTTP concretos.

---

## 131. DRY con Criterio Pragmático

Extraer componentes compartidos cuando compartan semántica real y reglas de evolución comunes. No acoplar componentes dispares simplemente porque tienen estilos similares en un momento dado.

---

## 132. Simplicidad Radical (KISS)

Un componente conciso de 30 líneas de código directo es infinitamente preferible a una arquitectura sobre-diseñada con HOCs, render props y tres niveles de indirección innecesarios.

---

## 133. Cero Abstracción Prematura (YAGNI)

No instalar paquetes de internacionalización (i18n), stores globales o arquitecturas de microfrontends hasta que exista una necesidad de negocio concreta y operativa que lo demande.

---

## 134. Convención de Comentarios

Los comentarios deben explicar el **motivo o la justificación técnica** de una decisión no evidente, no relatar lo que el código ya dice:
```typescript
// ❌ MALO:
// Establece el estado en falso
setIsOpen(false);

// ✅ BUENO:
// Conservamos los searchParams en la URL al cerrar el modal para que
// el usuario no pierda el estado de los filtros aplicados en el listado.
router.replace(`${pathname}?${currentParams.toString()}`);
```

---

## 135. Documentación con TSDoc

Documentar componentes reutilizables y mappers clave:
```typescript
/**
 * Transforma la respuesta remota de la API en el View Model que consume la tarjeta.
 *
 * Aísla al componente visual de cambios en la nomenclatura de campos de la API.
 *
 * @param dto Datos brutos validados recibidos del backend.
 * @returns Modelo de presentación estable para el componente ProjectCard.
 */
export function toProjectCardViewModel(dto: ProjectDTO): ProjectCardViewModel {
  // ...
}
```

---

## 136. Checklist de Pre-Producción

Antes de desplegar a producción, verificar:
- [ ] Enrutamiento y layouts validados sin recargas completas de página.
- [ ] Renderizado en servidor optimizado; `'use client'` restringido a islas indispensables.
- [ ] Cero secretos o credenciales expuestos en `NEXT_PUBLIC_*`.
- [ ] Respuestas de API externas validadas con Zod.
- [ ] Navegación completa por teclado verificada manualmente.
- [ ] Metadatos SEO, Open Graph y títulos únicos presentes en cada ruta indexable.
- [ ] Imágenes utilizando `<Image>` con tamaños y dimensiones exactas.
- [ ] Core Web Vitals en umbrales verdes (LCP < 2.5s, INP < 200ms, CLS < 0.1).
- [ ] `next build` y verificación de tipos pasando sin errores ni warnings críticos.

---

## 137. Definition of Done (DoD)

Una funcionalidad frontend se considera **terminada y lista para producción** cuando:

### Arquitectura & Estructura
- [ ] Pertenece a una feature claramente delimitada.
- [ ] `app/` preserva su rol de enrutamiento y composición sin acumular lógica interna.
- [ ] No existen abstracciones prematuras ni sobre-ingeniería de capas.

### Server vs Client
- [ ] Implementada mediante Server Components por defecto.
- [ ] Las islas `'use client'` están aisladas en las hojas del árbol.
- [ ] Todas las props que cruzan fronteras son serializables a JSON.

### Datos & Estado
- [ ] Llamadas HTTP centralizadas en clientes de API tipados.
- [ ] Respuestas externas validadas con esquemas en runtime.
- [ ] Filtros y paginación almacenados en Search Params de la URL.
- [ ] Cero cascadas de peticiones (*waterfalls*) evitables.

### Experiencia de Usuario & Accesibilidad
- [ ] Diseñados los 4 estados: Loading (skeleton), Error, Empty y Success.
- [ ] Navegación 100% operable mediante teclado con foco visible.
- [ ] Cumplimiento de estándares de contraste y HTML semántico (WCAG 2.2 AA).

### Rendimiento & Seguridad
- [ ] Bundle de JavaScript cliente mínimo.
- [ ] Imágenes y fuentes optimizadas con las utilidades nativas de Next.js.
- [ ] Cero inyecciones de HTML no sanitizadas.
- [ ] La UI no asume autoridad de seguridad (el backend valida permisos).

---

## 138. Catálogo de Antipatrones en Next.js Frontend

| Código | Antipatrón | Riesgo e Impacto Técnico |
| :--- | :--- | :--- |
| ⚠️ **NEXT-FE-01** | `'use client'` en toda la app | Pérdida total de los beneficios de Server Components; bundle gigante. |
| ⚠️ **NEXT-FE-02** | Fetching exclusivo con `useEffect` | Retrasos en cascada en el cliente y spinners de carga innecesarios. |
| ⚠️ **NEXT-FE-03** | Context como store universal | Re-renderizados masivos e innecesarios de todo el árbol de componentes. |
| ⚠️ **NEXT-FE-04** | Zustand/Redux por moda | Complejidad de estado global injustificada para datos del servidor. |
| ⚠️ **NEXT-FE-05** | Estado duplicado en múltiples cachés | Inconsistencias graves donde la UI muestra datos desincronizados. |
| ⚠️ **NEXT-FE-06** | `fetch` disperso en la UI | Imposibilidad de actualizar contratos, URLs o cabeceras de forma unificada. |
| ⚠️ **NEXT-FE-07** | Confianza ciega en tipos externos | Crashes en runtime cuando el backend altera un tipo sin previo aviso. |
| ⚠️ **NEXT-FE-08** | DTOs filtrados por toda la UI | Acoplamiento extremo entre la base de datos remota y los componentes visuales. |
| ⚠️ **NEXT-FE-09** | Layouts gigantes (God Layouts) | Bloqueo de navegación y re-renders pesados en cada cambio de ruta. |
| ⚠️ **NEXT-FE-10** | Proveedores en la raíz sin necesidad | Desperdicio de recursos envolviendo rutas que no consumen ese contexto. |
| ⚠️ **NEXT-FE-11** | `/components` como vertedero global | Pérdida de cohesión y dificultad para identificar dependencias de features. |
| ⚠️ **NEXT-FE-12** | `/utils` con cientos de helpers | Archivos comodín desorganizados que acumulan código muerto. |
| ⚠️ **NEXT-FE-13** | `useMemo` / `useCallback` preventivo | Código ilegible y overhead innecesario sin mejoras reales de rendimiento. |
| ⚠️ **NEXT-FE-14** | Lazy loading indiscriminado | Waterfalls de red y micro-parpadeos que degradan la experiencia de uso. |
| ⚠️ **NEXT-FE-15** | Ignorar el análisis de bundles | Crecimiento descontrolado del JavaScript descargado por el navegador. |
| ⚠️ **NEXT-FE-16** | Imágenes sin dimensiones fijas | Saltos de diseño repentinos que arruinan la métrica CLS. |
| ⚠️ **NEXT-FE-17** | Scripts de terceros bloqueantes | Bloqueo del hilo principal del navegador disparando la métrica INP. |
| ⚠️ **NEXT-FE-18** | `dangerouslySetInnerHTML` crudo | Puerta abierta a vulnerabilidades críticas de Cross-Site Scripting (XSS). |
| ⚠️ **NEXT-FE-19** | Secretos en `NEXT_PUBLIC_*` | Filtración de credenciales privadas accesibles desde las herramientas de desarrollador. |
| ⚠️ **NEXT-FE-20** | Confiar en roles de la interfaz | Brechas de seguridad graves asumiendo que ocultar un botón protege la acción. |
| ⚠️ **NEXT-FE-21** | ARIA para parchar HTML no semántico | Confusión en lectores de pantalla y accesibilidad defectuosa. |
| ⚠️ **NEXT-FE-22** | Diseñar solo el "Happy Path" | Pantallas en blanco cuando la API falla o devuelve colecciones vacías. |
| ⚠️ **NEXT-FE-23** | Ignorar la navegación por teclado | Exclusión de usuarios que navegan mediante tecnologías asistivas o teclado. |
| ⚠️ **NEXT-FE-24** | SEO añadido como parche al final | Arquitecturas cliente que no pueden indexarse correctamente en motores de búsqueda. |
| ⚠️ **NEXT-FE-25** | Optimizar sin mediciones reales | Tiempo desperdiciado en micro-optimizaciones que no mueven las métricas de negocio. |

---

## 139. Indicadores Clave de Desempeño (KPIs)

| Métrica de Rendimiento y Calidad | Meta en Producción |
| :--- | :--- |
| **Secretos expuestos en código cliente o `NEXT_PUBLIC_*`** | **0** |
| **Páginas públicas con `'use client'` injustificado** | **0** |
| **Llamadas a APIs externas sin manejo controlado de error** | **0** |
| **Contratos remotos críticos sin validación en runtime (Zod)** | **0** |
| **Fuentes de estado de servidor duplicadas** | **0** |
| **Páginas indexables sin metadatos o sin título único** | **0** |
| **Interacciones de usuario inaccesibles por teclado** | **0** |
| **Imágenes con contenido informativo sin atributo `alt`** | **0** |
| **Errores de cliente sin capturar en herramientas de observabilidad** | **0** |
| **Core Web Vitals en estado "Pobre" en producción** | **0** |
| **Dependencias sin justificación operativa** | **0** |
| **Builds (`next build`) fallidos en rama principal** | **0** |

---

## 140. Protocolo Senior de Diseño (Checklist Previo al Desarrollo)

Antes de programar una nueva pantalla o componente interactivo, responder:
1. ¿A qué feature de negocio pertenece y qué problema resuelve?
2. ¿Es contenido que puede renderizarse en el servidor o requiere interacción del cliente?
3. ¿Necesita verdaderamente `'use client'` o puede resolverse con una isla pequeña?
4. ¿Dónde debe vivir el estado (URL, Servidor, Local o Global)?
5. ¿Quién es el dueño del estado remoto y cómo se revalida?
6. ¿Qué ocurre si la API externa tarda 5 segundos en responder?
7. ¿Qué ocurre si la API devuelve una lista vacía o un código de error 500?
8. ¿Qué partes de la interfaz pueden servirse de inmediato con streaming?
9. ¿La pantalla requiere un límite explícito de `<Suspense>`?
10. ¿Cuánto JavaScript nuevo añade esta funcionalidad al bundle del cliente?
11. ¿Se puede completar toda la interacción utilizando únicamente el teclado?
12. ¿Los elementos respetan la jerarquía y semántica del estándar HTML?
13. ¿Requiere indexación en buscadores? ¿Tiene título y descripción únicos?
14. ¿Afecta negativamente las métricas LCP, INP o CLS?
15. ¿Cómo se comporta en pantallas táctiles y dispositivos móviles?
16. ¿Se está exponiendo algún dato sensible o secreto al navegador?
17. ¿Cómo se monitorea y alerta si esta pantalla falla en producción?
18. ¿Cómo se comprueban automatizadamente los caminos de error?

---

## 141. Matriz de Decisión de Herramientas y Patrones

| Necesidad de la Interfaz | Solución Primaria Recomendada |
| :--- | :--- |
| **Renderizado inicial y SEO** | Server Components (RSC) nativos. |
| **Estado local simple** | `useState` / `useReducer`. |
| **Filtros, tabs y paginación** | Search Params en la URL (`useSearchParams` / `nuqs`). |
| **Interactividad y eventos** | Client Components aislados (`'use client'`). |
| **Datos asíncronos iniciales** | Server Component con `fetch` directo. |
| **Polling y revalidación en foco** | SWR / TanStack Query en el cliente. |
| **UI compartida persistente** | `layout.tsx` anidados. |
| **Feedback de carga a nivel de ruta** | `loading.tsx`. |
| **Carga parcial diferida** | `<Suspense fallback={<Skeleton />}>`. |
| **Captura de errores inesperados** | `error.tsx` con botón de reset. |
| **Rutas inexistentes** | `not-found.tsx`. |
| **Metadatos y Open Graph** | Metadata API (`export const metadata`). |
| **Imágenes de alto rendimiento** | `next/image` con tamaños y formatos modernos. |
| **Tipografía sin layout shift** | `next/font`. |
| **Monitorización de métricas reales** | `useReportWebVitals()`. |

---

## 142. Cheat Sheet — Las 30 Reglas de Oro

1. Next.js en el frontend no es la capa de base de datos ni el backend de negocio.
2. Server Components primero; adopta el paradigma Server-First.
3. Reserva `'use client'` exclusivamente para islas donde exista interacción real.
4. Organiza la aplicación por features de negocio a medida que crezca.
5. Mantén la carpeta `app/` enfocada en enrutamiento, layouts y composición.
6. Centraliza los contratos de API y nunca disperses llamadas `fetch` directas.
7. Valida respuestas remotas críticas con esquemas en runtime (Zod).
8. Separa el DTO remoto del View Model de presentación cuando aporte claridad.
9. Resuelve el estado en la URL antes de recurrir a estados globales.
10. Usa estado local antes de instalar gestores como Zustand o Redux.
11. No dupliques el estado del servidor en múltiples cachés del cliente.
12. Nunca uses `useEffect` para derivar datos que pueden calcularse en el render.
13. Erradica las cascadas de peticiones asíncronas (*waterfalls*) con `Promise.all`.
14. Aísla componentes lentos mediante `<Suspense>`.
15. Diseña los cuatro estados visuales: Loading, Empty, Error y Success.
16. Minimiza y audita continuamente el JavaScript enviado al cliente.
17. Mide el impacto en bundles con `@next/bundle-analyzer`.
18. Monitorea métricas Core Web Vitals en usuarios reales (RUM).
19. Usa etiquetas semánticas de HTML antes de inventar componentes con `<div>`.
20. Toda interacción crítica debe poder completarse íntegramente con el teclado.
21. El SEO es parte integral de la arquitectura frontend, no un agregado posterior.
22. Define títulos y descripciones únicas con la Metadata API.
23. Optimizar imágenes y fuentes es una decisión de arquitectura, no un detalle cosmético.
24. Jamás coloques claves secretas en variables `NEXT_PUBLIC_*`.
25. La autorización visual es para UX; el backend es quien impone la seguridad real.
26. Sanitiza rigurosamente cualquier HTML externo antes de insertarlo en el DOM.
27. No instales paquetes npm por pereza de escribir diez líneas de código nativo.
28. Aplica KISS y YAGNI antes de diseñar abstracciones sofisticadas.
29. Escribe pruebas automatizadas para los estados de error y no solo para el camino feliz.
30. La mejor interfaz de usuario es la más simple que sigue siendo rápida, accesible y transparente.

---

## 143. Regla Rectora de Fronteras

El frontend debe preservar cuatro fronteras nítidas:
```text
ROUTING & COMPOSITION (app/)
  ↓
PRESENTATION & INTERACTION (UI Components & Client Islands)
  ↓
FRONTEND STATE & DATA ORCHESTRATION (Search Params, View Models, Mappers)
  ↓
REMOTE BACKEND CONTRACT (Centralized API Client & Schema Validation)
```
Sin mezclarlas con lógica de negocio autoritativa, consultas SQL directas ni gestión de estado transaccional dentro de Next.js.

---

## 144. Resultado Esperado

Una aplicación desarrollada bajo la especificación **SKL-NEXT-FRONTEND-001** es:
- **Server-first & Island-driven.**
- **Feature-oriented & Component-driven.**
- **Accesible (WCAG 2.2 AA) & Keyboard-navigable.**
- **SEO-optimized & Metadata-aware.**
- **Responsive & Mobile-first.**
- **Type-safe con TypeScript estricto.**
- **Contract-aware con validación en runtime.**
- **State-disciplined (URL-first).**
- **Bundle-conscious & Web Vitals-optimized.**
- **Observable, resiliente y segura por diseño.**

> **Objetivo Final:** Construir un frontend en Next.js cuya arquitectura priorice la experiencia del usuario y la Web Platform: enviar al navegador únicamente el JavaScript estrictamente necesario, mantener el estado en el lugar correcto, consumir contratos remotos de forma segura, garantizar accesibilidad universal y permitir que la interfaz evolucione con agilidad sin desbordar las responsabilidades del backend.
