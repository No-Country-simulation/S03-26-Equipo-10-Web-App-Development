# Contrato propuesto: analítica estadística BI

**Versión:** 1 / algoritmo `stats_v1`. **Fecha:** 2026-10-19.
**Estado:** fases 1–3 implementadas: contratos, datos y motor `stats_v1` con tareas recuperables y publicación independiente. `BI_STATISTICS_ENABLED` controla extracción y cálculo del worker, apagada por defecto. Endpoint y UI pendientes de fase 4; sin aplicación persistente. [Operación de datos](../operations/28_bi_statistics_data.md) y [motor estadístico](../operations/29_bi_statistics_worker.md).
**Plan y SQL:** [plan HITL](../plan/2026-10-19_feat-bi-analitica-estadistica.md). Complementa el [BI vigente](api-business-intelligence.md); no modifica su semántica actual.

## 1. Propósito, responsabilidades y fuentes

Admin/editor consultan su empresa para anticipar moderación, reconocer temas de la taxonomía existente y revisar cambios de proporciones. Las señales son consultivas, sin moderación automática ni inferencias causales. El mantenedor del módulo es responsable del catálogo y sus versiones; los umbrales iniciales se fijan antes de evaluar y sólo cambian con otra versión del algoritmo.

| Fuente                                              | Uso autorizado                                                                        | Límite                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `dw.fact_tenant_snapshot` y detalles                | Inventario, estados, rating, calendario/cobertura y primera aparición de identidades. | Un corte no es un evento de alta ni de rechazo. No sumar inventarios.                                                            |
| `dw.dim_category`                                   | Tema definido por el equipo.                                                          | Nombre actual SCD1, no nombre histórico.                                                                                         |
| Nuevas vistas `bi_export.tags` / `testimonial_tags` | Taxonomía y asignaciones vigentes, en la misma extracción consistente.                | Sin contenido, autores, notas, usuarios, IP/hash o URLs. Los nombres son metadatos existentes; no se escriben en logs/evidencia. |
| Registro de primeras observaciones                  | Serie de creaciones observadas y reconstrucción de conocimiento por corte.            | No captura altas eliminadas antes de observarlas.                                                                                |

No compartir datasets entre empresas, enriquecer con PII ni ejecutar análisis sobre OLTP. Se mantienen UTC, valores desconocidos distintos de cero, SQL parametrizado, IDs/conteos grandes sin pérdida y credenciales separadas. No se incorpora RLS ni otro motor.

## 2. Catálogo semántico `stats_v1`

Todos los porcentajes de transporte son razones `[0,1]`; UI/CSV los expresan como porcentaje. No promediar porcentajes para obtener tasas de inventario. Las cantidades de filas viajan como cadenas decimales. Cálculos se hacen con enteros/decimales y sólo se convierten a Number tras verificar rango seguro; fallo de rango invalida el informe, no redondea silenciosamente.

