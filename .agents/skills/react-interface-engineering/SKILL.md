---
name: react-interface-engineering
description: >-
  Diseño, implementación, revisión y evolución de interfaces profesionales con React (código SKL-REACT-UI-001). Usar cuando se requiera construir UIs declarativas con renderizado puro, arquitectura Feature-Oriented, estado local-first, composición sobre herencia (Compound Components, Radix UI), accesibilidad WCAG 2.2 AA, formularios con React Hook Form y Zod, sincronización limpia con useEffect, resiliencia con Error Boundaries y testing de comportamiento con React Testing Library y Vitest.
---

# Especificación Técnica de Habilidad: Senior React Interface Engineering

```text
Código de Skill:    SKL-REACT-UI-001
Versión:            1.0.0
Nivel:              Senior / Professional / Production Engineering
Dominio:            React / TypeScript / Frontend Architecture / UI Engineering
Baseline:           React 19.3+ (con compatibilidad y puente React 18.3+)
Contexto Proyecto:  @testimonial-cms/web (Next.js 15 App Router + Radix UI + TailwindCSS + React Hook Form + Zod + Vitest)
Estándares:         React Rules / TypeScript Strict / WCAG 2.2 AA / Web Platform / SOLID pragmático / DRY / KISS / YAGNI / Agile DoD
```

---

## 1. Ficha de Identificación

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, implementación, revisión y evolución de interfaces profesionales con React. |
| **Objetivo de Dominio** | Construir interfaces declarativas, predecibles, accesibles, eficientes y escalables en `@testimonial-cms/web`. |
| **Paradigma Principal** | Declarativo / Funcional / Composición. |
| **Unidad Arquitectónica** | Feature + Component + Custom Hook. |
| **Lenguaje & Tipado** | TypeScript Estricto (`strict: true`, `noUncheckedIndexedAccess: true`). |
| **Gestión de Estado** | Local-first / State Colocation / Single Source of Truth / Derivación en Render. |
| **Modelo de Composición**| Composition over Inheritance (Compound Components, Headless Primitives con Radix UI). |
| **Formularios & Validación**| React Hook Form + Resolvers de Zod (`@hookform/resolvers/zod`). |
| **Testing** | Behavior-oriented con Vitest + `@testing-library/react`. |
| **Accesibilidad** | WCAG 2.2 Nivel AA como baseline innegociable. |
| **Prioridad Operativa** | Correctitud ➔ Accesibilidad ➔ Predictibilidad ➔ Mantenibilidad ➔ UX ➔ Performance ➔ Simplicidad. |
| **Complejidad** | Alta. |

> [!IMPORTANT]
> React asume que los componentes son **funciones puras durante el render**: mismos inputs (props, state, context) deben producir invariablemente el mismo resultado visual, y el proceso de renderizado **no debe producir efectos secundarios**. Esta pureza matemática habilita el razonamiento local, la concurrencia, las transiciones fluidas y las optimizaciones automáticas del compilador.

---

## 2. Filosofía de Diseño

Una interfaz React profesional en `@testimonial-cms/web` se construye bajo seis pilares innegociables:

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   Pilares de Senior React Engineering                  │
├─────────────────────────┬──────────────────────────────────────────────┤
│ 1. Pure Rendering       │ Cero mutaciones ni efectos durante el render.│
├─────────────────────────┼──────────────────────────────────────────────┤
│ 2. Explicit Data Flow   │ Flujo unidireccional y predecible de datos.  │
├─────────────────────────┼──────────────────────────────────────────────┤
│ 3. State Colocation     │ Estado colocado lo más cerca de su uso.      │
├─────────────────────────┼──────────────────────────────────────────────┤
│ 4. Feature Boundaries   │ Módulos funcionales desacoplados con API fija│
├─────────────────────────┼──────────────────────────────────────────────┤
│ 5. Composition          │ Compound components sobre mega-configuraciones│
├─────────────────────────┼──────────────────────────────────────────────┤
│ 6. Accessibility (a11y) │ HTML semántico y WCAG 2.2 AA por defecto.    │
└─────────────────────────┴──────────────────────────────────────────────┘
```

El objetivo de la ingeniería Senior **no es** usar muchos Hooks, fragmentar componentes en micro-archivos de 5 líneas ni instalar librerías por moda. El objetivo es **eliminar estados imposibles, desmantelar dependencias ocultas y erradicar comportamientos impredecibles**.

---

## 3. Modelo Mental Correcto de React

React no es una librería de manipulación imperativa del DOM (`jQuery`-like):

```text
❌ Modelo Mental Imperativo:
"Cuando el usuario hace click → busca el botón en el DOM → añadí la clase loading
 → ocultá el panel de testimonios → cambiá el texto → mostrá el spinner"

