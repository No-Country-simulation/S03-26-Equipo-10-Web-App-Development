# Auditoría integral del frontend — Impeccable — 2026-10-14

## Resultado y alcance

Esta ampliación cubre **las 27 páginas ruteadas: 15 pantallas activas y 12 preparatorias**, sus formularios, diálogos, estados y componentes comunes. Incluye las cinco vistas y los dos detalles de inteligencia de negocio. Sustituye el alcance parcial del informe inicial para decidir mejoras de todo el frontend; conserva aquel informe como antecedente.

La identidad editorial es coherente con un producto que presenta testimonios. Conviene preservarla y adaptar su intensidad a la tarea: landing para comprender y comenzar; panel para operar con precisión; captura para escribir con confianza; galería para leer historias creíbles. Los principales problemas encontrados son de integridad de interacción y claridad operativa, además de accesibilidad y adaptación móvil.

**Evaluación técnica provisional: 10/20.** No es certificación WCAG, medición con usuarios ni un resultado de rendimiento en producción. No se compara con los 22/40 heurísticos del informe inicial: son escalas y alcances diferentes.

| Dimensión de Impeccable audit |   Puntaje | Evidencia                                                                                                                          |
| ----------------------------- | --------: | ---------------------------------------------------------------------------------------------------------------------------------- |
| Accesibilidad                 |       2/4 | Labels y Radix presentes; cargas, valoraciones, landmarks y cierres tienen brechas.                                                |
| Rendimiento                   |       2/4 | Lazy loading y cleanup en medios públicos; falta perfilado y medición de producción. Puntaje de implementación, de baja confianza. |
| Temas                         |       2/4 | Tokens HSL compartidos; combinaciones dark de contraste insuficiente y colores de estado dispersos.                                |
| Responsive                    |       2/4 | Panel con menú móvil y tablas desplazables; portada con desborde confirmado, diálogos densos y áreas de cierre pequeñas.           |
| Integridad de implementación  |       2/4 | Sistema visual común, pero errores repetidos en permisos, formularios, paginación y sincronización.                                |
| **Total**                     | **10/20** | **Aceptable según escala de la skill; requiere trabajo significativo.**                                                            |

Se documentan **24 grupos de hallazgos: 13 P1 y 11 P2; ninguno P0 demostrado y ninguno P3 priorizado**. Cada grupo puede contener varias manifestaciones del mismo problema. Las oportunidades adicionales de producto y visualización no se cuentan como defectos.

## Método y límites de verificación

- Skill Impeccable: contexto ya cargado en esta sesión; playbooks `critique`, `audit` y `operate`. No se repitió context ni se cargó craft-floor porque no se editó UI.
- Dos evaluaciones de código independientes: A `/root/design_review`, B `/root/detector_evidence`. La síntesis recibió los hallazgos B después de terminar A. El agente principal revisó BI y realizó la comprobación complementaria en navegador.
- El detector ya se había ejecutado sobre **todo `apps/web/src`** y devolvió `[]`, exit 0. Se reutiliza esa pasada porque no cambió el código. Cero reglas/ubicaciones detectadas no significa cero errores funcionales. No se encontraron ignores aplicables.
- Se leyeron las 27 páginas y las implementaciones activas completas; adaptadores y contratos backend se contrastaron cuando afectaban alcance, permisos o significado de una acción. Los componentes duplicados o preparatorios sin alcance desde las rutas no se trataron como UI activa.
- Se inspeccionaron las 15 pantallas activas en navegador a lo largo de ambas evaluaciones. Para el panel se usó una API local **sintética, en memoria**, con respuestas compatibles con los esquemas del frontend. No representa autenticación real ni aceptación del backend. No se usaron cuentas reales, base de datos, infraestructura ni migraciones.
- Navegador: DOM y capturas de administración, públicos y autenticación; medidas en viewport 375×812 para nueve pantallas administrativas, captura, galería y autenticación, además de vistas BI. Hubo capturas de escritorio y verificaciones DOM de BI, webhooks, configuración, usuarios e inicio. No se verificaron todas las pantallas en todos los tamaños ni todos los estados en ambos temas.
- Se comprobó en el DOM que los botones de paginación del alta son `submit` y pertenecen al formulario; estaban deshabilitados en la fixture de dos categorías. El envío accidental con varias páginas y campos válidos se deduce del código/HTML; no se crearon testimonios para reproducirlo.
- Se comprobó con sesión sintética de editor el detalle en **Modo Lectura**, sin acciones de moderación. Esto confirma la presentación; los permisos reales se contrastaron con el controlador API.
- Se revisaron por código éxito, vacío, error, restricciones y recuperación de cada pantalla. No se reprodujeron todas las fallas HTTP, dobles mutaciones, estados de adjuntos o conflictos. No se enviaron altas, claves, webhooks ni formularios públicos. Los medios remotos reales y las entregas de webhooks no se ejercitaron.
- No se ejecutaron auditorías completas de lector de pantalla, teclado, zoom, gestos táctiles físicos, rendimiento de campo, carga, SEO/indexación remota ni Core Web Vitals. No hay garantías de cumplimiento derivadas de este informe.
- El CLI agent-browser no estaba disponible; se usó CUA del agente principal. Los agentes A/B no tenían superficies de navegador. La API de evaluación DOM era de sólo lectura: no hubo overlay ni live-server de Impeccable.
- Los servidores sintéticos se detuvieron y se eliminó su script temporal. Se solicitó restauración del viewport y cierre de las pestañas temporales; la limpieza explícita de una pestaña en error encontró un bloqueo del navegador, quedando bajo su limpieza automática de fin de turno.

