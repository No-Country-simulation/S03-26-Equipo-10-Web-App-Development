# Módulo: API keys

**Última actualización:** 2026-10-01

## Contrato

Los administradores del tenant gestionan claves en `/api/v1/api-keys`. `POST` exige `name` y uno o dos scopes entre `testimonials:read` y `analytics:write`; `expiresAt` es opcional y debe ser una fecha UTC futura. `POST /:id/rotate` acepta cambios de nombre, scopes y expiración. La creación y la rotación responden `201` con `apiKey` **una sola vez** y `Cache-Control: no-store`. `GET` de listado/detalle entrega únicamente metadatos; `DELETE /:id` revoca inmediatamente la clave lógica y todas sus credenciales. Los IDs administrativos se mantienen al rotar.

Las credenciales nuevas tienen formato `ak_<live|test>_<publicId hexadecimal de 16 caracteres>_<secret hexadecimal de 64 caracteres>`. Los 32 bytes del secret se generan con `randomBytes`. El public ID es único y permite buscar la credencial sin recorrer hashes. PostgreSQL guarda `secret_digest = HMAC-SHA-256(pepper_versionado, secret)`, nunca el secret ni la clave completa. La verificación usa `timingSafeEqual` y consulta PostgreSQL en cada petición; la revocación no depende de una caché de credenciales. El pepper se suministra mediante `API_KEY_PEPPERS_JSON` desde un gestor de secretos.

`GET /api/v1/public/testimonials` y `GET /api/v1/public/testimonials/:id` exigen `testimonials:read`. `POST /api/v1/public/analytics/events` exige `analytics:write`. El guard obtiene el tenant de la credencial verificada y las consultas siguientes lo usan para aislar datos; un header de tenant enviado por el cliente no cambia ese contexto. El límite Redis distingue claves nuevas por public ID.

Cada credencial conserva una copia de sus scopes. Al rotar, la anterior queda en estado `ROTATING` por hasta 24 horas y mantiene los permisos que tenía; la nueva recibe los scopes elegidos. Una segunda rotación concurrente falla por versión de la clave lógica. `lastUsedAt` y la auditoría de uso se actualizan como máximo una vez cada cinco minutos por clave lógica. Creación, rotación y revocación generan auditoría con public ID, sin secret.

Las claves `tms_` siguen usando el hash SHA-256 anterior durante 30 días desde `API_KEY_LEGACY_STARTED_AT`, con sus permisos históricos de lectura y analítica. La fecha de vencimiento se muestra en administración; el uso deja auditoría `API_KEY_LEGACY_USED`. En producción, si falta la fecha, se rechazan las claves legadas. Tras una rotación de una clave legada, el token viejo vence a las 24 horas o al final de la ventana global, lo que ocurra primero.

## Persistencia

`api_keys` representa la clave lógica y conserva nullable `key_hash` para el lector legado. Incluye tenant, propietario, estado, scopes actuales, expiración, última utilización y versión de rotación. `api_key_credentials` contiene public ID, digest, versión del pepper, entorno, scopes propios, estado y expiración de gracia. La migración de expansión conserva columnas legadas y cambia las claves previamente inactivas a `REVOKED`.

Ver [procedimiento de despliegue y retiro](../operations/12_api_key_rollout.md).
