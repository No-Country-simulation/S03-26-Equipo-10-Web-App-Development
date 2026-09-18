---
name: css-architecture-engineering
description: >-
  Diseño, estructuración, implementación y evolución profesional de arquitecturas CSS escalables (código SKL-FE-CSS-001). Usar cuando se requiera gobernar la cascada (@layer, especificidad controlada, :where, @scope), diseñar Design Tokens (primitivos, semánticos, de componente), maquetar con Flexbox/Grid/Subgrid, implementar diseño responsivo e intrínseco (Container Queries), theming (dark mode, prefers-color-scheme) y accesibilidad WCAG (:focus-visible, prefers-reduced-motion, forced-colors) en Next.js 15, Tailwind CSS y Radix UI.
---

# SKL-FE-CSS-001: Senior CSS Architecture, Design Systems & Styling Engineering

```text
====================================================================================================
ESPECIFICACIÓN TÉCNICA DE HABILIDAD: SKL-FE-CSS-001
Senior CSS Architecture, Design Systems & Styling Engineering — Versión 2.0.0
Estándares: CSS Specifications (W3C) | WCAG 2.2 AA | ISO/IEC 25010 | Agile Definition of Done
Host Monorepo: @testimonial-cms/web (Next.js 15.5+ App Router, React 18/19, Tailwind CSS, Radix UI)
Design Tokens & Theming: Editorial/Brutalist HSL/OKLCH, next-themes, tokens.css, themes.css, globals.css
Responsable: Facundo Nicolás González
Dominio: CSS / Frontend Architecture / Design Systems / Responsive UI / Accessibility
====================================================================================================
```

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Código de Skill** | `SKL-FE-CSS-001` |
| **Nombre de Habilidad** | Senior CSS Architecture, Design Systems & Styling Engineering |
| **Versión** | `2.0.0` |
| **Nivel Objetivo** | Senior / Production Engineering / Lead |
| **Habilidad Principal** | Diseño, estructuración, implementación y evolución profesional de arquitecturas CSS escalables |
| **Objetivo de Dominio** | Construir sistemas visuales mantenibles, reutilizables, accesibles, responsivos e inmunes a guerras de cascada |
| **Tecnología Principal** | CSS moderno (Cascade Layers `@layer`, Container Queries `@container`, Subgrid, CSS Color 4/HSL, Custom Properties) |
| **Host Application** | `@testimonial-cms/web` (Next.js 15 App Router, React 18/19, Tailwind CSS v3, Radix UI, CVA, `next-themes`) |
| **Arquitecturas Compatibles** | Cascade Layers (`@layer`) + Design Tokens + Utility-First + CSS Modules + CVA Component APIs |
| **Modelo de Diseño** | Primitive Tokens $\longrightarrow$ Semantic Tokens $\longrightarrow$ Component Tokens $\longrightarrow$ Layout $\longrightarrow$ Utilities |
| **Control de Cascada** | `@layer reset, tokens, base, layout, components, utilities, overrides` + baja especificidad + `:where()` |
| **Responsive Strategy** | Intrinsic Design (`minmax`, `clamp`) + Container Queries (`@container`) + Media Queries (`@media`) |
| **Layouts Especializados**| CSS Grid + `grid-template-rows: subgrid` (Wall of Love / Muro de Testimonios) + Flexbox unidimensional |
| **Tematización** | Tokens HSL (Editorial/Brutalista: Terracotta `14 74% 54%`, Obsidian `0 0% 4%`, Oatmeal `44 33% 94%`, `--radius: 0rem`) |
| **Accesibilidad** | WCAG 2.2 AA + `:focus-visible` con Terracotta ring + `prefers-reduced-motion` + `forced-colors` |
| **Prioridad Arquitectónica**| **Correctitud $\longrightarrow$ Accesibilidad $\longrightarrow$ Predictibilidad $\longrightarrow$ Reutilización $\longrightarrow$ Mantenibilidad $\longrightarrow$ Rendimiento** |

---

## 2. Filosofía de Diseño

En el monorepo `@testimonial-cms`, CSS no es tratado como simple *"decoración estética de HTML"*, sino como:
```text
Un sistema declarativo
+
Una cascada gobernada
+
Un sistema formal de constraints
+
Una API visual para el diseño y los widgets embebibles
```

La arquitectura asume separaciones conceptuales claras:
```text
CSS ≠ Design System
CSS ≠ Component Architecture
CSS ≠ HTML semantics
CSS ≠ Application State
```
Aunque estas capas interactúan continuamente en `@testimonial-cms/web`, cada una posee responsabilidades y ciclos de cambio independientes.

### 2.1. Principio Rector
El CSS debe expresar reglas visuales predecibles con el **menor acoplamiento posible** entre estructura, componente, contexto de contenedor y estado.

> [!TIP]
> **La pregunta Senior no es:** *¿Cómo hago que este testimonio o widget se vea bien en mi pantalla local?*  
> **Sino:** *¿Cómo hago que se vea perfecto en un sidebar de 280px, en un modal de 550px o en una landing de 1200px, sin romper otra vista, sin elevar la especificidad, sin recurrir a `!important`, sin duplicar código y permitiendo que el cliente personalice el tema mediante variables CSS?*

### 2.2. CSS es un Sistema de Cascada Soberano
La cascada de CSS determina el valor final de una propiedad calculando sucesivamente:
```text
1. Origin (User Agent, User, Author)
   ↓
2. Importance (!important)
   ↓
3. Cascade Layer (@layer)
   ↓
4. Specificity (IDs, Clases/Atributos/Pseudo-clases, Elementos)
   ↓
5. Scoping Proximity (@scope)
   ↓
6. Source Order (Orden de aparición en el archivo compilado)
```
La especificidad solo entra en juego después de resolver origen, importancia y capa de cascada.
Por lo tanto:
$$\text{Arquitectura CSS} \neq \text{Ganar guerras de especificidad con selectores kilométricos}$$
Una arquitectura profesional evita que esas guerras siquiera aparezcan mediante capas explícitas y selectores planos.

---

## 3. Principios Arquitectónicos

La Skill optimiza simultáneamente:
```text
Low Coupling ─────── High Cohesion
Low Specificity ──── Predictable Cascade
Explicit Ownership ── Reusability
Accessibility ────── Responsive Behavior
Themeability ─────── High Performance
```

### 3.1. SOLID Aplicado a CSS en `@testimonial-cms`

