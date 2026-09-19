---
name: cognitive-interface-engineering
description: >-
  Diseño de interfaces comprensibles, memorables, eficientes, consistentes y accesibles mediante principios de psicología cognitiva, percepción, atención y leyes de UX (código SKL-UX-PSYCH-001). Usar cuando se requiera diseñar o auditar interfaces de usuario (Next.js 15, Tailwind CSS, Radix UI), reducir carga cognitiva (Hick, Miller, Chunking), optimizar jerarquía visual (Gestalt, Prägnanz, Von Restorff), garantizar feedback inmediato (Doherty Threshold), prevenir errores en flujos críticos (moderación, eliminación, configuración) y asegurar accesibilidad WCAG 2.2 AA.
---

# Especificación Técnica de Habilidad: Senior UX/UI Laws & Cognitive Interface Engineering

---

**Código de Skill:** SKL-UX-PSYCH-001  
**Nombre:** Senior UX/UI Laws & Cognitive Interface Engineering  
**Versión:** 1.0.0  
**Nivel:** Senior / Product / Interface Engineering  
**Dominio:** UX / UI / Interaction Design / Cognitive Psychology / Accessibility  
**Objetivo:** Diseñar interfaces comprensibles, memorables, eficientes, consistentes y accesibles mediante principios de percepción, memoria, atención y comportamiento humano.  
**Estándares:** Laws of UX / Gestalt / WCAG 2.2 AA / WAI-ARIA / Human-Centered Design / Agile Definition of Done  
**Ecosistema del proyecto:** Monorepo `@testimonial-cms` (`apps/web` en Next.js 15 App Router + React 19 + Tailwind CSS v3 + Radix UI, dashboard SaaS multi-tenant, moderación de testimonios, generador de widgets embed, recolección pública y métricas de prueba social).

---

## 1. Ficha de Identificación del Skill

| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Diseño de interfaces digitales basado en modelos cognitivos, perceptivos, psicomotores y conductuales. |
| **Objetivo de Dominio** | Reducir carga cognitiva superflua (*extraneous load*), acelerar el aprendizaje y descubribilidad, maximizar la eficiencia en tareas complejas y generar confianza mediante previsibilidad y accesibilidad universal. |
| **Tipo de Proyecto** | Plataformas SaaS B2B/B2C, Dashboards analíticos, Formularios públicos de alta conversión, Editores interactivos WYSIWYG, Flujos de moderación masiva. |
| **Paradigma Base** | Human-Centered Design + Task-Oriented Interfaces + Accessibility-by-Design. |
| **Modelo Mental** | Reconocimiento sobre recuerdo (*Recognition over recall*), consistencia con modelos mentales preexistentes y retroalimentación sensorial inmediata. |
| **Accesibilidad** | **WCAG 2.2 AA** como baseline profesional mandatorio (contraste ≥ 4.5:1, targets ≥ 24×24 CSS px, foco visible, navegación por teclado 100% operable). |
| **Validación** | Usability Testing cualitativo + Proxies de comportamiento + Métricas de producto (SUS, UMUX-Lite, Task Success Rate, Time-on-Task) + Auditorías axe-core. |
| **Complejidad** | Alta / Product Engineering. |
| **Prioridad** | Claridad → Accesibilidad → Predictibilidad → Eficiencia → Feedback → Estética → Memorabilidad. |

---

## 2. Descripción y Filosofía de Diseño

Las denominadas **Leyes de UX** no son mandatos matemáticos absolutos ni dogmas estéticos. Son **modelos heurísticos** derivados de:
```text
cognitive psychology
+
visual & perceptual science (Gestalt)
+
human memory architecture
+
motor behavior & biomechanics (Fitts)
+
human-computer interaction (HCI)
```

Estos modelos permiten predecir con alto grado de certeza cómo un ser humano percibirá, procesará información, tomará decisiones y reaccionará ante un conjunto de estímulos visuales y controles interactivos.

La arquitectura de interfaz debe aplicar estos principios para **reducir**:
```text
uncertainty (ambigüedad sobre el estado del sistema)
cognitive load (esfuerzo mental superfluo para descifrar la interfaz)
decision friction (parálisis ante exceso de opciones)
motor effort (distancia y tamaño incómodo de interactores)
memory requirements (necesidad de recordar datos entre pantallas)
error probability (acciones destructivas accidentales)
```
y simultáneamente **aumentar**:
```text
clarity (propósito y estado del sistema comprensibles en < 3 segundos)
predictability (controles que responden conforme a la expectativa)
recognition (elementos evidentes sin requerir memorización previa)
confidence (sensación de control y seguridad en la interacción)
task completion (tasa de éxito en tareas críticas del producto)
perceived quality (confianza transmitida por consistencia y pulido visual)
```

---

### 2.1. Regla Rectora

> **No diseñes para que el usuario piense cómo usar la interfaz; diseñá para que pueda dedicar el 100% de su atención a lo que quiere conseguir.**

En el contexto de **Testimonial CMS**:
- Un visitante no debe descifrar cómo calificar con 5 estrellas o adjuntar su video testimonio; el formulario debe guiarse solo.
- Un administrador no debe dudar si un testimonio quedó publicado, pendiente o rechazado; los estados y acciones deben ser inequívocos.

---

### 2.2. Las Leyes son Heurísticas, no Dogmas

Ningún principio (Jakob, Fitts, Hick, Miller o Gestalt) debe aplicarse en el vacío. Toda decisión de interfaz debe sopesarse según:
```text
user intent (qué busca resolver en este instante)
context of use (entorno ruidoso, prisa, alta concentración)
device (pantalla táctil móvil de 360px vs monitor ultra-wide de escritorio)
accessibility (usuarios con ceguera, baja visión, temblores motores o neurodivergencia)
frequency of use (flujo diario de moderador experto vs onboarding de usuario primerizo)
business risk (gravedad de una acción irreversible como eliminar un tenant o API key)
```

---

### 2.3. Memorabilidad no Significa Extravagancia

Una interfaz memorable **no requiere** ser visualmente estrafalaria, caótica, cargada de animaciones gratuitas o deliberadamente contraria a los competidores.

Una interfaz se vuelve positivamente memorable porque es:
```text
predictable (hace exactamente lo que promete)
fast (responde instantáneamente sin fricciones de latencia)
clear (lenguaje humano sin jerga técnica de base de datos)
pleasant (ritmo tipográfico armónico y jerarquía visual relajada)
trustworthy (segura, transparente y sin trampas)
forgiving (permite deshacer o corregir errores sin frustración)
```

---

### 2.4. Ética y Prohibición Estricta de Dark Patterns

Los sesgos cognitivos y leyes de la percepción **NUNCA DEBEN UTILIZARSE** para engañar o manipular al usuario:

