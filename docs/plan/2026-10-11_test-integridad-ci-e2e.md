# Testing profesional integrado al ciclo de desarrollo y entrega

**Inicio:** 2026-10-11. **Estado:** En Progreso. **Rama:** `codex/testing-cicd-e2e`.

## Contexto y Restricciones

- Plan aprobado en el chat después de auditar pruebas, CI y disparadores de entrega. El mensaje «Desactivado, comienza» autoriza iniciar únicamente la fase 1; las fases 2 y 3 necesitan ACK posteriores.
- Conservar Jest/Supertest, Vitest/Testing Library, npm workspaces, NestJS, Next.js, autenticación propia y aislamiento por tenant. Aplicar `testing-tdd-engineering` y `cicd-pipeline-engineering`.
- Leer `AGENTS.md`, `llm.txt`, arquitectura, reglas de negocio y guía de testing. Esta tarea mejora evidencia y automatización; no cambia contratos de producto.
- Ejecutar sólo la fase `[Actual]`, presentar evidencia y commit sugerido, y detenerse. No trasladar aprobaciones de otros SHA.
- No modificar manifiesto raíz, hooks, infraestructura ni esquema Prisma. No ejecutar `prisma migrate deploy`/`db push` desde esta sesión sin ACK específico, tampoco contra fixtures locales. Se conserva la preparación descartable ya definida por CI.
- No crear recursos, habilitar entrega, publicar tags ni desplegar. No persistir secretos, tokens, contraseñas o PII en documentación/contexto/evidencia.
- Las decisiones humanas conservan entrega por tag anotado y aprobación; existe otra persona disponible para exigir una revisión de PR en fase 3.
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

## [Actual] Fase 1 — Metodología, evidencia y controles de integridad

- [x] Registrar y commitear plan/índice antes de implementar (`bbb43c8`).
- [x] Relacionar contratos críticos con escenarios, riesgo, nivel, dependencias y etapa de ejecución.
- [x] Aclarar las suites de flujo con persistencia/tokens simulados, conservando sus assertions.
- [x] Incorporar reporte JSON web y gate contra fallos/omisiones/todo/reportes incompletos; conservar y fortalecer el gate API.
- [x] Bloquear tests enfocados en lint API y configuración web; verificar con controles negativos ejecutables.
- [x] Añadir proveedor V8 compatible con Vitest, comando de cobertura web y reportes de ambas aplicaciones sin umbral porcentual global.
- [x] Actualizar guía de testing, contribución, flujo Git y plantilla PR con contratos, TDD, omisiones y evidencia.
- [x] Validar gates, suites disponibles, tipos, lint, instalación/lockfile y workflows; registrar límites y resultados reales.
- [ ] Obtener CI remoto del commit de implementación con servicios completos y revisión/ACK de cierre.

**Completitud:** implementación revisable y validación local registrada. La validación completa del nuevo SHA en CI remoto es un pendiente explícito hasta que exista el commit publicado y su run. No habilitar fase 2 por una validación parcial.

**ACK de inicio:** recibido en el chat. **Review de cierre:** pendiente.

**Commit sugerido:** `test(ci): rechazá suites incompletas y documentá sus contratos`.

## [Pendiente] Fase 2 — E2E crítico con servicios reales

- Añadir Playwright y `test:e2e` web, separado de Jest/Vitest.
- Preparar builds de producción, proxy de mismo origen y HTTPS local, DB y Redis exclusivos; verificar destinos descartables y limpiar recursos propios.
- Cubrir login/recarga/refresh/logout, captura → aprobación → publicación → visibilidad pública, denegaciones por rol/tenant/CSRF y navegación móvil por teclado.
- Prohibir `.only`, acotar timeouts, no reintentar suites y producir evidencia saneada sin estado de sesión ni credenciales.
- Ejecutar recorridos con efectos persistidos y registrar sus límites; detenerse para ACK.

**ACK:** pendiente. **Commit sugerido:** `test(e2e): cubrí los recorridos críticos con servicios reales`.

## [Pendiente] Fase 3 — Integración E2E, release y gobernanza

- Incorporar E2E en `verify` después del build, con datos y namespace Redis exclusivos.
- Exigir una aprobación ajena al autor, conservar descarte de revisiones obsoletas y verificar configuración remota.
- Parametrizar smoke existentes y probar las imágenes finales maintenance/API antes de publicar esas mismas imágenes; API con almacenamiento descartable y operación autenticada exitosa.
- Mantener tags, aprobación, digest/SBOM/escaneos/attestations, controles API/worker/candidata y recuperación compatible.
- Verificar negativos de gates y CI del SHA final; no habilitar proveedores ni confundir fixtures con aceptación remota.

**ACK:** pendiente. **Commit sugerido:** `ci(release): verificá los artefactos antes de publicar`.

## Criterios de aceptación y evidencia

- Un test fallido/omitido/enfocado, suite vacía o reporte ausente/inconsistente impide aprobar CI.
- E2E conserva efectos tras recargar y rechaza accesos indebidos sin modificar datos ajenos.
- Una imagen defectuosa impide publicar; un smoke fallido impide promover; tag sin CI válido del mismo SHA queda rechazado.
- Reportes identifican ejecución/SHA, entorno, resultados, simulaciones y duración; no acreditan certificación ISO ni cumplimiento auditado.
- Recursos, aceptación Vercel/Railway/Supabase y activación real quedan fuera de esta implementación.

### Evidencia de fase 1

Implementación local en `codex/testing-cicd-e2e`, posterior al registro `bbb43c8`; verificación del 2026-10-11/12 con Node 24.21.0 y npm 11.19.0. No se creó un commit de implementación ni se publicó/ejecutó CI del nuevo SHA. La fase permanece `[Actual]`, pendiente de esa validación remota y revisión humana; fases 2/3 sin iniciar.

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

**Pendientes de evidencia:** CI del commit de implementación con PostgreSQL 18, warehouse separado y Redis 7; revisión y ACK humano. Ninguna aprobación remota anterior se atribuye a estos cambios.

**Hallazgo operativo fuera de alcance:** `.husky/pre-commit` está versionado con modo `100644`; Git omitió el hook al registrar el plan. `npm ci` ejecutó el instalador Husky existente, sin cambiar archivos versionados de hooks. Reparar el permiso requiere el ACK específico de `AGENTS.md`; no se modificó ni se confía en el hook como sustituto de CI.