| Identificador                    | Fórmula y grano                                                                                                         | Nulos, cobertura y decisión                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `observed_creations_monthly`     | COUNT de `(tenant_id,testimonial_id)` distintos, agrupados por mes UTC de `created_at`, conocidos al corte del informe. | Cero sólo dentro de un mes con observaciones; sin cortes del mes => `count:null`. Mes de inicio y mes actual son parciales. Cuenta todas las identidades observadas, incluidas las eliminadas después. Planificar moderación. |
| `monthly_cut_coverage`           | Días UTC con al menos una cabecera / días de calendario del mes. Varias cargas del día cuentan una vez.                 | Para mes actual, denominador = días transcurridos incluido el día del corte. Cobertura no garantiza completitud de altas.                                                                                                     |
| `category_frequency`             | Cantidad por categoría / total del último corte, todas las valoraciones/estados.                                        | Categoría fuente NULL = «Sin categoría» y se incluye en distribución. N=0 => lista vacía, razones NULL en agregados.                                                                                                          |
| `tag_frequency`                  | Testimonios distintos con etiqueta / total del mismo corte.                                                             | Sin marcador de extracción de etiquetas => desconocido, no cero. Razones sumadas pueden superar 1.                                                                                                                            |
| `taxonomy_coverage`              | Sin categoría y sin etiquetas, por separado, / total del corte.                                                         | «Sin etiquetas» sólo es conocido si existe marcador, incluso vacío. Explica límites de patrones.                                                                                                                              |
| `category_rating_segment`        | COUNT por categoría × rating bajo1–2/medio3/alto4–5; proporción sobre total del corte.                                  | Mostrar grupos con >=5; son grupos por reglas, no clusters aprendidos.                                                                                                                                                        |
| `tag_pair_association`           | Con N testimonios y conteos a,b,ab: soporte=ab/N; confianza A→B=ab/a, B→A=ab/b; lift=ab*N/(a*b).                        | Pares de etiquetas distintas sin repetición; no significancia ni causalidad.                                                                                                                                                  |
| `rejected_share`                 | COUNT estado `rejected` / N del corte.                                                                                  | N=0 => NULL. No tasa de decisiones nuevas ni de moderados.                                                                                                                                                                    |
| `low_rating_share`               | COUNT rating IN(1,2) / N del corte, todos los estados.                                                                  | N=0 => NULL. No análisis de sentimiento.                                                                                                                                                                                      |
| `monthly_forecast`               | Media aritmética de los últimos 3 meses cerrados elegibles, constante para h=2.                                         | Cantidad esperada decimal no negativa, no inventario; sólo se publica valor cuando supera evaluación.                                                                                                                         |
| `forecast_mae` / `forecast_bias` | Media de abs(predicho-real) / media de (predicho-real) en seis objetivos históricos.                                    | Unidad: testimonios/mes. Sesgo positivo indica sobreestimación. No usar MAPE con ceros.                                                                                                                                       |

### Calendario, histórico y primeras observaciones

El corte de conocimiento del informe es `sourceSnapshotAt`, nunca la hora de cálculo. Seleccionar sólo cabeceras con instante <= ese corte y detalles completos del mismo tenant/run. Elegir última cabecera del día por instante descendente y UUID ascendente como desempate, igual que el dashboard vigente.

Registro de creaciones: una fila por tenant/testimonio, con creación inmutable y primera cabecera/detalle que lo observó. El backfill agrupa todas las observaciones reales existentes, verifica igualdad de creación por identidad y toma la primera por instante/UUID. Un replay no cambia la primera observación; un borrado posterior no elimina la fila. La purga explícita conserva los procedimientos de autorización existentes.

La inicialización sólo queda habilitada cuando `dw.statistics_history_state` acredita reconciliación hasta el run fuente. El backfill actualiza ese marcador después de conciliar todas las identidades del tenant; el ETL compatible avanza creaciones/marcador junto con su publicación. Tras un intervalo con bandera apagada, reconciliar snapshots pendientes antes de avanzar el marcador o calcular; la mera existencia de las tablas no prueba un historial inicializado. Un tenant nuevo se inicializa con su primer corte real. Nunca calcular sobre una inicialización parcial.

Histórico de API: desde el primero de los 24 meses terminados en el mes del corte, o inicio de historia si es posterior. Exponer meses previos al inicio únicamente como ausentes si el calendario los incluye, nunca como ceros; conservar conteos anteriores internamente para trazabilidad. El inventario heredado en el primer corte no acredita cobertura de meses anteriores. `observedDays` usa cabeceras, incluso vacías; no distingue por cantidades.

### Pronóstico mensual y evaluación temporal

