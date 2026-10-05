---
name: tailwind-architecture-engineering
description: >-
  Uso y evolución de Tailwind CSS 3.4 en el Testimonial CMS (SKL-FE-TW-001). Usar para clases utilitarias, tokens HSL, variantes CVA, modo oscuro, composición responsiva y accesibilidad; reservar directivas CSS-first de Tailwind 4 para una migración explícita.
---

# SKL-FE-TW-001 — Tailwind CSS del Testimonial CMS

## Propósito y fuentes

Aplicar esta skill a estilos construidos con Tailwind en `apps/web`. Leer `AGENTS.md`, `llm.txt`, el plan HITL activo, `apps/web/tailwind.config.ts`, `apps/web/src/app/globals.css` y el componente afectado. La skill de [arquitectura CSS](../css-architecture-engineering/SKILL.md) trata cascada y CSS escrito a mano; esta guía trata utilidades y variantes Tailwind.

| Estado | Regla |
| --- | --- |
| **Vigente** | Tailwind CSS 3.4.19, configuración TS, `content` explícito, `@tailwind base/components/utilities`, plugin `tailwindcss-animate`. |
| **Vigente** | Colores semánticos enlazados a variables HSL de `globals.css`; `darkMode: ["class"]`; variantes en primitivas con CVA. |
| **Opción contextual** | Nuevos tokens, `@layer` adicional, plugin o container query, solo ante un uso que el sistema actual no cubra. |
| **Migración futura** | Tailwind 4, `@import "tailwindcss"`, `@theme`, `@source`, `@utility` y detección automática de fuentes. |

## Modelo ejecutable de Tailwind 3

El CSS global empieza con:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

La configuración operativa vive en `apps/web/tailwind.config.ts`. Su propiedad `content` incluye `./src/**/*.{ts,tsx}` y algunos directorios adicionales. Al crear archivos fuera de esas rutas, comprobar que Tailwind los escanea antes de esperar clases en el CSS generado. No usar `@source` para arreglar un proyecto v3.

El repositorio usa npm workspaces. Ejecutar comandos del workspace con npm según los scripts existentes; no introducir `pnpm` o un `packages/ui` inexistente en ejemplos de trabajo actual.

## Tokens vigentes

`globals.css` define `:root` y `.dark` con variables como `--background`, `--foreground`, `--primary`, `--muted`, `--border`, `--ring`, `--card` y las de `--sidebar-*`. `tailwind.config.ts` las mapea a colores `hsl(var(--...))`.

| Necesidad | Utilidad vigente | Fuente |
| --- | --- | --- |
| Superficie de página | `bg-background text-foreground` | `--background`, `--foreground`. |
| Acción principal | `bg-primary text-primary-foreground` | `--primary`, `--primary-foreground`. |
| Superficie de card | `bg-card text-card-foreground` | `--card`, `--card-foreground`. |
| Texto secundario | `text-muted-foreground` | `--muted-foreground`. |
| Borde y foco | `border-border`, `ring-ring` | `--border`, `--ring`. |
| Navegación lateral | `bg-sidebar`, `text-sidebar-foreground` | variables sidebar. |

Las variables están en componentes HSL sin función: `--primary: 14 74% 54%`. En CSS escrito a mano usar `hsl(var(--primary))`; en clases usar `bg-primary`. No insertar un token `oklch(...)` bajo un mapeo `hsl(var(...))` sin migrar toda la cadena.

`--radius: 0rem` establece geometría editorial de esquinas rectas; `rounded-md` en componentes que usan el token puede calcular `calc(var(--radius) - 2px)`. Revisar el resultado real antes de imponer radios adicionales. Hay excepciones locales, como chips redondos; respetar intención y accesibilidad en lugar de una prohibición universal.

Las familias configuradas son `font-heading` (Funnel Sans), `font-body` (Geist) y `font-caption` (Newsreader), cargadas desde `app/layout.tsx` con `next/font`. Usarlas según jerarquía existente; no introducir una fuente por componente.

## Elegir clases, componente o CSS

