# Estrategia de despliegue

**Estado al 2026-10-02:** solo están verificados el desarrollo local y los pasos que ejecuta la CI. No hay despliegue de staging o producción ni canal de alertas activo. Esta guía registra las puertas necesarias para la futura demostración; no es un procedimiento ya ejecutado.

## Flujo actual

La CI de GitHub Actions instala dependencias con npm ci, genera el cliente Prisma, aplica migraciones únicamente a PostgreSQL descartable, revisa tipos, lint, pruebas y builds, construye las imágenes de API y web y ejecuta un smoke test de contenedores. Usa Redis descartable. No hay job de publicación o despliegue. El workflow real es [.github/workflows/ci.yml](../../.github/workflows/ci.yml).

Docker Compose permite comprobar localmente la integración de web, API, PostgreSQL y Redis. La web y la API tienen ciclos de despliegue distintos dentro del monorepo, aunque comparten el contrato HTTP.

## Preparación del entorno de demostración

1. Elegir dónde correr la API NestJS de forma continua: atiende HTTP y procesa el outbox cada 3 s. Elegir Redis 7 accesible desde esa API. La decisión de alojamiento no queda fijada por esta guía.
2. Preparar PostgreSQL compatible con el esquema y las migraciones del proyecto; verificar versión, conexión, TLS, límites y respaldo en el proveedor seleccionado. La integración prevista con Supabase se especificará por separado.
3. Preparar la web Next.js con la URL pública de la API antes del build. La integración prevista con Vercel se especificará por separado. Comprobar HTTPS, CORS, cookies HttpOnly, CSRF y proxy con las URL reales.
4. Inyectar DATABASE_URL, REDIS_URL, JWT_SECRET, claves versionadas y demás secretos desde el gestor del entorno. No introducir valores reales en archivos versionados ni en logs. Fijar las fechas UTC de compatibilidad solo en el primer despliegue correspondiente.
5. Diseñar el control de egreso de webhooks y el acceso restringido a métricas según el alojamiento elegido. Verificar resolución DNS, bloqueo de direcciones no públicas, TLS y conectividad hacia los proveedores externos. Configurar colector, retención y alertas si la demostración los requiere.

## Puertas de verificación

- **CI:** adjuntar URL y SHA de una ejecución verde posterior al cambio, incluidos tests con PostgreSQL y Redis, builds y smoke de ambas imágenes.
- **Base persistente:** obtener autorización específica, respaldo comprobado y plan de rollback antes de aplicar migraciones. La CI solo migra su base descartable.
- **Staging:** comprobar readiness, registro, login, refresh y logout con cookies, aislamiento entre tenants, límites compartidos por Redis, publicación y entrega de webhooks, salida HTTPS segura, métricas protegidas y trazas si se configura OTLP.
- **Demostración:** registrar versión desplegada, URLs, responsables y fecha UTC; comprobar las rutas principales y observar errores, latencia y antigüedad del outbox. Las alarmas no se consideran activas hasta inducirlas y confirmar la notificación.
- **Rollback:** conservar una versión compatible con los formatos de datos y secretos emitidos. No revertir una migración persistente sin un procedimiento propio y respaldo verificado.

La [fase 8 de seguridad](../plan/2026-09-30_chore-endurecimiento-seguridad.md) sigue abierta hasta disponer de evidencia del entorno real. El retiro de lectores y columnas legados requiere la ventana de 30 días y ausencia de uso verificada.