1. Anclar `targetMonth` al mes siguiente al mes del corte fuente. Durante octubre, con septiembre como último cerrado, el objetivo es noviembre: h=2. **Constante** significa media de los tres valores reales anteriores para ambos pasos, sin insertar una predicción en la ventana.
2. Exigir los 12 meses cerrados inmediatamente anteriores al mes del corte, completos dentro del período observado y cada uno con cobertura >=0,90. Excluir el mes que contiene el primer corte aunque empezara el día 1: no se presume observación previa al instante inicial.
3. Evaluar los últimos seis meses cerrados de ese bloque. Para objetivo M, usar como origen la primera cabecera real del mes M−1, disponible antes de M. Sus entradas son conteos por creación de M−4,M−3,M−2 con `first_observed_at <= origen`; baseline = conteo de M−2 conocido en el mismo origen. No usar valores retrospectivos corregidos como entradas.
4. Exigir origen para cada uno de los seis objetivos. Evaluar contra el conteo del mes objetivo conocido al corte fuente del informe. Congelar ese dataset en la publicación; observaciones tardías pueden cambiar la evaluación en publicaciones futuras, nunca reescribir la anterior.
5. Calcular seis errores para cada método. El criterio fijo es `baselineMAE > 0 AND candidateMAE <= 0.90 * baselineMAE`. Baseline perfecto, empate o incumplimiento => sin proyección. No ajustar ventana/umbral mirando esos resultados; no hay selección de hiperparámetros. No afirmar test final independiente ni rendimiento futuro garantizado.
6. Recalcular la media final con los últimos tres meses cerrados conocidos al corte del informe. Guardar valor sin redondear; UI puede mostrar aproximación entera, CSV conserva decimal. Publicar MAE/sesgo, seis orígenes/objetivos y sus resultados para reproducción.

Precedencia de indisponibilidad: `NOT_LOADED`, `INSUFFICIENT_HISTORY`, `INSUFFICIENT_COVERAGE`, `MISSING_EVALUATION_ORIGIN`, `BASELINE_PERFECT`, `NO_BASELINE_IMPROVEMENT`. Ante cualquiera, `value:null`; histórico y evaluación ya disponibles se conservan. No fabricar bandas con ±MAE ni llamar intervalo de confianza a ese error. Un `available` expresa que superó esta política, no calibración de una probabilidad.