## Inventario: todas las pantallas activas

Código = implementación/contratos revisados. Navegador = render o DOM inspeccionado con los límites anteriores; no equivale a un flujo extremo a extremo completado.

| Ruta                           | Interfaz y estados revisados por código                                                      | Comprobación de navegador                                                                        | Mejora principal                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `/`                            | Header, hero, beneficios, proceso, características, testimonios, precios, CTA final y footer | Escritorio/móvil y pulsación del CTA                                                             | Destinos reales, promesas verificables y header móvil.                |
| `/admin/login`                 | Campos, autocomplete, carga, error y navegación                                              | Render/DOM móvil                                                                                 | Separar demostración de acceso propio, landmark y título de tarea.    |
| `/admin/register`              | Organización, cuenta, contraseña, errores y alta                                             | Render/DOM móvil; valores sólo inspeccionados como booleanos, sin archivarlos                    | Campos vacíos y requisitos antes de enviar.                           |
| `/admin`                       | Resumen, métricas, recientes, vacío, error y detalle                                         | Escritorio/móvil con datos sintéticos                                                            | Cola de trabajo y primera puesta en marcha.                           |
| `/admin/testimonials`          | Listado, búsqueda, facetas, paginación y apertura de detalle                                 | Escritorio/móvil                                                                                 | Consulta global, filtro por estado y detalle sincronizado.            |
| `/admin/categories`            | Alta inline, eliminación, paginación, vacío y error                                          | DOM escritorio/móvil                                                                             | Explicar efecto de eliminación, renombrar y mostrar asociaciones.     |
| `/admin/tags`                  | Alta inline, eliminación, paginación, vacío y error                                          | Carga inicial escritorio y listado móvil cargado                                                 | Controlar borrado y facilitar búsqueda/renombrado.                    |
| `/admin/users`                 | Alta email/contraseña/rol, eliminación, restricción, carga y error                           | Listado escritorio/móvil                                                                         | Hacer coincidir permisos, acción y texto.                             |
| `/admin/webhooks`              | Alta, revelación/copia, prueba, rotación, archivo, historial y replay                        | Listado escritorio/móvil; formularios y estados sensibles por código                             | Bloqueo de rotaciones y seguimiento por destino.                      |
| `/admin/api-keys`              | Alta, scopes, expiración, revelación, copia, rotación y revocación                           | Listado escritorio/móvil; vencida etiquetada como revocada en fixture compatible                 | Zona horaria, estados y revelación segura/comprensible.               |
| `/admin/analytics`             | Totales, eventos recientes, vacío, errores y actualización                                   | Listado escritorio; composición móvil                                                            | Período explícito y testimonios reconocibles.                         |
| `/admin/settings`              | Organización, logo, slug, recepción, enlaces y módulos opcionales                            | Escritorio/móvil                                                                                 | Separar tareas y conservar borradores independientes.                 |
| `/admin/business-intelligence` | Siete superficies detalladas debajo; roles, URL, polling, CSV, conflictos e incertidumbre    | Cinco vistas y dos detalles escritorio; cuatro vistas de editor y restricción de auditoría móvil | Jerarquía de decisiones, lectura de gráficos y protección de cambios. |
| `/p/[slug]`                    | Carga, cerrado, no disponible, validación, adjuntos, error, recepción completa/parcial       | Formulario disponible renderizado con marca sintética                                            | Límites de adjuntos visibles y valoración deliberada.                 |
| `/t/[slug]`                    | Publicados, carga/vacío/error, detalle expandido, imagen, YouTube y tracking                 | DOM escritorio y galería móvil con publicaciones sintéticas                                      | Marca, paginación pública y semántica de lectura.                     |

## Formularios, diálogos y componentes compartidos

