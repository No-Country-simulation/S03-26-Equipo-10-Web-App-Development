# Plan HITL: endurecimiento de Testimonial CMS

**Fecha de inicio:** 2026-09-30  
**Estado global:** Fase 1 actual; Fase 6 del plan de arquitectura pausada  
**Skills:** `api-key-security-engineering`, `node-backend-engineering`, `web-security-engineering`, `webhook-architecture-engineering`

## Contexto y restricciones

- Corregir los fallos de autenticación, entrega de webhooks y SSRF antes de ampliar capacidades. Conservar el outbox en PostgreSQL y usar Redis para límites y caché compartidos.
- Ejecutar **una sola fase `[Actual]` por turno**. Al terminar, presentar evidencia y commit sugerido, detenerse y esperar ACK antes de marcar la siguiente fase `[Actual]`.
- La creación y el commit de este plan son prerrequisitos de la Fase 1. La Fase 6 de `2026-09-28_chore-cierre-arquitectura-configuracion.md` queda formalmente pausada.
- Cambios en `schema.prisma`, infraestructura y `package.json` raíz requieren ACK explícito adicional conforme a `AGENTS.md`. Ninguna migración se aplica a una base persistente sin autorización separada.
- La compatibilidad de credenciales y webhooks legados dura 30 días **desde el primer despliegue compatible**, con fecha UTC registrada en configuración. El solapamiento de API keys rotadas dura 24 horas. Avisar del uso legado antes del retiro.
- Probar migraciones expand–migrate–contract en PostgreSQL 18 descartable y una copia sin secretos reales. Un rollback posterior a la emisión de credenciales nuevas debe mantener lectores de ambos formatos.

## Fases

### `[Actual]` Fase 1: restablecer HTTP y la base de verificación

- Diagnosticar el fallo previo del job `Test` de CI y documentar si está resuelto o qué evidencia falta.
- Corregir el CSRF global: login, registro, formulario público y clientes Bearer deben funcionar. Validar `Origin` para mutaciones de navegador sin sesión; reservar el token CSRF para mutaciones autenticadas por cookie.
- Configurar proxies confiables y derivar la IP efectiva sin aceptar el primer `X-Forwarded-For` proporcionado por un cliente no confiable.
- Cubrir estos recorridos con pruebas HTTP reales. **Salida:** CI identifica o resuelve su fallo previo y las mutaciones legítimas dejan de recibir 403 por CSRF.

**Implementación local para revisión:** El guard global clasifica rutas anónimas, rutas con API key y mutaciones de sesión; valida `Origin`/Fetch Metadata y exige token CSRF en mutaciones con cookie de acceso. Bearer explícito tiene precedencia también en `JwtAuthGuard`. La IP de rate limit usa `request.ip` de Express con `TRUST_PROXY_HOPS` (0 en acceso directo, 1 por defecto en producción detrás de Nginx/ALB). Los payloads de outbox se serializan a JSON dentro de la transacción.

