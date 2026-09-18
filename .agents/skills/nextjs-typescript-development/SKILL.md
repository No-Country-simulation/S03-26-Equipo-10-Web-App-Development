# Especificación Técnica de Habilidad: Next.js con TypeScript

**Código de Skill:** SKL-JS-002 | **Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Desarrollo Fullstack con Next.js & TypeScript** |
| **Objetivo de Dominio** | Capacitar al usuario para construir aplicaciones web de alto rendimiento utilizando el **App Router**, priorizando Server Components, Server Actions y una arquitectura desacoplada de la infraestructura. |
| **Tipo de Proyecto** | Aplicaciones Web Escalables, E-commerce de alto rendimiento, SaaS y Dashboards corporativos. |
| **Complejidad** | **Alta** (Dominio de renderizado híbrido: RSC, SSR, SSG e ISR). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Next.js** en 2026 no se limita a "hacer sitios web"; es la orquestación de **React Server Components (RSC)** y lógica de servidor integrada. Se basa en el principio de **"Seguridad por Diseño"**, donde el cliente y el servidor están claramente delimitados pero tipados bajo un contrato común.

- **Modularidad:** Separación de la lógica de negocio (Core) de los componentes de UI y de los Server Actions (Infrastructure).
- **Idempotencia:** Especialmente crítica en **Server Actions** para evitar mutaciones duplicadas mediante el uso de tokens de optimismo y validación en DB.
- **Reusabilidad:** Creación de *Atomic Components* y *Hooks* de dominio que no dependen de la implementación del servidor.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Implementación de **Boundary Errors** y **Suspense** para fallos elegantes en la UI. Uso de `retry` en peticiones de datos críticas.
- **Trazabilidad:** Inyección de **Correlation IDs** en los headers de Server Actions para vincular acciones del cliente con logs del servidor (Pino).
- **Confiabilidad:** Uso de **Stale-While-Revalidate (SWR)** e **ISR** para garantizar disponibilidad incluso si la fuente de datos falla momentáneamente.
- **Métricas de Éxito:** Monitoreo estricto de **Core Web Vitals** (LCP, CLS, INP) y tiempos de ejecución en el Edge.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Configurar un entorno con **App Router** y tipado estricto (`tsconfig` con `noImplicitAny`).
- **[RF-02]:** Implementar **Server Actions** validados con **Zod** para todas las mutaciones de datos.
- **[RF-03]:** Gestionar el estado global mediante patrones nativos (URL state, React Context) o librerías ligeras (Zustand).
- **[RF-04]:** Integración de persistencia *type-safe* mediante **Drizzle ORM** o Prisma.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Rendimiento:** Tiempo de carga inicial (LCP) inferior a **1.2s** en redes 4G.
- **[RNF-02] Seguridad:** Implementación de CSP (Content Security Policy) y validación de sesiones en el Middleware.
- **[RNF-03] SEO:** Generación dinámica de metadatos y sitemaps basada en el dominio.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El sistema no expone lógica de negocio en componentes de cliente (`'use client'`).
2. **Resiliencia:** La aplicación maneja estados de carga y error sin "romper" la experiencia del usuario (Uso de `loading.tsx` y `error.tsx`).
3. **Calidad Técnica:** Paso de linter de Next.js y 0 errores de TypeScript en el build de producción.
4. **Autonomía:** El desarrollador puede desplegar una versión optimizada en Vercel o Docker con variables de entorno protegidas.

---

## 5. Ecosistema de Herramientas (Stack)

- **Framework:** Next.js 15+ (App Router).
- **Lenguaje:** TypeScript (Strict Mode).
- **Estilos:** Tailwind CSS + Shadcn UI (Radix UI).
- **Validación & ORM:** Zod + Drizzle ORM.
- **Testing:** Vitest (Unitario) + Playwright (E2E).
- **Observabilidad:** Pino (Logs) + Vercel Analytics.

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** Crear el proyecto con `npx create-next-app@latest` habilitando TS, Tailwind y ESLint. Configurar alias de rutas (`@/core`, `@/ui`).
2. **Fase de Construcción:**
    - Definir entidades y esquemas Zod en `/src/core`.
    - Implementar Server Components para el fetching de datos (I/O).
    - Crear Server Actions para la lógica de escritura.
3. **Fase de Refactor:** Optimizar componentes de cliente pesados, moviendo lógica al servidor y usando `dynamic imports` donde sea necesario.
4. **Fase de QA:** Auditoría con Lighthouse y ejecución de tests E2E con Playwright para flujos críticos (Login, Checkout).

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Usar `'use client'` en la raíz de la aplicación o en componentes que no requieren interactividad.
- ⚠️ **[Antipatrón 2]:** Fetching de datos con `useEffect` en el cliente (pérdida de beneficios de SSR/RSC).
- ⚠️ **[Antipatrón 3]:** No validar los inputs en los Server Actions (vulnerabilidad crítica de seguridad).
- ⚠️ **[Antipatrón 4]:** Almacenar secretos (API Keys) en variables de entorno sin el prefijo adecuado o exponerlas al cliente accidentalmente.

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Lighthouse Score** | > 90 en todas las categorías |
| **Build Time** | < 3 minutos en CI |
| **Type Coverage** | 100% (Prohibido el uso de `any`) |
| **Error Rate** | < 1% de sesiones con errores 500 |

---

## 9. Recursos Adicionales

- [Next.js Official Documentation (Learn Course)](https://nextjs.org/learn)
- [TypeScript for React Developers](https://react-typescript-cheatsheet.netlify.app/)
- [Drizzle ORM Docs](https://orm.drizzle.team/)
