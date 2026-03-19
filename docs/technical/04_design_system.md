# Sistema de Diseño Técnico

## 🎯 Propósito del Documento

Este documento define la **implementación técnica** del sistema de diseño: tokens, componentes, patrones y código reutilizable. Es la **fuente de verdad para desarrolladores frontend** y debe responder la pregunta: *"¿Cómo implemento visualmente este sistema?"*

> 💡 **Diferencia clave**:  
> - **`design_system_strategy.md`** (producto): Define el *por qué*, principios y valor de negocio del sistema de diseño  
> - **`design_system.md`** (este documento): Define el *cómo* se implementa técnicamente (tokens, componentes, código)  
> - **Storybook/Figma**: Herramientas visuales para explorar componentes  
>   
> ✅ **Regla moderna**: Este documento debe tener **ejemplos de código reales** y **enlaces al código fuente**. Si un componente no está implementado en código, no pertenece aquí.

---

## 1. Tokens de Diseño Fundamentales

El sistema de diseño se basa en Tailwind CSS con una configuración personalizada para mantener consistencia. Los tokens se definen en `tailwind.config.js` y se utilizan mediante clases utilitarias.

### 1.1. Sistema de Colores

**Paleta Semántica** (definida en `tailwind.config.js`):

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        secondary: {
          500: '#64748b',
        },
        success: {
          500: '#22c55e',
          600: '#16a34a',
        },
        warning: {
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          500: '#ef4444',
          600: '#dc2626',
        },
        info: {
          500: '#0ea5e9',
          600: '#0284c7',
        },
        surface: {
          DEFAULT: '#ffffff',
          subtle: '#f9fafb',
          elevated: '#ffffff',
        },
        text: {
          primary: '#111827',
          secondary: '#6b7280',
          tertiary: '#9ca3af',
          inverse: '#ffffff',
          disabled: '#d1d5db',
        },
        border: {
          DEFAULT: '#e5e7eb',
          subtle: '#f3f4f6',
          focus: '#3b82f6',
        },
      },
    },
  },
};
```

**Uso en componentes**:

```tsx
<button className="bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300">
  Guardar
</button>
```

### 1.2. Sistema de Tipografía

Utilizamos la escala tipográfica por defecto de Tailwind, pero definimos tokens semánticos en el archivo de configuración para mantener consistencia.

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      fontSize: {
        // Display
        'display-xl': ['3rem', { lineHeight: '1.2', fontWeight: '700' }],
        'display-lg': ['2.25rem', { lineHeight: '1.3', fontWeight: '700' }],
        // Headings
        'heading-xl': ['1.875rem', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-lg': ['1.5rem', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-md': ['1.25rem', { lineHeight: '1.5', fontWeight: '600' }],
        'heading-sm': ['1.125rem', { lineHeight: '1.5', fontWeight: '600' }],
        'heading-xs': ['1rem', { lineHeight: '1.5', fontWeight: '600' }],
        // Body
        'body-lg': ['1.125rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-md': ['1rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-sm': ['0.875rem', { lineHeight: '1.6', fontWeight: '400' }],
        'body-xs': ['0.75rem', { lineHeight: '1.6', fontWeight: '400' }],
        // Label
        'label-lg': ['1rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-md': ['0.875rem', { lineHeight: '1.4', fontWeight: '500' }],
        'label-sm': ['0.75rem', { lineHeight: '1.4', fontWeight: '500' }],
      },
    },
  },
};
```

**Uso en componentes**:

```tsx
<h1 className="text-display-xl">Título principal</h1>
<p className="text-body-md text-text-secondary">Descripción</p>
<label className="text-label-md">Nombre</label>
```

### 1.3. Sistema de Espaciado

Utilizamos la escala de espaciado por defecto de Tailwind (basada en rem, múltiplos de 4). Los tokens se usan directamente con las clases `p-{n}`, `m-{n}`, `gap-{n}`, etc.

