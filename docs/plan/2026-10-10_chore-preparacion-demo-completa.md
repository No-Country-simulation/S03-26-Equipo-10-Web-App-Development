# Preparación de la demo completa

**Inicio:** 2026-10-10. **Estado:** en progreso. Plan autorizado en el chat; una fase por ACK.

## Contexto y Restricciones

- Conservar NestJS, autenticación propia, Prisma, aislamiento por tenant, outbox PostgreSQL y Cloudinary.
- Topología acordada: web/proxy en Vercel; API/pollers, worker BI y Redis en Railway; OLTP y warehouse en proyectos Supabase independientes. Dominios gratuitos.
- Referencias: `docs/technical/01_architecture.md`, `docs/domain/business_rules.md`, `docs/operations/23_bi_validation_and_release.md` y skill `cicd-pipeline-engineering`.
- Ejecutar una sola fase; mostrar evidencia y commit sugerido, detenerse y esperar ACK. No contratar recursos, desplegar ni ejecutar migraciones persistentes con esta autorización.
- `AGENTS.md` exige ACK específico para el manifiesto raíz, infraestructura, schema Prisma, hooks y ejecución de `prisma migrate deploy`/`db push`. No registrar secretos ni datos reales.
- No modificar checksums de migraciones existentes ni debilitar filtros tenant o gates de seguridad para conseguir un resultado verde.
- ACK posterior: resolver primero las dependencias de fase 1 mediante su migración. Se autorizaron exactamente tres instrucciones COPY del adaptador local en Dockerfiles: API deps, API production-deps y web deps; no otros cambios de infraestructura.
- ACK específico recibido en el chat: cambios acotados de dependencias/overrides/allowlist del manifiesto raíz y `prisma migrate deploy` sólo sobre los PostgreSQL descartables de fase 1. No alcanza bases persistentes ni las fases siguientes.

## [Completada] Fase 1 — CI confiable

- [x] Corregir la expectativa de recurso ajeno: NotFound, conservando Conflict para concurrencia.
- [x] Revisar dependencias afectadas y aplicar correcciones compatibles verificadas; documentar vulnerabilidades sin solución.
- [x] Configurar dos PostgreSQL descartables, Redis, DDL sintético y clientes de backup PostgreSQL 18 en CI.
- [x] Fallar ante configuración incompleta y pruebas omitidas en CI.
- [x] Fijar acciones por SHA; timeouts y cancelación de CI obsoleto, sin CD.
- [x] Validar instalación, tipos, lint, pruebas completas, builds y controles disponibles; registrar límites reales.
- [x] Resolver localmente el gate de auditoría alta/crítica sin excepciones.
- [x] Obtener un run remoto aprobado de la implementación final: `3b98f64`, CI `38097512213`.
- [x] Revisión humana y ACK para iniciar fase 2: «Continuar» recibido en el chat.

**Estado actual:** el bloqueo por `braces` se resolvió localmente migrando Tailwind a 4.3.3 y reemplazando el globbing del lint de Next 15 por un adaptador acotado con tinyglobby. Auditoría completa: 0 altas/0 críticas/20 moderadas; producción: 0 vulnerabilidades; gate alta/crítica aprobado sin excepciones. La implementación quedó publicada en `main` como `3b98f64dcf0f81ede916263c74d5d43c9cd7571f`. Su [CI remoto 38097512213](https://github.com/No-Country-simulation/S03-26-Equipo-10-Web-App-Development/actions/runs/38097512213) terminó aprobado el 2026-10-10. La fase 1 está validada técnicamente y recibió ACK humano para iniciar fase 2. No declarar demo lista.

**Evidencia:** [runbook de fase 1](../operations/24_demo_ci_preparation.md), con resultados históricos del commit `4d0b612` separados de la continuación local. Instalación, firmas, tipos, lint, 471 pruebas API y 119 web aprobados; cero omisiones. El runbook conserva el primer fallo BI intermitente y su repetición final aprobada; los cinco escenarios BI aprobaron también en remoto; el seguimiento BI-RECOVERY-001 conserva la incidencia local sin atribuir una causa no confirmada. Builds Docker, smoke y escaneos de ambas imágenes aprobados, sin altas/críticas; identidades y SBOM registrados en el runbook. La fase 1 quedó cerrada con ACK; la fase 2 está autorizada. Commit de la implementación: `3b98f64 fix(deps): eliminá la cadena vulnerable de braces`. Commit sugerido de esta evidencia documental: `docs(ci): registrá la validación remota de la fase 1`.

## [Actual] Fase 2 — Integración web/API

ACK de inicio recibido: «Continuar». No amplía permisos sobre infraestructura, manifiesto raíz ni migraciones.

- [x] Admitir `/api/v1` en el cliente y separar el destino backend del entorno público.
- [x] Incorporar el proxy externo, conservar Origin, cookies, CSRF, métodos y bytes del cuerpo.
- [x] Bloquear rutas internas, filtrar headers de identidad y evitar caché privada.
- [x] Verificar configuración, transporte y sesión con navegador real; distinguir pruebas locales de aceptación remota.
- [x] Registrar evidencia, límites y commit sugerido; detenerse para ACK de fase 3.

**Estado:** implementación de fase 2 y validación local completas. [Runbook](../operations/25_demo_same_origin_proxy.md): 161 pruebas web, 37 API afectadas, tipos/lint/builds y smoke HTTP standalone aprobados; 16 verificaciones de sesión en navegador real. Conserva Strict/HttpOnly/Secure, Origin/CSRF y bytes de cuerpos de 14 MiB. Skill CI/CD y seguridad, rollout y contexto actualizados.

**Límites:** nuevo SHA/CI remoto y aceptación HTTPS Vercel/Railway pendientes. Trust proxy predetermina 0; atribución de IP real/cuotas y restricciones del ingress se deben resolver/verificar en fases 3/4 antes de aceptar demo multiusuario. La fixture usa almacenamiento/servicio auth en memoria, no certifica persistencia, contraseñas ni Redis. No hubo migraciones, despliegues ni cambios de infraestructura/manifiesto.

**Commit sugerido:** `feat(proxy): conectá la web y la API por el mismo origen`.

- [ ] Revisión/commit y CI del nuevo SHA; ACK humano antes de fase 3. No avanzar de fase.

## [Pendiente] Fase 3 — Preparación de servicios y entrega

Configuración reproducible Railway/Vercel, roles/secretos separados, conexiones TLS/IPv6, pools acotados y Data API deshabilitada en Supabase. Sin contratación o aprovisionamiento implícitos.

## [Pendiente] Fase 4 — Despliegue controlado y aceptación

Workflow manual de SHA validado de main; identidad de artefacto, serialización, migraciones separadas y autorizadas, protección de rama, smoke tests y recuperación remota. Cada servicio externo requiere entorno y presupuesto confirmados.

## Aceptación final

Login/refresh/logout/CSRF, dos tenants y roles, captura/moderación/publicación, imágenes/logo/YouTube, webhooks y recuperación, BI durable y aislamiento OLAP, caída Redis, métricas protegidas y restauración/reversión compatibles. No declarar demo completa sin evidencia del destino real.