| Superficie                          | Cobertura y hallazgos                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Crear testimonio                    | Autor, contenido, rating, categoría y etiquetas paginadas, preview, envío/cancelación y errores. Formulario y propiedades DOM de botones inspeccionados en móvil. F02 y F05. |
| Detalle/moderación                  | Estado, aprobar/rechazar/publicar/enviar a revisión, razón de rechazo y medios. Vista admin/editor inspeccionada. F01 y F04.                                                 |
| Editar testimonio                   | Contenido/autor/clasificación, guardar/cancelar y error; leído completo. Reconciliación del resultado pendiente.                                                             |
| Imagen/video de testimonio          | Lectura de archivo, tamaño, vinculación, carga/error; revisados por código. No se verificó subida ni reproducción externa real.                                              |
| Formularios de categorías/etiquetas | Alta inline, validación y conservación ante error. Confirmación de borrado ausente.                                                                                          |
| Alta de usuario                     | Email/contraseña/rol; error conserva campos; botón y permisos prometidos no coinciden completamente con comportamiento.                                                      |
| API keys                            | Formulario compartido de alta/rotación, permisos/vencimiento y revelación única. Revisado sin generar secretos.                                                              |
| Webhooks                            | Alta HTTPS/evento, confirmaciones, rotación y secreto; historial/replay. Revisado sin enviar notificaciones.                                                                 |
| Logo                                | MIME/tamaño, preview, generación/abort, guardado, eliminación, conflicto y fallback; código completo y controles renderizados.                                               |
| Shell                               | Sidebar desktop, Sheet móvil, rol, usuario, ubicación y salida; navegación renderizada. Falta contexto de organización permanente y skip link.                               |
| Feedback común                      | Carga visual, LoadFailure, errores de acción, paginación, boundary global y reset; se distinguieron vacíos de errores.                                                       |
| Temas/tokens                        | Tokens vigentes en globals.css, variantes, tipografía y colores de estado. tokens.css/themes.css son placeholders explícitos, no la fuente vigente.                          |

## Hallazgos P1: resolver antes de considerar el frontend listo

Ubicaciones relativas a `apps/web/src/`, salvo referencia backend explícita. Los criterios de aceptación describen la verificación necesaria de una corrección posterior.

### F01 — El editor no puede moderar desde el panel

- **Integridad.** `features/testimonials/components/TestimonialModal.tsx:106` define `canEdit = isAdmin`; controla edición, transiciones y adjuntos en `:346` y siguientes. `features/users/screens/users-screen.tsx:118` promete al editor crear, moderar y publicar. El controlador API admite admin/editor para esas transiciones (`apps/api/src/modules/testimonials/controllers/testimonials.controller.ts:39`). Se observó Modo Lectura en la sesión sintética de editor.
- **Impacto:** el rol destinado al trabajo editorial carece de las acciones principales.
- **Mejora:** decidir cada acción según permisos y estado del recurso; mantener gestión de usuarios, credenciales y configuración bajo administración.
- **Aceptación:** editor puede ejecutar las transiciones autorizadas; admin conserva sus acciones; un rol no autorizado no recibe controles ni acceso API.
- **Comando:** `impeccable harden`.

### F02 — La paginación del alta puede enviar el formulario

- **Integridad / prevención.** `features/shared/pagination.tsx:58` y `:66` usan Button sin type; `components/ui/button.tsx:39` propaga un button nativo. En `CreateTestimonialModal.tsx:110`, `:212`, `:242` están dentro del form. El DOM confirma type submit y asociación al formulario.
- **Impacto:** con varias páginas y campos válidos, navegar categorías/etiquetas puede crear un testimonio accidentalmente; con datos incompletos puede disparar validación inesperada.
- **Mejora:** los controles de navegación deben declarar type button. No cambiar indiscriminadamente todos los botones del producto.
- **Aceptación:** anterior/siguiente sólo cambia página; nunca envía POST de creación ni activa validación del formulario. Verificar con más de una página de metadatos y contenido válido.
- **Comando:** `impeccable harden`.

### F03 — Búsqueda y facetas sólo consultan la página cargada

- **Integridad.** `features/testimonials/screens/testimonials-screen.tsx:30`, `:39`, `:54`, `:237`; adaptador `features/testimonials/api.ts:39`.
- **Impacto:** falsos vacíos, conteos parciales y opciones que cambian entre páginas. La UI aparenta consultar el catálogo completo.
- **Mejora:** filtros antes de paginar en backend, total filtrado, facetas coherentes, URL compartible y reinicio de página. Requiere ampliar contrato: hoy administración pasa sólo paginación al servicio. Mientras tanto, declarar alcance de página.
- **Aceptación:** una coincidencia originalmente en página 2 se encuentra desde página 1; conteos y paginación representan la misma consulta del tenant.
- **Comandos:** `impeccable clarify`, `harden`.

### F04 — El detalle conserva el registro anterior después de guardar

- **Integridad / estado.** `features/testimonials/components/TestimonialModal.tsx:113`, `:129`, `:182`; `testimonials-screen.tsx:22`, `:252`; overview reutiliza onUpdated=reload.
- **Impacto:** aprobar no cambia inmediatamente el estado ni ofrece publicar; edición y adjuntos pueden parecer no guardados.
- **Mejora:** actualizar el objeto seleccionado con la respuesta confirmada o volver a consultar ese recurso, sin perder el contexto de detalle. Anunciar éxito y siguiente acción.
- **Aceptación:** texto, medios, estado y acciones se actualizan sin cerrar/reabrir; fallos conservan el trabajo. Pendiente de prueba con backend real.
- **Comando:** `impeccable harden`.

### F05 — La recuperación recomendada descarta el borrador

- **Integridad / recuperación.** `CreateTestimonialModal.tsx:71`, `:105`, `:124`: error de metadatos recomienda cerrar/abrir; cerrar ejecuta resetForm.
- **Impacto:** seguir la instrucción borra autor, contenido y clasificación.
- **Mejora:** reintento de metadatos dentro del formulario, conservación en memoria y decisión explícita antes de descartar cambios. No introducir almacenamiento persistente de contenido sensible por defecto.
- **Aceptación:** un fallo y reintento de categorías/etiquetas no cambia texto; cierre/Escape con cambios tiene salida comprensible.
- **Comando:** `impeccable harden`.