| Token | Valor (rem) | px (base 16px) |
|-------|-------------|----------------|
| `0`   | 0           | 0px            |
| `1`   | 0.25rem     | 4px            |
| `2`   | 0.5rem      | 8px            |
| `3`   | 0.75rem     | 12px           |
| `4`   | 1rem        | 16px           |
| `5`   | 1.5rem      | 24px           |
| `6`   | 2rem        | 32px           |
| `7`   | 3rem        | 48px           |
| `8`   | 4rem        | 64px           |
| `9`   | 6rem        | 96px           |
| `10`  | 8rem        | 128px          |

**Uso**:

```tsx
<div className="p-4 m-2">
  <div className="flex gap-2">...</div>
</div>
```

### 1.4. Sistema de Radio de Borde

Tokens de border radius personalizados en `tailwind.config.js`:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      borderRadius: {
        'none': '0',
        'sm': '0.25rem',   // 4px
        'md': '0.5rem',    // 8px
        'lg': '0.75rem',   // 12px
        'xl': '1rem',      // 16px
        'full': '9999px',
      },
    },
  },
};
```

**Uso**:

```tsx
<button className="rounded-md">Botón</button>
<div className="rounded-lg shadow-md">Tarjeta</div>
```

### 1.5. Sistema de Sombras (Elevation)

Utilizamos las sombras por defecto de Tailwind y añadimos algunas personalizadas.

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
        'xl': '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
        '2xl': '0 25px 50px -12px rgb(0 0 0 / 0.25)',
        'inner': 'inset 0 2px 4px 0 rgb(0 0 0 / 0.06)',
      },
    },
  },
};
```

**Uso**:

```tsx
<div className="shadow-md hover:shadow-lg">...</div>
```

---

## 2. Componentes Atómicos

### 2.1. Button

**Propósito**: Botón principal para acciones, con variantes visuales y estados.

**Props** (TypeScript):

```tsx
export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info' | 'outline' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}
```

**Implementación** (`src/components/ui/Button.tsx`):

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

const variantStyles = {
  primary: 'bg-primary-500 text-white hover:bg-primary-600 focus:ring-primary-300 disabled:bg-primary-300',
  secondary: 'bg-surface text-text-primary border border-border hover:bg-surface-subtle focus:ring-primary-300 disabled:text-text-disabled disabled:border-border-subtle',
  success: 'bg-success-500 text-white hover:bg-success-600 focus:ring-success-300',
  error: 'bg-error-500 text-white hover:bg-error-600 focus:ring-error-300',
  warning: 'bg-warning-500 text-white hover:bg-warning-600 focus:ring-warning-300',
  info: 'bg-info-500 text-white hover:bg-info-600 focus:ring-info-300',
  outline: 'border border-primary-500 text-primary-500 hover:bg-primary-50 focus:ring-primary-300',
  ghost: 'text-text-primary hover:bg-surface-subtle focus:ring-primary-300',
};