1. Usar utilidades en JSX para layout, espaciado, tipografía, estados y superficies habituales.
2. Usar una primitiva de `components/ui` cuando ya cubre la semántica y variantes.
3. Usar `cva` para variantes de una primitiva con estados repetidos y API estable; no para un único botón.
4. Usar CSS de componente o `@layer` para una regla compleja reutilizada que las utilidades vuelven opaca.
5. Añadir un token si representa una decisión del sistema y aparece en más de un contexto, no por un valor aislado.
6. Un valor arbitrario puede expresar una excepción deliberada; si se repite, evaluar token o variante.
7. Antes de crear un nuevo helper `cn`, usar el existente en `apps/web/src/lib/utils/cn.ts`.

No convertir cada combinación de clases en una abstracción. El objetivo es reducir decisiones inconsistentes, no ocultar CSS fácil de leer.

## Clases detectables estáticamente

Tailwind v3 extrae candidatos de los archivos listados en `content`. Mantener nombres completos en el código fuente:

```tsx
const statusClasses = {
  pending: 'border-border bg-muted text-foreground',
  published: 'border-primary bg-primary text-primary-foreground',
} as const;

function StatusBadge({ status }: { status: keyof typeof statusClasses }) {
  return <span className={statusClasses[status]}>{status}</span>;
}
```

Evitar `bg-${color}-500` o `text-${status}`: el extractor no conoce los valores posibles. Si el valor cambia en runtime y no existe un conjunto finito de clases, usar una custom property validada y una utilidad estática, o CSS de componente. Nunca interpolar CSS libre de un usuario.

Para clases condicionales, usar `cn(...)` cuando hay conflicto posible; combina `clsx` y `tailwind-merge`. Revisar el resultado en variantes arbitrarias o plugins: `tailwind-merge` no comprende toda extensión del proyecto por arte de magia.

## Variantes en primitivas

`apps/web/src/components/ui/button.tsx` usa `cva` con variantes `default`, `destructive`, `outline`, `secondary`, `ghost` y `link`; tamaños `default`, `sm`, `lg`, `icon`. `Button` acepta `className` y `asChild` mediante Radix Slot.

```tsx
import { Button } from '@/components/ui/button';

export function SaveAction({ pending }: { pending: boolean }) {
  return <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>;
}
```

El estado visual debe corresponder al estado funcional. Un botón deshabilitado no sustituye un mensaje de error ni la autorización del backend. Para acciones con icono sin texto visible, dar nombre accesible. No anular `focus-visible` sin reemplazo verificable.

Las cards y diálogos existentes son primitivas; no reimplementar una variante con un `div` genérico si se necesitan su semántica y comportamiento. Si una pantalla editorial necesita una excepción de borde, preferir una clase local y revisar la cascada.

## Modo oscuro

`darkMode: ["class"]` activa variantes `dark:` por la clase `.dark`. El `ThemeProvider` actual alterna esa clase en `document.documentElement` y persiste preferencia. Los tokens HSL de `.dark` resuelven la mayoría de superficies sin duplicar `dark:` en cada uso.

- Preferir `bg-background`, `text-foreground`, `border-border` para superficies con token.
- Usar `dark:` cuando existe una excepción real y verificable en un componente.
- Revisar contraste y foco en ambos temas después de agregar color o estado.
- No describir `next-themes` como proveedor vigente si el componente activo usa su propio `ThemeProvider`.
- No añadir `prefers-color-scheme` CSS que compita con la elección almacenada sin una decisión explícita.
- Probar el primer render para detectar cambios visibles de tema o contraste.

## Layout y responsive

Usar `flex` para un eje y `grid` para dos ejes o columnas de contenido. Preferir tamaños fluidos y `min-w-0` donde texto largo deba truncarse. Empezar por el contenido a ancho pequeño y agregar variantes `sm:`, `md:` o `lg:` cuando la composición lo necesite, usando los breakpoints vigentes.

- Una tabla admin puede necesitar scroll horizontal con encabezados claros; no forzar todos los datos a cards si perjudica la tarea.
- Las acciones críticas deben seguir visibles o descubribles en móvil sin solaparse con navegación.
- Un `grid-cols-3` fijo puede romper con traducciones o textos largos; comprobar contenido real.
- Revisar zoom al 200 % y 400 % antes de agregar anchuras rígidas.
- `container` tiene padding y ancho máximo definidos en `tailwind.config.ts`; comprobar la ruta donde se usa.
- Container queries requieren decidir soporte y sintaxis para Tailwind v3 o CSS nativo; no asumir el plugin de v4.
- Evitar `h-screen` para formularios que pueden crecer con errores y zoom.