**Diagnóstico de CI:** El [run #8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/36652248245) falló únicamente en dos casos PostgreSQL de `testimonial-persistence.integration.spec.ts`: Prisma aceptó un `BigInt` que las pruebas esperaban que abortara la escritura de testimonio/publicación y outbox. La serialización JSON explícita corrige la causa antes de insertar el evento; queda por observar una nueva ejecución de CI con PostgreSQL.

**Verificación local:** Typecheck, lint (0 errores, una advertencia previa), build y suite API pasan; 97 pruebas aprobadas y cinco PostgreSQL omitidas por falta de base descartable local. Ocho pruebas nuevas de HTTP, preferencia Bearer y payload cubren las rutas y el fallo diagnosticado. No se atribuye estado verde a CI ni a PostgreSQL hasta un nuevo run.

**Commit sugerido:** `fix(api): restablecé CSRF y resolvé el fallo del outbox en CI`.

### `[Pendiente]` Fase 2: cerrar SSRF

- Exigir HTTPS en altas y cambios de destino. En cada conexión, validar todas las IP A/AAAA resueltas, bloquear redes internas/reservadas, fijar la IP validada y desactivar redirecciones y proxies implícitos.
- Restringir el egreso en infraestructura para bloquear redes internas y metadata. Los destinos HTTP existentes pueden continuar 30 días solo si su IP pasa la validación; registrar el legado y avisar al tenant.
- Probar DNS privado, rebinding, IPv6 y redirecciones. **Salida:** ninguna conexión a destinos internos.

### `[Pendiente]` Fase 3: garantizar entregas mediante PostgreSQL

- Crear una entrega lógica única por `(evento, destino)` y un historial de intentos. Adquirir trabajo con `FOR UPDATE SKIP LOCKED`, lease recuperable y concurrencia limitada.
- Ejecutar una llamada HTTP por intento con timeout: 2xx confirma; 408/429/5xx y red reintentan con backoff exponencial y full jitter; 4xx definitivos terminan. Tras 10 intentos o 72 horas, estado `dead` visible y reenvío administrativo.
- Marcar el outbox `processed` solo cuando todas las entregas tengan resultado terminal registrado. El envío de prueba también pasa por outbox y responde `202`.
- Probar dos procesadores, crash y destino 503. **Salida:** no se pierden eventos ni se duplica la entrega lógica.

### `[Pendiente]` Fase 4: compartir límites y caché

- Incorporar Redis 7 en Compose y servicio administrado equivalente en despliegues con varias réplicas. Reemplazar los `Map` de login/rate limit por contadores atómicos con TTL y límites por IP confiable, tenant y public ID según ruta. Las mutaciones protegidas fallan cerradas si no se puede verificar la cuota.
- Migrar caché pública a Redis con TTL, claves versionadas por tenant e invalidación al publicar; acotar valores y evitar recálculos simultáneos.
- **Salida:** límites e invalidaciones funcionan entre dos instancias API.

### `[Pendiente]` Fase 5: migrar sesión web a cookies HttpOnly

- Conservar Bearer explícito. Para la web, `X-Auth-Mode: cookie` devuelve solo usuario en login/refresh; usar `credentials: include` y guardar solo usuario en memoria.
- Añadir `GET /auth/csrf` con token vinculado criptográficamente a la sesión y header `x-csrf-token`. Consumir una vez el refresh legado de `localStorage`, establecer cookies y borrar el almacenamiento.
- Rotar refresh de forma atómica por familia; detectar reutilización, revocar familia y auditar. Logout revoca y borra cookies con sus atributos originales. Migrar scrypt a Argon2id al login, manteniendo verificación anterior durante la transición.
- **Salida:** ningún token nuevo persiste en JavaScript; carreras de refresh producen una sola rotación válida.

### `[Pendiente]` Fase 6: rediseñar API keys

- Generar `ak_<entorno>_<publicId>_<secret de 32 bytes>`; buscar por public ID único, guardar HMAC-SHA-256 con pepper versionado externo, comparar en tiempo constante. Incluir expiración, estado, propietario y scopes `testimonials:read` y `analytics:write`.
- Revelado único al crear/rotar; solapamiento de 24 horas y revocación inmediata sin caché de credenciales. Exigir scope y tenant en guards; auditar y limitar `lastUsedAt` a una actualización cada cinco minutos por clave.
- Mantener permisos actuales de `tms_` por 30 días y luego rechazar. **Salida:** pruebas de scope, tenant, expiración, rotación, revocación y compatibilidad.

### `[Pendiente]` Fase 7: contrato y secretos de webhooks

- Secreto independiente por destino, revelado único y cifrado con clave versionada de un gestor de secretos. Enviar ID de evento estable, versión de esquema y `X-TMS-Signature: t=<segundos>,v1=<HMAC>` sobre timestamp, punto y bytes exactos del body; documentar verificación y ventana de cinco minutos.
- Mantener `X-Signature` 30 días para destinos legados con secreto. Avisar de destinos sin firma o HTTP y suspenderlos al vencer. No devolver secretos en GET; truncar y redactar cuerpos/errores antes de persistir.
- **Salida:** firma, rotación con gracia, replay y ausencia de secretos en respuestas/logs probados.

### `[Pendiente]` Fase 8: límites, observabilidad y despliegue

- JSON general de 1 MB e imágenes de 10 MB con validación del tamaño decodificado. Paginar administración; revisar reintentos Cloudinary/YouTube para no repetir 4xx ni registrar credenciales en URLs.
- Instrumentar RED, lag del event loop, antigüedad de outbox, intentos, fallos, entregas `dead` y trazas OpenTelemetry con correlación. Alertar por `dead`, pendientes mayores de cinco minutos y fallos sostenidos.
- Actualizar ADR, módulos, `AGENTS.md` y `llm.txt` según uso real de PostgreSQL/Redis. Verificar en staging y producción con despliegue gradual; retirar lectores, columnas y headers legados solo después de 30 días y de comprobar ausencia de uso.
- **Salida:** evidencia de CI, staging, métricas, alertas y retiro de compatibilidad antes de declarar cierre.

## Contratos y pruebas finales

- Auth: `GET /api/v1/auth/csrf` y actualización temporal de sesión; modo cookie o Bearer explícito en login/refresh. Retirar solo el modo legado implícito tras la ventana.
- API keys: creación/rotación con scopes y expiración; administración entrega solo metadatos; los dos endpoints públicos exigen su scope.
- Webhooks: firma versionada, versión e ID estable, `202` en prueba y reenvío de `dead`; consumidores deduplican por ID.
- CI verde con instalación inmutable, typecheck, lint, tests, cinco pruebas PostgreSQL, builds y smoke tests de contenedores; Redis descartable donde corresponda.
- E2E navegador/API real: registro, login, refresh, logout, recuperación, CSRF inválido y aislamiento entre tenants; sin tokens en `localStorage` tras actualización.
- Integración: claves nuevas/legadas, límites entre réplicas, firmas válidas/alteradas, SSRF, 429/503, duplicados, crash, lease vencido, agotamiento y reenvío.
- BullMQ, consumidores Stripe/GitHub, worker threads y ESM quedan fuera de alcance porque no resuelven un flujo activo o se eligió PostgreSQL.

## Control HITL

Al terminar cada fase: registrar cambios, pruebas y límites de la evidencia; proponer un commit convencional en español rioplatense; detenerse hasta ACK. No agrupar fases.
