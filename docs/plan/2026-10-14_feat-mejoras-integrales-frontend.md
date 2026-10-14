# Mejoras integrales del frontend — ejecución por fases HITL

**Inicio:** 2026-10-14. **Estado:** En progreso — fase 0 preparada; pendiente de commit y ACK humano.  
**Rama:** `codex/mejoras-integrales-frontend`. **Base:** `main`, `aa45b31`.  
**Issue:** no indicado; no inventar una referencia.  
**Autorización:** el usuario aprobó este plan en el chat y pidió implementarlo con una detención y un commit sugerido al finalizar cada fase. Esa instrucción autoriza comenzar únicamente la fase 0.

## 1. Contexto y restricciones

Leer antes de cada fase: [AGENTS.md](../../AGENTS.md), [llm.txt](../../llm.txt), [arquitectura](../technical/01_architecture.md), [reglas de negocio](../domain/business_rules.md), [auditoría integral](../technical/2026-10-14_frontend_auditoria_integral.md), [flujo Git](../collaboration/02_git_workflow.md) y especificaciones de los módulos afectados.

El objetivo es corregir los 24 grupos de hallazgos y aplicar las mejoras de UX, accesibilidad, responsive y claridad de las 15 pantallas activas, formularios, siete superficies de BI y doce rutas preparatorias. La matriz de este plan es el control de alcance; un detector sin hallazgos no sustituye su verificación.

### Decisiones humanas confirmadas

- Conservar crema, terracota, esquinas rectas e identidad editorial; mejorar la legibilidad del panel operativo.
- Incluir ampliaciones de API necesarias y controles que aprovechen endpoints existentes.
- Dejar moderación masiva, invitaciones por email, recuperación de contraseña y un widget nuevo para planes separados.
- Conservar precios, condiciones y testimonios comerciales no acreditados como borradores sin exposición pública; no inventar respaldo ni nuevas afirmaciones.
- Mantener Next.js 15, React 18, Tailwind, Radix, autenticación actual y aislamiento por tenant.
- No prever cambios de esquema, migraciones nuevas, infraestructura, hooks, manifiesto raíz ni librerías nuevas. Una necesidad sobrevenida requiere presentar cambio de alcance y obtener ACK específico.
- El agente sugiere commits; no crea commits ni hace push/PR/merge/despliegue automáticamente. El plan debe quedar registrado en un commit antes de implementar la fase 1.
- No persistir secretos, tokens, contraseñas o PII en documentos, contexto o evidencia. Usar fixtures sintéticas y controles de privacidad existentes.

### Skills por alcance

Aplicar [Impeccable](../../.agents/skills/impeccable/SKILL.md) y [git-engineering](../../.agents/skills/git-engineering/SKILL.md). Para implementación: [nextjs-frontend-engineering](../../.agents/skills/nextjs-frontend-engineering/SKILL.md), [react-interface-engineering](../../.agents/skills/react-interface-engineering/SKILL.md), [testing-tdd-engineering](../../.agents/skills/testing-tdd-engineering/SKILL.md), [node-next-api-engineering](../../.agents/skills/node-next-api-engineering/SKILL.md) y las skills de CSS/Tailwind, accesibilidad, seguridad, persistencia o BI pertinentes a la fase. Leer cada skill antes de aplicarla; no cargar todas por una coincidencia superficial.

Impeccable ya cargó contexto en esta sesión. En sesiones futuras seguir su setup una vez por sesión. No reemplazar la identidad ni ejecutar init/doctor como efecto lateral. Leer craft-floor inmediatamente antes de una edición de UI; aplicar el playbook correspondiente al trabajo real. Los verbos de la skill son workflows: no asumir que todos son subcomandos ejecutables del binario. Ejecutar el detector sobre targets cambiados según el workflow y conservar sus límites.

### Flujo obligatorio

1. Ejecutar exclusivamente la fase `[Actual]` y su autorización vigente.
2. Al terminar, informar cambios, pruebas, límites, pendientes y commit sugerido; detenerse.
3. Un ACK habilita únicamente la fase siguiente; un NACK mantiene la fase actual para correcciones.
4. La fase preparada conserva `[Actual]` con la nota pendiente de ACK; no repetirla ni avanzar por una continuación automática.
5. Después del ACK y de registrar el commit requerido, actualizar la fase anterior como completada y marcar sólo la siguiente `[Actual]`.
6. El ACK de cierre de la fase 12 permite marcar el plan completado. No confundir implementación, validación local, ACK, commit y CI.

Los commits siguen Conventional Commits con type/scope en inglés y descripción en español rioplatense con voseo. Prevalece AGENTS.md sobre ejemplos históricos de templates.

## 2. Contratos y comportamiento acordados

Todas las ampliaciones serán compatibles con clientes actuales. Mantener `data[]` más `meta` en respuestas paginadas, validación en adaptadores, Problem Details, autorización API y filtro por tenant en consultas/conteos.

