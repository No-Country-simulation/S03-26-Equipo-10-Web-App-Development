---
name: css-architecture-engineering
description: >-
  Arquitectura CSS y design tokens vigentes del Testimonial CMS (SKL-FE-CSS-001). Usar para cascada, variables HSL, temas, layout responsivo, foco, movimiento y estilos reutilizables en Next.js 15/Tailwind 3; tratar nuevos archivos de tokens y CSS avanzado como opciones condicionadas.
---

# SKL-FE-CSS-001 — Arquitectura CSS del Testimonial CMS

## Propósito y fuentes

Usar esta guía al crear o revisar CSS escrito a mano y decisiones de tokens. Leer `AGENTS.md`, `llm.txt`, el plan HITL activo, `apps/web/src/app/globals.css`, `apps/web/tailwind.config.ts` y los componentes afectados. Para utilidades Tailwind y CVA, consultar [Tailwind](../tailwind-architecture-engineering/SKILL.md).

| Estado | Regla |
| --- | --- |
| **Vigente** | Tailwind CSS 3.4 y capas `@layer base`/`@layer utilities` en `globals.css`; tokens HSL en `:root` y `.dark`. |
| **Vigente** | Geometría editorial con `--radius: 0rem`, paleta crema/obsidiana/terracota y fuentes Funnel Sans, Geist, Newsreader. |
| **Opción contextual** | CSS Modules, `:where`, `:has`, container queries, subgrid, `@scope` o capas adicionales si resuelven un problema concreto y hay soporte probado. |
| **Migración futura** | Separar tokens en `styles/tokens.css` y temas en `styles/themes.css`, o adoptar Tailwind 4/OKLCH; hoy esos archivos son marcadores. |

## Fuentes de estilo actuales

- `app/layout.tsx` importa `globals.css` y carga las tres fuentes con `next/font`.
- `globals.css` contiene directivas Tailwind, variables de color en claro y oscuro, reglas base, algunas utilidades y keyframes.
- `tailwind.config.ts` enlaza variables con clases semánticas (`bg-background`, `text-primary`, `border-border`).
- `components/ui` contiene primitivas con clases y variantes; CSS puede ajustarlas sin duplicar la primitiva.
- `ThemeProvider` activo cambia la clase `.dark` en `<html>`; no confundirlo con una configuración futura de `next-themes`.
- `styles/tokens.css` y `styles/themes.css` contienen comentarios preparatorios, no valores consumidos por la app.

## Mapa de tokens

| Grupo | Variables principales | Uso |
| --- | --- | --- |
| Superficie | `--background`, `--card`, `--popover`, `--section-alt` | Fondo y capas de contenido. |
| Texto | `--foreground`, `--card-foreground`, `--muted-foreground` | Jerarquía legible. |
| Acción | `--primary`, `--primary-foreground`, `--accent` | Acción y énfasis. |
| Estado destructivo | `--destructive`, `--destructive-foreground` | Peligro, no información completa por sí solo. |
| Límites y foco | `--border`, `--input`, `--ring` | Separación y foco. |
| Navegación | `--sidebar-*` | Superficie y estados de la barra lateral. |
| Geometría | `--radius` | Radio base editorial. |

Los valores de color son componentes HSL, por ejemplo `--primary: 14 74% 54%`. En CSS usar `hsl(var(--primary))`; Tailwind ya hace el envoltorio en su configuración. Para alpha en CSS puede usarse `hsl(var(--foreground) / 0.08)` si el navegador objetivo lo soporta. No guardar `#rrggbb` en una variable HSL mapeada por `hsl(var(...))`.

Las variables de tema son semánticas: un componente usa `--card` por función, no porque el valor claro se parezca a otro token. Si se cambia una variable, evaluar todas las pantallas que la consumen y los dos temas.

## Regla de cascada

1. Preferir propiedades de token o utilidad existente antes de aumentar especificidad.
2. Colocar reglas globales de base en `@layer base`, como hacen `body` y el borde por defecto.
3. Colocar una utilidad transversal nueva en `@layer utilities` solo si expresa un patrón reutilizable.
4. Mantener reglas de un componente o feature cerca de su dueño cuando Tailwind se vuelve ilegible.
5. Usar selectores de baja especificidad; `:where()` puede ayudar si una regla global necesita ceder a variantes locales.
6. No recurrir a `!important` para resolver un conflicto sin rastrear primero origen y orden.
7. Evitar que una regla global seleccione todos los `button`, `div` o `svg` de Radix por accidente.
8. Revisar CSS calculado, no solo el orden visual de `className`.

