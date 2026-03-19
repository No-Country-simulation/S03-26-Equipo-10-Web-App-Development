# Estrategia de Testing

## 🎯 Propósito del Documento

Este documento define la **estrategia de testing completa** del sistema: tipos de pruebas, herramientas, estructura, cobertura requerida y procesos de integración continua. Es la **guía definitiva para QA y desarrolladores** sobre cómo escribir, ejecutar y mantener pruebas efectivas.

> 💡 **Diferencia clave**:  
> - **`testing.md`** (este documento): Define la *estrategia global*, herramientas, estructura y requisitos de testing  
> - **Tests unitarios**: Código que prueba unidades individuales  
> - **Tests de integración**: Código que prueba interacciones entre componentes  
> - **Tests E2E**: Código que prueba flujos completos de usuario  
>   
> ✅ **Regla moderna**: Este documento debe ser **ejecutable**. Si defines un requisito de cobertura del 80%, debe haber un script automático que lo verifique.

---

## 1. Visión General y Filosofía

### 1.1. Principios Fundamentales

| Principio | Descripción | Impacto en el Proyecto |
|-----------|-------------|------------------------|
| **Test-Driven Development (TDD)** | Escribir tests antes del código de producción | Mayor calidad, diseño más limpio, menos bugs (aplicado en casos críticos como scoring y webhooks) |
| **Shift-Left Testing** | Integrar testing temprano en el ciclo de desarrollo | Detección temprana de bugs, menor costo de corrección |
| **Automatización Máxima** | Automatizar todo lo que sea repetible y determinista | Mayor velocidad, consistencia, liberación de recursos humanos |
| **Pyramid Testing** | Más tests unitarios, menos E2E | Mantenimiento eficiente, feedback rápido |
| **Quality Gates** | Requisitos de calidad obligatorios antes de merge | Prevenir regresiones, mantener estándares |

### 1.2. Pirámide de Testing

```mermaid
flowchart TD
    subgraph E2E["Tests E2E (5-10%)"]
        E1[Flujos completos de usuario]
        E2[Integración frontend-backend]
        E3[Embed en sitio externo]
    end
    
    subgraph Integration["Tests de Integración (15-20%)"]
        I1[APIs REST]
        I2[Servicios con DB real]
        I3[Repositorios]
        I4[Integración con Cloudinary/YouTube]
    end
    
    subgraph Unit["Tests Unitarios (70-80%)"]
        U1[Lógica de negocio (scoring, validaciones)]
        U2[Utilidades]
        U3[DTOs / mappers]
        U4[Estrategias (strategy pattern)]
    end
    
    Unit --> Integration
    Integration --> E2E
```

**Distribución recomendada**:
- **Tests Unitarios**: 70-80% del total
- **Tests de Integración**: 15-20% del total
- **Tests E2E**: 5-10% del total

**Razón**: Los tests unitarios son más rápidos, fáciles de mantener y dan feedback inmediato. Los tests E2E validan flujos completos pero son más lentos y frágiles.

---

## 2. Tipos de Tests y Herramientas

### 2.1. Tests Unitarios

**Propósito**: Probar unidades individuales de código (funciones, clases, servicios) en aislamiento.

**Herramientas**:
- **Framework**: **Vitest** (recomendado por su velocidad y compatibilidad con Vite/Next.js) o **Jest**.
- **Assertions**: `expect` de Vitest.
- **Mocking**: `vi` (built-in en Vitest) para funciones, módulos y timers.

**Características**:
- ✅ Rápidos (< 10ms por test)
- ✅ Aislados (no dependen de red, DB, filesystem)
- ✅ Deterministas
- ✅ Fáciles de mantener

**Estructura de archivo** (siguiendo patrón AAA: Arrange-Act-Assert):

