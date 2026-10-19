# Operación, consumo y evidencia de aceptación

Leer para API, dashboards, seguridad, recuperación, auditoría y cierre de entrega. Los detalles vigentes están en [operación API](../../../../docs/modules/api-bi-operations.md), [interfaz BI](../../../../docs/modules/web-business-intelligence.md), [worker](../../../../docs/operations/21_bi_worker_operations.md) y [validación/habilitación](../../../../docs/operations/23_bi_validation_and_release.md). No inferir aceptación productiva desde fixtures locales.

## API y aislamiento

- Resolver tenant/permisos desde identidad autenticada; parametrizar valores SQL y usar allowlists para identificadores/dimensiones. No aceptar SQL arbitrario desde interfaz ni tenant del body/query como autoridad.
- Aplicar límites de rango temporal, filas/páginas, cardinalidad, duración y cuotas según contrato. Mantener conteos grandes en cadenas decimales y cantidades desconocidas como NULL; no perder precisión ni inventar cero.
- Preservar admin/editor, CSRF, control optimista de configuración, idempotencia y auditoría. Un `202 accepted` confirma solicitud durable, no ejecución terminada. La API no ejecuta ETL ni escribe hechos, runs, leases o ledger.
- Probar accesos negativos con dos tenants y roles aplicables; incluir asociaciones, trabajos asíncronos, exportaciones y acceso directo. No agregar un dashboard global de operador por defecto.
- El dashboard actual usa respuestas privadas `no-store`; Redis de caché pública no implica caché BI. Si se autoriza agregarla, incluir tenant, permisos, filtros y versión de publicación, e invalidar ante cambios de datos/autorizaciones.
- Conservar corte/publicación, filtros efectivos y estado de vigencia/calidad del contrato. Versionar nuevos contratos si hace falta; no inventar campos en la API actual por un ejemplo genérico.
- Mantener credenciales separadas y mínimo privilegio. Caída DW implica indisponibilidad BI sin cambiar readiness/startup OLTP ni impedir captura/moderación. Sin fallback OLTP.

## Visualización y exportaciones

| Nivel | Pregunta y comportamiento |
| --- | --- |
| Ejecutivo | Estado frente a metas, variaciones y responsables; priorizar acciones. |
| Diagnóstico | Tendencias/segmentos/cohortes según grano; filtros y profundización para explicar cambios. |
| Predictivo, si se validó | Estimaciones, horizonte e incertidumbre diferenciados del histórico; simulaciones con supuestos explícitos. |

Mostrar unidad, período UTC, filtros, definición, fecha de corte/publicación, actualidad y completitud conocida. Explicar dirección favorable y no depender sólo de rojo/verde. Proveer etiquetas, teclado y alternativas textuales pertinentes; no afirmar conformidad WCAG por una revisión parcial.

Conservar cero observado frente a ausencia/desconocido. No presentar datos viejos como actuales o una solicitud aceptada como éxito del pipeline. Mantener limpieza de estado al cambiar identidad, descarte de respuestas obsoletas y polling visible según contrato; no aumentar frecuencia sin medir.

CSV y otros consumidores reproducen semántica y autorización de API con iguales filtros/corte. Respetar protecciones de exportación existentes y verificar que fórmulas de hoja de cálculo o serialización no alteren contenido/seguridad.

## Resiliencia y trazabilidad

Reintentar fallos transitorios con límites y política adecuada; integraciones nuevas pueden usar espera incremental con jitter. Conservar presupuesto/scheduler del CMS en vez de sustituirlos por reintentos genéricos. Datos inválidos no se corrigen con reintentos indefinidos. Bloquear consumidores dependientes de datos inválidos y permitir trabajo independiente cuando sea seguro.

Respetar leases, heartbeat y fencing al inicio/final de publicación. Ante respuesta ambigua tras COMMIT, consultar estado durable antes de repetir o declarar fracaso. No borrar reservas, reiniciar contadores ni editar punteros para fabricar éxito. Backfill/replay requieren fuentes/cortes reproducibles; no reconstruir snapshots nunca observados.

Preparar recuperación de cuarentena cuando exista, cambios de esquema, backup/restauración y rollback con RPO/RTO acordados. Restaurar en destino de prueba separado y verificar contenido, privilegios e idempotencia posterior; generar un dump no demuestra recuperación. Conservar migraciones versionadas/checksums y mantenimiento/ACK de runbooks. Revertir interfaz no implica DROP ni borrar historial.

Relacionar fuente, run, intervalo lógico, intento, versión de dataset, conteos leídos/escritos/rechazados, duración, estado y código de error cuando aplique. Añadir pipeline/tarea si existe ese nivel, sin inventar capas para completar campos. Ledger durable y logs permiten linaje; mantener métricas técnicas globales sin labels tenant/run de alta cardinalidad.

