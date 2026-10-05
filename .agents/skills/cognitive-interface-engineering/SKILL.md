---
name: cognitive-interface-engineering
description: >-
  Diseño y auditoría de flujos comprensibles y accesibles del Testimonial CMS (SKL-UX-PSYCH-001). Usar heurísticas cognitivas como hipótesis verificables para navegación, formularios, moderación, feedback y jerarquía visual; aplicar WCAG 2.2 AA sin métricas inventadas ni sustituir la identidad editorial vigente.
---

# SKL-UX-PSYCH-001 — Interfaces cognitivas

## Propósito y fuentes

Esta skill guía decisiones de comprensión, atención, memoria y prevención de errores. Leer `AGENTS.md`, `llm.txt`, el plan HITL activo, el flujo real en `apps/web/src/features`, el contrato NestJS y las reglas de negocio. Para colores y layout consultar [CSS](../css-architecture-engineering/SKILL.md); para clases, [Tailwind](../tailwind-architecture-engineering/SKILL.md).

| Estado | Uso |
| --- | --- |
| **Vigente** | Next.js 15, React 18, Tailwind 3, Radix, identidad editorial crema/obsidiana/terracota y pantallas de administración/captura pública. |
| **Opción contextual** | Cambios de navegación, revelación progresiva, confirmación o visualización de progreso tras observar un problema concreto. |
| **Migración futura** | Rediseño visual, pruebas de campo/RUM o nuevos flujos que no están implementados; requieren tarea y evidencia propias. |

## Principio de trabajo

Las llamadas “leyes de UX” son heurísticas, no garantías causales ni métricas del producto. Usarlas para formular una hipótesis: qué tarea se dificulta, por qué, qué cambio propuesto ayudaría y cómo se observará si funcionó. Ninguna obliga por sí sola a ocultar acciones, limitar un menú a cierto número, aumentar botones a una medida universal o cambiar la identidad visual.

No afirmar que una intervención mejora conversión, velocidad, recuerdo o satisfacción en un porcentaje sin medición comparable. Tampoco inventar objetivos de milisegundos para toda interacción. Ofrecer feedback tan pronto como el estado real lo permita y medir si la latencia es un problema.

## Proceso breve de diagnóstico

1. Identificar actor, tarea y punto del flujo: admin, editor o visitante público.
2. Leer pantalla, adaptador HTTP y respuesta de API; distinguir error de UX de límite de negocio.
3. Observar una tarea concreta con teclado y ratón/táctil según su uso.
4. Registrar dónde hay duda, error, repetición, pérdida de contexto o acción no descubierta.
5. Seleccionar una heurística que explique el síntoma, sin tratarla como prueba.
6. Proponer el cambio mínimo coherente con el sistema visual y contrato.
7. Verificar con recorrido de tarea, accesibilidad y estados de error.
8. Si se atribuye impacto cuantitativo, registrar muestra, método y baseline.

## Heurísticas útiles por síntoma

| Síntoma observado | Hipótesis útil | Decisión a explorar |
| --- | --- | --- |
| El usuario no reconoce una acción | Familiaridad/Jakob | Usar nombre y ubicación esperables, sin copiar un producto ajeno. |
| Opciones compiten visualmente | Hick-Hyman | Agrupar por tarea; mostrar decisión principal y contexto relevante. |
| Un campo exige recordar un código | Reconocimiento/Miller | Mostrar nombre o referencia del recurso junto al ID. |
| Acciones relacionadas parecen separadas | Proximidad/Gestalt | Agrupar etiqueta, ayuda y control; respetar jerarquía actual. |
| Un estado importante pasa inadvertido | Contraste/Von Restorff | Destacar con texto, posición y color semántico sin hacer todo dominante. |
| Se toca el control equivocado | Fitts | Revisar tamaño, separación y ubicación de objetivos. |
| No queda claro si se guardó | Feedback | Mostrar pendiente, éxito o error según respuesta real de NestJS. |
| Se pierde el contexto tras navegar | Continuidad | Mantener título, filtro o ruta cuando la tarea lo requiere. |

Una heurística puede competir con otra. Por ejemplo, ocultar opciones reduce ruido pero puede ocultar una acción frecuente; decidir con el flujo real y pruebas de descubribilidad.

## Jerarquía visual del producto

La web usa tipografía editorial, fondos crema/oscuro, terracota y geometría predominantemente recta. Crear jerarquía con títulos, espaciado, agrupación, bordes, densidad y estados. No convertir cada pantalla en una CTA redonda o una barra inferior fija por una regla abstracta.