Fundamento: [métodos simples y evaluación temporal](https://otexts.com/fpp3/toolbox.html). Los mínimos 12/90%/6/10% son decisiones iniciales del producto, no requisitos universales del método.

### Patrones y límites de cardinalidad

Usar exclusivamente el último corte completo del informe; etiquetas sólo si tiene marcador propio. Categorías y tags: ordenar por cantidad DESC e ID ASC, mostrar hasta50 filas por lista. Segmentar por categoría/rating, filtrar cantidad>=5, ordenar cantidad DESC/categoría ASC/banda ASC y limitar50. Cada lista informa `totalGroups` antes del límite y `truncated`; no perder silenciosamente el resto ni recalcular porcentajes con el subtotal mostrado.

Pares: elegir primero las50 etiquetas más frecuentes, con desempate UUID. Formar pares no ordenados por UUID ascendente; contar identidades distintas, sin sumar el puente a los hechos base. Exigir N>=30, ab>=5, soporte>=0,05 y lift>=1,2; ordenar ab DESC/lift DESC/IDs ASC y limitar20. Los conteos a,b se calculan sobre todos los testimonios del corte. Mostrar ambas confianzas. Sin pares elegibles es resultado vacío válido, diferente de muestra insuficiente.

Con N<30 hay frecuencias pero asociaciones no disponibles. Sin marcador, categorías/segmentos siguen disponibles; tags/pares/cobertura sin etiquetas son desconocidos (`TAGS_NOT_OBSERVED`), no listas vacías que aparenten extracción. `tagHistoryStartedAt` es la primera cabecera real de extracción de etiquetas, incluso con cero relaciones; nunca se backfillea con las asignaciones actuales.

### Anomalías de proporciones observadas

Devolver últimos90 días UTC terminados en la fecha del corte, incluyendo el día en curso como provisional. Leer además28 días previos para referencia, sin exponerlos como señales adicionales. Una fila por día y métrica: `rejected_share` y `low_rating_share`; últimas cabeceras diarias, sin arrastre de valores.

Para día D, seleccionar en [D−28,D−1] sólo cortes con N>=30. Si el corte de D tiene N>=30 y hay >=21 referencias, calcular mediana(p), MAD=mediana(abs(p−mediana)) y `threshold=mediana+max(0.05,3*1.4826*MAD)`. La mediana par es media de los dos centrales; `flagged = p > threshold` estrictamente. No redondear antes de comparar ni limitar artificialmente threshold a1. Con MAD=0 rige0,05; threshold>1 implica que no habrá señal.

Sin corte: estado `no_snapshot`; N<30: `insufficient_sample` (N=0 => ratioNULL); <21 referencias: `insufficient_baseline`; con cálculo: `normal` o `flagged`. No presentar los tres primeros como ausencia de anomalía comprobada. Identidad estable de señal = `metric:YYYY-MM-DD`, acotada siempre al tenant autenticado; una publicación posterior reemplaza la representación del día, sin emitir avisos externos ni duplicados.

Los inventarios se solapan; esta regla robusta es exploratoria, sin p-values, independencia ni causalidad supuestas. Mediana/MAD: [NIST, detección de atípicos](https://www.itl.nist.gov/div898/handbook/eda/section3/eda35h.htm).

## 3. Persistencia, operación y compatibilidad propuestas

| Objeto propuesto                            | Grano / responsabilidad                                                                                                        |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `staging.tags` / `staging.testimonial_tags` | Tenant/run/etiqueta y tenant/run/testimonio/etiqueta; datos temporales conciliados.                                            |
| `dw.dim_tag`                                | Tenant/UUID fuente, nombre actual/is_present. SCD1 como categorías.                                                            |
| `dw.fact_tag_snapshot`                      | Tenant/run: marcador de extracción, cantidades de etiquetas y relaciones. Incluye vacíos.                                      |
| `dw.bridge_testimonial_tag_snapshot`        | Tenant/run/testimonio/etiqueta, FK al detalle y al marcador del mismo corte.                                                   |
| `dw.fact_testimonial_creation`              | Identidad única, creación y primera observación verificable. No historial de altas completo.                                   |
| `dw.statistics_history_state`               | Tenant y último run hasta el cual se conciliaron las primeras observaciones. Barrera de inicialización/reanudación.            |
| `etl.statistics_jobs`                       | Tenant/run fuente/algoritmo, estado, presupuesto y lease; separado de runs ETL.                                                |
| `dw.statistics_publication`                 | Informe inmutable por tenant/run fuente/algoritmo, metadatos relacionales y tres secciones JSON versionadas. Sin datos crudos. |
| `dw.statistics_current`                     | Puntero por tenant/algoritmo a la última publicación válida. Sin retroceso de corte.                                           |

SQL promovido en fase2 a nuevas migraciones OLTP/DW y herramienta manual de inicialización, con workers detenidos y preflight0004. No incluir backfill voluminoso dentro de una transacción DDL de30s ni modificar migraciones previas. El marcador de tags nace con cada carga nueva compatible, nunca en el backfill de creaciones. En fase3 el worker consume jobs y publica informes/punteros con permisos específicos; HTTP todavía no los consulta.

Antes de activar, verificar ambos destinos y roles. `BI_STATISTICS_ENABLED` es opt-in independiente en API y worker y requiere `BI_ENABLED` para consumo HTTP. Sin bandera, no consultar objetos nuevos. El preflight de la etapa opcional ocurre fuera de la transacción base; si no puede operar, preservar cargas/lecturas BI previas y reportar sólo indisponibilidad estadística. No exigir0005 al flujo base cuando estadísticas están desactivadas. Una extracción que sí se inicia como completa no publica silenciosamente relaciones inválidas o conteos parciales.

### Tareas y publicación independiente

- Después del éxito ETL y cierre de origen, encolar idempotentemente `(tenant,run,stats_v1)`. El descubrimiento de candidatos también repara el crash entre commit ETL y encolado. Priorizar sólo el último corte del tenant; marcar pendientes previas `superseded`, sin inventar informes intermedios.
- Un tick hace primero cargas elegibles y luego como máximo una tarea estadística; no usar un worker de cómputo concurrente ni una conexión OLTP para el cálculo. La señal de vida actual del worker no equivale a una tarea exitosa.
- Claim incrementa `attempt_count`, fija token aleatorio, lease90s y deadline60s desde reloj DW. Un trabajo running por tenant. Heartbeat20s, conexión destino separada como en ETL; no renovar lease vencido ni más allá del plazo de tarea. Lecturas estadísticas `REPEATABLE READ READ ONLY`, SQL<=30s y presupuesto total60s, resultados agregados acotados; comprobar cancelación/plazo entre fases.
- Recuperar reserva vencida como fallo, liberar sólo token propio y reintentar en ticks posteriores mientras queden intentos<3. Tercero fallido es terminal para ese run/versión. SIGTERM deja de reclamar; una tarea activa drena dentro de su plazo. ETL no depende de resolver estos errores.
- Cálculos fuera de transacciones de escritura. Al publicar, lock del job y después del puntero del tenant/algoritmo; verificar estado/token/lease/deadline y cabecera fuente. Usar el mismo orden en todos los publicadores. Puntero sólo avanza por instante fuente; mismo run/versión es replay, otro job para corte anterior queda superseded.
- Informe, puntero y job succeeded se confirman juntos en tx<=5s, dentro de deadline. Si entretanto hay un corte base más nuevo, se admite publicar el informe del corte reclamado sin retroceder el puntero; API lo presenta `outdated` hasta alcanzar el nuevo corte. Un fallo no sustituye el informe previo. Respuesta ambigua tras COMMIT: consultar clave durable antes de reintentar.
- Códigos técnicos permitidos: `BI_STATISTICS_FAILED`, `BI_STATISTICS_DEADLINE_EXCEEDED`, `BI_STATISTICS_LEASE_LOST`, `BI_STATISTICS_DATA_INVALID`, `BI_STATISTICS_COUNT_OUT_OF_RANGE`. Sin payloads, nombres, SQL, conexiones o stacks en logs. Métricas técnicas agregadas sin labels tenant/run; no alterar estado de éxito ETL.

### Matriz mínima de permisos a provisionar en fase2

| Identidad        | Adición propuesta                                                                                                                                    | Prohibiciones conservadas                                                                |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Exportación OLTP | SELECT sólo dos nuevas vistas `bi_export`.                                                                                                           | Sin tablas privadas, DML ni DDL.                                                         |
| Worker DW        | DML de staging nuevo, taxonomía/puente/creaciones y control jobs; SELECT/INSERT publicaciones, SELECT/INSERT/UPDATE punteros; secuencias aplicables. | Sin DDL ni escritura del ledger de migraciones; no UPDATE/DELETE de informes publicados. |
| Lectura HTTP BI  | SELECT de nuevos objetos `dw` necesarios; configuración vigente mediante servicio existente.                                                         | Sin staging, jobs, DML ni cálculo en HTTP.                                               |
| Control HTTP     | Ningún permiso nuevo.                                                                                                                                | No escribe jobs ni hechos.                                                               |
| Migrador         | Crear objetos y ejecutar backfill autorizado en mantenimiento.                                                                                       | Nunca usado por runtime.                                                                 |

No otorgar privilegios a PUBLIC ni crear roles/credenciales desde los borradores. Las conexiones siguen siendo privadas del backend; sin RLS, el tenant debe aparecer en cada consulta y relación propia.

## 4. Contrato HTTP objetivo y tipos

`GET /api/v1/bi/statistics`, sin query ni body; rechazar cualquier query (incluidos tenant/from/to) con400. JWT/RBAC admin/editor antes de bandera/conexión. Lectura con cuota120/min según mecanismo vigente, middleware privado incluso en errores y `Cache-Control: private, no-store`. La lectura no encola ni calcula.

Respuesta200 en envelope existente `{success:true,data:StatisticsResponse}`. El repositorio consulta sólo `dw` en una única lectura RR, incluyendo último corte base y puntero/publicación; el servicio combina preferencias de vigencia desde el mecanismo existente. La frescura es edad del **corte del informe**, comparada con frecuencia+tolerancia, no edad del cálculo. Pausa no rejuvenece datos.

Contrato HTTP objetivo de fase4. Fase3 ya valida con Zod el payload persistido `forecast`/`patterns`/`anomalies`; el envelope, metadatos, vigencia y estados sin publicación se implementarán en fase4:

```ts
type Count = string; // decimal no negativo, sin separadores
type Instant = string; // ISO8601 UTC con milisegundos
type Month = string; // YYYY-MM, mes real
type Day = string; // YYYY-MM-DD, fecha real UTC
type Reason =
  | 'NOT_LOADED'
  | 'INSUFFICIENT_HISTORY'
  | 'INSUFFICIENT_COVERAGE'
  | 'MISSING_EVALUATION_ORIGIN'
  | 'BASELINE_PERFECT'
  | 'NO_BASELINE_IMPROVEMENT'
  | 'INSUFFICIENT_SAMPLE'
  | 'INSUFFICIENT_BASELINE'
  | 'TAGS_NOT_OBSERVED'
  | 'STALE_PUBLICATION'
  | 'TARGET_OUTDATED';
type Availability = {
  status: 'available' | 'unavailable';
  reason: Reason | null;
};
type Frequency = { id: string; name: string; count: Count; ratio: number };
type Limited<T> = { items: T[]; totalGroups: Count; truncated: boolean };
type MonthlyObservation = {
  month: Month;
  count: Count | null;
  observedDays: number;
  calendarDays: number;
  coverage: number;
  partial: boolean;
};
type Evaluation = {
  targetMonth: Month;
  originAt: Instant;
  actual: Count;
  candidate: number;
  baseline: number;
};
type Anomaly = {
  id: string;
  date: Day;
  metric: 'rejected_share' | 'low_rating_share';
  snapshotAt: Instant | null;
  provisional: boolean;
  numerator: Count | null;
  denominator: Count | null;
  ratio: number | null;
  baselineDays: number;
  median: number | null;
  mad: number | null;
  threshold: number | null;
  status:
    | 'no_snapshot'
    | 'insufficient_sample'
    | 'insufficient_baseline'
    | 'normal'
    | 'flagged';
};
type StatisticsResponse = {
  observedAt: Instant;
  timezone: 'UTC';
  algorithmVersion: 'stats_v1';
  publicationStatus: 'not_loaded' | 'pending' | 'current' | 'outdated';
  publication: null | {
    sourceRunId: string;
    sourceSnapshotAt: Instant;
    generatedAt: Instant;
  };
  coverage: {
    historyStartedAt: Instant | null;
    tagHistoryStartedAt: Instant | null;
    creationsScope: 'observed_only';
  };
  freshness: {
    status: 'not_loaded' | 'fresh' | 'stale';
    dataAgeSeconds: number | null;
    staleAfterSeconds: number;
    frequencyHours: 1 | 6 | 24;
    delayToleranceMinutes: 30 | 60 | 120;
    schedulePaused: boolean;
  };
  forecast: Availability & {
    targetMonth: Month;
    method: 'moving_average_3_constant';
    horizon: 2;
    value: number | null;
    inputMonths: Month[];
    history: MonthlyObservation[];
    evaluation: null | {
      folds: Evaluation[];
      candidateMae: number;
      baselineMae: number;
      candidateBias: number;
      baselineBias: number;
    };
  };
  patterns: Availability & {
    totalTestimonials: Count | null;
    categories: Limited<Frequency>;
    tags: Limited<Frequency>;
    tagsAvailability: Availability;
    associationsAvailability: Availability;
    withoutCategory: { count: Count; ratio: number | null } | null;
    withoutTags: { count: Count; ratio: number | null } | null;
    segments: Limited<{
      categoryKey: string;
      name: string;
      band: 'low' | 'medium' | 'high';
      count: Count;
      ratio: number;
    }>;
    associations: Array<{
      tagA: string;
      tagB: string;
      count: Count;
      support: number;
      confidenceAB: number;
      confidenceBA: number;
      lift: number;
    }>;
  };
  anomalies: Availability & { from: Day; to: Day; items: Anomaly[] };
};
```

Razones NULL sólo en secciones disponibles. `forecast.history`<=24, evaluación exactamente6 si presente, inputMonths exactamente3 al proyectar; listas50/pares20 y anomalías180 filas máximo (90×2). IDs de categorías decimales; tags UUID canónicos. Magnitudes de pronóstico/métricas finitas y dentro de rango seguro; razones de proporciones `[0,1]`, lift>=0 y threshold sin máximo1. Arrays en orden temporal ascendente, anomalías por día/métrica; categorías/tags según reglas anteriores.

Sin cabecera base:200 `not_loaded`, publicationNULL, coberturaNULL, secciones unavailable/NOT_LOADED, cantidades desconocidasNULL, listas vacías. Con cabecera y sin informe:200 `pending` con secciones indisponibles, razónINSUFFICIENT_HISTORY no se infiere; usarNOT_LOADED. Sin informe, target/ventanas se anclan al mes/día del reloj DW, sin conteos ficticios.

Con informe, `patterns` está available incluso si el inventario observado es cero; la disponibilidad de tags/pares se expresa por separado. `anomalies` está available si hay al menos una fila evaluada normal/flagged; de lo contrario, unavailable/INSUFFICIENT_SAMPLE si ningún corte tiene N>=30, o INSUFFICIENT_BASELINE si los tiene pero no reúne referencias. Las filas de huecos/muestra insuficiente permanecen visibles. En un inventario vacío se conocen los conteos cero, pero las razones sin denominador quedan NULL.

`current` requiere run fuente igual a última cabecera y versión compatible. Otro informe válido anterior = `outdated`, conservado. `pending` no confirma que un job esté running: significa que falta publicación, sin exponer jobs. Informe desactualizado o fuente stale => forecast unavailable/STALE_PUBLICATION y valueNULL; si target no coincide con mes siguiente al reloj DW, prevaleceTARGET_OUTDATED. Mantener histórico/evaluación y patrones/señales anteriores con aviso, sin presentarlos como alertas actuales. Provisional sólo identifica el día que contiene el corte fuente, no el día del navegador.

Errores:401/403 según sesión/roles,400 query desconocida,429 cuota,503 `BI_DISABLED` si BI desactivado,503 `BI_STATISTICS_DISABLED` si opt-in apagado,503 `BI_STATISTICS_UNAVAILABLE` si no hay esquema/permisos/conexión compatible o publicación inválida. No convertir errores técnicos o JSON inválido en «sin anomalías». No fallback OLTP ni respuesta de otra empresa. Startup/readiness CMS no consultan estadísticas.

Persistir sólo forecast/patterns/anomalies del informe en JSON, validados por versión antes de insertar y al leer; metadatos relacionales son autoridad para tenant/run/corte/versión. Nunca aceptar metadatos del JSON como autorización. Las secciones no se mezclan entre publicaciones. Zod comprueba disponibilidad/NULL y límites, además de tipos básicos.

## 5. Interfaz y exportación previstas

`/admin/business-intelligence?view=statistics` para admin/editor. Mantener navegación/URL actuales; las ventanas fijas de esta vista no toman from/to del resumen. Explicar período de cada sección y mostrar corte, vigencia y alcance observado. Método/error en detalle accesible, con cantidad aproximada diferenciada del histórico y sin bandas inventadas.

Tres CSV desde la misma respuesta autorizada visible: pronóstico/histórico/evaluación, patrones (tipos de fila para frecuencia/segmento/par/cobertura) y anomalías. Cada uno incluye versión/corte/UTC/estado/motivo, encabezados y campos consistentes por archivo. No recalcular fórmulas en web. NULL vacío, cero literal, conteos exactos, decimales del API, BOM UTF8/CRLF, comillas y neutralización de fórmulas igual que CSV vigente. Sin publicación, deshabilitar descarga explicando motivo.

GET al entrar, actualizar y volver a pestaña; sin polling adicional. Reutilizar abortos, descarte de respuestas obsoletas, retiro de datos ante400/401/403/404 y remount por identidad. Tablas con captions, navegación por teclado, foco, móvil y gráficos con alternativa textual; nunca sólo rojo/verde.

## 6. Matriz de aceptación para fases siguientes

| Grupo               | Casos verificables independientes                                                                                                                                                         | Fase / estado                                      |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Datos               | Mismo tenant en FK/joins; tags múltiples no multiplican inventario; marcador vacío distinto de ausente; discrepancia de creación aborta; replay y borrados preservan primera observación. | 2 / verificado local                               |
| Pronóstico          | 11/12 meses; 89/90% exactos; bisiestos; orígenes faltantes; datos tardíos excluidos de entradas; h=2 constante; baseline perfecto/empate/10% exactos; MAE/sesgo con ceros y sin fuga.     | 3 / verificado local                               |
| Minería             | N29/30; soporte/ab/lift en el límite; doble etiqueta deduplicada; confidencias distintas por dirección; empates y truncamiento con denominador original.                                  | 3 / verificado local                               |
| Anomalías           | N29/30, referencias20/21, MAD0/par, igualdad al umbral no señala, salto de5pp, threshold>1, huecos, denominador0, actualización del día sin duplicar.                                     | 3 / verificado local                               |
| Publicación         | Crash antes/después de encolar/commit; token vencido; dos workers; 3 intentos; timeout/cancelación; informe anterior preservado; puntero no retrocede.                                    | 3 / verificado local                               |
| API/UI              | Dos tenants/admin/editor; query rechazada; JSON inválido/503; flagoff sin conexión nueva; corte viejo/cambio de mes; CSV igual a vista y sin fórmulas; cambio de sesión/teclado/móvil.    | 4 / pendiente                                      |
| Sistema             | API/worker/DW reales, privilegios efectivos, restauración, costos de extracción/cálculo/lectura y aislamiento ante caída OLAP.                                                            | 5 / pendiente                                      |
| Utilidad predictiva | Histórico real suficiente, particiones/cobertura y criterio cumplidos por tenant.                                                                                                         | Pendiente de datos; fixtures no acreditan utilidad |

Las fases2/3 aportan evidencia local de datos, cálculos y publicación detallada en el plan y las guías de operación. API/UI y aceptación integral siguen pendientes; no se acredita utilidad predictiva real ni capacidad productiva.

### Oráculos numéricos fijados antes de implementar

| Entrada independiente                                       | Resultado esperado                                                                                                         |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Tres meses cerrados 90,120,150; objetivo a dos pasos.       | Pronóstico constante120 en ambos pasos; no130 por realimentación de una predicción.                                        |
| Un fold con real120, candidato120 y baseline150.            | Error absoluto candidato0/baseline30; sesgo candidato0/baseline+30.                                                        |
| N100, A40, B20, intersección10.                             | Soporte0,10; confianza A→B0,25 y B→A0,50; lift1,25.                                                                        |
| 21 referencias de0,10 con N100; actual15/100 y luego16/100. | Mediana0,10, MAD0, umbral0,15; igualdad no señala,0,16 sí.                                                                 |
| Función mediana sobre0,10/0,20/0,30/0,40.                   | Mediana0,25 y MAD0,10.                                                                                                     |
| Cobertura27 días de un mes de30, frente a27 de31.           | 0,90 elegible frente a aproximadamente0,87097 no elegible.                                                                 |
| Creación28/02, primera observación02/03, origen01/03.       | No incluir en la entrada de febrero conocida al origen01/03; sí en conteos retrospectivos posteriores, con su procedencia. |
