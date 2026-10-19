# Plan HITL: analítica estadística del BI

**Fecha:** 2026-10-19. **Rama:** `codex/bi-analitica-estadistica`, base `b0d8cb2`.
**Estado:** fase 1 aprobada; fase 2 terminada, revisión y ACK pendientes. Fases 3–5 pendientes, sin autorización de ejecución.
**ACK fase 2:** «Continuar», después del cierre de fase 1; autoriza datos y validación descartable, no despliegue ni comandos Prisma protegidos.
**ACK de inicio:** «Empieza, recuerda siempre, realiza una fase y terminala detente propon un commit y espera el ack».

## Contexto y Restricciones

- Ejecutar sólo la fase `[Actual]`, entregar evidencia y commit sugerido, detenerse y esperar ACK antes de avanzar, según [AGENTS.md](../../AGENTS.md). No marcar la siguiente fase como actual anticipadamente.
- El checkout inicial está limpio. La fase 1 registra contratos y SQL propuesto: no modifica runtime, activa banderas, aplica DDL ni ejecuta backfills.
- Skills aplicables: inteligencia de negocio y buenas prácticas PostgreSQL; las fases de implementación incorporarán contratos API, TypeScript, testing y frontend según su alcance.
- Preservar migraciones OLTP/DW existentes y sus checksums; `schema.prisma`, infraestructura, package.json raíz, hooks, secretos y despliegue quedan fuera. Migraciones persistentes y comandos Prisma protegidos requieren ACK específico.
- BI actual: worker independiente, reconciliación completa de vistas `bi_export`, snapshots con instante UTC y cabecera incluso vacía, control 0004, publicación atómica con leases/fencing, dashboard sólo `dw` y configuración técnica en `etl`.
- La aceptación previa es local. No hay datos, capacidad ni despliegue productivos verificados que permitan acreditar utilidad predictiva.

## Decisiones confirmadas con el usuario

1. Pronosticar **creaciones observadas**, no inventario ni publicaciones; cada identidad se cuenta una sola vez en su mes UTC de creación. Las altas eliminadas entre cargas pueden faltar.
2. Horizonte: próximo mes calendario. Sin historial/evaluación suficiente se muestra sólo histórico, sin estimación preliminar.
3. Minería con categorías y etiquetas existentes; grupos por reglas estadísticas. Sin texto libre, sentimiento, embeddings o clustering aprendido.
4. Anomalías sobre proporción de rechazados observada, no sobre decisiones nuevas de moderación; valoraciones bajas = rating 1–2, incluyendo todos los estados.
5. Funciones puras TypeScript y SQL en el worker actual, sin nuevos servicios de ML, dependencias o procesos de entrenamiento.
6. Admin/editor consultan su empresa y descargan CSV. Sin nuevos controles de operación ni notificaciones externas.
7. Algoritmo `stats_v1`: promedio móvil 3, evaluación temporal a dos pasos, 12 meses cerrados/90 % de días observados, seis evaluaciones y mejora MAE >=10 % sobre último valor. Anomalías: mediana/MAD, ventana 28 días, >=21 cortes válidos y n>=30, incremento mínimo 5 puntos porcentuales.

## Entregables canónicos de fase 1

- [Contrato, catálogo de métricas y aceptación](../modules/api-bi-statistics.md), versión propuesta 1. Incluye temporalidad, límites, transporte y tratamiento de errores/ausencias.
- [SQL OLTP propuesto](2026-10-19_feat-bi-analitica-estadistica_oltp-borrador.sql): dos vistas de etiquetas, sin nuevas columnas/modelos operacionales.
- [SQL DW propuesto](2026-10-19_feat-bi-analitica-estadistica_warehouse-borrador.sql): staging, taxonomía, primeras observaciones, tareas e informes. Se promoverá a la siguiente migración libre, inicialmente `0005_bi_statistics.sql`, únicamente en fase 2.
- Enlaces de evolución propuesta en contratos backend/web y diccionario DW; el contexto mantiene explícita la ausencia de runtime nuevo.

## Acoplamiento y límites

```mermaid
flowchart LR
    O[OLTP: vistas bi_export] --> E[ETL independiente]
    E --> W[dw: corte completo y etiquetas observadas]
    W --> S[Etapa estadística del worker]
    S --> P[dw: publicación versionada]
    P --> A[GET bi/statistics]
    A --> U[Vista Analítica estadística y CSV]
```

La etapa estadística empieza después de cerrar origen y publicar ETL. No modifica el éxito de esa carga. Sus tareas usan presupuesto/reserva separados; el API no calcula ni escribe resultados. El scheduler prioriza ETL y procesa como máximo una tarea estadística por tick después de las cargas elegibles. Un fallo conserva la última publicación, identificada como anterior cuando corresponda.