| Área                        | Cambio acordado                                                                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Testimonios administrativos | Búsqueda por autor/contenido, estado, categoría, etiquetas y orden reciente/relevancia. Etiquetas con AND. Filtrar antes de paginar; total filtrado y desempate estable por ID.                                    |
| Catálogos                   | Búsqueda paginada y cantidad de testimonios asociados por categoría/etiqueta. Conteos de asociaciones en todo el tenant, etiquetados como tales. Selectores independientes de los testimonios de la página actual. |
| Inicio                      | Resumen administrativo con total y cantidades por estado. Recientes consultados por separado; no presentar conteos parciales como globales.                                                                        |
| Permisos                    | Tipar `createdById`, ya devuelto por API. Separar presentación de permisos de moderar, editar, adjuntar y eliminar según rol, propiedad y estado. No ampliar reglas del backend para acomodar botones.             |
| Detalle                     | Apertura por URL con identificador validado aunque el recurso no esté en la página cargada. Reutilizar desde analítica y aliases. No convertir un 403/404 en un detalle vacío exitoso.                             |
| Galería pública             | Consumir paginación pública existente. Obtener nombre/logo desde información pública existente incluso cuando la recepción esté cerrada.                                                                           |
| Analítica                   | Período acumulado y momento de observación; eventos con referencia autorizada, autor y extracto sin consulta por fila. Límite de eventos recientes explícito.                                                      |
| Operaciones existentes      | Renombrado de catálogos, activación/desactivación de usuarios, edición/pausa de webhooks, nombre del espacio y feature flags mediante endpoints vigentes.                                                          |
| Credenciales                | Secretos sólo en memoria, revelación única, vencimientos correctos y descripción fiel de gracia. No cambiar criptografía, políticas de expiración ni controles de concurrencia existentes.                         |

Documentar cambios de contrato en las especificaciones de módulos y probar compatibilidad de consultas existentes sin parámetros nuevos. Mantener consultas limitadas; no resolver paginación trayendo un catálogo ilimitado. No inventar tiempos, porcentajes de progreso, conversiones causales ni métricas de negocio.

## 3. Fases de ejecución

### [Actual] Fase 0 — Rama, plan y trazabilidad

**Estado de ejecución:** preparada; pendiente de commit y ACK. No autoriza la fase 1.

- [x] Comprobar Git y crear/cambiar a `codex/mejoras-integrales-frontend` desde `main` actual, preservando informes existentes.
- [x] Guardar el plan aprobado, decisiones y registro en el índice.
- [x] Incorporar matrices de hallazgos, oportunidades, rutas y superficies, con pruebas y estados.
- [x] Revisar matices de informes antes de convertirlos en requisitos: webhooks ya posee controles backend de concurrencia y gracia; corregir su descripción sin declarar resuelto el problema de interacción.
- [x] Registrar baseline, resultados y límites en la sección 7.
- [x] Preparar sólo documentación y evidencia saneada; conservar la captura histórica de critique como archivo de la evaluación original.

**Cierre:** rama correcta, plan revisable, matrices completas y documentación preparada para commit antes de modificar implementación.

**Commit:** `docs(plan): definí las fases de mejora integral del frontend`  
**ACK humano:** pendiente. **Commit registrado:** pendiente.  
**Detenerse y esperar ACK.**

### [Pendiente] Fase 1 — Moderación y formularios críticos

**Cubre:** F01, F02, F04, F05.

- [ ] Declarar type button en paginación y auxiliares dentro de formularios.
- [ ] Habilitar moderación para editor según contrato; conservar edición por propiedad y restricciones de publicados.
- [ ] Reconciliar detalle, lista e inicio con la respuesta confirmada de cada mutación.
- [ ] Reintentar metadatos dentro del formulario sin borrar texto.
- [ ] Proteger cierre/Escape con cambios pendientes y bloquear dobles envíos.
- [ ] Explicar aprobación, publicación, rechazo y ocultamiento con estados en español.

**Cierre/pruebas:** paginar con campos válidos y varias páginas no crea; editor modera sin ganar permisos administrativos; detalle cambia sin reabrir; fallos/reintentos conservan borrador. Tests de comportamiento y contratos afectados; no atribuir a fixtures aceptación de backend real.

**Commit:** `fix(testimonials): corregí la moderación y preservá los borradores`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 2 — Base visual, accesibilidad y feedback compartido

**Cubre:** F13 y parte transversal de F22.

- [ ] Corregir parejas de color claro/oscuro y unificar estados semánticos.
- [ ] Usar sans en controles/datos y conservar serif en citas/títulos.
- [ ] Añadir anuncios de carga/resultado, rating textual, expansión semántica, skip link y foco consistente.
- [ ] Localizar cierres y ampliar áreas táctiles; revisar tablas, diálogos y menú móvil.
- [ ] Proteger storage y mantener funcionamiento en memoria si falla.
- [ ] Unificar confirmaciones destructivas y estados ocupado/error/éxito mediante componentes activos.

**Cierre/pruebas:** teclado/foco de controles modificados, contraste de combinaciones efectivas en ambos temas, carga anunciada sin ruido, storage denegado sin caída. Verificar móvil y movimiento reducido. No certificar WCAG sólo con controles automáticos.