### F06 — Borrar una categoría desclasifica testimonios sin advertencia

- **Integridad / prevención.** `features/catalog/screens/categories-screen.tsx:49`; backend `category.repository.ts:63` pone categoryId null en testimonios asociados antes de eliminar.
- **Impacto:** un clic afecta la organización de múltiples historias sin explicar la consecuencia.
- **Mejora:** confirmación identificando categoría y efecto, con cancelar; incluir cantidad asociada si el contrato la aporta.
- **Aceptación:** el operador sabe que los testimonios se conservan sin esa categoría y puede cancelar antes del DELETE.
- **Comandos:** `impeccable harden`, `clarify`.

### F07 — Rotación de secreto webhook sin bloqueo de operación pendiente

- **Integridad.** `features/webhooks/screens/webhooks-screen.tsx:82`, `:276` mantiene ejecutable la rotación mientras espera.
- **Matiz verificado en la fase 0:** el backend ya rechaza otra rotación durante la gracia del secreto anterior y aplica control de concurrencia mediante `expectedUpdatedAt`. No se afirma que varios intentos concurrentes puedan emitir varios secretos válidos; el hallazgo pendiente corresponde al frontend, que permite intentos superpuestos y feedback ambiguo.
- **Impacto:** el operador puede repetir una operación pendiente y recibir conflictos o resultados de intentos distintos sin un estado ocupado ni contexto suficientemente claro.
- **Mejora:** bloqueo por destino, estado ocupado y resultado asociado al webhook; conservar explicación de gracia efectiva.
- **Aceptación:** hay una sola rotación pendiente por destino; respuesta tardía no sustituye el secreto/contexto de otra operación; error conserva una ruta de recuperación.
- **Comando:** `impeccable harden`.

### F08 — Rotar una API key desplaza el vencimiento por zona horaria

- **Integridad.** `features/api-keys/screens/api-keys-screen.tsx:166` usa expiresAt.slice(0,16) para datetime-local y `:63` interpreta ese valor en hora local mediante Date/toISOString.
- **Impacto:** al rotar sin editar fecha se cambia el instante de expiración. En UTC−3 el desplazamiento es de tres horas.
- **Mejora:** convertir explícitamente entre instante UTC y representación local, y explicar zona horaria.
- **Aceptación:** un vencimiento 15:00Z se muestra como 12:00 en Argentina y guardar sin tocarlo conserva 15:00Z.
- **Comando:** `impeccable harden`.

### F09 — La galería no permite alcanzar más de veinte publicaciones

- **Integridad.** `features/public-testimonials/api.ts:12` no solicita página ni conserva meta; `public-testimonials-screen.tsx:368` no pagina. El servicio público usa veinte por defecto (`apps/api/src/modules/testimonials/services/testimonials.service.ts:192`).
- **Impacto:** parte del contenido publicado no tiene acceso desde la galería.
- **Mejora:** paginación/cargar más real y alcance visible; conservar acceso y scroll durante la lectura. No resolver trayendo un volumen ilimitado.
- **Aceptación:** con 21 publicados se alcanza el vigésimo primero; vacío, final del catálogo y error de página se distinguen.
- **Comandos:** `impeccable harden`, `adapt`.

### F10 — Registro con valores de ejemplo efectivos

- **Integridad / prevención.** `features/auth/components/register-admin-form.tsx:19` inicializa los tres campos con datos no vacíos, incluida contraseña. Login también viene precompletado (`login-form.tsx:15`). Los valores no se archivan aquí.
- **Impacto:** alta administrativa con datos que la persona no eligió; demostración y cuenta propia se confunden.
- **Mejora:** registro vacío, ejemplos como placeholders y entrada separada de demostración si existe soporte real. Explicar requisitos de contraseña.
- **Aceptación:** no puede enviarse una cuenta con datos de ejemplo por omisión; acceso de demostración se identifica claramente.
- **Comandos:** `impeccable harden`, `onboard`.

### F11 — Acciones comerciales y ayuda sin destino

- **Integridad.** `components/landing/HeroSection.tsx:85`, `:88`; `PricingSection.tsx:88`; `CTASection.tsx:25`; footer con href #, incluidos recursos y enlaces legales.
- **Impacto:** la acción prominente no permite avanzar; enlaces de ayuda aparentan contenido inexistente. Se comprobó el CTA principal en navegador.
- **Mejora:** destinos reales para comenzar, producto/contacto y ayuda; retirar promesas de navegación que todavía no tienen contenido. Verificar afirmaciones comerciales con su responsable, sin inventar precios, pruebas, SLA o procedencia de citas.
- **Aceptación:** todas las acciones prominentes producen el resultado anunciado y los enlaces de ayuda llevan a contenido útil.
- **Comandos:** `impeccable harden`, `clarify`.

### F12 — Header y contenido de portada desbordan en móvil