✅ Modelo Mental Declarativo de React:
Estado Actual (State)
       ↓
Función de Render Pura: UI = f(State)
       ↓
Descripción Declarativa de UI (Virtual DOM / JSX)
       ↓
Reconciliación de React (Diffing algorítmico)
       ↓
Actualización Mínima y Eficiente del DOM Real
```

La aplicación simplemente declara **qué aspecto debe tener la interfaz para cada estado posible**. El framework se encarga de sincronizar el navegador.

---

## 4. Pureza del Render: Regla Fundamental

Componentes y Hooks **deben permanecer estrictamente puros** durante la ejecución de su cuerpo:

```typescript
// ❌ ANTIPATRÓN: Mutación de variables externas durante render (impredecible ante renderizado concurrente)
let renderCounter = 0;
export function TestimonialCounter() {
  renderCounter++; // ⚠️ Efecto lateral durante render
  return <div>Vistas: {renderCounter}</div>;
}

// ✅ CORRECTO: Render puro e idempotente
interface TestimonialCardProps {
  id: string;
  authorName: string;
  content: string;
  rating: number;
}

export function TestimonialCard({ id, authorName, content, rating }: TestimonialCardProps) {
  return (
    <article data-testimonial-id={id} className="rounded-lg border p-4 shadow-sm">
      <header className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{authorName}</h3>
        <span aria-label={`Calificación: ${rating} de 5 estrellas`}>{'★'.repeat(rating)}</span>
      </header>
      <p className="mt-2 text-gray-700">{content}</p>
    </article>
  );
}
```

---

## 5. Efectos Laterales: Dónde Pertenecen

Bajo ninguna circunstancia se deben ejecutar durante el render:
- Llamadas de red (`fetch`, `axios`).
- Mutaciones directas del DOM.
- Escrituras en `localStorage` o `cookies`.
- Disparo de eventos de analítica.
- Inicialización de timers (`setTimeout`, `setInterval`).
- Subscripciones a WebSockets.

Los efectos pertenecen a dos lugares específicos:
1. **Event Handlers (90% de los casos):** En respuesta directa a una acción del usuario (`onClick`, `onSubmit`, `onKeyDown`).
2. **`useEffect` (10% de los casos):** Exclusivamente para **sincronizar el componente con un sistema externo** (event listeners globales, observadores de redimensionamiento).

---

## 6. Arquitectura Feature-Based en `@testimonial-cms/web`

La aplicación en `apps/web/src` se organiza principalmente por **dominio funcional** (*Screaming Architecture*), comunicando de inmediato qué producto se está construyendo:

```text
apps/web/src/
├── app/                         # Next.js 15 App Router (Páginas, Layouts, Rutas)
│   ├── (dashboard)/
│   ├── (public)/
│   └── error.tsx
│
├── features/                    # Módulos de Dominio Autónomos
│   ├── testimonials/            # Feature principal de gestión de testimonios
│   │   ├── api/                 # Clientes y funciones de fetching hacia la API NestJS
│   │   ├── components/          # Componentes visuales específicos del dominio
│   │   ├── hooks/               # Custom hooks de la feature (e.g. useTestimonialFilter)
│   │   ├── schemas/             # Esquemas de validación Zod de testimonios
│   │   ├── screens/             # Vistas compuestas de la feature
│   │   ├── types/               # Tipos TypeScript y ViewModels
│   │   └── index.ts             # API pública pequeña y controlada
│   │
│   ├── auth/                    # Login, registro, sesiones
│   ├── analytics/               # Métricas y dashboards de conversión
│   ├── feature-flags/           # Activación de características
│   └── webhooks/                # Configuración de webhooks de salida
│
├── components/                  # Primitivas UI Reutilizables Agnósticas de Dominio
│   └── ui/                      # Radix UI + Tailwind (button, dialog, select, tabs)
│
├── hooks/                       # Custom hooks verdaderamente globales (useMediaQuery, useDebounce)
├── lib/                         # Utilidades puras (cn, formatters)
└── styles/                      # Tokens CSS y configuración global
```

### 6.1. Regla de Encapsulación entre Features
Cada feature expone una superficie pública mínima mediante su `index.ts`:

```typescript
// apps/web/src/features/testimonials/index.ts
export { TestimonialList } from './components/TestimonialList';
export { TestimonialSubmissionForm } from './components/TestimonialSubmissionForm';
export type { TestimonialViewModel } from './types/testimonial.types';
```

> [!CAUTION]
> **Prohibidos los Imports Profundos:** Ninguna otra feature debe importar rutas internas como `features/testimonials/components/internal/TestimonialRowActions.tsx`. Toda dependencia debe ingresar a través del contrato público exportado en `features/testimonials/index.ts`.

---

## 7. Jerarquía y Diseño de APIs de Componentes

```text
1. UI Primitives (src/components/ui/)
   │  Agnósticos de dominio, altamente accesibles, basados en Radix UI.
   │  Ej: Button, Input, Dialog, Select, Tabs, Tooltip.
   ▼