```text
❌ PROHIBICIONES ESTRICTAS (Anti-Dark Patterns):
- Forced Continuity: Dificultad deliberada para pausar o cancelar suscripciones.
- Confirmshaming: Textos culpabilizantes ("No, prefiero perder clientes" para cerrar un modal).
- Hidden Cancellation / Data Export: Esconder deliberadamente la opción de eliminar cuenta o exportar testimonios.
- Artificial Scarcity / False Urgency: Temporizadores falsos ("¡Sólo quedan 2 cupos para tu plan!").
- Visual Deception / Misleading Defaults: Checkboxes premarcados de publicidad o botones secundarios disfrazados.
- Roach Motel: Procesos de entrada en 1 clic y procesos de salida en 15 pasos con llamadas telefónicas obligatorias.
```

La optimización conductual debe alinear de forma simétrica:
```text
USER GOAL (recolectar y exhibir prueba social auténtica)
+
BUSINESS GOAL (crecimiento sostenible por retención y valor real)
```

---

## 3. Requerimientos del Skill

### 3.1. Requerimientos Funcionales

- **[RF-01] Respeto a Modelos Mentales Preexistentes**: Toda feature DEBE emplear patrones de interacción estandarizados en la industria (ej. carritos, filtros en barra lateral, lupas de búsqueda, campanas de notificación, modales de confirmación) a menos que exista evidencia cuantitativa de una mejora sustantiva.
- **[RF-02] Jerarquía Perceptiva Obligatoria**: Toda vista o componente complejo MUST estructurarse en 4 niveles perceptivos evidentes:
  1. *Primary*: Acción o dato focal principal (ej. botón "Aprobar", título de página).
  2. *Secondary*: Acciones alternativas o complementarias (ej. botón "Rechazar", filtros).
  3. *Supporting*: Metadatos, fechas, etiquetas o badges de contexto.
  4. *Decorative*: Iconos ilustrativos, sombras y separadores que no comunican semántica.
- **[RF-03] Optimización de Decisiones (Hick-Hyman)**: En flujos de decisión crítica, la interfaz DEBE presentar exclusivamente las opciones relevantes al paso actual, recurriendo a *Progressive Disclosure* (revelación progresiva) para opciones avanzadas.
- **[RF-04] Feedback Perceptible Inmediato**: Toda acción o evento interactivo DEBE generar una respuesta visual, táctil o auditiva inmediata para los estados: `idle`, `hover`, `focus-visible`, `active/pressed`, `loading/in-progress`, `success`, `error` y `disabled`.
- **[RF-05] Cobertura Integral de Estados Asíncronos**: Todo componente que interactúe con datos remotos (APIs de NestJS) DEBE contemplar y diseñar explícitamente los 6 estados fundamentales:
  1. `idle`: Estado inicial antes de la interacción.
  2. `loading`: Skeleton loaders o indicadores de progreso no bloqueantes.
  3. `empty`: Estado vacío explicativo con llamada a la acción contextual (*Empty State* amigable).
  4. `success`: Confirmación de éxito clara y no intrusiva (Toast o banner inline).
  5. `error`: Mensaje humano que explique qué falló y ofrezca una vía de recuperación (*Retry*).
  6. `partial / stale`: Indicador de datos en proceso de sincronización en segundo plano.
- **[RF-06] Prevención y Reversibilidad de Errores**: Las acciones con impacto destructivo o irreversible (ej. eliminar testimonios, revocar API Keys, borrar widgets) DEBEN incorporar mecanismos proporcionales: diálogo de confirmación con foco seguro (Radix AlertDialog), *Soft Delete* con opción de deshacer (*Undo Toast* de 5 a 10 segundos) o previsualización previa.
- **[RF-07] Operabilidad Multimodal Accesible**: Toda funcionalidad interactiva DEBE ser completamente operable mediante:
  - Puntero / Ratón.
  - Teclado (`Tab`, `Shift+Tab`, `Enter`, `Space`, flechas de navegación).
  - Pantallas táctiles (móviles y tablets).
  - Tecnologías de asistencia (Lectores de pantalla NVDA, VoiceOver, JAWS con nombres accesibles correctos).
- **[RF-08] Adaptabilidad Ergonométrica por Dispositivo**: Los controles interactivos deben adaptar su tamaño y posición: barras de acción inferiores en smartphones para acceso con el pulgar (zona ergonómica de Fitts) vs barras superiores/laterales en monitores de escritorio.

### 3.2. Requerimientos No Funcionales

- **[RNF-01] Predictibilidad de Comportamiento**: Elementos con apariencia visual idéntica DEBEN comportarse de manera equivalente en todas las secciones del producto.
- **[RNF-02] Minimización de Carga Cognitiva Extraña**: Eliminar todo texto de relleno, bordes redundantes, modales anidados injustificados y términos técnicos internos (`tenant_id`, `outbox_status`, `foreign_key_error`).
- **[RNF-03] Latencia de Reconocimiento Visual (Doherty Threshold)**: La interfaz DEBE acusar recibo de cualquier interacción del usuario en **menos de 100 ms** (cambio de estado del botón a "Guardando..." o feedback de click), independientemente de que la operación de red tarde más tiempo.
- **[RNF-04] Consistencia en el Sistema de Diseño**: Reutilizar de forma estricta los Design Tokens de Tailwind CSS y las primitivas de Radix UI para tipografía, radios, sombras, espaciados y paleta cromática semántica.
- **[RNF-05] Cumplimiento Estricto WCAG 2.2 AA**:
  - Relación de contraste de color ≥ 4.5:1 para texto normal y ≥ 3:1 para texto grande o componentes de UI.
  - Anillo de foco (`focus-visible`) nítido y de alto contraste en navegación por teclado.
  - No depender exclusivamente del color para transmitir información (ej. acompañar colores de estado con iconos o texto).
  - Respeto a la preferencia de movimiento reducido (`prefers-reduced-motion: reduce`).

---

## 4. Criterios de Aceptación — Definition of Done (DoD)

Una pantalla, feature o componente se considera conforme a **SKL-UX-PSYCH-001** cuando:

