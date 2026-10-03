# Plan HITL: endurecimiento de Testimonial CMS

**Fecha de inicio:** 2026-09-30  
**Estado global:** Fase 8 implementada localmente, pendiente de CI remoto, staging, producción y retiro legado; Fase 6 del plan de arquitectura pausada
**Skills:** `api-key-security-engineering`, `node-backend-engineering`, `web-security-engineering`, `webhook-architecture-engineering`

## Contexto y restricciones

- Corregir los fallos de autenticación, entrega de webhooks y SSRF antes de ampliar capacidades. Conservar el outbox en PostgreSQL y usar Redis para límites y caché compartidos.
- Ejecutar **una sola fase `[Actual]` por turno**. Al terminar, presentar evidencia y commit sugerido, detenerse y esperar ACK antes de marcar la siguiente fase `[Actual]`.
- La creación y el commit de este plan son prerrequisitos de la Fase 1. La Fase 6 de `2026-09-28_chore-cierre-arquitectura-configuracion.md` queda formalmente pausada.
- Cambios en `schema.prisma`, infraestructura y `package.json` raíz requieren ACK explícito adicional conforme a `AGENTS.md`. Ninguna migración se aplica a una base persistente sin autorización separada.
- La compatibilidad de credenciales y webhooks legados dura 30 días **desde el primer despliegue compatible**, con fecha UTC registrada en configuración. El solapamiento de API keys rotadas dura 24 horas. Avisar del uso legado antes del retiro.
- Probar migraciones expand–migrate–contract en PostgreSQL 18 descartable y una copia sin secretos reales. Un rollback posterior a la emisión de credenciales nuevas debe mantener lectores de ambos formatos.

## Fases

### `[Completada localmente]` Fase 1: restablecer HTTP y la base de verificación

- Diagnosticar el fallo previo del job `Test` de CI y documentar si está resuelto o qué evidencia falta.
- Corregir el CSRF global: login, registro, formulario público y clientes Bearer deben funcionar. Validar `Origin` para mutaciones de navegador sin sesión; reservar el token CSRF para mutaciones autenticadas por cookie.
- Configurar proxies confiables y derivar la IP efectiva sin aceptar el primer `X-Forwarded-For` proporcionado por un cliente no confiable.
- Cubrir estos recorridos con pruebas HTTP reales. **Salida:** CI identifica o resuelve su fallo previo y las mutaciones legítimas dejan de recibir 403 por CSRF.

**Implementación local para revisión:** El guard global clasifica rutas anónimas, rutas con API key y mutaciones de sesión; valida `Origin`/Fetch Metadata y exige token CSRF en mutaciones con cookie de acceso. Bearer explícito tiene precedencia también en `JwtAuthGuard`. La IP de rate limit usa `request.ip` de Express con `TRUST_PROXY_HOPS` (0 en acceso directo, 1 por defecto en producción detrás de Nginx/ALB). Los payloads de outbox se serializan a JSON dentro de la transacción.