**Commit:** `fix(web): unificá accesibilidad, estados y contraste`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 3 — Búsqueda global, revisión e inicio operativo

**Cubre:** F03 y mejoras de testimonios/inicio.

- [ ] Implementar contratos de búsqueda, catálogos y resumen de la sección 2.
- [ ] Llevar búsqueda, filtros, orden y página a URL; cancelar/descartar respuestas obsoletas.
- [ ] Añadir estado, limpiar consulta y selectores globales paginados.
- [ ] Corregir páginas que pierden su último resultado.
- [ ] Añadir detalle enlazable y siguiente/anterior dentro de la consulta.
- [ ] Priorizar pendientes, separar borradores y mostrar totales/recientes con alcance explícito.
- [ ] Incorporar eliminación confirmada por endpoint vigente y permisos reales.

**Cierre/pruebas:** coincidencia originalmente fuera de página accesible desde página 1; AND de etiquetas; URL/total/resultados coherentes; desempates estables; conteos globales; tenant ajeno excluido; detalle fuera de página y 403/404; borrado autorizado y confirmación. Probar compatibilidad de consultas anteriores.

**Commit:** `feat(testimonials): agregá búsqueda global y revisión contextual`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 4 — Categorías, etiquetas y usuarios

**Cubre:** F06, F16, F17, F18.

- [ ] Integrar búsqueda, renombrado y conteos de asociaciones de catálogos.
- [ ] Confirmar eliminación explicando efecto y mostrar acciones en dispositivos táctiles.
- [ ] Conservar página válida después de crear/eliminar.
- [ ] Usar Crear usuario y explicar contraseña/permisos efectivos.
- [ ] Activar/desactivar otras cuentas con confirmación; impedir controles de desactivación/eliminación propia.
- [ ] Verificar rechazo backend de cuentas desactivadas.
- [ ] No ofrecer edición de rol: el DTO por sí solo no acredita implementación completa del contrato.

**Cierre/pruebas:** asociaciones tenant correctas, cancelación sin DELETE, eliminación sin testimonios borrados, última página válida, requisitos de contraseña anticipados, acceso de cuenta desactivada rechazado y acciones propias protegidas. Ejemplos opcionales por programa/cohorte, sin taxonomía obligatoria ni datos reales de alumnos.

**Commit:** `feat(admin): mejorá catálogos y gestión de usuarios`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 5 — API keys

**Cubre:** F08, F14, F15.

- [ ] Convertir UTC/hora local correctamente y preservar instante si no se edita.
- [ ] Distinguir Activa, Vencida y Revocada con acciones pertinentes.
- [ ] Proteger revelación al iniciar otra operación, cerrar o navegar.
- [ ] Identificar integración en confirmaciones/revelaciones.
- [ ] Bloquear operaciones pendientes y explicar gracia efectiva, limitada por vencimientos.
- [ ] Conservar scopes comprensibles y copia manual como recuperación.

**Cierre/pruebas:** rotación sin desplazamiento en UTC y Argentina; estados diferenciados; fallo siguiente conserva revelación; doble operación bloqueada; clipboard denegado recuperable; secretos ausentes de storage/logs/evidencia. No generar credenciales reales para capturas.

**Commit:** `fix(api-keys): corregí vencimientos y protegé la revelación`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 6 — Webhooks

**Cubre:** F07, F20.

- [ ] Bloqueo de mutación pendiente por destino y feedback ocupado.
- [ ] Identificar URL/evento en revelación, historial y confirmaciones.
- [ ] Mantener destino/página al actualizar y reintentar historial.
- [ ] Traducir estados y mostrar intentos en detalle expansible.
- [ ] Integrar edición HTTPS/evento y pausa/reactivación por PATCH vigente.
- [ ] Guiar crear, configurar receptor, probar y comprobar resultado; separar encolado de entregado.
- [ ] Preservar SSRF, firma, CAS/concurrencia y gracia del backend.

**Cierre/pruebas:** una sola operación pendiente por destino, respuestas tardías no contaminan otro recurso, conflicto 409 comprensible, actualización conserva página, intentos accesibles y reactivación respeta firma/HTTPS. Entregas externas simuladas no acreditan proveedor real.

**Commit:** `feat(webhooks): mejorá configuración y seguimiento de entregas`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 7 — Configuración, marca y primera puesta en marcha

**Cubre:** F19 y onboarding/contexto.

- [ ] Separar carga/guardado de marca, logo, enlace, recepción y capacidades.
- [ ] Conservar slug pendiente durante operaciones independientes.
- [ ] Mantener confirmaciones tras refresco y salida clara antes de eliminar logo.
- [ ] Integrar nombre y controles administrativos reales de feature flags.
- [ ] Distinguir enlace configurado de recepción abierta; explicar scoring real.
- [ ] Mostrar organización persistente en shell, sin selector multiempresa nuevo.
- [ ] Añadir recorrido opcional de configuración/captura/revisión/publicación con progreso derivado de datos reales.