#### SRP — Single Responsibility Principle
Separar estrictamente:
- Disposición externa (*Layout*): Margen exterior, ancho en la cuadrícula, gap.
- Apariencia del componente (*Component Appearance*): Padding interno, borde, fondo, radio.
- Variaciones y estados (*State / Modifiers*): Active, hover, focus-visible, loading.
- Utilidades atómicas transversales (*Utilities*): Ocultamiento accesible, alineación tipográfica.
- Asignación de variables de tema (*Theme*): Mapeo de tokens a variables HSL.

```css
/* ❌ Malo: La tarjeta de testimonio decide su apariencia Y su ubicación global */
.testimonial-card {
  margin: 40px auto;
  max-width: 60rem;
  background: #f7f5f0;
  border: 1px solid #000;
  display: flex;
}

/* ✅ Bueno: La tarjeta de testimonio solo gobierna su interior y tokens */
.testimonial-card {
  display: flex;
  flex-direction: column;
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
  padding: var(--space-card, 1.5rem);
  border-radius: var(--radius, 0rem);
}

/* El layout padre (muro o dashboard) gobierna la distribución externa */
.wall-of-love-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  gap: var(--space-grid, 1.5rem);
  max-inline-size: 80rem;
  margin-inline: auto;
}
```

### 3.2. Open/Closed Principle
Un componente de testimonio o botón debe admitir variantes de diseño mediante variables o modificadores sin alterar sus reglas estructurales internas:
```css
/* ✅ Extensible mediante tokens de componente */
.btn-editorial {
  --btn-bg: hsl(var(--primary));
  --btn-fg: hsl(var(--primary-foreground));
  --btn-border: hsl(var(--border));

  background: var(--btn-bg);
  color: var(--btn-fg);
  border: 1px solid var(--btn-border);
  padding-inline: 1.25rem;
  padding-block: 0.625rem;
  border-radius: var(--radius, 0rem);
  font-weight: 600;
  transition: transform 0.15s ease, background-color 0.15s ease;
}

.btn-editorial[data-variant="secondary"] {
  --btn-bg: hsl(var(--secondary));
  --btn-fg: hsl(var(--secondary-foreground));
}

.btn-editorial[data-variant="outline"] {
  --btn-bg: transparent;
  --btn-fg: hsl(var(--foreground));
}
```

### 3.3. Dependency Inversion Principle
Los componentes deben depender de abstracciones visuales (tokens semánticos de `@testimonial-cms`) y no de valores hexadecimales físicos hardcodeados:
```css
/* ❌ Acoplado a valores físicos arbitrarios */
.testimonial-badge {
  background: #E05A36;
  color: #F7F5F0;
  border-radius: 0px;
}

/* ✅ Invertido hacia tokens semánticos del sistema */
.testimonial-badge {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-radius: var(--radius, 0rem);
}
```

---

## 4. Descubrimiento de Contexto en `@testimonial-cms`

Configuración arquitectónica del frontend:
```text
PROJECT_TYPE=saas-dashboard-and-public-widgets
FRAMEWORK=Next.js 15 (App Router, Server Components + Client Islands)
HOST_APP=@testimonial-cms/web
DESIGN_SYSTEM=Editorial/Brutalist Custom Tokens + Tailwind CSS + Radix UI
THEMING=light + dark (gestionado con next-themes en globals.css y themes.css)
COLOR_SYSTEM=HSL (Transicionable a OKLCH para máxima fidelidad perceptiva)
PRIMARY_ACCENT=Terracotta (hsl(14 74% 54%))
BACKGROUND_PALETTE=Cream/Oatmeal (hsl(44 33% 94%)) / Deep Obsidian (hsl(0 0% 4%))
GEOMETRY=Sharp Brutalist (border-radius: 0rem)
LAYOUT_ENGINE=CSS Grid con Subgrid + Flexbox + Container Queries
ACCESSIBILITY_LEVEL=WCAG 2.2 AA (:focus-visible + prefers-reduced-motion)
```

---

## 5. Estrategia de Estilos en el Monorepo

En `@testimonial-cms/web`, la arquitectura de estilos se organiza en tres niveles cooperativos:

```text
┌────────────────────────────────────────────────────────────────────────┐
│ 1. Foundations & Tokens Layer (tokens.css & themes.css)               │
│    Variables HSL/OKLCH en :root y .dark (paleta editorial brutalista)  │
├────────────────────────────────────────────────────────────────────────┤
│ 2. Base & Utility Engine (globals.css & Tailwind CSS)                  │
│    @tailwind base, components, utilities con reset y animaciones       │
├────────────────────────────────────────────────────────────────────────┤
│ 3. Component & Layout Layer (components/ui/ & features/)               │
│    Radix UI primitives estilizadas con CVA, Container Queries y Grid  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 6. Arquitectura de Cascada con `@layer` en Next.js 15

Declarar el orden explícito de precedencia en la raíz del sistema de estilos (`apps/web/src/app/globals.css`):

```css
@layer reset, tokens, base, layout, components, utilities, overrides;

@layer reset {
  *, *::before, *::after {
    box-sizing: border-box;
    margin: 0;
  }
}

@layer tokens {
  :root {
    --radius: 0rem;
    --font-sans: var(--font-inter), system-ui, sans-serif;
  }
}

@layer base {
  body {
    background-color: hsl(var(--background));
    color: hsl(var(--foreground));
    font-family: var(--font-sans);
  }
}

@layer layout {
  .container-page {
    inline-size: 100%;
    max-inline-size: 80rem;
    margin-inline: auto;
    padding-inline: 1.5rem;
  }
}

@layer components {
  /* Componentes con especificidad plana y predecible */
}

@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
}

@layer overrides {
  /* Excepciones de integración con widgets embebidos */
}
```

Las Cascade Layers garantizan que una regla dentro de `@layer utilities` o de Tailwind venza siempre a una regla de `@layer components`, **sin importar la especificidad interna de sus selectores**.

---

## 7. Regla de Oro de la Cascada

> **Preferencia Absoluta:** Orden y capas explícitas (`@layer`) frente a competir por quién escribe el selector más largo o abusar de `!important`.

### 7.1. Uso de `!important` en `@testimonial-cms`
`!important` está reservado exclusivamente para:
1. Utilidades contractuales inmutables (p. ej., `.hidden { display: none !important; }`).
2. Silenciamiento estricto de animaciones para usuarios con `prefers-reduced-motion: reduce`.
3. Integración forzada con estilos externos inyectados por scripts de terceros.
*Queda prohibido utilizar `!important` para resolver problemas cotidianos de especificidad entre componentes locales.*

---

## 8. Estrategia de Baja Especificidad

Mantener el presupuesto de especificidad (*specificity budget*) lo más bajo y plano posible:

```css
/* ❌ Malo: Especificidad alta, atada al árbol DOM de Next.js */
body div#__next main.dashboard-page section.testimonials-section div.card-wrapper div.card h3.author-name {
  font-size: 1.125rem;
}

