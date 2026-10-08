# Plan HITL: foto de empresa y BI con PostgreSQL separado

**Fecha:** 2026-10-08

**Estado global:** En progreso; fase 1 documental finalizada, esperando ACK. Fases 2–4 pendientes.

**Autorización inicial:** El usuario solicitó implementar el plan acordado, conservando el ACK entre sus cuatro fases. No se creó rama ni commit.

## Contexto y Restricciones

- Leer `AGENTS.md`, `llm.txt`, la arquitectura técnica, las reglas de negocio y el diccionario de datos. El código y las migraciones versionadas establecen el estado implementado; un archivo SQL no prueba que esté aplicado.
- Ejecutar solamente la fase `[Actual]`. Al terminar, registrar evidencia y commit sugerido, detenerse y esperar ACK antes de activar la siguiente fase.
- Las modificaciones de `apps/api/prisma/schema.prisma`, infraestructura, `package.json` raíz y la aplicación de migraciones conservan sus requisitos de ACK explícito. No ejecutar `prisma migrate deploy` ni `db push` como parte de estas fases.
- Preservar los cambios ajenos existentes en `package.json`, `package-lock.json`, `skills-lock.json`, las skills Supabase y `supabase/`. No persistir secretos ni datos personales en documentación, ejemplos o logs.
- Baseline real: NestJS 11, Prisma 6.5, PostgreSQL 18, Next.js 15, React 18, Tailwind 3. No adoptar los ejemplos históricos React 19/BullMQ de otras referencias.
- Mantener el monolito modular y la autorización en NestJS. El proceso ETL es una entrada independiente del workspace API; no importar el módulo raíz que arranca HTTP, outbox y scoring.
- Decisiones del usuario: instancias PostgreSQL con recursos separados en producción; carga cada hora; BI para admin/editor de cada empresa; historial observado por cortes horarios; métricas y tendencias; sin volumen real conocido.
- Skills de fase 1: `relational-database-sql-engineering`, `postgresql-database-engineering`, `supabase-postgres-best-practices`. En las fases de código, leer además las skills API, frontend, TypeScript y observabilidad que correspondan.

## Diagnóstico comprobado

| Hallazgo | Fuente | Consecuencia |
| --- | --- | --- |
| `Tenant` no tiene imagen | `apps/api/prisma/schema.prisma` y repositorio de tenants | Se necesitan columnas opcionales y contratos explícitos. |
| `form-info` devuelve nombre y habilitación | `TestimonialsService.getPublicFormInfo` | La captura `/p/[slug]` todavía no puede mostrar el logo. |
| La imagen del testimonio es diferente del logo de empresa | `Testimonial.imageUrl` | No reutilizar esa columna para branding. |
| Cloudinary devuelve placeholder sin configuración | `CloudinaryService.uploadImage` | En producción debe responder error antes de persistir una imagen ficticia. |
| La validación actual comprueba Base64, no firma de archivo | `validate-image-base64.ts` | El logo exige política PNG/JPEG/WebP propia de 2 MiB. |
| Middleware general acepta 1 MiB; rutas de imagen actuales aceptan 14 MiB | `body-limits.middleware.ts` | Incorporar límite de 3 MiB exclusivamente para PUT de logo. |
| La analítica agrupa la tabla operacional | `AnalyticsRepository.getDashboard` | No hay warehouse ni snapshot histórico. |
| `source` admite texto libre | `TrackAnalyticsEventDto` | Normalizar a un catálogo técnico acotado antes de salir del origen. |
| Engagement y scoring globales operan por IDs | `getEngagementCounts`, `findAllPublishedForScoring`, `updateScores` | En fase 3 separar por empresa y pasar `tenantId` por toda la cadena. |
| No hay historial completo de cada transición | `TransitionTestimonialUseCase` | No prometer tiempos exactos de moderación ni reconstrucción de estados anteriores al ETL. |
| Borrado físico en código y referencias a soft delete en documentación | `TestimonialRepository.remove`, reglas BR-WF-001 | BI refleja el código; no introducir una migración de borrado lógico en este plan. Las FK pueden impedir el borrado si existen dependencias. |
| Existen CHECK de rating/contenido y FK compuestas multi-tenant en migraciones | Migraciones de esquema unificado e integridad tenant | Mantener estas garantías; no se verificó la base de un servidor. |

## Fases

### `[Actual]` Fase 1: diagnóstico, ADR, diccionario y borradores SQL

- [x] Documentar separación OLTP/OLAP y consecuencias operativas.
- [x] Definir logo, limpieza durable de medios, contratos BI y semántica de métricas.
- [x] Definir granularidad, claves, datos admitidos, staging y publicación por empresa.
- [x] Preparar borradores SQL independientes para OLTP y warehouse; sin ejecutarlos.
- [x] Enlazar referencias y comprobar coherencia estática y `git diff --check`.

**Criterio de salida:** documentos concretos y SQL revisable; la funcionalidad continúa marcada como propuesta.

**Evidencia (2026-10-08):** siete archivos nuevos y cuatro referencias de documentación/contexto actualizadas. Revisión estática por Python: 24 enlaces locales correctos; 15 tablas warehouse inventariadas y referencias FK a tablas declaradas; nombres de constraints sin duplicados/truncamiento; ausencia de columnas prohibidas, provisioning/credenciales y caracteres invisibles; delimitadores SQL y transacciones revisados. `git diff --check` y comprobación equivalente de archivos nuevos pasan. Los cambios ajenos de paquetes/Supabase se preservaron. No se editaron aplicaciones, schema Prisma ni infraestructura. No se ejecutaron SQL, migraciones, tests de aplicaciones o integración: la comprobación léxica no certifica sintaxis/semántica PostgreSQL ni estado de un despliegue.