**Cierre/pruebas:** fallo de flags no bloquea marca/enlace; logo no sobrescribe draft del slug; mensaje/foco sobreviven al refresco; guardar/activar flags respeta permisos; progreso no promete tareas inexistentes ni usa estado ficticio persistido.

**Commit:** `feat(settings): mejorá la configuración y la puesta en marcha`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 8 — Login y registro

**Cubre:** F10 y semántica de autenticación.

- [ ] Campos vacíos y sin credenciales preseleccionadas.
- [ ] No ofrecer demo sin entorno real configurado.
- [ ] Main, título visible móvil, regreso y errores asociados.
- [ ] Requisitos de contraseña anticipados.
- [ ] Voseo y términos de espacio/cuenta administradora consistentes.
- [ ] Preservar cookies, CSRF, sesión y redirecciones.

**Cierre/pruebas:** datos de ejemplo no se envían por omisión; errores conservan campos; teclado móvil; sesión, refresh y logout sin regresiones. No construir recuperación de contraseña ni invitaciones.

**Commit:** `fix(auth): aclará el acceso y eliminá valores preseleccionados`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 9 — Captura y galería públicas

**Cubre:** F09 y parte pública de F22.

- [ ] Marca, paginación/cargar más y alcance visible en galería.
- [ ] Retirar rótulos de telemetría de la presentación.
- [ ] Tracking independiente de lectura y resistente a storage fallido.
- [ ] Rating textual, expansión semántica y carga anunciada.
- [ ] Calificación deliberada y límites de adjuntos antes de seleccionar.
- [ ] Preservar recepción completa/parcial, texto ante error y foco.
- [ ] Conservar lazy/async de imágenes, YouTube bajo demanda y fallback.

**Cierre/pruebas:** publicado 21 alcanzable; recepción cerrada no impide marca/galería; vacío/error/final diferenciados; rating requerido; fallo de adjunto no induce duplicación; bloqueo de storage/tracking no impide lectura.

**Commit:** `feat(public): mejorá la captura y la galería de testimonios`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 10 — Analítica y las siete superficies de BI

**Cubre:** F21, F24 y mejoras BI.

- [ ] Período acumulado, observación y límite de eventos en Analítica.
- [ ] Autor/extracto y detalle autorizado, sin consultas por fila.
- [ ] Vacíos vinculados con publicación/distribución.
- [ ] Jerarquía de vigencia/resultado/acción y escala/unidades del gráfico BI.
- [ ] Solicitudes diferenciadas de intentos; estados sin porcentajes inventados.
- [ ] Proteger draft de configuración al navegar y preservar recuperación de conflictos.
- [ ] Auditoría con diferencias legibles y detalle técnico secundario.
- [ ] Contener tablas móviles sin perder URL, CSV, UTC, polling o resultados inciertos.

**Cierre/pruebas:** período/alcance reales, referencias tenant correctas, ausencia de N+1, gráficos con cortes ausentes distintos de cero, draft protegido y conflictos recuperables; roles admin/editor; CSV y polling existentes sin regresiones.

**Commit:** `feat(analytics): clarificá métricas y operación de inteligencia de negocio`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 11 — Landing, ayuda y rutas preparatorias

**Cubre:** F11, F12, F23.

- [ ] Destinos reales y header/titulares/CTA móviles corregidos.
- [ ] Capacidades y funcionamiento verificados como contenido principal.
- [ ] Conservar marketing no acreditado como borradores no montados y sin URL pública.
- [ ] Ayuda real en /docs para captura, moderación, publicación, API keys y webhooks, sin secretos ni widget nuevo prometido.
- [ ] Aliases a rutas activas; detalle/edición por entrada contextual autorizada.
- [ ] Flags/integraciones dirigidos a secciones reales de configuración.
- [ ] Retirar enlaces legales/contacto sin contenido aprobado; pausa de autoplay y reduced motion.

**Cierre/pruebas:** CTA y navegación producen su resultado; no hay placeholders públicos; aliases conservan autorización; borradores comerciales no renderizados; teclado, zoom y 320/375/768 px sin pérdida de acciones.

**Commit:** `feat(web): conectá la landing y reemplazá rutas preparatorias`  
**ACK humano:** pendiente. **Detenerse y esperar ACK.**

### [Pendiente] Fase 12 — Rendimiento, validación integral y cierre

- [ ] Medir build de producción, rutas representativas y medios/polling.
- [ ] Eliminar overlays duplicados y corregir costos demostrados sin refactors especulativos.
- [ ] Completar matriz de rutas/roles/estados/tamaños/temas.
- [ ] Polish acotado y nueva auditoría/detector del código final según skill.
- [ ] Actualizar documentación y trazabilidad F01–F24 con límites explícitos.
- [ ] Preparar cierre para integración y comprobar checks del SHA correspondiente sin desplegar.

**Cierre/pruebas:** ningún punto acordado queda sin resolución o exclusión humana explícita; suite completa y E2E vigentes; tipos/lint/build y evidencia saneada; no comparar scores de alcances diferentes como si probaran mejora.

