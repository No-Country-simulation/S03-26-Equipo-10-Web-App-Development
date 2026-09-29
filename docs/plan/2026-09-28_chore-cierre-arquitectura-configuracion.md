# Plan HITL: cierre de arquitectura y configuración

**Fecha de inicio:** 2026-09-28  
**Estado global:** Fase 3 implementada localmente; verificación real de CI y ACK pendientes antes de fase 4

## Contexto y restricciones

- Continuación del plan `2026-09-28_chore-arquitectura-configuracion.md`; su fase 3 cuenta con ACK y sus cinco pruebas PostgreSQL siguen pendientes.
- Aplicar las skills de monorepo, arquitectura por capas y configuración segura a los criterios pertinentes para dos aplicaciones npm workspaces. Mantener suite completa de CI y documentar la no adopción de `affected`, caché remota, Changesets y orquestador.
- Mantener Node 24.21.0 y React 18; migrar npm 10 a npm 11.19.0 por decisión explícita del usuario. No cambiar endpoints REST ni esquema Prisma.
- El pedido de implementar este plan autoriza cambios del `package.json` raíz y Dockerfiles en fase 1. Cada fase posterior requiere revisión y ACK propios. No ejecutar migraciones sobre bases persistentes ni de producción.
- No hay Docker o Podman local. El equipo de GitHub propuesto para `CODEOWNERS` todavía no existe.

## Fases

### `[Completada localmente]` Fase 1: runtime, configuración y artefactos

- Sincronizar npm 11.19.0 en metadatos, CI y contenedores; regenerar el lockfile con npm y fijar versiones directas exactas.
- Generar `apps/api/dist/main.js` desde el build, validar las variables requeridas de API al arrancar y la URL pública de web en build, y excluir archivos de entorno reales.
- Verificar instalación inmutable, typecheck, lint, tests y build por app. Confirmar la ruta del artefacto de API; documentar la limitación local de Docker.
- Al terminar, presentar resultados y commit sugerido, y detenerse para ACK.

**Verificación:** `npm ci --offline` completó con npm 11.19.0 fuera del sandbox (el sandbox bloqueó `esbuild` con `EPERM`). La regeneración del lockfile se hizo con npm; API generó `dist/main.js`. Typecheck, lint, tests y build completaron por app: API 69 tests pasan y las 5 pruebas PostgreSQL continúan omitidas; web 12 tests pasan. Lint terminó sin errores, con 2 advertencias previas en API y 20 en web. La validación de entorno rechaza configuraciones inválidas en los tests de API y la configuración web falla de inmediato si falta `NEXT_PUBLIC_API_URL`. El build web requirió ejecución fuera del sandbox para descargar recursos. Docker/Podman no están disponibles localmente, por lo que construcción y arranque de imágenes quedan para fase 2 en CI. El resultado de `npm audit` en modo offline no valida el estado actual de avisos de seguridad; la auditoría real corresponde a fase 3.

**Review humano (ACK):** Recibido el 2026-09-28 mediante «Continua con la fase 2».
**Commit sugerido:** `chore(config): migrá a npm 11 y validá los artefactos y entornos`.

### `[Completada localmente]` Fase 2: PostgreSQL y contenedores

- Agregar PostgreSQL 18 descartable en CI, migraciones solo sobre esa base y cinco pruebas de integración obligatorias.
- Construir y arrancar ambas imágenes en CI, verificar salud, usuario no privilegiado y apagado ordenado.
- Alinear Compose con PostgreSQL 18 preservando volúmenes previos mediante respaldo y restauración.

**Implementación:** CI usa un servicio PostgreSQL 18 descartable, aplica las migraciones solo allí y ejecuta la suite de API con `TEST_DATABASE_URL` obligatorio. CI construye ambas imágenes y ejecuta `scripts/ci-smoke-containers.sh` para comprobar usuario no privilegiado, endpoints de salud y apagado con `SIGTERM`. Compose usa un volumen PostgreSQL 18 nuevo; `docs/operations/04_postgresql_18_compose_upgrade.md` documenta el respaldo, la restauración y la comparación de datos sin borrar el volumen anterior.

