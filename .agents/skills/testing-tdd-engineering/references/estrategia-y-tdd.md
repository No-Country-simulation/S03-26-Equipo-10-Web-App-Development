# Estrategia por riesgo y TDD

Leer al diseñar escenarios, elegir niveles o aplicar Red → Green → Refactor. Complementa la [skill](../SKILL.md); las fuentes funcionales son los contratos del módulo y las [reglas de negocio](../../../../docs/domain/business_rules.md), no las respuestas actuales del sistema por sí solas.

## Selección y trazabilidad del comportamiento

Registrar requisito o contrato, riesgo, precondiciones, entrada, resultado observable y efectos persistentes que se quieren proteger. Un expected calculado con la misma función que se evalúa puede reproducir sus errores. Usar valores independientes, invariantes aprobadas o un comportamiento de referencia validado.

| Prioridad | Riesgo en esta app                                                                                              | Evidencia a seleccionar                                                                                                                                                    |
| --------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0        | Acceso entre tenants, permisos/sesiones incorrectos, corrupción de datos, atomicidad de outbox o publicación BI | Éxito, fallos significativos, fronteras y efectos persistentes en las capas pertinentes; todos los escenarios críticos identificados y aprobados deben quedar verificados. |
| P1        | CRUD principal, moderación, captura, contratos multimedia y errores de integración                              | Comportamiento positivo y errores previsibles; elegir el nivel que detecte el defecto con menor costo suficiente.                                                          |
| P2        | Formateo, filtros secundarios, interacción acotada                                                              | Pruebas selectivas según complejidad e historial de defectos.                                                                                                              |
| P3        | Decoración, forwarding, configuración estática sencilla                                                         | Revisión o comprobación ligera; suite dedicada sólo ante riesgo concreto.                                                                                                  |

Las prioridades corresponden al escenario y al impacto del cambio, no se asignan a todo un archivo por su nombre. No imponer una proporción de Unit/Integration/E2E, un número de tests ni porcentajes de cobertura universales. Si el plan fija un umbral, definir medición y gate ejecutables sin confundir cobertura con correctitud.

| Comportamiento           | Evidencia aislada útil                      | Integración o recorrido representativo                                                     |
| ------------------------ | ------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Contenido y rating       | Fronteras y valores inválidos en DTO/regla  | Restricciones PostgreSQL y contrato HTTP si se afectan.                                    |
| Transición de testimonio | Tabla de transiciones permitidas/prohibidas | Estado persistido, conflicto concurrente y evento outbox correspondiente.                  |
| Sesión y permisos        | Política o transformación con lógica propia | Guards/cookies/CSRF con credenciales controladas; denegación y ausencia de cambios.        |
| Persistencia por tenant  | No se prueba sólo con mocks                 | Lectura/escritura con dos tenants y relaciones ajenas rechazadas.                          |
| Captura y moderación     | Formulario accesible y estados de error     | Recorrido E2E futuro con backend real y visibilidad pública según contrato.                |
| Cuotas/caché y BI        | Política, calendario UTC y cálculo aislado  | Redis real, invalidación por tenant, leases/fencing y publicación atómica según contratos. |

## Red, Green y Refactor

1. **Acordar el comportamiento:** tomar un requisito aprobado y ejemplos Given/When/Then. BDD/ATDD ayuda a compartirlos; Gherkin no obliga a instalar Cucumber.
2. **Red:** escribir y ejecutar una prueba para el comportamiento ausente/incorrecto. Inspeccionar que falla por la regla o efecto esperado. Si falta el símbolo, una interfaz mínima puede permitir observar ese fallo funcional. Dependencias sin instalar, imports erróneos, DB caída o timeout del propio test requieren reparación del entorno/test antes de acreditar Red.
3. **Green:** introducir sólo lo necesario. Preservar el oráculo legítimo, assertions y escenario; ejecutar la prueba nueva y las relacionadas. Si el expected era incorrecto, justificar el cambio con el contrato y repetir la verificación, sin tratarlo como una corrección de producción.
4. **Refactor:** reducir duplicación y acoplamiento sin cambiar el contrato; repetir la suite pertinente. Los tests deben tolerar una reorganización interna válida.

Ante una regresión, reproducir el defecto antes de corregirlo. Si una prueba se escribió después de la implementación, comunicarlo; que pase no demuestra un ciclo TDD. Conservar comando y causa de Red y resultado Green cuando la criticidad lo requiera; nunca fabricar evidencia.

Para legado, caracterizar el comportamiento necesario antes de refactorizar, marcando defectos conocidos y diferencia con la especificación deseada. Exploración visual, prototipos descartables, investigación, documentación, configuración sencilla y código generado pueden verificarse mediante revisión o contratos superiores sin imponer TDD estricto.

## Diseño unitario y ejemplos de contrato

Aplicar particiones de equivalencia, valores frontera, tablas de decisión y transiciones según el contrato. Considerar vacíos, ausencias, duplicados, fechas/UTC, Unicode, precisión y concurrencia sólo si son posibles y relevantes. Usar Arrange/Act/Assert o Given/When/Then y nombres por comportamiento. Varias assertions relacionadas pueden comprobar el mismo resultado; no exigir una assertion por test.

Ejemplos de aceptación para BR-VAL-001/002, contrastados con [DTO](../../../../apps/api/src/modules/testimonials/dto/testimonial.dto.ts) y [prueba Unicode existente](../../../../apps/api/test/testimonial-content-validation.spec.ts):