**Commit:** `perf(web): optimizá y validá la experiencia integral`  
**ACK humano de cierre:** pendiente. **Detenerse y esperar ACK.**

## 4. Matriz de hallazgos F01–F24

Estado inicial de toda implementación: **pendiente**. La auditoría y la preparación no cuentan como corrección. Las fases indicadas son propietarias; el cierre integral comprueba regresiones sin implementar anticipadamente otras fases.

| ID  | Hallazgo                                           | Fase propietaria                 | Prueba/aceptación mínima                                                   | Estado    |
| --- | -------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- | --------- |
| F01 | Editor sin moderación                              | 1                                | Positivo editor; negativos de rol/propiedad; transiciones API respetadas   | Pendiente |
| F02 | Paginación submit dentro del alta                  | 1                                | Varias páginas y formulario válido; sin POST ni validación accidental      | Pendiente |
| F03 | Búsqueda/filtros de página                         | 3                                | Coincidencia fuera de página, AND, total y URL coherentes, tenant negativo | Pendiente |
| F04 | Detalle anterior tras mutación                     | 1                                | Estado/contenido/medios actualizados sin reabrir                           | Pendiente |
| F05 | Recuperación descarta borrador                     | 1                                | Reintento y cierre con decisión; texto preservado                          | Pendiente |
| F06 | Borrado de categoría sin advertir desclasificación | 4                                | Cancelar sin DELETE; confirmar conserva testimonios sin categoría          | Pendiente |
| F07 | Rotación webhook sin busy guard/contexto           | 6                                | Un intento UI por destino; conflictos y respuestas tardías tratados        | Pendiente |
| F08 | Vencimiento cambia por UTC/local                   | 5                                | UTC/Argentina; guardar intacto preserva instante                           | Pendiente |
| F09 | Publicados posteriores a veinte inaccesibles       | 9                                | Publicado 21 y final/paginación real                                       | Pendiente |
| F10 | Registro precompletado                             | 8                                | Campos vacíos; validación evita alta accidental                            | Pendiente |
| F11 | CTA y enlaces sin destino                          | 11                               | Navegación/acción real; marketing borrador no renderizado                  | Pendiente |
| F12 | Desborde de portada                                | 11                               | 320/375/768 px, zoom y acciones alcanzables                                | Pendiente |
| F13 | Contraste dark                                     | 2                                | Parejas reales y estados de ambos temas                                    | Pendiente |
| F14 | Vencida aparece revocada                           | 5                                | Estados diferenciados y acciones pertinentes                               | Pendiente |
| F15 | Revelación anterior perdida                        | 5                                | Error siguiente preserva secreto en memoria; salida deliberada             | Pendiente |
| F16 | Invitar y contraseña mal explicados                | 4                                | Crear usuario describe resultado; requisitos y errores asociados           | Pendiente |
| F17 | Última página inválida                             | 3 en testimonios; 4 en catálogos | Último elemento eliminado y página corregida                               | Pendiente |
| F18 | Borrado y acciones de etiquetas                    | 4                                | Decisión explícita, efecto real y controles táctiles descubribles          | Pendiente |
| F19 | Configuración acoplada/draft y mensaje perdidos    | 7                                | Fallas independientes, slug y confirmación/foco conservados                | Pendiente |
| F20 | Historial/secreto webhook sin contexto             | 6                                | Recurso identificado y actualización conserva página                       | Pendiente |
| F21 | Analítica sin período/referencia útil              | 10                               | Alcance real y datos autorizados sin N+1                                   | Pendiente |
| F22 | Semántica, storage, cargas y cierres               | 2 común; 8 auth; 9 público       | Roles/foco/rating/expansión, storage denegado y main/título móvil          | Pendiente |
| F23 | Doce rutas preparatorias expuestas                 | 11                               | Aliases/contenido útil; autorización y ausencia de placeholders            | Pendiente |
| F24 | Draft BI descartado al navegar                     | 10                               | Conservar/descartar explícito; conflicto mantiene intención                | Pendiente |

## 5. Matriz de oportunidades de diseño

Cada fila agrupa una oportunidad de la auditoría por superficie, sin inventar capacidades. El estado de todas es pendiente de implementación/validación. Las capacidades expresamente excluidas no se considerarán una omisión al cerrar este plan.

