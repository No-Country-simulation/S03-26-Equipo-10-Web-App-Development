# Especificación Técnica de Habilidad: Frontend Design Excellence

---

**Código de Skill:** SKL-FE-001

**Versión:** 1.1.0

**Estándar:** High-Fidelity UI/UX Design & Frontend Craftsmanship (Next.js & Tailwind Stack)

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño y Desarrollo de Interfaces Frontend de Alta Calidad con Next.js y Tailwind CSS. |
| **Objetivo de Dominio** | Crear interfaces distintivas y de grado de producción que eviten la estética genérica de la IA, priorizando la originalidad, el refinamiento visual y la interactividad avanzada dentro del ecosistema de Next.js. |
| **Tipo de Proyecto** | Aplicaciones Web (SaaS, Dashboards), Landing Pages Premium, Sistemas de Diseño. |
| **Complejidad** | **Alta** (Requiere dominio avanzado de Tailwind, Next.js App Router y principios de diseño visual). |

---

## 2. Descripción y Filosofía de Diseño

Este skill guía la creación de interfaces que se alejan del "AI slop". Se basa en la toma de decisiones estéticas audaces e intencionales utilizando el stack de **Next.js 15** y **Tailwind CSS**.

### 2.1. Pensamiento de Diseño (Design Thinking)
* **Propósito:** Definir el problema real y el perfil del usuario para un producto basado en la web.
* **Tono:** Seleccionar una dirección estética extrema (ej. minimalismo brutal, caos maximalista, retro-futurismo, editorial, industrial).
* **Diferenciación:** Identificar el elemento "inolvidable" (una animación única, una composición tipográfica disruptiva, etc.).

### 2.2. Guías Estéticas de Frontend (Stack-Specific)
* **Tipografía:** Configurar fuentes personalizadas en Next.js (Google Fonts o locales). Evitar Inter/Arial. Pair display con body font.
* **Color y Tema:** Uso de **Tailwind CSS Variables** en `globals.css`. Implementar soporte nativo para `next-themes` (Dark/Light mode).
* **Movimiento (Motion):** Uso de `tailwindcss-animate` y transiciones nativas de CSS. Orquestar revelaciones escalonadas (*staggered reveals*) usando utilidades de delay de Tailwind.
* **Composición Espacial:** Layouts asimétricos usando Grid y Flexbox de Tailwind. Ruptura de contenedores estándar.
* **Componentes:** Base en **Radix UI** (estilo shadcn/ui) pero con personalización profunda para evitar el aspecto de "plantilla por defecto".

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)
* **[RF-01]:** Implementar componentes usando **React 18/19** y el **App Router** de Next.js.
* **[RF-02]:** Garantizar interactividad mediante hooks de React (`useState`, `useEffect`) y librerías de componentes accesibles (Radix).
* **[RF-03]:** Gestión de estados de formulario con **React Hook Form** y validación con **Zod**.

### 3.2. Requerimientos No Funcionales (RNF)
* **[RNF-01] Estética:** Cero uso de estéticas genéricas. Cada componente debe sentirse "diseñado" para el contexto del proyecto.
* **[RNF-02] Rendimiento:** Optimización de imágenes vía `next/image` y carga de fuentes optimizada.
* **[RNF-03] Mantenibilidad:** Uso de `tailwind-merge` y `clsx` para la gestión limpia de clases condicionales.

---

## 4. Criterios de Aceptación (Definition of Done)

1.  **Originalidad:** El diseño no se percibe como una instalación básica de shadcn/ui; ha sido personalizado con colores, bordes y sombras únicas.
2.  **Responsividad:** El diseño es impecable en dispositivos móviles, tablets y desktops de gran formato.
3.  **Accesibilidad:** Cumplimiento de estándares WCAG (uso de componentes Radix debidamente etiquetados).
4.  **Calidad de Código:** Uso correcto de TypeScript, evitando el tipo `any` y tipando props de componentes.

---

## 5. Ecosistema de Herramientas (Stack)

* **Framework:** Next.js 15+ (React).
* **Estilado:** Tailwind CSS, PostCSS.
* **Componentes Base:** Radix UI, Lucide React (Iconos).
* **Utilidades:** `class-variance-authority` (CVA), `tailwind-merge`, `clsx`.
* **Animaciones:** `tailwindcss-animate`, CSS Transitions/Animations.

---

## 6. Metodología de Práctica (Paso a Paso)

1.  **Fase de Concepto:** Definir la dirección estética y configurar los tokens de diseño en `tailwind.config.ts`.
2.  **Fase de Estructura:** Construir el layout en `layout.tsx` y las páginas usando componentes modulares.
3.  **Fase de Estilado:** Aplicar clases de Tailwind para tipografía, colores y espaciados disruptivos.
4.  **Fase de Interactividad:** Integrar Radix UI para componentes complejos y añadir animaciones de entrada.

---

## 7. Antipatrones (Lo que NO se debe hacer)

* ⚠️ **[Antipatrón 1]:** Dejar los valores por defecto de Tailwind (colores primarios, fuentes de sistema) sin personalización.
* ⚠️ **[Antipatrón 2]:** Abuso de componentes "out-of-the-box" sin modificar su estética para que encajen en el concepto visual.
* ⚠️ **[Antipatrón 3]:** No utilizar variables CSS para colores dinámicos, dificultando el mantenimiento del modo oscuro.
* ⚠️ **[Antipatrón 4]:** Descuidar el rendimiento al añadir demasiadas fuentes pesadas o animaciones costosas.

---

## 8. Evaluación y KPIs

| Métrica | Meta |
| :--- | :--- |
| **Identidad Visual** | 100% personalizada y coherente con el concepto. |
| **Core Web Vitals** | LCP < 2.5s, CLS < 0.1 (verificado en Lighthouse). |
| **Accesibilidad** | Score de 100 en herramientas de auditoría básica. |

---

## 9. Recursos Adicionales

* [Next.js Documentation](https://nextjs.org/docs)
* [Tailwind CSS Documentation](https://tailwindcss.com/docs)
* [Radix UI Primitives](https://www.radix-ui.com/primitives)
* [Shadcn/UI Architecture](https://ui.shadcn.com/)