/* ✅ Bueno: Selector de clase única con especificidad mínima */
.testimonial-card__author {
  font-size: 1.125rem;
  font-weight: 700;
}
```

---

## 9. Ajuste de Especificidad con `:where()`

`:where()` posee siempre especificidad **cero**:
```css
/* Estilo base para elementos en componentes de Radix UI con especificidad 0 */
:where(.prose-editorial) p {
  line-height: 1.6;
  margin-block-end: 1rem;
}
```
Permite que cualquier clase utilitaria de Tailwind (`mb-0`, `leading-tight`) sobrescriba el estilo base sin esfuerzo ni colisiones.

---

## 10. Agrupación con `:is()`

Reduce la repetición de selectores complejos adoptando la especificidad del selector más pesado:
```css
.testimonial-card :is(h2, h3, h4) {
  font-family: var(--font-display, serif);
  letter-spacing: -0.02em;
}
```

---

## 11. Selectores Relacionales con `:has()` en Formularios y Tarjetas

Permite que el contenedor reaccione al estado de sus hijos sin necesidad de listeners de JavaScript:
```css
/* Resaltar la tarjeta de testimonio si contiene una calificación de 5 estrellas */
.testimonial-card:has(.rating-stars[data-score="5"]) {
  border-inline-start: 4px solid hsl(var(--primary));
}

/* Aplicar borde Terracotta al formulario de captura si hay un campo con foco */
.testimonial-form:has(input:focus-visible, textarea:focus-visible) {
  outline: 2px solid hsl(var(--ring));
}
```

---

## 12. Encapsulación con `@scope`

En navegadores compatibles, delimitar el alcance de los estilos de un widget de testimonio embebido:
```css
@scope (.testimonial-embed) to (.testimonial-embed__footer) {
  p {
    font-size: 1rem;
    color: hsl(var(--card-foreground));
  }
  a {
    color: hsl(var(--primary));
    text-decoration: underline;
  }
}
```

---

## 13. Metodología BEM en Componentes Centrales

Para componentes CSS fuera de Tailwind:
```css
.testimonial-card {}                     /* Bloque */
.testimonial-card__header {}             /* Elemento */
.testimonial-card__avatar {}             /* Elemento */
.testimonial-card__quote {}              /* Elemento */
.testimonial-card--featured {}           /* Modificador */
```

### 13.1. No Sobrecargar BEM
Evitar duplicar la estructura del DOM en las clases:
- ❌ `.dashboard__content__testimonials__card__author__avatar {}`
- ✅ `.testimonial-card__avatar {}`

---

## 14. CSS Modules en Next.js 15

Utilizar CSS Modules (`*.module.css`) cuando un componente complejo requiera estilos encapsulados sin fugas globales:
```css
/* TestimonialWall.module.css */
.wallGrid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 1.5rem;
}

.featuredCard {
  grid-column: span 2;
}
```

---

## 15. Utility-First Pragmatic (Tailwind en `@testimonial-cms`)

Tailwind CSS v3 provee la base utilitaria en `@testimonial-cms/web`.
- **Regla:** Utilizar utilidades de Tailwind para espaciado, flex/grid y tipografía.
- **Cuándo extraer a CSS puro:** Extraer a CSS Custom Properties y clases base cuando aparezcan:
  1. Patrones repetidos en widgets embebibles de clientes.
  2. Uso de CSS Subgrid para alinear tarjetas de testimonios.
  3. Container Queries complejas en componentes desacoplados del viewport.

---

## 16. ITCSS / CUBE CSS para la Organización Global

Organizar los archivos en `apps/web/src/styles/`:
```text
Settings   ──> tokens.css (escalas HSL, fuentes, espaciados primitivos)
Themes     ──> themes.css (variables para light, dark y personalizadas)
Base       ──> globals.css (@tailwind base, resets, estilos del body)
Components ──> UI Primitives en components/ui/ (CVA + Radix UI)
Utilities  ──> @tailwind utilities y animaciones (.animate-fade-in-up)
```

---

## 17. Matriz de Decisión de Estilos en `@testimonial-cms`

| Caso de Uso en el Proyecto | Estrategia Técnica Recomendada |
| :--- | :--- |
| **Componentes UI base (Button, Input, Dialog)** | Radix UI + CVA + Tailwind (`components/ui/`) |
| **Widgets Embebibles de Testimonios (Embed Wall)**| Container Queries (`@container`) + CSS Component Tokens |
| **Muro de Testimonios (Wall of Love)** | CSS Grid + `grid-template-rows: subgrid` |
| **Theming (Modo Claro / Modo Oscuro)** | Variables HSL en `tokens.css` / `themes.css` + `next-themes` |
| **Animaciones de Entrada (Cards, Alerts)** | Clases utilitarias con soporte a `prefers-reduced-motion` |
| **Formularios de Captura de Reseñas** | Formularios accesibles reaccionando con `:has()` y `:focus-visible` |

---

## 18. Arquitectura de Design Tokens en `@testimonial-cms`

Jerarquía de tres niveles de tokens en `apps/web/src/styles/tokens.css` y `themes.css`:

```text
PRIMITIVE TOKENS (:root)
   ├── --palette-terracotta: 14 74% 54%;
   ├── --palette-obsidian: 0 0% 4%;
   ├── --palette-oatmeal: 44 33% 94%;
   ├── --palette-border-light: 0 0% 80%;
   └── --palette-border-dark: 0 0% 20%;
            │
            ▼
SEMANTIC TOKENS (:root & .dark)
   ├── --background: var(--palette-oatmeal);
   ├── --foreground: var(--palette-obsidian);
   ├── --primary: var(--palette-terracotta);
   ├── --primary-foreground: var(--palette-oatmeal);
   ├── --card: 44 20% 98%;
   ├── --border: var(--palette-border-light);
   ├── --ring: var(--palette-terracotta);
   └── --radius: 0rem;  /* Estética editorial/brutalista */
            │
            ▼
