# Testing profesional integrado al ciclo de desarrollo y entrega

**Inicio:** 2026-10-11. **Cierre:** 2026-10-12. **Estado:** Completado — tres fases implementadas, ACK de cierre recibido, PR #8 integrado y CI de main aprobado. **Rama de cierre documental:** `codex/testing-cicd-closeout`; implementación integrada desde `codex/testing-cicd-final` (iniciada en `codex/testing-cicd-e2e`).

## Contexto y Restricciones

- Plan aprobado en el chat después de auditar pruebas, CI y disparadores de entrega. El mensaje «Desactivado, comienza» autoriza iniciar únicamente la fase 1; las fases 2 y 3 necesitan ACK posteriores.
- Conservar Jest/Supertest, Vitest/Testing Library, npm workspaces, NestJS, Next.js, autenticación propia y aislamiento por tenant. Aplicar `testing-tdd-engineering` y `cicd-pipeline-engineering`.
- Leer `AGENTS.md`, `llm.txt`, arquitectura, reglas de negocio y guía de testing. Esta tarea mejora evidencia y automatización; no cambia contratos de producto.
- Ejecutar sólo la fase `[Actual]`, presentar evidencia y commit sugerido, y detenerse. No trasladar aprobaciones de otros SHA.
- No modificar manifiesto raíz, hooks, infraestructura ni esquema Prisma. No ejecutar `prisma migrate deploy`/`db push` desde esta sesión sin ACK específico, tampoco contra fixtures locales. Se conserva la preparación descartable ya definida por CI.
- No crear recursos, habilitar entrega, publicar tags ni desplegar. No persistir secretos, tokens, contraseñas o PII en documentación/contexto/evidencia.
- Las decisiones humanas conservan entrega por tag anotado y aprobación de entrega. El 2026-10-12 el usuario aclaró que trabaja solo y autorizó cero aprobaciones obligatorias de PR; esta decisión reemplaza la exigencia inicial de una revisión ajena al autor.
- Registrar y commitear este plan antes de comenzar la implementación, según el índice de planes. Ese registro es preparación de la fase 1, no una fase HITL adicional.

## Diagnóstico de partida

Checkout auditado `92051ad`: Jest descubre 68 suites/476 casos API; Vitest ejecuta 26 archivos/161 casos web. La ejecución local API sin servicios aprobó 311 y omitió 165; entrega con proveedores simulados aprobó 49. La primera ejecución restringida por el sandbox no constituye un defecto de aplicación.

El CI remoto `38195290204`, SHA `578dabb`, validó 476 casos API sin omisiones. La comparación con el checkout auditado no mostró diferencias de archivos; no se atribuye ese run a nuevos cambios. GitHub exige `verify`, `secret-scan` y `dependency-review`, pero cero aprobaciones; tags protegidos y environments ausentes.

Brechas: E2E permanente ausente, gate de omisiones sólo API, cobertura web sin proveedor, imágenes reconstruidas para release sin repetir sus smoke funcionales antes de publicar y guía Git/contribución desactualizada. Los tests existentes no acreditan por sí solos un historial Red-first.

## Decisiones

- Seleccionar pruebas por contratos y riesgo, con fronteras, negativos y efectos persistentes; no imponer proporciones ni un porcentaje global de cobertura.
- Reportar integración según su límite real: DB/JWT/HTTP simulados no acreditan persistencia ni E2E. Mantener las integraciones reales ya existentes.
- Publicar evidencia de ejecución y cobertura de ambos workspaces. Rechazar suites vacías, fallidas, pendientes, omitidas, enfocadas y reportes incompletos; distinguir selección local de validación obligatoria CI.
- Adoptar Playwright sólo en fase 2, Chromium de escritorio y viewport móvil, HTTPS local y API/PostgreSQL 18/Redis 7 reales descartables. Aislar datos y sesiones; cero retries de suites.
- Conservar inicialmente el job `verify` y los disparadores: PR/main validan; tag anotado del mismo SHA habilita entrega protegida; migración y recuperación permanecen manuales y separadas.

## [Completada] Fase 1 — Metodología, evidencia y controles de integridad