| ID  | Superficie/oportunidad                                        | Fase         | Evidencia de aceptación                                                             | Estado    |
| --- | ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | --------- |
| O01 | Landing: funcionamiento claro, CTA útil y pruebas reales      | 11           | Primer viewport comprensible, destinos reales, borradores fuera del render          | Pendiente |
| O02 | Login: tarea visible, regreso y demo diferenciada             | 8            | Main/h1 móvil, campos vacíos, no demo ficticia                                      | Pendiente |
| O03 | Registro: espacio/cuenta y requisitos claros                  | 8            | Lenguaje, expectativas y errores junto al campo                                     | Pendiente |
| O04 | Inicio: pendientes, alcance y primera acción                  | 3, 7         | Totales globales, borradores separados y onboarding derivado                        | Pendiente |
| O05 | Listado: estado, consulta global y detalle contextual         | 3            | URL, filtros, limpiar y siguiente/anterior coherentes                               | Pendiente |
| O06 | Alta: contenido principal y clasificación progresiva          | 1, 2         | Borrador recuperable, móvil y preview sin dominar escritura                         | Pendiente |
| O07 | Detalle: estado español y acción siguiente                    | 1, 3         | Mutación confirmada, permisos, visibilidad pública y eliminación informada          | Pendiente |
| O08 | Categorías: renombrado y asociaciones                         | 4            | Conteo global etiquetado, borrar/renombrar reales                                   | Pendiente |
| O09 | Etiquetas: búsqueda y complemento de categoría                | 4            | Crear/renombrar sin depender de página; ejemplos opcionales                         | Pendiente |
| O10 | Usuarios: acción real y estado de acceso                      | 4            | Alta directa clara; activar/desactivar; restricciones propias                       | Pendiente |
| O11 | API keys: integración, vencimiento y recorrido de rotación    | 5            | Contexto, gracia fiel y revelación protegida                                        | Pendiente |
| O12 | Webhooks: receptor, prueba, entrega e intentos                | 6            | Configurar y diagnosticar sin recordar fila anterior                                | Pendiente |
| O13 | Analítica: historia reconocible y alcance                     | 10           | Período, referencia y vacío con acción útil                                         | Pendiente |
| O14 | Ajustes: marca/captura/capacidades independientes             | 7            | Guardados independientes; scoring real; capacidades operables                       | Pendiente |
| O15 | Captura: marca, rating deliberado y límites previos           | 9            | Validación, parcial/completo y foco sin duplicados                                  | Pendiente |
| O16 | Galería: identidad, lectura y cantidad                        | 9            | Marca, cargar más, semántica y ausencia de rótulos de telemetría                    | Pendiente |
| O17 | BI resumen: vigencia, unidades y cortes                       | 10           | Jerarquía, ejes/unidades, tabla accesible y huecos no interpolados                  | Pendiente |
| O18 | BI ejecuciones: intención vs intento                          | 10           | Agrupación, filtros preservados, dos paginaciones y scroll contenido                | Pendiente |
| O19 | BI detalle ejecución: resultado y recuperación                | 10           | Acción actual comprensible; UUID/código secundarios                                 | Pendiente |
| O20 | BI detalle solicitud: seguimiento durable                     | 10           | Estados fieles sin porcentajes inventados; cancelar sólo pendiente                  | Pendiente |
| O21 | BI operación: acción posible antes de cifras                  | 10           | Motivo junto a bloqueo; aceptada no se presenta como terminada                      | Pendiente |
| O22 | BI configuración: efecto, draft y conflicto                   | 10           | Salida deliberada, UTC, merge explícito y pausa/manual diferenciados                | Pendiente |
| O23 | BI auditoría: cambios legibles                                | 10           | Diff antes/después y actor técnico preservado; editor restringido                   | Pendiente |
| O24 | Sistema visual: densidad, estado, contexto, foco y movimiento | 2, 7, 11, 12 | Identidad conservada, controles legibles, organización persistente y reduced motion | Pendiente |
| O25 | Rendimiento: lazy, cleanup, polling y overlays                | 12           | Medición de producción y cambios motivados; no memoización especulativa             | Pendiente |
| O26 | Preparación ruteada: aliases y ayuda real                     | 11           | Doce decisiones resueltas sin construir doce flujos alternativos                    | Pendiente |

No añadir nombre personal del actor a BI sin un contrato autorizado que lo aporte. Mantener actor técnico como dato secundario. No implementar fusión de etiquetas, cambio de rol, borrado de medios sin endpoint ni un sistema de membresías multiempresa como ampliaciones implícitas.

## 6. Matriz de rutas y superficies

**Cobertura de ruta:** código, estados y pruebas asignados. No marcar una fila validada sólo por abrir la ruta. En cada pantalla aplican carga, éxito, vacío cuando corresponda, error recuperable, autorización, teclado y tamaño/contenido límite. Usar datos sintéticos. Estado inicial de todas: pendiente.