- **Responsive.** `components/landing/Header.tsx:21`, `:33`, `app/globals.css:6`; medición de la evaluación inicial: viewport 375, ancho desplazable 497, botón de tema aproximadamente x371–411.
- **Impacto:** una acción queda fuera de pantalla y parte del contenido exige adaptación.
- **Mejora:** composición móvil específica del header, marca flexible, agrupación de acciones y límites de texto/CTA. No usar overflow hidden como reparación de contenido inaccesible.
- **Aceptación:** navegación y acción principal utilizables a 320/375/768 px y con zoom; ausencia de pérdida de contenido.
- **Comando:** `impeccable adapt`.

### F13 — Combinaciones oscuras con contraste insuficiente

- **Temas / accesibilidad.** `app/globals.css:46`, `:60`, `:68`; `components/dashboard/DashboardSidebar.tsx:57`, `:97`; `components/ui/alert.tsx:12`.
- **Evidencia analítica:** destructive sobre background dark ≈1,97:1; navegación activa dark sobre fondo claro con overlay ≈2,64:1. No son mediciones de todos los píxeles/estados renderizados. No se aplica el primer cálculo a botones destructive con texto claro.
- **Impacto:** texto de error/selección poco legible. Las capturas del panel oscuro muestran que la sidebar usa una superficie clara, coherente con la combinación calculada.
- **Mejora:** tokens de estado según superficie y parejas foreground/background explícitas; verificar estados green/amber/blue existentes en usuarios, claves y webhooks. Evitar que el acento de marca sea la única diferenciación del lifecycle.
- **Aceptación:** contraste de texto normal al menos 4,5:1 y evaluación de componentes/estados pertinentes; selección y error distinguibles sin depender sólo del color. No constituye certificación completa de accesibilidad.
- **Comandos:** `impeccable audit`, `colorize`.

## Hallazgos P2: completar claridad y robustez

| ID  | Categoría y ubicación                                                                                                                                                            | Impacto / mejora                                                                                                                                                                | Aceptación y comando                                                                                                                                                                             |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| F14 | Integridad — `features/api-keys/screens/api-keys-screen.tsx:215`                                                                                                                 | EXPIRED se reduce por isActive a Revocado. Se observó la etiqueta incorrecta en fixture compatible con backend.                                                                 | Activa/Vencida/Revocada distintas, con siguiente paso pertinente. `clarify`, `harden`.                                                                                                           |
| F15 | Integridad — `api-keys-screen.tsx:53`, `:95`                                                                                                                                     | Nueva generación/rotación borra inmediatamente el secreto revelado anterior, incluso si después falla.                                                                          | Salida deliberada de la revelación antes de reemplazarla; fallo no borra información todavía necesaria. `harden`.                                                                                |
| F16 | Integridad / copy — `features/users/screens/users-screen.tsx:112`, `:122`                                                                                                        | Invitar crea una cuenta activa con contraseña; requisitos de contraseña incompletos.                                                                                            | Acción llamada Crear usuario o invitación real; todos los requisitos y error junto al campo. `clarify`, `harden`.                                                                                |
| F17 | Integridad — `features/shared/pagination.tsx:49`; catálogos `:52`                                                                                                                | Borrar el último elemento puede conservar página fuera del rango y mostrar vacío global falso.                                                                                  | Página se corrige a la última válida; distinguir vacío, sin coincidencias y página inexistente. `harden`.                                                                                        |
| F18 | Integridad — `features/catalog/screens/tags-screen.tsx:49`, `:94`                                                                                                                | Borrado inmediato sin decisión ni undo; controles ocultos hasta hover/foco en sm+. El foco sí recupera opacidad.                                                                | Efecto sobre asociaciones explicado según contrato; acción descubrible en tablet táctil; cancelar/deshacer apropiado. `harden`, `adapt`.                                                         |
| F19 | Integridad / estado — `features/settings/screens/settings-screen.tsx:39`, `:46`, `:66`, `:114`; logo editor `:72`                                                                | Flags fallidos bloquean configuración independiente; refrescos sobrescriben slug en edición; éxito de logo desaparece al desmontar editor.                                      | Fallas aisladas por tarea, borradores conservados y confirmación/foco estables después de guardar. `harden`.                                                                                     |
| F20 | Integridad / reconocimiento — `features/webhooks/screens/webhooks-screen.tsx:173`, `:291`, `:295`                                                                                | Secreto/historial sin identidad suficiente del destino; actualizar historial vuelve a página 1.                                                                                 | URL/evento o nombre visibles sin secreto; actualizar conserva destino/página; resultado de copiar anunciado. `clarify`, `harden`.                                                                |
| F21 | Integridad / comprensión — `features/analytics/screens/analytics-screen.tsx:65`, `:80`                                                                                           | Totales sin período, eventos con IDs truncados/inglés y recorte de veinte sin alcance.                                                                                          | Período/acumulado explícito; autor/extracto y enlace autorizado; tabla con alcance real. `clarify`, `onboard`.                                                                                   |
| F22 | Accesibilidad / robustez — carga global y de módulos; `public-testimonials-screen.tsx:91`, `:96`, `:300`, `:355`; `ThemeProvider.tsx:21`, `:32`; `dialog.tsx:45`; `sheet.tsx:60` | Cargas no anunciadas en varios módulos; estrellas sin valor textual; expansión sin aria-expanded; storage sin guardas; cierre Close de 16×16; auth sin main y h1 visible móvil. | Estados anunciados sin ruido, rating textual, expansión semántica, fallback si storage falla, Cerrar localizado con área adecuada, main/título de tarea y skip link. `audit`, `harden`, `adapt`. |
| F23 | Integridad / rutas — doce page.tsx preparatorios `:12`                                                                                                                           | Placeholders en inglés accesibles por URL compiten con rutas activas. No exponen datos ni constituyen doce flujos implementados.                                                | Alias a rutas útiles o exclusión explícita de navegación/indexación hasta completar; no crear doce interfaces nuevas innecesariamente. `clarify`, `harden`.                                      |
| F24 | Integridad / control — `features/business-intelligence/screens/settings-view.tsx:20`; navegación `bi-screen.tsx:46`                                                              | Cambiar de vista abandona un draft de configuración sin aviso. El manejo de conflicto servidor sí conserva campos.                                                              | Detectar cambios pendientes al navegar y ofrecer conservar/descartar; no rebase automático de intención. `harden`.                                                                               |