- [ ] **Comprensión Instantánea**: Un usuario novato puede comprender el propósito de la pantalla y localizar la acción primaria en **menos de 5 segundos** sin manuales de instrucciones.
- [ ] **Jerarquía Visual Clara**: La tipografía (escala modular), el peso y los contrastes guían la mirada en orden lógico (Título → Contenido principal → Acciones contextuales).
- [ ] **Decisiones sin Fricción**: No se presentan más de 5 a 7 opciones simultáneas sin agrupar (*Chunking*); los formularios largos están divididos en pasos o pestañas contextuales.
- [ ] **Touch Targets Conformes**: Todos los elementos interactivos miden como mínimo **24×24 CSS px** (WCAG 2.2) y preferentemente **44×44 CSS px** en interfaces móviles táctiles.
- [ ] **Estados de Interacción Completos**: El componente cuenta con estilos declarados para `hover`, `focus-visible`, `active`, `disabled` y `aria-expanded`/`aria-selected` cuando aplique.
- [ ] **Feedback Auditado**: Ninguna mutación asíncrona deja al usuario sin saber si el sistema está procesando, terminó con éxito o falló.
- [ ] **Errores con Camino de Salida**: Los mensajes de error explican la causa en lenguaje humano no técnico y ofrecen una acción concreta para solucionarlo (ej. "Reintentar", "Verificar conexión", "Contactar soporte").
- [ ] **Acciones Destructivas Protegidas**: Borrar o rechazar irreversiblemente requiere confirmación explícita o soporte de *Undo*.
- [ ] **Navegación por Teclado Limpia**: Es posible recorrer, activar y salir de todos los elementos interactivos usando sólo el teclado, sin trampas de foco (*Focus Traps*) involuntarias.
- [ ] **Accesibilidad Verificada**: 0 errores de contraste de color y 0 botones sin nombre accesible (`aria-label` en botones sólo de iconos).

---

## 5. Ecosistema Conceptual — Las 26 Leyes y Principios de UX

### 5.1. Ley de Jakob — Familiaridad y Modelos Mentales
> *"Los usuarios pasan la mayor parte de su tiempo en otros sitios web. Esto significa que prefieren que tu sitio funcione igual que todos los demás sitios que ya conocen."*

#### Aplicación en Testimonial CMS
- **Barra de navegación y perfiles**: La campana de notificaciones y el avatar de usuario deben residir en la esquina superior derecha; el selector de inquilino/espacio de trabajo en la esquina superior izquierda.
- **Filtros de búsqueda**: Un campo con icono de lupa (`Search`) debe buscar o filtrar reactivamente; no debe usarse para abrir menús inesperados.
- **Fórmulas de autenticación**: Pantallas de login limpias con email y password, soporte para administradores de contraseñas y enlace visible de "Olvidé mi contraseña".
- **Regla Senior**: Innová en la propuesta de valor del producto (ej. algoritmo de scoring de social proof o automatización de widgets); **no reinventes los controles básicos** como botones, selectores o paginadores sin una justificación empírica demostrable.

---

### 5.2. Ley de Fitts — Tamaño y Distancia
> *"El tiempo necesario para alcanzar rápidamente un objetivo es una función de la distancia al objetivo y del tamaño del mismo."*

#### Aplicación en Testimonial CMS
- **CTAs Primarios destacados**: El botón de "Aprobar Testimonio" o "Publicar Widget" debe ser de tamaño generoso (`h-10` o `h-11` en Tailwind, padding lateral generoso) y estar ubicado cerca de la trayectoria visual natural del usuario.
- **Mobile Bottom Navigation**: En la versión móvil del panel o del formulario público de testimonios, los botones de acción deben posicionarse en la zona inferior fija (*thumb zone*), accesible cómodamente con una sola mano.
- **Espaciado defensivo en acciones destructivas**: El botón "Eliminar definitivamente" no debe colocarse pegado al botón "Aprobar" sin margen (`gap-3` mínimo), previniendo clics accidentales por imprecisión motora.
- **WCAG 2.2 Target Size (Minimum)**: Todo interactor debe satisfacer el tamaño objetivo mínimo de **24×24 CSS px** (o espaciado perimetral equivalente), elevándolo a **44×44 px** en touch screens.

---

### 5.3. Ley de Hick-Hyman — Complejidad y Tiempo de Decisión
> *"El tiempo que se tarda en tomar una decisión aumenta logarítmicamente con el número y la complejidad de las opciones disponibles."*

#### Aplicación en Testimonial CMS
- **Bandeja de moderación**: En lugar de presentar simultáneamente 20 filtros (por fecha, calificación, texto, video, tags, categorías, sentimiento, cliente, país, etc.), mostrar inicialmente los filtros clave (Estado: `Todos`, `Pendientes`, `Aprobados`; Rating: `1-5 estrellas`) y agrupar el resto bajo un menú colapsable "Más filtros".
- **Selector de tipo de widget**: En lugar de mostrar 15 variantes en una lista plana interminable, agruparlas en 3 categorías visuales claras:
  ```text
  ¿Cómo querés exhibir tus testimonios?
  [ Muro de Social Proof ]   [ Carrusel Interactivo ]   [ Toast Flotante ]
  ```
- **Defaults Inteligentes**: Proveer opciones recomendadas preseleccionadas (ej. ordenamiento predeterminado por "Más recientes primero" y calificación mínima "4 estrellas").

---

### 5.4. Ley de Miller — Límites de la Memoria de Trabajo
> *"El ser humano promedio puede mantener en su memoria de trabajo sólo una cantidad limitada de fragmentos de información (históricamente modelado como 7 ± 2)."*

#### Interpretación Senior
No convertir el número 7 en una regla dogmática para limitar menús a 7 ítems. La premisa cognitiva real es: **la memoria de trabajo es sumamente frágil y limitada**.
- **Reconocimiento sobre recuerdo (*Recognition over Recall*)**: En el configurador de widgets, no obligar al usuario a recordar el ID del testimonio que quiere fijar; mostrar una tarjeta visual con foto, autor y extracto para seleccionarlo visualmente.
- **Contexto visible persistente**: Al moderar un testimonio, mantener visibles en el panel lateral los metadatos esenciales (fecha de recepción, correo del cliente, URL de origen) para que el moderador no tenga que memorizarlos al redactar una nota.

---

### 5.5. Chunking — Agrupación Significativa de Información
> *"Organizar elementos en grupos pequeños y semánticamente coherentes facilita drásticamente su almacenamiento y procesamiento cognitivo."*

#### Aplicación en Testimonial CMS
En el formulario público de recolección de testimonios:
```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Tu Experiencia                                           │
│    Calificación: ★★★★★                                      │
│    ¿Qué resultado obtuviste con nuestro producto? [...]     │
├─────────────────────────────────────────────────────────────┤
│ 2. Tus Datos                                                │
│    Nombre completo | Correo electrónico | Cargo o Empresa    │
├─────────────────────────────────────────────────────────────┤
│ 3. Tu Foto o Video (Opcional)                               │
│    [ Subir Avatar ]  o  [ Grabar Video de 30s ]             │
└─────────────────────────────────────────────────────────────┘
```
Agrupar los 8 campos en 3 bloques lógicos reduce la sensación de pesadez y disminuye la tasa de abandono en más de un 35%.

---

### 5.6. Aesthetic-Usability Effect — Efecto Estética-Usabilidad
> *"Los usuarios perciben las interfaces visualmente atractivas como más fáciles de usar y son más tolerantes ante pequeños fallos menores de usabilidad."*