| Entrada aislada, demás campos válidos | Resultado esperado | Defecto que debe detectar                                 |
| ------------------------------------- | ------------------ | --------------------------------------------------------- |
| Contenido `123456789`                 | Rechazado          | Aceptar menos de diez caracteres.                         |
| Contenido `1234567890`                | Aceptado           | Cambiar la frontera mínima de inclusiva a exclusiva.      |
| Cinco emoji `😀`                      | Rechazado          | Contar unidades UTF-16 como si fueran caracteres Unicode. |
| Diez emoji `😀`                       | Aceptado           | Rechazar el mínimo Unicode válido.                        |
| Rating 1 o 5                          | Aceptado           | Excluir uno de los límites permitidos.                    |
| Rating 0, 6 o 1.5                     | Rechazado          | Omitir rango o integridad del rating.                     |

El mínimo Unicode usa puntos de código, coherente con `char_length` de PostgreSQL; no inferir conteo de grafemas ni una política adicional de normalización. Estos ejemplos son escenarios de contrato, no un reporte de ejecución actual.

Mockear sólo dependencias fuera de la unidad; restaurar spies, timers, variables globales y mocks. Evitar probar getters triviales, métodos privados, código generado o detalles de bibliotecas. No duplicar el algoritmo en el expected ni limitar una regla numérica a `toBeDefined()`.

Property-based/metamorphic testing puede aportar valor para invariantes como idempotencia de normalización o preservación de elementos, sólo si el contrato las garantiza. fast-check es una opción futura; ante fallos guardar semilla y caso mínimo reducido, y no inventar propiedades del dominio.

## Requerimientos funcionales de la fuente

Los identificadores conservan el alcance del adjunto. La tabla expresa obligaciones al aplicar la metodología; no afirma que todo esté implementado o ejecutado en el repositorio.

| ID    | Aplicación y criterio verificable                                                                                                       |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------- |
| RF-01 | Inspeccionar arquitectura, tecnologías, dependencias y funcionalidad afectada antes de generar pruebas.                                 |
| RF-02 | Identificar contratos públicos, reglas, invariantes y comportamientos esperados con fuente explícita.                                   |
| RF-03 | Clasificar riesgos y justificar qué comportamientos requieren evidencia.                                                                |
| RF-04 | Elegir Unit, Integration o E2E según límite, confianza y costo.                                                                         |
| RF-05 | Aplicar Red-Green-Refactor a lógica nueva donde sea adecuado; declarar excepciones de contexto.                                         |
| RF-06 | Ejecutar Red y comprobar una causa funcional relevante, separada de errores accidentales de entorno.                                    |
| RF-07 | Implementar el comportamiento mínimo expresado por pruebas legítimas.                                                                   |
| RF-08 | Refactorizar preservando el contrato y repetir las pruebas pertinentes.                                                                 |
| RF-09 | Probar lógica de negocio y límites mediante unidades de comportamiento.                                                                 |
| RF-10 | Definir y ejecutar integración con las dependencias reales dentro del límite evaluado.                                                  |
| RF-11 | Identificar recorridos críticos y probarlos con E2E cuando el runner/entorno estén habilitados; declarar la brecha mientras no existan. |
| RF-12 | Comprobar resultados, invariantes y efectos secundarios con assertions significativas.                                                  |
| RF-13 | Auditar tests que aceptarían defectos y aplicar controles negativos pertinentes.                                                        |
| RF-14 | Ejecutar mutación selectiva cuando su valor justifique costo y herramientas; evaluar supervivientes críticos.                           |
| RF-15 | Controlar variabilidad, estado residual y dependencias entre tests; diagnosticar flakiness.                                             |
| RF-16 | Usar IA para descubrir negativos y fronteras posibles, sin tratarlos como reglas aprobadas.                                             |
| RF-17 | Contrastar pruebas generadas con contratos y requisitos reales.                                                                         |
| RF-18 | Impedir cambios injustificados de expectativas, assertions o fixtures para obtener Green.                                               |
| RF-19 | Presentar evidencia real de ejecución, fallos y correcciones con sus límites.                                                           |
| RF-20 | Integrar suites en CI dentro de una tarea autorizada; distinguir gates actuales y controles propuestos.                                 |
| RF-21 | Ejecutar según cambios y criticidad, sin reemplazar los checks obligatorios por selección local.                                        |
| RF-22 | Definir gates contra regresiones críticas y comprobar su implementación antes de afirmar bloqueo automático.                            |

## Requerimientos no funcionales de la fuente

| ID     | Aplicación y criterio verificable                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| RNF-01 | Robustez: detectar defectos del contrato sin romper por cambios internos irrelevantes.                                  |
| RNF-02 | Confiabilidad: tratar tests falsamente satisfactorios, falsamente fallidos e intermitentes.                             |
| RNF-03 | Mantenibilidad: fixtures pequeñas, intención visible y abstracciones que no oculten el escenario.                       |
| RNF-04 | Determinismo: controlar reloj, aleatoriedad, UTC, datos y sesiones bajo condiciones equivalentes.                       |
| RNF-05 | Rendimiento: medir tiempo de feedback y elegir presupuestos compatibles con el trabajo; no imponer tiempos universales. |
| RNF-06 | Escalabilidad: paralelizar sólo con recursos aislados y ampliar escenarios progresivamente.                             |
| RNF-07 | Seguridad: usar datos sintéticos, redactar evidencia y verificar destinos descartables.                                 |
| RNF-08 | Trazabilidad: relacionar escenario, requisito/riesgo y prueba o brecha.                                                 |
| RNF-09 | Auditabilidad: conservar comandos, resultados y cambios relevantes según criticidad.                                    |
| RNF-10 | Adaptabilidad: conservar herramientas compatibles y adoptar otras sólo por necesidad demostrada.                        |