const sizeStyles = {
  sm: 'px-2 py-1 text-label-sm min-h-[2rem]',
  md: 'px-3 py-2 text-label-md min-h-[2.5rem]',
  lg: 'px-4 py-2 text-label-lg min-h-[3rem]',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      isLoading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      children,
      className,
      disabled,
      ...props
    },
    ref
  ) => {
    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(
          'inline-flex items-center justify-center gap-1 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          isLoading && 'cursor-wait opacity-80',
          className
        )}
        {...props}
      >
        {isLoading && (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
        )}
        {!isLoading && leftIcon && <span className="inline-flex">{leftIcon}</span>}
        <span>{children}</span>
        {!isLoading && rightIcon && <span className="inline-flex">{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

**Ejemplos de uso**:

```tsx
<Button variant="primary" size="md">Guardar</Button>
<Button variant="secondary" leftIcon={<SearchIcon />}>Buscar</Button>
<Button variant="success" isLoading>Procesando...</Button>
<Button fullWidth>Full Width</Button>
```

### 2.2. TextField (Input)

**Propósito**: Campo de entrada de texto con etiqueta, mensaje de ayuda y estados de error.

**Props**:

```tsx
export type TextFieldSize = 'sm' | 'md' | 'lg';

export interface TextFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: boolean;
  errorText?: string;
  size?: TextFieldSize;
  fullWidth?: boolean;
  startAdornment?: React.ReactNode;
  endAdornment?: React.ReactNode;
}
```

**Implementación** (`src/components/ui/TextField.tsx`):

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

const sizeStyles = {
  sm: 'px-2 py-1 text-body-sm',
  md: 'px-3 py-2 text-body-md',
  lg: 'px-4 py-2 text-body-md',
};

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      helperText,
      error = false,
      errorText,
      size = 'md',
      fullWidth = false,
      startAdornment,
      endAdornment,
      className,
      id,
      ...props
    },
    ref
  ) => {
    const inputId = id || `textfield-${Math.random().toString(36).substring(2, 9)}`;
    return (
      <div className={cn('flex flex-col gap-1', fullWidth && 'w-full')}>
        {label && (
          <label htmlFor={inputId} className="text-label-md text-text-primary">
            {label}
          </label>
        )}
        <div
          className={cn(
            'flex items-center gap-2 rounded-md border bg-surface transition-colors focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500',
            error ? 'border-error-500' : 'border-border',
            sizeStyles[size]
          )}
        >
          {startAdornment && <span className="text-text-secondary">{startAdornment}</span>}
          <input
            ref={ref}
            id={inputId}
            className={cn(
              'w-full border-none bg-transparent outline-none placeholder:text-text-tertiary disabled:cursor-not-allowed disabled:opacity-50',
              className
            )}
            {...props}
          />
          {endAdornment && <span className="text-text-secondary">{endAdornment}</span>}
        </div>
        {(helperText || errorText) && (
          <span className={cn('text-body-sm', error ? 'text-error-500' : 'text-text-secondary')}>
            {error ? errorText : helperText}
          </span>
        )}
      </div>
    );
  }
);

TextField.displayName = 'TextField';
```

### 2.3. Badge / Tag

**Propósito**: Mostrar etiquetas pequeñas para categorías, estados o tags.

**Implementación** (`src/components/ui/Badge.tsx`):

```tsx
import React from 'react';
import { cn } from '@/lib/utils';

export type BadgeVariant = 'primary' | 'secondary' | 'success' | 'error' | 'warning' | 'info';

export interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

const variantStyles = {
  primary: 'bg-primary-100 text-primary-800',
  secondary: 'bg-secondary-100 text-secondary-800',
  success: 'bg-success-100 text-success-800',
  error: 'bg-error-100 text-error-800',
  warning: 'bg-warning-100 text-warning-800',
  info: 'bg-info-100 text-info-800',
};

export const Badge: React.FC<BadgeProps> = ({ variant = 'primary', children, className }) => {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variantStyles[variant],
        className
      )}
    >
      {children}
    </span>
  );
};
```

**Uso**:

```tsx
<Badge variant="success">Publicado</Badge>
<Badge variant="warning">Pendiente</Badge>
```

---

## 3. Componentes Moleculares

### 3.1. SearchBar

**Propósito**: Barra de búsqueda con input y botón, usada en el dashboard.

**Implementación** (`src/components/ui/SearchBar.tsx`):

```tsx
import React, { useState } from 'react';
import { TextField } from './TextField';
import { Button } from './Button';

export interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  fullWidth?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Buscar testimonios...',
  onSearch,
  fullWidth = false,
}) => {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <TextField
        fullWidth={fullWidth}
        placeholder={placeholder}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        endAdornment={
          query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="text-text-secondary hover:text-text-primary"
            >
              ✕
            </button>
          )
        }
      />
      <Button type="submit" variant="secondary">
        Buscar
      </Button>
    </form>
  );
};
```

### 3.2. TestimonialCard

**Propósito**: Tarjeta que muestra un testimonio en la página pública o en el dashboard.

**Implementación** (`src/components/testimonials/TestimonialCard.tsx`):

```tsx
import React from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { StarRating } from '@/components/ui/StarRating'; // componente hipotético

