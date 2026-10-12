# E2E con aplicación y persistencia reales

La fase 2 incorpora Playwright 1.64.0 con Chromium, independiente de Jest/Vitest. Los seis recorridos aprobaron localmente sin omisiones ni reintentos en el run `5a293178acc3`; la evidencia y los fallos previos se registran en el [plan](../plan/2026-10-11_test-integridad-ci-e2e.md). La fase 3 los incorpora al job obligatorio `verify` en PR/main después del build y del smoke sintético del proxy; el CI `38280231648` del head `3e42880` aprobó los seis con servicios reales exclusivos y retries 0. El CI de cada nuevo SHA debe aprobar antes de integrarlo.

## Preparación y ejecución

Requisitos: Node/npm del proyecto, `npm ci`, Docker disponible, OpenSSL y espacio/memoria para builds, PostgreSQL y Redis descartables. El checkout debe estar libre de archivos `.env`, `.env.local`, `.env.production` y `.env.production.local` en raíz, API, Prisma y web: el harness rechaza su presencia sin leerlos, moverlos ni modificarlos. Usá un checkout aislado si necesitás conservar configuración local. Las variables de proveedores/DB del shell no se heredan.

```bash
# Instalar el navegador de la versión fijada en package-lock.json.
npx --no-install playwright install chromium --only-shell

# Descubrir seis recorridos; no inicia DB ni acredita ejecución.
npm run test:e2e:list --workspace @testimonial-cms/web

# Controles de destino, consentimiento y saneamiento (sin servicios).
node --test --test-isolation=none scripts/e2e/managed.test.mjs scripts/e2e/evidence.test.mjs scripts/e2e/privacy.test.mjs

# Controles del runner real: foco, selección parcial y fallo de navegador saneado.
node --test --test-isolation=none scripts/e2e/runner-controls.test.mjs

# Sólo después de ACK humano específico para migrar esta DB descartable.
E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web
```

En un equipo con caché alternativa, conservá el mismo `PLAYWRIGHT_BROWSERS_PATH` al instalar y ejecutar. En Linux, las dependencias del navegador deben estar disponibles; no se instala software del sistema automáticamente. El lanzamiento aislado de Chromium no acredita los recorridos de producto.

## Entorno y aislamiento

[El harness](../../scripts/e2e/run.mjs) genera un identificador aleatorio y crea únicamente sus contenedores, red e imagen. PostgreSQL 18 y Redis 7 están fijados por digest; los datos viven en tmpfs, sin bind mounts ni volúmenes persistentes. Publica puertos aleatorios en `127.0.0.1`; inspecciona nombre, etiqueta, estado, mounts y publicación antes de construir el destino y justo antes de migrarlo. No acepta `DATABASE_URL`, `REDIS_URL` ni un origen remoto. La única variante es `--api-smoke sha256:<ID local>` para probar una imagen API existente; conserva el mismo aislamiento, consentimiento y limpieza de datos, y nunca elimina la imagen suministrada por el caller.

Aplica las migraciones existentes sólo a `e2e_<runId>` en ese PostgreSQL, previa confirmación explícita. [AGENTS.md §5](../../AGENTS.md) exige ACK humano específico para `prisma migrate deploy`, también en pruebas; la variable es un control de operación y no reemplaza ese ACK. No ejecuta `db push` ni modifica el esquema.

Construye el target `runner` del Dockerfile API vigente y ejecuta NestJS real, con JWT/peppers/claves aleatorios en memoria y configuración de producción. Construye Next.js standalone con `NEXT_PUBLIC_API_URL=/api/v1`; un terminador TLS local reenvía a Next y su middleware reescribe a la API. El certificado efímero se guarda en un directorio temporal privado y se elimina al terminar. Sólo los contextos E2E ignoran su CA autofirmada; las cookies conservan Secure/HttpOnly/Strict.

Cada test registra sus propios tenants/cuentas sintéticos mediante HTTP real. El contexto de preparación y el navegador mantienen sesiones independientes; los negativos usan propietarios distintos. No se exporta `storageState`. Los workers se ejecutan de a uno: siete registros, cinco logins y dos capturas quedan dentro de las cuotas reales sin desactivarlas, vaciar Redis entre tests ni modificar TTL. Escritorio cubre cuatro contratos críticos; móvil cubre dos recorridos específicos, sin duplicar toda la matriz.

Al terminar o recibir SIGINT/SIGTERM, detiene procesos y elimina sólo recursos cuyos nombres/etiquetas coincidan con su ejecución; también elimina la imagen propia y el directorio TLS. No usa `docker prune`. Si Docker falla durante la limpieza, el comando falla e identifica el run/recurso pendiente. Una terminación forzada del proceso/host puede impedir `finally`: inspeccioná la etiqueta `testimonial.e2e.run` y el identificador antes de retirar un recurso abandonado; nunca limpies por un prefijo genérico sin verificar propiedad.

## Contratos y oráculos

