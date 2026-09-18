# Especificación Técnica de Habilidad: Arquitectura y Seguridad de APIs RESTful

---

**Código de Skill:** SKL-PRO-001

**Versión:** 1.1.0

**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD / Richardson Maturity Model

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño, Implementación y Aseguramiento de APIs Robustas. |
| **Objetivo de Dominio** | Capacitar al desarrollador para diseñar contratos de API consistentes, seguros y resilientes, minimizando la fricción en el consumo y garantizando la integridad de los datos bajo el stack de NestJS y TypeScript. |
| **Tipo de Proyecto** | Desarrollo de Software Backend / Arquitectura de Sistemas. |
| **Complejidad** | **Alta** (Requiere conocimientos de redes, seguridad y patrones de diseño). |

---

## 2. Descripción y Filosofía de Diseño

El skill se enfoca en la creación de soluciones basadas en el **Modelo de Madurez de Richardson (Nivel 2/3)**, integrando las mejores prácticas de la arquitectura de NestJS:

* **Modularidad:** Implementación de controladores y servicios desacoplados siguiendo **Clean Architecture** y los módulos de NestJS.
* **Idempotencia:** Garantía de que múltiples peticiones idénticas (especialmente en `PUT` y `DELETE`) tengan el mismo efecto.
* **Contrato-Primero (Design-First):** La especificación OpenAPI (Swagger) es la única fuente de verdad para el equipo de frontend y backend.

### 2.1. Resiliencia y Observabilidad (Patrones Aplicables)

* **Flujo de Control:** Implementación de **Rate Limiting** dinámico y lógica de reintentos con **Exponential Backoff** en clientes.
* **Persistencia y Fallos:** Uso de **Idempotency Keys** para evitar duplicados y **Circuit Breaker** para prevenir fallas en cascada.
* **Trazabilidad:** Inyección de **Correlation IDs** en cada petición mediante middlewares/interceptors y uso de **Structured Logging** (Pino) para análisis forense.
* **Métricas de Éxito:** Latencia (P95/P99), Tasa de errores (4xx/5xx) y Uptime (monitoreado vía `@nestjs/terminus`).

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)

* **[RF-01]:** Inicializar un entorno con **Docker** y **NestJS**.
* **[RF-02]:** Implementar un sistema de **versionado** global o por controlador (`/v1/`).
* **[RF-03]:** Desarrollar un **Error Handler Global** (Exception Filters) que traduzca excepciones de dominio a códigos HTTP semánticos.
* **[RF-04]:** Aplicar **paginación basada en cursor** para recursos masivos para optimizar el rendimiento de la DB (Prisma).

### 3.2. Requerimientos No Funcionales (RNF)

* **[RNF-01] Seguridad:** Implementar **JWT con HttpOnly Cookies** o **OAuth2**, reforzado con cabeceras de seguridad vía **Helmet**.
* **[RNF-02] Integridad:** Validar todos los inputs mediante esquemas **Zod** (usando `nestjs-zod`) antes de que los datos toquen los servicios o la persistencia.
* **[RNF-03] Disponibilidad:** Configurar limitadores de tasa (Throttler) para mitigar ráfagas de tráfico y ataques DoS.

---

## 4. Criterios de Aceptación (Definition of Done)

Se considera que el dominio de la construcción de la API es completo si:

1.  **Validación Lógica:** El 100% de los endpoints devuelven códigos de estado correctos (ej. 201 para creación, 422/400 para error de validación, 204 para eliminación).
2.  **Resiliencia:** El sistema soporta ráfagas de tráfico controladas devolviendo un error **429 (Too Many Requests)** sin degradar el servicio.
3.  **Calidad Técnica:** El contrato generado en **Swagger** permite la ejecución de pruebas de integración y generación de clientes sin errores.
4.  **Autonomía:** Se puede desplegar y ejecutar la API en un entorno Linux mediante `docker-compose up`.

---

## 5. Ecosistema de Herramientas (Stack)

* **Core:** Node.js (NestJS) + TypeScript.
* **Persistencia:** Prisma ORM + PostgreSQL.
* **Validación:** Zod / `nestjs-zod`.
* **Documentación:** `@nestjs/swagger` (OpenAPI 3.0).
* **Logging:** `nestjs-pino` / Pino.
* **Seguridad:** `@nestjs/throttler`, `helmet`, `passport-jwt`.
* **Testing:** Jest + Supertest.

---

## 6. Metodología de Práctica (Paso a Paso)

1.  **Fase de Setup:** Definir los DTOs y esquemas Zod iniciales. Configurar el `main.ts` con los pipes y filtros globales.
2.  **Fase de Construcción:** Implementar recursos orientados a sustantivos (ej. `/users`) usando decoradores de NestJS para métodos semánticos (`@Get`, `@Post`, etc.).
3.  **Fase de Refactor:** Integrar guards de autenticación, interceptores de logging y lógica de paginación.
4.  **Fase de QA:** Ejecutar pruebas de integración con Jest y monitorear logs estructurados en tiempo real.

---

## 7. Antipatrones (Lo que NO se debe hacer)

* ⚠️ **[Antipatrón 1]:** Responder siempre con `200 OK` incluso si hay un error (ej. devolver `{ success: false }` con status 200).
* ⚠️ **[Antipatrón 2]:** Exponer IDs incrementales (Serial) de la base de datos. Usar **UUIDs** o **ULIDs** en las respuestas públicas.
* ⚠️ **[Antipatrón 3]:** Realizar lógica de negocio pesada o acceso directo a la DB dentro del controlador.
* ⚠️ **[Antipatrón 4]:** No versionar la API desde el inicio, dificultando cambios disruptivos futuros.

---

## 8. Evaluación y KPIs

| Métrica | Meta |
| :--- | :--- |
| **Tasa de Error (5xx)** | < 0.1% |
| **Tiempo de Respuesta** | < 200ms para el 90% de las peticiones de lectura. |
| **Cobertura de Swagger** | 100% de los endpoints públicos documentados. |
| **Validación de Input** | 100% de los endpoints protegidos por esquemas Zod. |

---

## 9. Recursos Adicionales

* [Documentación Oficial de NestJS - OpenAPI](https://docs.nestjs.com/openapi/introduction)
* [OWASP API Security Top 10](https://owasp.org/www-project-api-security/)
* [Prisma Best Practices](https://www.prisma.io/docs/guides/other/production-checklist)
* [RFC 7231 (HTTP Semantics)](https://datatracker.ietf.org/doc/html/rfc7231)