- Priorizar el objetivo de la pantalla en título y acción principal cuando existe.
- Mantener acciones secundarias visibles o localizables, especialmente las de moderación.
- Mostrar estado del testimonio con texto; color solo complementa.
- Separar resultados de controles de filtro y navegación sin fragmentar excesivamente.
- En tablas densas, preservar encabezados y asociación de cada acción con su fila.
- En móvil, revisar orden de lectura y que ningún control quede fuera de alcance o tapado.
- Usar `font-caption` para acento editorial, no para ocultar texto funcional en cursiva decorativa.

## Modelo mental y lenguaje

- Nombrar acciones según consecuencia: “Enviar a moderación”, “Aprobar”, “Publicar”, “Rechazar”.
- Distinguir guardar borrador de publicar; son estados distintos.
- Mostrar una referencia reconocible al testimonio en confirmaciones, no solo UUID.
- Evitar cambiar nombre del mismo recurso entre tabla, detalle y error.
- Redactar errores con causa recuperable y siguiente paso, sin exponer detalles internos.
- No prometer “entregado” para un webhook cuando la API solo confirmó publicación y outbox.
- Mantener el voseo y terminología del producto donde corresponda.

## Navegación y búsqueda

- Un menú no tiene límite universal de siete elementos. Agrupar por tarea y revisar si el usuario encuentra destinos frecuentes.
- Las etiquetas deben distinguir acciones de navegación y de mutación.
- Si un filtro cambia la lista, conservar indicación de filtro activo y modo de limpiarlo.
- Mostrar conteos solo si representan la misma consulta y página; un conteo parcial debe identificarse como tal.
- Preservar contexto de búsqueda al abrir/cerrar detalle si ayuda a comparar testimonios.
- Evitar saltos de foco al actualizar resultados.
- En paginación, indicar página y permitir recuperar una vista vacía tras cambios.
- No usar color como única señal de selección en tabs o chips.

## Formularios y captura pública

1. Pedir solo información necesaria para el contrato de la operación.
2. Agrupar campos por significado y dependencia; no dividir un formulario solo para aumentar pasos.
3. Mostrar ejemplo o ayuda junto al campo que la necesita, no en un bloque distante.
4. Validar pronto cuando reduce errores, sin interrumpir cada pulsación con mensajes cambiantes.
5. Conservar entrada tras error recuperable; indicar qué campos necesitan corrección.
6. Mostrar estado pendiente real y evitar doble envío accidental.
7. No guardar PII en almacenamiento persistente para “comodidad” sin una decisión de producto y privacidad.
8. Al completar, describir qué ocurrió y si hay pasos posteriores de moderación.

Un spinner aislado no indica progreso ni éxito. Usar texto y una respuesta final coherente con el resultado de la API. No introducir demoras artificiales para que una transición parezca “más confiable”.

## Moderación y acciones críticas

La UI debe reflejar las transiciones permitidas por NestJS y las reglas vigentes; no inventar estados por analogía. Las acciones disponibles dependen de estado y rol, pero la API vuelve a validar ambas condiciones. El flujo no debe ocultar una acción crítica solo para reducir cantidad visible.

- Mostrar estado actual y consecuencia de la acción antes de confirmarla cuando es difícil de revertir.
- Diferenciar “Aprobar” de “Publicar”: el efecto público llega en la segunda transición.
- Para “Rechazar”, mostrar el motivo si el contrato lo pide o permite; no forzar uno inexistente.
- Tras 409, explicar que el recurso cambió y ofrecer refrescarlo.
- Tras 403, indicar falta de permiso sin intentar otro tenant o credencial.
- Tras 5xx o red caída, no afirmar fracaso definitivo de una mutación: consultar estado antes de reintentar cuando puede haberse confirmado.
- Una confirmación de publicación no demuestra entrega a destinos webhook; el outbox es asíncrono.
- Ubicar acciones destructivas de modo que no se activen por error junto a controles frecuentes.

## Feedback y estados

| Estado | Señal útil |
| --- | --- |
| Carga | Estructura estable y texto de espera si la duración es perceptible. |
| Vacío | Explicación y siguiente acción permitida. |
| Error validable | Campo, motivo y conservación de entrada. |
| Error de permiso | Denegación clara sin datos ajenos. |
| Conflicto | Estado actualizado y decisión disponible. |
| Éxito | Resultado confirmado por API, sin prometer efectos asíncronos. |

Mostrar feedback con la rapidez que permita el evento real. No fijar “menos de 50/100/400 ms” como requisito universal sin medición y contexto. Un cambio optimista puede ayudar en operaciones reversibles, pero requiere rollback y semántica clara; no usarlo para publicar o moderar si ocultaría un conflicto.

