# Infraestructura: estado actual y requisitos de la demostración

**Estado al 2026-10-05:** el proyecto se ejecuta localmente con Docker Compose. La CI usa PostgreSQL y Redis descartables para validar la aplicación. No hay evidencia de un entorno de staging o producción desplegado.

## Componentes ejecutables

| Componente | Estado en el repositorio | Dependencia operativa |
| --- | --- | --- |
| Web Next.js | Aplicación en apps/web; imagen en apps/web/Dockerfile | URL pública de la API definida al construir el bundle |
| API NestJS | Aplicación en apps/api; imagen en apps/api/Dockerfile | Proceso continuo para HTTP y polling del outbox cada 3 s |
| PostgreSQL 18 | Servicio local de Compose y servicio descartable de CI | Datos de dominio, transacciones, outbox y ledger de entregas |
| Redis 7 | Servicio local de Compose y servicio descartable de CI | Cuotas atómicas y caché pública compartida |
| Cloudinary y YouTube | Integraciones externas de la API | Credenciales y conectividad según la función usada |

Compose levanta web, API, PostgreSQL, Redis y Nginx. PostgreSQL y Nginx publican puertos solo en `127.0.0.1`. pgAdmin es optativo: `docker compose --profile debug up -d pgadmin`; también publica solo en loopback. La API consulta PostgreSQL para readiness; el procesador de outbox vive en el mismo proceso NestJS. Redis no entrega webhooks. La CI construye ambas imágenes, ejecuta un smoke test con filesystem de solo lectura y capacidades reducidas, escanea vulnerabilidades altas/críticas y adjunta SBOM CycloneDX de cada imagen. El reporte conserva también hallazgos sin corrección disponible; la CI falla si encuentra alguno alto o crítico con corrección disponible. No publica ni despliega artefactos.

Los Dockerfiles activos están en `apps/api/Dockerfile` y `apps/web/Dockerfile` y usan el repositorio raíz como contexto. Los Dockerfiles anteriores de `infra/docker/` se retiraron. Las etapas de ejecución contienen Node.js sin el gestor npm global que solo se usa durante el build. En Compose, API y web usan `read_only`, `cap_drop: ALL` y 30 segundos para apagarse; `/tmp` es temporal y la caché de Next.js tiene un `tmpfs` escribible por UID 1001. Para acceder a Nginx desde otra máquina se necesita un túnel o una configuración de exposición explícita.

**Verificación local del 2026-10-05:** ambas imágenes se construyeron y pasaron el smoke test con sondas, usuario sin privilegios, `read_only`, `cap_drop: ALL`, `/tmp` y caché escribibles, y parada con `SIGTERM` sin salida 137. `docker compose config` confirmó que el perfil por defecto excluye pgAdmin y que los puertos publicados de PostgreSQL y Nginx usan loopback; el perfil `debug` también vincula pgAdmin a loopback. Trivy 0.74.0 generó SBOM CycloneDX para ambas imágenes: el reporte de la API registró un hallazgo alto sin corrección disponible y el de web ninguno; no hubo hallazgos altos o críticos con corrección disponible. El reporte local de `npm audit` registró 40 paquetes con hallazgos altos y corrección disponible en el lockfile actual. El workflow conserva ese fallo como gate final, después de producir los reportes de imágenes; la actualización de dependencias requiere una tarea y autorización separadas. El workflow remoto de CI todavía debe ejecutarse para confirmar la carga de artefactos en GitHub Actions.

## Configuración y controles

- Los valores de ejemplo están en .env.example y apps/api/.env.example. Los secretos reales deben inyectarse fuera de Git. Entre los requeridos están DATABASE_URL, REDIS_URL, JWT_SECRET, las claves versionadas de API y webhooks, y los orígenes permitidos para la sesión web.
- NEXT_PUBLIC_API_URL se incorpora al bundle web durante el build. CORS_ORIGIN, cookies HttpOnly, HTTPS y TRUST_PROXY_HOPS deben alinearse con las URL y el proxy reales del entorno elegido.
- La API valida URL, resolución DNS y dirección de socket de los webhooks salientes; no sigue redirecciones ni usa proxies HTTP implícitos. No hay un control de egreso de red desplegado que deba atribuirse a este proyecto. La política de red del alojamiento futuro deberá diseñarse y comprobarse allí.
- La API expone métricas protegidas y admite exportación OTLP opcional. No hay colector, retención ni alertas operativas verificadas fuera del entorno local. Ver la [guía de observabilidad](14_phase8_observability_rollout.md).
- Las migraciones solo se ejecutaron en bases descartables. Cualquier base persistente requiere respaldo, autorización y verificación separados.

## Decisiones para la demostración

La integración prevista de la web con Vercel y de PostgreSQL con Supabase tendrá un plan propio. Antes de configurarla, decidir el alojamiento de la API de larga duración y de Redis, comprobar la compatibilidad de PostgreSQL y Prisma, definir secretos y redes, y establecer respaldo, observabilidad y rollback. No se afirma que esos servicios estén configurados.

El procedimiento y las puertas de verificación están en la [estrategia de despliegue](03_deployment.md). La configuración local se describe en [setup](../collaboration/04_setup.md).