## Mejoras de diseño por pantalla

Estas propuestas complementan los defectos anteriores. No se presentan como funcionalidades ya implementadas.

| Pantalla           | Dirección concreta de UX/UI                                                                                                                                                        | Criterio de diseño                                                                                                                                         |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing            | Explicar recibir → moderar → publicar con una vista real del producto; dar al CTA secundario una utilidad concreta. Reducir frases aspiracionales que desplazan el funcionamiento. | En el primer viewport se entiende qué hace el CMS, para quién y cómo comenzar. Mantener la identidad editorial.                                            |
| Login              | Título de tarea visible en todos los tamaños, enlace de regreso y demostración identificada por separado.                                                                          | Acceder requiere reconocer credenciales propias, no interpretar una pantalla de demo. Recuperación de contraseña es trabajo de producto/backend separado.  |
| Registro           | Nombrar Espacio de trabajo y Cuenta administradora, requisitos de contraseña junto al campo y expectativa del siguiente paso.                                                      | Alta sin datos accidentales, jerga innecesaria ni promesa de invitación.                                                                                   |
| Inicio             | Priorizar Revisar pendientes y activar captación cuando no hay testimonios. Separar borradores de pendientes; explicar alcance de recientes.                                       | El editor sabe qué hacer hoy; el primer administrador llega al primer testimonio publicado.                                                                |
| Testimonios        | Filtro por estado, conteo global, chips con eliminación y limpiar consulta; autor/extracto antes que ID. Vista de revisión con siguiente/anterior.                                 | Menos reaperturas y búsqueda fiable; selección masiva sólo con contrato y resultado por elemento.                                                          |
| Alta de testimonio | Una columna de escritura principal y metadatos progresivos; preview opcional en móvil; límites y errores junto al campo.                                                           | El contenido domina, las clasificaciones no interrumpen y el borrador sobrevive a la recuperación.                                                         |
| Detalle/moderación | Estado en español, significado de aprobado/publicado y acción siguiente destacada. Medios secundarios al juicio editorial.                                                         | Decisión informada y resultado inmediato sin ambigüedad sobre visibilidad pública.                                                                         |
| Categorías         | Alta simple, renombrado y cantidad asociada; explicar categoría principal con ejemplos opcionales por programa.                                                                    | Clasificación útil y efecto de borrado predecible. PATCH backend existe; integrar como trabajo propio.                                                     |
| Etiquetas          | Buscar antes de crear, renombrar y explicar combinación con categoría.                                                                                                             | Evitar duplicados y acumulación de chips; no imponer taxonomía EdTech a empresas.                                                                          |
| Usuarios           | Crear usuario como acción real, permisos comprensibles y estado de acceso. Explorar suspensión/restauración.                                                                       | Roles coinciden con acciones efectivas. No prometer edición de rol sólo porque el DTO la admite: el servicio actual no la aplica.                          |
| API keys           | Nombre de integración, estados explícitos, zona de vencimiento y recorrido de rotación: generar, copiar, actualizar consumidor, verificar uso.                                     | Se entiende qué cambia y cuándo deja de funcionar una credencial anterior. Preservar revelación única.                                                     |
| Webhooks           | Alta → secreto → receptor → prueba → resultado. Historial con destino, estados traducidos y detalle expansible de intentos.                                                        | Encolado se distingue de entregado; diagnóstico sin recordar la fila abierta. Edición URL/evento y pausa requieren integración del PATCH existente.        |
| Analítica          | Totales con período y eventos vinculados a historias. Vacío con acción de publicar/compartir.                                                                                      | Responde qué testimonio recibe interacción, sin equiparar clic con conversión causal.                                                                      |
| Configuración      | Secciones Marca, Captura y Capacidades con estados de guardado independientes. Diferenciar enlace configurado de recepción abierta.                                                | Cambiar logo no altera el slug pendiente; flags informativos no parecen controles operables. Sustituir la promesa Nuestra IA por scoring real documentado. |
| Captura pública    | Nombre/logo de institución, calificación deliberada, límites de imagen/video antes de adjuntar y explicación de revisión.                                                          | Publicar no se promete al enviar; recepción parcial confirma qué se guardó. Mantener foco y preservación existentes.                                       |
| Galería            | Marca de la institución, cantidad/cargar más, historia y autor como contenido principal; quitar View/Click/Play decorativos.                                                       | Lectura creíble y accesible; telemetría interna no ocupa la interfaz del visitante.                                                                        |

