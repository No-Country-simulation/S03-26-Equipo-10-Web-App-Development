---
name: Testimonial CMS — dashboard
description: Panel editorial operativo sobre papel cálido, con navegación inversa y acento terracota.
colors:
  background: 'hsl(44 33% 94%)'
  foreground: 'hsl(0 0% 4%)'
  card: 'hsl(44 20% 98%)'
  primary: 'hsl(14 72% 34%)'
  primary-foreground: 'hsl(44 33% 94%)'
  muted: 'hsl(40 15% 85%)'
  muted-foreground: 'hsl(0 0% 40%)'
  border: 'hsl(0 0% 80%)'
  destructive: 'hsl(0 68% 38%)'
  success: 'hsl(145 65% 25%)'
  warning: 'hsl(36 85% 26%)'
  info: 'hsl(208 70% 32%)'
  status-foreground: 'hsl(0 0% 98%)'
  sidebar-background: 'hsl(0 0% 4%)'
  sidebar-foreground: 'hsl(44 33% 94%)'
  sidebar-primary: 'hsl(14 76% 65%)'
  sidebar-accent: 'hsl(0 0% 14%)'
  sidebar-border: 'hsl(0 0% 30%)'
  dark-background: 'hsl(0 0% 4%)'
  dark-foreground: 'hsl(44 33% 94%)'
  dark-card: 'hsl(0 0% 8%)'
  dark-primary: 'hsl(14 76% 65%)'
  dark-primary-foreground: 'hsl(0 0% 4%)'
  dark-muted: 'hsl(0 0% 15%)'
  dark-muted-foreground: 'hsl(44 10% 65%)'
  dark-border: 'hsl(0 0% 20%)'
  dark-destructive: 'hsl(0 75% 72%)'
  dark-success: 'hsl(145 55% 66%)'
  dark-warning: 'hsl(38 95% 68%)'
  dark-info: 'hsl(208 75% 74%)'
  dark-sidebar-background: 'hsl(44 20% 98%)'
  dark-sidebar-foreground: 'hsl(0 0% 4%)'
  dark-sidebar-primary: 'hsl(14 72% 34%)'
  dark-sidebar-accent: 'hsl(40 15% 85%)'
  dark-sidebar-border: 'hsl(0 0% 55%)'
typography:
  headline:
    fontFamily: 'Newsreader, Georgia, serif'
    fontSize: '1.875rem'
    fontWeight: 300
    lineHeight: '2.25rem'
  headline-desktop:
    fontFamily: 'Newsreader, Georgia, serif'
    fontSize: '2.25rem'
    fontWeight: 300
    lineHeight: '2.5rem'
  title:
    fontFamily: 'Newsreader, Georgia, serif'
    fontSize: '1.5rem'
    lineHeight: '2rem'
  body:
    fontFamily: 'Geist, system-ui, sans-serif'
    fontSize: '0.875rem'
    lineHeight: '1.25rem'
  label:
    fontFamily: 'Geist, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 500
    lineHeight: '1.25rem'
  small:
    fontFamily: 'Geist, system-ui, sans-serif'
    fontSize: '0.75rem'
    lineHeight: '1rem'
  amount:
    fontFamily: 'Geist, system-ui, sans-serif'
    fontSize: '1.25rem'
    lineHeight: '1.75rem'
rounded:
  lg: '0rem'
spacing:
  '2': '0.5rem'
  '3': '0.75rem'
  '4': '1rem'
  '5': '1.25rem'
  '6': '1.5rem'
  '8': '2rem'
  '10': '2.5rem'
  '12': '3rem'
