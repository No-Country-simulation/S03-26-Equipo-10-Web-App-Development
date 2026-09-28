# Plan HITL: arquitectura y configuración reproducible

**Fecha de inicio:** 2026-09-28  
**Estado global:** En progreso  
**Rama:** `main` (sin crear rama en esta fase)

## 1. Contexto y restricciones

- Fuentes de verdad: `AGENTS.md`, `llm.txt`, `docs/technical/01_architecture.md` y `docs/domain/business_rules.md`.
- Skills: `monorepo-architecture-engineering`, `layered-architecture-engineering` y `secure-project-configuration-engineering`.
- Contrato acordado: Node 24.21.0, npm 10.9.9 y React 18. Mantener dos workspaces npm sin Nx, Turborepo ni paquetes compartidos nuevos.
- No modificar `apps/api/prisma/schema.prisma`, ejecutar migraciones ni cambiar endpoints REST.
- El pedido de implementar este plan autoriza los cambios de `package.json` raíz y Dockerfiles previstos en la fase 1. Cada fase requiere revisión y ACK antes de activar la siguiente.

## 2. Fases

### `[Actual]` Fase 1: runtime y verificaciones reproducibles

- [x] Fijar Node y npm en metadatos del repositorio, configuración de npm, CI y builds Docker.
- [x] Declarar herramientas usadas por lint y hooks, agregar scripts de typecheck y adoptar ESLint Flat Config en web.
- [x] Instalar con `npm ci`, ejecutar typecheck, lint, tests y builds; construir imágenes si Docker está disponible.
- [x] Sincronizar documentación de instalación y runtime para esta fase.

**Verificación local:** `npm ci` con npm 10.9.9, Prisma Client, typecheck, tests y builds de ambas apps completados. ESLint terminó sin errores, con 30 advertencias heredadas. El build web requirió red para `next/font/google`. No hay Docker ni Podman en este entorno, por lo que la construcción y el arranque de imágenes quedan sin verificar aquí. `npm audit` informó 37 vulnerabilidades en el árbol actual (6 bajas, 10 moderadas, 18 altas y 3 críticas); se requiere un trabajo separado de remediación de dependencias.

**Criterio:** lockfile sin cambios tras `npm ci`, verificaciones reproducibles y resultados o limitaciones documentados.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `chore(config): fijá el runtime y agregá verificaciones reproducibles`.

### `[Pendiente]` Fase 2: integridad de datos y aislamiento

- [ ] Escribir testimonio y evento de outbox en una transacción; crear envíos públicos en `pending`.
- [ ] Filtrar mutaciones por tenant y condicionar transiciones al estado esperado; auditar otras escrituras solicitadas por usuarios.
- [ ] Probar rollback, aislamiento entre tenants y carreras de transición con PostgreSQL real, además de reglas unitarias.

**Criterio:** no hay testimonio o publicación sin su evento, ni escritura cruzada entre tenants.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `fix(testimonials): asegurá el outbox y el aislamiento por tenant`.

### `[Pendiente]` Fase 3: fronteras de módulos y frontend

- [ ] Reemplazar imports privados entre módulos por interfaces públicas acotadas y hacer cumplir las fronteras con ESLint.
- [ ] Retirar archivos preparatorios no usados y migrar la ruta activa de testimonios a `features/testimonials/`.
- [ ] Mantener sesión y endpoints actuales, corregir documentación a React 18 y verificar flujos visibles.

**Criterio:** lint rechaza imports prohibidos y la ruta de testimonios conserva sus flujos.  
**Review humano (ACK):** Pendiente.  
**Commit sugerido:** `refactor(architecture): ordená las fronteras y la feature de testimonios`.

## 3. Cierre

Ejecutar solo la fase `[Actual]` por turno. Al terminar, presentar pruebas y commit sugerido; detenerse hasta recibir ACK. No añadir `CODEOWNERS` sin responsables de GitHub identificados.