## Inteligencia de negocio: siete superficies

Este módulo tiene una base operativa más madura que otros: URL de filtros, distinción de cortes ausentes/vacíos, UTC explícito, polling visible serializado/abortable, datos retenidos identificados, CSV, motivos de acciones bloqueadas y reintento de solicitudes inciertas con la misma intención. Conviene trasladar esas prácticas a moderación e integraciones.

| Superficie                | Revisado                                                                                  | Mejora específica y aceptación                                                                                                                                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Resumen                   | Rangos, CSV, freshness, métricas, estados, categorías, gráfico, tabla y errores retenidos | Jerarquizar Datos vigentes/atrasados y período antes de descargas. Etiquetar unidades y escala vertical del gráfico; conservar tabla accesible y huecos sin interpolar. Mantener explicación de CTR/eventos.                |
| Ejecuciones y solicitudes | Filtros separados, dos paginaciones, polling, vacíos y enlaces                            | Distinguir intención solicitada de intento ejecutado con agrupación visual más clara. Mantener filtros al volver del detalle. En móvil, comprobar bounds y desplazamiento interno con contenido largo y lector de pantalla. |
| Detalle de ejecución      | Fases, origen, duración, conteos desconocidos, fallo y retry actual                       | Dar prioridad a resultado y siguiente paso; relegar UUID/código a detalle técnico. Explicar que el reintento observa el presente, como ya hace el texto.                                                                    |
| Detalle de solicitud      | Estado, fechas, intentos, cancelación pendiente y seguimiento                             | Una secuencia aceptada → pendiente/en ejecución → resultado facilita lectura; usar progreso sólo si el contrato lo acredita. Conservar vínculo durable y diferencia entre cancelar pendiente y ejecución no cancelable.     |
| Operación                 | Salud, programación, presupuesto, actividad, run now/retry/cancel y permisos              | Ordenar estado y acción posible antes de seis cifras equivalentes; mostrar motivo junto a cada acción bloqueada. No convertir una solicitud aceptada en una supuesta carga terminada.                                       |
| Configuración             | Frecuencia, pausa, tolerancia, alertas, versionado, merge explícito y permisos editor     | Conservar protección de conflictos, añadir salida ante cambios pendientes y resumir efecto del nuevo horario. Mantener UTC y separación entre pausa automática y ejecución manual.                                          |
| Auditoría                 | Rango, paginación, actor, solicitud asociada y comparación antes/después                  | Presentar campos cambiados como diff legible; conservar actor técnico y considerar nombre autorizado si un contrato lo provee. Editor debe ver restricción comprensible y no el historial.                                  |

**Medición móvil de BI:** Resumen/Operación/Configuración dieron ancho de documento 360 en viewport 375. Ejecuciones dio 877, con tablas de aproximadamente 790/873 dentro de wrappers auto de 328. Esto requiere diagnóstico de contención y elementos posicionados: el número por sí solo no demuestra que las acciones se pierdan, ni que el scroll interno esté roto. No se atribuye como fallo visual definitivo de la tabla. La restricción de Auditoría para editor se observó; sus datos como admin se inspeccionaron en escritorio. Los detalles de solicitud/ejecución se comprobaron en escritorio y por código, no se completó su verificación móvil específica.

## Rutas preparatorias: inventario completo

Todas tienen heading y prosa de placeholder en inglés, no funcionalidades equivalentes a `/admin/*`. El layout `(dashboard)` es transparente, pero estas páginas sólo muestran texto preparatorio; no se infiere exposición de datos privados.

| Ruta preparatoria         | Destino o decisión recomendada                                                                       |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| `/login`                  | Redirigir a `/admin/login` si se desea mantener el alias.                                            |
| `/docs`                   | Documentación pública real de captura/publicación/integración o retirar la promesa de enlace.        |
| `/dashboard`              | Alias a `/admin` o exclusión hasta migración.                                                        |
| `/analytics`              | Alias a `/admin/analytics` o exclusión.                                                              |
| `/testimonials`           | Alias a `/admin/testimonials` o exclusión.                                                           |
| `/testimonials/[id]`      | Resolver un detalle real con autorización; no fingir que el placeholder es una pantalla de consulta. |
| `/testimonials/[id]/edit` | Mantener sólo cuando exista una ruta de edición real; hoy la edición vive en modal.                  |
| `/settings/users`         | Alias a `/admin/users` o exclusión.                                                                  |
| `/settings/webhooks`      | Alias a `/admin/webhooks` o exclusión.                                                               |
| `/settings/api-keys`      | Alias a `/admin/api-keys` o exclusión.                                                               |
| `/settings/feature-flags` | Decidir si capacidades serán informativas o editables; no prometer toggles operativos inexistentes.  |
| `/settings/integrations`  | Decidir una superficie real de integración; no confundirla con webhooks/API keys ya activos.         |

