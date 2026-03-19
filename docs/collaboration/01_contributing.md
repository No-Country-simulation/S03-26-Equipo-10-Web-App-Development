# Guía para Contribuir a Testimonial CMS

¡Gracias por tu interés en contribuir a **Testimonial CMS**! 🎉

Este documento contiene todo lo que necesitas saber para contribuir de manera efectiva al proyecto. Ya sea que seas nuevo en el proyecto o un colaborador experimentado, esta guía te ayudará a entender cómo participar.

## Tabla de Contenidos

- [Cómo Contribuir](#cómo-contribuir)
- [Requisitos Previos](#requisitos-previos)
- [Setup Inicial](#setup-inicial)
- [Proceso de Contribución](#proceso-de-contribución)
- [Estándares de Código](#estándares-de-código)
- [Testing](#testing)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Documentación](#documentación)
- [Código de Conducta](#código-de-conducta)
- [Preguntas Frecuentes](#preguntas-frecuentes)

---

## Cómo Contribuir

Hay muchas formas de contribuir al proyecto:

### 🐛 Reportar Bugs

Si encuentras un bug, por favor abre un issue con:
- Título claro y descriptivo
- Pasos para reproducir el problema
- Comportamiento esperado vs. actual
- Capturas de pantalla si es relevante
- Información de entorno (SO, versión de Node.js, navegador, etc.)

### 💡 Sugerir Mejoras o Nuevas Funcionalidades

Para sugerir mejoras o nuevas funcionalidades:
- Abre un issue con la etiqueta `enhancement`
- Describe el problema que estás tratando de resolver
- Explica por qué es importante
- Proporciona ejemplos de uso
- Considera alternativas y por qué tu solución es mejor

### 📝 Mejorar Documentación

La documentación es tan importante como el código:
- Corregir errores tipográficos
- Mejorar claridad y ejemplos
- Agregar documentación faltante
- Actualizar documentación obsoleta
- Traducir a otros idiomas

### 🧪 Escribir Tests

Los tests son cruciales para la calidad:
- Agregar tests para nuevas funcionalidades
- Mejorar cobertura de tests existentes
- Corregir tests fallidos
- Agregar tests de regresión

### 💻 Contribuir con Código

Para contribuir con código:
1. Elige un issue existente o abre uno nuevo
2. Comenta en el issue que quieres trabajar en él
3. Sigue el [Proceso de Contribución](#proceso-de-contribución)
4. Envía un Pull Request

### 🌐 Ayudar con la Comunidad

También puedes ayudar respondiendo preguntas:
- En issues abiertos
- En el canal de Discord/Slack
- En foros de discusión

---

## Requisitos Previos

### Herramientas Requeridas

| Herramienta | Versión Mínima | Instalación |
|-------------|----------------|-------------|
| **Node.js** | 20.x | [nvm](https://github.com/nvm-sh/nvm) o [official installer](https://nodejs.org/) |
| **npm** | 10.x | Viene con Node.js |
| **Git** | 2.30+ | [git-scm.com](https://git-scm.com/) |
| **Docker** | 24.x | [docker.com](https://www.docker.com/) |
| **Docker Compose** | 2.x | Viene con Docker Desktop |
| **PostgreSQL** | 16 (usar Docker recomendado) | [postgresql.org](https://www.postgresql.org/) |
| **Redis** | 7.x (usar Docker recomendado) | [redis.io](https://redis.io/) |

### Conocimientos Recomendados

- **TypeScript** 5.x
- **NestJS** 10.x (backend)
- **Next.js** 14.x (frontend)
- **React** 18.x (frontend)
- **Prisma** 5.x (ORM)
- **Tailwind CSS** 3.x (estilos)
- **Vitest** (testing unitario)
- **Playwright** (testing E2E)
- Git y GitHub workflows

---

## Setup Inicial

### 1. Fork y Clonar el Repositorio

```bash
# Fork el repositorio usando la interfaz de GitHub
# Luego clona tu fork
git clone https://github.com/tu-usuario/testimonial-cms.git
cd testimonial-cms

# Configura upstream para mantener tu fork sincronizado
git remote add upstream https://github.com/organizacion/testimonial-cms.git
```

### 2. Instalar Dependencias

El proyecto usa un monorepo con workspaces de npm. Instala todas las dependencias desde la raíz:

```bash
npm install
```

### 3. Configurar Variables de Entorno

Copia los archivos de ejemplo y edítalos con tus valores:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/frontend/.env.example apps/frontend/.env
```

**Variables principales en `.env` (raíz):**
- `DATABASE_URL`: Conexión a PostgreSQL (ej. `postgresql://user:pass@localhost:5432/testimonial_cms_dev`)
- `REDIS_URL`: Conexión a Redis (ej. `redis://localhost:6379`)
- `JWT_SECRET`: Secreto para firmar tokens JWT
- `CLOUDINARY_URL`: Credenciales de Cloudinary
- `YOUTUBE_API_KEY`: API Key de YouTube (opcional)

### 4. Levantar Servicios con Docker (opcional pero recomendado)

Para desarrollo local, puedes usar Docker Compose para levantar PostgreSQL y Redis:

```bash
docker-compose up -d
```

Esto iniciará:
- PostgreSQL en `localhost:5432`
- Redis en `localhost:6379`

### 5. Ejecutar Migraciones de Base de Datos

```bash
npx prisma migrate dev
```

Esto aplicará las migraciones y generará el cliente Prisma.

### 6. Iniciar el Entorno de Desarrollo

El proyecto tiene dos aplicaciones: backend (API) y frontend (dashboard). Puedes ejecutar ambas con un solo comando desde la raíz:

```bash
npm run dev
```

Esto iniciará:
- API en `http://localhost:3000`
- Frontend en `http://localhost:3001`

### 7. Verificar que Todo Funciona

```bash
# Ejecutar tests
npm test

# Verificar que la API responde
curl http://localhost:3000/api/v1/health

# Abrir el frontend en el navegador
open http://localhost:3001
```

---

## Proceso de Contribución

### Diagrama de Flujo de Contribución

```mermaid
flowchart TD
    A[Identificar Issue o<br>Nueva Funcionalidad] --> B{Issue Existe?}
    
    B -->|No| C[Abrir Nuevo Issue<br>con Template]
    B -->|Sí| D[Comentar en Issue<br>para Asignación]
    
    C --> E[Esperar Aprobación<br>del Mantenedor]
    D --> E
    
    E --> F{Aprobado?}
    F -->|No| G[Refinar Propuesta]
    G --> E
    
    F -->|Sí| H[Crear Branch<br>con Nombre Descriptivo]
    
    H --> I[Implementar Cambios<br>Siguiendo Estándares]
    I --> J[Ejecutar Tests<br>y Verificar]
    J --> K[Commit con<br>Conventional Commits]
    K --> L[Abrir Pull Request<br>con Template]
    L --> M{Revisión del Equipo}
    
    M -->|Cambios Solicitados| N[Realizar Cambios<br>Solicitados]
    N --> J
    
    M -->|Aprobado| O[Merge a Main<br>por Mantenedor]
    O --> P[Eliminar Branch<br>y Celebrar! 🎉]
```

### Pasos Detallados

#### 1. Buscar o Abrir un Issue

- Busca en [issues existentes](https://github.com/organizacion/testimonial-cms/issues) para evitar duplicados.
- Si no existe, [abre un nuevo issue](https://github.com/organizacion/testimonial-cms/issues/new/choose) usando el template apropiado.
- Espera aprobación del equipo antes de empezar a trabajar.

#### 2. Mantener tu Fork Sincronizado

```bash
# Antes de empezar a trabajar, sincroniza tu fork
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
```

#### 3. Crear una Branch

Usa un nombre de branch descriptivo que siga el patrón:

```
tipo/numero-issue-descripcion-corta

Ejemplos:
- feat/123-add-user-authentication
- fix/456-fix-login-error
- docs/789-update-readme
- test/101-add-unit-tests
```

```bash
git checkout -b feat/123-add-testimonial-rating
```

#### 4. Implementar los Cambios

- Sigue los [Estándares de Código](#estándares-de-código).
- Escribe tests para tu código.
- Documenta tu código con comentarios claros.
- Actualiza la documentación si es necesario.

#### 5. Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Ejecutar tests con cobertura
npm run test:coverage

# Ejecutar tests en modo watch (durante desarrollo)
npm run test:watch

# Ejecutar solo tests unitarios
npm run test:unit

# Ejecutar solo tests de integración
npm run test:integration

# Ejecutar solo tests E2E (requiere entorno completo)
npm run test:e2e
```

#### 6. Commit con Conventional Commits

Usa el formato [Conventional Commits](https://www.conventionalcommits.org/).

**Ejemplos:**
```bash
git commit -m "feat(api): add JWT authentication for API keys"

git commit -m "fix(embed): resolve issue with iframe resizing

- Add resizeObserver to adapt to content height
- Update tests for embed component
- Bump version to 1.2.3

Closes #456"
```

#### 7. Push y Abrir Pull Request

```bash
git push origin feat/123-add-testimonial-rating
```

Luego abre un Pull Request en GitHub usando el [template](#pull-requests).

---

## Estándares de Código

### TypeScript/JavaScript

#### Estilo General

- Usa **TypeScript** en todo el código (backend y frontend).
- Usa **ESLint** con configuración del proyecto.
- Usa **Prettier** para formateo.
- Usa **camelCase** para variables y funciones.
- Usa **PascalCase** para clases, interfaces y tipos.
- Usa **UPPER_CASE** para constantes globales.

#### Ejemplo de Código (Backend - NestJS)

```typescript
// ✅ BUENO: Con tipos explícitos y comentarios
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { Testimonial } from '@prisma/client';

@Injectable()
export class TestimonialsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Crea un nuevo testimonio para un tenant específico.
   * @param tenantId - ID del tenant
   * @param dto - Datos del testimonio
   * @returns El testimonio creado
   */
  async create(tenantId: string, dto: CreateTestimonialDto): Promise<Testimonial> {
    const testimonial = await this.prisma.testimonial.create({
      data: {
        tenantId,
        ...dto,
        status: 'draft',
      },
    });
    return testimonial;
  }

  /**
   * Obtiene un testimonio por ID, verificando que pertenezca al tenant.
   * @param id - ID del testimonio
   * @param tenantId - ID del tenant
   * @returns El testimonio
   * @throws NotFoundException si no existe o no pertenece al tenant
   */
  async findOne(id: string, tenantId: string): Promise<Testimonial> {
    const testimonial = await this.prisma.testimonial.findFirst({
      where: { id, tenantId },
    });
    if (!testimonial) {
      throw new NotFoundException(`Testimonial with ID ${id} not found`);
    }
    return testimonial;
  }
}

// ❌ MALO: Sin tipos, sin manejo de errores
export class TestimonialsService {
  constructor(private prisma) {}

  async create(tenantId, dto) {
    return this.prisma.testimonial.create({
      data: { tenantId, ...dto, status: 'draft' },
    });
  }

  async findOne(id, tenantId) {
    return this.prisma.testimonial.findFirst({ where: { id, tenantId } });
  }
}
```

#### Ejemplo de Código (Frontend - React/Next.js)

```tsx
// ✅ BUENO: Componente funcional con TypeScript
import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Testimonial } from '@/types';

interface TestimonialCardProps {
  testimonial: Testimonial;
  onEdit?: () => void;
}

export const TestimonialCard: React.FC<TestimonialCardProps> = ({
  testimonial,
  onEdit,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/testimonials/${testimonial.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['testimonials'] });
    },
  });

  return (
    <Card className="p-4 hover:shadow-lg transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-semibold">{testimonial.authorName}</h3>
          <div className="flex items-center gap-1 text-yellow-500">
            {'★'.repeat(testimonial.rating)}
            {'☆'.repeat(5 - testimonial.rating)}
          </div>
        </div>
        <div className="flex gap-2">
          {onEdit && (
            <Button variant="ghost" size="sm" onClick={onEdit}>
              Editar
            </Button>
          )}
          <Button
            variant="destructive"
            size="sm"
            onClick={() => deleteMutation.mutate()}
            disabled={deleteMutation.isPending}
          >
            Eliminar
          </Button>
        </div>
      </div>

      <p className="mt-2 text-gray-700">
        {isExpanded
          ? testimonial.content
          : testimonial.content.slice(0, 150) + '...'}
      </p>
      {testimonial.content.length > 150 && (
        <button
          className="text-primary-600 text-sm mt-1 hover:underline"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? 'Mostrar menos' : 'Leer más'}
        </button>
      )}
      {testimonial.mediaUrl && (
        <div className="mt-3">
          <img
            src={testimonial.mediaUrl}
            alt="Testimonial media"
            className="rounded-md max-h-48 object-cover"
          />
        </div>
      )}
    </Card>
  );
};
```

### Importaciones

Usa alias configurados (`@` para src) para mantener las importaciones limpias.

```typescript
// ✅ BUENO
import { TestimonialService } from '@/services/testimonial.service';
import { Card } from '@/components/ui/card';
import { formatDate } from '@/utils/date';

// ❌ MALO
import { TestimonialService } from '../../../services/testimonial.service';
```

### SQL (en migraciones Prisma)

```prisma
// ✅ BUENO: Schema Prisma con comentarios
model Testimonial {
  id          String   @id @default(uuid())
  tenantId    String   @map("tenant_id")
  authorName  String   @map("author_name")
  content     String
  rating      Int
  mediaUrl    String?  @map("media_url")
  mediaType   String?  @map("media_type")
  status      TestimonialStatus @default(draft)
  score       Float    @default(0)
  createdAt   DateTime @default(now()) @map("created_at")
  publishedAt DateTime? @map("published_at")
  tenant      Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, authorName])
  @@index([tenantId, status])
  @@index([score(sort: Desc)])
  @@map("testimonials")
}
```

---

## Testing

### Estructura de Tests

```
tests/
├── unit/                      # Tests unitarios
│   ├── api/
│   ├── services/
│   └── utils/
├── integration/                # Tests de integración
│   ├── api/
│   ├── database/
│   └── webhooks/
├── e2e/                        # Tests end-to-end (Playwright)
│   ├── dashboard/
│   └── embed/
└── fixtures/                   # Datos de prueba
    ├── testimonials.json
    ├── tenants.json
    └── users.json
```

### Ejemplos de Tests

#### Test Unitario (Backend)

```typescript
// tests/unit/services/scoring.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { ScoringService } from '@/services/scoring.service';
import { WeightedScoringStrategy } from '@/strategies/weighted-scoring.strategy';
import type { Testimonial, AnalyticsEvent } from '@/types';

describe('ScoringService', () => {
  let scoringService: ScoringService;

  beforeEach(() => {
    const strategy = new WeightedScoringStrategy();
    scoringService = new ScoringService(strategy);
  });

  it('should calculate score based on views, clicks and rating', async () => {
    const testimonial: Testimonial = {
      id: '123',
      tenantId: 'tenant-1',
      authorName: 'Juan',
      content: 'Excelente',
      rating: 5,
      status: 'published',
      publishedAt: new Date('YYYY-MM-DD'),
      createdAt: new Date('YYYY-MM-DD'),
    };
    const events: AnalyticsEvent[] = [
      { id: 'e1', testimonialId: '123', type: 'view', createdAt: new Date() },
      { id: 'e2', testimonialId: '123', type: 'view', createdAt: new Date() },
      { id: 'e3', testimonialId: '123', type: 'click', createdAt: new Date() },
    ];

    const score = await scoringService.calculateScore(testimonial, events);
    expect(score).toBeGreaterThan(0);
  });
});
```

#### Test de Integración (API)

```typescript
// tests/integration/api/testimonials.api.spec.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '@/app';
import { prisma } from '@/lib/prisma';
import { createTestTenant, createTestUser } from '../helpers/fixtures';

describe('Testimonials API', () => {
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    tenantId = await createTestTenant(prisma, 'Test Tenant');
    const userId = await createTestUser(prisma, tenantId, 'admin@test.com', 'admin');
    authToken = generateTestToken(userId, tenantId, 'admin');
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await prisma.testimonial.deleteMany({ where: { tenantId } });
  });

  describe('POST /api/v1/testimonials', () => {
    it('should create a new testimonial', async () => {
      const newTestimonial = {
        authorName: 'Juan Pérez',
        content: 'Excelente curso, lo recomiendo ampliamente.',
        rating: 5,
      };

      const response = await request(app)
        .post('/api/v1/testimonials')
        .set('Authorization', `Bearer ${authToken}`)
        .send(newTestimonial);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.authorName).toBe(newTestimonial.authorName);
    });
  });
});
```

### Ejecutar Tests

```bash
# Ejecutar todos los tests
npm test

# Tests con cobertura
npm run test:coverage

# Modo watch (durante desarrollo)
npm run test:watch

# Tests específicos
npm test -- -t "should create a new testimonial"
```

---

## Commit Messages

Usamos el formato [Conventional Commits](https://www.conventionalcommits.org/).

### Tipos de Commit

| Tipo | Descripción | Ejemplo |
|------|-------------|---------|
| **feat** | Nueva funcionalidad | `feat(api): add JWT authentication` |
| **fix** | Corrección de bug | `fix(embed): resolve iframe height issue` |
| **docs** | Cambios en documentación | `docs: update installation guide` |
| **style** | Formateo, cambios sin efecto en código | `style: format code with prettier` |
| **refactor** | Refactorización de código | `refactor: extract scoring strategy` |
| **test** | Agregar o modificar tests | `test: add unit tests for scoring` |
| **chore** | Tareas de mantenimiento | `chore: update dependencies` |
| **perf** | Mejoras de rendimiento | `perf: optimize database queries` |

### Ejemplos

```bash
# Buen commit
git commit -m "feat(api): add endpoint to moderate testimonials"

# Con cuerpo y referencia a issue
git commit -m "fix(ui): prevent double submission of testimonial form

- Disable submit button after first click
- Add loading state indicator
- Update tests for form component

Closes #234"
```

---

## Pull Requests

### Template de Pull Request

```markdown
## Descripción

[Describe brevemente los cambios realizados]

## Tipo de Cambio

- [ ] Bug fix (corrección de bug no-breaking)
- [ ] Nueva funcionalidad (cambio no-breaking)
- [ ] Breaking change (corrección o funcionalidad que cambia la API existente)
- [ ] Documentación
- [ ] Otro (especificar):

## Checklist

- [ ] He leído y seguido las [guías de contribución](CONTRIBUTING.md)
- [ ] Mi código sigue los [estándares de código](CONTRIBUTING.md#estándares-de-código)
- [ ] He escrito tests para mis cambios
- [ ] Todos los tests existentes pasan (`npm test`)
- [ ] He actualizado la documentación si es necesario
- [ ] He actualizado los tipos/definiciones de TypeScript si es necesario

## Capturas de Pantalla (si aplica)

[Incluye capturas de pantalla de los cambios visuales]

## Issues Relacionados

Closes #[número-del-issue]

## Notas Adicionales

[Cualquier información adicional relevante]
```

### Buenas Prácticas para PRs

- **Mantén PRs pequeños**: Idealmente < 500 líneas.
- **Un PR por funcionalidad**: No mezcles cambios no relacionados.
- **Escribe títulos claros**: El título debe describir qué hace el PR.
- **Responde a comentarios rápidamente**: Mantén la conversación activa.
- **Sé receptivo al feedback**: Las revisiones son para mejorar la calidad.

---

## Documentación

### Estilo de Escritura

- Usa **inglés** para código y comentarios (nombres de variables, funciones, etc.).
- Usa **español** para documentación de usuario (README, guías, comentarios en PRs).
- Sé **claro y conciso**.
- Usa **ejemplos concretos**.
- Incluye **capturas de pantalla** cuando sea relevante.
- Usa **formato markdown** correctamente.

### Estructura de Documentación

```
docs/
├── README.md                    # Documentación principal
├── CONTRIBUTING.md              # Esta guía
├── CODE_OF_CONDUCT.md           # Código de conducta
├── CHANGELOG.md                 # Historial de cambios
├── api/                         # Documentación de API (OpenAPI)
│   ├── endpoints.md
│   └── authentication.md
├── guides/                      # Guías paso a paso
│   ├── getting-started.md
│   ├── embed-widget.md
│   └── webhooks.md
└── examples/                    # Ejemplos de código
    ├── basic-usage.md
    └── advanced-scoring.md
```

---

## Código de Conducta

Esperamos que todos los colaboradores sigan nuestro [Código de Conducta](CODE_OF_CONDUCT.md). Por favor, léelo antes de contribuir.

**Resumen**:
- Sé respetuoso y considerado.
- No toleramos acoso ni discriminación.
- Acepta críticas constructivas.
- Enfócate en lo que es mejor para la comunidad.

---

## Preguntas Frecuentes

### ¿Necesito permiso para trabajar en un issue?

Sí, por favor comenta en el issue que quieres trabajar en él antes de empezar. Esto evita que múltiples personas trabajen en el mismo issue.

### ¿Puedo trabajar en un issue que no está etiquetado como "good first issue"?

¡Absolutamente! Los issues etiquetados como "good first issue" son solo recomendaciones para nuevos contribuidores. Siéntete libre de trabajar en cualquier issue que te interese.

### ¿Qué pasa si mi PR no es aprobado?

No te preocupes. La mayoría de los PRs requieren algunas iteraciones antes de ser aprobados. El equipo te dará feedback constructivo para mejorar tu código. Tómate el tiempo para hacer los cambios solicitados.

### ¿Cómo puedo obtener ayuda?

- Abre un issue con la etiqueta `question`.
- Únete a nuestro [Discord](https://discord.gg/testimonialcms) (enlace pendiente).
- Escribe a [support@testimonialcms.com](mailto:support@testimonialcms.com).

### ¿Puedo sugerir nuevas funcionalidades?

¡Sí! Abre un issue con la etiqueta `enhancement` y describe tu idea. El equipo revisará tu propuesta y discutirá su viabilidad.

### ¿Hay algún programa de recompensas para contribuidores?

Actualmente no tenemos un programa formal de recompensas, pero reconocemos contribuidores destacados en nuestro README y consideramos contribuidores activos para roles de mantenedor.

---

## Agradecimientos

¡Gracias a todos los contribuidores que han hecho posible este proyecto!

[Lista de contribuidores](https://github.com/organizacion/testimonial-cms/graphs/contributors)

---

## Licencia

Este proyecto está licenciado bajo la [MIT License](LICENSE).

---

**¡Feliz Contribución! 🚀**