components:
  button-primary:
    backgroundColor: '{colors.primary}'
    textColor: '{colors.primary-foreground}'
    typography: '{typography.label}'
    padding: '0.5rem 1rem'
  button-outline:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    typography: '{typography.label}'
    padding: '0.5rem 1rem'
  button-destructive:
    backgroundColor: '{colors.destructive}'
    textColor: '{colors.status-foreground}'
    typography: '{typography.label}'
    padding: '0.5rem 1rem'
  input:
    backgroundColor: '{colors.background}'
    textColor: '{colors.foreground}'
    padding: '0.5rem 0.75rem'
  feedback:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    typography: '{typography.body}'
    padding: '{spacing.4}'
  navigation-active:
    backgroundColor: '{colors.sidebar-accent}'
    textColor: '{colors.sidebar-foreground}'
    typography: '{typography.label}'
    padding: '0.625rem 0.75rem'
  checkout-status:
    backgroundColor: '{colors.card}'
    textColor: '{colors.foreground}'
    rounded: '{rounded.lg}'
    padding: '{spacing.5}'
---

# Design System: Testimonial CMS — dashboard

## Overview

**Creative North Star: "Panel editorial existente"**

El dashboard conserva una identidad editorial sobria: papel cálido, texto oscuro, títulos serif en cursiva y navegación inversa. La información operativa ocupa el centro; el acento terracota distingue las acciones. Esta descripción registra la identidad ya implementada, sin proponer una nueva metáfora de marca.

Facturación extiende ese panel con secciones separadas por líneas, formularios compactos, comparación de términos e historial financiero. Plataforma usa el mismo lenguaje para catálogo, cuentas y operaciones. El retorno de checkout presenta la confirmación del backend y una acción para volver a consultar. Estas superficies operativas no requieren imágenes; esa decisión local no prohíbe imágenes en otros módulos.

**Key Characteristics:**

- Papel y navegación inversa que intercambian roles al cambiar de tema.
- Jerarquía serif en cursiva; lectura, controles y cifras en sans serif.
- Líneas finas y espacio entre secciones, con paneles de estado discretos.
- Texto explícito para estados, errores y consecuencias de una acción.

Fuentes verificadas: [globals.css](src/app/globals.css), [Tailwind](tailwind.config.ts), [layout raíz](src/app/layout.tsx), los componentes activos `DashboardHeader`, `DashboardSidebar`, `Button`, `Input` y las pantallas de `src/features/billing/`. El frontmatter transcribe valores existentes; el código sigue siendo la fuente de ejecución. Los tokens con prefijo `dark-` registran sus variantes de tema, no colores adicionales para combinar libremente. Los componentes del frontmatter describen el tema claro; en ejecución, las variables semánticas resuelven el tema activo.

## Colors

La paleta combina neutrales de papel y tinta con un acento terracota y colores semánticos reservados para feedback.

### Primary

- **Terracota:** `primary` identifica la acción principal; `primary-foreground` conserva la pareja de contraste. `accent` y `ring` usan el mismo valor en la fuente.
- **Terracota de navegación:** `sidebar-primary` destaca el indicador de ruta activa y el foco sobre el panel inverso. En tema oscuro se usa la variante correspondiente de la fuente.

### Neutral

- **Papel cálido:** `background` sostiene el contenido principal; `card` distingue avisos y confirmaciones sin crear una cuadrícula de tarjetas.
- **Tinta:** `foreground` se usa para lectura principal; `muted-foreground`, para explicación auxiliar. El color atenuado no sustituye las etiquetas de campos ni las consecuencias críticas.
- **Línea editorial:** `border` delimita campos, tablas y secciones. El token `input` comparte ese valor.
- **Panel inverso:** los tokens `sidebar-*` son una familia propia. El tema oscuro invierte el panel a una superficie clara; no se aplica una inversión manual a cada enlace.

### Semantic feedback

`destructive`, `success`, `warning` e `info` distinguen error, éxito, advertencia e información. El feedback activo mantiene texto de lectura sobre `card` y aplica el color semántico al borde. Las acciones destructivas usan su pareja de primer plano; en oscuro esa pareja usa la tinta definida como `dark-primary-foreground`.

**The Paired Contrast Rule.** Usá cada superficie con su primer plano semántico del tema activo. El panel inverso conserva sus propios tokens de acción y foco.

## Typography