## Sistema visual y patrones transversales

- **Jerarquía:** serif para citas/títulos; sans para formularios, estados y tablas. Subir legibilidad de etiquetas operativas de 8–10 px según densidad real, sin imponer una regla de tamaño como sustituto de una prueba de accesibilidad.
- **Color:** estado semántico consistente y texto en español; la terracota identifica selección/acción principal, no todos los estados por igual. Los números y el color nunca deben ser la única explicación.
- **Contexto:** nombre y logo del espacio visibles en shell. No agregar selector de organizaciones sin membresías y contrato real que lo sostengan.
- **Feedback:** separar cargando, refrescando con datos retenidos, vacío inicial, sin resultados, error recuperable y acceso restringido. Replicar los patrones de BI/captura sin alertas repetitivas.
- **Formularios:** botones de navegación type button, errores junto al campo, reintento sin borrar texto, bloqueo de doble mutación y confirmación que identifica recurso. Feedback no debe desaparecer al refrescar.
- **Responsive:** en los listados medidos a 375 px el documento permaneció dentro del viewport y las tablas usaron scroll interno. Esto es evidencia positiva concreta; no generalizar el fallo del header de portada a todo el panel. Los diálogos de testimonio cabían en 375×812: detalle aproximadamente 375×731, con dos paneles de scroll y cierre de 16×16. Mejorar lectura y alcance táctil sin atribuir las transiciones de una captura a un recorte permanente.
- **Movimiento:** autoplay del hero requiere pausa/control y alternativa reducida; la protección de animate-fade-in-up no cubre automáticamente todas las animaciones/carrousels. Mantener transiciones breves de estado en administración.
- **Rendimiento:** conservar imágenes lazy/async, YouTube bajo demanda, cleanup de observers/player y polling visible de BI. Investigar el overlay de ruido montado globalmente y repetido en algunas superficies antes de asignarle un costo medido. No añadir memoización o cambiar librerías sin perfilado.
- **Componentes:** consolidar sólo los patrones activos que ya se repiten. `components/admin-dashboard.tsx`, NavLink y TestimonialSheet no forman el flujo activo; los placeholders de layout/feedback/navigation no deben confundirse con componentes ya adoptados. No se propone extraer un paquete UI sólo por tener duplicados.

## Secuencia recomendada de comandos Impeccable

La secuencia original se concretó en el [plan HITL aprobado](../plan/2026-10-14_feat-mejoras-integrales-frontend.md). Su fase 0 prepara documentación; las correcciones de UI siguen pendientes. Los verbos siguientes son workflows de la skill, no una afirmación de que todos sean subcomandos del binario.

1. **`impeccable harden` — testimonios y permisos:** F01–F05 y F17; incluir contrato backend de búsqueda y regresiones de submit accidental/editor/modal.
2. **`impeccable harden` — integraciones y catálogos:** F06–F09, F14–F15, F18–F20; rotación, vencimiento, revelación, borrado y configuración independiente.
3. **`impeccable clarify` — todas las pantallas:** F10–F11, F16, F20–F21 y F23; idioma, promesas y destinos reales, estados y alcance de datos.
4. **`impeccable adapt` y `audit` — sistema activo:** F12–F13 y F22; portada, cierres, contraste, semántica y verificación de tablas/diálogos en dispositivos pertinentes.
5. **`impeccable onboard` — inicio y vacíos:** recorrido de primera captura/publicación y ayuda de integración, conservando rutas reales.
6. **`impeccable layout` y `typeset` — panel/BI:** jerarquía de trabajo, lectura de datos y densidad operativa; preservar la identidad editorial.
7. **`impeccable optimize` — sólo con perfilado:** medir una build de producción y flujos representativos antes de cambiar arquitectura de rendimiento.
8. **`impeccable polish` — después de correcciones:** una pasada final acotada sobre las superficies modificadas.

Los comandos pueden ejecutarse individualmente o en el orden acordado. Volver a ejecutar audit después de las correcciones permite evaluar evidencia nueva; no interpretar un score mayor con otro alcance como mejora demostrada.

## Verificación necesaria para una corrección posterior

Regresiones de comportamiento prioritarias: paginar metadatos sin crear, editor moderando con permisos reales, consulta de una coincidencia fuera de página, detalle reconciliado, borrador preservado, expiración sin cambio de instante, rotación única, acceso al publicado número 21 y página válida después de eliminar. Añadir fixtures de límite/datos largos y comprobación de teclado/lector en los componentes afectados. No escribir pruebas que sólo reproduzcan detalles internos del código.

Esta entrega modifica documentación únicamente. No aplica mejoras a la UI, no cambia contratos, dependencias declaradas, esquema, infraestructura o configuración de despliegue, ni avanza fases de los planes existentes.

Commit sugerido: `docs(web): ampliá la auditoría impeccable a todas las interfaces`.
