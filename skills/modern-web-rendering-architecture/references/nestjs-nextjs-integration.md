# Integración NestJS + Next.js: Patrones de Arquitectura

Esta referencia detalla cómo integrar eficientemente un backend de **NestJS** con un frontend de **Next.js** (Skill **SKL-FE-ARCH-002**).

## 1. El Patrón BFF (Backend For Frontend)
Next.js actúa como un BFF natural. 

### Responsabilidades de Next.js:
- **Composición de UI:** Agrega datos de múltiples microservicios de NestJS.
- **Seguridad:** Maneja las sesiones (Cookies/JWT) y protege las API Keys.
- **Optimización:** Convierte respuestas JSON pesadas en HTML/RSC ligero.

### Responsabilidades de NestJS:
- **Integridad de Datos:** Reglas de negocio y persistencia en DB.
- **Seguridad Core:** Emisión de tokens, RBAC y validación profunda.
- **Escalabilidad:** Procesamiento asíncrono y tareas pesadas.

## 2. Comunicación Type-Safe
Para evitar que el frontend se rompa ante cambios en el backend:
- **Shared Libraries:** En un monorepo, crea un paquete `shared-types` con las interfaces y DTOs (Zod).
- **Prisma/Zod-to-TS:** Genera tipos de TypeScript automáticamente desde la definición de la base de datos o esquemas de validación.

## 3. Estrategias de Fetching
- **Server-to-Server (Next Server -> Nest API):** Se realiza en RSC o SSR. Ocurre en la red interna, eliminando la latencia del cliente.
- **Client-to-Server (Next Client -> Nest API):** Se realiza para interactividad. Debe pasar por el Middleware de Next.js para inyectar headers de autenticación.

---

## Tip de Performance: El "Waterfall" de Fetching
Evita hacer peticiones secuenciales en el servidor de Next.js. Usa `Promise.all()` para disparar múltiples consultas a NestJS en paralelo siempre que sea posible.
