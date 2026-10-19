---
name: business-intelligence-engineering
description: >-
  Diseño, ampliación y auditoría de BI del Testimonial CMS (SKL-BI-001): warehouse,
  ETL, modelos dimensionales, métricas de negocio, API y dashboards analíticos,
  minería de datos y evaluación predictiva. Usar para convertir datos en decisiones
  verificables o revisar su calidad y trazabilidad; no para tracking aislado de
  eventos ni telemetría técnica sin consumo de negocio.
---

# Inteligencia de negocios para Testimonial CMS

**Código:** SKL-BI-001 · **Versión:** 1.1.0

**Fuente:** especificación del usuario «Arquitectura de Inteligencia de Negocios y Minería de Datos Predictiva para Aplicaciones Web», v1.1.0; adaptada al CMS el 2026-10-19.

**Referencias documentales:** ISO/IEC 26514, IEEE 29148 y Agile DoD orientan documentación, requisitos y aceptación; no acreditan certificación ni conformidad normativa.

Conectar fuentes, transformaciones, métricas y visualizaciones con una decisión concreta. Separar datos observados, predicciones y escenarios condicionados a supuestos. Elegir la solución más simple que cumpla requisitos medibles.

## Contrato vigente y límites

Leer [AGENTS.md](../../../AGENTS.md), [llm.txt](../../../llm.txt) y las restricciones del plan activo, si existe. La skill no amplía permisos ni autoriza fases posteriores. Conservar los ACK para esquema Prisma, migraciones, infraestructura, configuración raíz y hooks definidos allí; no persistir secretos ni PII en contexto o evidencia.

- NestJS aloja el módulo `business-intelligence`; el worker tiene entrada independiente, sin AppModule, HTTP, outbox ni scoring. La extracción está acotada sobre OLTP; entrenamiento y analítica pesada quedan fuera de sus recursos transaccionales.
- Warehouse PostgreSQL separado según [ADR 0004](../../../docs/adr/0004-warehouse-postgresql-separado.md). Dos esquemas, bases o contenedores sobre recursos compartidos no prueban aislamiento de CPU, memoria, almacenamiento o disponibilidad.
- Extracción consistente de vistas autorizadas `bi_export`, con consultas de recursos filtradas por tenant. Identidades SQL separadas para extracción, publicación, lectura HTTP, control HTTP y migración; sin fallback a la conexión OLTP. No exportar texto, autores, IP/hash, usuarios, credenciales ni URLs multimedia.
- Reconciliación completa por empresa, con programación durable de 1/6/24 horas UTC y solicitudes manuales. Publicación atómica protegida por leases/fencing y presupuesto de intentos. Un replay no duplica resultados; un fallo conserva la última publicación válida. No inventar snapshots de horas perdidas.
- `staging` prepara carga, `dw` contiene el modelo dimensional y `etl` guarda control/operación. **No son capas Bronce/Plata/Oro.** `DashboardRepository` consulta sólo `dw`; configuración, vigencia y métricas técnicas consultan `etl` por sus servicios correspondientes.
- Admin/editor consultan su empresa; sólo admin muta controles y consulta auditoría. Conservar JWT/RBAC/CSRF, respuestas privadas `no-store`, control de versiones e idempotencia vigentes. El fallo OLAP no debe afectar startup/readiness ni las operaciones del CMS.
- Cortes y calendarios actuales en UTC. Un corte vacío observado vale cero; un corte ausente o una cantidad desconocida no equivale a cero. Los inventarios de snapshots no se suman entre cortes.
- ETL, panel y operación cuentan con validación local documentada; despliegue persistente, capacidad e independencia productiva de recursos siguen pendientes. No hay minería predictiva implementada en este contrato ni evidencia que permita certificarla.

## Lectura según la tarea

- Para fuentes, métricas, calidad o evolución dimensional, leer [arquitectura y datos](references/arquitectura-y-datos.md).
- Para segmentación, anomalías o modelos predictivos, leer [minería y predicción](references/mineria-y-prediccion.md). No cargarla por una consulta descriptiva ordinaria.
- Para API, dashboards, seguridad, auditoría, recuperación o cierre de entrega, leer [operación y aceptación](references/operacion-y-aceptacion.md).

Los contratos mantenidos están en [BI backend](../../../docs/modules/api-business-intelligence.md), [operación BI](../../../docs/modules/api-bi-operations.md) e [interfaz web](../../../docs/modules/web-business-intelligence.md). Consultarlos antes de cambiar comportamiento; los ejemplos de artefactos del adjunto no obligan a crear árboles nuevos ni a duplicar estos documentos.

## Forma de trabajo y entrega

1. Definir usuario, decisión, pregunta, fuentes/responsables, histórico, volumen y crecimiento, actualidad, concurrencia y presupuesto. En una ampliación, relevar sólo lo que falta para resolverla; fijar criterios de aceptación antes de medir resultados.
2. Comparar con implementación y contratos. Distinguir requisito vigente, brecha comprobada y evolución opcional. Una entrega inicial conecta una fuente, una métrica y una decisión; una auditoría produce hallazgos y evidencia, sin ejecutar correcciones fuera de alcance.
3. Preservar semántica, tenant, temporalidad y trazabilidad de extremo a extremo. Si se propone CDC, medallón, lakehouse, dbt, ML u otro servicio, justificar necesidad, costos y operación; no instalar herramientas por catálogo.
4. Implementar sólo el cambio autorizado y probar sus invariantes con resultados esperados independientes. Una ejecución exitosa no demuestra por sí sola corrección, completitud o actualidad de los datos.
5. Entregar definiciones/contratos afectados, evidencia reproducible y límites. Clasificar la aceptación como **verificado**, **pendiente** o **no aplicable con justificación**. Datos sintéticos no son evidencia de capacidad productiva; una predicción sin validación suficiente no se promociona. Cuando haya fases HITL, cerrar sólo la actual, sugerir commit y esperar ACK.