2. Compound Components
   │  Composición coordinada de estado compartido (e.g. Card.Header, Card.Content).
   ▼
3. Feature Components (src/features/*/components/)
   │  Conocen el dominio y reglas de negocio del producto.
   │  Ej: TestimonialCard, TestimonialApprovalBadge, WebhookDeliveryStatus.
   ▼
4. Screens / Views (src/features/*/screens/ & src/app/)
   │  Páginas y layouts que ensamblan componentes y coordinan el flujo.
```

### 7.1. Composición sobre Configuración (*Composition over Configuration*)
Evitar componentes monstruosos con decenas de props booleanas configurables:

```tsx
// ❌ ANTIPATRÓN: Explosión de props booleanas y configuraciones rígidas
<TestimonialCard
  title="Excelente servicio"
  author="Carlos Gómez"
  rating={5}
  showRating={true}
  allowApproval={true}
  compact={false}
  borderTop={true}
  theme="dark"
  headerAction={<Button>Editar</Button>}
/>

// ✅ CORRECTO: Composición declarativa con Compound Components
<Card className="border-l-4 border-l-primary">
  <CardHeader className="flex justify-between">
    <div>
      <CardTitle>Excelente servicio</CardTitle>
      <CardDescription>Carlos Gómez</CardDescription>
    </div>
    <TestimonialRating rating={5} />
  </CardHeader>
  <CardContent>
    <p>El sistema resolvió todas nuestras necesidades en minutos.</p>
  </CardContent>
  <CardFooter className="flex justify-end gap-2">
    <Button variant="outline" size="sm">Rechazar</Button>
    <Button size="sm">Aprobar</Button>
  </CardFooter>
</Card>
```

---

## 8. Modelado de Estados Imposibles con Discriminated Unions

Evitar el antipatrón de estados booleanos independientes que permiten combinaciones absurdas:

```typescript
// ❌ ESTADOS IMPOSIBLES (Permite: isLoading=true Y isError=true Y data={...}):
interface TestimonialListProps {
  isLoading: boolean;
  isError: boolean;
  isSuccess: boolean;
  data?: Testimonial[];
  errorMessage?: string;
}

// ✅ DISCRIMINATED UNIONS (La máquina de estados garantiza coherencia matemática):
export type TestimonialAsyncState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: TestimonialViewModel[] }
  | { status: 'empty' }
  | { status: 'error'; error: { code: string; message: string } };

export function TestimonialFeed({ state }: { state: TestimonialAsyncState }) {
  switch (state.status) {
    case 'idle':
      return null;
    case 'loading':
      return <TestimonialListSkeleton />;
    case 'empty':
      return <EmptyTestimonialsState />;
    case 'error':
      return <TestimonialErrorAlert message={state.error.message} />;
    case 'success':
      return (
        <ul className="space-y-4">
          {state.data.map((item) => (
            <li key={item.id}><TestimonialCard {...item} /></li>
          ))}
        </ul>
      );
  }
}
```

---

## 9. Disciplina de Estado Local-First (*State Colocation*)

### 9.1. Reglas de Gestión de Estado
1. **Colocación Inmediata:** El estado debe residir en el componente más cercano que lo necesita. Si un modal solo se abre desde un botón, el flag `isOpen` pertenece a ese componente o a su padre inmediato, jamás a un store global.
2. **Cero Estado Derivado:** Si un valor puede calcularse a partir de props o de otro estado existente, **se calcula durante el render**:

```typescript
// ❌ ANTIPATRÓN: Estado derivado sincronizado mediante useEffect
const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
const [approvedCount, setApprovedCount] = useState(0);

