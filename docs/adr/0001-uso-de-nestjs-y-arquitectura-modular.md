# ADR 0001: Uso de NestJS y Arquitectura Modular N-Tier

**Fecha:** 2026-04-25  
**Estado:** Aceptado

## Contexto

El sistema de Testimonial CMS requiere un backend robusto capaz de manejar autenticación, exposición de APIs (CRUD), integración con sistemas externos y procesamiento asíncrono (Webhooks, Análisis de datos). Necesitamos un framework que provea herramientas *out-of-the-box* para acelerar el desarrollo del MVP sin sacrificar mantenibilidad a largo plazo ni capacidad de escalar.

Las opciones evaluadas fueron:
1. **Express.js:** Ligero y minimalista, pero requiere configurar toda la arquitectura manualmente.
2. **Fastify:** Excelente rendimiento, pero al igual que Express, requiere muchas decisiones de diseño y librerías de terceros.
3. **NestJS:** Framework opinado basado en TypeScript que incluye Inyección de Dependencias, Módulos, Decoradores y una arquitectura fuertemente inspirada en Angular.

## Decisión

Hemos decidido utilizar **NestJS** como el framework principal para el backend, aplicando una arquitectura **N-Tier Modular** (Controladores -> Servicios -> Repositorios concretos) alineada a los principios de diseño pragmático.

## Justificación

- **Convención sobre configuración:** NestJS provee una estructura de carpetas y patrones predefinidos (Guards, Interceptors, Pipes) que unifican la forma de programar en el equipo.
- **Inyección de Dependencias:** Permite escribir código más testear y desacoplado, vital para implementar patrones como Repositorios y Servicios sin usar variables globales.
- **TypeScript First:** Aprovecha las ventajas del tipado fuerte.
- **Ecosistema:** Integración nativa excelente con Swagger (OpenAPI), BullMQ (colas), Cache (Redis) y TypeORM/Prisma.
- **Modularidad:** Facilita la división de dominios (`auth`, `testimonials`, `analytics`, `webhooks`), permitiendo extraer módulos a microservicios independientes en un futuro si la carga lo amerita.

## Consecuencias (Trade-offs)

- **Positivas:** Mayor velocidad de onboarding para desarrolladores con experiencia en NestJS/Angular. Código más limpio y organizado desde el día uno. Patrones de diseño listos para usar.
- **Negativas:** Curva de aprendizaje inicial para desarrolladores solo acostumbrados a Express. Mayor "boilerplate" (código repetitivo) para cosas sencillas debido a la estructura de clases y decoradores.
- **Mitigaciones:** Evitaremos la sobre-ingeniería no creando interfaces (`IRepository`) a menos que sean estrictamente necesarias; usaremos clases concretas inyectadas directamente para mantener la simplicidad pragmática descrita en la Arquitectura Técnica (`01_architecture.md`).
