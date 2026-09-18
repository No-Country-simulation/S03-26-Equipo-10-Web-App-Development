# Feature: Testimonials Dashboard (`apps/web/src/features/testimonials/`)
# Código: SKL-PRO-001 — Nivel 3, Especificación Técnica
# Última actualización: 2026-09-18

---

## 1. Responsabilidad

Feature principal del panel de administración. Permite a admins y editores **visualizar, moderar y gestionar** el ciclo de vida de los testimonios de su tenant.

**Scope**: Solo UI del panel admin. El widget público embeddable es una feature separada (pendiente de implementar).

---

## 2. Componentes Principales

```
features/testimonials/
├── components/
│   ├── TestimonialCard/         → Tarjeta individual de testimonio
│   ├── TestimonialList/         → Lista paginada con filtros
│   ├── ModerationQueue/         → Cola de testimonios pendientes
│   ├── StatusBadge/             → Badge visual de estado (draft/pending/approved/published/rejected)
│   ├── RatingStars/             → Display de rating 1-5 estrellas
│   ├── TestimonialForm/         → Formulario crear/editar (admin)
│   └── ModerationActions/       → Botones Aprobar/Rechazar/Publicar con confirmación
├── hooks/
│   ├── useTestimonials.ts       → Fetching y mutaciones via SWR/React Query
│   ├── useModeration.ts         → Actions de moderación (approve, reject, publish)
│   └── useTestimonialFilters.ts → Estado de filtros (status, search, tags)
├── types/
│   └── testimonial.types.ts     → Tipos TypeScript del dominio frontend
└── index.ts                     → Barrel export
```

---

## 3. Páginas (App Router)

| Ruta (Next.js) | Descripción | Renderizado |
|----------------|-------------|-------------|
| `/admin/testimonials` | Lista principal con filtros | Server Component + Client islands |
| `/admin/testimonials/[id]` | Detalle + acciones de moderación | Server Component |
| `/admin/testimonials/new` | Formulario de creación admin | Client Component |
| `/admin/testimonials/[id]/edit` | Formulario de edición | Client Component |

---

## 4. Contratos de API Consumida

```typescript
// GET /api/v1/testimonials
// Query params: status?, page?, limit?, sort?
type TestimonialsListResponse = {
  data: Testimonial[];
  meta: { total: number; page: number; limit: number; totalPages: number };
};

// GET /api/v1/testimonials/:id
type TestimonialDetailResponse = { data: Testimonial };

// POST /api/v1/testimonials/:id/approve
// POST /api/v1/testimonials/:id/reject  (body: { reason?: string })
// POST /api/v1/testimonials/:id/publish
type ModerationResponse = { data: Testimonial; message: string };
```

---

## 5. Tipos Frontend

```typescript
// features/testimonials/types/testimonial.types.ts

type TestimonialStatus = 'draft' | 'pending' | 'approved' | 'published' | 'rejected';

interface Testimonial {
  id: string;
  tenantId: string;
  authorName: string;
  content: string;
  rating: 1 | 2 | 3 | 4 | 5;
  status: TestimonialStatus;
  score: number;
  categoryId?: string;
  tags: Tag[];
  media: TestimonialMedia[];
  createdAt: string; // ISO 8601
  publishedAt?: string;
}

interface Tag {
  id: string;
  name: string;
}

interface TestimonialMedia {
  id: string;
  type: 'image' | 'video';
  url: string;
}
```

---

## 6. Diseño Visual (Design System)

- **Framework**: Tailwind CSS v3 + Radix UI + next-themes
- **Paleta**: Editorial/Brutalist — Terracotta primary (`hsl(14, 74%, 54%)`), Obsidian, Oatmeal
- **Border radius**: `--radius: 0rem` (sin redondeo — estética brutalist)
- **StatusBadge**: colores semánticos por estado
  - `pending` → amarillo/ámbar
  - `approved` → verde
  - `published` → azul/índigo
  - `rejected` → rojo
  - `draft` → gris

---

## 7. Estado y Sincronización

- **Estado del servidor**: SWR o React Query (polling cada 30s en ModerationQueue)
- **Estado de filtros**: URL query params (`?status=pending&page=1`) — SSR-compatible
- **Estado local de UI**: `useState` solo para modals y confirmaciones
- **No usar** Redux, Zustand ni Context para este dominio

---

## 8. Accesibilidad (WCAG 2.2 AA)

- Botones de acción con `aria-label` descriptivos (ej: `aria-label="Aprobar testimonio de María García"`)
- `StatusBadge` no depende solo del color: incluir ícono o texto
- `RatingStars` con `aria-label="Rating: 4 de 5 estrellas"`
- Tabla de lista con `caption` y headers semánticos
- Foco gestionado al abrir/cerrar modals de confirmación

---

## 9. Reglas de Negocio Aplicables

| ID | Regla |
|----|-------|
| `BR-FLOW-001` | Solo mostrar transiciones válidas del lifecycle al actor correcto |
| `BR-VAL-001` | Mostrar error si `content.length < 10` en formulario |
| `BR-VAL-002` | Rating forzado a 1-5 entero en el componente RatingStars |

---

## 10. Historial de Cambios

| Fecha | Cambio |
|-------|--------|
| 2026-09-18 | Spec inicial creada (SKL-PRO-001) |