`@layer` ya existe por Tailwind 3. Agregar otra capa nativa o una taxonomía ITCSS/CUBE no es requisito del repositorio. CSS Modules son una opción si un bloque escrito a mano necesita aislamiento; no sustituir la estructura de features solo por adoptar una metodología.

## Responsabilidad de cada estilo

| Caso | Elección inicial |
| --- | --- |
| Espaciado, grid, flex, tipografía simple | Utilidades Tailwind en el componente. |
| Variante de botón/card existente | Prop de la primitiva o `className` local. |
| Regla global de fondo o texto | Token y regla base en `globals.css`. |
| Animación compartida | Utilidad con nombre y tratamiento de movimiento reducido. |
| Componente complejo y repetido | CSS local o variante documentada. |
| Excepción única de marketing | Clase local o valor arbitrario legible. |

No usar `@apply` para recrear un framework de componentes si la primitiva ya existe. Es válido en una regla base corta como `body { @apply bg-background text-foreground; }`, que el proyecto ya usa. No convertir todos los atributos visuales a custom properties si las utilidades son más claras.

## Diseño editorial existente

La identidad actual usa fondos crema, texto obsidiana, terracota como acento, tipografía editorial y radio base recto. Las capas y bordes forman jerarquía. No exigir gradientes, glassmorphism, píldoras, sombras intensas o esquinas redondeadas como lenguaje universal. Algunas primitivas incluyen clases `rounded-*`, y algunos chips son redondos: revisar el token y el resultado visual en contexto.

- `font-heading` estructura titulares de producto.
- `font-body` sostiene lecturas y controles.
- `font-caption` aporta acentos editoriales donde el contenido lo justifica.
- Evitar una cuarta familia tipográfica por pantalla.
- Separar acciones primarias por contraste y ubicación sin hacer que todos los controles compitan.
- Mantener contraste real en claro y oscuro, especialmente texto `muted` y botones `primary`.

## Layout responsivo

Elegir flex para una dimensión y grid para dos. Usar contenido real para decidir cuándo pasar de columnas a pila. Revisar nombres largos de testimonios, slugs, email, errores de formulario y zoom. No asumir que un ancho fijo que funciona en captura de escritorio resiste móvil.

```css
/* Opción para un bloque autónomo; usar solo si una pantalla lo necesita. */
.testimonial-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
  gap: 1rem;
}
```

El ejemplo es CSS estándar, no una estructura ya usada por el muro. Las container queries pueden ayudar cuando un widget se embebe a anchos variables; requieren un contenedor definido y pruebas del navegador objetivo. Subgrid puede alinear cards con filas relacionadas, pero no es obligatorio para una grilla normal.

## Dirección y contenido variable

- Preferir `gap` para separación entre elementos de flex/grid en lugar de márgenes dependientes del orden.
- Considerar propiedades lógicas como `margin-inline` si un componente debe admitir RTL; no cambiar toda la app sin alcance de localización.
- Evitar `height` rígida en cards con contenido de longitud variable.
- Permitir salto o truncado solo si la información sigue disponible en un flujo accesible.
- Una tabla admin puede requerir scroll horizontal; conservar encabezados y foco visible.
- Reservar espacio de imágenes para evitar saltos de layout.
- Evitar usar `position: fixed` para una CTA que tape contenido al hacer zoom.

## Tema y preferencias

`globals.css` define las mismas categorías de tokens en `:root` y `.dark`. Agregar un token semántico implica decidir ambos valores o una herencia intencional. La clase del tema se aplica en `ThemeProvider`; `prefers-color-scheme` orienta la selección inicial si no hay preferencia almacenada.

- No definir colores de tema en un componente cuando ya existe token semántico adecuado.
- Un `dark:` local es razonable para una excepción que un token no expresa.
- Verificar primer render, transición de tema, foco y contraste en ambas variantes.
- No cambiar una variable global para arreglar una sola card sin revisar el resto.
- No declarar `tokens.css` o `themes.css` como importados antes de que el código lo haga.