**Artefactos para revisión:**

- [ADR de separación](../adr/0004-warehouse-postgresql-separado.md).
- [Diccionario dimensional](../domain/warehouse_diccionario_de_datos.md).
- [Contrato de logo](../modules/api-tenant-logo.md).
- [Contrato BI y algoritmo ETL](../modules/api-business-intelligence.md).
- [Borrador OLTP](./2026-10-08_feat-foto-empresa-bi_oltp-borrador.sql): URL/ID de logo, revisión privada para concurrencia y limpieza durable.
- [Borrador warehouse](./2026-10-08_feat-foto-empresa-bi_warehouse-borrador.sql): dimensiones, hechos, staging, control de cargas y ledger de migraciones.

**Límites pendientes:** confirmar ejecución del DDL en entornos descartables durante la fase 3; verificar proveedor/limpieza de medios en fase 2; volumen, latencias, backups, permisos reales y aislamiento físico productivo en fase 4. No ejecutar la fase 2 hasta recibir ACK de esta entrega y autorización explícita para modificar `apps/api/prisma/schema.prisma` (campos del logo/revisión y modelo de jobs), sin aplicar la migración.

**Review humano (ACK):** pendiente.

**Commit sugerido:** `docs(bi): definí el logo de empresa y el warehouse separado`.

### `[Pendiente]` Fase 2: foto de empresa y formulario público

- Implementar columnas/modelos del borrador OLTP, servicios, PUT/DELETE del logo y cola durable de limpieza; solicitar ACK explícito para `schema.prisma` antes de editarlo.
- Validar formato real, Base64 canónico y máximo 2 MiB; incorporar JSON máximo 3 MiB sólo para PUT del logo.
- Añadir logo a `/tenants/me` y `form-info`, sin exponer identificador del proveedor ni jobs.
- Incorporar carga/reemplazo/eliminación en Configuración y logo con respaldo en `/p/[slug]`, respetando la identidad editorial vigente.
- Probar validación, RBAC/CSRF, concurrencia, fallos de proveedor, compensación durable y aislamiento por empresa; completar typecheck, lint y tests pertinentes.

**Criterio de salida:** recorridos de carga, reemplazo, eliminación y captura pública verificados; migración nueva preparada, no aplicada.

**Review humano (ACK):** pendiente.

**Commit sugerido:** `feat(tenants): agregá el logo de empresa al formulario público`.

### `[Pendiente]` Fase 3: warehouse, ETL y aislamiento de scoring

- Crear migraciones warehouse independientes y entrada CLI ETL mínima dentro de `apps/api`; conexiones independientes de origen y destino.
- Implementar extracción por empresa, staging, reconciliación completa, leases con fencing y publicación atómica; conservar resultados ante fallos y no inventar horas perdidas.
- Corregir scoring por empresa: listado, engagement y escrituras con `tenantId`; sin cambiar la fórmula.
- Probar con dos PostgreSQL descartables ya provisionados/migrados por el procedimiento autorizado; nunca usar bases persistentes como destino de tests.
- Verificar conciliación, cambios/borrados, empresa vacía, reintento, crash, lease vencido, corte UTC, BigInt y snapshot consistente.

**Criterio de salida:** migraciones y proceso verificables; integración real sólo se declara si se ejecutó.

**Review humano (ACK):** pendiente.

**Commit sugerido:** `feat(bi): incorporá el warehouse y la carga horaria por empresa`.

### `[Pendiente]` Fase 4: panel, observabilidad y validación operativa

- Incorporar endpoint BI y pantalla `/admin/business-intelligence` con metadatos y estados vacío, atrasado, error e indisponible.
- Verificar rango de fechas, snapshot diario, categorías, CTR, roles y aislamiento tenant en queries/joins.
- Añadir métricas ETL y alertas propuestas; aislar caída OLAP del startup y readiness transaccional.
- Ejecutar prueba de carga con referencia OLTP sin ETL y con ETL; registrar volumen, recursos, latencias y duración.
- Preparar runbook de despliegue, permisos, backup y recuperación; infraestructura y SQL persistente se aplican sólo con ACK explícito.
- Actualizar `AGENTS.md`, `llm.txt` y arquitectura cuando los componentes estén implementados, distinguiendo estado local y despliegue verificado.

**Criterio de salida:** BI funcional y evidencia operativa reproducible; sin certificación de capacidad o producción por inferencia.

**Review humano (ACK):** pendiente.

**Commit sugerido:** `feat(bi): incorporá el panel y la observabilidad de las cargas`.

## Aceptación global

- Logo persistido y visible, sin filtración de IDs privados ni reemplazo por un placeholder en producción.
- Warehouse con claves multi-tenant y cargas idempotentes/publicación atómica, incluso con cero filas.
- Datos BI consistentes con el último origen publicado; cortes históricos desde la activación, sin inventar transiciones.
- CTR basado en eventos, nunca anunciado como usuarios únicos o conversiones de ventas.
- Ninguna conexión warehouse en el navegador; no copiar autores, textos, IP/hash de IP ni credenciales.
- Tests y comprobaciones se registran con sus límites; ACK individual de las cuatro fases.