| Ruta activa                    | Fases propietarias | Verificación específica                                               | Estado    |
| ------------------------------ | ------------------ | --------------------------------------------------------------------- | --------- |
| `/`                            | 11                 | Header/CTA, anchors, borradores, autoplay, mobile/zoom                | Pendiente |
| `/admin/login`                 | 8                  | Vacío, errores, sesión/refresh/logout y semántica móvil               | Pendiente |
| `/admin/register`              | 8                  | Campos vacíos, contraseña, alta y errores preservados                 | Pendiente |
| `/admin`                       | 3, 7               | Resumen real, recientes, pendientes y onboarding según rol            | Pendiente |
| `/admin/testimonials`          | 1, 2, 3            | Consulta/detalle/alta/edición/moderación/medios/eliminación y roles   | Pendiente |
| `/admin/categories`            | 4                  | Buscar/crear/renombrar/eliminar, asociaciones y página                | Pendiente |
| `/admin/tags`                  | 4                  | Buscar/crear/renombrar/eliminar y tablet táctil                       | Pendiente |
| `/admin/users`                 | 4                  | Alta, contraseña, estado de acceso, confirmación y rol                | Pendiente |
| `/admin/api-keys`              | 5                  | Scopes/fechas/estado/revelación/copia/revocación/rotación             | Pendiente |
| `/admin/webhooks`              | 6                  | Alta/edición/pausa/prueba/rotación/historial/replay y legado          | Pendiente |
| `/admin/settings`              | 7                  | Marca/logo/slug/recepción/capacidades y fallas independientes         | Pendiente |
| `/admin/analytics`             | 10                 | Período/eventos/referencias/alcance/vacío/error                       | Pendiente |
| `/admin/business-intelligence` | 10                 | Siete superficies de la tabla siguiente, URL/CSV/polling/roles        | Pendiente |
| `/p/[slug]`                    | 9                  | Marca, cerrado/no disponible, rating/medios, recepción parcial y foco | Pendiente |
| `/t/[slug]`                    | 9                  | Marca, 21 publicados, detalle/media, tracking/storage y vacío/error   | Pendiente |

### Siete superficies BI

| Superficie                | Fase | Aceptación                                                       | Estado    |
| ------------------------- | ---- | ---------------------------------------------------------------- | --------- |
| Resumen                   | 10   | Rango/freshness/CSV/gráfico/tabla; ausente distinto de cero      | Pendiente |
| Ejecuciones y solicitudes | 10   | Filtros y dos páginas preservados; tracking visible y contención | Pendiente |
| Detalle de ejecución      | 10   | Resultado/fase/conteos y reintento actual; error recuperable     | Pendiente |
| Detalle de solicitud      | 10   | Estado/fechas/intentos; cancelación pendiente y vínculo durable  | Pendiente |
| Operación                 | 10   | Salud/presupuesto/actividad y motivos de acciones/roles          | Pendiente |
| Configuración             | 10   | Draft, conflictos, frecuencia/pausa/tolerancia y permisos        | Pendiente |
| Auditoría                 | 10   | Rango/página/diff/actor y restricción editor                     | Pendiente |

### Doce rutas preparatorias

Las redirecciones no deben eliminar autorización ni crear loops; validar identificadores y query de contexto. La fase 11 define e implementa destinos coherentes con las entradas completadas en fases anteriores.

| Ruta                      | Destino/comportamiento acordado                                                    | Fase | Estado    |
| ------------------------- | ---------------------------------------------------------------------------------- | ---- | --------- |
| `/login`                  | Alias a `/admin/login`                                                             | 11   | Pendiente |
| `/docs`                   | Ayuda pública real; deja de ser placeholder                                        | 11   | Pendiente |
| `/dashboard`              | Alias a `/admin`                                                                   | 11   | Pendiente |
| `/analytics`              | Alias a `/admin/analytics`                                                         | 11   | Pendiente |
| `/testimonials`           | Alias a `/admin/testimonials`                                                      | 11   | Pendiente |
| `/testimonials/[id]`      | Entrada contextual autorizada en testimonios                                       | 11   | Pendiente |
| `/testimonials/[id]/edit` | Entrada contextual de edición con permisos/estado reales                           | 11   | Pendiente |
| `/settings/users`         | Alias a `/admin/users`                                                             | 11   | Pendiente |
| `/settings/webhooks`      | Alias a `/admin/webhooks`                                                          | 11   | Pendiente |
| `/settings/api-keys`      | Alias a `/admin/api-keys`                                                          | 11   | Pendiente |
| `/settings/feature-flags` | Sección real de capacidades en configuración                                       | 11   | Pendiente |
| `/settings/integrations`  | Sección real de integraciones en configuración con accesos a claves/webhooks/ayuda | 11   | Pendiente |

### Formularios y estados compartidos

| Superficie                        | Fase           | Pruebas adicionales                                                 | Estado    |
| --------------------------------- | -------------- | ------------------------------------------------------------------- | --------- |
| Crear testimonio                  | 1, 2, 3        | Paginación sin submit, metadatos fallidos, dirty/Escape y móvil     | Pendiente |
| Editar/detalle/moderar            | 1, 2, 3        | Propiedad/estado, respuesta actualizada, notas y siguiente/anterior | Pendiente |
| Adjuntos administrativos          | 1, 2           | Carga/error/doble envío, no editar publicado, datos actualizados    | Pendiente |
| Alta/renombrado de catálogos      | 4              | Datos conservados, errores y asociaciones                           | Pendiente |
| Alta/estado de usuario            | 4              | Requisitos, rol, cuenta propia y acceso suspendido                  | Pendiente |
| Alta/rotación/revelación API key  | 5              | Instante intacto, secreto en memoria y salida deliberada            | Pendiente |
| Alta/edición/rotación webhook     | 6              | Destino identificado, busy/conflicto/legado y firma                 | Pendiente |
| Historial y replay webhook        | 6              | Página/destino, intentos, accepted vs entregado                     | Pendiente |
| Logo y configuración              | 7              | MIME/tamaño/preview, error/conflicto, slug y éxito persistentes     | Pendiente |
| Shell/Sheet/diálogos              | 2, 7           | Contexto, foco, Escape, targets y roles                             | Pendiente |
| Feedback/paginación/boundary/tema | 1, 2, 3, 4, 12 | Estados anunciados, retry, páginas válidas y storage denegado       | Pendiente |