COMPONENT TOKENS (.testimonial-card)
   ├── --testimonial-bg: hsl(var(--card));
   ├── --testimonial-border: hsl(var(--border));
   ├── --testimonial-radius: var(--radius);
   ├── --testimonial-star-color: hsl(var(--primary));
   └── --testimonial-quote-color: hsl(var(--card-foreground));
```

---

## 19. CSS Component APIs con Custom Properties

Permite que los clientes que incrustan el widget de testimonios personalicen el aspecto sin modificar el HTML:

```html
<!-- Widget embebido en el sitio web de un cliente -->
<div class="testimonial-embed-container" style="--testimonial-star-color: #f59e0b; --testimonial-radius: 8px;">
  <div class="testimonial-card">...</div>
</div>
```

```css
.testimonial-card {
  background-color: var(--testimonial-bg, hsl(var(--card)));
  border: 1px solid var(--testimonial-border, hsl(var(--border)));
  border-radius: var(--testimonial-radius, var(--radius, 0rem));
  color: var(--testimonial-quote-color, hsl(var(--card-foreground)));
}

.testimonial-card .star-icon {
  color: var(--testimonial-star-color, hsl(var(--primary)));
}
```

---

## 20. Tipado Estricto de Tokens con `@property`

Permite registrar custom properties con sintaxis declarativa y valor inicial para animaciones fluidas:

```css
@property --rating-percentage {
  syntax: "<percentage>";
  inherits: false;
  initial-value: 0%;
}
```

---

## 21. Theming y Desacoplamiento en `themes.css`

El componente jamás debe verificar si el usuario está en modo oscuro; únicamente consume variables semánticas:

```css
/* apps/web/src/styles/themes.css */
:root {
  --background: 44 33% 94%;      /* Cream / Oatmeal */
  --foreground: 0 0% 4%;         /* Deep Obsidian */
  --card: 44 20% 98%;
  --card-foreground: 0 0% 4%;
  --primary: 14 74% 54%;         /* Terracotta */
  --primary-foreground: 44 33% 94%;
  --border: 0 0% 80%;
  --ring: 14 74% 54%;
  --radius: 0rem;
}

.dark {
  --background: 0 0% 4%;         /* Deep Obsidian */
  --foreground: 44 33% 94%;      /* Cream / Oatmeal */
  --card: 0 0% 8%;
  --card-foreground: 44 33% 94%;
  --primary: 14 74% 54%;         /* Terracotta vibrante */
  --primary-foreground: 0 0% 4%;
  --border: 0 0% 20%;
  --ring: 14 74% 54%;
}
```

---

## 22. Dark Mode con `next-themes` sin FOUC

Para evitar el parpadeo de contenido sin estilos (*Flash of Unstyled Content*) en Next.js 15 App Router:
1. En `apps/web/src/app/layout.tsx`:
```tsx
import { ThemeProvider } from '@/components/theme-provider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="bg-background text-foreground antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

---

## 23. Separación Estricta: Layout vs Componente

```text
┌─────────────────────────────────────────────────────────────┐
│                 PARENT LAYOUT CONTAINER                     │
│   Gobierna: Disposición en rejilla, gap, ancho máximo       │
│   Ejemplo: .wall-of-love-grid { display: grid; gap: 1.5rem;}│
└──────────────────────────────┬──────────────────────────────┘
                               │ Contiene
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    TESTIMONIAL CARD                         │
│   Gobierna: Padding interior, borde brutalista, tipografía  │
│   Ejemplo: .card { padding: 1.5rem; border: 1px solid; }    │
└─────────────────────────────────────────────────────────────┘
```

---

## 24. Patrón Stack (Flujo Vertical en Formularios)

```css
.stack-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}
```

---

## 25. Patrón Cluster (Píldoras y Tags de Testimonios)

```css
.testimonial-tags-cluster {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
```

---

## 26. Maquetación del Dashboard con CSS Grid

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: 18rem 1fr;
  min-block-size: 100vh;
}