```typescript
// src/domain/testimonials/services/scoring.service.spec.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScoringService } from './scoring.service';
import { WeightedScoringStrategy } from '../strategies/weighted-scoring.strategy';
import type { Testimonial, AnalyticsEvent } from '../entities';

// Mock de dependencias (opcional, pero aquí usamos la estrategia real y mockeamos eventos)
describe('ScoringService', () => {
  let scoringService: ScoringService;
  let mockStrategy: WeightedScoringStrategy;

  beforeEach(() => {
    // Podemos inyectar una estrategia real o mockeada
    mockStrategy = new WeightedScoringStrategy();
    scoringService = new ScoringService(mockStrategy);
  });

  describe('calculateScore', () => {
    it('should calculate score based on views, clicks, rating and recency', async () => {
      // Arrange
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

      // Act
      const score = await scoringService.calculateScore(testimonial, events);

      // Assert
      expect(score).toBeGreaterThan(0);
      // Podríamos comprobar un valor esperado si conocemos la fórmula exacta
      // pero al menos verificamos que es un número y que se llamó a la estrategia
    });

    it('should return 0 if no events', async () => {
      // Arrange
      const testimonial: Testimonial = {
        id: '123',
        tenantId: 'tenant-1',
        authorName: 'Juan',
        content: 'Excelente',
        rating: 5,
        status: 'published',
        publishedAt: new Date(),
        createdAt: new Date(),
      };
      const events: AnalyticsEvent[] = [];

      // Act
      const score = await scoringService.calculateScore(testimonial, events);

      // Assert
      expect(score).toBe(0);
    });

    it('should use recency factor: older testimonial gets lower score', async () => {
      // Arrange
      const recentTestimonial: Testimonial = { /* ... publishedAt: now */ } as any;
      const oldTestimonial: Testimonial = { /* ... publishedAt: one month ago */ } as any;
      const events: AnalyticsEvent[] = [ /* mismos eventos para ambos */ ];

      // Act
      const recentScore = await scoringService.calculateScore(recentTestimonial, events);
      const oldScore = await scoringService.calculateScore(oldTestimonial, events);

      // Assert
      expect(recentScore).toBeGreaterThan(oldScore);
    });
  });
});
```

**Ejemplo de test unitario para un validador**:

```typescript
// src/domain/testimonials/validators/testimonial.validator.spec.ts

import { TestimonialValidator } from './testimonial.validator';

describe('TestimonialValidator', () => {
  describe('validateContent', () => {
    it('should return true for content with at least 10 characters', () => {
      expect(TestimonialValidator.validateContent('Válido mínimo')).toBe(true);
    });

    it('should return false for content shorter than 10 characters', () => {
      expect(TestimonialValidator.validateContent('Corto')).toBe(false);
    });

    it('should return false for empty content', () => {
      expect(TestimonialValidator.validateContent('')).toBe(false);
    });
  });

  describe('validateRating', () => {
    it('should return true for rating between 1 and 5', () => {
      expect(TestimonialValidator.validateRating(3)).toBe(true);
      expect(TestimonialValidator.validateRating(1)).toBe(true);
      expect(TestimonialValidator.validateRating(5)).toBe(true);
    });

    it('should return false for rating out of range', () => {
      expect(TestimonialValidator.validateRating(0)).toBe(false);
      expect(TestimonialValidator.validateRating(6)).toBe(false);
    });
  });
});
```

**Comandos** (definidos en `package.json`):
```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run --dir src/domain",
    "test:unit:watch": "vitest --dir src/domain",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

### 2.2. Tests de Integración

**Propósito**: Probar la interacción entre múltiples capas: controladores, servicios, repositorios con base de datos real, APIs externas mockeadas (Cloudinary, YouTube).

**Herramientas**:
- **Framework**: Vitest (o Jest) con **Supertest** para pruebas de API.
- **Base de Datos**: **PostgreSQL** en un contenedor Docker (o base de datos de prueba dedicada).
- **ORM**: Prisma con `prisma.test-client` o migraciones específicas para test.
- **Mocks de servicios externos**: **MSW** (Mock Service Worker) para simular HTTP calls a Cloudinary/YouTube.

**Características**:
- ✅ Más lentos que unitarios (10ms - 1s)
- ✅ Requieren setup de dependencias (DB, cache, etc.)
- ✅ Prueban integración real entre componentes
- ✅ Necesitan limpieza después de ejecución

**Estructura de archivo**:

```typescript
// tests/integration/testimonials.controller.int.spec.ts

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';
import { generateTestToken } from '../helpers/auth.helper';
import { createTestTenant, createTestUser } from '../helpers/fixtures';