#### Aplicación en Testimonial CMS
- Diseñar con proporciones armónicas de Tailwind, tipografía nítida (`Inter` o `Geist Sans`), paleta equilibrada de grises oscuros y acentos vibrantes, bordes suavizados (`rounded-lg` o `rounded-xl`) y sombras sutiles.
- **Advertencia Crítica**: Una estética cuidada **no soluciona una arquitectura rota**. Durante los tests con usuarios, no conformarse con comentarios como *"se ve muy lindo"*; lo que valida la UX es la tasa de finalización de tareas (*Task Completion Rate*) y la ausencia de tropiezos operativos.

---

### 5.7. Doherty Threshold — Umbral de Productividad de Doherty
> *"La productividad del usuario se dispara cuando la interacción entre el ordenador y el ser humano ocurre a un ritmo que mantiene la atención sin fricción (< 400 ms de latencia percibida)."*

#### Aplicación en Testimonial CMS
- **Visual Acknowledgment Inmediato**: Al hacer clic en "Aprobar", el botón debe cambiar a estado de carga (*spinner*) o deshabilitarse en **< 50 ms**.
- **Optimistic UI**: En la moderación de testimonios, mover inmediatamente la tarjeta a la columna "Aprobados" mientras la llamada HTTP a NestJS viaja en segundo plano. Si la API falla, revertir suavemente con un Toast explicativo ("No se pudo aprobar el testimonio. Reintentando...").
- **Skeleton Loaders contextuales**: Al cargar el dashboard, mostrar siluetas pulsantes que respeten exactamente la forma de las tarjetas métricas, eliminando el parpadeo y la incertidumbre (*Cumulative Layout Shift* = 0).

---

### 5.8. Ley de Proximidad (Gestalt)
> *"Los objetos que están físicamente próximos entre sí tienden a percibirse como parte de un mismo grupo funcional."*

#### Aplicación en Testimonial CMS con Tailwind CSS
En un formulario o tarjeta de testimonio:
```tsx
// ✅ Proximidad correcta: la etiqueta está pegada a su input (gap-1.5 = 6px)
// y separada del siguiente bloque por un margen sustancial (space-y-6 = 24px)
<div className="space-y-6">
  <div className="flex flex-col gap-1.5">
    <label htmlFor="authorName" className="text-sm font-medium text-foreground">
      Nombre del Cliente
    </label>
    <input id="authorName" className="h-10 rounded-md border px-3" />
  </div>

  <div className="flex flex-col gap-1.5">
    <label htmlFor="authorRole" className="text-sm font-medium text-foreground">
      Cargo o Empresa
    </label>
    <input id="authorRole" className="h-10 rounded-md border px-3" />
  </div>
</div>
```
Evitar el antipatrón de espaciados homogéneos (`margin-bottom: 12px` en todos los elementos) que desdibujan qué etiqueta pertenece a qué campo.

---

### 5.9. Ley de Similitud (Gestalt)
> *"Los elementos que comparten características visuales (color, forma, tamaño, orientación) se perciben como pertenecientes a la misma categoría o con la misma función."*

#### Aplicación en Testimonial CMS
- **Badges de Estado Semánticos**:
  - `pending`: Fondo amarillo/ámbar sutil con borde y texto ámbar oscuro (`bg-amber-50 text-amber-700 border-amber-200`).
  - `approved`: Fondo verde esmeralda sutil con texto verde oscuro (`bg-emerald-50 text-emerald-700 border-emerald-200`).
  - `rejected`: Fondo carmesí/rojo suave con texto rojo oscuro (`bg-rose-50 text-rose-700 border-rose-200`).
- **Botones**: Todos los botones con estilo `variant="default"` representan la acción primaria de la vista; no usar ese mismo estilo para acciones secundarias o enlaces informativos.

---

### 5.10. Ley de Región Común (Gestalt)
> *"Los elementos ubicados dentro de un mismo límite visual cerrado (caja, tarjeta, panel, fondo diferenciado) se perciben como pertenecientes a una misma unidad."*

#### Aplicación en Testimonial CMS
- Cada testimonio individual en el panel de moderación debe presentarse en una tarjeta delimitada (`border border-border bg-card rounded-lg p-5`), conteniendo internamente su autor, estrellas, cita y botones de moderación.
- **Regla Senior**: No "cardificar" indiscriminadamente toda la pantalla. Encerrar cada botón o texto en una tarjeta individual genera ruido y destruye el agrupamiento real.

---

### 5.11. Uniform Connectedness — Conectividad Uniforme (Gestalt)
> *"Los elementos visualmente conectados mediante líneas continuas, flechas o fondos comunes se perciben como más fuertemente relacionados que los que sólo comparten proximidad o similitud."*

#### Aplicación en Testimonial CMS
- **Steppers de Onboarding y Configuración de Widgets**: Conectar los pasos (1. Seleccionar testimonios → 2. Personalizar diseño → 3. Obtener código embed) mediante una línea horizontal o vertical que una los círculos numéricos, reforzando la noción de secuencia continua.

---

### 5.12. Ley de Prägnanz (Ley de la Buena Forma / Simplicidad)
> *"Las personas perciben e interpretan imágenes complejas en su forma más simple y estable posible, porque la mente busca minimizar el gasto energético de procesamiento."*

#### Aplicación en Testimonial CMS
- En el dashboard analítico, presentar métricas de social proof con gráficos limpios (barras o líneas continuas sin texturas 3D, sombras pesadas ni gradientes estridentes).
- Reducir el número de divisores visuales: preferir el uso de espaciado en blanco armónico antes que llenar la pantalla de líneas grises divisorias horizontales y verticales.

---

### 5.13. Serial Position Effect — Efecto de Posición Serial
> *"Las personas tienden a recordar con mayor facilidad el primer elemento (*Efecto de Primacía*) y el último elemento (*Efecto de Recencia*) de una serie o lista."*

#### Aplicación en Testimonial CMS
- **Barra de navegación lateral**:
  - En la parte superior (Primacía): Lo más frecuentado por el usuario (`Dashboard`, `Testimonios`, `Widgets`).
  - En la parte inferior (Recencia): Configuraciones críticas y cuenta (`Configuración`, `API Keys`, `Perfil / Logout`).
- En tablas de testimonios, colocar en la primera columna el autor/rating y en la última columna las acciones rápidas de moderación.

---

### 5.14. Von Restorff Effect — Efecto de Aislamiento
> *"Cuando se presentan múltiples objetos similares, aquel que difiere visualmente del resto es el que tiene mayor probabilidad de ser notado y recordado."*