`BI_STATISTICS_ENABLED=false` por defecto en API/worker; sin ella no se consultan objetos nuevos. Una activación requiere verificar previamente vistas, esquema, permisos y software compatibles. La ausencia de objetos estadísticos no cambia requisitos del CMS ni del resumen existente; la etapa opcional falla de forma aislada. No cambia frecuencia ETL 1/6/24h ni sus límites de cinco minutos, una conexión fuente y dos destino.

## Fases HITL

### `[Completada]` 1. Contratos y diseño — aprobada

- [x] Registrar decisiones, dependencias y restricciones, sin ampliar autorizaciones.
- [x] Fijar catálogo, fórmulas, cobertura, disponibilidad, tipos/endpoint y aceptación.
- [x] Preparar SQL separado de migraciones ejecutables, claves compuestas y matriz de permisos.
- [x] Validar estáticamente formatos, referencias locales, gramática admitida por el migrador y alcance del diff. Esta validación no acredita ejecución PostgreSQL.

### `[Actual]` 2. Datos — terminada; ACK pendiente

- [x] Promover borradores revisados a migraciones aditivas; mantener checksums anteriores. Verificar mantenimiento y precondición 0004 desde el migrador.
- [x] Incorporar tags/relaciones a tipos, extracción y staging dentro de la transacción fuente existente; conciliar conteos y relaciones sin fan-out.
- [x] Publicar marcador de cobertura de etiquetas incluso vacío y puente con el snapshot. Actualizar primeras observaciones en la misma publicación.
- [x] Preparar backfill explícito y reanudable de primeras observaciones desde cortes reales; nunca inferir etiquetas históricas. Detectar discrepancias de `created_at` por identidad, sin elegir silenciosamente una fecha.
- [x] Validar migraciones, backfill, permisos, replay, vacíos, borrados y atomicidad en PostgreSQL descartable; no usar comandos protegidos sin su autorización específica.

### `[Pendiente]` 3. Motor estadístico

- Implementar funciones puras con oráculos independientes antes del código de producción, incluyendo casos frontera del contrato.
- Construir entradas agregadas acotadas en lectura DW consistente; evaluación por origen sin fuga de información.
- Integrar cola recuperable, presupuesto 3, lease90s/heartbeat20s/deadline60s y publicación ACID independiente. Priorizar ETL; no reclamar tareas obsoletas.
- Probar pérdida de lease, reinicios, dos workers, respuesta ambigua tras commit, fallos y puntero monotónico.

### `[Pendiente]` 4. Consumo

- Incorporar bandera, GET privado con DTO estricto, cuota y validación de publicación; conservar permisos admin/editor por tenant.
- Agregar `view=statistics` en la navegación BI, adaptador Zod, tres secciones con tablas/gráficos y CSV desde la respuesta autorizada visible.
- Actualización al entrar/volver/solicitarla; no agregar polling continuo. Limpiar datos al cambiar sesión y descartar respuestas obsoletas.
- Probar filtros ajenos rechazados, roles, vigencia, calendario, accesibilidad y CSV equivalente/neutralizado.

### `[Pendiente]` 5. Validación integral

- Recorrido real con dos tenants, API/worker/OLTP/DW descartables, fallos y restauración de nuevos objetos/permisos.
- Medir costo de extracción de etiquetas, cálculo, consultas y CMS con/sin ampliación sobre recursos/dataset declarados. ETL <=5min; estadística <=60s; lectura SQL5s/tx10s. Registrar p95/p99, errores y crecimiento; no certificar capacidad productiva con fixtures.
- Preparar runbook de mantenimiento, promoción, flags y recuperación. Deshabilitar consumo/cálculo conserva datos; rollback de software no implica DROP.
- Clasificar evidencia como verificada, pendiente o no aplicable. Desempeño predictivo con historial real y SLO del destino siguen pendientes hasta tener evidencia; no habilitar por aprobar pruebas sintéticas.

## Evidencia y cierre de fase 1

Entregados los documentos y borradores enlazados. Sólo se ejecutan controles locales de formato, referencias y análisis estático del SQL; no se aplican migraciones, crean bases ni habilitan funciones. El detalle de los controles efectivamente ejecutados se registra al cerrar esta fase.

