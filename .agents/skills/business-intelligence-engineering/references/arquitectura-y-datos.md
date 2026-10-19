# Arquitectura, contratos y semántica de datos

Leer al diseñar o modificar fuentes, cargas, métricas y modelos dimensionales. El estado real se mantiene en el [ADR 0004](../../../../docs/adr/0004-warehouse-postgresql-separado.md), el [diccionario warehouse](../../../../docs/domain/warehouse_diccionario_de_datos.md), el [contrato BI](../../../../docs/modules/api-business-intelligence.md) y la [operación ETL](../../../../docs/operations/17_business_intelligence_etl.md). No reemplazar su DDL/algoritmo con una arquitectura genérica.

## Decisión y arquitectura proporcional

Registrar quién consume el resultado, qué decisión toma, frecuencia, fuentes/responsables, calidad/histórico disponibles y presupuesto de procesamiento, almacenamiento y consultas. Definir latencia y actualidad por caso de uso, sin umbrales universales. Evaluar uso del módulo y decisiones apoyadas; contar gráficos o modelos no mide valor.

Separar extracción, transformación, entrenamiento y consumo. Medir el costo de las lecturas de extracción sobre OLTP. Conservar el warehouse dedicado del CMS; otro motor o una réplica requieren justificar operación, consistencia y recursos. Una réplica física en recuperación no sustituye un destino analítico escribible.

ROLAP permite análisis multidimensional en tablas relacionales sin cubos físicos ni precálculo de todas las combinaciones. El esquema estrella es una opción preferente de consumo, adaptada al grano y las consultas reales.

Medallón organiza niveles lógicos de calidad y no exige lakehouse. Si una futura tarea lo adopta, Bronce conserva entradas autorizadas suficientes para replay, Plata valida/deduplica y Oro publica hechos/métricas. No renombrar `staging/dw/etl` como esas capas. Un lakehouse debe justificar almacenamiento, formato de tablas, catálogo, motor y garantías de consistencia.

## Fuentes, ingesta y calidad

- Definir esquema/versión, claves de negocio, operaciones, secuencia, tiempo del evento, disponibilidad real e ingesta, lote/run y reglas de borrado/retención. Conservar sólo los metadatos necesarios para trazabilidad y reprocesamiento autorizado.
- En el CMS, la reconciliación completa usa lectura consistente por empresa y cursores dentro del mismo snapshot. No tratar el cursor paginado como checkpoint incremental entre cargas ni reemplazarlo por máximo ID/`updated_at`.
- Conciliar entradas, aceptados, rechazados y descartes justificados. Diferenciar cero, nulo y dato ausente; normalizar tipos, timestamps y categorías sin perder precisión de BigInt/Decimal. Validar obligatoriedad, duplicados, rangos y relaciones incluyendo tenant.
- La carga actual aborta inconsistencias y conserva la publicación anterior. Si se introduce cuarentena, definir causa, responsable, retención, acceso y recuperación, sin publicar silenciosamente resultados incompletos. Una DLQ corresponde a mensajería; batch puede usar una tabla o ubicación de cuarentena.
- Proteger concurrencia y publicación consistente: staging y conteos parciales no se presentan como un corte completo. Repetir entradas/versiones no debe duplicar claves ni contabilizar dos veces.
- Los snapshots publicados conservan historia observada aunque desaparezca un recurso de origen; engagement se reconcilia con eventos aún disponibles. Una purga explícita, incluido su alcance sobre backups, requiere procedimiento autorizado. No afirmar que ya existe una política de retención/eliminación automática.

### Sólo si se autoriza ingesta incremental o CDC

Coordinar snapshot inicial con posición de cambios; especificar actualizaciones, tombstones/borrados, reentregas, eventos fuera de orden y evolución de esquema. Persistir duraderamente antes de confirmar checkpoints y probar el fallo entre escritura y confirmación. No asumir que la última fila recibida es el estado más reciente.

