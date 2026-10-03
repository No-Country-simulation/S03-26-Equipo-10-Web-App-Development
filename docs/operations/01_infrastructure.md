# Infraestructura: estado actual y requisitos de la demostración

**Estado al 2026-10-02:** el proyecto se ejecuta localmente con Docker Compose. La CI usa PostgreSQL y Redis descartables para validar la aplicación. No hay evidencia de un entorno de staging o producción desplegado.

## Componentes ejecutables

| Componente | Estado en el repositorio | Dependencia operativa |
| --- | --- | --- |
| Web Next.js | Aplicación en apps/web; imagen en apps/web/Dockerfile | URL pública de la API definida al construir el bundle |
| API NestJS | Aplicación en apps/api; imagen en apps/api/Dockerfile | Proceso continuo para HTTP y polling del outbox cada 3 s |
| PostgreSQL 18 | Servicio local de Compose y servicio descartable de CI | Datos de dominio, transacciones, outbox y ledger de entregas |
| Redis 7 | Servicio local de Compose y servicio descartable de CI | Cuotas atómicas y caché pública compartida |
| Cloudinary y YouTube | Integraciones externas de la API | Credenciales y conectividad según la función usada |

Compose levanta web, API, PostgreSQL, Redis y pgAdmin. La API consulta PostgreSQL para readiness; el procesador de outbox vive en el mismo proceso NestJS. Redis no entrega webhooks. La CI construye ambas imágenes y ejecuta un smoke test, pero no publica ni despliega artefactos.

## Configuración y controles

- Los valores de ejemplo están en .env.example y apps/api/.env.example. Los secretos reales deben inyectarse fuera de Git. Entre los requeridos están DATABASE_URL, REDIS_URL, JWT_SECRET, las claves versionadas de API y webhooks, y los orígenes permitidos para la sesión web.
- NEXT_PUBLIC_API_URL se incorpora al bundle web durante el build. CORS_ORIGIN, cookies HttpOnly, HTTPS y TRUST_PROXY_HOPS deben alinearse con las URL y el proxy reales del entorno elegido.
- La API valida URL, resolución DNS y dirección de socket de los webhooks salientes; no sigue redirecciones ni usa proxies HTTP implícitos. No hay un control de egreso de red desplegado que deba atribuirse a este proyecto. La política de red del alojamiento futuro deberá diseñarse y comprobarse allí.
- La API expone métricas protegidas y admite exportación OTLP opcional. No hay colector, retención ni alertas operativas verificadas fuera del entorno local. Ver la [guía de observabilidad](14_phase8_observability_rollout.md).
- Las migraciones solo se ejecutaron en bases descartables. Cualquier base persistente requiere respaldo, autorización y verificación separados.

## Decisiones para la demostración

La integración prevista de la web con Vercel y de PostgreSQL con Supabase tendrá un plan propio. Antes de configurarla, decidir el alojamiento de la API de larga duración y de Redis, comprobar la compatibilidad de PostgreSQL y Prisma, definir secretos y redes, y establecer respaldo, observabilidad y rollback. No se afirma que esos servicios estén configurados.

El procedimiento y las puertas de verificación están en la [estrategia de despliegue](03_deployment.md). La configuración local se describe en [setup](../collaboration/04_setup.md).