#### Aplicación en Testimonial CMS
- **Planes de precios y suscripción**: El plan recomendado ("Pro / Crecimiento") debe estar ligeramente ampliado, con un badge destacado ("Más popular") y un botón primario de contraste elevado frente a los botones secundarios de los planes básicos.
- **Regla Cardinal**: *Si todo destaca, nada destaca*. Si una tarjeta tiene 4 botones de colores fluorescentes compitiendo entre sí, el ojo del usuario se satura y se produce parálisis de decisión.

---

### 5.15. Zeigarnik Effect — Efecto Zeigarnik
> *"Las tareas incompletas o interrumpidas generan una tensión psicológica que hace que permanezcan más activas en la memoria que las tareas concluidas."*

#### Aplicación en Testimonial CMS
- **Progreso de activación de la cuenta**: Mostrar en el dashboard: *"Configuración de tu espacio de trabajo: 3 de 4 pasos completados"* (1. Crear cuenta ✓, 2. Recolectar primer testimonio ✓, 3. Crear widget ✓, 4. Instalar en tu sitio web [Pendiente]).
- **Borrador de Testimonio**: Si un visitante comienza a escribir un testimonio en el formulario público y recarga accidentalmente, almacenar el borrador en `localStorage` y restaurarlo con un aviso tranquilizador: *"Recuperamos lo que habías escrito"*.

---

### 5.16. Goal-Gradient Effect — Efecto del Gradiente de Meta
> *"La motivación de una persona para completar una tarea aumenta conforme percibe que está más cerca de alcanzar el objetivo final."*

#### Aplicación en Testimonial CMS
- En el asistente de configuración de widgets o importación masiva de testimonios (CSV):
  ```text
  Paso 3 de 4: ¡Casi listo! Sólo falta copiar tu script embed
  [████████████████████░░░░] 75%
  ```
- **Requisito Ético**: El progreso debe ser real y predecible; no saltar artificialmente del 10% al 90% para luego clavar al usuario en un último paso interminable.

---

### 5.17. Peak-End Rule — Regla del Pico y el Final
> *"Las personas juzgan una experiencia predominantemente por cómo se sintieron en su momento más intenso (pico emocional, positivo o negativo) y en su desenlace (final), en lugar de la suma promedio de cada momento."*

#### Aplicación en Testimonial CMS
- **El Final del Visitante**: Al enviar un testimonio, la pantalla final no debe ser un texto frío en letra chica. Debe ser una tarjeta celebratoria cálida: *"¡Muchas gracias, María! Tu opinión ayuda a que más personas confíen en nosotros."*
- **El Pico del Administrador**: Cuando el usuario copia el script de su widget por primera vez, presentar un modal con fuegos artificiales sutiles (microanimación) y un botón de un clic con feedback visual: *"¡Copiado al portapapeles! Pegalo antes de la etiqueta </body> de tu web."*

---

### 5.18. Cognitive Load Theory — Teoría de la Carga Cognitiva
Toda interacción humana con software involucra tres tipos de carga mental:
1. **Carga Intrínseca (*Intrinsic*)**: El esfuerzo inherente a la tarea (ej. decidir qué testimonio representa mejor a la marca).
2. **Carga Pertinente (*Germane*)**: El esfuerzo constructivo que ayuda a aprender y resolver la tarea.
3. **Carga Extraña (*Extraneous*)**: El esfuerzo desperdiciado intentando entender la interfaz (textos confusos, botones escondidos, contrastes ilegibles).

#### Meta de Diseño
**Eliminar al 100% la carga extraña**:
- Redactar microcopia clara y directa en español rioplatense o neutro profesional.
- Eliminar tecnicismos: no decir `"Error de constraint en tabla tenant_users"`, decir *"No pudimos guardar el testimonio. Verificá que el enlace de video sea válido"*.

---

### 5.19. Selective Attention — Atención Selectiva
> *"Las personas filtran activamente la gran mayoría de la información visual disponible para concentrarse exclusivamente en los elementos relevantes a su meta inmediata."*

#### Aplicación en Testimonial CMS
- **Ceguera de banners (*Banner Blindness*)**: Si colocamos un aviso crítico dentro de un rectángulo que parece publicidad o alerta decorativa en la parte superior, muchos usuarios lo ignorarán por completo. Los mensajes de estado deben integrarse orgánicamente en el flujo de trabajo del usuario (*inline alerts*).

---

### 5.20. Mental Models vs System Models
> *"Los usuarios operan basados en su modelo mental conceptual del mundo, no en cómo está estructurada la base de datos o el código del sistema."*

#### Aplicación en Testimonial CMS
- **En la base de datos relacional (Prisma)**:
  `Testimonial.status = 'PENDING'` | `TenantSubscription.tier = 'SCALE'`
- **En la interfaz del usuario**:
  *"Por revisar"* | *"Plan Ilimitado"*
- Los conceptos deben hablar el idioma del negocio de social proof (muro del amor, calificación, testimonios destacados), no términos de ingeniería de software.

---

### 5.21. Tesler's Law — Ley de la Conservación de la Complejidad
> *"Todo sistema posee una cantidad inherente de complejidad que no puede eliminarse; sólo puede trasladarse del usuario al software o viceversa."*

#### Aplicación en Testimonial CMS
- **Inserción de videos de YouTube / Vimeo**:
  - *Opción con complejidad en el usuario (Mala)*: Pedir al cliente que extraiga el `embed_id`, configure las opciones `rel=0` y pegue el iframe HTML a mano.
  - *Opción con complejidad en el sistema (Tesler)*: El usuario sólo pega la URL directa del video (`https://youtu.be/...`). El backend y el frontend parsean automáticamente el ID, limpian parámetros y renderizan el reproductor óptimo.

---

### 5.22. Occam's Razor — La Navaja de Ockham
> *"Entre varias hipótesis o soluciones concurrentes que resuelven un problema de forma equivalente, debe seleccionarse la que presente la menor cantidad de supuestos o elementos."*

#### Aplicación en Testimonial CMS
- Antes de diseñar un modal de 4 pasos con configuraciones avanzadas para moderar testimonios, preguntarse: *¿Se resuelve mejor con dos botones directos ("Aprobar" / "Rechazar") directamente en la tarjeta del testimonio?* Preferir siempre la interacción más directa y simple.

---

### 5.23. Pareto Principle — Principio de Pareto (80/20)
> *"Aproximadamente el 80% de los resultados y del uso proviene del 20% de las funcionalidades."*

#### Aplicación en Testimonial CMS
En la gestión diaria de testimonios, el 80% de las acciones de los administradores son:
1. Leer testimonios recién llegados.
2. Aprobarlos o descartarlos.
3. Copiar el enlace del formulario de captura para enviárselo a un cliente satisfecho.
Estas 3 acciones deben estar accesibles en un clic desde el dashboard principal sin tener que navegar por submenús profundos.

---