## Foco, estados y movimiento

- Un foco de teclado debe permanecer visible; `outline: none` exige reemplazo que se pruebe.
- `:focus-visible` distingue foco de teclado cuando resulta útil; no ocultar el foco por completo en navegadores que no lo implementan según el soporte objetivo.
- Un estado `disabled` necesita semántica HTML y visual; un color gris no basta.
- Un error de formulario requiere texto y relación con el control, no solo un borde rojo.
- El modo `forced-colors` puede ignorar sombras y colores personalizados; probar contorno, borde e iconos relevantes.
- Reducir movimiento cuando el sistema lo solicita; la animación global `animate-fade-in-up` debe evaluarse antes de usarla en contenido esencial.
- Evitar animaciones que retrasan artificialmente la confirmación de una acción.
- No usar animación como única señal de cambio de estado.

```css
/* Opción contextual para una animación nueva. */
@media (prefers-reduced-motion: reduce) {
  .feature-entrance {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
```

El selector del ejemplo representa una animación hipotética; no indica que `.feature-entrance` exista hoy. Ajustar la regla al componente real y probar que el contenido no queda oculto.

## Comprobar un cambio de CSS

1. Identificar la regla, su origen y el elemento afectado en DevTools.
2. Verificar si una variable semántica o clase existente resuelve el caso.
3. Revisar impacto en ambos temas y en componentes compartidos.
4. Probar ancho pequeño, escritorio, zoom y contenido largo.
5. Comprobar foco, disabled, error y `forced-colors` si el componente interactúa.
6. Si hay animación, comprobar `prefers-reduced-motion`.
7. Confirmar que el CSS nuevo no modifica pantallas ajenas por un selector amplio.
8. Ejecutar build o inspección del CSS generado cuando se cambia `@layer` o configuración Tailwind.

## Decisiones por ámbito

### Regla global

Una regla global modifica múltiples rutas y primitivas. Antes de añadirla:

1. Buscar el selector y consumidores afectados en `apps/web/src`.
2. Explicar por qué es una base del producto y no una excepción de feature.
3. Elegir token semántico o propiedad heredable cuando sea posible.
4. Mantener especificidad baja para permitir variantes locales.
5. Probar controles Radix, diálogos, sidebar y páginas públicas.
6. Verificar tema claro/oscuro y estados de foco/error.
7. Evitar selectores que dependan de estructura DOM interna de una librería.

Un reset global adicional puede alterar componentes que hoy se apoyan en Tailwind Preflight. No agregarlo sin revisar esa interacción.

### Regla de feature

- Colocarla cerca del componente dueño si el tooling del proyecto lo permite.
- Darle un nombre que describa función visual, no una posición accidental.
- Evitar selectores globales de tipo como `.feature button` si solo afecta un control.
- Mantener la API del componente en props/variantes antes de exponer un selector interno frágil.
- Si el estilo depende de `aria-expanded` o `data-state`, documentar el estado real de Radix.
- No requerir JavaScript para un estado que CSS puede expresar limpiamente.
- Revisar que el estilo no dependa del texto exacto o del orden de hermanos.

### Token nuevo

- Nombrarlo por función si el valor cambia entre temas; evitar `--orange-2` como única semántica.
- Definir uso previsto y fallback si el token no está disponible en un subárbol.
- Agregar valor claro y oscuro, o justificar por qué hereda el mismo.
- Mapearlo en `tailwind.config.ts` solo si se usa como utilidad en JSX.
- No crear token para un valor usado una sola vez sin perspectiva de sistema.
- Verificar contraste entre fondo y texto asociado en ambos temas.
- Evitar que una variación de opacidad vuelva ilegible un estado disabled o muted.

## Variables y contraste

Los pares `primary`/`primary-foreground` y `card`/`card-foreground` existen para que el texto se elija con su superficie. Al cambiar un fondo, revisar el foreground correspondiente. Un token de texto no garantiza contraste en cualquier superficie; medir la combinación final. El ring de foco debe distinguirse tanto del control como del fondo inmediato.