- [x] Registrar y commitear plan/índice antes de implementar (`bbb43c8`).
- [x] Relacionar contratos críticos con escenarios, riesgo, nivel, dependencias y etapa de ejecución.
- [x] Aclarar las suites de flujo con persistencia/tokens simulados, conservando sus assertions.
- [x] Incorporar reporte JSON web y gate contra fallos/omisiones/todo/reportes incompletos; conservar y fortalecer el gate API.
- [x] Bloquear tests enfocados en lint API y configuración web; verificar con controles negativos ejecutables.
- [x] Añadir proveedor V8 compatible con Vitest, comando de cobertura web y reportes de ambas aplicaciones sin umbral porcentual global.
- [x] Actualizar guía de testing, contribución, flujo Git y plantilla PR con contratos, TDD, omisiones y evidencia.
- [x] Validar gates, suites disponibles, tipos, lint, instalación/lockfile y workflows; registrar límites y resultados reales.
- [x] Obtener CI remoto del commit de implementación con servicios completos y revisión/ACK de cierre.

**Completitud:** implementación y validación local/remota registradas. CI del SHA `d26385090e65d9665414699db3cdeed7fd62f40a` aprobado; el ACK «Continuar» del 2026-10-12 habilita la fase 2.

**ACK de inicio:** recibido en el chat. **ACK para avanzar:** «Continuar», 2026-10-12, tras commit humano de implementación; cierre condicionado a CI, ahora aprobado.

**Commit sugerido:** `test(ci): rechazá suites incompletas y documentá sus contratos`.

## [Completada] Fase 2 — E2E crítico con servicios reales

- [x] Añadir Playwright y `test:e2e` web, separado de Jest/Vitest.
- [x] Implementar builds de producción, proxy de mismo origen y HTTPS local, DB y Redis exclusivos; verificar destinos descartables y limpiar recursos propios.
- [x] Implementar login/recarga/refresh/logout, captura → aprobación → publicación → visibilidad pública, denegaciones por rol/tenant/CSRF y navegación móvil por teclado.
- [x] Prohibir `.only`, acotar timeouts, no reintentar suites y producir evidencia saneada sin estado de sesión ni credenciales.
- [x] Ejecutar recorridos con efectos persistidos y registrar sus límites; migración del PostgreSQL propio descartable autorizada explícitamente. Detenerse para ACK de cierre de fase.

**Completitud:** implementación y validación local terminadas; 6/6 E2E aprobados, cero reintentos/omisiones. El usuario registró/publicó la implementación como `b0ff93f`; no se atribuye a ese SHA el CI remoto de fase 1. El ACK «Continuar» posterior habilita la fase 3.

**ACK de inicio:** «Continuar», 2026-10-12. **ACK de migración:** «Sí, autorizo sólo esa migración descartable para validar E2E», 2026-10-12. **ACK para avanzar:** «Continuar», recibido después del cierre local y commit `b0ff93f`. **Commit:** `test(e2e): cubrí los recorridos críticos con servicios reales`.

## [Completada] Fase 3 — Integración E2E, release y gobernanza

- [x] Incorporar E2E en `verify` después del build, con datos y namespace Redis exclusivos.
- [x] Ajustar revisión al contexto confirmado: cero aprobaciones obligatorias por ACK del único mantenedor; conservar PR, checks y descarte de revisiones obsoletas, y verificar configuración remota.
- [x] Parametrizar smoke existentes y probar las imágenes finales maintenance/API antes de publicar esas mismas imágenes; API con almacenamiento descartable y operación autenticada exitosa.
- [x] Mantener tags, aprobación, digest/SBOM/escaneos/attestations, controles API/worker/candidata y recuperación compatible.
- [x] Verificar negativos de gates y CI de implementación; no habilitar proveedores ni confundir fixtures con aceptación remota. Controles locales y CI `38280231648` del SHA `3e42880` aprobados. El cierre documental conserva sus propios checks en el PR.

**ACK de inicio:** «Continuar», 2026-10-12, tras el cierre de fase 2. Autoriza esta fase; la migración sigue limitada al PostgreSQL descartable del harness. La decisión posterior del único mantenedor reemplaza la exigencia inicial de revisión ajena. **Commit sugerido:** `ci(release): verificá los artefactos antes de publicar`.

**Completitud:** implementación integrada mediante PR #8, CI de PR y main aprobados; ACK de cierre «Continua entonces con el cierre del plan» recibido el 2026-10-12. Evidencia final al pie del documento.