## Accesibilidad y estados

- Mantener `focus-visible:ring-*` o indicador equivalente con contraste suficiente.
- No usar solo color para estado de moderación; incluir texto o icono con nombre.
- Revisar `disabled`, `aria-disabled`, `aria-busy` según comportamiento real del control.
- No aplicar `pointer-events-none` a un elemento que todavía parece operable.
- Respetar `prefers-reduced-motion` en animaciones nuevas; la utilidad global `animate-fade-in-up` no define esa adaptación por sí sola.
- Un spinner no comunica resultado; mostrar texto de carga y error accesible.
- Revisar tamaños/espaciado de objetivos de puntero según WCAG 2.2 2.5.8, no una regla universal de 44 px.
- Asegurar que contraste de texto y controles se mida con los valores reales en ambos temas.

## Revisión de una clase nueva

1. Localizar el componente y verificar que la ruta cae bajo `content`.
2. Elegir token semántico existente antes de un color arbitrario.
3. Revisar si una primitiva tiene variante para el caso.
4. Comprobar el CSS calculado, especialmente `rounded-*`, `dark:` y clases en conflicto.
5. Probar texto largo, estado disabled, foco, tema claro y oscuro.
6. Verificar móvil y zoom sin exigir una composición ajena al producto.
7. Si es estilo global, confirmar que no altera primitivas fuera del feature.
8. Añadir test visual o de interacción solo ante un riesgo que no pueda comprobarse con inspección simple.

## Patrones de composición por componente

### Botones y enlaces

- `Button` tiene tamaños y variantes existentes; preferir una prop antes de repetir un conjunto de clases.
- `asChild` permite que el elemento real sea un enlace, pero verificar que el hijo preserve su semántica.
- Una acción con icono necesita texto visible o un nombre accesible; la forma visual no basta.
- Un botón de peligro usa semántica de acción y la variante `destructive` cuando corresponde.
- No crear una variante `primary` adicional si `default` ya cumple el caso.
- `disabled` bloquea interacción nativa; para progreso, acompañarlo con texto claro.
- Revisar que el foco no desaparezca con overrides como `focus-visible:ring-0`.
- Un `Link` estilizado como botón sigue navegando; no convertirlo en botón HTML que cambia ruta por `onClick`.

### Formularios

- Etiqueta, ayuda y error pertenecen al mismo grupo perceptual y semántico.
- Conservar el espacio del error cuando evita saltos visibles, sin dejar huecos grandes permanentes.
- Usar tokens de borde y foco, no un color rojo aislado como única señal de fallo.
- Comprobar textarea y campos con contenido largo en móvil y zoom.
- Evitar `truncate` en valores que una persona necesita leer para corregir una entrada.
- Los placeholders no reemplazan labels ni instrucciones persistentes.
- Una fila de acciones debe envolver con `flex-wrap` si los textos cambian de longitud.
- No aplicar `opacity-50` a todo un formulario para representar carga si borra legibilidad.

### Tablas y tarjetas

- En tabla, reservar espacio para estados, nombres largos y botones por fila.
- Si hay scroll horizontal, mantener una señal visible de que la tabla continúa.
- Alinear números para comparación; no usar solo color para prioridad o estado.
- En card pública, conservar proporción de imagen y no forzar igual altura con texto truncado sin acceso alternativo.
- Usar `bg-card` y `text-card-foreground` como par semántico.
- Sombra `shadow-soft`/`shadow-soft-lg` existe en configuración; usarla solo si la jerarquía lo pide.
- El borde editorial puede dar separación suficiente sin añadir una sombra en cada componente.
- Revisar que variantes `hover:` no sean el único indicador de que un elemento es interactivo.

## Cómo revisar una variante de tema

1. Abrir el elemento con tema claro y oscuro.
2. Confirmar valor computado de fondo, texto, borde y ring.
3. Revisar hover, pressed, focus-visible, disabled y error.
4. Probar texto largo y controles con icono.
5. Comparar tokens semánticos antes de agregar `dark:`.
6. Si el token no sirve, definir una excepción local y dejar su razón cerca del componente.
7. Si se agrega token global, registrar claro y oscuro y revisar consumidores existentes.
8. Verificar primer render para detectar un flash de tema.