## Accesibilidad de interacción

- Navegar todos los flujos clave con teclado y foco visible.
- Usar `button` para acción, `Link`/`a` para navegación y controles nativos cuando existan.
- Asociar label y error a cada campo; anunciar cambios importantes sin saturar regiones vivas.
- Gestionar foco de diálogo con la primitiva Radix y devolverlo al disparador al cerrar.
- Revisar contraste de texto, iconos esenciales y estados en ambos temas.
- Comprobar zoom y reflow; una tabla con scroll horizontal puede ser válida si conserva contexto y operabilidad.
- No exigir un gesto de arrastre como único medio de ejecutar una acción.
- Respetar reducción de movimiento y evitar animaciones que oculten contenido.

### Objetivos de puntero WCAG 2.2 AA

El criterio [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum) pide un objetivo de al menos **24 × 24 CSS px** para entrada de puntero, salvo excepciones. Un objetivo menor puede cumplir por **separación suficiente**: círculos de 24 CSS px centrados en sus cajas no deben intersectar otros objetivos o círculos de otros objetivos pequeños. También existen excepciones por **control equivalente en la misma página**, **enlace inline o limitado por la línea de texto**, **control cuyo tamaño determina el agente de usuario sin modificación del autor** y **presentación esencial o exigida legalmente**.

No afirmar que WCAG 2.2 AA exige 44 × 44 CSS px en móvil; un objetivo mayor puede ser una buena decisión de usabilidad para una acción frecuente, pero no reemplaza la evaluación del criterio. Medir el área interactiva real, no solo el icono visible. Un padding que aumenta el target puede ayudar sin alterar el lenguaje visual.

## Validación observacional

- Pedir a una persona que complete la tarea sin explicar dónde está el control.
- Anotar errores, dudas y pasos, sin convertir una observación aislada en porcentaje de mejora.
- Comparar una variante con la pantalla actual bajo una tarea y contexto equivalentes.
- Registrar si el cambio afectó accesibilidad, tiempo, precisión o confianza; no prometer que mejora todos.
- Para una métrica de éxito, definir muestra, periodo, evento y fuente antes de reportarla.
- Evitar usar una tasa de clics como único proxy de comprensión: una persona puede clicar por confusión.
- Revisar flujos de recuperación y error, no solo camino feliz.
- Si no hay investigación disponible, tratar la recomendación como hipótesis pendiente de prueba.

## Opciones condicionadas

Revelación progresiva sirve cuando hay parámetros avanzados que la mayoría no necesita durante la tarea principal. No ocultar permisos, consecuencias o acciones críticas. Confirmaciones sirven para actos costosos o difíciles de revertir; no bloquear cada cambio menor con un diálogo. Skeletons ayudan si preservan estructura; una animación constante puede distraer o incumplir preferencia de movimiento reducido. Navegación fija móvil requiere probar que no tapa contenido ni foco.

Un rediseño global de navegación, identidad visual o jerarquía de todo el dashboard es una tarea separada. Esta skill permite ajustar un flujo concreto sin introducir mandatos de tarjetas redondeadas, gradientes o nuevas paletas.

## Decisiones por pantalla

### Lista de testimonios

- Mostrar estado de cada fila en texto, incluso cuando el color refuerce la lectura.
- Ordenar acciones por tarea y riesgo; separar eliminar de abrir detalle o editar.
- Mantener visible qué filtros están activos y cómo volver a la lista completa.
- Si un conteo se calcula sobre la página actual, no presentarlo como total del tenant.
- Al refrescar, conservar foco y contexto para no obligar a recomenzar la tarea.
- La fila debe permitir reconocer autor o extracto antes de una acción.
- En una tabla ancha, asegurar que el control y su fila sigan asociados al desplazar.
- La vista vacía por filtros es distinta de “el tenant aún no tiene testimonios”.

### Detalle y moderación

- Mostrar la etapa actual cerca de las acciones permitidas.
- Dar contexto de contenido/rating antes de “Aprobar” o “Rechazar”.
- Evitar que una acción destructiva quede pegada a una frecuente con iconos similares.
- Explicar el efecto público de “Publicar”; no llamarlo simplemente “Guardar”.
- Si la transición falla por conflicto, ofrecer refrescar estado en lugar de repetir automáticamente.
- Si el diálogo cierra tras éxito, devolver foco a un lugar útil en la lista.
- No ocultar un error de permiso tras un toast genérico que desaparece sin lectura.
- No usar una confirmación que sugiera entrega instantánea del webhook.

### Configuración y API keys

