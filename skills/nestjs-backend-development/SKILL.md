# Especificación Técnica de Habilidad: Desarrollo Backend con Node.js, TS y NestJS

---

**Código de Skill:** SKL-JS-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Clean Architecture & SOLID

---

## 1. Ficha de Identificación del Skill

| **Atributo** | **Definición Técnica** |
| --- | --- |
| **Habilidad Principal** | **Node.js + TypeScript + NestJS** |
| **Objetivo de Dominio** | Construir sistemas distribuidos, escalables y testeables mediante arquitecturas de capas y tipado estricto, aprovechando el framework NestJS para garantizar la inmutabilidad de la lógica de negocio y la inyección de dependencias nativa. |
| **Tipo de Proyecto** | APIs RESTful, Microservicios, Backends para Mobile/Web. |
| **Complejidad** | **Alta** (Enfoque en Clean Architecture, Inyección de Dependencias y Arquitectura Modular). |

---

## 2. Descripción y Filosofía de Diseño

El skill de **Node.js/TypeScript con NestJS** se fundamenta en el desacoplamiento total del transporte respecto al dominio. NestJS proporciona una estructura robusta por defecto que facilita la implementación de **Clean Architecture**.

- **Modularidad:** Estructura modular estricta (`@Module`) que organiza el sistema en dominios autocontenidos.
- **Inyección de Dependencias (DI):** Uso nativo del contenedor de IoC de NestJS para desacoplar componentes y facilitar el testing.
- **Decoradores y Metadatos:** Uso extensivo de decoradores para definir metadatos de rutas, validación y seguridad de forma declarativa.

## 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

- **Flujo de Control:** Uso de **Exception Filters** para centralizar la gestión de errores y **Pipes** para la validación y transformación de datos.
- **Trazabilidad:** Implementación de **Interceptors** para inyectar `Correlation IDs` y registrar tiempos de ejecución en logs estructurados.
- **Confiabilidad:** **Graceful Shutdown** configurado en el `main.ts` para cerrar conexiones de DB y servidores ante señales `SIGTERM/SIGINT`.
- **Métricas de Éxito:** Integración con `@nestjs/terminus` para endpoints de `/health` y Prometheus para métricas.

---

## 3. Requerimientos del Skill

## 3.1. Requerimientos Funcionales (RF)

- **[RF-01]:** Inicializar proyectos con la Nest CLI y configurar `tsconfig.json` bajo modo estricto.
- **[RF-02]:** Validar la entrada de datos (DTOs) mediante `class-validator` y `ValidationPipe`.
- **[RF-03]:** Implementar persistencia desacoplada mediante el patrón **Repository** integrado con Providers de NestJS.
- **[RF-04]:** Gestión de tareas en segundo plano mediante `BullMQ` o microservicios integrados en NestJS.

## 3.2. Requerimientos No Funcionales (RNF)

- **[RNF-01] Mantenibilidad:** Cobertura de tests unitarios e integrales (Jest) superior al 80%.
- **[RNF-02] Seguridad:** Implementación de `guards` para AuthZ y `helmet`/`cors` configurados globalmente.
- **[RNF-03] Rendimiento:** Uso de técnicas de **Caching** integradas y optimización de inyección de dependencias (Scope Singleton por defecto).
- **[RNF-04] Escalabilidad:** Arquitectura preparada para transición a microservicios (Hybrid Apps) mediante el módulo `@nestjs/microservices`.

---

## 4. Criterios de Aceptación (Definition of Done)

1. **Validación Lógica:** El sistema separa correctamente los controladores de la lógica de negocio (Servicios); los servicios no dependen de objetos `req/res` de Express/Fastify.
2. **Resiliencia:** El servidor maneja errores mediante filtros globales y responde con códigos HTTP semánticos estructurados.
3. **Calidad Técnica:** Código libre de `any`, paso de linter (ESLint NestJS config) y uso correcto de tipos de TypeScript.
4. **Autonomía:** El desarrollador puede orquestar módulos complejos con dependencias circulares resueltas y configurar proveedores personalizados (`useClass`, `useFactory`).

---

## 5. Ecosistema de Herramientas (Stack)

- **Framework:** NestJS 10+ (Node.js LTS).
- **Validación:** `class-validator`, `class-transformer`.
- **Testing:** Jest, Supertest.
- **Observabilidad:** `nestjs-pino`, `@nestjs/terminus`.
- **ORM:** Prisma, TypeORM, Mongoose.

---

## 6. Metodología de Práctica (Paso a Paso)

1. **Fase de Setup:** `nest new project-name`, configuración de módulos base.
2. **Fase de Construcción:** Creación de DTOs -> Servicios (Business Logic) -> Controladores -> Módulos.
3. **Fase de Refactor:** Implementación de `Guards` globales, `Interceptors` y `Exception Filters`.
4. **Fase de QA:** Tests unitarios de servicios y tests e2e de controladores usando `Test.createTestingModule`.

---

## 7. Antipatrones (Lo que NO se debe hacer)

- ⚠️ **[Antipatrón 1]:** Acceder directamente al objeto `req` de Express dentro de un servicio (rompe el desacoplamiento).
- ⚠️ **[Antipatrón 2]:** Crear módulos gigantes (God Modules) en lugar de separar por dominios funcionales.
- ⚠️ **[Antipatrón 3]:** No usar `Pipes` para validación, confiando en validaciones manuales dentro del controlador.
- ⚠️ **[Antipatrón 4]:** Inyectar demasiadas dependencias en un solo constructor (indica falta de cohesión).

---

## 8. Evaluación y KPIs

| **Métrica** | **Meta** |
| --- | --- |
| **Cobertura de Tests** | > 80% |
| **Tiempo de Respuesta (P95)** | < 200ms para operaciones estándar |
| **Vulnerabilidades Críticas** | 0 |
| **Modularidad** | Acoplamiento bajo entre módulos (verificado vía DI) |

---

## 9. Recursos Adicionales

- [NestJS Official Documentation](https://docs.nestjs.com/)
- [NestJS Devtools](https://devtools.nestjs.com/)
- [Clean Architecture with NestJS Guide](https://github.com/Sairyss/domain-driven-hexagon)