| Caso                      | Recorrido y efecto comprobado                                                                                                                                                                                                                                                                      |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `E2E-SESSION` · P0        | Login por UI; cookies Secure/HttpOnly/Strict no accesibles a JS; sesión tras recarga; al quitar sólo accessToken, recuperación reactiva con refresh rotado; logout quita cookies y el servidor rechaza reutilizar ese refresh. No simula el paso de 15 minutos ni certifica vencimiento por reloj. |
| `E2E-PUBLISH` · P1/P0     | Captura anónima guarda pending; listado/detalle públicos no lo exponen. Aprobación por UI persiste pero sigue privado; recarga administrativa, publicación por UI y muro visible tras recarga en un contexto anónimo nuevo.                                                                        |
| `E2E-TENANT-CSRF` · P0    | Lectura/escritura de otro tenant devuelven 404, aun con header tenant forjado; falta CSRF u Origin ajeno devuelve 403. Lecturas independientes de ambos propietarios conservan contenido/estado; listado propio excluye al ajeno.                                                                  |
| `E2E-RBAC` · P0           | Editor autenticado puede crear un testimonio (control positivo de sesión/CSRF), no ve Usuarios y recibe 403 al crear un admin o cambiar el tenant. El propietario vuelve a leer usuarios/configuración y comprueba ausencia de cambios.                                                            |
| `E2E-MOBILE-MENU` · P1    | A 320×700, Enter abre el menú, Escape cierra y devuelve foco; navegación por Testimonios y ausencia de desbordamiento del documento.                                                                                                                                                               |
| `E2E-MOBILE-CAPTURE` · P1 | Formulario por teclado, Tab entre campos y hasta enviar, foco en confirmación; tras recarga, lectura real muestra exactamente un testimonio pending con el contenido enviado. Sin desbordamiento del documento.                                                                                    |

No se interceptan respuestas de la aplicación ni se reemplazan AuthService, Prisma o Redis. Cloudinary/YouTube/webhooks externos y warehouse/ETL no se ejercitan en estos recorridos de texto; conservan sus suites dedicadas. Móvil es un viewport Chromium con touch, no un dispositivo físico. Estos casos no certifican WCAG, otros motores, ingress hospedado ni despliegue remoto.

## Regresión detectada por el recorrido

El recorrido de publicación detectó que las listas administrativas esperaban `data.items/meta`, mientras la API envía `data[]` y `meta` en el envelope. `sessionPageRequest` adapta explícitamente ese contrato para las pantallas y valida items/metadatos; lo usan testimonios, catálogos, usuarios, API keys, webhooks y entregas. La regresión de `features/shared/pagination.test.ts` usa el cliente HTTP real con fetch simulado y envelopes del transporte: ocho lecturas válidas y rechazos de payload/meta inconsistentes. La suite UI de testimonios conserva sus assertions y simula ahora ese formato real. BI ya adaptaba su paginación, por lo que conserva su contrato.

## Integridad y privacidad de evidencia

`forbidOnly: true`, retries 0, un worker, timeout de 45 s por caso y 5 min global; los builds/preparación tienen límites propios. El sondeo acotado de readiness no reintenta tests. El reporter exige los seis identificadores únicos aprobados, sin omisiones, retries ni errores globales; una selección parcial también falla.

El resultado saneado queda en `apps/web/.e2e-results/results.json`: identificador permitido, proyecto, status, duración y retry. `environment.json` identifica HEAD, checkout con cambios, Node, digests, entorno y hora; un resultado con `dirty: true` pertenece a ese árbol local, no a un SHA remoto validado. El directorio está ignorado por Git y ESLint. El harness no conserva stdout/stderr de servicios/builds ni imprime cuerpos de petición, cookies o variables.

CI instala Chromium de la dependencia fijada con sus dependencias Linux y ejecuta controles negativos antes de los seis recorridos. Conserva sólo `results.json` y `environment.json` en el artefacto `e2e-results` durante 14 días, también al fallar. No adjunta el directorio runtime ni reportes ricos. E2E tiene sus propios PostgreSQL/Redis: no reutiliza los servicios ni datos de integración del job.

El smoke de la API final reutiliza el harness sin compilar Next ni lanzar Playwright: login Bearer válido, `/me`, creación/relectura de un testimonio propio, login inválido 401, métricas privadas, raíz inmutable, tmpfs y drenaje sin SIGKILL/OOM. Es validación de imagen API, no reemplaza los recorridos del navegador. [Release](../../scripts/release/image-smoke.mjs) prueba maintenance offline y API por ID inmutable, verifica etiquetas de origen y registra `release-evidence/image-smoke.json`; el publicador exige ese resultado y los mismos IDs antes del primer push.

Traces, videos, screenshots y HTML están desactivados. Playwright 1.64 también genera snapshots ARIA/error-context en fallos: el flag del runner fijado desactiva la captura ARIA y el hook de privacidad sanea los errores antes de escribirlos, manteniendo cantidad/status fallidos. Un control negativo ejecuta un fallo real con sentinelas en formulario, stdout y assertion, y verifica su ausencia en stdout y archivos. Al actualizar Playwright hay que repetir ese control. Los diagnósticos saneados reducen el detalle disponible: reproducí sólo el caso con datos sintéticos en un entorno descartable cuando haga falta investigar, sin exportar una sesión ni activar reportes con secretos.