export interface TestimonialCardProps {
  id: string;
  author: string;
  content: string;
  rating: number;
  status?: 'published' | 'pending' | 'rejected';
  createdAt: string;
  score?: number;
  onEdit?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  author,
  content,
  rating,
  status,
  createdAt,
  score,
  onEdit,
  onApprove,
  onReject,
}) => {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <Card.Header className="flex justify-between items-start">
        <div>
          <h3 className="text-heading-sm">{author}</h3>
          <p className="text-body-sm text-text-secondary">{createdAt}</p>
        </div>
        {status && (
          <Badge
            variant={
              status === 'published'
                ? 'success'
                : status === 'pending'
                ? 'warning'
                : 'error'
            }
          >
            {status}
          </Badge>
        )}
      </Card.Header>
      <Card.Content>
        <p className="text-body-md text-text-primary">{content}</p>
        <div className="mt-2 flex items-center gap-2">
          <StarRating rating={rating} />
          <span className="text-body-sm text-text-secondary">({rating})</span>
        </div>
        {score !== undefined && (
          <div className="mt-2 text-body-sm text-text-secondary">
            Score: {score.toFixed(2)}
          </div>
        )}
      </Card.Content>
      {(onEdit || onApprove || onReject) && (
        <Card.Footer className="flex justify-end gap-2">
          {onApprove && (
            <Button size="sm" variant="success" onClick={onApprove}>
              Aprobar
            </Button>
          )}
          {onReject && (
            <Button size="sm" variant="error" onClick={onReject}>
              Rechazar
            </Button>
          )}
          {onEdit && (
            <Button size="sm" variant="outline" onClick={onEdit}>
              Editar
            </Button>
          )}
        </Card.Footer>
      )}
    </Card>
  );
};
```

### 3.3. ModerationActions

**Propósito**: Grupo de botones para moderar un testimonio (aprobar/rechazar). Puede ser un componente pequeño separado.

```tsx
// src/components/testimonials/ModerationActions.tsx
import React from 'react';
import { Button } from '@/components/ui/Button';

interface ModerationActionsProps {
  onApprove: () => void;
  onReject: () => void;
}

export const ModerationActions: React.FC<ModerationActionsProps> = ({ onApprove, onReject }) => {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="success" onClick={onApprove}>
        Aprobar
      </Button>
      <Button size="sm" variant="error" onClick={onReject}>
        Rechazar
      </Button>
    </div>
  );
};
```

---

## 4. Patrones de Layout

### 4.1. Dashboard Layout

**Propósito**: Estructura básica del panel de administración con sidebar y header.

**Implementación** (`src/components/layout/DashboardLayout.tsx`):

```tsx
import React from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-surface-subtle">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
};
```

### 4.2. Public Testimonial Grid

**Propósito**: Grilla responsiva para mostrar testimonios en páginas públicas o embebidas.

```tsx
// src/components/testimonials/TestimonialGrid.tsx
import React from 'react';
import { TestimonialCard } from './TestimonialCard';