**Diagnóstico de CI:** El [run #8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/36652248245) falló únicamente en dos casos PostgreSQL de `testimonial-persistence.integration.spec.ts`: Prisma aceptó un `BigInt` que las pruebas esperaban que abortara la escritura de testimonio/publicación y outbox. La serialización JSON explícita corrige la causa antes de insertar el evento; queda por observar una nueva ejecución de CI con PostgreSQL.

**Verificación local:** Typecheck, lint (0 errores, una advertencia previa), build y suite API pasan; 97 pruebas aprobadas y cinco PostgreSQL omitidas por falta de base descartable local. Ocho pruebas nuevas de HTTP, preferencia Bearer y payload cubren las rutas y el fallo diagnosticado. No se atribuye estado verde a CI ni a PostgreSQL hasta un nuevo run.

**Commit sugerido:** `fix(api): restablecé CSRF y resolvé el fallo del outbox en CI`.

**Review humano (ACK):** Recibido mediante «Continua con la fase 2»; Fase 1 versionada en `813f2ca`. CI con PostgreSQL aún requiere nueva ejecución.

### `[Completada localmente]` Fase 2: cerrar SSRF

- Exigir HTTPS en altas y cambios de destino. En cada conexión, validar todas las IP A/AAAA resueltas, bloquear redes internas/reservadas, fijar la IP validada y desactivar redirecciones y proxies implícitos.
- Diseñar el egreso del futuro alojamiento para bloquear redes internas y metadata; su implementación y prueba siguen pendientes. Los destinos HTTP existentes pueden continuar 30 días solo si su IP pasa la validación; registrar el legado y avisar al tenant.
- Probar DNS privado, rebinding, IPv6 y redirecciones. **Salida local:** el dispatcher rechaza destinos internos; el control de red requiere evidencia posterior.

**Implementación local para revisión:** Altas y cambios de URL exigen HTTPS; el transporte resuelve todas las direcciones A/AAAA al abrir cada socket, rechaza si alguna no es pública y fija una IP aprobada. Axios no sigue redirecciones ni usa proxies implícitos. Los destinos HTTP creados antes del primer despliegue compatible pueden enviarse durante 30 días si se configura la fecha UTC; el transporte sigue validando sus IP. El administrador ve el plazo y el estado en el listado, y cada uso deja un log sin payload ni secreto. La configuración anterior preveía una ACL de egreso, pero fue retirada sin aplicarse; el control de red del alojamiento futuro continúa pendiente. Ver `docs/operations/08_webhook_ssrf_rollout.md` para el despliegue.

**Límite de infraestructura:** La validación en el socket bloquea direcciones de metadata para este flujo. No existe un control de egreso de red desplegado que refuerce la validación de aplicación. La conectividad de staging y la política de egreso del futuro alojamiento siguen pendientes de despliegue y verificación. Sin `WEBHOOK_LEGACY_HTTP_STARTED_AT`, los destinos HTTP fallan cerrados; la fecha debe registrarse al primer despliegue compatible.

**Verificación local:** API: 125 pruebas aprobadas en 24 suites, incluidas pruebas de sockets locales para rebinding y redirección; cinco pruebas PostgreSQL omitidas por falta de una base descartable. Web: 19 pruebas aprobadas en 10 suites. Typecheck, lint y build de API y web aprobados; el build web se ejecutó con `NEXT_PUBLIC_API_URL` de prueba. Lint web conserva 12 advertencias preexistentes fuera de esta fase. La configuración anterior pasó validación sintáctica en una copia temporal, con una advertencia del módulo de certificado; fue retirada antes de desplegarse. No se aplicó infraestructura ni migraciones, y no se verificaron staging o CI.

**Commit sugerido:** `fix(webhooks): cerrá SSRF y prepará el egreso restringido`.

**Review humano (ACK):** Recibido mediante «Continua con la fase 3»; Fase 2 versionada en `37636f3`.

### `[Completada localmente]` Fase 3: garantizar entregas mediante PostgreSQL

- Crear una entrega lógica única por `(evento, destino)` y un historial de intentos. Adquirir trabajo con `FOR UPDATE SKIP LOCKED`, lease recuperable y concurrencia limitada.
- Ejecutar una llamada HTTP por intento con timeout: 2xx confirma; 408/429/5xx y red reintentan con backoff exponencial y full jitter; 4xx definitivos terminan. Tras 10 intentos o 72 horas, estado `dead` visible y reenvío administrativo.
- Marcar el outbox `processed` solo cuando todas las entregas tengan resultado terminal registrado. El envío de prueba también pasa por outbox y responde `202`.
- Probar dos procesadores, crash y destino 503. **Salida:** no se pierden eventos ni se duplica la entrega lógica.

**Implementación local:** El productor crea el evento y sus entregas en una transacción. El ledger mantiene una fila única por evento y destino, una tabla separada de intentos, URL congelada, adquisición con `SKIP LOCKED`, lease con token de fencing, recuperación de leases vencidos y concurrencia máxima de cinco por réplica. Un intento ejecuta una sola llamada HTTP; 408/429/5xx y errores de red reintentan con full jitter, mientras que 4xx definitivos terminan. El presupuesto es de diez intentos o 72 horas; `dead` queda visible y permite reenvío administrativo. El envío de prueba se encola y responde `202`. Los destinos eliminados se archivan para conservar el historial. Ver [contrato del módulo](../modules/api-webhooks.md) y [procedimiento de corte](../operations/09_webhook_delivery_cutover.md).

**Verificación local:** Migraciones de expansión y corte aplicadas únicamente a PostgreSQL 18 descartable; backfill con datos sintéticos verificado (dos entregas lógicas, tres intentos históricos y un evento reabierto). Suite API: 27 suites y 152 pruebas aprobadas, incluidas pruebas PostgreSQL de dos procesadores, lease vencido, resultado tardío, 503, agotamiento, reenvío y destino archivado. Web: 10 archivos y 19 pruebas aprobadas. Typecheck de API y web, lint de API y build de API aprobados; build de web aprobado con las 12 advertencias de lint preexistentes. No se aplicaron migraciones a bases persistentes ni se verificó staging/producción.

**ACK adicional:** Recibido para modificar `apps/api/prisma/schema.prisma`; no incluye autorización para ejecutar migraciones en bases persistentes.

**Commit sugerido:** `fix(webhooks): garantizá entregas con ledger y leases en PostgreSQL`.

**Review humano (ACK):** Recibido mediante «Continua con la fase 4»; Fase 3 versionada en `3ae7e5c`.

### `[Completada localmente]` Fase 4: compartir límites y caché

- Incorporar Redis 7 en Compose y servicio administrado equivalente en despliegues con varias réplicas. Reemplazar los `Map` de login/rate limit por contadores atómicos con TTL y límites por IP confiable, tenant y public ID según ruta. Las mutaciones protegidas fallan cerradas si no se puede verificar la cuota.
- Migrar caché pública a Redis con TTL, claves versionadas por tenant e invalidación al publicar; acotar valores y evitar recálculos simultáneos.
- **Salida:** límites e invalidaciones funcionan entre dos instancias API.

**Implementación local:** `redis@6.3.0` conecta la API a Redis 7. Las cuotas por ruta/IP efectiva, tenant o slug y clave API usan Lua atómico con TTL; el contador de login usa una clave derivada del hash del correo. Las mutaciones con cuota responden 503 si Redis no puede verificarla. La caché pública usa claves versionadas por tenant, TTL de 60 segundos, tope de 256 KiB y lock entre réplicas; publicar incrementa la versión del tenant. Compose y CI incorporan Redis 7 descartable. La antigua configuración preparaba un Redis administrado, pero fue retirada antes de desplegarse. Ver [operación](../operations/10_redis_quotas_cache.md).

**Alcance de compatibilidad:** Las claves `tms_` aún carecen de public ID; la cuota usa su UUID persistido hasta la fase 6, cuando el guard preferirá `publicId`. Las lecturas pueden acudir a PostgreSQL si Redis falla; un fallo de invalidación posterior al commit puede dejar una respuesta antigua hasta el TTL. No se desplegó Redis en staging o producción.

**ACK adicional:** Recibido para editar `docker-compose.yml` y la configuración anterior de infraestructura; no autoriza aplicar cambios a infraestructura real.

**Verificación local:** API: 29 suites y 151 pruebas aprobadas con PostgreSQL 18 y Redis 7 descartables. Una prueba HTTP alterna dos aplicaciones Nest y confirma 429 en la tercera mutación; otras pruebas comprueban bloqueo de login e invalidación de caché entre conexiones independientes. Web: 19 pruebas en 10 archivos. Typecheck, lint sin errores ni advertencias de API, builds de API y web, `npm ci --dry-run` y `docker compose config` pasaron. La configuración anterior pasó verificaciones sintácticas en una copia temporal. El build web conserva 12 advertencias preexistentes; esa verificación conservó una advertencia anterior del módulo de certificado. `npm audit --audit-level=high` pasó y reportó cuatro hallazgos moderados en dependencias ajenas a Redis. La imagen API arrancó tras excluir `*.tsbuildinfo` del contexto Docker y corregir dos dependencias Nest; readiness respondió OK, un login inválido respondió 401 con Redis y 503 al detener Redis. No se ejecutaron CI remoto, staging, producción ni despliegue de infraestructura.

**Commit sugerido:** `feat(api): compartí cuotas y caché pública mediante Redis`.

**Review humano (ACK):** Recibido mediante «Vamos con la fase 5». Los cambios de Fase 4 permanecían sin commit en el árbol compartido al comenzar esta fase; separarlos al versionar.

### `[Completada localmente]` Fase 5: migrar sesión web a cookies HttpOnly

- Conservar Bearer explícito. Para la web, `X-Auth-Mode: cookie` devuelve solo usuario en login/refresh; usar `credentials: include` y guardar solo usuario en memoria.
- Añadir `GET /auth/csrf` con token vinculado criptográficamente a la sesión y header `x-csrf-token`. Consumir una vez el refresh legado de `localStorage`, establecer cookies y borrar el almacenamiento.
- Rotar refresh de forma atómica por familia; detectar reutilización, revocar familia y auditar. Logout revoca y borra cookies con sus atributos originales. Migrar scrypt a Argon2id al login, manteniendo verificación anterior durante la transición.
- **Salida:** ningún token nuevo persiste en JavaScript; carreras de refresh producen una sola rotación válida.

**Implementación local:** La web usa `X-Auth-Mode: cookie`, `credentials: include`, mantiene solo usuario y CSRF en memoria, recupera la sesión por cookie y consume una vez el refresh token legado de `localStorage` mediante `/auth/upgrade-session`. Login, registro y refresh en modo cookie devuelven solo usuario; Bearer explícito mantiene tokens en el cuerpo y no establece cookies. `GET /auth/csrf` emite un HMAC ligado al refresh cookie; las mutaciones por cookie lo envían en `x-csrf-token`. El CSRF aleatorio no vinculado se retiró. Las sesiones nuevas tienen una familia; la rotación reclama e inserta dentro de una transacción, y un replay revoca la familia y se audita. Logout revoca y limpia cookies con sus atributos. Las contraseñas nuevas usan Argon2id asincrónico de Node 24 y un hash scrypt verificado se actualiza al login. Ver [módulo](../modules/api-auth.md) y [corte](../operations/11_cookie_session_rollout.md).

**Compatibilidad y ACK:** El modo implícito y `/auth/upgrade-session` duran 30 días desde `AUTH_LEGACY_STARTED_AT`; en producción, sin esa fecha se exige modo explícito. Se recibió el ACK adicional para modificar `apps/api/prisma/schema.prisma`. No se aplicó ninguna migración a una base persistente. El esquema de expansión conserva `family_id` nullable para réplicas antiguas y rollback compatible.

**Verificación local:** La migración pasó en PostgreSQL 18 descartable. Con dos refresh tokens sintéticos previos, el backfill creó dos familias, sin huérfanos y con ambos estados de revocación correctos. La suite API aprobó 31 suites y 158 pruebas con PostgreSQL/Redis descartables, incluidas una carrera entre dos conexiones, replay auditado y un recorrido HTTP real de cookies, CSRF, refresh, logout y Bearer. La web aprobó 21 pruebas en 11 archivos, incluidas actualización de `localStorage` y CSRF. Typecheck de API/web, lint de API sin advertencias y builds de API/web pasaron; web mantiene 11 advertencias preexistentes. El log HTTP redacta cookies de respuesta y headers CSRF. No se verificaron CI remoto, navegador E2E, staging ni producción.

**Límite de seguridad:** Un replay concurrente provoca una sola inserción nueva y revoca la familia, incluida la credencial recién rotada. La web comparte una promesa de refresh para evitar ese choque dentro de una pestaña; una carrera entre pestañas puede requerir nuevo login. El retiro del lector legado se difiere hasta cumplidos 30 días y observar ausencia de uso.

**Commit sugerido:** `feat(auth): migrá la sesión web a cookies HttpOnly`.

**Review humano (ACK):** Recibido mediante «Avanza con la fase 6». Los cambios de Fase 5 fueron versionados en `a1d2b63`.

### `[Completada localmente]` Fase 6: rediseñar API keys

- Generar `ak_<entorno>_<publicId>_<secret de 32 bytes>`; buscar por public ID único, guardar HMAC-SHA-256 con pepper versionado externo, comparar en tiempo constante. Incluir expiración, estado, propietario y scopes `testimonials:read` y `analytics:write`.
- Revelado único al crear/rotar; solapamiento de 24 horas y revocación inmediata sin caché de credenciales. Exigir scope y tenant en guards; auditar y limitar `lastUsedAt` a una actualización cada cinco minutos por clave.
- Mantener permisos actuales de `tms_` por 30 días y luego rechazar. **Salida:** pruebas de scope, tenant, expiración, rotación, revocación y compatibilidad.

**Implementación local:** Las claves nuevas usan 32 bytes aleatorios, public ID único y HMAC-SHA-256 con pepper versionado externo a PostgreSQL. La creación y rotación muestran el secreto una vez, con `Cache-Control: no-store`; los GET entregan metadatos. Cada credencial conserva sus scopes, por lo que la vieja no gana permisos al rotar. La gracia es de 24 horas, la revocación corta todas las credenciales de la clave lógica, y una versión de rotación impide dos rotaciones concurrentes válidas. El guard obtiene tenant y scopes del registro verificado en cada petición. El uso actualiza `lastUsedAt` y auditoría en una transacción como máximo una vez cada cinco minutos. Las claves `tms_` conservan sus permisos históricos durante 30 días desde `API_KEY_LEGACY_STARTED_AT`; en producción sin fecha se rechazan. Ver [módulo](../modules/api-api-keys.md) y [corte](../operations/12_api_key_rollout.md).

**ACK adicional:** Recibido para editar `apps/api/prisma/schema.prisma`, `docker-compose.yml` y la configuración anterior de infraestructura. No incluye autorización para migrar bases persistentes ni desplegar.

**Verificación local:** Migración de expansión aplicada a PostgreSQL 18 descartable desde cero y sobre dos claves legadas sintéticas, conservando el hash y convirtiendo la inactiva en `REVOKED`. Suite API: 35 suites y 174 pruebas aprobadas con PostgreSQL/Redis descartables, incluidos HTTP real, scopes, tenant, expiración original, carrera de rotación, auditoría y corte legado. Web: 21 pruebas en 11 archivos. Typecheck, lint y build de API y web aprobados; web mantiene 11 advertencias de lint preexistentes. `docker compose config` pasó; la configuración anterior también pasó verificaciones sintácticas en una copia temporal, con una advertencia preexistente del módulo de certificado. No se verificaron CI remoto, staging ni producción, y no se aplicaron migraciones a bases persistentes.

**Commit sugerido:** `feat(api-keys): incorporá credenciales versionadas con scopes y rotación segura`.

**Review humano (ACK):** Recibido mediante «Continua con la fase 7»; los cambios de Fase 6 ya estaban versionados al comenzar esta fase.

### `[Completada localmente]` Fase 7: contrato y secretos de webhooks

- Secreto independiente por destino, revelado único y cifrado con clave versionada de un gestor de secretos. Enviar ID de evento estable, versión de esquema y `X-TMS-Signature: t=<segundos>,v1=<HMAC>` sobre timestamp, punto y bytes exactos del body; documentar verificación y ventana de cinco minutos.
- Mantener `X-Signature` 30 días para destinos legados con secreto. Avisar de destinos sin firma o HTTP y suspenderlos al vencer. No devolver secretos en GET; truncar y redactar cuerpos/errores antes de persistir.
- **Salida:** firma, rotación con gracia, replay y ausencia de secretos en respuestas/logs probados.

**Implementación local:** Cada alta genera un secreto independiente y lo revela una vez; el servidor cifra AES-256-GCM con clave versionada inyectada mediante configuración externa y AAD por tenant/destino. La rotación revela un secreto nuevo y mantiene el anterior 24 horas, con bloqueo de una segunda rotación durante la gracia. Las entregas llevan ID estable, versión 1 y `X-TMS-Signature` sobre timestamp y bytes exactos del cuerpo; durante la gracia incluyen ambas firmas `v1`. El receptor debe verificar una ventana de cinco minutos y deduplicar por ID. `X-Signature` persiste solo durante 30 días para destinos firmados anteriores al corte. Los GET exponen metadatos y avisos de migración, nunca secretos. Los destinos HTTP o sin firma se suspenden al vencer su plazo. Cuerpos y errores de respuesta se redactan y acotan antes de persistirse. Ver [contrato](../modules/api-webhooks.md) y [operación](../operations/13_webhook_signing_rollout.md).

**Migración y ACK adicional:** Se autorizaron los cambios de `apps/api/prisma/schema.prisma` e infraestructura. La migración de expansión pasó desde cero y sobre un esquema previo con un destino legado sintético en PostgreSQL 18 descartable; el backfill se ejecutó en esa copia, limpió el texto plano y dejó el secreto cifrado. El backfill de una base persistente y los despliegues siguen requiriendo autorizaciones separadas. Se conserva el lector legado para rollback compatible; el primer despliegue debe fijar `WEBHOOK_SIGNATURE_LEGACY_STARTED_AT` en UTC.

**Verificación local:** API: 38 suites y 184 pruebas aprobadas con PostgreSQL 18 y Redis 7 descartables, incluyendo contrato HTTP, firma alterada, replay fuera de cinco minutos, doble firma en gracia, expiración de `X-Signature`, aislamiento entre tenants, suspensión y redacción en PostgreSQL/logs. Web: 21 pruebas en 11 archivos. Typecheck, lint, build API/web y `docker compose config` pasaron. La configuración anterior pasó verificaciones sintácticas en una copia temporal. El build web conserva 11 advertencias previas; esa verificación conservó una advertencia anterior del módulo de certificado. No se verificaron CI remoto, staging ni producción.

**Commit sugerido:** `feat(webhooks): firmá eventos y cifrá secretos por destino`.

**Review humano (ACK):** Recibido mediante «Vamos con la fase 8»; cambios de Fase 7 versionados antes de comenzar esta fase.

### `[Actual: verificación de despliegue pendiente]` Fase 8: límites, observabilidad y despliegue

- JSON general de 1 MB e imágenes de 10 MB con validación del tamaño decodificado. Paginar administración; revisar reintentos Cloudinary/YouTube para no repetir 4xx ni registrar credenciales en URLs.
- Instrumentar RED, lag del event loop, antigüedad de outbox, intentos, fallos, entregas `dead` y trazas OpenTelemetry con correlación. Alertar por `dead`, pendientes mayores de cinco minutos y fallos sostenidos.
- Actualizar ADR, módulos, `AGENTS.md` y `llm.txt` según uso real de PostgreSQL/Redis. Verificar en staging y producción con despliegue gradual; retirar lectores, columnas y headers legados solo después de 30 días y de comprobar ausencia de uso.
- **Salida:** evidencia de CI, staging, métricas, alertas y retiro de compatibilidad antes de declarar cierre.

**Implementación local para revisión:** JSON general acotado a 1 MiB; rutas de imagen con cuerpo de 14 MiB para base64 y validación de 10 MiB decodificados. Listados administrativos paginados en API y web, con navegación adicional en selectores de categorías/etiquetas. Cloudinary exige URL HTTPS sin credenciales ni query; YouTube envía la clave en header; los 4xx definitivos no se reintentan. La API expone métricas Prometheus protegidas por token, RED HTTP, lag del event loop, estado del outbox e intentos; precarga OpenTelemetry en Node/Docker cuando se configura OTLP y correlaciona trace ID. La configuración anterior preveía un token y alarmas externas, pero fue retirada sin aplicarse; la operación externa sigue pendiente. El ADR 0002, arquitectura, módulos, `AGENTS.md`, `llm.txt` y el [runbook](../operations/14_phase8_observability_rollout.md) reflejan el uso real de PostgreSQL/Redis.

**Verificación local:** Las siete migraciones se aplicaron solo a PostgreSQL 18 descartable con ACK explícito; Redis 7 fue descartable. API: 42 suites y 194 pruebas aprobadas, incluida paginación con aislamiento entre tenants, límites, reintentos y métricas. Web: 11 archivos y 21 pruebas aprobadas. Typecheck, lint sin errores de API/web, builds de API/web, `npm ci --dry-run`, imágenes Docker de ambas apps y smoke conjunto pasaron. El endpoint de métricas local respondió 404 sin token y 200 con token. La configuración anterior pasó verificaciones sintácticas en una copia temporal; se corrigió una advertencia del proveedor de certificados. El smoke reveló y corrigió que faltaba `X-Auth-Mode: bearer` en el login de CI. Web conserva 11 advertencias de lint anteriores a esta fase.

**Pendiente para cerrar la fase:** un run nuevo de CI remoto sobre el commit, navegador E2E con API real en staging, aplicación autorizada de infraestructura/migraciones persistentes, verificación de métricas, trazas y entrega de las alarmas en staging, despliegue gradual en producción y retiro legado tras 30 días y ausencia de uso. No se desplegó infraestructura ni se aplicaron migraciones a bases persistentes. `npm audit` no pudo completar por DNS/tiempo de espera del registro npm, incluso fuera del sandbox; el build Docker solo informó cuatro hallazgos moderados. El gate definitivo es CI remoto.

**Commit sugerido:** `feat(api): instrumentá límites y observabilidad para el despliegue gradual`.

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
