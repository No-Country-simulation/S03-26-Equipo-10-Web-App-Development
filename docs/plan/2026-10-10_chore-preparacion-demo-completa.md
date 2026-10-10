# Preparación de la demo completa

**Inicio:** 2026-10-10. **Estado:** en progreso. Plan autorizado en el chat; una fase por ACK.

## Contexto y Restricciones

- Conservar NestJS, autenticación propia, Prisma, aislamiento por tenant, outbox PostgreSQL y Cloudinary.
- Topología acordada: web/proxy en Vercel; API/pollers, worker BI y Redis en Railway; OLTP y warehouse en proyectos Supabase independientes. Dominios gratuitos.
- Referencias: `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, `docs/operations/23_bi_validation_and_release.md` y skill `cicd-pipeline-engineering`.
- Ejecutar una sola fase; mostrar evidencia y commit sugerido, detenerse y esperar ACK. No contratar recursos, desplegar ni ejecutar migraciones persistentes con esta autorización.
- `AGENTS.md` exige ACK específico para el manifiesto raíz, infraestructura, schema Prisma, hooks y ejecución de `prisma migrate deploy`/`db push`. No registrar secretos ni datos reales.
- No modificar checksums de migraciones existentes ni debilitar filtros tenant o gates de seguridad para conseguir un resultado verde.
- ACK específico recibido en el chat: cambios acotados de dependencias/overrides/allowlist del manifiesto raíz y `prisma migrate deploy` sólo sobre los PostgreSQL descartables de fase 1. No alcanza bases persistentes ni las fases siguientes.

## [Actual] Fase 1 — CI confiable

- [x] Corregir la expectativa de recurso ajeno: NotFound, conservando Conflict para concurrencia.
- [x] Revisar dependencias afectadas y aplicar correcciones compatibles verificadas; documentar vulnerabilidades sin solución.
- [x] Configurar dos PostgreSQL descartables, Redis, DDL sintético y clientes de backup PostgreSQL 18 en CI.
- [x] Fallar ante configuración incompleta y pruebas omitidas en CI.
- [x] Fijar acciones por SHA; timeouts y cancelación de CI obsoleto, sin CD.
- [x] Validar instalación, tipos, lint, pruebas completas, builds y controles disponibles; registrar límites reales.
- [ ] Resolver el gate de auditoría alta/crítica y obtener un run remoto aprobado del commit final.

**Bloqueo actual:** `braces@3.0.3` no tiene parche publicado; auditoría con 7 altas/0 críticas y 20 moderadas. Se conserva el gate rojo. Hace falta acordar remediación de Tailwind 3 y la cadena de lint de Next 15 o esperar un parche verificado. No avanzar de fase ni declarar demo lista.

**Evidencia:** [runbook de fase 1](../operations/24_demo_ci_preparation.md): 471 pruebas API y 115 web aprobadas, cero omitidas; builds/smoke aprobados y escaneos de ambas imágenes sin altas/críticas. La auditoría npm completa todavía bloquea el cierre de esta fase. Revisión humana pendiente. Commit sugerido: `ci(pipeline): reforzá las validaciones de la demo y corregí dependencias`.

## [Pendiente] Fase 2 — Integración web/API

Proxy bajo Vercel y API relativa, preservando cookies, Origin y CSRF; sin caché privada ni exposición de métricas internas. Validar headers y confianza del proxy con navegador real.

## [Pendiente] Fase 3 — Preparación de servicios y entrega

Configuración reproducible Railway/Vercel, roles/secretos separados, conexiones TLS/IPv6, pools acotados y Data API deshabilitada en Supabase. Sin contratación o aprovisionamiento implícitos.

## [Pendiente] Fase 4 — Despliegue controlado y aceptación

Workflow manual de SHA validado de main; identidad de artefacto, serialización, migraciones separadas y autorizadas, protección de rama, smoke tests y recuperación remota. Cada servicio externo requiere entorno y presupuesto confirmados.

## Aceptación final

Login/refresh/logout/CSRF, dos tenants y roles, captura/moderación/publicación, imágenes/logo/YouTube, webhooks y recuperación, BI durable y aislamiento OLAP, caída Redis, métricas protegidas y restauración/reversión compatibles. No declarar demo completa sin evidencia del destino real.