No cambiar la clase `.dark` desde un componente de feature: el proveedor actual posee esa decisión. No asumir que `next-themes` controla el tema porque figure en dependencias; verificar el componente montado.

## Evaluación de valores arbitrarios

| Ejemplo | Decisión |
| --- | --- |
| `text-[10px]` en una etiqueta puntual | Revisar legibilidad y zoom; puede ser excepción editorial. |
| `w-[327px]` repetido en varias pantallas | Preferir token de ancho o layout intrínseco. |
| `bg-[#cc5c3e]` junto a `bg-primary` | Preferir token semántico para evitar divergencia de tema. |
| `grid-cols-[auto_1fr]` para una estructura concreta | Puede ser más claro que varias clases auxiliares. |
| `h-[calc(100vh-64px)]` en formularios | Comprobar viewport móvil y contenido variable. |

La presencia de un valor arbitrario no es fallo automático. El problema es una decisión repetida o incompatible con tema, contenido y accesibilidad. Revisar el CSS generado y la intención del valor.

## Comprobaciones de salida Tailwind 3

- Confirmar que `tailwind.config.ts` carga desde el workspace web y mantiene `content` correcto.
- Al añadir un archivo nuevo, verificar que su ruta coincide con un glob `content`.
- Al añadir una clase dinámica, buscar el nombre completo en fuente o reemplazarla por mapa finito.
- Tras cambiar tokens, revisar que los valores HSL se resuelven en claro y oscuro.
- Tras cambiar CVA, comprobar todas las variantes y el resultado de `cn()`.
- Tras cambiar una utilidad global, buscar usos existentes para detectar regresiones.
- Tras cambiar responsive, revisar un ancho pequeño y uno amplio con texto real.
- Tras cambiar tipografía, revisar line height, wrapping y fuentes cargadas.
- Tras cambiar animación, verificar reducción de movimiento y contenido visible.
- No tomar un warning ausente del build como prueba suficiente de accesibilidad visual.

## Límites de alcance

Una tarea de styling no autoriza a actualizar Tailwind, mover tokens, instalar plugins o reorganizar el monorepo. Proponer esas medidas solo si la necesidad supera las utilidades y componentes actuales. La migración v4 modifica compilación y compatibilidad; no mezclarla con un ajuste visual menor.

### Señales para detener una abstracción

- Solo un componente necesita el estilo y la clase local sigue siendo legible.
- La variante CVA tendría más opciones que usos reales.
- Un helper escondería la semántica HTML del control.
- El token nuevo sería un alias de otro valor sin función distinta.
- La clase global afectaría más features de los que intenta ayudar.
- Un plugin resolvería un caso que CSS estándar ya cubre.
- La mejora depende de un breakpoint no probado con contenido real.
- El estilo exige cambiar Tailwind 4 para funcionar en v3.
- La documentación de la variante sería más compleja que el propio JSX.

En estos casos, usar una solución local y revisarla cuando exista repetición verificable. La consistencia del sistema se preserva con tokens y primitivas ya disponibles.

Revisar la excepción cuando cambie el componente compartido del que depende.

## Migración futura a Tailwind 4

La [guía oficial de actualización](https://tailwindcss.com/docs/upgrade-guide) describe cambios de instalación, import CSS, detección de fuentes y utilidades. `@theme`, `@source` y `@utility` pertenecen a esa migración, no al CSS actual. Un cambio requiere actualizar dependencias/PostCSS, revisar compatibilidad de navegadores, adaptar configuración y tokens HSL, comprobar CVA/`tailwind-merge`, ejecutar build y revisar pantallas clave en ambos temas.

No convertir `styles/tokens.css` o `styles/themes.css` en fuente de verdad solo porque existen: ambos son marcadores preparatorios. Mover tokens fuera de `globals.css` es otra tarea con alcance y verificación propios.

## Definition of Done

- Las clases existen bajo la configuración Tailwind 3.4 y se detectan en el build.
- Colores y tipografía reutilizan tokens vigentes o justifican una excepción local.
- Variantes y estados no rompen foco, contraste, tema oscuro, móvil ni contenido largo.
- El componente conserva semántica y comportamiento, sin adjudicar permisos desde CSS.
- Las opciones Tailwind 4 y nuevos archivos de tokens están señalados como migración futura.
- La revisión se limita al cambio solicitado y usa npm y rutas reales del monorepo.