**Display Font:** Newsreader, con Georgia y serif de respaldo, asignada por `--font-caption`.
**Body Font:** Geist, con system-ui y sans-serif, asignada por `--font-body`.

La configuración también conserva Funnel Sans en `--font-heading`. Los encabezados de las pantallas de billing usan Newsreader; no se reasigna esa función a Funnel Sans por el nombre del token.

### Hierarchy

- **Headline:** título de página ligero, en cursiva. Usa `headline` en móvil y `headline-desktop` desde el ancho medio del dashboard.
- **Title:** encabezados de sección y nombres de planes, en cursiva, con peso heredado normal.
- **Body:** descripción, términos, filas de tablas y mensajes operativos. Las explicaciones largas aprovechan el ancho de prosa de Tailwind (65ch) cuando la pantalla lo aplica.
- **Label:** acciones y títulos de campos con peso medio; los campos de texto compartidos usan cuerpo de 1rem en móvil y 0.875rem desde el ancho medio.
- **Small:** metadatos, identificadores auxiliares y notas de capacidad.
- **Amount:** importe destacado de un plan. Las cifras y tablas usan numerales tabulares; importes y fechas se formatean con los adaptadores del módulo.

**The Reading Voice Rule.** Conservá la serif cursiva para títulos editoriales y la sans serif para decisiones, formularios, navegación y datos.

## Layout

El shell activo usa una barra lateral fija de 16rem desde el breakpoint grande (1024px). Debajo, una cabecera móvil de 4rem abre la navegación en un panel lateral de ancho máximo 20rem, limitado al viewport. El contenido reserva el ancho de la barra en escritorio y usa padding de 1rem, 2rem desde 640px y 3rem desde 1024px.

El encabezado de página separa título y descripción de sus acciones: columna en móvil, fila desde 768px; las acciones pueden envolver. Un divisor de baja opacidad cierra el encabezado. Las secciones operativas usan principalmente la escala de espacio del frontmatter, con separaciones amplias entre tareas y grupos más compactos dentro de formularios.

Billing muestra sus términos en una columna y pasa a dos columnas desde 1024px. Sus selectores pasan a tres columnas desde 640px. Los formularios de plataforma se organizan en dos o tres columnas desde 640px según el grupo; en móvil se apilan conservando etiquetas. El resumen de capacidad pasa de una a dos y luego cuatro columnas desde 640px y 1280px.

Las tablas financieras conservan encabezados y captions accesibles dentro de contenedores con desplazamiento horizontal. Las fechas e importes no se comprimen para entrar a la fuerza. Los identificadores largos admiten corte de palabra en las regiones donde se muestran.

## Elevation & Depth

Las pantallas de billing son planas: separadores, contraste tonal y espacio comunican la estructura. Los avisos y el estado de checkout usan superficie `card` con borde, sin sumar sombras decorativas. Los diálogos compartidos sí usan la sombra grande del sistema y un overlay negro al 80%; la profundidad identifica una interacción modal.

La configuración general ofrece sombras suaves `soft` y `soft-lg`, y el componente `Card` conserva una sombra mínima. Su existencia no obliga a incorporarlas a cada sección de este módulo. Las transiciones de los controles cambian colores; diálogos y navegación mantienen la reducción de movimiento prevista por los estilos globales.

**The Section First Rule.** Para el contenido operativo de billing, usá divisores y espacio antes de introducir otro contenedor elevado.

## Shapes

La fuente define esquinas rectas mediante el radio base `lg` del frontmatter. Formularios, tablas y secciones de billing mantienen esa geometría editorial. Los bordes son finos; la comparación de planes se presenta como artículos separados por una línea superior.

**Drift previo sin canonizar:** Tailwind deriva `md` y `sm` restando a un radio base cero, produciendo radios negativos no válidos. `Button` e `Input` todavía referencian esos nombres. Esta documentación conserva la intención recta y no convierte esas expresiones inválidas en tokens normativos; la corrección de configuración queda fuera de esta extensión. Las etiquetas de grupo de la barra lateral a 10px, en mayúsculas, también son legado previo: no se elevan a un patrón para nuevas superficies.