describe('Testimonials Controller (Integration)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tenantId: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = app.get(PrismaService);

    // Crear tenant y usuario de prueba
    tenantId = await createTestTenant(prisma, 'Test Tenant');
    const userId = await createTestUser(prisma, tenantId, 'admin@test.com', 'admin');
    adminToken = generateTestToken(userId, tenantId, 'admin');
  });

  afterAll(async () => {
    await prisma.$disconnect();
    await app.close();
  });

  beforeEach(async () => {
    // Limpiar testimonios antes de cada test
    await prisma.testimonial.deleteMany({ where: { tenantId } });
  });

  describe('POST /api/v1/testimonials', () => {
    it('should create a new testimonial', async () => {
      // Arrange
      const newTestimonial = {
        authorName: 'Juan Pérez',
        content: 'Excelente curso, lo recomiendo ampliamente.',
        rating: 5,
        mediaUrl: 'https://example.com/image.jpg',
        mediaType: 'image',
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/testimonials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newTestimonial);

      // Assert
      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('id');
      expect(response.body.authorName).toBe(newTestimonial.authorName);
      expect(response.body.status).toBe('draft'); // estado inicial
    });

    it('should return 400 when validation fails', async () => {
      // Arrange
      const invalidTestimonial = {
        authorName: '',
        content: 'short',
        rating: 10,
      };

      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/testimonials')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(invalidTestimonial);

      // Assert
      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 when no token provided', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .post('/api/v1/testimonials')
        .send({ authorName: 'Test' });

      // Assert
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/v1/testimonials', () => {
    beforeEach(async () => {
      // Crear algunos testimonios
      await prisma.testimonial.createMany({
        data: [
          { tenantId, authorName: 'A', content: '...', rating: 5, status: 'published' },
          { tenantId, authorName: 'B', content: '...', rating: 4, status: 'published' },
          { tenantId, authorName: 'C', content: '...', rating: 5, status: 'pending' },
        ],
      });
    });

    it('should return paginated list of testimonials', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/api/v1/testimonials')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({ page: 1, limit: 10 });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveLength(3);
      expect(response.body).toHaveProperty('meta');
    });

    it('should filter by status', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .get('/api/v1/testimonials?status=published')
        .set('Authorization', `Bearer ${adminToken}`);

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data.every(t => t.status === 'published')).toBe(true);
    });
  });

  describe('PATCH /api/v1/testimonials/:id/moderate', () => {
    let testimonialId: string;

    beforeEach(async () => {
      const testimonial = await prisma.testimonial.create({
        data: {
          tenantId,
          authorName: 'Test',
          content: 'Test content',
          rating: 5,
          status: 'pending',
        },
      });
      testimonialId = testimonial.id;
    });

    it('should approve a pending testimonial', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/testimonials/${testimonialId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('approved');

      // Verificar en DB
      const updated = await prisma.testimonial.findUnique({ where: { id: testimonialId } });
      expect(updated.status).toBe('approved');
    });

    it('should reject a pending testimonial', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .patch(`/api/v1/testimonials/${testimonialId}/moderate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'reject' });

      // Assert
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('rejected');
    });

    it('should return 404 if testimonial not found', async () => {
      // Act
      const response = await request(app.getHttpServer())
        .patch('/api/v1/testimonials/non-existent/moderate')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ action: 'approve' });

      // Assert
      expect(response.status).toBe(404);
    });
  });
});
```

**Helpers para tests de integración** (ejemplo):

```typescript
// tests/helpers/fixtures.ts

import { PrismaService } from '../../src/infrastructure/prisma/prisma.service';

export async function createTestTenant(prisma: PrismaService, name: string): Promise<string> {
  const tenant = await prisma.tenant.create({
    data: { name, isActive: true },
  });
  return tenant.id;
}

export async function createTestUser(prisma: PrismaService, tenantId: string, email: string, roleCode: string): Promise<string> {
  const role = await prisma.role.findUnique({ where: { code: roleCode } });
  const user = await prisma.user.create({
    data: {
      tenantId,
      email,
      passwordHash: 'fake-hash',
      userRoles: { create: { roleId: role.id } },
    },
  });
  return user.id;
}

export function generateTestToken(userId: string, tenantId: string, role: string): string {
  // Usar la misma lógica que en producción (jwt.sign)
  return jwt.sign({ sub: userId, tenantId, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}
```

---

### 2.3. Tests E2E (End-to-End)

**Propósito**: Probar flujos completos de usuario a través de la interfaz de usuario (Next.js) y validar la integración con el backend real.

**Herramientas**:
- **Framework**: **Playwright** (recomendado) o Cypress.
- **Browsers**: Chromium, Firefox, WebKit.
- **Visual Testing**: Opcional con Percy o Applitools.

**Características**:
- ✅ Lentos (1s - 30s por test)
- ✅ Prueban la aplicación completa (frontend + backend)
- ✅ Simulan interacción real del usuario
- ✅ Requieren más mantenimiento

**Estructura de archivo**:

```typescript
// tests/e2e/dashboard.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Dashboard Admin', () => {
  test.beforeEach(async ({ page }) => {
    // Login antes de cada test
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@test.com');
    await page.fill('input[name="password"]', 'Test123!');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL('/dashboard', { timeout: 5000 });
  });

  test('should create a new testimonial', async ({ page }) => {
    // Navegar a la página de creación
    await page.click('a[href="/testimonials/new"]');
    await expect(page).toHaveURL('/testimonials/new');

    // Rellenar formulario
    await page.fill('input[name="authorName"]', 'Juan E2E');
    await page.fill('textarea[name="content"]', 'Testimonio de prueba generado por Playwright.');
    await page.selectOption('select[name="rating"]', '5');
    // Subir imagen (si es necesario)
    await page.setInputFiles('input[type="file"]', 'tests/fixtures/test-image.jpg');

    // Enviar
    await page.click('button:has-text("Guardar")');

    // Verificar redirección a lista y aparición del nuevo testimonio
    await expect(page).toHaveURL('/testimonials');
    await expect(page.locator('text=Juan E2E')).toBeVisible();
    await expect(page.locator('text=Pendiente')).toBeVisible(); // estado inicial
  });

  test('should moderate a testimonial', async ({ page }) => {
    // Asumimos que existe un testimonio pendiente
    await page.goto('/testimonials');
    await page.locator('text=Juan E2E').click(); // hacer clic en el testimonio

    // Hacer clic en "Aprobar"
    await page.click('button:has-text("Aprobar")');
    await expect(page.locator('text=Estado: Aprobado')).toBeVisible();

    // Opcional: verificar que aparece en la página pública (requiere otro contexto)
  });

  test('should filter testimonials', async ({ page }) => {
    await page.goto('/testimonials');
    await page.fill('input[placeholder*="Buscar"]', 'Juan');
    await page.waitForTimeout(500); // debounce
    const cards = page.locator('.testimonial-card');
    await expect(cards).toHaveCount(1); // solo el de Juan
  });

  test('should logout', async ({ page }) => {
    await page.click('button:has-text("Cerrar sesión")');
    await expect(page).toHaveURL('/login');
  });
});
```

**Configuración de Playwright** (`playwright.config.ts`):

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 3. Estrategia de Mocking

### 3.1. Mocking con MSW (Mock Service Worker)

**Propósito**: Mockear APIs HTTP para tests de frontend (React) y para tests de integración cuando no queremos llamar a servicios reales (Cloudinary, YouTube).

**Setup en frontend**:

```typescript
// src/mocks/browser.ts (para desarrollo)
import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);
```

**Handlers específicos para tests**:

```typescript
// src/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/testimonials', ({ request }) => {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    // Devolver datos mockeados según filtros
    return HttpResponse.json({
      data: [
        { id: '1', authorName: 'Mock', content: 'Test', rating: 5, status: 'published' },
      ],
      meta: { total: 1, page: 1, limit: 10 },
    });
  }),

  http.post('/api/v1/testimonials', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: 'new-id', ...body, status: 'draft' }, { status: 201 });
  }),

  // Mock para Cloudinary (subida de imagen)
  http.post('https://api.cloudinary.com/v1_1/:cloudName/auto/upload', () => {
    return HttpResponse.json({ secure_url: 'https://res.cloudinary.com/.../test.jpg' });
  }),
];
```

**Uso en tests de frontend** (con Vitest + React Testing Library):

```typescript
// src/components/TestimonialForm.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { server } from '../mocks/server'; // servidor de MSW para Node

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

test('should submit form and show success message', async () => {
  render(<TestimonialForm />);
  await userEvent.type(screen.getByLabelText(/autor/i), 'Juan');
  await userEvent.type(screen.getByLabelText(/contenido/i), 'Contenido de prueba');
  await userEvent.click(screen.getByRole('button', { name: /guardar/i }));

  await waitFor(() => {
    expect(screen.getByText(/testimonio creado/i)).toBeInTheDocument();
  });
});
```

### 3.2. Mocking con Vitest (para backend)

Ya vimos ejemplos con `vi.spyOn` y `vi.mock`. Aquí un ejemplo de mock de repositorio:

```typescript
// src/domain/testimonials/services/testimonial.service.spec.ts
vi.mock('../../infrastructure/repositories/testimonial.repository', () => ({
  TestimonialRepository: vi.fn().mockImplementation(() => ({
    findById: vi.fn(),
    save: vi.fn(),
  })),
}));

const mockRepository = new TestimonialRepository() as jest.Mocked<TestimonialRepository>;
mockRepository.findById.mockResolvedValue(testimonialMock);
```

---

## 4. Requisitos de Cobertura de Código

### 4.1. Umbrales Mínimos

| Tipo de Cobertura | Mínimo | Objetivo | Herramienta |
|-------------------|--------|----------|-------------|
| **Statements** | 80% | 90% | Vitest --coverage (v8/istanbul) |
| **Branches** | 70% | 85% | Vitest --coverage |
| **Functions** | 80% | 90% | Vitest --coverage |
| **Lines** | 80% | 90% | Vitest --coverage |

**Configuración en `vitest.config.ts`**:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/migrations/**',
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
```

### 4.2. Badge de Cobertura

Podemos generar un badge con herramientas como `badges` o usar Codecov.

```markdown
![Coverage](./badges/coverage.svg)

| Métrica | Cobertura | Estado |
|---------|-----------|--------|
| Statements | 86% | ✅ |
| Branches   | 75% | ✅ |
| Functions  | 84% | ✅ |
| Lines      | 86% | ✅ |
```

---

## 5. Integración con CI/CD

### 5.1. GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: test_cms
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_pass
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Setup test environment
        run: |
          cp .env.example .env.test
          echo "DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/test_cms" >> .env.test
          echo "REDIS_URL=redis://localhost:6379" >> .env.test

      - name: Run migrations
        run: npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://test_user:test_pass@localhost:5432/test_cms

      - name: Run unit tests
        run: npm run test:unit -- --coverage

      - name: Run integration tests
        run: npm run test:integration

      - name: Run E2E tests
        run: npm run test:e2e
        env:
          # Para que el frontend se conecte al backend de test
          NEXT_PUBLIC_API_URL: http://localhost:3000

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          file: ./coverage/lcov.info
```

---

## 6. Checklist de Calidad para Tests

- [ ] **Organización**: Tests separados por tipo (unit, integration, e2e) y por módulo.
- [ ] **Nombres descriptivos**: `shouldReturnErrorWhenTestimonialNotFound`.
- [ ] **AAA Pattern**: Arrange-Act-Assert claro.
- [ ] **Independencia**: Cada test puede ejecutarse solo y en cualquier orden.
- [ ] **Determinismo**: Mismo resultado siempre.
- [ ] **Limpieza**: Después de cada test, los datos de prueba se eliminan.
- [ ] **Cobertura mínima** alcanzada.
- [ ] **Mocks apropiados**: Solo se mockea lo necesario.
- [ ] **Pruebas de edge cases**: Límites, valores nulos, errores.
- [ ] **Ejecución en CI**: Todos los tests pasan antes de mergear.

---

## 7. Recomendaciones Adicionales

- **Pruebas de base de datos**: Usar `prisma.$transaction` para rollback automático después de cada test (o usar `testcontainers` para mayor aislamiento).
- **Pruebas de outbox**: Verificar que los eventos se insertan en la tabla `outbox_events` y que el worker los procesa.
- **Pruebas de feature flags**: Simular distintas configuraciones de flags y verificar el comportamiento.
- **Pruebas de rendimiento** (opcional): Para endpoints críticos, usar herramientas como `k6` o `artillery`.

---

## 📄 Plantilla Resumida para Nuevo Test

```typescript
// tests/[unit|integration|e2e]/[modulo]/[nombre].spec.ts

import { describe, it, expect, beforeEach } from 'vitest'; // o de Playwright

describe('[Módulo/Componente]', () => {
  beforeEach(() => {
    // Setup común
  });

  describe('[Método/Acción]', () => {
    it('should [comportamiento esperado] when [condición]', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should handle error when [condición de error]', async () => {
      // ...
    });
  });
});
```

---

> **Nota final**: La estrategia de testing es un **documento vivo**. Revisa y actualiza este documento trimestralmente basado en métricas de calidad, feedback del equipo y cambios en los requisitos del proyecto. Los tests malos son peores que no tener tests.