- **Verificado:** Prettier en plan/contrato nuevos y contrato web enlazado; `git diff --check`; 13 referencias locales/anclas introducidas; sintaxis TypeScript del bloque documental con el parser instalado.
- **Verificado:** tokenizador `migrationStatements` vigente acepta 5 sentencias del borrador OLTP y 23 del DW; 48 nombres de constraints/índices DW únicos y dentro del límite de63 bytes (ASCII). No se ejecutó el migrador ni se abrió conexión a base de datos.
- **Verificado:** 18 archivos existentes de migración sin diferencias contra HEAD; sin cambios en runtime API/web, Prisma, infraestructura, raíz npm, hooks, skills o AGENTS.
- **Conservado:** backend BI y diccionario DW ya tienen formato no conforme a Prettier en HEAD; las dos inserciones de enlaces no reformatean esos documentos. Ambos siguen con el mismo diagnóstico previo.
- **Pendiente:** sintaxis y constraints efectivos en PostgreSQL18, planes de consulta, permisos reales, backfill, cálculos, endpoint y UI. Un tokenizador no verifica estos comportamientos. Corresponden a fases posteriores, cada una con su ACK.

**Commit sugerido:** `docs(bi): definí la ampliación de analítica estadística`

**Detención de fase 1 cumplida:** ACK «Continuar» recibido antes de fase 2. No autoriza ejecutar fases 2–5 en conjunto.

## Evidencia y cierre de fase 2

- **Implementado:** nueva migración OLTP `20261019000000_bi_statistics_export` con dos vistas y DW `0005_bi_statistics.sql` con diez tablas. La 0005 exige 0004 y mantenimiento sin runs/reservas. Los 18 archivos previos de migración permanecen intactos, al igual que sus entradas/checksums verificados en pruebas.
- **Implementado:** extracción paginada de etiquetas y relaciones dentro del snapshot RR del origen; conteos BigInt independientes. Publicación y conciliación atómicas de taxonomía, puente, creaciones y marcador de historial dentro del fencing ETL. Un cambio de fecha de creación o conteo incorrecto revierte el corte completo.
- **Implementado:** `StatisticsHistoryRepository` y CLI manual `--check` / `--apply --maintenance`, con identidad migradora, tandas de hasta1000, mantenimiento, validación temporal previa/final, interrupción/replay y marcador sólo al completar. Incluye empresas vacías y conserva identidades eliminadas observadas; no inventa etiquetas históricas.
- **Compatibilidad:** preflight opt-in de datos verifica esquema/SELECT/DML/historial al iniciar el worker. Defaultfalse no consulta objetos nuevos; fallo opcional mantiene el worker base y emite código seguro. La bandera del worker se preparó en fase2 porque controla la extracción nueva; la habilitación HTTP/UI sigue reservada a fase4. Sin cálculos, tareas activas, endpoint ni frontend nuevos.
- **Verificado:** dos PostgreSQL18.6 locales independientes, bases y roles aleatorios restringidos. **22 pruebas nuevas** (18 integración/4 unitarias) aprobadas, sin omisiones: migración/replay/drift/mantenimiento, aislamiento y permisos efectivos, fuente RR con mutación concurrente, vacíos/ausencias, borrados, fechas inconsistentes, backfill interrumpido y retomado, totales falsos, rollback tras perder fence y recuperación con escritor anterior.
- **Regresión:** corrida amplia **183/183 casos en14 suites**; después de ajustes de permisos/validación, **58/58 casos afectados en4 suites**; tras el último caso de compatibilidad, **22/22 nuevos en2 suites**. No son cantidades sumables. Red funcional del extractor observado antes de implementarlo: el caso nuevo falló por ausencia de entrega de tags; Green posterior. No se afirma ejecutar toda la suite del CMS ni E2E de fase5.
- **Verificado:** typecheck, build y lint API; lint conserva tres advertencias ajenas al cambio en idempotency/public-testimonials/setup. `git diff --check` y formato documental sin problemas. Sin cambios en Prisma schema, infraestructura, raíz npm, hooks, skills, AGENTS o web.
- **Operación:** [guía de datos/backfill](../operations/28_bi_statistics_data.md), contratos y diccionario actualizados. La prueba de compatibilidad acredita eliminación de enlaces temporales por cascada al recuperar con modo anterior; pueden quedar labels de staging que requieren saneamiento de mantenimiento, explicado en la guía.
- **Limpieza verificada:** cero bases/roles de las pruebas remanentes en ambos servidores antes de apagarlos; PostgreSQL temporales detenidos y directorio propio eliminado. No se ejecutaron `prisma migrate deploy`/`db push`, migraciones persistentes, despliegue ni commit automático.
- **Pendiente:** motor estadístico y tareas recuperables (fase3), API/UI/CSV (fase4), aceptación integral/restauración/capacidad y adaptadores remotos de permisos/habilitación (fase5). Utilidad predictiva con historial real no acreditada.

**Commit sugerido:** `feat(bi): incorporá etiquetas e historial observado al ETL`

**Detención obligatoria:** esperar ACK antes de activar/ejecutar fase3.