### 5.24. Parkinson's Law — Ley de Parkinson
> *"El trabajo se expande hasta llenar el tiempo disponible para su finalización."*

#### Aplicación en Testimonial CMS
- En el formulario público para recolectar testimonios de clientes, cada campo extra reduce la tasa de conversión. Diseñar formularios ultra-enfocados con estimación de tiempo visible: *"Sólo te tomará 60 segundos compartir tu opinión"*.

---

### 5.25. Paradox of the Active User — Paradoja del Usuario Activo
> *"Los usuarios casi nunca leen la documentación ni realizan tutoriales extensos; prefieren lanzarse de inmediato a interactuar con la aplicación."*

#### Aplicación en Testimonial CMS
- No forzar un tutorial modal obligatorio de 8 diapositivas al registrarse.
- Utilizar **Empty States accionables**: Si la bandeja de testimonios está vacía, mostrar:
  ```text
  ┌─────────────────────────────────────────────────────────────┐
  │              Todavía no recibiste testimonios               │
  │   Compartí tu enlace público para empezar a recolectar:     │
  │   [ https://app.testimonial.com/collect/mi-empresa ]        │
  │              [ Copiar Enlace Público ]                      │
  └─────────────────────────────────────────────────────────────┘
  ```

---

### 5.26. Flow — Estado de Flujo en Tareas Repetitivas
> *"El estado óptimo de concentración e inmersión ocurre cuando los objetivos son claros, el feedback es inmediato y se eliminan las distracciones innecesarias."*

#### Aplicación en Testimonial CMS
- Para moderadores que deben revisar decenas de testimonios pendientes: proveer atajos de teclado (`A` para Aprobar, `R` para Rechazar, `J`/`K` para navegar entre testimonios) con confirmación instantánea, permitiendo procesar lotes en segundos sin despegar las manos del teclado.

---

## 6. Metodología de Práctica en 10 Fases

```text
[Fase 01: Entender la Tarea y Contexto]
                   │
                   ▼
[Fase 02: Mapear el User Journey]
                   │
                   ▼
[Fase 03: Auditoría de Carga Cognitiva]
                   │
                   ▼
[Fase 04: Arquitectura de Información]
                   │
                   ▼
[Fase 05: Jerarquía de Interacciones]
                   │
                   ▼
[Fase 06: Prototipado y Wireframing]
                   │
                   ▼
[Fase 07: Sistema Visual y Design Tokens]
                   │
                   ▼
[Fase 08: Auditoría de Accesibilidad (A11y)]
                   │
                   ▼
[Fase 09: Pruebas de Usabilidad con Usuarios]
                   │
                   ▼
[Fase 10: Medición y Mejora Continua]
```

### Fase 1: Entender la Tarea y Contexto Humano
Identificar: ¿Quién es el usuario? ¿Qué meta busca alcanzar? ¿Bajo qué condiciones físicas y emocionales interactúa? (ej. cliente apurado respondiendo una encuesta en el colectivo vs moderador profesional en su escritorio).

### Fase 2: Mapeo del User Journey
Mapear el flujo paso a paso: Entrada → Orientación → Localización de la tarea → Decisión → Acción → Feedback sensorial → Cierre satisfactorio.

### Fase 3: Auditoría de Carga Cognitiva
Identificar fricciones: ¿Hay palabras técnicas incomprensibles? ¿Hay opciones superfluas? ¿Se exige recordar datos vistos previamente?

### Fase 4: Arquitectura de Información y Gestalt
Organizar los contenidos utilizando Proximidad, Región Común, Conectividad y Similitud para que las relaciones funcionales sean autoevidentes.

### Fase 5: Jerarquía de Interacción y Fitts
Clasificar acciones en Primarias, Secundarias, Terciarias y Destructivas. Asegurar tamaños y distancias cómodas para dedos y ratón.

### Fase 6: Prototipado Rápido y Validación de Flujo
Validar la navegación y comprensión del flujo con prototipos de baja fidelidad antes de invertir horas en estilos visuales finales.

### Fase 7: Aplicación del Sistema Visual (Design Tokens)
Integrar la paleta semántica, tipografía, radios y espaciados mediante Tailwind CSS y Radix UI, respetando contrastes y consistencia.

### Fase 8: Pase de Accesibilidad WCAG 2.2 AA
Verificar exhaustivamente: navegación por teclado, anillos de foco visibles, nombres accesibles en lectores de pantalla, zoom al 200% y modo de contraste alto.

### Fase 9: Usability Testing Observacional
Probar con usuarios reales o proxies representativos. Medir si completan la tarea, dónde dudan y qué errores cometen (observar lo que hacen, no sólo lo que dicen).

### Fase 10: Medición de KPIs y Refactorización
Monitorear tasas de conversión, tiempos de resolución de tareas y métricas de percepción (SUS / UMUX-Lite) para iterar sobre datos empíricos.

---

## 7. Catálogo Exhaustivo de Antipatrones (UXLAW-01 a UXLAW-30)

