# Especificación técnica de habilidad: Arquitecturas de Renderizado Web Moderno

**Código de Skill:** SKL-FE-ARCH-002  
**Versión:** 1.2.0  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Agile DoD  
**Responsable:** Facundo Nicolás González (Staff Frontend Engineer)

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | **Arquitecturas de Renderizado Híbrido (NestJS + Next.js)** |
| **Objetivo de Dominio** | Diseñar y optimizar la comunicación y el renderizado entre un backend robusto (NestJS) y un frontend de alto rendimiento (Next.js), utilizando RSC, SSR, SSG e ISR para maximizar Core Web Vitals. |
| **Tipo de Proyecto** | Aplicaciones Web Fullstack / Arquitecturas Desacopladas / Microservicios + BFF. |
| **Complejidad** | **Alta** (Dominio de la integración entre servidor de aplicación y servidor de renderizado). |

---

## 2. Descripción y Filosofía de Diseño
El skill de **Hybrid Rendering (NestJS + Next.js)** se centra en la orquestación eficiente entre la API de negocio y el servidor de renderizado. Se basa en el desacoplamiento de responsabilidades: NestJS gestiona la lógica de datos e integridad, mientras Next.js optimiza la entrega mediante el **Critical Rendering Path (CRP)**.

### 2.1. Resiliencia y Observabilidad (Patrones Aplicables)
Para garantizar una arquitectura robusta, se integran los siguientes mecanismos:

* **Flujo de Control:** Implementación de **Server-to-Server Fetching** optimizado. Uso de **RSC (React Server Components)** en Next.js para consumir directamente la API de NestJS, reduciendo el JS en el cliente.
* **Persistencia y Fallos:** Uso de **SWR/React Query** para el cliente y **ISR** para cachear respuestas de la API de NestJS en el servidor de Next.js.
* **Trazabilidad:** Pasaje de **Correlation IDs** desde el cliente, a través de Next.js, hasta los logs de NestJS.
* **Métricas de Éxito:** Monitoreo estricto de **Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1)**.

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales (RF)
* **[RF-01]:** El arquitecto debe configurar un **BFF (Backend For Frontend)** en Next.js que medie entre el cliente y los microservicios de NestJS.
* **[RF-02]:** Garantizar el uso de **Shared Types** (DTC) entre ambos frameworks para asegurar un contrato de datos 100% type-safe.
* **[RF-03]:** Implementar estrategias de **Caching** coordinadas (Cache-Control en NestJS y Revalidation en Next.js).

### 3.2. Requerimientos No Funcionales (RNF)
* **[RNF-01] Escalabilidad:** La arquitectura debe permitir escalar horizontalmente NestJS y Next.js de forma independiente.
* **[RNF-02] Mantenibilidad:** Separación clara entre lógica de negocio (NestJS) y lógica de presentación/composición (Next.js).
* **[RNF-03] Seguridad:** Validación de JWT emitida por NestJS dentro del Middleware de Next.js.
* **[RNF-04] Disponibilidad:** En caso de caída de la API de datos durante el build, el sistema debe usar la última versión estable (fallback estratégico).

---

## 4. Criterios de Aceptación (Definition of Done)
Se considera que el dominio de la estrategia es completo si:

1.  **Validación Lógica:** Se justifica técnicamente por qué se eligió ISR sobre SSR para el caso de uso específico.
2.  **Resiliencia:** El sistema maneja errores de red en el cliente mediante **React Error Boundaries** sin romper la UI completa.
3.  **Calidad Técnica:** La hidratación es "seca" (Resumability) o selectiva (Islands Architecture), evitando re-renderizados innecesarios.
4.  **Autonomía:** El ingeniero puede configurar un pipeline de despliegue que invalide la caché de CDN selectivamente.

---

## 5. Ecosistema de Herramientas (Stack)
* **Herramienta Principal:** Next.js 15+ (Frontend) y NestJS 10+ (Backend).
* **Librerías / Dependencias:** Prisma/TypeORM (DB), Zod (Validación compartida), axios/fetch (Comunicación S2S).
* **Entorno de Ejecución:** Docker (Containerización de ambos servicios) / Vercel + AWS.

---

## 6. Metodología de Práctica (Paso a Paso)

1.  **Fase de Setup:** Analizar la volatilidad de los datos. ¿Cambian por segundo o por mes?
2.  **Fase de Construcción:** Implementar componentes de servidor para lógica pesada y componentes de cliente solo para interactividad.
3.  **Fase de Refactor:** Identificar cuellos de botella mediante **Lighthouse** y aplicar optimizaciones de imágenes y fuentes.
4.  **Fase de QA:** Testear la aplicación con red 3G lenta para verificar el **rendimiento percibido**.

---

## 7. Antipatrones (Lo que NO se debe hacer)

* ⚠️ **[Antipatrón 1]:** Usar **CSR** para contenido público altamente dependiente de SEO.
* ⚠️ **[Antipatrón 2]:** Inundar el servidor con **SSR** para páginas que podrían ser estáticas (SSG), aumentando costos de infraestructura.
* ⚠️ **[Antipatrón 3]:** Ignorar el **Hydration Mismatch**, lo que causa parpadeos de UI y degradación de performance.
* ⚠️ **[Antipatrón 4]:** No usar **Loading Skeletons**, dejando al usuario sin feedback visual durante el streaming.

---

## 8. Evaluación y KPIs

| Métrica | Meta |
| :--- | :--- |
| **Latencia S2S (Next to Nest)** | < 50ms (en la misma red/VPC) |
| **LCP (Largest Contentful Paint)** | < 2.5 segundos |
| **Type Safety Coverage** | 100% entre API y Cliente |
| **Tasa de Cache Hit (Next.js)** | > 70% para contenido público |

---

## 9. Recursos Adicionales
* [Web Vitals Documentation](https://web.dev/vitals/)
* [Patterns.dev: Rendering Patterns](https://www.patterns.dev/posts/rendering-introduction)