El CMS registra códigos técnicos acotados: no agregar filas, payloads, SQL, conexiones, tokens, mensajes completos del driver ni stacks que puedan filtrarlos. Saneamiento y permisos preceden cualquier ampliación de diagnóstico.

## Requisitos y Definition of Done

Aplicar requisitos afectados por la tarea. Registrar cada criterio como **verificado** con evidencia reproducible, **pendiente** con brecha explícita o **no aplicable** con justificación. Esta matriz no declara que el CMS ya cumple todos los puntos.

| Requisitos de la especificación | Evidencia de aceptación pertinente |
| --- | --- |
| RF-01 relevamiento, RF-02 arquitectura | Usuario/decisión/fuente/responsable y presupuesto; separación OLTP/OLAP y costo de extracción evaluados. |
| RF-03 ingesta, RF-04 cambios | Replay sin doble contabilización; actualizaciones, borrados, duplicados y tardíos. Si hay incremental, equivalencia con reconstrucción y fallo tras escritura/antes de checkpoint. |
| RF-05 calidad, RF-06 modelado | Contratos, unicidad, relaciones y conciliación; grano documentado y joins sin fan-out. Inconsistencias no publicadas como completas. |
| RF-07 métricas | Fórmula/versionado/responsable; igualdad API/dashboard/CSV con filtros/publicación equivalentes. |
| RF-08 orquestación | Intentos acotados, concurrencia/fencing, caída/recuperación; publicación atómica y última versión válida preservada. |
| RF-09 minería, RF-10 predicción, RF-11 publicación | Si se solicitan: utilidad del patrón, particiones válidas, baseline, evaluación por segmento/horizonte y versiones/validez trazables; promoción sólo si cumple criterio. |
| RF-12 acceso | Pruebas negativas entre tenants/roles, permisos SQL, límites, caché si existe, exportaciones y trabajos asíncronos. |
| RF-13 visualización | Unidades, períodos, filtros, actualidad/completitud, accesibilidad y distinción observado/estimado/simulado. |
| RF-14 verificación | Linaje KPI-origen/predicción-modelo, seguridad, rendimiento y restauración/rollback según cambio. |

| Requisitos no funcionales | Qué medir o documentar |
| --- | --- |
| RNF-01 rendimiento, RNF-08 escalabilidad | p95/concurrencia, volumen representativo, CPU/IO/pools e impacto CMS frente a baseline. Caché fría/caliente si existe, condiciones declaradas. |
| RNF-02 actualidad, RNF-03 completitud | Demora origen-disponibilidad y cobertura período/fuentes; umbrales acordados y visibles, separados del estado técnico del run. |
| RNF-04 integridad | Conteos/importes equivalentes, tolerancias documentadas, cero diferencias inexplicadas y ninguna violación crítica publicada. |
| RNF-05 seguridad | Mínimo privilegio y cero accesos indebidos permitidos en pruebas negativas ejecutadas; no equivale a prueba universal de ausencia de fallos. |
| RNF-06 mantenibilidad, RNF-11 reproducibilidad | Versiones de contratos, transformaciones, métricas, datos/código/configuración/modelos y decisiones según aplique. |
| RNF-07 disponibilidad | Última publicación válida con antigüedad; publicaciones válidas sobre esperadas frente al objetivo; recuperación dentro de RPO/RTO medidos. |
| RNF-09 costo | Almacenamiento/procesamiento/actualización/consulta frente al presupuesto; crecimiento/retención evaluados. |
| RNF-10 accesibilidad | Etiquetas, teclado, información no dependiente sólo del color y alcance real de revisión. |

No convertir ejemplos del adjunto (60 minutos, dos segundos) en SLO universales. Fijar metas con responsables antes de aprobarlas. Un run exitoso no demuestra datos correctos/completos/actuales; un benchmark sintético local no certifica producción ni causalidad del impacto observado.

## Escenarios de revisión de la skill

Son casos de revisión documental; no sustituyen pruebas ejecutadas de una funcionalidad implementada.

1. **Ampliar una métrica existente:** resolver grano, numerador/denominador, UTC, filtros, cero/ausencia y fuente; mantener consulta en `dw` y equivalencia API/CSV/UI. Probar dataset calculable a mano con dos tenants; agregar snapshots no debe sumar inventarios entre horas. No introducir ML ni CDC por esta ampliación.
2. **Evaluar una predicción futura:** definir corte, disponibilidad real de features, horizonte y acción; particionar antes de ajustar transformaciones, comparar baseline y evaluar incertidumbre. Sin histórico/mejora suficiente, dejar pendiente y no afirmar probabilidad calibrada o modelo apto. No entrenar en OLTP.
3. **Auditar aislamiento/publicación:** revisar credenciales/consultas tenant, dos workers compitiendo, lease vencido y fallo de publicación/COMMIT ambiguo; verificar último corte íntegro y continuidad CMS ante caída DW. Ensayos requieren servicios descartables autorizados; si sólo se inspeccionó documentación/código, marcar pendientes garantías no ejecutadas.