- Diferenciar campos editables de valores de solo lectura con semántica y texto.
- Mostrar alcance de una API key de forma comprensible sin volver a revelar su secreto.
- Ante revocación, explicar qué clientes pueden perder acceso antes de confirmar.
- No presentar un permiso de UI como garantía de que el backend aceptará la operación.
- En listas de destinos webhook, separar URL, estado y última entrega sin mezclar “habilitado” con “entregado”.
- Una validación de URL debe informar el problema sin exponer detalles internos de SSRF.

### Captura pública

- El formulario debe indicar que la publicación puede requerir revisión.
- El visitante necesita saber si el envío se recibió, no el estado interno completo del outbox.
- Ante error, preservar texto y rating si es seguro hacerlo en memoria durante la sesión de pantalla.
- Reducir campos que no son necesarios para el testimonio, según contrato real.
- Evitar una animación de éxito antes de que NestJS confirme la operación.
- Dar salida clara si el slug o tenant público no existe.

## Evaluar una propuesta de cambio

| Pregunta | Evidencia suficiente para decidir |
| --- | --- |
| ¿Qué persona y tarea? | Rol, ruta y objetivo especificados. |
| ¿Qué síntoma existe? | Observación reproducible, error de usuario o señal de soporte. |
| ¿Qué heurística lo explica? | Hipótesis plausible, sin promesa de resultado. |
| ¿Qué cambiará? | Elementos y estados concretos, sin rediseño implícito. |
| ¿Qué puede empeorar? | Descubribilidad, accesibilidad, permisos, densidad o continuidad. |
| ¿Cómo se comprobará? | Recorrido de tarea y estados de éxito/error, con métrica si existe. |

No usar una captura bonita como única prueba de comprensión. Una persona debe poder completar el flujo con datos reales, errores y teclado. Tampoco usar una lista de “leyes” para justificar retrospectivamente cualquier diseño.

## Priorizar sin inventar métricas

- Atender primero errores que publican, eliminan o exponen datos de otro tenant.
- Atender luego bloqueos de tarea, navegación inaccesible y errores sin recuperación.
- Después revisar pasos repetidos, dudas frecuentes y consistencia visual.
- Registrar tiempo o tasa solo si la tarea, muestra y método se mantienen comparables.
- No convertir una opinión de una persona en “mejora del 30 %”.
- No asignar pesos numéricos a heurísticas sin un modelo de evaluación acordado.
- Separar una preferencia estética de un problema de comprensión observado.
- Una acción menos usada puede seguir siendo crítica y merecer visibilidad.

## Revisión de copia y feedback

1. Leer cada título, botón y error como lo vería alguien sin conocimiento del código.
2. Comprobar que los verbos describen resultados, no llamadas HTTP internas.
3. Asegurar que un mensaje de error indique si los datos se conservaron.
4. Separar “no tenés permiso” de “no existe” según el contrato seguro del endpoint.
5. Usar mensajes de espera honestos; no anunciar “sincronizando” si no hay esa operación.
6. Indicar cuándo un cambio es reversible y quién puede revertirlo, si está definido.
7. Evitar culpar al usuario por un conflicto de concurrencia o error de servicio.
8. Probar que el texto cabe con zoom y en pantalla angosta sin cortar la acción.

## Ética y confianza

No usar el efecto de aislamiento visual para dirigir a un plan comercial o permiso que la persona no eligió. No esconder cancelación, rechazos o consecuencias en texto de bajo contraste. No simular escasez o progreso. Una interfaz de prueba social debe distinguir contenido publicado de contenido en revisión y no manipular el testimonio original para aumentar persuasión.

Antes de afirmar que un flujo inspira confianza, comprobar que la copia coincide con el resultado de la API, que no adelanta la entrega de un webhook y que la persona puede corregir un error sin perder su trabajo. Una jerarquía visual atractiva no compensa una consecuencia engañosa.

Al revisar prueba social pública:

- Mostrar únicamente testimonios que la API considera publicados.
- Conservar atribución y contenido según el consentimiento y contrato real.
- Evitar etiquetas de verificación que el sistema no puede sostener.

## Definition of Done

- El flujo usa nombres, estados y consecuencias coherentes con NestJS y las reglas de negocio.
- La jerarquía ayuda a encontrar acciones sin esconder funciones críticas ni contradecir la identidad editorial.
- Carga, error, conflicto y éxito dan feedback honesto y recuperable.
- Teclado, foco, contraste, reflow y objetivos de puntero se verifican según WCAG 2.2 AA y sus excepciones.
- Toda afirmación cuantitativa procede de una medición identificable; las heurísticas se presentan como hipótesis.
- La solución fue revisada en el flujo real, incluidos al menos un error material y la consecuencia de una mutación.
