# Plan HITL: cierre de arquitectura y configuración

**Fecha de inicio:** 2026-09-28  
**Estado global:** Fase 1 implementada localmente; esperando ACK antes de la fase 2

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

**Review humano (ACK):** Pendiente para avanzar a fase 2.  
**Commit sugerido:** `chore(config): migrá a npm 11 y validá los artefactos y entornos`.

### `[Pendiente]` Fase 2: PostgreSQL y contenedores

- Agregar PostgreSQL 18 descartable en CI, migraciones solo sobre esa base y cinco pruebas de integración obligatorias.
- Construir y arrancar ambas imágenes en CI, verificar salud, usuario no privilegiado y apagado ordenado.
- Alinear Compose con PostgreSQL 18 preservando volúmenes previos mediante respaldo y restauración.

### `[Pendiente]` Fase 3: seguridad de dependencias

- Aprobar scripts de instalación por paquete y versión; resolver `strict-peer-deps`.
- Remediar vulnerabilidades altas y críticas, verificar firmas y auditar secretos y cambios de dependencias en CI.
- Documentar excepciones de gravedad menor y `overrides` con condición de retiro.

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