| Código | Antipatrón | Riesgo / Impacto Cognitivo | Remediación Arquitectónica |
| :--- | :--- | :--- | :--- |
| **UXLAW-01** | **Tratar leyes de UX como fórmulas matemáticas** | Rigidez absurda y justificaciones dogmáticas que perjudican la experiencia. | Usar las leyes como modelos heurísticos adaptados al contexto y objetivo. |
| **UXLAW-02** | **Limitar menús a 7 ítems por dogma de Miller** | Fragmentación absurda de la navegación en submenús escondidos. | Diseñar jerarquías visuales claras basadas en reconocimiento y categorización lógica. |
| **UXLAW-03** | **Romper convenciones para "ser original"** | Confusión masiva, aumento de fricción y curva de aprendizaje innecesaria. | Aplicar la Ley de Jakob en controles básicos; innovar en el valor de negocio. |
| **UXLAW-04** | **Targets minúsculos para acciones frecuentes** | Frustración motora, clics erróneos y fallos en pantallas táctiles móviles. | Garantizar tamaños mínimos de 24×24 px (WCAG) y 44×44 px en touch (Fitts). |
| **UXLAW-05** | **Demasiadas decisiones simultáneas** | Parálisis por análisis y abandono de la tarea (violación de Hick-Hyman). | Aplicar revelación progresiva (*Progressive Disclosure*) y defaults recomendados. |
| **UXLAW-06** | **Esconder opciones críticas bajo Hick** | Funcionalidades esenciales imposibles de descubrir para el usuario. | Exponer con claridad las acciones primarias; ocultar sólo opciones de configuración fina. |
| **UXLAW-07** | **Exigir que el usuario memorice datos** | Sobrecarga de la memoria de trabajo y probabilidad elevada de error. | Mostrar contexto persistente y permitir selección visual (*Recognition over recall*). |
| **UXLAW-08** | **Usar estética atractiva para ocultar mala UX** | Interfaces visualmente hermosas pero inoperables en la práctica cotidiana. | Medir completitud de tareas objetivas; la estética complementa, no sustituye. |
| **UXLAW-09** | **Asumir que todo debe terminar en < 400 ms** | Promesas de velocidad irreales en operaciones pesadas de backend. | Ofrecer feedback visual inmediato (<100ms) y progress indicators honestos (Doherty). |
| **UXLAW-10** | **Animaciones y spinners falsos innecesarios** | Ralentización artificial de la experiencia y frustración del usuario. | Si una operación termina en 20 ms, mostrar el resultado sin demoras simuladas. |
| **UXLAW-11** | **Espaciado homogéneo uniforme** | Destrucción de la Ley de Proximidad; incapacidad de discernir qué va con qué. | Usar jerarquía de espaciado: etiquetas pegadas a inputs, grupos separados con holgura. |
| **UXLAW-12** | **Mismo estilo visual para acciones opuestas** | Clics accidentales en acciones destructivas ("Eliminar" con aspecto de "Guardar"). | Aplicar Ley de Similitud: variantes cromáticas claras (Default vs Destructive). |
| **UXLAW-13** | **Cardificar absolutamente toda la interfaz** | Sobrecarga de bordes y ruido visual que neutraliza la Ley de Región Común. | Usar tarjetas sólo para agrupar entidades independientes con múltiples atributos. |
| **UXLAW-14** | **Exceso de bordes y divisores grises** | Fatiga visual y sensación de claustrofobia en la interfaz. | Preferir el espacio en blanco y fondos sutiles para delimitar zonas (Prägnanz). |
| **UXLAW-15** | **Múltiples CTAs visualmente dominantes** | Competencia atencional y confusión sobre cuál es el siguiente paso lógico. | Un único botón primario destacado por vista o modal (Von Restorff). |
| **UXLAW-16** | **Von Restorff para engaño comercial** | Pérdida de confianza del usuario y daño reputacional a la marca. | Prohibir el uso de destacados visuales para empujar opciones engañosas. |
| **UXLAW-17** | **Barras de progreso falsas o engañosas** | Ansiedad y sensación de manipulación al saltar de 90% a 91% en 2 minutos. | Mostrar progreso predecible y honesto basado en pasos completados reales. |
| **UXLAW-18** | **Completar automáticamente pasos no realizados** | Desconcierto del usuario sobre qué ocurrió realmente con sus datos. | El indicador de progreso sólo avanza cuando el sistema confirmó la operación. |
| **UXLAW-19** | **Onboardings obligatorios de 10 diapositivas** | Abandono inmediato por la Paradoja del Usuario Activo. | Reemplazar por empty states interactivos y guías contextuales no invasivas. |
| **UXLAW-20** | **UI que refleja esquemas de base de datos** | Textos en jerga de ingeniería que enajenan al usuario de negocio. | Mapear siempre a conceptos del modelo mental del usuario humano. |
| **UXLAW-21** | **Tooltips como único medio de explicación** | Inaccesibilidad total en pantallas táctiles y navegación por teclado. | Hacer la interfaz autoexplicativa con microcopia visible de apoyo. |
| **UXLAW-22** | **Usar el placeholder como etiqueta de input** | El usuario olvida qué pedía el campo en cuanto empieza a escribir. | Mantener siempre etiquetas `<label>` visibles fuera del campo. |
| **UXLAW-23** | **Botones de sólo icono sin accesible name** | Lectores de pantalla mudos e incapacidad de uso para personas con ceguera. | Incluir `aria-label` o texto oculto con clase `sr-only` en todo botón iconográfico. |
| **UXLAW-24** | **Eliminar el anillo de foco (`outline: none`)** | Imposibilidad absoluta de operar la interfaz mediante el teclado. | Usar `focus-visible:ring-2 focus-visible:ring-primary` con alto contraste. |
| **UXLAW-25** | **Transmitir significado exclusivamente con color** | Incomprensión para personas con daltonismo o baja visión. | Combinar siempre color con iconos semánticos o texto explicativo explícito. |
| **UXLAW-26** | **Interacciones dependientes sólo de hover** | Funcionalidades inaccesibles en dispositivos móviles táctiles. | Toda acción disponible en hover debe ser accionable mediante clic o tap directo. |
| **UXLAW-27** | **Priorizar estética sobre legibilidad de texto** | Texto gris claro sobre blanco ilegible en monitores con bajo brillo. | Garantizar contraste ≥ 4.5:1 exigido por WCAG 2.2 AA. |
| **UXLAW-28** | **Copiar interfaces de competidores a ciegas** | Importar problemas ajenos sin comprender el modelo mental del propio usuario. | Investigar las necesidades reales y validar con pruebas de usabilidad propias. |
| **UXLAW-29** | **Confiar ciegamente sólo en analíticas cuantitativas** | Saber *qué* pasó pero ignorar por completo *por qué* los usuarios se equivocan. | Combinar métricas de producto con sesiones cualitativas de observación directa. |
| **UXLAW-30** | **Confundir memorabilidad con fuegos artificiales** | Interfaces ruidosas que cansan al usuario recurrente tras dos días de uso. | Hacer memorable la experiencia por su velocidad, claridad y ausencia de fallos. |

---

## 8. Evaluación y KPIs de Calidad Cognitiva

Las métricas de experiencia de usuario deben correlacionarse con el resultado deseado:

### 8.1. Métricas de Usabilidad y Tarea

| Métrica | Objetivo / Meta | Método de Medición |
| :--- | :--- | :--- |
| **Task Success Rate (TSR)** | **≥ 90%** en flujos críticos | Porcentaje de usuarios que aprueban un testimonio o publican un widget sin asistencia. |
| **Critical User Errors** | **0** | Errores que provocan pérdida de datos o acciones destructivas no deseadas. |
| **Time-on-Task (ToT)** | Reducción progresiva | Tiempo medio empleado en completar la moderación de un lote de testimonios. |
| **Keyboard Operability** | **100%** de flujos clave | Navegación completa sin ratón y sin trampas de foco (*Focus Traps*). |
| **WCAG 2.2 Violations** | **0 errores AA** | Auditoría automatizada con axe-core y verificación manual de foco y contraste. |

### 8.2. Métricas de Percepción Estandarizadas

- **System Usability Scale (SUS)**: Meta ≥ 80 puntos (calificación excelente en facilidad de uso y satisfacción).
- **UMUX-Lite**: Dos preguntas clave ("Esta aplicación satisface mis necesidades" y "Es fácil de usar") evaluadas en escala Likert.
- **Single Ease Question (SEQ)**: Medición al finalizar un flujo crítico (*"¿Qué tan fácil o difícil fue completar esta tarea?"* en escala de 1 a 7; meta ≥ 6).