useEffect(() => {
  setApprovedCount(testimonials.filter((t) => t.isApproved).length);
}, [testimonials]);

// ✅ CORRECTO: Cálculo en tiempo de render (puro y sin re-renders adicionales)
const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
const approvedCount = testimonials.filter((t) => t.isApproved).length;
```

### 9.2. `useReducer` para Lógica Compleja de Transición
Cuando un estado requiere múltiples campos interdependientes, consolidar la lógica en un reducer puro:

```typescript
type FormState = {
  content: string;
  rating: number;
  isSubmitting: boolean;
  error: string | null;
};

type FormAction =
  | { type: 'SET_CONTENT'; payload: string }
  | { type: 'SET_RATING'; payload: number }
  | { type: 'SUBMIT_START' }
  | { type: 'SUBMIT_SUCCESS' }
  | { type: 'SUBMIT_FAILURE'; error: string };

function testimonialFormReducer(state: FormState, action: FormAction): FormState {
  switch (action.type) {
    case 'SET_CONTENT':
      return { ...state, content: action.payload, error: null };
    case 'SET_RATING':
      return { ...state, rating: action.payload };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, content: '', rating: 5 };
    case 'SUBMIT_FAILURE':
      return { ...state, isSubmitting: false, error: action.error };
  }
}
```

---

## 10. Modelo Mental de Hooks & Efectos Laterales

Un custom Hook sirve para **compartir lógica con estado**, no para esconder código auxiliar:
- ❌ `useFullName(first, last)` ➔ Es una simple función pura de TypeScript: `formatFullName(first, last)`.
- ❌ `useApiService()` ➔ Los clientes HTTP son módulos normales, no hooks.
- ✅ `useDebouncedValue(value, delay)` ➔ Utiliza `useState` y `useEffect` con cleanup.
- ✅ `useMediaQuery(query)` ➔ Se suscribe a `window.matchMedia` con cleanup.

### 10.1. El Propósito Estricto de `useEffect`
Pregunta obligatoria antes de escribir un `useEffect`:
> **¿Con qué sistema externo estoy sincronizando este componente?**
> - Si la respuesta es: *"Con la pantalla", "Para avisar a otro estado" o "Para cuando el usuario haga click"* ➔ **NO USES EFFECT**. Usá el event handler o calculá en render.
> - Si la respuesta es: *"Con un listener de teclado global, un observer de Resize o un WebSocket"* ➔ **USÁ EFFECT CON CLEANUP**.

```typescript
// ✅ Sincronización legítima con sistema externo y cleanup obligatorio
export function useKeyboardShortcut(key: string, callback: () => void) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === key) {
        callback();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown); // Cleanup indispensable
  }, [key, callback]);
}
```

---

## 11. Formularios y Validación en `@testimonial-cms/web`

En `apps/web`, los formularios se integran con **React Hook Form** y esquemas **Zod** para garantizar validación robusta y alto rendimiento (evitando re-renders innecesarios por cada tecla pulsada):

```tsx
// src/features/testimonials/components/TestimonialForm.tsx
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const testimonialFormSchema = z.object({
  authorName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(80),
  authorEmail: z.string().email('Ingresá un correo electrónico válido'),
  content: z.string().min(10, 'El testimonio debe tener al menos 10 caracteres').max(2000),
  rating: z.number().min(1).max(5),
});

type TestimonialFormValues = z.infer<typeof testimonialFormSchema>;