## Criterios de aceptación y evidencia

La evidencia siguiente conserva los resultados y decisiones de cada etapa, incluidos fallos y pendientes históricos. El estado vigente se registra en el cierre formal al final del documento.

- Un test fallido/omitido/enfocado, suite vacía o reporte ausente/inconsistente impide aprobar CI.
- E2E conserva efectos tras recargar y rechaza accesos indebidos sin modificar datos ajenos.
- Una imagen defectuosa impide publicar; un smoke fallido impide promover; tag sin CI válido del mismo SHA queda rechazado.
- Reportes identifican ejecución/SHA, entorno, resultados, simulaciones y duración; no acreditan certificación ISO ni cumplimiento auditado.
- Recursos, aceptación Vercel/Railway/Supabase y activación real quedan fuera de esta implementación.

### Evidencia de fase 1

Implementación en `codex/testing-cicd-e2e`, commit `4ed5816`, posterior al registro `bbb43c8`; verificación del 2026-10-11/12 con Node 24.21.0 y npm 11.19.0. ACK humano «Continuar» recibido el 2026-10-12 para avanzar una vez validada la fase 1. PR borrador [#6](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/6); sincronización sin cambios de archivos con main en `a3cfee9`. CI aprobado en `d263850`; fase 2 habilitada por el ACK recibido, fase 3 pendiente.

Cambios: [matriz de contratos](../technical/testing_contracts.md), guía/contribución/flujo Git/plantilla PR; `auth-flow.spec.ts` conserva cuerpo ejecutable/assertions; gate JSON compartido, restricciones de foco y cobertura de ambas apps en CI. Se añadió únicamente `@vitest/coverage-v8@5.0.3` al workspace web; npm generó el lockfile (ocho entradas nuevas de paquetes y retiro de `@swc/helpers` marcado extraneous). El manifiesto raíz, schema, infraestructura, hooks y workflows de entrega no cambiaron.

| Control                    | Resultado local y límite                                                                                                                                                                                                                                                                                                                             |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Red del gate               | Extraído el gate API anterior: 36 casos nuevos fallaron funcionalmente porque aceptaba reportes inconsistentes/todo; 12 pasaron. La ejecución restringida de subprocesos no se contabilizó como Red.                                                                                                                                                 |
| Red de foco                | Sin restricciones: 6 fixtures ESLint no se rechazaban y Vitest aceptaba `.only` local; 7 fallos funcionales y 1 control ordinario aprobado.                                                                                                                                                                                                          |
| Green de controles         | `node --test scripts/testing/*.test.mjs scripts/test-next-eslint-glob.mjs`: 65 aprobados (64 integridad/foco + 1 adaptador Next), cero fallos/omisiones/todo. Fixtures temporales sintéticas; no pruebas enfocadas persistidas en el repo.                                                                                                           |
| API con cobertura/JSON     | `npm run test:cov --workspace @testimonial-cms/api -- --json --outputFile=/tmp/testing-api-results.json`: 311 aprobados, 165 omitidos; 49 suites aprobadas y 19 omitidas. No se configuraron servicios de integración. Evidencia parcial; el gate rechazó correctamente este reporte.                                                                |
| Web con cobertura/JSON     | `npm run test:cov --workspace @testimonial-cms/web -- --reporter=default --reporter=json --outputFile=/tmp/testing-web-results.json`: 161 aprobados en 26 archivos, cero omisiones; gate aprobado (54 suites al contar describe anidados).                                                                                                           |
| Compatibilidad Jest nativa | Suite renombrada `auth-flow.spec.ts`: 9 aprobados, JSON nativo aceptado por el gate. Es ejecución selectiva, no reemplaza integraciones.                                                                                                                                                                                                             |
| Cobertura generada         | API: 58.19% statements / 61.23% líneas, parcial por servicios ausentes. Web: 37.02% statements / 34.39% líneas. Ambas generan HTML, LCOV y JSON summary; estos porcentajes no constituyen aceptación de contratos.                                                                                                                                   |
| Instalación y supply chain | `npm ci --cache /tmp/testing-cicd-npm-cache` aprobado, sin modificar lockfile. `npm audit --audit-level=high`: 0 altas/críticas, 20 moderadas. `npm audit signatures`: 1355 firmas verificadas y 293 attestations. No se ejecutó audit fix.                                                                                                          |
| Cliente Prisma / tipos     | Tras npm ci faltaba generar el cliente: primera pasada de tipos/build API falló por preparación incompleta. `npm run db:generate --workspace @testimonial-cms/api` aprobado con acceso a caché; no aplica migraciones. `npm run typecheck` posterior aprobado en ambas apps.                                                                         |
| Lint                       | `npm run lint`: código 0, sin errores; 3 advertencias API y 10 web en archivos sin cambios. No se suprimieron ni se reporta lint sin advertencias.                                                                                                                                                                                                   |
| Build / proxy              | Build completo API/web posterior a generación Prisma aprobado con `NEXT_PUBLIC_API_URL=/api/v1` y backend de fixture local. `node scripts/web-proxy-smoke.mjs` aprobado: cookies, CSRF/Origin, headers, rutas internas, métodos, caché/query y cuerpo de 14 MiB. Es fixture sintética sin DB/Redis, no E2E persistente ni aceptación de proveedores. |
| Release existente          | `node --test --test-isolation=none scripts/release/*.test.mjs`: 49 aprobados, cero omisiones, proveedores simulados. No acredita entrega remota.                                                                                                                                                                                                     |
| Workflow / documentos      | `bash scripts/release/check-workflows.sh`: actionlint aprobado. `git diff --check` y enlaces locales de guías/plantilla/plan aprobados. Formato de documentos y scripts verificado con Prettier.                                                                                                                                                     |

**Evidencia remota:** [run 38199831600](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38199831600), SHA `d26385090e65d9665414699db3cdeed7fd62f40a`: `verify`, `secret-scan` y `dependency-review` aprobados. Los reportes descargados confirman 476/476 API y 161/161 web, cero fallos/omisiones/todo; cuatro artefactos de resultados/cobertura publicados. PostgreSQL 18, warehouse separado, Redis 7, builds, smoke y gates de imágenes aprobados. No acredita despliegue remoto.

**Regresión detectada remotamente:** [run 38199299975](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38199299975), SHA `a3cfee9`: secret-scan/dependency-review aprobados; verify falló en la primera fixture de foco (63/64 controles aprobados). Reproducido localmente con `CI=true`: TypeScript-ESLint infiere single-run y usa inicialmente el SourceFile de disco, ignorando el primer texto en memoria de `lintText`. El control ahora desactiva `parserOptions.project` únicamente en su instancia ESLint: conserva las reglas reales y analiza sintaxis de cada fixture, que no necesita información de tipos. No se modifican configuración ni restricciones de lint de producción. Corrección en `d263850`: 65 controles locales aprobados con `CI=true`; ejecución remota 38199831600 aprobada.

**Hallazgo operativo fuera de alcance:** `.husky/pre-commit` está versionado con modo `100644`; Git omitió el hook al registrar el plan. `npm ci` ejecutó el instalador Husky existente, sin cambiar archivos versionados de hooks. Reparar el permiso requiere el ACK específico de `AGENTS.md`; no se modificó ni se confía en el hook como sustituto de CI.

### Evidencia de fase 2 — implementación y validación local terminadas

ACK «Continuar» del 2026-10-12; fase iniciada después de aprobar CI de fase 1 y registrar el avance en `1702ead`. Playwright 1.64.0 fijado en workspace web y lockfile (tres paquetes nuevos); manifiesto raíz, schema, infraestructura, hooks y workflows conservados. [Guía operativa E2E](../technical/e2e.md).

- Seis recorridos aprobados: cuatro de escritorio y dos móviles. API Docker runner de producción, PG18/Redis7 por digest con tmpfs, Next standalone, proxy y HTTPS local; destinos generados por el harness sin URLs externas. Resultado final del run `5a293178acc3`, sin omisiones ni reintentos.
- Guardas Red: scaffold sin validación aprobó 1 control y falló 11 funcionalmente (propiedad, exposición, mounts, consentimiento y origen). El primer intento con aislamiento de procesos falló por sandbox y no se cuenta como Red. Green: 12/12.
- Evidencia/privacidad: 10 controles aprobados; no persisten errores ricos ni estado de sesión. Tres controles adicionales del runner real aprobados: `.only` rechaza antes de ejecutar, selección parcial falla aunque el caso apruebe, fallo real de Chromium mantiene status failed sin sentinelas de formulario/stdout/assertion en archivos o salida. Junto con las 12 guardas, ejecución final con `CI=true`: 25/25, cero fallos/omisiones/todo.
- Chromium headless compatible descargado a caché temporal; el instalador usa fallback Ubuntu24.04 en este OS. Lanzamiento y lectura de título aislados aprobados; no acredita E2E ni compatibilidad de otros sistemas.
- Vitest final: 176/176 en 27 archivos, sin descubrir specs Playwright. Typecheck web aprobado; lint web sin errores y 10 advertencias existentes. Las primeras pasadas detectaron tipos/alias de callback de fixtures que se corrigieron sin suprimir reglas. Los 15 casos de paginación también aprobaron después de añadir la assertion de límite de página.
- Sin `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1`, el comando falla antes de operar Docker o migraciones. La variable no equivale al ACK humano requerido por AGENTS.md §5.
- Builds de producción aprobados: Dockerfile API target runner y Next standalone con proxy relativo, repetidos por el harness en cada ejecución completa. Imagen temporal de preflight eliminada tras verificar su etiqueta. Formato y diff sin errores. ACK específico recibido el 2026-10-12: «Sí, autorizo sólo esa migración descartable para validar E2E». Se ejecutaron migraciones únicamente en el PostgreSQL 18 propio de cada run, publicado en loopback y eliminado al terminar. Fase 3 permanece pendiente.

Primera ejecución completa del harness: `f748d775bc16`, con migración autorizada, build y readiness aprobados. 1/6 recorridos aprobado (sesión/recarga/refresh/logout), 5 fallidos al preparar tenants por nombre repetido: el contrato requiere nombre único y la fixture inicial lo reutilizaba. Se corrigió el generador de nombre, conservando cuentas/slugs únicos, y se añadió localización saneada de errores para diagnosticar sin valores sensibles. Sin cambiar reglas del producto, cuotas, assertions ni retries. Se verificó ausencia de contenedores/red/imágenes de ese run después de limpiar. Se conserva este fallo como evidencia previa. Auditoría actual: 0 altas/críticas y 20 moderadas existentes en la cadena Jest; no se ejecutó audit fix.

Segunda ejecución `68ebb6a7152f`: 5/6 aprobados; publicación falló al esperar la fila pending. Los efectos API sí estaban persistidos. Se identificó una discrepancia de contrato: ApiResponseInterceptor devuelve `data: []` y `meta` al nivel del envelope; siete adaptadores administrativos esperaban `{items, meta}` dentro de `data`. BI ya adaptaba explícitamente el transporte y no se modificó. Se añadió regresión por HTTP client real con fetch simulado: 9 fallos funcionales/6 aprobados antes de corregir. Green posterior: 15/15 de contrato y 3/3 UI testimonial; fixture UI conserva assertions y ahora simula el envelope real. El helper de paginación transforma explícitamente la respuesta para las pantallas y valida items/meta; no cambia API ni listas públicas. Se corrigieron los siete lectores afectados (testimonios, catálogos, usuarios, API keys, webhooks y entregas).

Tercera ejecución completa `5a293178acc3`, iniciada el 2026-10-12 a las 04:10:12 UTC: **6/6 aprobados**, retries 0, comando terminado con código 0. Duraciones: sesión 3200 ms, publicación 4691 ms, tenant/CSRF 1735 ms, RBAC 1372 ms, menú móvil 2965 ms y captura móvil 1102 ms. `apps/web/.e2e-results/results.json` declara `complete: true`; `environment.json` registra HEAD `1702eadf0a013edc4f47cc9f28acb10e7fc9ccba`, `dirty: true`, Node 24.21.0 y digests. Es evidencia del árbol local modificado; el directorio está ignorado y no acredita CI de estos cambios. Consultas posteriores por etiqueta `testimonial.e2e.run=5a293178acc3` confirmaron cero contenedores, redes e imágenes propios restantes. Los dos fallos anteriores motivaron correcciones identificadas y ejecuciones completas nuevas, sin reintentos automáticos ni relajación de assertions.

Límites: Chromium desktop/viewport móvil local, recorridos de texto y persistencia OLTP/Redis reales. No se ejercitaron Cloudinary, YouTube, destinos webhook, warehouse/ETL, otros motores ni proveedores hospedados. No se modificaron disparadores de CI/deploy en esta fase. ACK de avance recibido después del commit humano `b0ff93f`; fase 3 iniciada.

### Evidencia de fase 3 — implementación y validaciones previas

ACK «Continuar» posterior al cierre de fase 2. Se registró el avance en `06bbdfb` y se sincronizó main en `348c96a` sin diferencias de archivos. El PR #6 fue integrado humanamente como `b9c651f`; el siguiente PR incluye fases 2/3. No se reutiliza su CI como aceptación del código nuevo.

- CI conserva `verify`, `secret-scan`, `dependency-review`, eventos PR/main y cancelación de CI obsoleto. Después del build/proxy instala Chromium fijado por lockfile, ejecuta controles negativos y seis E2E. Cada run crea sus propios PG18/Redis7 con tmpfs/puertos loopback; no comparte datos/Redis de integración. Artefacto `e2e-results` saneado, dos JSON, 14 días, también al fallar.
- La variante `--api-smoke sha256:<ID>` del mismo harness conserva consentimiento, guardas y limpieza. Verifica liveness/readiness, registro/login Bearer, `/me`, creación y relectura propia, login inválido 401, métricas privadas, usuario no root, raíz inmutable, tmpfs y drenaje sin SIGKILL/OOM. No construye Next ni sobrescribe la evidencia E2E; no elimina la imagen del caller.
- `image-smoke.mjs` resuelve IDs/etiquetas OCI del SHA, ejecuta maintenance offline y la API final sin proveedores; vuelve a resolver tags y sólo entonces registra aceptación. `publish.mjs` exige evidencia completa del SHA y los mismos tags/IDs de ambas imágenes antes del primer push. Las pruebas del publicador demuestran ausencia de push con evidencia ausente/fallida/obsoleta o imagen reemplazada, y conservan recuperación por digest.
- Red: 17/17 controles funcionales fallaron con el scaffold sin verificaciones. Tras implementar smoke/identidad, 17/17 aprobaron. Al extraer el publicador todavía sin gate, tres controles de publicación fallaron (9 existentes aprobados); después del gate aprueban. Se agregaron controles de reemplazo antes del primer push, publicación válida y CLI que rechaza URL como imagen. Los comandos Docker/GHCR de las pruebas nativas son dobles; no publican imágenes.
- Preflight real sobre el árbol local modificado `348c96a`: API runner y maintenance construidos, IDs `sha256:9d1fff05c1a528d4fba49d802afa8fd0cc1f8caff23406a1fbc7f286108f42a3` y `sha256:47e38366a9dac0de7512e4b4521cb11227ab547abf292d15ac1cf9de4dcfb650`. API smoke `47bb80660997` aprobado; orquestador completo aprobó y generó `release-evidence/image-smoke.json`. Es preflight local con cambios, no CI ni artefacto publicado de ese SHA. Maintenance usada como imagen API en `7a43dd6aa1c8` fue rechazada con código 1; no se relajaron requisitos de arranque ni se reintentó la suite.
- Gobernanza aplicada por PATCH exclusivamente al número de aprobaciones y consultada después: `required_approving_review_count=1`, `dismiss_stale_reviews=true`, admins protegidos, strict=true, checks `verify/secret-scan/dependency-review`, conversaciones resueltas, sin force-push/borrado. Política versionada actualizada. No se enviaron solicitudes ni mensajes a revisores.
- Actionlint, sintaxis Bash, Prettier, diff y enlaces locales aprobados. La primera ejecución nativa restringida aprobó 93 y falló el subproceso existente de aislamiento de credenciales por sandbox; repetida con permisos para subprocesos, 94/94 aprobó. Verificación final ampliada: **97/97** (34 E2E/harness + 63 release), cero fallos/omisiones/todo. Limpieza de los runs positivo/negativo verificada por etiqueta: cero contenedores/redes propios restantes. Consulta remota confirma cero environments y `DEMO_DELIVERY_ENABLED` ausente. No se modificaron manifiesto raíz, schema, infraestructura, hooks ni migradores productivos; no se habilitó entrega, publicó tag/imagen ni operó proveedor.

En esta entrega previa, la revisión humana e integración permanecían pendientes; el cierre formal registra su resolución posterior. El smoke local no acredita registry, Vercel/Railway/Supabase ni activación remota.

**Scanner de la primera publicación:** PR #7, commit `1de5ff7`, run `38276988428`. Dependency Review aprobó; secret-scan rechazó una URI de credenciales sintéticas en `scripts/e2e/managed.test.mjs:110` (`URI`, resultado unverified/unknown). No era una credencial real: la fixture verifica que `validateOrigin` rechaza userinfo. Se construye ahora mediante propiedades de `URL`, conservando la assertion. Como TruffleHog inspecciona también commits anteriores de la rama, se prepara el mismo diff corregido en una rama nueva desde main; se conserva la rama/PR/run originales como historia, sin force-push ni exclusiones de scanner. La nueva rama no contiene el commit que agregó la URI literal. El resultado de `verify` se consulta separadamente; este run no se declara aprobado.

**CI previo y correcciones de entorno:** el run `38276988428` aprobó 476 API, 176 web y 6 E2E, pero `verify` falló en el sondeo web por `connection reset` durante el arranque del puerto Docker. El sondeo HTTP ahora tiene un presupuesto acotado que incluye resets; sólo repite lecturas de readiness. Regresión funcional: 2/2 fallos al retirar la corrección (respuesta transitoria rechazada y presupuesto no consumido); Green: 2/2 aprobados, también conserva el fallo permanente. No se reintentan suites ni mutaciones.

PR [#8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/8), rama `codex/testing-cicd-final`, commit `58206ef`: escaneo offline del diff sin candidatos y secret-scan/dependency-review remotos aprobados en run `38278337318`. El PR #7 se cerró al reemplazarlo; su rama e historia permanecen. `verify` rechazó correctamente 475/476 API: liveness devolvió 503 durante la prueba de caída del warehouse. Su controlador sólo evalúa heap; el proceso compartido con Jest/cobertura podía acumular memoria de otras suites. Se reprodujo esa contaminación con dos fixtures que retienen 192 MiB: el comando anterior compartió PID y falló. Cobertura ahora mantiene un worker secuencial, reciclable entre archivos por encima de 128 MiB; la regresión aprueba con dos PIDs. No se modifican producción, límite de 300 MiB, servicios reales ni assertions BI. Tres caracterizaciones adicionales con Terminus real comprueban frontera exacta, exceso de heap y caída OLTP, con sólo memoria/consulta simuladas; 5/5 casos de salud relacionados aprobados. Este fallo ocurre antes del replay y no se declara resolución del seguimiento histórico BI-RECOVERY-001. CI del nuevo SHA pendiente.

Validación local de estas correcciones: **165/165 controles nativos**, cero fallos/omisiones/todo (integridad/foco, aislamiento de heap, readiness, harness y release); tipos API, sintaxis Bash, Prettier y diff aprobados. Lint API sin errores y tres advertencias existentes. Las tres caracterizaciones elevan el descubrimiento esperado a 69 suites/479 casos API; el próximo CI debe ejecutarlos completos. Sin cambios en manifiesto raíz, schema, hooks ni infraestructura.

### Entrega técnica de fase 3 — 2026-10-12

[CI `38280231648`](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38280231648) aprobado: evento PR, head `3e42880d7a60c72cc182b088000f418edf2b7e5f`, checks `verify`, `secret-scan` y `dependency-review` exitosos. Artefactos consultados en memoria: API **69 suites/479 casos**, web **176 casos**, todos aprobados, cero fallos/pendientes/todo; E2E `complete: true`, **6 esperados/ejecutados/aprobados**, retry 0 en cada caso. El checkout del E2E fue el merge de PR `aec25886655465ff6794554da6e3dbc42c878933`, `dirty: false`; no se confunde con un CI de push a main.

Builds, proxy, configuración/identidades, maintenance offline, smoke de imágenes de producción, SBOM y gates de vulnerabilidades aprobados. El smoke API realizó una operación autenticada con persistencia en su PostgreSQL propio; el web confirmó readiness, raíz inmutable y drenaje. No se publicaron imágenes. Se eliminaron cuatro etiquetas locales creadas por esta validación tras verificar revisión/origen; cero contenedores/redes propios restantes.

Consulta histórica durante la entrega técnica: una aprobación requerida, descarte de revisiones obsoletas, strict/enforce admins y los tres checks conservados; sin force-push/borrado. `DEMO_DELIVERY_ENABLED` ausente y cero environments. El [PR #8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/8) permanecía en borrador para revisión ajena al autor e integración humana. La decisión posterior del único mantenedor y la integración se registran abajo. Release conserva la exigencia de CI de push a main del mismo SHA y las aprobaciones de entrega. Proveedores, activación y aceptación remota continúan fuera de alcance.

**Commit de correcciones:** `3e42880` — `fix(ci): aislá el heap y tolerá resets de arranque`. **Commit sugerido de cierre:** `docs(testing): registrá la aceptación de CI y cerrá el plan`.

Según AGENTS.md §9 y el ciclo del índice de planes, en esta etapa faltaba el ACK humano de cierre; se recibió posteriormente y se registra al final. No hay otra fase de implementación en este plan.

### Ajuste autorizado de gobernanza — único mantenedor, 2026-10-12

El usuario confirmó que trabaja solo y pidió quitar el bloqueo de aprobación para poder integrar el PR #8. Este ACK explícito sustituye la decisión inicial de exigir una revisión ajena al autor. Se establece `required_approving_review_count=0`, conservando PR obligatorio, checks `verify/secret-scan/dependency-review`, strict, protección de admins, conversaciones resueltas, descarte de revisiones obsoletas y bloqueo de force-push/borrado. No cambia aprobaciones de entrega ni activa despliegues.

El usuario convirtió el PR #8 en listo para revisión. El head `81c9711` aprobó los tres checks en [CI 38281646752](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38281646752), con 479 API, 176 web y 6 E2E completos, sin omisiones/retries. En ese momento, el commit posterior de política/documentación aún necesitaba sus propios checks y la integración quedaba a cargo del usuario; ambos resultados se registran en el cierre formal.

**Commit sugerido:** `fix(github): permití integrar PRs con un único mantenedor`.

### Cierre formal autorizado — 2026-10-12

**ACK de cierre:** «Continua entonces con el cierre del plan», recibido después de implementar las tres fases e integrar el PR #8. Este ACK satisface AGENTS.md §9; no autoriza activación, recursos ni despliegues.

- El head final `f5872b6f69fc998f853998fed2cd51192e0571b8` del [PR #8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/pull/8) aprobó `verify`, `secret-scan` y `dependency-review` en [CI 38286554849](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38286554849).
- El usuario integró el PR #8 el 2026-10-12 a las 17:57:13 UTC como `ddd7fca49e870d70f51e37de4ce5d4f7a13bcc5f`. La rama documental `codex/testing-cicd-closeout` parte de ese commit.
- [CI de push a main 38287649795](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38287649795), SHA `ddd7fca49e870d70f51e37de4ce5d4f7a13bcc5f`: **aprobado**, con `verify` y `secret-scan` exitosos, builds/proxy, smoke de producción/maintenance, SBOM y gates de vulnerabilidades aprobados. `dependency-review` se omite por diseño en eventos push y aprobó en el PR; no representa una omisión de tests.
- Artefactos consultados en memoria: API **69 suites/479 casos**, web **176 casos**, todos aprobados, cero fallos/pendientes/todo. E2E **6 esperados/ejecutados/aprobados**, `complete: true`, retry 0 en cada caso, checkout `ddd7fca49e870d70f51e37de4ce5d4f7a13bcc5f`, `dirty: false`. No se traslada la evidencia de un SHA anterior.
- Protección remota consultada de nuevo: cero aprobaciones obligatorias, PR y checks `verify/secret-scan/dependency-review`, strict, admins protegidos, conversaciones resueltas, descarte de revisiones obsoletas y bloqueo de force-push/borrado. `DEMO_DELIVERY_ENABLED` ausente, cero environments y entrega desactivada.

No queda otra fase de implementación de testing/CI/CD en este plan. La activación y aceptación de proveedores permanecen en el plan/runbook de entrega; no se publicaron tags/imágenes ni se operaron proveedores. El seguimiento histórico BI-RECOVERY-001 y el permiso del hook mencionado arriba conservan sus límites y no se declaran resueltos por este cierre.

El commit documental de cierre debe aprobar sus propios checks antes de integrarse; esos resultados se registran en su PR y no sustituyen el CI de la implementación o el de main.

**Commit sugerido:** `docs(testing): cerrá el plan con CI de main aprobado`.