export const TestimonialGrid: React.FC<{ testimonials: any[] }> = ({ testimonials }) => {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {testimonials.map((t) => (
        <TestimonialCard key={t.id} {...t} />
      ))}
    </div>
  );
};
```

---

## 5. Accesibilidad (WCAG 2.1 AA)

### 5.1. Requisitos de Contraste

| Elemento | Ratio Mínimo | Herramienta de Validación |
|----------|--------------|---------------------------|
| **Texto normal** | 4.5:1 | axe-core, Lighthouse |
| **Texto grande (≥18pt)** | 3:1 | axe-core, Lighthouse |
| **Texto de UI (botones)** | 3:1 | axe-core, Lighthouse |
| **Estados de foco** | 3:1 | axe-core, Lighthouse |
| **Gráficos/íconos** | 3:1 | axe-core |

### 5.2. ARIA Landmarks

```tsx
// Ejemplo de layout accesible
export const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <>
      <header role="banner" className="bg-white shadow">
        <nav role="navigation" aria-label="Navegación principal">
          {/* menú */}
        </nav>
      </header>

      <main role="main" id="main-content" className="container mx-auto p-4">
        {children}
      </main>

      <footer role="contentinfo" className="bg-gray-100 p-4 text-center">
        © YYYY Testimonial CMS
      </footer>
    </>
  );
};
```

### 5.3. Prácticas de Teclado

- Todos los elementos interactivos deben ser accesibles con tabulación (orden lógico).
- Los botones deben activarse con Enter y Espacio.
- Los campos de formulario deben tener etiquetas asociadas (`<label>` o `aria-label`).
- Los modales deben gestionar el foco y cerrarse con Escape.

---

## 6. Temas y Customización

### 6.1. Sistema de Temas (Dark Mode)

Soporte para tema oscuro mediante la clase `dark` en el elemento raíz. Tailwind maneja las variantes con `dark:`.

```js
// tailwind.config.js
module.exports = {
  darkMode: 'class',
  // ...
};
```

**Ejemplo de uso**:

```tsx
<div className="bg-surface dark:bg-gray-800 text-text-primary dark:text-gray-100">
  <p className="text-text-secondary dark:text-gray-400">Contenido</p>
</div>
```

Se puede implementar un selector de tema que añada/elimine la clase `dark` en el `html`.

---

## 7. Checklist de Calidad para Componentes

Antes de considerar un componente completo, verifica:

### ✅ Funcionalidad
- [ ] Props tipados con TypeScript
- [ ] Manejo correcto de estados (hover, focus, active, disabled)
- [ ] Soporte para todos los tamaños y variantes documentados
- [ ] Comportamiento predecible en todos los navegadores

### ✅ Accesibilidad
- [ ] ARIA labels y roles correctos
- [ ] Navegación por teclado completa (Tab, Enter, Space, Esc)
- [ ] Contraste WCAG 2.1 AA cumplido
- [ ] Compatible con lectores de pantalla (VoiceOver, NVDA, JAWS)

### ✅ Estilo y Diseño
- [ ] Usa tokens de diseño (clases de Tailwind basadas en configuración)
- [ ] Transiciones suaves (200-300ms)
- [ ] Responsive (funciona en móvil, tablet, desktop)
- [ ] Consistente con otros componentes del sistema

### ✅ Código y Mantenimiento
- [ ] Código limpio y bien documentado
- [ ] Tests unitarios y de integración (con Jest y Testing Library)
- [ ] Storybook stories completos (si se usa)
- [ ] Ejemplos de uso claros en la documentación

---

## 📄 Plantilla Resumida para Nuevo Componente

```markdown
### Componente: `[NombreComponente]`

**Propósito**: [Descripción clara]

**Props**:

| Prop | Tipo | Predeterminado | Descripción |
|------|------|----------------|-------------|
|      |      |                |             |

**Ejemplo de Uso**:

```tsx
import { NombreComponente } from './NombreComponente';

function Example() {
  return <NombreComponente />;
}
```

**Variantes**:
- ✅ [Variante 1]
- ✅ [Variante 2]

**Estados**:
- ✅ Normal
- ✅ Hover
- ✅ Focus
- ✅ Active
- ✅ Disabled
- ✅ Loading

**Accesibilidad**:
- ✅ [Requisito 1]
- ✅ [Requisito 2]

**Enlace al código**: [`ruta/al/componente.tsx`](../../ruta/al/componente.tsx)
```

---

> **Nota final**: El sistema de diseño técnico debe evolucionar junto con el producto. Revisa y actualiza este documento con cada nueva versión del sistema de diseño. Los componentes obsoletos deben ser marcados como deprecated antes de ser eliminados.