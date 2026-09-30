# Contribuir a Testimonial CMS

Testimonial CMS es un proyecto educativo con dos npm workspaces: `apps/api` (NestJS 11, Prisma 6.5) y `apps/web` (Next.js 15, React 18). Usa Node 24.21.0, npm 11.19.0 y PostgreSQL 18. Consultá la [guía de configuración](04_setup.md) para preparar el entorno.

## Proponer cambios

1. Abrí un issue con el comportamiento observado, el esperado y los pasos para reproducirlo, o describí la mejora y su alcance.
2. Trabajá sobre una rama corta y mantené el cambio enfocado.
3. Actualizá el código y la documentación afectada. Agregá tests de comportamiento cuando cubran un riesgo real.
4. Ejecutá las verificaciones pertinentes y abrí un pull request con el motivo, el cambio y la evidencia de pruebas.

Los cambios de esquema Prisma, migraciones en bases existentes, infraestructura, `package.json` raíz y hooks siguen las restricciones de [AGENTS.md](../../AGENTS.md) para agentes de IA. La guía de actualización de datos desde PostgreSQL 16 está en [operaciones](../operations/04_postgresql_18_compose_upgrade.md).

## Contratos del repositorio

- Ejecutá `npm ci` desde la raíz para instalar según el único `package-lock.json`. No edites el lockfile a mano ni lo borres para resolver conflictos.
- Conservá los imports entre módulos de API a través de sus interfaces públicas. En web, `app/` compone rutas y `features/` contiene pantallas, lógica y adaptadores HTTP.
- Para recursos del tenant, filtrá lecturas y escrituras por `tenantId`. Las transiciones de testimonios y el evento de outbox deben conservar su transacción.
- Conservá el contrato de respuestas Problem Details y los flujos de sesión, salvo que el cambio aprobado los modifique explícitamente.
- No agregues credenciales ni archivos `.env` reales al repositorio. Los ejemplos están en la raíz y en cada app.

## Verificación

```bash
npm run typecheck
npm run lint
npm test
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1 npm run build
```

Los cinco casos de integración PostgreSQL requieren `TEST_DATABASE_URL` y una base descartable con migraciones aplicadas. El job de CI prepara esa base, además de auditar dependencias, verificar firmas y construir y arrancar las imágenes. Comprobá el resultado del workflow antes de afirmar que esas pruebas pasaron.

## Commits y pull requests

Usá Conventional Commits con `type` y `scope` en inglés y descripción en español rioplatense con voseo formal. Ejemplo: `fix(testimonials): corregí la transición concurrente`. La referencia completa está en [flujo de Git](02_git_workflow.md).

El pull request debe explicar qué cambió, por qué y cómo se verificó. Si cambia una dependencia, revisá scripts de instalación y el motivo de cada `override` en [seguridad de dependencias](../operations/05_dependency_security.md).

La asignación de responsables mediante `CODEOWNERS` y la exigencia de su revisión siguen pendientes de que un administrador cree el equipo `@No-Country-simulation/testimonial-cms-maintainers` con miembros activos y acceso de escritura. Hasta entonces, pedí revisión manual a los responsables del proyecto.