export function TestimonialForm({ onSubmit }: { onSubmit: (values: TestimonialFormValues) => Promise<void> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<TestimonialFormValues>({
    resolver: zodResolver(testimonialFormSchema),
    defaultValues: { rating: 5 },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div>
        <label htmlFor="authorName" className="block text-sm font-medium text-gray-700">
          Nombre completo
        </label>
        <Input
          id="authorName"
          {...register('authorName')}
          aria-invalid={!!errors.authorName}
          aria-describedby={errors.authorName ? 'authorName-error' : undefined}
        />
        {errors.authorName && (
          <p id="authorName-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.authorName.message}
          </p>
        )}
      </div>

      <div>
        <label htmlFor="content" className="block text-sm font-medium text-gray-700">
          Tu testimonio
        </label>
        <Textarea
          id="content"
          rows={4}
          {...register('content')}
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? 'content-error' : undefined}
        />
        {errors.content && (
          <p id="content-error" className="mt-1 text-xs text-red-600" role="alert">
            {errors.content.message}
          </p>
        )}
      </div>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Enviando...' : 'Publicar Testimonio'}
      </Button>
    </form>
  );
}
```

---

## 12. Accesibilidad de Primera Clase (WCAG 2.2 AA)

1. **HTML Semántico Nativo:**
   - Acciones que ejecutan código o abren modales ➔ `<button type="button">`.
   - Navegación que cambia de URL o pantalla ➔ `<a>` o `<Link>` de Next.js.
   - Prohibido utilizar `<div onClick={...}>` sin atributos ARIA, roles ni soporte de teclado.
2. **Navegación por Teclado:**
   - Toda acción ejecutable con mouse debe poder operarse con `Tab`, `Enter`, `Space` y cerrarse con `Escape`.
   - Modales y diálogos (`Dialog` de Radix UI) deben confinar el foco (*focus trap*) mientras estén abiertos y restaurarlo al elemento disparador al cerrarse.
3. **Nombres Accesibles:**
   - Todo botón de icono (`<Button variant="ghost"><TrashIcon /></Button>`) debe poseer un `aria-label="Eliminar testimonio"`.
   - Todos los inputs deben estar asociados a un `<label htmlFor="...">`.
4. **Sensibilidad al Movimiento:**
   - Respetar `@media (prefers-reduced-motion: reduce)` mediante las utilidades de Tailwind (`motion-reduce:transition-none`).

---

## 13. Rendimiento Basado en Medición

> **Primera Regla de Rendimiento:** No optimices código sin haber medido previamente el cuello de botella con React DevTools Profiler o Lighthouse.

- ❌ **Antipatrón Ritual:** Envolver compulsivamente cada callback en `useCallback` y cada objeto en `useMemo` sin un costo de render medible.
- ✅ **React Compiler Ready:** React 19 introduce el React Compiler que automatiza la memoización. El código limpio e idiomático permite al compilador optimizar sin intervención manual.
- ✅ **Virtualización:** Solo si una lista de testimonios o logs supera los 500 elementos visibles simultáneos, evaluar `@tanstack/react-virtual`.

---

## 14. Testing Basado en Comportamiento (Vitest + Testing Library)

Los tests deben evaluar la aplicación **desde la perspectiva del usuario final**, no inspeccionar variables de estado internas:

```typescript
// apps/web/src/features/testimonials/components/__tests__/TestimonialForm.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { TestimonialForm } from '../TestimonialForm';

describe('TestimonialForm Component', () => {
  it('muestra mensaje de error accesible cuando el nombre está vacío al enviar', async () => {
    const user = userEvent.setup();
    const handleSubmit = vi.fn();

    render(<TestimonialForm onSubmit={handleSubmit} />);

    // Simulación de interacción humana
    const submitButton = screen.getByRole('button', { name: /publicar testimonio/i });
    await user.click(submitButton);

    // Verificación por rol y texto accesible
    expect(await screen.findByRole('alert')).toHaveTextContent(/el nombre debe tener al menos 2 caracteres/i);
    expect(handleSubmit).not.toHaveBeenCalled();
  });
});
```

---

## 15. Catálogo de 30 Antipatrones en React (REACT-01 a REACT-30)

| Código | Antipatrón | Causa Común | Consecuencia en @testimonial-cms/web | Solución Profesional |
| :--- | :--- | :--- | :--- | :--- |
| **REACT-01** | Mutaciones durante render | `items.push(newItem)` en el cuerpo | Renderizados corruptos e incompatibilidad concurrente. | Mantener render 100% puro; usar copias inmutables. |
| **REACT-02** | Estado global por defecto | Instalar Zustand para todo | Acoplamiento innecesario y renders masivos de UI. | State Colocation: mantener estado local primero. |
| **REACT-03** | Context como store universal | Colocar 50 variables en un Context | Cada cambio re-renderiza todo el subárbol. | Dividir Contexts o usar estados locales/reducers. |
| **REACT-04** | Estado derivado almacenado | `const [count, setCount] = useState` | Desincronización y bugs de actualización tardía. | Calcular en render: `const count = items.length`. |
| **REACT-05** | Estado duplicado de props | `const [val, setVal] = useState(props.val)` | No se actualiza cuando la prop cambia externamente. | Usar directamente la prop o controlar el componente. |
| **REACT-06** | `useEffect` para cada lógica | Tratar Effects como watchers de Vue | Cascada de re-renders y bucles infinitos. | Ejecutar efectos exclusivamente en event handlers. |
| **REACT-07** | Custom Hook para todo | Crear `useFormatCurrency` | Boilerplate innecesario para funciones puras. | Usar funciones estándar de TypeScript en `lib/`. |
| **REACT-08** | Componentes de 1000 líneas | Dejar crecer pantallas enteras | Mantenimiento imposible y dificultad para testear. | Separar en Compound Components y Feature UI. |
| **REACT-09** | Micro-fragmentación extrema | Archivo por cada tag HTML de 3 líneas | Rastro mental roto e indeterminación de ownership. | Mantener componentes pequeños en el mismo archivo. |
| **REACT-10** | Boolean explosion en props | `<Button primary danger compact>` | Combinaciones contradictorias e imposibles. | Usar props discriminadas: `variant="danger" size="sm"`. |
| **REACT-11** | Mutar props o estado | `user.name = 'Nuevo'` directo | React no detecta el cambio; la UI no se actualiza. | `setUser(prev => ({ ...prev, name: 'Nuevo' }))`. |
| **REACT-12** | Índices de array como `key` | `items.map((it, index) => <Row key={index} />)` | Glitches visuales graves al reordenar o filtrar. | Usar identificadores únicos y estables: `key={it.id}`. |
| **REACT-13** | Definir componente dentro de otro | `function Parent() { function Child() {...} }` | Reinicio de estado y pérdida de foco en cada render. | Definir componentes siempre en el scope del módulo. |
| **REACT-14** | `useMemo` en operaciones triviales | `useMemo(() => a + b, [a, b])` | Sobrecarga de memoria mayor que el cálculo mismo. | Calcular directamente; memoizar solo tras medir. |
| **REACT-15** | `useRef` como estado de render | Cambiar `ref.current` esperando update | El DOM no se entera del cambio de valor. | Usar `useState` si el cambio debe reflejarse en la UI. |
| **REACT-16** | `<div onClick={...}>` sin semántica | Ignorar la plataforma web | Inaccesible para usuarios de teclado y lectores de pantalla. | Usar `<button type="button">`. |
| **REACT-17** | No limpiar Effects (sin cleanup) | Olvidar `removeEventListener` | Fuga de memoria y ejecución fantasma de callbacks. | Retornar siempre la función de limpieza en `useEffect`. |
| **REACT-18** | Silenciar `exhaustive-deps` | `// eslint-disable-next-line` perezoso | Bugs de valores viejos (*stale closures*) en runtime. | Reestructurar la lógica o extraer el handler. |
| **REACT-19** | Barrel files recursivos masivos | `export * from './all'` en cada nivel | Dependencias circulares y bundles gigantescos. | Barrels controlados solo en la frontera de cada feature. |
| **REACT-20** | `dangerouslySetInnerHTML` ciego | Renderizar HTML de usuario directo | Ataque crítico de Stored XSS en testimonios. | Usar renderizado nativo JSX o sanitizar con DOMPurify. |
| **REACT-21** | Testear detalles de implementación | `expect(wrapper.state('count'))` | Tests frágiles que se rompen ante cualquier refactor. | Testear interacciones de usuario con Testing Library. |
| **REACT-22** | `data-testid` como primera opción | Ignorar roles y etiquetas accesibles | No garantiza que la UI sea accesible para personas. | Usar `getByRole`, `getByLabelText`, `getByText`. |
| **REACT-23** | Spinners globales para todo | Bloquear toda la pantalla | Pérdida de contexto visual y jerarquía del layout. | Usar Skeleton components que conserven la estructura. |
| **REACT-24** | Ignorar estados vacíos (empty) | No diseñar la vista sin datos | Pantalla en blanco desconcertante para el usuario. | Proveer Empty States con acción clara de recuperación. |
| **REACT-25** | Tratar permisos de UI como seguridad | Ocultar botón y no proteger la API | Cualquier usuario con DevTools ejecuta la acción. | La seguridad reside en NestJS; la UI solo gestiona UX. |
| **REACT-26** | Acoplar DTOs directo a componentes | Pasar respuesta cruda de Prisma a UI | Si la BD cambia una columna, se rompe toda la vista. | Mapear DTO a ViewModels específicos en la feature. |
| **REACT-27** | `shared/utils/` como basurero | Archivos `helpers.ts` de 2000 líneas | Código muerto y funciones sin dueño claro. | Colocar utilidades junto a la feature que las consume. |
| **REACT-28** | Animaciones obligatorias | Ignorar `prefers-reduced-motion` | Mareos y problemas vestibulares en usuarios sensibles. | Soportar `motion-reduce:transition-none`. |
| **REACT-29** | Error Boundary ausente en widgets | Dejar que un widget rompa la página | Un fallo en un gráfico derriba todo el dashboard. | Confinar fallos en Error Boundaries por feature. |
| **REACT-30** | Optimización prematura sin medir | Agregar capas complejas de caché local | Complejidad accidental sin ganancia de rendimiento real. | Medir primero con React DevTools Profiler y Lighthouse. |

---

## 16. Protocolos Senior de Decisión

### 16.1. Protocolo para Diseñar un Componente
1. ¿Qué responsabilidad única representa este componente?
2. ¿Qué datos mínimos de entrada requiere (props explícitas)?
3. ¿Quién es el dueño lógico de su estado mutable?
4. ¿Puede este estado calcularse como valor derivado durante el render?
5. ¿Debe ser controlado o no controlado?
6. ¿Se resuelve mejor mediante composición (Compound Components) que con mega-props?
7. ¿El render es 100% puro e idempotente?
8. ¿Las acciones del usuario se resuelven en event handlers directos?
9. ¿Tiene la semántica HTML nativa adecuada (`<button>`, `<nav>`, `<article>`)?
10. ¿Funciona de forma completa utilizando únicamente el teclado?
11. ¿Están diseñados los estados de carga (`skeleton`), vacío (`empty`) y error (`alert`)?

### 16.2. Protocolo para Agregar Estado (`useState`)
1. ¿La interfaz necesita recordar este valor a lo largo de múltiples renders?
2. ¿Puede este valor calcularse a partir de props existentes? ➔ Si sí, **no agregues estado**.
3. ¿Puede calcularse a partir de otro estado ya presente? ➔ Si sí, **no agregues estado**.
4. ¿Dos componentes necesitan coordinar este valor? ➔ Si sí, **elevá el estado al ancestro común**.
5. ¿Es realmente Server State que proviene de la API? ➔ Si sí, **manejalo como estado de servidor**.

### 16.3. Protocolo para Escribir `useEffect`
1. ¿Con qué sistema o API externa al framework estoy sincronizando este componente?
2. Si no hay sistema externo ➔ **Eliminá el Effect**.
3. ¿Ocurre como consecuencia de un click o envío del usuario? ➔ **Mové la lógica al event handler**.
4. ¿Registra algún listener, timer o subscripción? ➔ **Asegurate de escribir la función de cleanup**.
5. ¿Sus dependencias son exhaustivas y estables?

---

## 17. Definition of Done (DoD) de Interfaces React

Un componente o feature en `@testimonial-cms/web` se considera terminado y listo para producción cuando:

- [ ] **Pureza:** Render 100% puro; cero mutaciones ni llamadas de red en el cuerpo del componente.
- [ ] **State Colocation:** El estado reside en el nivel más bajo posible; no existe estado derivado duplicado.
- [ ] **Compound Components:** Interfaces complejas resueltas mediante composición y primitivas de Radix UI.
- [ ] **Discriminated Unions:** Estados asíncronos tipados formalmente (`idle`, `loading`, `success`, `empty`, `error`).
- [ ] **Formularios Accesibles:** Construidos con React Hook Form, validados con Zod y con etiquetas asociadas (`htmlFor`).
- [ ] **Teclado y Foco:** Operable al 100% mediante teclado (`Tab`, `Enter`, `Space`, `Escape`); modales con focus trap.
- [ ] **Semántica Web:** Uso estricto de `<button>` para acciones y `<a>`/`<Link>` para navegación; atributos ARIA correctos.
- [ ] **Motion:** Respeta preferencias de reducción de movimiento (`prefers-reduced-motion`).
- [ ] **Error Handling:** Vistas críticas protegidas por Error Boundaries (`error.tsx`) exhibiendo código de referencia.
- [ ] **Testing:** Pruebas de integración con Vitest + Testing Library verificando flujos de usuario por rol accesible.
- [ ] **Tipado Estricto:** Código TypeScript compilando limpiamente sin `any` ni advertencias de ESLint React Hooks.

---

## 18. Cheat Sheet — 30 Reglas de Oro de React Senior

1. El render debe ser puro: mismos inputs deben producir la misma UI.
2. Cero efectos secundarios durante el render; los efectos pertenecen a los event handlers.
3. Estado local primero: mantené el estado lo más cerca posible de quien lo consume.
4. Cada dato mutable debe poseer una única fuente de verdad (Single Source of Truth).
5. Nunca guardes en el estado lo que podés calcular durante el render (cero estado derivado).
6. Elevá el estado únicamente hasta el ancestro común más cercano que lo necesite.
7. Composición sobre configuración: preferí Compound Components antes que 30 props booleanas.
8. Modelá estados imposibles con Discriminated Unions de TypeScript (`idle | loading | success | error`).
9. Un custom Hook comparte lógica con estado de React, no es un cajón de funciones auxiliares.
10. `useEffect` sirve exclusivamente para sincronizarte con sistemas externos; no para coordinar estados.
11. Las interacciones del usuario pertenecen a los event handlers (`onClick`, `onSubmit`).
12. Todo `useEffect` que registra suscripciones o listeners debe retornar una función de cleanup.
13. `useRef` es un escape hatch para foco, scroll o APIs imperativas; jamás lo uses como estado de render.
14. Usá formularios nativos controlados o React Hook Form con resolvers de Zod para validación tipada.
15. HTML semántico nativo primero: usá `<button>` para acciones y `<a>` para navegación.
16. Toda acción ejecutable con mouse debe poder operarse de forma idéntica con el teclado.
17. Todo control de formulario debe tener un `<label htmlFor="...">` asociado.
18. Respetá `@media (prefers-reduced-motion: reduce)` en todas las transiciones visuales.
19. Diseñá siempre los cinco estados: `idle`, `loading` (skeletons), `success`, `empty` y `error`.
20. Los Error Boundaries confinan fallos de render en componentes aislados sin derribar toda la aplicación.
21. Primera regla de rendimiento: no optimices ni agregues `useMemo`/`useCallback` sin medir con el Profiler.
22. Utilizá keys únicas y estables para listas dinámicas; nunca uses el índice del array si cambia el orden.
23. Nunca definas un componente dentro del cuerpo de otro componente.
24. Prohibido almacenar tokens sensibles o claves privadas en `localStorage`.
25. La interfaz visual gestiona UX; la seguridad y autorización residen de forma estricta en la API backend.
26. Desacoplá los contratos DTO de la API de los ViewModels visuales de los componentes.
27. Nunca uses `dangerouslySetInnerHTML` sobre contenido de usuario sin sanitización estricta con DOMPurify.
28. Escribí tests que se parezcan a cómo los humanos usan la app (Testing Library: `getByRole`).
29. Mantené TypeScript en modo estricto y sin `any`.
30. La interfaz más senior es la que necesita menos estado, menos efectos y menos complejidad accidental.

---

## 19. Resultado Esperado y Regla Final

Una interfaz desarrollada con excelencia Senior bajo `SKL-REACT-UI-001` es **declarativa, pura, predecible, accesible para cualquier persona, robusta ante fallos de red y fácil de razonar localmente**.

### Regla Final
> *"En React, la simplicidad no es la ausencia de funcionalidad, sino la ausencia de estado innecesario, efectos descontrolados y abstracciones ceremoniales. La mejor UI es aquella donde los datos fluyen con claridad cristalina y cada componente hace exactamente una cosa con pureza absoluta."*
