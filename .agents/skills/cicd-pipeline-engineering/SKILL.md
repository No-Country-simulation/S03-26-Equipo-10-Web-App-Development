---
name: cicd-pipeline-engineering
description: "Diseño, implementación y revisión de pipelines CI/CD del Testimonial CMS (SKL-DEVOPS-CICD-001). Usar para GitHub Actions, validaciones de PR, artefactos, promoción, recuperación y preparación de despliegues con Vercel, Supabase, Cloudinary y YouTube, respetando los procesos persistentes NestJS y las fases HITL."
---

# CI/CD para Testimonial CMS

**Código:** SKL-DEVOPS-CICD-001 · **Versión:** 1.0.0  
**Dominio:** DevOps / DevSecOps / Software Delivery Engineering  
**Fuente:** especificación técnica del usuario v1.0.0, adaptada el 2026-10-09.  
**Referencias de diseño:** ISO/IEC/IEEE 29148, ISO/IEC 27001, NIST SSDF, SLSA, DORA y Agile Definition of Done. Su mención no acredita certificación ni cumplimiento auditado.

Convertir cambios en versiones verificables, trazables y recuperables con complejidad proporcional al proyecto. Separar validación, build, autorización, migración y despliegue; esta skill no amplía el alcance autorizado.

## Contexto y límites

Leer [AGENTS.md](../../../AGENTS.md), [llm.txt](../../../llm.txt) y Contexto y Restricciones del plan activo. Ejecutar sólo la fase `[Actual]`, registrar resultados reales, proponer commit y detenerse para ACK.

- Monorepo npm workspaces: NestJS 11/Prisma 6.5 y Next.js 15/React 18. Usar versiones de `.node-version`, manifests y lockfile, actualmente Node 24.21.0/npm 11.19.0; dependencias mediante `npm ci`.
- PostgreSQL 18 local; aislamiento por consultas `tenant_id`, sin RLS implementada. Conservar JWT, refresh tokens, RBAC, cookies HttpOnly y CSRF propios.
- Outbox por polling PostgreSQL en la API; Redis para cuotas/caché, no entrega durable. Limpieza de logos por polling; ETL horario independiente y warehouse en instancia PostgreSQL separada.
- Vercel para web, Supabase para PostgreSQL y Cloudinary para imágenes son destinos previstos. Proveedores de API/procesos persistentes y Redis pendientes de un futuro plan. Un build local no verifica integración remota.
- Cambiar `schema.prisma`, ejecutar `prisma migrate deploy`/`db push`, alterar infraestructura, package.json raíz o hooks exige el ACK específico de AGENTS.md. Las migraciones descartables del CI existente no autorizan ejecutarlas desde una sesión del agente.
- No persistir secretos, tokens, contraseñas ni PII en contexto, ejemplos, reportes o logs. Usar nombres de variables y evidencia redactada.

## Lectura según la tarea

- Para gates y cobertura, leer [requisitos y aceptación](references/requisitos-y-aceptacion.md): RF/RNF y resiliencia.
- Para auditoría, optimización o recuperación, leer [antipatrones y evaluación](references/antipatrones-y-evaluacion.md).
- Para demo remota, leer [despliegue demo](references/despliegue-demo.md): proveedores, conexiones, seguridad web y smoke tests.
- Usar [github-engineering](../github-engineering/SKILL.md) para gobernanza, [vercel-cli](../vercel-cli/SKILL.md) para operaciones Vercel y [supabase](../supabase/SKILL.md) para operaciones Supabase. Persistencia, Docker y observabilidad aplican cuando se afecta su área; no cargar todas por defecto.

## Procedimiento

1. Inspeccionar [CI](../../../.github/workflows/ci.yml), scripts, Dockerfiles y configuración afectada. Identificar eventos, confianza del código, dependencias, permisos y gates. YAML local no demuestra protecciones remotas: verificarlas cuando la tarea lo requiera y haya acceso.
2. Informar estado y brechas. El CI actual valida tipos, lint, tests, build, firmas de dependencias, auditoría y secretos; construye imágenes, genera SBOM, escanea y ejecuta smoke tests con PostgreSQL/Redis descartables. Algunas acciones usan tags: no afirmar pinning completo, publicación, SAST dedicado, promoción o despliegue remoto verificados.
3. Definir eventos, gates, `needs`, timeouts, cachés por lockfile, retención y concurrencia. Paralelizar tareas independientes; cancelar CI obsoleto sin interrumpir migraciones/recuperación. No exigir ocho workflows ni cuatro entornos para una demo.
4. Aislar PR externos de secretos/permisos de publicación. No ejecutar código no confiable mediante eventos privilegiados. Revisar acciones por SHA y permisos por job; OIDC sólo con soporte y confianza verificados. Secretos inevitables requieren almacenamiento externo, alcance mínimo y rotación.
5. Registrar commit, run, configuración pública, identidad de artefacto y deployment. Promover el mismo digest cuando sea reutilizable; `NEXT_PUBLIC_API_URL` y CSP de build pueden requerir builds distintos por entorno, cada uno trazable y validado.
6. Antes de CD, resolver topología completa, autorización, esquema compatible, backup/restauración, reversión de aplicación y salud. Canary, flags, IaC, GitOps, firmas y attestations se eligen según necesidad; no instalar herramientas por catálogo.
7. Implementar sólo la fase autorizada y validar el comportamiento del cambio. Para documentación revisar escenarios sin operar servicios externos. `continue-on-error` requiere un gate posterior que preserve el fallo según política explícita.
8. Entregar diff, evidencia y límites, junto con commit en español rioplatense con voseo. Un despliegue exitoso requiere smoke tests del destino real; una revisión textual no los sustituye.

## Entrega esperada

La revisión permite determinar qué commit se valida, qué gates bloquean, quién puede promover, qué artefacto/configuración se despliega y cómo recuperar el servicio. Registrar pendientes como pendientes y preservar contratos existentes hasta que una tarea autorice modificarlos.