---

## 9. Recursos Adicionales, Checklists y Reglas de Decisión

### 9.1. Checklist Senior de Pantalla (20 Preguntas Clave)

Antes de dar por aprobada una pantalla en Testimonial CMS, validar:
1. [ ] ¿El usuario puede identificar en menos de 3 segundos dónde está y de quién es la cuenta activa?
2. [ ] ¿Se reconoce inmediatamente cuál es la acción principal recomendada?
3. [ ] ¿Existe una jerarquía visual evidente entre títulos, datos y acciones secundarias?
4. [ ] ¿Hay opciones o datos superfluos que generen carga cognitiva extraña?
5. [ ] ¿Se obliga al usuario a recordar información que podríamos mostrarle directamente?
6. [ ] ¿Los elementos relacionados están agrupados mediante proximidad y región común?
7. [ ] ¿Los controles visualmente similares se comportan de forma idéntica?
8. [ ] ¿Lo verdaderamente importante destaca sin que otros elementos compitan en exceso?
9. [ ] ¿Todos los botones y enlaces interactivos tienen un tamaño cómodo para el dedo/ratón?
10. [ ] ¿El feedback visual ante clics o pulsaciones es instantáneo (< 100 ms)?
11. [ ] ¿Las operaciones que tardan más de 1 segundo muestran estado de progreso honesto?
12. [ ] ¿El diseño previene errores antes de que ocurran mediante restricciones visuales razonables?
13. [ ] ¿Las acciones destructivas (borrar, rechazar) exigen confirmación o permiten deshacer?
14. [ ] ¿La terminología utilizada coincide con el lenguaje del usuario y no con la base de datos?
15. [ ] ¿Toda la pantalla puede operarse fluidamente sólo con el teclado?
16. [ ] ¿El indicador de foco (`focus-visible`) es visible y contrastado en todos los controles?
17. [ ] ¿La información crítica no depende exclusivamente de la percepción del color?
18. [ ] ¿La pantalla se visualiza y opera correctamente al aplicar un zoom del 200%?
19. [ ] ¿Las animaciones se desactivan o atenúan con `prefers-reduced-motion`?
20. [ ] ¿Los estados vacíos (*empty states*) son cálidos, explican la causa y ofrecen una acción clara?

---

### 9.2. Checklist Senior de Flujo de Interacción

1. [ ] ¿El flujo requiere el menor número de pasos posible sin saturar cada pantalla?
2. [ ] ¿Cuántas decisiones reales toma el usuario y cuáles puede automatizar el sistema?
3. [ ] ¿Los valores predeterminados (*defaults*) son seguros y beneficiosos para el usuario?
4. [ ] ¿El usuario tiene puntos claros de retorno o cancelación sin perder datos ya ingresados?
5. [ ] ¿Se guarda el progreso de formularios extensos de forma automática?
6. [ ] ¿La pantalla de cierre final comunica con total claridad qué se logró y cuál es el siguiente paso lógico?

---

### 9.3. Matriz de Diagnóstico y Aplicación

| Problema Observado | Principio Psicológico Prioritario | Acción Correctiva |
| :--- | :--- | :--- |
| **El usuario no encuentra el botón principal** | Ley de Fitts + Von Restorff | Ampliar tamaño, aumentar contraste cromático y ubicarlo en la trayectoria visual. |
| **Demasiadas dudas ante un formulario** | Hick-Hyman + Chunking | Dividir en bloques lógicos temáticos y aplicar revelación progresiva. |
| **Los usuarios confunden menús de navegación** | Ley de Jakob + Modelos Mentales | Reorganizar la barra lateral según la convención estándar del ecosistema SaaS. |
| **Alta tasa de abandono en recolección** | Goal-Gradient + Parkinson's Law | Mostrar indicador de progreso con pasos cortos y estimación honesta de tiempo. |
| **El usuario olvida qué significaba un código** | Ley de Miller + Reconocimiento | Mostrar tarjeta visual del testimonio en lugar de un ID alfanumérico abstracto. |
| **La interfaz se siente caótica y desordenada** | Ley de Prägnanz + Proximidad | Unificar espaciados con tokens de Tailwind y eliminar bordes innecesarios. |
| **Sensación de lentitud e impaciencia** | Doherty Threshold + Feedback | Añadir feedback visual en < 100 ms y skeleton loaders mientras carga la API. |
| **Cierre frío o poco memorable** | Peak-End Rule | Diseñar una confirmación final cálida con instrucciones claras de éxito. |
| **Dificultad de toque en smartphones** | Ley de Fitts + Touch Ergonomics | Trasladar botones de acción a la barra inferior fija con altura ≥ 44 px. |

---

### 9.4. Regla Final de Flujo de Diseño

El proceso profesional de ingeniería de interfaces cognitivas sigue un orden inmutable:

```text
USER GOAL (¿Qué resultado de negocio o personal necesita lograr?)
    ↓
MENTAL MODEL (¿Cómo concibe el usuario esta tarea en su mente?)
    ↓
INFORMATION ARCHITECTURE (¿Cómo estructurar y jerarquizar los datos?)
    ↓
COGNITIVE LOAD REDUCTION (¿Cómo eliminar fricción, dudas y sobrecarga?)
    ↓
VISUAL HIERARCHY & GESTALT (¿Cómo guiar la mirada con tamaño, peso y proximidad?)
    ↓
INTERACTION DESIGN & FITTS (¿Cómo hacer los interactores cómodos y predecibles?)
    ↓
FEEDBACK & DOHERTY THRESHOLD (¿Cómo asegurar respuestas inmediatas del sistema?)
    ↓
ACCESSIBILITY BY DESIGN (¿Cómo garantizar operabilidad universal WCAG 2.2 AA?)
    ↓
EMPIRICAL VALIDATION (¿Cómo verificar el comportamiento en pruebas reales?)
```

---

### 9.5. Resultado Esperado

Una interfaz concebida bajo **SKL-UX-PSYCH-001** en Testimonial CMS será:
```text
Predictable (hace lo esperado en cada interacción)
Learnable (fácil de comprender sin entrenamiento previo)
Recognizable (privilegia el reconocimiento sobre el esfuerzo de memoria)
Accessible (operable por cualquier persona en cualquier dispositivo o condición)
Efficient (elimina pasos superfluos y optimiza la productividad diaria)
Forgiving (protege contra errores y facilita su recuperación inmediata)
Low-friction (consume la mínima cantidad de energía cognitiva del usuario)
Visually coherent (consistente en todos sus componentes y estados)
Emotionally positive (transmite confianza, profesionalismo y satisfacción)
Memorable (se recuerda por su claridad, velocidad y utilidad indiscutible)
```