`updated_at > último_valor` puede omitir cambios con timestamps iguales o tardíos. Elegir desempate, solapamiento seguro, deduplicación y watermark/ventana de relectura conforme a las garantías de la fuente. Comparar resultado incremental contra reconstrucción controlada; no prometer captura de borrados si la fuente no los informa.

## Modelo dimensional

Declarar el grano antes de crear hechos. Separar eventos, estados e inventarios de distinta granularidad; definir claves y cardinalidad de dimensiones. Unir hechos sin controlar fan-out puede multiplicar medidas: agregar primero al grano compatible o usar otro diseño verificable.

Clasificar medidas como aditivas, semiaditivas o no aditivas. En el CMS, el total del snapshot de tenant no es aditivo entre cortes. Preservar cabecera incluso vacía, instante/fecha UTC y vínculo tenant/run; no derivar tiempo de negocio desde tablas de control.

Elegir SCD1 o SCD2 según necesidad de historia. SCD2 requiere vigencias sin superposición y joins por vigencia; no atribuir nombres descriptivos históricos que el modelo actual no conserva. Crear agregados e índices por consultas y mediciones.

En fuentes comerciales futuras, documentar moneda, conversión, impuestos, devoluciones y anulaciones antes de sumar importes. No imponer estos campos a métricas del CMS que no los necesitan.

## Catálogo semántico de métricas

Mantener definiciones en el contrato/catálogo existente o formato versionado equivalente. Evitar fórmulas independientes en API, frontend y CSV. Registrar para cada métrica afectada:

| Grupo | Definición necesaria |
| --- | --- |
| Identidad | Identificador, versión, significado y responsable. |
| Cálculo | Fórmula, numerador/denominador, unidad/moneda, inclusiones/exclusiones, nulos y denominador cero. |
| Agregación | Grano, dimensiones, filtros, aditividad y reglas entre períodos. |
| Tiempo | Zona horaria, calendario, corte, cobertura esperada y actualidad admisible. |
| Uso | Decisión, dirección favorable y meta si fue acordada. |

Distinguir objetivo estratégico, resultado clave con plazo, KPI y métrica operativa. No todo KPI pertenece a un OKR; aplicar SMART a metas cuando corresponda. Para tasas agregadas, recalcular desde componentes, sin sumar porcentajes ni promediar tasas sin ponderación.

Verificar equivalencia entre API, dashboard y exportación con iguales filtros/publicación. Documentar linaje desde columna/fuente, transformación y versión de dataset hasta indicador y visualización.

## Herramientas opcionales

Seleccionar por responsabilidad y capacidad del equipo; verificar versiones/capacidades en documentación primaria al implementar. Esta skill no instala ni exige estos productos.

| Responsabilidad | Opciones y distinción |
| --- | --- |
| Almacén/SQL | PostgreSQL dedicado vigente; BigQuery/Snowflake u otros con requisito demostrado. DuckDB es motor analítico, no capa semántica; evaluar concurrencia y proceso propietario si se elige. |
| Transformación/calidad | SQL actual; dbt/Python si simplifican transformaciones y pruebas. dbt no sustituye automáticamente extracción. |
| Orquestación | Scheduler durable vigente; Airflow/Prefect si dependencias/recuperación justifican operación. El orquestador no garantiza idempotencia ni publicación atómica. |
| Semántica/visualización | Contratos y frontend propios vigentes; Cube ofrece capa semántica/acceso; Superset aporta exploración y semántica ligera; Metabase es otra opción de visualización. |
| Linaje | Metadatos fuente/run/contratos; dbt/OpenLineage/catálogo si se necesita mayor cobertura. |
| Modelos | Modelos estadísticos, scikit-learn/boosting según evaluación; MLflow registra experimentos/artefactos, no reemplaza entrenamiento ni validación. |

Para cambios que escriban SQL, DDL o pruebas de persistencia, cargar las reglas aplicables de [Supabase Postgres](../../supabase-postgres-best-practices/SKILL.md); no hace falta para una definición conceptual de KPI.