@media (width < 64rem) {
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## 27. Maquetación Unidimensional con Flexbox

Utilizar Flexbox para barras de herramientas, encabezados de reseñas y filas de estrellas de calificación.

---

## 28. Subgrid en el Muro de Testimonios (*Wall of Love*)

En un muro de testimonios, las citas de los usuarios tienen longitudes impredecibles. Sin Subgrid, las tarjetas adyacentes quedan desalineadas verticalmente.

```css
/* Contenedor del Muro de Testimonios */
.wall-of-love {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: 1.5rem;
}

/* Cada tarjeta spannea 3 tracks: [header] [quote] [rating] */
.testimonial-card {
  display: grid;
  grid-template-rows: subgrid;
  grid-row: span 3;
  padding: 1.5rem;
  background: hsl(var(--card));
  border: 1px solid hsl(var(--border));
}

.testimonial-card__header {
  align-self: start;
}

.testimonial-card__quote {
  align-self: start;
  line-height: 1.6;
}

.testimonial-card__rating {
  align-self: end;
}
```
**Resultado:** Todos los encabezados de autor quedan alineados arriba, todos los bloques de cita ocupan el centro y todas las calificaciones de estrellas quedan perfectamente niveladas al pie de la fila, independientemente del texto.

---

## 29. Intrinsic Layout (Diseño Intrínseco)

Priorizar componentes que se adapten de forma natural al espacio disponible sin requerir media queries arbitrarias:
```css
.testimonial-gallery {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: 1.5rem;
}
```

---

## 30. Responsive Design Real en `@testimonial-cms`

Responsive no significa diseñar para iPhone 15 y MacBook Pro. Significa que la tarjeta de testimonio puede incrustarse dentro de una columna de 320px en Notion, en un modal de Shopify de 500px o en un monitor 4K sin desbordamiento horizontal.

---

## 31. Media Queries Modernas con Sintaxis de Rango

```css
@media (width >= 48rem) {
  .analytics-summary {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

---

## 32. Mobile-First como Estrategia Base

Iniciar con la columna simple y expandir con `@media (width >= ...)` para vistas amplias.

---

## 33. Container Queries (`@container`) en Widgets de Testimonios

Dado que el widget de testimonios se embebe en contextos de ancho desconocido:

```css
/* 1. Declarar el contenedor del widget como contexto de medida */
.testimonial-widget-container {
  container-type: inline-size;
  container-name: testimonial-widget;
}

/* 2. Disposición base (Mobile / Sidebar estrecho < 420px): Vertical */
.testimonial-card {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* 3. Disposición horizontal cuando el contenedor dispone de más de 420px */
@container testimonial-widget (min-width: 420px) {
  .testimonial-card {
    display: grid;
    grid-template-columns: 4rem 1fr;
    align-items: center;
  }
}

/* 4. Disposición expandida cuando el contenedor supera los 700px */
@container testimonial-widget (min-width: 700px) {
  .testimonial-card {
    grid-template-columns: 5rem 1fr auto;
    padding: 2rem;
  }
}
```

---

## 34. Jerarquía de Decisión Responsiva Senior

```text
1. Intrinsic Layout (auto-fit, minmax, flex-wrap)
      ↓ Si no es suficiente
2. Container Queries (@container: el widget responde al ancho de su contenedor)
      ↓ Si la decisión afecta la página completa
3. Media Queries (@media: layout global de la ventana y viewport)
```

---

## 35. Unidades de Container Query (`cqi`, `cqw`)

```css
.testimonial-headline {
  /* Escalar la tipografía proporcionalmente al ancho del widget */
  font-size: clamp(1.25rem, 4cqi, 2.25rem);
}
```

---

## 36. CSS Nesting Nativo

```css
.testimonial-card {
  border: 1px solid hsl(var(--border));
  border-radius: var(--radius, 0rem);

  & .author-name {
    font-weight: 700;
  }

  &:hover {
    border-color: hsl(var(--primary));
  }
}
```

### 36.1. Evitar Nesting Profundo
Limitar el anidamiento a 2 o 3 niveles máximo.

---

## 37. Logical Properties para Internacionalización

| Propiedad Física | Propiedad Lógica Equivalente | Uso en Testimonial CMS |
| :--- | :--- | :--- |
| `width` | `inline-size` | Ancho de tarjeta de testimonio |
| `height` | `block-size` | Altura de imagen de avatar |
| `margin-left` / `margin-right` | `margin-inline-start` / `margin-inline-end` | Espaciado entre avatar y nombre |
| `padding-top` / `padding-bottom`| `padding-block-start` / `padding-block-end` | Relleno vertical de tarjeta |
| `left`, `right` | `inset-inline-start`, `inset-inline-end` | Posición del badge de verificación |

---

## 38. Ejemplo RTL-Safe en el Componente de Autor

```css
/* ✅ Adaptable automáticamente a idiomas LTR y RTL */
.testimonial-author__avatar {
  inline-size: 3rem;
  block-size: 3rem;
  margin-inline-end: 0.75rem;
}
```

---

## 39. Tipografía Fluida con `clamp()`

```css
.editorial-hero-title {
  font-size: clamp(2rem, 1.5rem + 2.5vw, 4.5rem);
  line-height: 1.1;
  letter-spacing: -0.03em;
}
```

---

## 40. Espaciado Fluido

```css
.page-section {
  padding-inline: clamp(1rem, 4vw, 3rem);
  padding-block: clamp(2.5rem, 6vw, 6rem);
}
```

---

## 41. Fundamentos de Accesibilidad en `@testimonial-cms`

El CSS garantiza:
1. **Contraste mínimo WCAG 2.2 AA**: Ratio 4.5:1 para texto normal y 3:1 para textos mayores a 18pt.
2. **Navegación por Teclado**: Indicador de foco visible inequívoco.
3. **Zoom del 200% sin truncamientos ni scroll horizontal involuntario**.
4. **Soporte de reducción de movimiento y modo de colores forzados**.

---

## 42. Foco Visible Brutalista (`:focus-visible`)

> [!CAUTION]
> **Queda terminantemente prohibido:** `outline: none;` sin proveer un indicador visual de foco accesible.

```css
/* apps/web/src/app/globals.css */
*:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}
```
En la paleta brutalista de `@testimonial-cms`, `--ring` es Terracotta (`14 74% 54%`), garantizando visibilidad nítida tanto en fondo Oatmeal como en Obsidian.

---

## 43. Reducción de Movimiento (`prefers-reduced-motion`)

Gobernanza estricta de las animaciones personalizadas (`.animate-fade-in-up`, `.stagger-1..5`):

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 44. Forced Colors (Modo de Alto Contraste de Windows)

```css
@media (forced-colors: active) {
  .testimonial-card {
    /* Forzar borde visible cuando el sistema operativo anula colores de fondo */
    border: 2px solid CanvasText;
  }
  .rating-stars {
    forced-color-adjust: none;
  }
}
```

---

## 45. El Color No es el Único Indicador

Al mostrar estados de aprobación de testimonios (`approved`, `rejected`, `pending`):
- No depender únicamente de insignias verdes o rojas.
- Acompañar con texto explícito, íconos de Lucide y atributos ARIA (`aria-label="Estado: Aprobado"`).

---

## 46. Matriz de Estados de Componentes Interactivos

Para botones, inputs y tarjetas clickeables:
```text
[default] ──> [hover] ──> [focus-visible] ──> [active]
    │
    ├──> [disabled]
    ├──> [loading (aria-busy="true")]
    └──> [selected / filter-active]
```

---

## 47. Distinción: `:disabled` vs Loading

```css
/* Botón deshabilitado */
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Botón en estado de carga (mantiene foco y anuncia ocupado) */
.btn[aria-busy="true"] {
  cursor: wait;
  position: relative;
}
```

---

## 48. Diseño de Component APIs con CVA (`class-variance-authority`)

Patrón estándar para componentes en `apps/web/src/components/ui/`:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

export const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none rounded-none',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-muted hover:text-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-muted hover:text-foreground',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);
```

---

## 49. Modificadores por Contexto

No crear clases ultra-acopladas como `.dashboard-sidebar-button`. Exponer variantes en CVA (`size="sm"`, `variant="outline"`).

---

## 50. Clases Utilitarias Atómicas en `globals.css`

```css
@layer utilities {
  .text-balance {
    text-wrap: balance;
  }
  .animate-fade-in-up {
    animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    opacity: 0;
    transform: translateY(20px);
  }
  .stagger-1 { animation-delay: 100ms; }
  .stagger-2 { animation-delay: 200ms; }
  .stagger-3 { animation-delay: 300ms; }
}
```

---

## 51. DRY Aplicado Correctamente en CSS

No unificar clases de dos elementos no relacionados solo porque ambos tienen `font-size: 14px; color: grey;`. La duplicación accidental es preferible al acoplamiento artificial.

---

## 52. Principio YAGNI

No definir 25 variantes de sombras o 40 colores intermedios en Tailwind si la estética editorial de `@testimonial-cms` opera con una paleta estricta de Terracotta, Obsidian y Oatmeal con bordes nítidos.

---

## 53. Principio KISS

Preferir soluciones nativas directas (`display: grid; gap: 1.5rem;`) antes que librerías JavaScript de masonry que calculan posiciones absolutas mediante `transform: translate3d`.

---

## 54. HTML Semántico Primero

- Usar `<article>` para cada tarjeta de testimonio.
- Usar `<figure>` y `<blockquote>` para la cita textual del testimonio y `<figcaption>` para el autor.
- Usar `<button>` para filtros y formularios de recolección de reseñas.

---

## 55. CSS Reactivo a Atributos ARIA

```css
.testimonial-filter[aria-pressed="true"] {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
}
```

---

## 56. Estructura de Estilos en `@testimonial-cms/web`

```text
apps/web/src/
├── styles/
│   ├── tokens.css               # Definición de tokens primitivos y semánticos
│   └── themes.css               # Variables de tematización (Light, Dark, Brand)
├── app/
│   └── globals.css              # Directivas Tailwind, @layer base, utilidades
├── components/
│   └── ui/                      # Primitivas Radix UI + CVA (Button, Dialog, Card)
└── features/
    ├── testimonials/            # Componentes y widgets de testimonios
    ├── campaigns/               # Flujos de recolección de reseñas
    └── analytics/               # Gráficos y métricas de desempeño
```

---

## 57. Estructura Feature-Oriented

Cada feature de negocio agrupa sus componentes y estilos específicos sin ensuciar la capa global.

---

## 58. Alcance Estricto de `globals.css`

`globals.css` debe limitarse a:
- Directivas de Tailwind (`@tailwind base, components, utilities`).
- Variables de temas en `:root` y `.dark`.
- Resets y tipografía base de documento.
- Utilidades globales indispensables (`.animate-fade-in-up`, `.text-balance`).

---

## 59. Aislamiento de Estilos de Terceros

Encapsular librerías externas (p. ej., carruseles o reproductores de video de testimonios) dentro de capas:
```css
@layer vendor {
  @import "embla-carousel/embla.css";
}
```

---

## 60. Análisis de Overrides Recurrentes

Si una página necesita aplicar repetidamente `!important` o selectores anidados para cambiar el color de una tarjeta de testimonio, la solución es exponer un token de componente (`--testimonial-bg`).

---

## 61. Arquitectura de Rendimiento en CSS

Optimizar las métricas Core Web Vitals (LCP, CLS, INP):
- Minimizar el bloqueo de renderizado inicial.
- Animar exclusivamente `transform` y `opacity`.

---

## 62. Critical CSS en Next.js 15

Turbopack y Next.js inyectan automáticamente el CSS crítico asociado a cada ruta en el `<head>`.

---

## 63. CSS Code Splitting Automático

Next.js separa los bundles de CSS por ruta; no importar archivos CSS pesados en `layout.tsx` si solo se usan en un dashboard interno.

---

## 64. Optimización con `content-visibility` en Feeds de Testimonios

En muros de testimonios con cientos de reseñas:

```css
.testimonial-card-item {
  content-visibility: auto;
  contain-intrinsic-size: auto 18rem;
}
```
*Permite al navegador omitir el costo de renderizado y cálculo de estilo de las tarjetas fuera de la pantalla hasta que el usuario hace scroll cerca de ellas.*

---

## 65. Animaciones y GPU Compositing

Animar preferentemente `transform: translateY(...)` y `opacity`. Evitar transicionar `height` o `margin`.

---

## 66. Uso Restringido de `will-change`

Aplicar `will-change: transform` únicamente durante animaciones activas (p. ej., al arrastrar tarjetas en un tablero de moderación) y removerlo al terminar.

---

## 67. Prevención de Cumulative Layout Shift (CLS) en Avatares y Videos

```css
.testimonial-avatar {
  aspect-ratio: 1 / 1;
  inline-size: 3rem;
  block-size: 3rem;
  object-fit: cover;
}

.testimonial-video-wrapper {
  aspect-ratio: 16 / 9;
  inline-size: 100%;
}
```

---

## 68. Carga Optimizada de Tipografías en Next.js 15

Aprovechar `next/font/google` para descargar tipografías en build-time con `display: 'swap'`:
```typescript
import { Inter, Playfair_Display } from 'next/font/google';

export const fontSans = Inter({ subsets: ['latin'], variable: '--font-inter' });
export const fontDisplay = Playfair_Display({ subsets: ['latin'], variable: '--font-display' });
```

---

## 69. Baseline Moderno de Navegadores

A 2026, Cascade Layers, Container Queries, Subgrid y CSS Nesting forman parte del Baseline estándar interoperable en todos los navegadores principales.

---

## 70. Progressive Enhancement con `@supports`

```css
.wall-of-love {
  display: flex;
  flex-wrap: wrap;
}

@supports (display: grid) {
  .wall-of-love {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 20rem), 1fr));
  }
}
```

---

## 71. Uso Consciente de `@supports`

No añadir `@supports` redundantes para funcionalidades consolidadas en el Baseline.

---

## 72. Estrategia de Testing Visual

- Pruebas unitarias de componentes con Vitest y React Testing Library.
- Pruebas de regresión visual de widgets embebibles con Playwright.
- Auditorías automáticas de accesibilidad con Axe.

---

## 73. Matriz de Validación Visual en `@testimonial-cms`

Verificar cada componente en:
1. Contenedor de 280px (Sidebar) vs 550px (Modal) vs 1200px (Landing).
2. Testimonios con textos de 30 palabras vs 500 palabras.
3. Modo Claro (Oatmeal) vs Modo Oscuro (Obsidian).
4. Modo de movimiento reducido (`prefers-reduced-motion: reduce`).
5. Navegación exclusiva por teclado (foco visible).
6. Zoom del navegador al 200%.

---

## 74. Resiliencia ante Textos Extensos

```css
.author-title {
  overflow-wrap: break-word;
  word-break: break-word;
}
```

---

## 75. Breakpoints Basados en Contenido

Ajustar los puntos de quiebre en función de cuándo el contenido textual o visual del testimonio se degrada, no por modelos de iPhone o iPad.

---

## 76. Contrato de Componente de Design System

Documentar formalmente variantes (`default`, `outline`, `ghost`), tamaños (`sm`, `md`, `lg`) y variables CSS expuestas.

---

## 77. Linting y Formateo con Prettier y ESLint

Mantener reglas estandarizadas para evitar colisiones de formato.

---

## 78. Specificity Budget en `@testimonial-cms`

- Cero IDs (`#id`) en reglas de estilo.
- Profundidad de selectores limitada a 2 niveles.
- Prohibición de `!important` en componentes cotidianos.

---

## 79. Prohibición de Valores Mágicos

Rechazar en Pull Requests colores o márgenes arbitrarios (`margin: 17px; color: #e15530;`) fuera de la escala de tokens.

---

## 80. Métricas de Salud del CSS

Monitorear en CI el peso del CSS transferido y la ausencia de reglas `!important`.

---

## 81. Adaptación — Landing Page Pública de Testimonios

Diseño intrínseco de alto impacto estético, tipografía editorial fluida y animación de entrada `.animate-fade-in-up`.

---

## 82. Adaptación — SaaS Dashboard de Moderación

Componentes densos, tablas de revisión de testimonios con bordes nítidos (`--radius: 0rem`) y soporte total a tema oscuro.

---

## 83. Adaptación — Muro de Testimonios Embebible (*Embed Wall*)

Uso obligatorio de **Container Queries** y **Subgrid** para que el widget se incruste limpiamente en cualquier plataforma externa.

---

## 84. Adaptación — Design System Editorial/Brutalista

Consistencia geométrica en todos los controles interactivos con esquinas rectas (`--radius: 0rem`), paleta Terracotta/Obsidian/Oatmeal y anillos de foco de 2px.

---

## 85. Adaptación — Multi-Tenant Theming

Permitir que cada organización configure su propio color primario mediante una variable CSS en su portal de testimonios:
```html
<div style="--primary: 210 100% 50%;"> <!-- Tenant Azul -->
```

---

## 86. Adaptación — Componentes Embebidos en Iframes

Garantizar que los iframes de recolección de testimonios incluyan el CSS compilado mínimo con reset accesible.

---

## 87. Los 15 Antipatrones Críticos en `@testimonial-cms`

- ⚠️ **CSS-01:** Hardcodear colores hexadecimales en lugar de usar tokens semánticos `hsl(var(--primary))`.
- ⚠️ **CSS-02:** Usar Media Queries de viewport (`@media`) para componentes que se incrustan en sidebars o modales.
- ⚠️ **CSS-03:** Abusar de `!important` para sobrescribir estilos de Radix UI en lugar de atacar `@layer` o usar `:where()`.
- ⚠️ **CSS-04:** Diseñar animaciones sin respetar `prefers-reduced-motion`.
- ⚠️ **CSS-05:** Eliminar el indicador de foco (`outline: none`) en botones o enlaces de testimonios.
- ⚠️ **CSS-06:** Asignar `margin` externo al componente reutilizable en lugar de delegarlo al layout padre.
- ⚠️ **CSS-07:** Crear un masonry desalineado con JavaScript cuando CSS Subgrid resuelve la alineación vertical de citas.
- ⚠️ **CSS-08:** Utilizar exclusivamente el color para comunicar si un testimonio está aprobado o rechazado.
- ⚠️ **CSS-09:** Definir `width` fijo en píxeles provocando scroll horizontal involuntario en móviles.
- ⚠️ **CSS-10:** Anidar selectores con más de 3 niveles de profundidad.
- ⚠️ **CSS-11:** Asumir que el modo oscuro consiste únicamente en invertir blanco y negro sin ajustar el contraste.
- ⚠️ **CSS-12:** No configurar `aspect-ratio` en avatares provocando saltos de layout (CLS).
- ⚠️ **CSS-13:** Utilizar `z-index: 999999` para modales sin una escala de apilamiento gobernada.
- ⚠️ **CSS-14:** Copiar estilos globales en `globals.css` para funcionalidades exclusivas de una única pantalla.
- ⚠️ **CSS-15:** No validar la interfaz visual con zoom del navegador al 200%.

---

## 88. Definition of Done (DoD) de Estilos

Una pantalla o componente en `@testimonial-cms/web` se considera certificado cuando:
1. [ ] Colores, espaciados y tipografías utilizan exclusivamente tokens de `tokens.css` y `globals.css`.
2. [ ] La tarjeta de testimonio implementa Container Queries para adaptarse a cualquier ancho de contenedor.
3. [ ] El muro de testimonios utiliza CSS Grid y Subgrid para alinear autores, citas y calificaciones.
4. [ ] El modo oscuro (`.dark`) y claro han sido verificados visualmente con contraste WCAG 2.2 AA.
5. [ ] El indicador de foco (`:focus-visible`) es visible y accesible en todos los elementos interactivos.
6. [ ] La animación `.animate-fade-in-up` se silencia si `prefers-reduced-motion: reduce` está activo.
7. [ ] Cero advertencias de desbordamiento horizontal en pantallas estrechas.
8. [ ] Cero declaraciones `!important` injustificadas en el código.
9. [ ] La interfaz se mantiene funcional y legible con zoom de navegador al 200%.

---

## 89. KPIs Técnicos de Calidad Visual

| Indicador Técnico | Meta Objetivo | Método de Medición |
| :--- | :--- | :--- |
| **Conflictos de especificidad en componentes** | **0** | Auditoría de hojas de estilo y reviews de PR |
| **Declaraciones `!important` injustificadas** | **0** | Linting con Stylelint / ESLint |
| **Colores hardcodeados fuera de tokens** | **0** | Análisis estático de código |
| **Componentes de widget no adaptables a contenedores**| **0** | Pruebas visuales en contenedores estrechos (< 320px) |
| **Regresiones visuales en producción** | **0** | Reporte de incidentes de frontend |
| **Fallos de contraste WCAG 2.2 AA** | **0** | Auditoría automatizada con Axe / Lighthouse |
| **Desbordamiento horizontal no intencionado** | **0** | Pruebas responsivas en runners de CI |

---

## 90. Evaluación Práctica

### Escenario A — Tarjeta de Testimonio Universal
La misma tarjeta de testimonio debe renderizarse en:
- El sidebar del panel de control (280px).
- Un modal de confirmación (550px).
- Una página pública de testimonios (1200px).
*Solución:* `container-type: inline-size` sobre `.testimonial-widget-container` y `@container (min-width: 420px)` para alternar entre disposición vertical y horizontal sin media queries de viewport.

### Escenario B — Muro de Testimonios Desalineado
Testimonios de 2 líneas y de 20 líneas provocan que los avatares y las estrellas queden a alturas desparejas.
*Solución:* Maquetar con `display: grid; grid-template-rows: subgrid; grid-row: span 3;` para sincronizar los tracks de encabezado, cita y calificación en toda la fila.

### Escenario C — Theming para Clientes Externos
Un cliente que embebe el widget desea que el color de acento coincida con su marca azul sin alterar nuestro bundle.
*Solución:* El widget expone `--testimonial-star-color` y `--testimonial-primary` en su CSS Component API, permitiendo al cliente sobrescribir esas variables en el contenedor padre.

---

## 91. Cheat Sheet — Las 30 Reglas de Oro de CSS en `@testimonial-cms`

1. La cascada es un sistema: goberná la cascada con `@layer` antes de elevar la especificidad.
2. Usá `@layer base, components, utilities` para mantener jerarquía predecible con Tailwind.
3. Mantené la especificidad de los selectores baja y plana; cero identificadores `#id`.
4. Usá `:where()` para aplicar estilos base con especificidad cero.
5. El contenedor padre gobierna la posición externa y el gap; el componente gobierna su interior.
6. Todos los colores deben provenir de tokens semánticos en HSL (`hsl(var(--primary))`).
7. Respetá la jerarquía: Tokens Primitivos $\rightarrow$ Semánticos $\rightarrow$ Tokens de Componente.
8. En `@testimonial-cms`, las esquinas son brutalistas y rectas (`--radius: 0rem`).
9. El color primario del sistema es Terracotta (`14 74% 54%`).
10. La paleta de fondo alterna entre Oatmeal (`44 33% 94%`) y Deep Obsidian (`0 0% 4%`).
11. Usá Flexbox para distribuciones unidimensionales y CSS Grid para estructuras bidimensionales.
12. Usá `grid-template-rows: subgrid` en el Muro de Testimonios para nivelar filas de tarjetas.
13. Usá Container Queries (`@container`) para que los widgets se adapten a su contenedor.
14. Usá Media Queries (`@media`) exclusivamente para decisiones de layout global de página.
15. Diseñá layouts intrínsecos con `auto-fill`, `minmax` y `clamp()`.
16. Usá propiedades lógicas (`inline-size`, `margin-inline`) para asegurar soporte RTL.
17. No anides selectores a más de 2 o 3 niveles de profundidad con CSS nesting.
18. Jamás uses `!important` para resolver una discrepancia cotidiana de especificidad.
19. Diseñá y garantiza un indicador `:focus-visible` accesible con Terracotta ring.
20. Silenciá animaciones si el usuario tiene activo `prefers-reduced-motion: reduce`.
21. Soportá el modo de colores forzados (*Forced Colors*) usando `CanvasText`.
22. El color jamás debe ser el único indicador del estado de un testimonio.
23. Validá que ningún componente genere scroll horizontal no deseado en móviles.
24. Configurá `aspect-ratio` en imágenes y avatares para eliminar el CLS.
25. Descargá tipografías en build-time con `next/font` y `display: swap`.
26. Usá `content-visibility: auto` en listas extensas de testimonios para acelerar el render.
27. Exponé variables CSS de componente como API de personalización para clientes.
28. No instales librerías de JS para comportamientos que CSS moderno resuelve nativamente.
29. Verificá que la interfaz mantenga su integridad con zoom del navegador al 200%.
30. El mejor código CSS es aquel que puede evolucionar y reusarse sin miedo a romper otra pantalla del producto.

---

## 92. Árbol de Decisión de Estilos en `@testimonial-cms`

```text
¿Es un componente interactivo base (botón, input, diálogo)?
│
├── SÍ  ──> Radix UI + CVA + Tailwind en src/components/ui/
│
└── NO
    │
    ├── ¿Es un widget embebible que se usará en múltiples contextos de ancho variable?
    │      └── SÍ ──> Container Queries (@container) + CSS Component Tokens
    │
    ├── ¿Es un muro de testimonios con filas que deben alinearse verticalmente?
    │      └── SÍ ──> CSS Grid + Subgrid (grid-template-rows: subgrid)
    │
    ├── ¿Es un layout de página o dashboard?
    │      └── SÍ ──> CSS Grid bidimensional con Tailwind + breakpoints
    │
    └── ¿Es una barra de herramientas o alineación lineal?
           └── SÍ ──> Flexbox unidimensional
```

---

## 93. Resultado Esperado

Una arquitectura de estilos construida bajo la especificación técnica **`SKL-FE-CSS-001`** en `@testimonial-cms`:
- **Gobernada y Predecible:** Cascada ordenada mediante `@layer` sin colisiones con Tailwind ni Radix UI.
- **Identidad Visual Consistente:** Paleta editorial brutalista (Terracotta, Obsidian, Oatmeal) en HSL cohesiva en toda la aplicación.
- **Container-Aware:** Widgets de testimonios que se transforman fluidamente según el espacio donde se incrustan.
- **Alineación Perfecta con Subgrid:** Muros de testimonios con armonía vertical inquebrantable.
- **Accesible por Defecto:** Contraste WCAG 2.2 AA, foco visible de alto contraste y respeto estricto a las preferencias del usuario.
- **Rendimiento Óptimo:** Sin saltos de layout (CLS = 0) y renderizado acelerado por hardware.

---

## 94. Recursos y Referencias Técnicas

- **W3C CSS Specifications:** Cascade Layers (`@layer`), Container Queries (`@container`), CSS Grid Level 2 (Subgrid), CSS Color Module Level 4.
- **Next.js & React:** Next.js 15 App Router Styling, `next-themes`, React Server Components Styling.
- **Accesibilidad:** W3C Web Content Accessibility Guidelines (WCAG) 2.2 AA, WAI-ARIA Authoring Practices.
- **Herramientas de Ecosistema:** Tailwind CSS v3, Radix UI Primitives, Class Variance Authority (CVA), Tailwind Merge.
