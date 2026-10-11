# Demo: proxy web/API de mismo origen

## Alcance de fase 2

La web conserva NestJS como autoridad de autenticación, tenant, roles, CSRF y persistencia. El navegador solicita `/api/v1` al origen web; el middleware de Next.js 15.5.27 reenvía externamente a un origen backend fijo. No se duplican controladores de negocio ni se incorpora Supabase Auth/Storage.

Se usa `NextResponse.rewrite` externo, evitando pasar las imágenes por un Route Handler de Vercel Functions: la API actual admite JSON de imagen de hasta 14 MiB, mientras una Function tiene un [límite de cuerpo de 4,5 MB](https://vercel.com/docs/functions/limitations). El middleware no lee ni transforma el cuerpo. Next 15 clona cuerpos para middleware con límite predeterminado de 10 MB; se configura `experimental.middlewareClientMaxBodySize: '15mb'`, verificado en el código instalado y mediante hash de un cuerpo de 14 MiB. El tracing de standalone se fija en la raíz de este monorepo, evitando inferir un lockfile ajeno en directorios superiores. La compatibilidad y los límites efectivos del ingress de Vercel deben probarse en fase 4; la prueba local no los acredita.

## Configuración

| Variable | Dónde | Contrato |
|---|---|---|
| `NEXT_PUBLIC_API_URL=/api/v1` | Web, build | URL pública relativa, mismo origen; CSP `connect-src 'self'`. |
| `API_BACKEND_ORIGIN` | Web, servidor/build | Origen de la API Railway, HTTPS y sin path, credenciales, query ni fragmento. Nunca se toma de un header o parámetro del navegador. |
| `CORS_ORIGIN` | API | Origen exacto y estable de la web Vercel, sin path. No admite previews arbitrarios. |
| `TRUST_PROXY_HOPS` | API | Predeterminado **0**, también en producción. No configurar un número sin verificar ingress, caminos alternativos y limpieza de headers. |

Desarrollo y smoke de producción local admiten HTTP de loopback para el destino backend. El modo directo legado con URL pública HTTP(S) sigue disponible, especialmente en Compose; no resuelve la sesión entre dominios de proveedores distintos. No se modificaron Dockerfiles ni Compose. La imagen web existente recibe sólo el argumento público de build; incorporar el destino backend al build y runtime de una imagen para modo relativo requerirá configuración y ACK de infraestructura en fase 3. En Vercel configurar ambas variables en el entorno correspondiente antes de construir.

Cambiar `NEXT_PUBLIC_API_URL` requiere nuevo build. `API_BACKEND_ORIGIN` se valida al cargar la configuración y en el middleware; configurar ambos de forma consistente y redeployar al cambiar el origen. No añadir `API_BACKEND_ORIGIN` a `nextConfig.env` ni prefijarlo con `NEXT_PUBLIC_`. La ausencia o invalidez del destino con modo relativo falla; no hay fallback a un host del request.

## Transporte y seguridad

- Se conservan método, bytes del cuerpo y query, cookies, Authorization explícito, Origin original, Fetch Metadata, `X-Auth-Mode`, CSRF, idempotencia y correlación. No se fuerza un Origin permitido para ocultar uno ajeno. El timeout del proxy local Next es 30 segundos; no implica reintentos de mutaciones ni garantiza igual timeout en el proveedor.
- Los headers permitidos se construyen desde cero. Tenant, usuario, rol, métricas, headers internos de Next y `Forwarded`/`X-Forwarded-*` del cliente no pasan esa frontera. La lista conserva un `Accept` seguro incluso vacía: en Next 15 un override vacío no elimina headers originales. Hay regresión unitaria y HTTP de este caso.
- Sólo se reenvían paths canónicos ASCII bajo `/api/v1`; segmentos vacíos, escapes, barras codificadas, puntos y otros caracteres ambiguos se rechazan. La query puede contener texto Unicode y valores codificados. Todo `/api/v1/internal` queda bloqueado, incluidas métricas generales y BI. Un 404 de la web sin forward también es válido para variantes que no coinciden con el matcher.
- Login/registro/refresh emiten dos `Set-Cookie` separados; logout conserva cuatro instrucciones de limpieza con sus paths. Se preservan `HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/` y ausencia de Domain; el navegador asocia las cookies al host web. No se renombraron cookies ni se relajó SameSite.
- Todas las respuestas de la API parten con `Cache-Control: private, no-store`, `CDN-Cache-Control: no-store` y `Vercel-CDN-Cache-Control: no-store`, antes de parsear cuerpos o ejecutar guards. Las cabeceras más específicas existentes de auth siguen indicando `no-store`. El proxy fija las mismas directivas y `x-vercel-enable-rewrite-caching: 0`; el cliente conserva `cache: no-store`. El caché Redis público permanece en la API. Vercel documenta el [caché de rewrites externos y su opt-out](https://vercel.com/docs/routing/rewrites).
- Autorización sigue saliendo del JWT verificado y el repositorio de credenciales activo. Filtrar un header en la web no sustituye verificar identidad y tenant en NestJS.

## Confianza del ingress: condición antes de desplegar

El valor previo de producción confiaba automáticamente en un salto. Ahora falla de forma segura con 0 hasta verificar la topología. Con 0, las cuotas por IP agrupan tráfico por el peer inmediato; **no está resuelta todavía la atribución de IP del usuario remoto**. No dejar esta configuración agregada como una demo multiusuario aceptada ni habilitar `trust proxy: true` para resolverla.

En fases 3/4 verificar los headers realmente establecidos por Vercel y Railway, su orden, rutas de acceso directo y HTTPS. El ingress debe sobrescribir los headers relevantes; un número de saltos no demuestra confianza si hay caminos más cortos. [Express explica estos requisitos](https://expressjs.com/en/guide/behind-proxies/). Si se restringe la API al proxy mediante header compartido, generar/almacenar/rotar el secreto externamente, sobrescribirlo en el ingress y validarlo en tiempo constante en la API; no implementarlo copiando un header del visitante. [Vercel documenta la restricción del origen](https://vercel.com/docs/routing/rewrites). Diseñar también probes, métricas y clientes API autorizados para no bloquearlos.

## Reproducción local

Sin bases, Redis ni migraciones; datos sintéticos en memoria. `AuthController`, `JwtAuthGuard`, `CsrfGuard`, `SessionCsrfService`, validación Zod y filtros/interceptor son reales. `AuthService`, repositorio de credenciales y cuotas son sustitutos de prueba; **no prueba contraseñas, persistencia, aislamiento SQL ni resiliencia Redis**. La fixture vive en tests, exige flag explícito y no se importa en AppModule ni en el build de producción de la API.

```bash
NEXT_PUBLIC_API_URL=/api/v1 API_BACKEND_ORIGIN=http://127.0.0.1:4100 npm run build --workspace @testimonial-cms/web
node scripts/web-proxy-smoke.mjs
```

El smoke levanta API fixture en `127.0.0.1:4100` y Next standalone de producción en `127.0.0.1:3100` (con assets estáticos copiados como en la imagen), verifica transporte y apaga ambos. Requiere esos puertos libres y se ejecuta también en CI después del build relativo. Para navegador real, usar `node scripts/web-proxy-smoke.mjs --serve` y abrir `http://localhost:3100/api/v1/proxy-fixture/browser`; pulsar **Run session smoke**, comprobar todas las verificaciones y finalizar con Ctrl-C. Chrome permite cookies Secure en localhost; esto **no sustituye HTTPS remoto**. No usar esta fixture para una demo pública ni dejarla corriendo.

## Evidencia de esta ejecución

Validación local del 2026-10-10, sobre cambios de trabajo posteriores a `4340878` (sin atribuirles el CI aprobado de fase 1):

| Verificación | Resultado |
|---|---|
| Tipos API/web | Aprobados. |
| Lint | Sin errores; 13 advertencias existentes (3 API/10 web). |
| Web | 26 archivos, 161 pruebas aprobadas. |
| API afectada | 6 suites, 37 pruebas aprobadas, 0 omisiones: configuración, CSRF HTTP, auth controller, contexto tenant, cuotas y métricas. |
| Builds | API aprobada; web standalone aprobada, 27 páginas y middleware de 33 kB. |
| Smoke HTTP standalone | Aprobado: cookies Secure/HttpOnly/Strict separadas, cuatro limpiezas de logout, CSRF, Origin ajeno rechazado, headers de identidad/ingress, rutas internas, siete métodos, query y caché. Cuerpo de 14 MiB preservado con hash SHA-256 idéntico. |
| Navegador real (Chromium/IAB, localhost) | 16 verificaciones aprobadas: registro/login, sesión por cookie, CSRF faltante/inválido/viejo rechazado, tenant/rol de credencial verificada, refresh y rotación, logout/401, métricas bloqueadas y sin tokens en localStorage. Sin errores de consola. |
| Bundle público | Destino backend local ausente de los chunks JS del navegador. |
| Infra/manifiesto/migraciones | Sin cambios en Dockerfiles, Compose, package.json raíz, lockfile ni schema; sin migraciones ni servicios externos. |

El smoke reveló y permitió corregir la lista de override vacía de Next 15; hay prueba de regresión para ese caso. La revisión también corrigió el fallback de confianza del proxy tanto en validación Zod como en la fábrica de runtime, cubierto por una prueba de producción. Se ajustó el framing Content-Length del cliente HTTP sintético para DELETE/OPTIONS; no se alteran cuerpos en el middleware.

El CI incorpora el build relativo y smoke standalone como gates. No se repitieron localmente las integraciones PostgreSQL/Redis de fase 1 en esta fase sin permiso de migraciones; el CI completo vuelve a validarlas. No se desplegaron servicios ni se aprovisionaron cuentas. Los procesos y la fixture local se apagan al terminar.

## Seguimiento del CI de `6762170`

El [run 38099725713](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38099725713) del commit `67621707522465c700d0b98c5a7de61ff867ff6c` detectó un resultado URI no verificado en `apps/web/src/middleware.test.ts`, línea 90. Es la URL sintética usada para comprobar que ambas configuraciones rechazan userinfo; no corresponde a una credencial de servicio. El escáner debe seguir rechazando resultados `verified,unknown`.

Se reprodujo el hallazgo ejecutando la imagen TruffleHog 3.97.5, digest `sha256:1cec88f18ca39e26e04e61fe9d886c9c4e5f2fc0ba4f2ed185cac0722bd8a076`, sobre el rango real `4340878..6762170`, con montaje de sólo lectura. La corrección construye la URL durante la prueba mediante `URL.username` y `URL.password`, conservando ambos casos de rechazo. No cambia código de producción, políticas, exclusiones ni resultados exigidos.

Validación local de la corrección:

- Las 41 pruebas de `middleware.test.ts` y la suite web completa (26 archivos/161 pruebas), tipos web y ESLint del archivo aprobaron. ESLint se ejecutó desde el workspace web; la invocación inicial desde la raíz no encontró su configuración.
- El mismo escáner aprobó el cambio en un repositorio temporal con dos commits sintéticos: 3 chunks/816 bytes escaneados, 0 resultados verificados y 0 no verificados. No se crearon commits en el proyecto para esta prueba.
- El escaneo histórico del commit anterior conserva el hallazgo; la prueba local del cambio no equivale al CI remoto del próximo SHA. No se reescribió historia ni se añadió una excepción.

La fase 2 sigue abierta hasta publicar la corrección y obtener su CI completo aprobado. El ACK de continuación habilita seguir cuando se cumpla ese gate; no demuestra aceptación HTTPS remota.

## Aceptación remota pendiente

Nuevo SHA y CI completos, proyecto Vercel correcto con variables/build trazables, dominio HTTPS, API Railway y cadena de confianza verificada, restricciones de acceso directo y cuotas por usuario, cookies/Origin/CSRF en navegador, uploads máximos reales, ausencia de caché compartida, métricas inaccesibles por web y recuperación ante timeout. Mantener las condiciones integrales de fases 3/4 del plan, incluidos dos tenants con servicios reales.
