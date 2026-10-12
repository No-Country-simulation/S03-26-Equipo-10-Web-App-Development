# Contribuir a Testimonial CMS

Testimonial CMS es un proyecto educativo con dos npm workspaces: `apps/api` (NestJS 11, Prisma 6.5) y `apps/web` (Next.js 15, React 18). Usa Node 24.21.0, npm 11.19.0 y PostgreSQL 18. Consultá la [guía de configuración](04_setup.md) para preparar el entorno.

## Proponer cambios

1. Abrí un issue con el comportamiento observado, el esperado y los pasos para reproducirlo, o describí la mejora y su alcance.
2. Trabajá sobre una rama corta y mantené el cambio enfocado.
3. Identificá contrato/riesgo y escenarios. Para lógica nueva o una regresión reproducible, ejecutá un Red funcional antes de corregir y registrá Green; para legado, distinguí caracterización de requisito.
4. Actualizá código y documentación, ejecutá las verificaciones pertinentes y abrí un pull request con la [plantilla del repositorio](../../.github/pull_request_template.md): motivo, pruebas, dependencias simuladas, resultados y pendientes.

Los cambios de esquema Prisma, migraciones en bases existentes, infraestructura, `package.json` raíz y hooks siguen las restricciones de [AGENTS.md](../../AGENTS.md) para agentes de IA. La guía de actualización de datos desde PostgreSQL 16 está en [operaciones](../operations/04_postgresql_18_compose_upgrade.md).

## Contratos del repositorio

- Ejecutá `npm ci` desde la raíz para instalar según el único `package-lock.json`. No edites el lockfile a mano ni lo borres para resolver conflictos.
- Conservá los imports entre módulos de API a través de sus interfaces públicas. En web, `app/` compone rutas y `features/` contiene pantallas, lógica y adaptadores HTTP.
- Para recursos del tenant, filtrá lecturas y escrituras por `tenantId`. Las transiciones de testimonios y el evento de outbox deben conservar su transacción.
- Conservá el contrato de respuestas Problem Details y los flujos de sesión, salvo que el cambio aprobado los modifique explícitamente.
- No agregues credenciales ni archivos `.env` reales al repositorio. Los ejemplos están en la raíz y en cada app.

## Verificación

```bash
npm run db:generate --workspace @testimonial-cms/api
npm run typecheck
npm run lint
npm test
node --test scripts/testing/*.test.mjs
NEXT_PUBLIC_API_URL=/api/v1 API_BACKEND_ORIGIN=http://127.0.0.1:4100 npm run build
```

Estos comandos no preparan bases ni autorizan migraciones. Las integraciones requieren PostgreSQL descartable, warehouse en otro servidor, Redis, DDL sintético y herramientas de backup. Consultá variables y comandos de cobertura/JSON en la [guía de testing](../technical/05_testing.md) y límites reales en la [matriz de contratos](../technical/testing_contracts.md). Sin servicios, Jest puede omitir casos: informá cantidades/motivos y tratá el resultado como parcial.

CI prepara sus servicios descartables, ejecuta cobertura y genera JSON de API/web; rechaza fallos, omisiones/todo, foco y reportes incompletos. Conserva tipos/lint/build/smokes y controles de dependencias, firmas, secretos e imágenes. No reduzcas la selección de CI para aprobar; comprobá el run del SHA evaluado. La cobertura se publica como evidencia, sin porcentaje global obligatorio. El runner E2E permanente sigue pendiente de la fase 2 del [plan](../plan/2026-10-11_test-integridad-ci-e2e.md).

## Commits y pull requests

Usá Conventional Commits con `type` y `scope` en inglés y descripción en español rioplatense con voseo formal. Ejemplo: `fix(testimonials): corregí la transición concurrente`. La referencia completa está en [flujo de Git](02_git_workflow.md).

El pull request debe explicar qué cambió, por qué y cómo se verificó. Si cambia una dependencia, revisá scripts de instalación y el motivo de cada `override` en [seguridad de dependencias](../operations/05_dependency_security.md).

Para aceptar un cambio, revisá contrato, efectos/negativos pertinentes, tests proporcionales al riesgo, ausencia de regresiones, documentación y CI completo del SHA final. Declarar tests escritos no acredita ejecución ni un historial TDD. Usá sólo fixtures sintéticas y evidencia sin credenciales ni datos reales.

Main exige PR, checks y conversaciones resueltas. El mantenedor confirmó el 2026-10-12 que trabaja solo y autorizó cero aprobaciones obligatorias; revisá el diff y la evidencia antes de integrar. Una revisión externa es opcional mientras haya un único mantenedor.

La asignación de responsables mediante `CODEOWNERS` y la exigencia de su revisión requieren un equipo real con miembros activos y acceso de escritura. Reevaluá esa configuración cuando se incorporen colaboradores; no exijas una aprobación de un equipo inexistente.

El merge de un PR integra código; no autoriza desplegar. La entrega preparada conserva tags anotados y aprobación, está apagada y tiene migración/recuperación manuales separadas. Ver [runbook de entrega](../operations/27_demo_tag_delivery.md).
