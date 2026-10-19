# Minería de datos y evaluación predictiva

Leer sólo ante segmentación, asociaciones, anomalías, clasificación o pronóstico. Son una evolución posible del CMS, no funciones implementadas ni permiso para exportar nuevas columnas o entrenar sobre datos personales.

## Problema y viabilidad

Definir entidad, tenant, resultado objetivo, corte de observación, horizonte, acción asociada y costo de errores. Comprobar histórico, etiquetas, frecuencia, disponibilidad real de variables, cobertura por segmento y tamaño suficiente para evaluar. Si faltan datos o una acción útil, explicar la limitación y mantener análisis descriptivo o baseline; no fabricar evidencia.

Una exploración puede producir patrones, segmentos, asociaciones o anomalías sin modelo predictivo. Evaluar estabilidad y utilidad de negocio, incertidumbre y sesgos de selección. Una correlación no prueba causalidad; un escenario con sliders es una simulación condicionada a supuestos, no una estimación causal demostrada.

## Datos y prevención de fuga de información

- Construir variables disponibles **al momento de predecir**, considerando fecha del evento y momento en que se conoció la información. Documentar definición, grano, versión y corte de cada variable.
- Usar conjuntos con granularidad apropiada; no imponer siempre Plata/Oro ni crear capas nuevas. Publicar salidas predictivas explícitas y versionadas, separadas de observaciones reales.
- Separar entrenamiento, validación y test final antes de ajustar imputación, escalado, codificación o selección de variables. Ajustar cada transformación dentro del entrenamiento/fold correspondiente.
- Aplicar SMOTE u otro remuestreo sólo al entrenamiento. No elegir repetidamente modelos, umbrales o features mirando el test final.
- Usar partición temporal y evaluación por origen rodante para pronósticos; separar ventanas si las etiquetas se solapan. Separar entidades cuando se quiera generalizar a entidades nuevas. Evitar solapamientos que vuelvan la evaluación artificialmente favorable.
- Definir si el entrenamiento es por tenant o compartido. Compartir datos o publicar predicciones entre empresas requiere justificación y autorización; el filtro de API no legitima mezclar datasets.

## Baseline y evaluación

Fijar criterio de promoción antes de evaluar el test final. Evaluar por segmento, horizonte y costo relevante, no sólo una métrica global favorable.

| Problema | Baseline posible | Evaluación útil |
| --- | --- | --- |
| Pronóstico | Último valor o patrón estacional simple. | MAE, RMSE, sesgo, desempeño por horizonte y cobertura/amplitud de intervalos. |
| Clasificación/churn | Regla operativa o modelo sencillo. | Precision, recall, PR-AUC, calibración y costo; elegir umbral sobre validación. |
| Segmentación | Segmentos actuales de negocio. | Estabilidad, diferencias accionables y utilidad de grupos. |
| Anomalías | Umbrales o reglas estadísticas. | Falsas alarmas, revisión de casos y utilidad operativa. |

No llamar probabilidad a un score sin evidencia de calibración. Para pronósticos, medir intervalos de predicción con cobertura y amplitud compatibles con el nivel declarado; no dibujar bandas arbitrarias ni confundirlas con intervalos de confianza de una media.

No promocionar un modelo que incumple su criterio. Conservar baseline o informar que no existe evidencia predictiva suficiente. Datos sintéticos prueban mecánica y contratos, no desempeño sobre población productiva.

## Reproducibilidad, publicación y seguimiento

Conservar ficha de modelo y metadatos para reproducir el experimento: versiones de datos, código, configuración y dependencias; particiones/cortes, variables, algoritmo/parámetros, semillas cuando apliquen, baseline, métricas por segmento/horizonte, limitaciones y criterio de promoción. Usar formatos/almacenamiento existentes o el mínimo recurso nuevo necesario; MLflow es opcional.

Entrenar fuera del OLTP y de los procesos que atienden operaciones del CMS, con recursos y acceso autorizados. Publicar consistentemente como dataset identificado por entidad/tenant, corte, horizonte, versión de modelo/datos, vigencia y estado de calidad. Distinguir score, clase, probabilidad calibrada e intervalo según la salida real; no imponer un esquema universal.

Definir antes de habilitar consumo: comportamiento ante datos faltantes, modelo vencido o inferencia fallida; monitoreo de calidad, drift, desempeño observado cuando lleguen etiquetas y costos; responsables y condiciones de rollback. Mantener trazabilidad predicción-datos-modelo. Un modelo registrado o entrenamiento terminado no prueba utilidad ni habilita promoción automática.