**Verificación:** YAML válido, `bash -n` y `git diff --check` sin errores. Typecheck y build de API pasan; lint pasa con dos advertencias anteriores. Los tests locales de API pasan (69) y las cinco pruebas PostgreSQL quedan omitidas por falta de una base descartable local. Al simular CI sin `TEST_DATABASE_URL`, la suite falla como exige el guard. No hay Docker ni Podman local, así que el arranque de imágenes y la ejecución real de las cinco pruebas quedan pendientes del job de CI. Tampoco se ejecutó una restauración de datos: requiere el host y el volumen anterior del operador.

**Review humano (ACK):** Recibido el 2026-09-28 mediante «Continua con la fase 3ç».
**Commit sugerido:** `ci(containers): verificá PostgreSQL 18 y el arranque de ambas imágenes`.

### `[Completada localmente]` Fase 3: seguridad de dependencias

- Aprobar scripts de instalación por paquete y versión; resolver `strict-peer-deps`.
- Remediar vulnerabilidades altas y críticas, verificar firmas y auditar secretos y cambios de dependencias en CI.
- Documentar excepciones de gravedad menor y `overrides` con condición de retiro.

**Implementación:** npm 11 exige `strict-peer-deps` y `strict-allow-scripts`; `allowScripts` aprueba por versión seis paquetes necesarios y deniega la telemetría de `@scarf/scarf`. Se actualizaron dependencias directas vulnerables dentro de NestJS 11 y Next.js 15, se renovó el árbol transitorio y se fijó PostCSS corregido para conservar React 18. CI comprueba lockfile, auditoría alta/crítica y firmas; en PR revisa nuevas dependencias y en commits escanea secretos, con acciones nuevas fijadas por SHA y permisos de lectura. Motivos, condiciones de retiro y hallazgos restantes están en `docs/operations/05_dependency_security.md`.

**Verificación:** `npm ci --offline` completó con npm 11.19.0 y dejó idéntico el SHA-256 del lockfile (`17075484edd0727fb1178f989baa4a7b63c8353da29713965075f1e3f0cfa715`). `npm install-scripts ls` quedó vacío. Typecheck, lint, 69 tests API y 12 web, build API y build web pasan; las cinco pruebas PostgreSQL siguen omitidas localmente. El build web requirió salir del sandbox y definir `NEXT_PUBLIC_API_URL`. Lint conserva dos advertencias previas en API y veinte en web. `npm audit --audit-level=high` y `npm audit signatures` pasan; auditoría completa: 0 críticas, 0 altas, 2 moderadas de Vitest y 0 bajas. YAML y `git diff --check` válidos. Los jobs nuevos de Dependency Review y TruffleHog, las pruebas PostgreSQL y las imágenes aún requieren una ejecución real de GitHub Actions; no se ejecutó Docker localmente.

**Review humano (ACK):** Pendiente para avanzar a fase 4.
**Commit sugerido:** `chore(security): corregí dependencias y exigí controles de cadena de suministro`.

### `[Pendiente]` Fase 4: capas de API

- Desacoplar errores de negocio e infraestructura de HTTP, mapearlos en la frontera, preservar contratos públicos y aislar Prisma.
- Extraer casos de uso para operaciones con reglas reales, reforzar el contexto autenticado de tenant, aplicar correlación con `AsyncLocalStorage` y proteger límites con lint.

### `[Pendiente]` Fase 5: capas de web

- Llevar la lógica de rutas activas a features y adaptar/validar los contratos HTTP por feature sin cambiar sesión, URLs ni flujos visibles.

### `[Pendiente]` Fase 6: ownership y cierre

- El administrador de GitHub crea `@No-Country-simulation/testimonial-cms-maintainers`, asigna miembros y acceso de escritura; entonces se agrega `CODEOWNERS`.
- Sincronizar documentación y registrar evidencias y excepciones justificadas de las tres skills.

## Criterios finales

- `npm ci` inmutable; typecheck, lint, tests, builds, auditoría y firmas pasan en CI.
- Las cinco pruebas PostgreSQL se ejecutan y pasan; ambas imágenes arrancan y responden a sus sondas de salud.
- Lint rechaza límites prohibidos, contratos HTTP y flujos web se conservan, y el equipo propietario existe y aprueba código.
- No declarar cierre integral mientras falte alguno de estos resultados. Una fase se ejecuta por turno, con ACK antes de la siguiente.
