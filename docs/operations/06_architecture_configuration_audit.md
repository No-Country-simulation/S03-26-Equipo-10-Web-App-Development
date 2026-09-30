# Auditoría de arquitectura y configuración

**Corte:** 2026-09-29. **Alcance:** skills `monorepo-architecture-engineering`, `layered-architecture-engineering` y `secure-project-configuration-engineering`, aplicadas al repositorio de dos npm workspaces. El resultado es **cumplimiento parcial verificable**; no se declara cierre integral.

## Evidencia por skill

| Skill | Prácticas implementadas | Pendiente de aceptación |
| --- | --- | --- |
| Monorepo | `apps/api` y `apps/web` comparten un lockfile; CI usa `npm ci`, valida el lockfile y ejecuta ambas suites; ESLint protege imports entre apps y módulos. | No hay `.github/CODEOWNERS` ni equipo propietario activado. El job `verify` del último run público falló en `Test`. |
| Arquitectura por capas | La API separa controladores, servicios/casos de uso y repositorios; los errores internos se traducen en `ApiExceptionFilter`; el tenant autenticado y la correlación se propagan con `AsyncLocalStorage`; las escrituras críticas de testimonios comparten transacción con outbox. Web compone rutas en `app/` y valida respuestas en adaptadores de `features/`. | Las cinco pruebas con PostgreSQL no se pudieron certificar como aprobadas: el último job llegó a `Test` y falló. Falta una prueba E2E de navegador contra API real. |
| Configuración segura | Node 24.21.0 y npm 11.19.0 están fijados; `.npmrc` exige engines, peers y aprobación de scripts; Zod valida entorno; CI audita dependencias y firmas; Dockerfiles usan etapas de build y usuario sin privilegios. | La construcción y el arranque de imágenes quedaron sin ejecutar en el último run de CI porque `Test` falló. No hay Docker/Podman local para suplir esa evidencia. |

## Resultados observados

- El [run público de CI #8](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/36652248245) para el commit `2fddacd` terminó en `failure`. `npm ci`, control de lockfile, auditoría alta/crítica, firmas, generación Prisma, migraciones sobre el PostgreSQL descartable, typecheck y lint pasaron. `Test` falló; build y smoke tests de imágenes quedaron omitidos. Los runs #5, #6 y #7 también fallaron en `Test`, desde la introducción de la base de CI. Los logs detallados requieren sesión de GitHub; el usuario ofreció compartir el log de `Test`.
- En la última verificación local de la fase 5 pasaron 88 tests de API y 19 de web; cinco pruebas PostgreSQL se omitieron localmente por falta de base descartable. Esto no demuestra que pasen en CI.
- `npm audit --audit-level=high` consultó el registry el 2026-09-29 y pasó: 0 altas y 0 críticas. Reportó 4 moderadas, documentadas en [seguridad de dependencias](05_dependency_security.md). `npm audit signatures` verificó 1313 firmas de registry y 142 attestations.
- El lockfile y los Dockerfiles están versionados, pero todavía no hay evidencia de arranque de las imágenes ni de apagado por `SIGTERM` en un run exitoso. Tampoco se verificó una restauración real del volumen PostgreSQL anterior.

## Excepciones por escala

El monorepo tiene dos aplicaciones y ningún paquete compartido publicado. La suite completa en CI es corta y evita omisiones por cálculo de proyectos afectados. Por ahora no se incorporan Nx/Turborepo, `affected`, caché remota ni Changesets. Si crece el número de apps o el tiempo de CI, se revisarán el grafo de tareas, los inputs de caché y los permisos de escritura de caché para PR externos. Los artefactos desplegables se identifican por commit o digest de imagen, sin versionado de librerías internas.

La caché actual de la API es local al proceso. El outbox se procesa mediante polling PostgreSQL dentro de NestJS; Redis aparece en Compose pero BullMQ no está instalado. Una topología de varias réplicas requiere revisar caché compartida, adquisición concurrente de eventos y verificación de despliegue antes de afirmarla como soportada.

## Ownership pendiente por decisión del usuario

El usuario indicó dejar ownership pendiente por ahora. La sesión local de `gh` tiene un token inválido y no se conocen los miembros activos del equipo. No se agrega un `CODEOWNERS` con un equipo sin acceso verificado. Para activarlo, un administrador de `No-Country-simulation` debe:

1. Crear o confirmar `@No-Country-simulation/testimonial-cms-maintainers`, asignar miembros activos y darle acceso de escritura al repositorio.
2. Agregar `.github/CODEOWNERS` con cobertura para `apps/api/`, `apps/web/`, `infra/`, `docker-compose.yml`, `.github/`, `docs/`, `AGENTS.md`, `llm.txt`, `package.json` y `package-lock.json`, dirigido al equipo verificado.
3. Configurar la regla de rama para exigir aprobación de code owners y los checks de CI, y abrir un PR de prueba para comprobar asignación y bloqueo de merge.

## Brechas adicionales encontradas al reconciliar la documentación

- La documentación anterior atribuía a la implementación BullMQ, Redis distribuido y un hash HMAC con pepper para API keys. El código actual usa polling PostgreSQL, caché local y SHA-256 de una clave aleatoria de 24 bytes (`tms_...`). Las guías activas se corrigieron para reflejarlo. El endurecimiento de API keys con HMAC y pepper sigue siendo una tarea de seguridad separada; no se declara implementado.
- La web conserva por decisión del plan la sesión Bearer almacenada en `localStorage`, aunque la API también establece cookies HTTP Only. Una eventual migración a sesión solo por cookie requiere diseño y pruebas propios; esta auditoría no la declara realizada.
- La documentación de setup citaba Node 20/npm 10, PostgreSQL 16 y `apps/frontend`, además de scripts y Dockerfiles inexistentes. La guía actual usa los contratos versionados y los comandos reales.

## Condiciones para declarar cierre integral

1. Diagnosticar y corregir el paso `Test` del run #8; observar un nuevo run con las cinco pruebas PostgreSQL aprobadas y builds y smoke tests de ambas imágenes completados.
2. Verificar en GitHub el equipo propietario y la revisión obligatoria de `CODEOWNERS` mediante un PR de prueba, cuando el usuario retome ownership.
3. Registrar el resultado real de restauración del volumen anterior si existían datos que migrar. Si nunca existió ese volumen, dejar constancia de que no aplicaba.
