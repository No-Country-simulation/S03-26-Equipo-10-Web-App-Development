# Flujo de Git y entrega

El proyecto trabaja con `main` protegida, ramas cortas y pull requests. El [CI](../../.github/workflows/ci.yml) valida PR y push a main; la entrega preparada tiene otro disparador y aprobación. No se requiere una rama `develop` ni ramas permanentes de release. El plan HITL limita qué fase puede ejecutar un agente: [AGENTS.md](../../AGENTS.md).

## Convenciones de Nomenclatura

Usá nombres descriptivos como `feat/moderacion`, `fix/refresh-reuse` o `test/tenant-isolation`. Codex usa el prefijo `codex/`; esta mejora vive en `codex/testing-cicd-e2e`. Creá una rama desde main actualizada cuando iniciás un cambio; para continuar uno existente, conservá su rama y archivos locales. Inspeccioná `git status` antes de cambiar de rama.

Los commits siguen Conventional Commits:

```text
<type>(<scope>): <descripción en español rioplatense con voseo formal>

[cuerpo opcional]
[Closes #<issue>]
```

`type`/`scope` van en inglés. Tipos: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`. Descripción, cuerpo y footer van en español rioplatense; evitá infinitivo, tuteo y ustedeo.

```text
fix(auth): corregí la revocación de la familia de sesión
test(testimonials): cubrí el rollback ante fallos del outbox
ci(testing): rechazá reportes incompletos de ambas aplicaciones
```

## Estrategia de Branching

1. Delimitá contrato, riesgo, escenarios y alcance del cambio. Si hay plan HITL, ejecutá sólo su fase `[Actual]` con ACK vigente.
2. Trabajá en una rama corta con cambios revisables. No descartes archivos ajenos ni reescribas ramas compartidas para limpiar el diff.
3. Para lógica nueva/regresiones, observá Red funcional, implementá Green y refactorizá preservando contratos. Documentación/configuración trivial admite verificación proporcional.
4. Abrí PR a main con evidencia, obtené revisión y verificá los checks del SHA final.
5. Después del merge, revisá CI del SHA integrado. La aprobación previa del head del PR no reemplaza ese run.

La [matriz de testing](../technical/testing_contracts.md) relaciona contratos, niveles, servicios y etapas. No duplicar todas las combinaciones unitarias en navegador ni agregar tests sólo para subir cobertura.

## Proceso de Commits

Antes de crear un commit, revisá los archivos y el diff; agregá paths explícitos. No incluyas secretos, archivos `.env` reales, reportes con datos reales ni cambios de otra tarea.

```bash
git status --short
git diff --check
git diff
# Agregá únicamente los paths revisados con git add.
git diff --cached
```

Para agentes: registrar/commitear un plan nuevo precede a implementar, según el [índice de planes](../plan/README.md). Al completar la fase, presentar evidencia y commit sugerido, y detenerse para ACK; no agrupar fases.

## Pull Requests

Usá la [plantilla](../../.github/pull_request_template.md). Explicá problema y comportamiento final, contratos/riesgos, pruebas con dependencias reales/simuladas, comandos, resultados y omisiones. Declarar un test implementado no acredita ejecución ni Red-first histórico.

Verificación local desde raíz, según el alcance:

```bash
npm ci
npm run db:generate --workspace @testimonial-cms/api
npm run typecheck
npm run lint
npm test
node --test scripts/testing/*.test.mjs
node --test scripts/test-next-eslint-glob.mjs
node --test --test-isolation=none scripts/release/*.test.mjs
NEXT_PUBLIC_API_URL=/api/v1 API_BACKEND_ORIGIN=http://127.0.0.1:4100 npm run build
```

Estos comandos no preparan servicios ni autorizan migraciones. Sin PostgreSQL/warehouse/Redis descartables, la API puede omitir integraciones: informá el resultado parcial. Para cobertura y reportes completos, seguí la [guía](../technical/05_testing.md). CI conserva la selección completa, bloquea omisiones/todo y publica JSON/cobertura; un run verde de otro SHA no acredita el cambio actual.

Main exige `verify`, `secret-scan` y `dependency-review`, actualizada contra main, conversaciones resueltas y sin force-push/borrado. Desde el 2026-10-12 exige una aprobación ajena al autor y descarta aprobaciones obsoletas ante nuevos commits; configuración aplicada y consultada en GitHub en la fase 3. `CODEOWNERS` espera equipo de maintainers existente con acceso; no atribuirle enforcement activo.

Definition of Done: contrato satisfecho, escenarios/efectos pertinentes protegidos, tipos/lint y checks completos aprobados para el SHA final, revisión, documentación actualizada y límites/pendientes explícitos. E2E con servicios propios forma parte de `verify`; release exige smoke de las imágenes finales antes de publicar. La aceptación corresponde al CI del SHA final, no a la cobertura unit/UI.

## Merge Strategies

Conservá un historial revisable y commits coherentes. Squash es útil cuando varios commits representan un único cambio; usá un título Conventional Commit al integrarlo. Verificá la estrategia permitida por GitHub y no uses bypass de protecciones. El merge no autoriza activar entrega.

## Resolución de Conflictos

Revisá ambos contratos y resolvé preservando las assertions legítimas. No aceptes automáticamente una versión entera para conseguir CI verde. Para `package-lock.json`, resolvé los manifests y regenerá con npm; no lo edites a mano ni lo borres. Repetí los checks afectados después de resolver. Rebase y force-push sólo en ramas propias cuando corresponda; no reescribir main ni una rama compartida.

## Tags y Versionado

Los tags `v*` de entrega son anotados, creables sólo por administradores e inmutables según los rulesets auditados. Deben apuntar a un SHA de main con CI aprobado. El workflow `demo-release.yml` prepara publicación por digest/SBOM/escaneos/attestations, aprobación protegida y smoke antes de promover.

La entrega está apagada; no se crean tags ni recursos al fusionar PR. Activarla requiere sus ACK, environments, secretos externos, preflight y aceptación de proveedores según el [runbook](../operations/27_demo_tag_delivery.md). Antes de publicar, prueba maintenance offline y la API final con login/escritura/relectura sobre servicios descartables. El publicador contrasta SHA, tags e IDs con la evidencia del smoke; no confundir esa validación con aceptación remota.

Migraciones y recuperación usan workflows manuales separados con destino/SHA explícitos. No hay migración automática en PR/main; el CI sí prepara su propia base descartable. Recuperación exige compatibilidad de datos y versión conocida; no ejecutar DDL inverso automático.

## Git Hooks

El hook versionado `.husky/pre-commit` invoca `lint-staged` (ESLint/Prettier sobre archivos staged); no sustituye tipos, suite completa ni CI. En el checkout auditado el archivo carece de permiso ejecutable y Git informó que lo omitió al registrar el plan. Su reparación requiere el ACK específico para hooks de [AGENTS.md](../../AGENTS.md); esta fase no lo modifica ni presenta ese hook como ejecutado.

No instalar commitlint, hooks adicionales ni validación completa local por documentación. Los checks obligatorios residen en CI y se evalúan en cada PR/main.