## 7. Registro de fase 0 y baseline

### Estado inicial comprobado

- Rama inicial `main`, HEAD `aa45b31`; sin cambios tracked y sin otra rama local con el nombre propuesto.
- Archivos previos no registrados: los dos informes de frontend y un snapshot histórico `.impeccable/critique/2026-10-14T03-28-17Z__apps-web-src.md`. Se preservan; no son archivos de otra tarea.
- Rama creada y seleccionada: `codex/mejoras-integrales-frontend`. El primer intento fue rechazado por filesystem sandbox; el reintento con escalamiento técnico autorizado creó la referencia. No hubo rechazo del revisor automático.
- Runtime: Node `24.21.0`, npm `11.19.0`.
- Esta fase no cambia código, paquetes, esquema, infraestructura ni hooks; no ejecuta migraciones o despliegues.

### Resultados de validación de esta fase

Los resultados se registran al terminar la preparación. No reutilizar como baseline actual los números o CI de documentos históricos. Descubrir E2E no significa ejecutarlo.

| Control                                                           | Resultado                                                                                                                 | Límite                                                                                                                       |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `npm run typecheck --workspace @testimonial-cms/web`              | Aprobado, exit 0                                                                                                          | No valida API ni recursos remotos                                                                                            |
| `npm run lint --workspace @testimonial-cms/web`                   | Exit 0: cero errores y diez advertencias preexistentes                                                                    | Imágenes y variables sin uso; no se suprimieron ni se modificaron archivos de aplicación                                     |
| `npm run test --workspace @testimonial-cms/web -- --maxWorkers=2` | 176/176 tests y 27/27 archivos aprobados; sin fallos ni omisiones; 49,20 s                                                | Entorno jsdom. Aviso Vite sobre carga futura de configuración, sin cambios para ocultarlo. No equivale a integración backend |
| `npm run test:e2e:list --workspace @testimonial-cms/web`          | Exit 0: seis recorridos en dos archivos, cuatro desktop y dos mobile                                                      | Sólo descubrimiento; no inicia DB ni acredita ejecución                                                                      |
| Formato documental, enlaces/matrices y diff                       | Aprobados: Prettier, enlaces locales, 24 hallazgos, 26 oportunidades, 27 rutas, siete superficies BI y `git diff --check` | No acredita implementación futura                                                                                            |
| API, build de producción, E2E real, CI y proveedores              | No ejecutados en fase 0 documental                                                                                        | No se declaran aprobados                                                                                                     |

## 8. Validación por fase y aceptación final

- TDD proporcional: observar Red funcional de regresiones/lógica nueva, Green y refactor conservando contratos; evitar tests espejo de implementación.
- Tipos/lint/formato afectados; declarar warnings previos. No ejecutar formatter global para arreglar archivos ajenos.
- Integración real para contratos, aislamiento y permisos; datos/servicios sintéticos se identifican como tales.
- Una ronda visual agrupada desktop/móvil, claro/oscuro y teclado en superficies modificadas; corregir en bloque y confirmar como máximo una ronda adicional por ciclo según Impeccable.
- Escenarios mínimos: paginar sin crear, editor moderando, búsqueda fuera de página, detalle reconciliado, borrador preservado, eliminación informada, página válida, UTC intacto, revelación protegida, rotación bloqueada, publicado 21, ajustes independientes, storage denegado, draft/conflicto BI y aliases autorizados.
- Conservar seis E2E obligatorios y ampliar assertions pertinentes sin desactivar gates ni privacidad. Una nueva identificación de caso requeriría actualizar su control de integridad explícitamente, no omitir casos para pasar.
- Las migraciones del harness descartable requieren ACK humano específico antes de ejecutarse. Aprobar este plan o una fase no sustituye ese permiso; no usar DB persistente ni destinos externos como alternativa.
- CI debe validar servicios reales y SHA final antes de integrar; no trasladar verde de otro SHA. Build/fixtures/capturas no certifican proveedores, WCAG ni rendimiento de campo.
- Mantener documentación de comandos/resultados/omisiones por fase; leer módulos afectados y actualizar contratos cuando cambien.
- Definition of Done: matrices resueltas, pruebas proporcionales aprobadas, CI correspondiente comprobado cuando exista integración autorizada, límites declarados y ACK de cierre humano. No crear PR o desplegar sin instrucción posterior.

## 9. Cambios y desviaciones de alcance

Registrar aquí cualquier exclusión o modificación aprobada, con fecha, razón y ACK. Estado inicial: ninguna desviación. Corrección editorial del plan aprobado: el commit de fase 8 queda escrito correctamente como `fix(auth): aclará el acceso y eliminá valores preseleccionados`.