- Texto normal sigue el criterio WCAG 1.4.3 según tamaño real y peso efectivo.
- Los iconos esenciales y bordes que identifican un control requieren contraste no textual apropiado.
- El estado seleccionado no puede depender solo de terracota; agregar nombre, marca o estructura.
- Una sombra suave puede desaparecer en alto contraste; conservar borde u otra señal.
- Validar colores calculados, no comentarios de `globals.css` ni ejemplos de diseño antiguos.
- Comprobar una superficie semitransparente sobre el fondo real, no solo sobre blanco.

## Geometría y densidad

El radio base `0rem` contribuye a la identidad editorial. Un botón con `rounded-md` puede renderizar recto por el token; otras clases como `rounded-full` sí crean píldoras. Comprobar el resultado, no deducirlo del nombre de utilidad.

- Usar separación para indicar grupos y divisores para límites de tabla o card.
- Evitar convertir todos los controles a un mismo tamaño si cumplen tareas diferentes.
- Mantener área interactiva suficiente aunque el borde visible sea compacto.
- Un dashboard denso necesita jerarquía tipográfica antes que más sombras.
- Evitar `overflow: hidden` en un contenedor que recorta foco, popover o texto ampliado.
- Revisar los bordes al aplicar `border` global de base: algunos componentes pueden heredar color.
- No imponer una altura fija a cards de testimonios con contenido variable.

## Pruebas de estados especiales

| Estado | Qué comprobar |
| --- | --- |
| Foco de teclado | Indicador visible y no recortado por el contenedor. |
| Error | Texto y borde reconocibles; mensaje asociado al campo. |
| Disabled | Contraste y semántica suficientes para entender que no está disponible. |
| Loading | Texto legible y geometría estable mientras cambia el contenido. |
| Dark | Todas las superficies y overlays con foreground correcto. |
| Forced colors | Contorno e iconos no dependen solo de una sombra. |
| Movimiento reducido | Contenido visible sin la animación. |

No considerar la captura estática de un solo tema como cobertura de la cascada. Los estados `hover`, `focus-visible`, `aria-*` y `data-*` pueden introducir conflictos que no se ven en el estado inicial.

## Migración de tokens: condición de entrada

Antes de mover variables de `globals.css` a `styles/tokens.css` o `styles/themes.css`, identificar imports, orden de capas, valores por tema, consumidores Tailwind y pruebas visuales. La migración debe mantener los mismos nombres o actualizar cada consumidor en una fase controlada. No duplicar temporalmente definiciones activas que compitan sin documentar precedencia. El trabajo actual de esta skill no ejecuta esa migración.

## Opciones condicionadas y migración

`@scope`, container queries, subgrid y `@property` son herramientas de CSS moderno; usarlas cuando simplifican un problema real y el soporte de navegadores del proyecto lo permite. No son requisitos de cada pantalla. Separar tokens y temas en nuevos archivos exige mover imports, revisar precedencia y probar ambos temas. Tailwind 4 cambiaría directivas y configuración; seguir su guía de migración en una tarea separada.

No tratar `docs/technical/04_design_system.md` o ejemplos históricos con otra paleta como prueba de que el CSS activo cambió. Si un documento y `globals.css` divergen, verificar cuál está ejecutándose y registrar la discrepancia en la tarea pertinente.

### Evidencia antes de extraer CSS compartido

- Existe el mismo problema en al menos dos features activos.
- El selector nuevo tiene un dueño claro y no depende del DOM interno de Radix.
- La extracción reduce reglas duplicadas sin incrementar especificidad.
- Las variables usadas existen en claro y oscuro.
- La nueva ubicación se importa en las rutas que realmente la necesitan.
- Una comprobación visual cubre los consumidores principales.
- El cambio no obliga a mover tokens preparatorios como parte incidental.

## Definition of Done

- El estilo nuevo usa la cascada y los tokens HSL reales sin elevar especificidad innecesariamente.
- Claro y oscuro conservan contraste, foco y estados comprensibles.
- Layout funciona con texto variable, móvil y zoom sin ocultar acciones.
- CSS global no altera componentes ajenos; CSS local queda cerca de su dueño.
- Opciones modernas y nuevos archivos de tokens se distinguen del estado vigente.
- La verificación se ajusta al alcance y no modifica infraestructura o dependencias sin autorización.