## Components

### Buttons

Acciones compactas y explícitas. `Button` comparte una superficie mínima de interacción de 44px de alto y ancho; el mínimo prevalece sobre las alturas menores de algunas variantes. El frontmatter registra las parejas de color y el padding de las variantes normales.

La acción principal usa terracota; la acción outline conserva el papel y el borde de campo. Hover reduce la opacidad del fondo principal al 90%; outline cambia a la pareja `accent`. El foco visible usa anillo de 2px con separación de 2px; los elementos deshabilitados reducen opacidad al 50% y bloquean eventos. Conservá etiquetas específicas como «Seleccionar plan», «Guardar borrador» o «Consultar estado».

### Inputs / Fields

Campos con borde, superficie del documento y padding horizontal de la escala existente. `Input` comparte el mínimo de 44px y el anillo de foco del botón. Los selectores nativos de billing conservan su contorno visible, etiquetas asociadas y tamaño mínimo. Los errores aparecen cerca de la tarea y no eliminan los valores ingresados. El foco global añade un contorno de 2px con separación de 3px a los elementos interactivos sin tratamiento propio.

### Cards / Containers

Los paneles de feedback usan padding `4`; checkout usa `5`. La separación visual proviene de `card` y de un borde fino. El catálogo y el historial permanecen en el flujo de la página; no se transforman automáticamente en tarjetas.

### Navigation

La barra inversa conserva iconos SVG y texto. El enlace activo combina fondo `sidebar-accent`, texto legible, indicador vertical terracota y `aria-current`. El foco usa el acento de navegación. En móvil, el mismo contenido vive en el panel lateral y se cierra al navegar. La visibilidad de Facturación y Plataforma depende del rol y de la autorización operativa existente.

### Confirmation and feedback

Las acciones con consecuencias usan la confirmación compartida: título, descripción, cancelación y botón específico. El diálogo limita su altura a 90dvh y permite desplazamiento interno. Escape cancela cuando está inactivo; durante el envío se bloquea el cierre y se muestra «Procesando…». Al cerrar se restaura el foco al control que lo abrió.

Los mensajes de error usan `alert`; carga, confirmación y otros estados usan `status`. El retorno del checkout muestra pendiente, revisión, error, confirmado o revertido con explicación textual y consulta recuperable; el navegador no infiere un pago por haber regresado de la pasarela.

## Do's and Don'ts

### Do:

- **Do** conservá las parejas HSL y los tokens de fuente del tema activo.
- **Do** mantené títulos serif en cursiva, controles sans serif, cifras tabulares y estados con texto explícito.
- **Do** apilá campos y acciones en móvil; conservá el desplazamiento local de tablas.
- **Do** reutilizá los componentes activos de foco, confirmación y feedback.
- **Do** mostrale al usuario términos, límites y consecuencias provenientes del backend; identificá los datos de simulación.

### Don't:

- **Don't** inventes precios comerciales, insignias de popularidad o testimonios para completar estas pantallas operativas.
- **Don't** uses el color como único indicador de estado financiero o autorización.
- **Don't** registres radios negativos como una decisión de diseño válida.
- **Don't** conviertas la ausencia de imágenes en billing en una prohibición global para el CMS.

Evidencia de cierre: las seis capturas `billing`, `platform` y `return`, cada una en escritorio (1440px) y móvil (390px), bajo `.impeccable/review/billing/`, coinciden con la extensión local del sistema. La revisión independiente comunicada para este cierre emitió `ship` en el alcance de la fecha de gracia y las auditorías recientes. La interacción con HTTP sintético comunicada por el agente principal verificó apertura de diálogo con Enter, Escape y restauración de foco en ambos anchos. Esto documenta evidencia de interfaz; no acredita E2E ni aceptación sandbox de las pasarelas. El tema oscuro se extrajo del código y no integra estas seis capturas claras. No se creó sidecar: esta entrega extiende el sistema existente y no cambia sus tokens.
