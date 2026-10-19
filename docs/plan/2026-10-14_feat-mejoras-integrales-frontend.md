# Mejoras integrales del frontend — ejecución por fases HITL

**Inicio:** 2026-10-14. **Estado:** En progreso — fase 12 implementada y validada localmente, preparada para commit y ACK; fase 11 registrada en `fa7838b` y aprobada. Aceptación integral pendiente: servicios reales, seis E2E y CI del SHA final.

**Rama:** `codex/mejoras-integrales-frontend`. **Base:** `main`, `aa45b31`.  
**Issue:** no indicado; no inventar una referencia.  
**Autorización:** el usuario aprobó este plan en el chat y pidió implementarlo con una detención y un commit sugerido al finalizar cada fase. El ACK «Continuar» del 2026-10-15, posterior al commit de fase 2 (`9ec32c4`), autorizó la fase 3. El ACK «Continuar» del 2026-10-17, posterior al commit `263fd55`, autoriza únicamente la fase 4. El ACK «Continuar» posterior al commit `a9ab823` autoriza únicamente la fase 5. El ACK «Continuar» del 2026-10-18 posterior a `52e4800` autoriza únicamente la fase 6. El ACK «Continuar» del 2026-10-18 posterior a `24b64b6` autoriza únicamente la fase 7. El ACK «Continuar» del 2026-10-18 posterior a `8152850` autoriza únicamente la fase 8. El ACK «Continuar» del 2026-10-18 posterior a `b665226` autoriza únicamente la fase 9. El ACK «Continuar» del 2026-10-18 posterior a `380cba0` autoriza únicamente la fase 10. El ACK «Continuar» posterior a `a23d6df` autoriza únicamente fase 11. El ACK «Continuar» del 2026-10-18 posterior a `fa7838b` autoriza únicamente fase 12. Se registran abajo los ACK específicos para el harness descartable y la conservación de actividad.

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
- Analítica y Webhooks: parámetros técnicos editables por ACK específico del 2026-10-18; explicar que sus flags no controlan el acceso ni detienen actividad/entregas. No ampliar backend para inventar ese efecto.
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

### [Completada] Fase 0 — Rama, plan y trazabilidad

**Estado de ejecución:** completada; commit `a062bb1` verificado y ACK humano «Continuar» recibido.

- [x] Comprobar Git y crear/cambiar a `codex/mejoras-integrales-frontend` desde `main` actual, preservando informes existentes.
- [x] Guardar el plan aprobado, decisiones y registro en el índice.
- [x] Incorporar matrices de hallazgos, oportunidades, rutas y superficies, con pruebas y estados.
- [x] Revisar matices de informes antes de convertirlos en requisitos: webhooks ya posee controles backend de concurrencia y gracia; corregir su descripción sin declarar resuelto el problema de interacción.
- [x] Registrar baseline, resultados y límites en la sección 7.
- [x] Preparar sólo documentación y evidencia saneada; conservar la captura histórica de critique como archivo de la evaluación original.

**Cierre:** rama correcta, plan revisable, matrices completas y documentación preparada para commit antes de modificar implementación.

**Commit:** `docs(plan): definí las fases de mejora integral del frontend`  
**ACK humano:** recibido el 2026-10-14. **Commit registrado:** `a062bb1`.

**Detenerse y esperar ACK.**

### [Completada] Fase 1 — Moderación y formularios críticos

**Cubre:** F01, F02, F04, F05.

**Estado de ejecución:** completada; commit `c8fed72` verificado y ACK «Continuar» recibido el 2026-10-15. Ver registro de validación de fase 1 en la sección 7.

- [x] Declarar type button en paginación y auxiliares dentro de formularios.
- [x] Habilitar moderación para editor según contrato; conservar edición por propiedad y restricciones de publicados.
- [x] Reconciliar detalle, lista e inicio con la respuesta confirmada de cada mutación.
- [x] Reintentar metadatos dentro del formulario sin borrar texto.
- [x] Proteger cierre/Escape con cambios pendientes y bloquear dobles envíos.
- [x] Explicar aprobación, publicación, rechazo y ocultamiento con estados en español.

**Cierre/pruebas:** paginar con campos válidos y varias páginas no crea; editor modera sin ganar permisos administrativos; detalle cambia sin reabrir; fallos/reintentos conservan borrador. Tests de comportamiento y contratos afectados; no atribuir a fixtures aceptación de backend real.

**Commit:** `fix(testimonials): corregí la moderación y preservá los borradores`  
**ACK humano:** recibido. **Commit registrado:** `c8fed72`. **Detenerse y esperar ACK.**

### [Completada] Fase 2 — Base visual, accesibilidad y feedback compartido

**Cubre:** F13 y parte transversal de F22.

**Estado de ejecución:** completada; commit `9ec32c4` verificado y ACK «Continuar» recibido el 2026-10-15.

- [x] Corregir parejas de color claro/oscuro y unificar estados semánticos.
- [x] Usar sans en controles/datos y conservar serif en citas/títulos.
- [x] Añadir anuncios de carga/resultado, rating textual, expansión semántica, skip link y foco consistente.
- [x] Localizar cierres y ampliar áreas táctiles; revisar tablas, diálogos y menú móvil.
- [x] Proteger storage y mantener funcionamiento en memoria si falla.
- [x] Unificar confirmaciones destructivas y estados ocupado/error/éxito mediante componentes activos.

**Cierre/pruebas:** teclado/foco de controles modificados, contraste de combinaciones efectivas en ambos temas, carga anunciada sin ruido, storage denegado sin caída. Verificar móvil y movimiento reducido. No certificar WCAG sólo con controles automáticos.

**Commit:** `fix(web): unificá accesibilidad, estados y contraste`  
**ACK humano:** recibido. **Commit registrado:** `9ec32c4`. **Detenerse y esperar ACK.**

### [Completada] Fase 3 — Búsqueda global, revisión e inicio operativo

**Cubre:** F03 y mejoras de testimonios/inicio.

**Estado de ejecución:** completada localmente; commit `263fd55` verificado y ACK «Continuar» del 2026-10-17 recibido. Integración PostgreSQL/Redis y seis E2E reales pendientes por daemon Docker no disponible. La fase 4 está autorizada por ese ACK.

- [x] Implementar contratos de búsqueda, catálogos y resumen de la sección 2.
- [x] Llevar búsqueda, filtros, orden y página a URL; cancelar/descartar respuestas obsoletas.
- [x] Añadir estado, limpiar consulta y selectores globales paginados.
- [x] Corregir páginas que pierden su último resultado.
- [x] Añadir detalle enlazable y siguiente/anterior dentro de la consulta.
- [x] Priorizar pendientes, separar borradores y mostrar totales/recientes con alcance explícito.
- [x] Incorporar eliminación confirmada por endpoint vigente y permisos reales.

**Cierre/pruebas:** coincidencia originalmente fuera de página accesible desde página 1; AND de etiquetas; URL/total/resultados coherentes; desempates estables; conteos globales; tenant ajeno excluido; detalle fuera de página y 403/404; borrado autorizado y confirmación. Probar compatibilidad de consultas anteriores.

**Commit:** `feat(testimonials): agregá búsqueda global y revisión contextual`  
**ACK humano:** recibido. **Commit registrado:** `263fd55`. **Detenerse y esperar ACK.**

### [Completada] Fase 4 — Categorías, etiquetas y usuarios

**Cubre:** F06, F16, F17, F18.

**Estado de ejecución:** implementada y validada localmente; commit `a9ab823` y ACK recibidos. Integración PostgreSQL/Redis y E2E reales pendientes por daemon Docker no disponible.

- [x] Integrar búsqueda, renombrado y conteos de asociaciones de catálogos.
- [x] Confirmar eliminación explicando efecto y mostrar acciones en dispositivos táctiles.
- [x] Conservar página válida después de crear/eliminar.
- [x] Usar Crear usuario y explicar contraseña/permisos efectivos.
- [x] Activar/desactivar otras cuentas con confirmación; impedir controles de desactivación/eliminación propia.
- [x] Verificar rechazo backend de cuentas desactivadas.
- [x] No ofrecer edición de rol: el DTO por sí solo no acredita implementación completa del contrato.

**Cierre/pruebas:** asociaciones tenant correctas, cancelación sin DELETE, eliminación sin testimonios borrados, última página válida, requisitos de contraseña anticipados, acceso de cuenta desactivada rechazado y acciones propias protegidas. Ejemplos opcionales por programa/cohorte, sin taxonomía obligatoria ni datos reales de alumnos.

**Commit:** `feat(admin): mejorá catálogos y gestión de usuarios`  
**ACK humano:** recibido. **Commit registrado:** `a9ab823`. **Detenerse y esperar ACK.**

### [Completada] Fase 5 — API keys

**Cubre:** F08, F14, F15.

**Estado de ejecución:** implementada y validada localmente; commit `52e4800` y ACK recibidos. Integración PostgreSQL/Redis y E2E reales pendientes por Docker no disponible.

- [x] Convertir UTC/hora local correctamente y preservar instante si no se edita.
- [x] Distinguir Activa, Vencida y Revocada con acciones pertinentes.
- [x] Proteger revelación al iniciar otra operación, cerrar o navegar.
- [x] Identificar integración en confirmaciones/revelaciones.
- [x] Bloquear operaciones pendientes y explicar gracia efectiva, limitada por vencimientos.
- [x] Conservar scopes comprensibles y copia manual como recuperación.

**Cierre/pruebas:** rotación sin desplazamiento en UTC y Argentina; estados diferenciados; fallo siguiente conserva revelación; doble operación bloqueada; clipboard denegado recuperable; secretos ausentes de storage/logs/evidencia. No generar credenciales reales para capturas.

**Commit:** `fix(api-keys): corregí vencimientos y protegé la revelación`  
**ACK humano:** recibido. **Commit registrado:** `52e4800`. **Detenerse y esperar ACK.**

### [Completada] Fase 6 — Webhooks

**Cubre:** F07, F20.

**Estado de ejecución:** completada; commit `24b64b6` verificado y ACK «Continuar» recibido. Integración PostgreSQL/Redis y E2E reales pendientes por Docker no disponible.

- [x] Bloqueo de mutación pendiente por destino y feedback ocupado.
- [x] Identificar URL/evento en revelación, historial y confirmaciones.
- [x] Mantener destino/página al actualizar y reintentar historial.
- [x] Traducir estados y mostrar intentos en detalle expansible.
- [x] Integrar edición HTTPS/evento y pausa/reactivación por PATCH vigente.
- [x] Guiar crear, configurar receptor, probar y comprobar resultado; separar encolado de entregado.
- [x] Preservar SSRF, firma, CAS/concurrencia y gracia del backend.

**Cierre/pruebas:** una sola operación pendiente por destino, respuestas tardías no contaminan otro recurso, conflicto 409 comprensible, actualización conserva página, intentos accesibles y reactivación respeta firma/HTTPS. Entregas externas simuladas no acreditan proveedor real.

**Commit:** `feat(webhooks): mejorá configuración y seguimiento de entregas`  
**ACK humano:** recibido. **Commit registrado:** `24b64b6`. **Detenerse y esperar ACK.**

### [Completada] Fase 7 — Configuración, marca y primera puesta en marcha

**Cubre:** F19 y onboarding/contexto.

**Estado de ejecución:** completada; commit `8152850` verificado y ACK «Continuar» recibido. Integración PostgreSQL/Redis y E2E reales pendientes por Docker no disponible.

- [x] Separar carga/guardado de marca, logo, enlace, recepción y capacidades.
- [x] Conservar slug pendiente durante operaciones independientes.
- [x] Mantener confirmaciones tras refresco y salida clara antes de eliminar logo.
- [x] Integrar nombre y controles administrativos reales de feature flags.
- [x] Distinguir enlace configurado de recepción abierta; explicar scoring real.
- [x] Mostrar organización persistente en shell, sin selector multiempresa nuevo.
- [x] Añadir recorrido opcional de configuración/captura/revisión/publicación con progreso derivado de datos reales.

**Cierre/pruebas:** fallo de flags no bloquea marca/enlace; logo no sobrescribe draft del slug; mensaje/foco sobreviven al refresco; guardar/activar flags respeta permisos; progreso no promete tareas inexistentes ni usa estado ficticio persistido.

**Commit:** `feat(settings): mejorá la configuración y la puesta en marcha`  
**ACK humano:** recibido. **Commit registrado:** `8152850`. **Detenerse y esperar ACK.**

### [Completada] Fase 8 — Login y registro

**Cubre:** F10 y semántica de autenticación.

**Estado de ejecución:** completada; commit `b665226` verificado y ACK «Continuar» recibido. Integración PostgreSQL/Redis y E2E reales pendientes por Docker no disponible.

- [x] Campos vacíos y sin credenciales preseleccionadas.
- [x] No ofrecer demo sin entorno real configurado.
- [x] Main, título visible móvil, regreso y errores asociados.
- [x] Requisitos de contraseña anticipados.
- [x] Voseo y términos de espacio/cuenta administradora consistentes.
- [x] Preservar cookies, CSRF, sesión y redirecciones.

**Cierre/pruebas:** datos de ejemplo no se envían por omisión; errores conservan campos; teclado móvil; sesión, refresh y logout sin regresiones. No construir recuperación de contraseña ni invitaciones.

**Commit:** `fix(auth): aclará el acceso y eliminá valores preseleccionados`  
**ACK humano:** recibido. **Commit registrado:** `b665226`. **Detenerse y esperar ACK.**

### [Completada] Fase 9 — Captura y galería públicas

**Cubre:** F09 y parte pública de F22.

**Estado de ejecución:** implementada y validada localmente; pendiente de commit y ACK. Integración PostgreSQL/Redis y E2E reales pendientes por Docker no disponible. La fase 10 no está autorizada.

- [x] Marca, paginación/cargar más y alcance visible en galería.
- [x] Retirar rótulos de telemetría de la presentación.
- [x] Tracking independiente de lectura y resistente a storage fallido.
- [x] Rating textual, expansión semántica y carga anunciada.
- [x] Calificación deliberada y límites de adjuntos antes de seleccionar.
- [x] Preservar recepción completa/parcial, texto ante error y foco.
- [x] Conservar lazy/async de imágenes, YouTube bajo demanda y fallback.

**Cierre/pruebas:** publicado 21 alcanzable; recepción cerrada no impide marca/galería; vacío/error/final diferenciados; rating requerido; fallo de adjunto no induce duplicación; bloqueo de storage/tracking no impide lectura.

**Commit:** `feat(public): mejorá la captura y la galería de testimonios`  
**ACK humano:** recibido; commit `380cba0` verificado y fase 10 autorizada.

### [Completada] Fase 10 — Analítica y las siete superficies de BI

**Cubre:** F21, F24 y mejoras BI.

- [x] Período acumulado, observación y límite de eventos en Analítica.
- [x] Autor/extracto y detalle autorizado, sin consultas por fila.
- [x] Vacíos vinculados con publicación/distribución.
- [x] Jerarquía de vigencia/resultado/acción y escala/unidades del gráfico BI.
- [x] Solicitudes diferenciadas de intentos; estados sin porcentajes inventados.
- [x] Proteger draft de configuración al navegar y preservar recuperación de conflictos.
- [x] Auditoría con diferencias legibles y detalle técnico secundario.
- [x] Contener tablas móviles sin perder URL, CSV, UTC, polling o resultados inciertos.

**Cierre/pruebas:** período/alcance reales, referencias tenant correctas, ausencia de N+1, gráficos con cortes ausentes distintos de cero, draft protegido y conflictos recuperables; roles admin/editor; CSV y polling existentes sin regresiones.

**Commit:** `feat(analytics): clarificá métricas y operación de inteligencia de negocio`  
**ACK humano:** recibido; commit `a23d6df` verificado y fase 11 autorizada.

### [Completada] Fase 11 — Landing, ayuda y rutas preparatorias

**Cubre:** F11, F12, F23.

- [x] Destinos reales y header/titulares/CTA móviles corregidos.
- [x] Capacidades y funcionamiento verificados como contenido principal.
- [x] Conservar marketing no acreditado como borradores no montados y sin URL pública.
- [x] Ayuda real en /docs para captura, moderación, publicación, API keys y webhooks, sin secretos ni widget nuevo prometido.
- [x] Aliases a rutas activas; detalle/edición por entrada contextual autorizada.
- [x] Flags/integraciones dirigidos a secciones reales de configuración.
- [x] Retirar enlaces legales/contacto sin contenido aprobado; pausa de autoplay y reduced motion.

**Cierre/pruebas:** CTA y navegación producen su resultado; no hay placeholders públicos; aliases conservan autorización; borradores comerciales no renderizados; teclado, zoom y 320/375/768 px sin pérdida de acciones.

**Commit:** `feat(web): conectá la landing y reemplazá rutas preparatorias`  
**ACK humano:** recibido el 2026-10-18; commit `fa7838b` verificado.

### [Actual] Fase 12 — Rendimiento, validación integral y cierre

- [x] Medir build de producción, rutas representativas y medios/polling; distinguir laboratorio de servicios reales.
- [x] Eliminar overlays duplicados y corregir costos demostrados sin refactors especulativos.
- [x] Completar matriz local de rutas/roles/estados/tamaños/temas; límites de integración explícitos.
- [x] Polish acotado y nueva auditoría/detector del código final según skill.
- [x] Actualizar documentación y trazabilidad F01–F24 con límites explícitos.
- [ ] Cierre de integración pendiente: se comprobó que GitHub no conoce el SHA local; servicios reales, seis E2E y checks del próximo SHA aún requeridos.

**Cierre/pruebas:** ningún punto acordado queda sin resolución o exclusión humana explícita; suite completa y E2E vigentes; tipos/lint/build y evidencia saneada; no comparar scores de alcances diferentes como si probaran mejora.

**Commit:** `perf(web): optimizá y validá la experiencia integral`  
**ACK humano de cierre:** pendiente. **Detenerse y esperar ACK.**

## 4. Matriz de hallazgos F01–F24

La regresión local de fase 12 y sus límites por hallazgo constan en [validación integral](../technical/2026-10-18_frontend_validacion_integral.md). Ninguna fila con integración pendiente pasa a aceptación integral por un fixture. El estado actual se registra por hallazgo. «Corregido localmente» requiere las pruebas de la fase; no sustituye CI, integración real ni el cierre integral. La auditoría y la preparación no cuentan como corrección. Las fases indicadas son propietarias; el cierre integral comprueba regresiones sin implementar anticipadamente otras fases.

| ID  | Hallazgo                                           | Fase propietaria                 | Prueba/aceptación mínima                                                   | Estado                                                                                 |
| --- | -------------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| F01 | Editor sin moderación                              | 1                                | Positivo editor; negativos de rol/propiedad; transiciones API respetadas   | Corregido localmente en fase 1                                                         |
| F02 | Paginación submit dentro del alta                  | 1                                | Varias páginas y formulario válido; sin POST ni validación accidental      | Corregido localmente en fase 1                                                         |
| F03 | Búsqueda/filtros de página                         | 3                                | Coincidencia fuera de página, AND, total y URL coherentes, tenant negativo | Corregido localmente en fase 3; integración PostgreSQL pendiente                       |
| F04 | Detalle anterior tras mutación                     | 1                                | Estado/contenido/medios actualizados sin reabrir                           | Corregido localmente en fase 1                                                         |
| F05 | Recuperación descarta borrador                     | 1                                | Reintento y cierre con decisión; texto preservado                          | Corregido localmente en fase 1                                                         |
| F06 | Borrado de categoría sin advertir desclasificación | 4                                | Cancelar sin DELETE; confirmar conserva testimonios sin categoría          | Corregido localmente en fase 4; integración/E2E reales pendientes                      |
| F07 | Rotación webhook sin busy guard/contexto           | 6                                | Un intento UI por destino; conflictos y respuestas tardías tratados        | Corregido localmente en fase 6; integración/E2E reales pendientes                      |
| F08 | Vencimiento cambia por UTC/local                   | 5                                | UTC/Argentina; guardar intacto preserva instante                           | Corregido localmente en fase 5; integración/E2E reales pendientes                      |
| F09 | Publicados posteriores a veinte inaccesibles       | 9                                | Publicado 21 y final/paginación real                                       | Corregido localmente en fase 9; integración/E2E reales pendientes                      |
| F10 | Registro precompletado                             | 8                                | Campos vacíos; validación evita alta accidental                            | Corregido localmente en fase 8; integración/E2E reales pendientes                      |
| F11 | CTA y enlaces sin destino                          | 11                               | Navegación/acción real; marketing borrador no renderizado                  | Corregido localmente en fase 11; E2E y cierre integral pendientes                      |
| F12 | Desborde de portada                                | 11                               | 320/375/768 px, zoom y acciones alcanzables                                | Corregido localmente en fase 11; E2E y cierre integral pendientes                      |
| F13 | Contraste dark                                     | 2                                | Parejas reales y estados de ambos temas                                    | Corregido localmente en fase 2                                                         |
| F14 | Vencida aparece revocada                           | 5                                | Estados diferenciados y acciones pertinentes                               | Corregido localmente en fase 5; integración/E2E reales pendientes                      |
| F15 | Revelación anterior perdida                        | 5                                | Error siguiente preserva secreto en memoria; salida deliberada             | Corregido localmente en fase 5; integración/E2E reales pendientes                      |
| F16 | Invitar y contraseña mal explicados                | 4                                | Crear usuario describe resultado; requisitos y errores asociados           | Corregido localmente en fase 4; integración/E2E reales pendientes                      |
| F17 | Última página inválida                             | 3 en testimonios; 4 en catálogos | Último elemento eliminado y página corregida                               | Corregido localmente en fases 3/4; integración/E2E reales pendientes                   |
| F18 | Borrado y acciones de etiquetas                    | 4                                | Decisión explícita, efecto real y controles táctiles descubribles          | Corregido localmente en fase 4; integración/E2E reales pendientes                      |
| F19 | Configuración acoplada/draft y mensaje perdidos    | 7                                | Fallas independientes, slug y confirmación/foco conservados                | Corregido localmente en fase 7; integración/E2E reales pendientes                      |
| F20 | Historial/secreto webhook sin contexto             | 6                                | Recurso identificado y actualización conserva página                       | Corregido localmente en fase 6; integración/E2E reales pendientes                      |
| F21 | Analítica sin período/referencia útil              | 10                               | Alcance real y datos autorizados sin N+1                                   | Corregido localmente en fase 10; integración real pendiente                            |
| F22 | Semántica, storage, cargas y cierres               | 2 común; 8 auth; 9 público       | Roles/foco/rating/expansión, storage denegado y main/título móvil          | Fases 2/8/9 corregidas localmente; integración/E2E reales y cierre integral pendientes |
| F23 | Doce rutas preparatorias expuestas                 | 11                               | Aliases/contenido útil; autorización y ausencia de placeholders            | Corregido localmente en fase 11; E2E y cierre integral pendientes                      |
| F24 | Draft BI descartado al navegar                     | 10                               | Conservar/descartar explícito; conflicto mantiene intención                | Corregido localmente en fase 10; integración real pendiente                            |

## 5. Matriz de oportunidades de diseño

Cada fila agrupa una oportunidad de la auditoría por superficie, sin inventar capacidades. Las filas parciales conservan explícitamente las fases pendientes. Las capacidades expresamente excluidas no se considerarán una omisión al cerrar este plan.

| ID  | Superficie/oportunidad                                        | Fase         | Evidencia de aceptación                                                             | Estado                                                                           |
| --- | ------------------------------------------------------------- | ------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| O01 | Landing: funcionamiento claro, CTA útil y pruebas reales      | 11           | Primer viewport comprensible, destinos reales, borradores fuera del render          | Corregido localmente en fase 11; E2E y cierre integral pendientes                |
| O02 | Login: tarea visible, regreso y demo diferenciada             | 8            | Main/h1 móvil, campos vacíos, no demo ficticia                                      | Corregido localmente en fase 8; integración/E2E reales pendientes                |
| O03 | Registro: espacio/cuenta y requisitos claros                  | 8            | Lenguaje, expectativas y errores junto al campo                                     | Corregido localmente en fase 8; integración/E2E reales pendientes                |
| O04 | Inicio: pendientes, alcance y primera acción                  | 3, 7         | Totales globales, borradores separados y onboarding derivado                        | Fases 3/7 corregidas localmente; integración/E2E reales pendientes               |
| O05 | Listado: estado, consulta global y detalle contextual         | 3            | URL, filtros, limpiar y siguiente/anterior coherentes                               | Corregido localmente en fase 3; E2E reales pendientes                            |
| O06 | Alta: contenido principal y clasificación progresiva          | 1, 2         | Borrador recuperable, móvil y preview sin dominar escritura                         | Corregido localmente en fases 1/2; cierre integral pendiente                     |
| O07 | Detalle: estado español y acción siguiente                    | 1, 3         | Mutación confirmada, permisos, visibilidad pública y eliminación informada          | Corregido localmente en fases 1/3; integración real pendiente                    |
| O08 | Categorías: renombrado y asociaciones                         | 4            | Conteo global etiquetado, borrar/renombrar reales                                   | Corregido localmente en fase 4; integración/E2E reales pendientes                |
| O09 | Etiquetas: búsqueda y complemento de categoría                | 4            | Crear/renombrar sin depender de página; ejemplos opcionales                         | Corregido localmente en fase 4; integración/E2E reales pendientes                |
| O10 | Usuarios: acción real y estado de acceso                      | 4            | Alta directa clara; activar/desactivar; restricciones propias                       | Corregido localmente en fase 4; integración/E2E reales pendientes                |
| O11 | API keys: integración, vencimiento y recorrido de rotación    | 5            | Contexto, gracia fiel y revelación protegida                                        | Corregido localmente en fase 5; integración/E2E reales pendientes                |
| O12 | Webhooks: receptor, prueba, entrega e intentos                | 6            | Configurar y diagnosticar sin recordar fila anterior                                | Corregido localmente en fase 6; integración/E2E reales pendientes                |
| O13 | Analítica: historia reconocible y alcance                     | 10           | Período, referencia y vacío con acción útil                                         | Corregido localmente en fase 10; integración real pendiente                      |
| O14 | Ajustes: marca/captura/capacidades independientes             | 7            | Guardados independientes; scoring real; capacidades operables                       | Corregido localmente en fase 7; integración/E2E reales pendientes                |
| O15 | Captura: marca, rating deliberado y límites previos           | 9            | Validación, parcial/completo y foco sin duplicados                                  | Corregido localmente en fase 9; integración/E2E reales pendientes                |
| O16 | Galería: identidad, lectura y cantidad                        | 9            | Marca, cargar más, semántica y ausencia de rótulos de telemetría                    | Corregido localmente en fase 9; integración/E2E reales pendientes                |
| O17 | BI resumen: vigencia, unidades y cortes                       | 10           | Jerarquía, ejes/unidades, tabla accesible y huecos no interpolados                  | Corregido localmente en fase 10; integración real pendiente                      |
| O18 | BI ejecuciones: intención vs intento                          | 10           | Agrupación, filtros preservados, dos paginaciones y scroll contenido                | Corregido localmente en fase 10; integración real pendiente                      |
| O19 | BI detalle ejecución: resultado y recuperación                | 10           | Acción actual comprensible; UUID/código secundarios                                 | Corregido localmente en fase 10; integración real pendiente                      |
| O20 | BI detalle solicitud: seguimiento durable                     | 10           | Estados fieles sin porcentajes inventados; cancelar sólo pendiente                  | Corregido localmente en fase 10; integración real pendiente                      |
| O21 | BI operación: acción posible antes de cifras                  | 10           | Motivo junto a bloqueo; aceptada no se presenta como terminada                      | Corregido localmente en fase 10; integración real pendiente                      |
| O22 | BI configuración: efecto, draft y conflicto                   | 10           | Salida deliberada, UTC, merge explícito y pausa/manual diferenciados                | Corregido localmente en fase 10; integración real pendiente                      |
| O23 | BI auditoría: cambios legibles                                | 10           | Diff antes/después y actor técnico preservado; editor restringido                   | Corregido localmente en fase 10; integración real pendiente                      |
| O24 | Sistema visual: densidad, estado, contexto, foco y movimiento | 2, 7, 11, 12 | Identidad conservada, controles legibles, organización persistente y reduced motion | Implementado y revisado localmente en fases 2/7/11/12; cierre integral pendiente |
| O25 | Rendimiento: lazy, cleanup, polling y overlays                | 12           | Medición de producción y cambios motivados; no memoización especulativa             | Medido y corregido localmente en fase 12; servicios/CI pendientes                |
| O26 | Preparación ruteada: aliases y ayuda real                     | 11           | Doce decisiones resueltas sin construir doce flujos alternativos                    | Corregido localmente en fase 11; E2E y cierre integral pendientes                |

No añadir nombre personal del actor a BI sin un contrato autorizado que lo aporte. Mantener actor técnico como dato secundario. No implementar fusión de etiquetas, cambio de rol, borrado de medios sin endpoint ni un sistema de membresías multiempresa como ampliaciones implícitas.

## 6. Matriz de rutas y superficies

**Cobertura de ruta:** código, estados y pruebas asignados. No marcar una fila validada sólo por abrir la ruta. En cada pantalla aplican carga, éxito, vacío cuando corresponda, error recuperable, autorización, teclado y tamaño/contenido límite. Usar datos sintéticos. El estado parcial de una ruta no acredita su aceptación integral.

| Ruta activa                    | Fases propietarias | Verificación específica                                               | Estado                                                                                 |
| ------------------------------ | ------------------ | --------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`                            | 2, 11              | Header/CTA, anchors, borradores, autoplay, mobile/zoom                | Corregido localmente en fases 2/11; E2E y cierre integral pendientes                   |
| `/admin/login`                 | 2, 8               | Vacío, errores, sesión/refresh/logout y semántica móvil               | Corregido localmente en fase 8; integración/E2E reales pendientes                      |
| `/admin/register`              | 2, 8               | Campos vacíos, contraseña, alta y errores preservados                 | Corregido localmente en fase 8; integración/E2E reales pendientes                      |
| `/admin`                       | 1, 2, 3, 7         | Resumen real, recientes, pendientes y onboarding según rol            | Fases 1/2/3/7 corregidas localmente; integración/E2E reales y cierre pendientes        |
| `/admin/testimonials`          | 1, 2, 3            | Consulta/detalle/alta/edición/moderación/medios/eliminación y roles   | Fases 1/2/3 corregidas localmente; integración/E2E reales y cierre integral pendientes |
| `/admin/categories`            | 2, 4               | Buscar/crear/renombrar/eliminar, asociaciones y página                | Fases 2/4 validadas localmente; integración/E2E reales y cierre integral pendientes    |
| `/admin/tags`                  | 2, 4               | Buscar/crear/renombrar/eliminar y tablet táctil                       | Fases 2/4 validadas localmente; integración/E2E reales y cierre integral pendientes    |
| `/admin/users`                 | 2, 4               | Alta, contraseña, estado de acceso, confirmación y rol                | Fases 2/4 validadas localmente; integración/E2E reales y cierre integral pendientes    |
| `/admin/api-keys`              | 2, 5               | Scopes/fechas/estado/revelación/copia/revocación/rotación             | Fases 2/5 validadas localmente; integración/E2E reales y cierre integral pendientes    |
| `/admin/webhooks`              | 2, 6               | Alta/edición/pausa/prueba/rotación/historial/replay y legado          | Fases 2/6 validadas localmente; integración/E2E reales y cierre integral pendientes    |
| `/admin/settings`              | 2, 7               | Marca/logo/slug/recepción/capacidades y fallas independientes         | Corregido localmente en fases 2/7; integración/E2E reales pendientes                   |
| `/admin/analytics`             | 2, 10              | Período/eventos/referencias/alcance/vacío/error                       | Corregido localmente en fases 2/10; integración real y cierre pendientes               |
| `/admin/business-intelligence` | 2, 10              | Siete superficies de la tabla siguiente, URL/CSV/polling/roles        | Corregido localmente en fases 2/10; integración real y cierre pendientes               |
| `/p/[slug]`                    | 9                  | Marca, cerrado/no disponible, rating/medios, recepción parcial y foco | Corregido localmente en fase 9; integración/E2E reales pendientes                      |
| `/t/[slug]`                    | 2, 9               | Marca, 21 publicados, detalle/media, tracking/storage y vacío/error   | Corregido localmente en fase 9; integración/E2E reales pendientes                      |

### Siete superficies BI

| Superficie                | Fase | Aceptación                                                       | Estado                                                     |
| ------------------------- | ---- | ---------------------------------------------------------------- | ---------------------------------------------------------- |
| Resumen                   | 10   | Rango/freshness/CSV/gráfico/tabla; ausente distinto de cero      | Validada localmente en fase 10; integración real pendiente |
| Ejecuciones y solicitudes | 10   | Filtros y dos páginas preservados; tracking visible y contención | Validada localmente en fase 10; integración real pendiente |
| Detalle de ejecución      | 10   | Resultado/fase/conteos y reintento actual; error recuperable     | Validada localmente en fase 10; integración real pendiente |
| Detalle de solicitud      | 10   | Estado/fechas/intentos; cancelación pendiente y vínculo durable  | Validada localmente en fase 10; integración real pendiente |
| Operación                 | 10   | Salud/presupuesto/actividad y motivos de acciones/roles          | Validada localmente en fase 10; integración real pendiente |
| Configuración             | 10   | Draft, conflictos, frecuencia/pausa/tolerancia y permisos        | Validada localmente en fase 10; integración real pendiente |
| Auditoría                 | 10   | Rango/página/diff/actor y restricción editor                     | Validada localmente en fase 10; integración real pendiente |

### Doce rutas preparatorias

Las redirecciones no deben eliminar autorización ni crear loops; validar identificadores y query de contexto. La fase 11 define e implementa destinos coherentes con las entradas completadas en fases anteriores.

| Ruta                      | Destino/comportamiento acordado                                                    | Fase | Estado                                                         |
| ------------------------- | ---------------------------------------------------------------------------------- | ---- | -------------------------------------------------------------- |
| `/login`                  | Alias a `/admin/login`                                                             | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/docs`                   | Ayuda pública real; deja de ser placeholder                                        | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/dashboard`              | Alias a `/admin`                                                                   | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/analytics`              | Alias a `/admin/analytics`                                                         | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/testimonials`           | Alias a `/admin/testimonials`                                                      | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/testimonials/[id]`      | Entrada contextual autorizada en testimonios                                       | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/testimonials/[id]/edit` | Entrada contextual de edición con permisos/estado reales                           | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/settings/users`         | Alias a `/admin/users`                                                             | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/settings/webhooks`      | Alias a `/admin/webhooks`                                                          | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/settings/api-keys`      | Alias a `/admin/api-keys`                                                          | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/settings/feature-flags` | Sección real de capacidades en configuración                                       | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |
| `/settings/integrations`  | Sección real de integraciones en configuración con accesos a claves/webhooks/ayuda | 11   | Implementada y verificada localmente en fase 11; E2E pendiente |

### Formularios y estados compartidos

| Superficie                        | Fase           | Pruebas adicionales                                                                                  | Estado                                                                     |
| --------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Crear testimonio                  | 1, 2, 3        | Paginación sin submit, metadatos fallidos, dirty/Escape y móvil                                      | Regresiones locales de fases 1/2/3 verificadas; integración/E2E pendientes |
| Editar/detalle/moderar            | 1, 2, 3        | Propiedad/estado, respuesta actualizada, notas y siguiente/anterior                                  | Regresiones locales de fases 1/2/3 verificadas; integración/E2E pendientes |
| Adjuntos administrativos          | 1, 2           | Carga/error/doble envío, no editar publicado, datos actualizados                                     | Regresiones locales de fases 1/2/3 verificadas; integración/E2E pendientes |
| Alta/renombrado de catálogos      | 4              | Datos conservados, errores y asociaciones                                                            | Corregido localmente en fase 4; integración/E2E pendientes                 |
| Alta/estado de usuario            | 4              | Requisitos, rol, cuenta propia y acceso suspendido                                                   | Corregido localmente en fase 4; integración/E2E pendientes                 |
| Alta/rotación/revelación API key  | 5              | Instante intacto, secreto en memoria y salida deliberada                                             | Corregido localmente en fase 5; integración/E2E reales pendientes          |
| Alta/edición/rotación webhook     | 6              | Destino identificado, busy/conflicto/legado y firma                                                  | Corregido localmente en fase 6; integración/E2E reales pendientes          |
| Historial y replay webhook        | 6              | Página/destino, intentos, accepted vs entregado                                                      | Corregido localmente en fase 6; integración/E2E reales pendientes          |
| Captura y galería públicas        | 9              | Rating deliberado, límites, lectura de archivo, 20+1, marca, tracking, parcial/foco y nombres largos | Corregido localmente en fase 9; integración/E2E reales pendientes          |
| Login y registro                  | 8              | Campos vacíos, validación, foco, borradores, bloqueo, transporte y navegación                        | Corregido localmente en fase 8; integración/E2E reales pendientes          |
| Logo y configuración              | 7              | MIME/tamaño/preview, error/conflicto, slug y éxito persistentes                                      | Corregido localmente en fase 7; integración/E2E reales pendientes          |
| Shell/Sheet/diálogos              | 2, 7           | Contexto, foco, Escape, targets y roles                                                              | Fases 2/7/12 verificadas localmente; aceptación integral pendiente         |
| Feedback/paginación/boundary/tema | 1, 2, 3, 4, 12 | Estados anunciados, retry, páginas válidas y storage denegado                                        | Regresiones locales verificadas en fase 12; integración/E2E pendientes     |

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

### Fase 1 — implementación y evidencia local (2026-10-14–15)

**Autorización:** ACK «Continuar» del 2026-10-14; fase 0 registrada en `a062bb1`. No se crea commit automáticamente. Única fase actual: 1.

**Cambios confirmados:** paginación y auxiliares sin submit; moderación admin/editor separada de edición por propiedad y de adjuntos; publicados sin edición/adjuntos; `createdById` tipado/validado, ya existente en la API; respuesta de cada mutación propagada a detalle y recarga de lista/Inicio; reintento de catálogos dentro del modal; confirmación explícita de descarte y lock síncrono durante mutaciones. Estado y consecuencias en español, incluyendo rechazo de aprobados y ocultamiento de publicados según el lifecycle vigente. El desplazamiento móvil de los dos modales se unificó porque la inspección mostró compresión excesiva del contenido; escritorio conserva columnas.

**TDD y oráculos:** la primera fixture nueva omitía `tenantId` de catálogos; se corrigió antes de acreditar el Red de paginación. La ejecución Red con fixture válida produjo 11 fallos funcionales y tres pruebas existentes aprobadas: paginar generó un POST, no existían recuperación/confirmación, el editor no podía moderar, el admin veía edición de publicados, Escape cerraba durante una operación y callbacks/detalle no recibían el registro confirmado. Las pruebas adicionales de Inicio, medios y fallos se incorporaron como ampliación posterior; no se atribuye Red previo a esos casos. En Green se ajustó una expectativa nueva al mensaje vigente de resultado incierto y una fixture histórica al campo `createdById`; no se suprimieron assertions ni errores para pasar. La API no cambió.

| Control                                                                                                                                                 | Resultado                                                                                                                                             | Alcance/límite                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run test --workspace @testimonial-cms/web -- --maxWorkers=2`                                                                                       | **192/192 tests, 29/29 archivos**, exit 0; 23,44 s                                                                                                    | jsdom y transporte simulado; baseline 176, se agregaron 16 casos. Aviso Vite preexistente conservado                                                                                                                      |
| `npm run typecheck --workspace @testimonial-cms/web`                                                                                                    | Aprobado, exit 0                                                                                                                                      | Sin cambios de configuración                                                                                                                                                                                              |
| `npm run lint --workspace @testimonial-cms/web`                                                                                                         | Exit 0; **cero errores, diez advertencias preexistentes**                                                                                             | Mismas imágenes/variables sin uso del baseline; sin supresiones nuevas                                                                                                                                                    |
| `npm run db:generate --workspace @testimonial-cms/api`                                                                                                  | Cliente Prisma 6.5 generado                                                                                                                           | El primer intento no pudo descargar binarios dentro del sandbox; el reintento autorizado funcionó. Sin cambio de esquema, conexión ni migración DB                                                                        |
| `npm run test --workspace @testimonial-cms/api -- --testPathPatterns='testimonials.service\|testimonial-event-payload\|testimonial-content-validation'` | **21/21 tests, 3/3 suites**, exit 0                                                                                                                   | Unitarios de contratos existentes, con repositorios/proveedores simulados; el intento previo no pudo cargar el cliente Prisma ausente                                                                                     |
| `impeccable detect` sobre testimonios, Inicio y paginación modificados, salida JSON                                                                     | Exit 0, `[]`                                                                                                                                          | Detector ejecutado tras los cambios; no certifica UX ni WCAG                                                                                                                                                              |
| Chrome instalado, automatizado con Playwright (agent-browser CLI no disponible); Next dev local                                                         | Cuatro combinaciones: **1440×1000 y 375×812, claro/oscuro**; sin errores JS; cero POST al paginar categorías y etiquetas                              | Todas las respuestas API interceptadas con datos sintéticos. Editor aprueba, edita contenido propio, protege Escape/descarte, conserva borrador y reintenta catálogos. No acredita sesión, DB, CSRF ni proveedores reales |
| Inspección visual agrupada y confirmación posterior                                                                                                     | Desplazamiento móvil ajustado en un bloque; capturas finales estabilizadas, acciones alcanzables; ancho modal = scrollWidth (672 desktop, 375 mobile) | En el script de inspección se corrigieron esperas de animación y opciones nativas antes de completar la ronda; no eran fallos de producto. Sin dispositivo físico ni certificación de lector de pantalla                  |
| Formato, diff y documentación afectada                                                                                                                  | Aprobados: Prettier, enlaces locales, matrices y `git diff --check`                                                                                   | Sólo archivos afectados; sin formatter global                                                                                                                                                                             |
| Build producción, E2E real, integración PostgreSQL/Redis y CI                                                                                           | No ejecutados                                                                                                                                         | No hubo migraciones, despliegue, cuentas reales, push ni PR. La API no se modificó; servicios reales siguen como verificación de integración/CI pendiente                                                                 |

**Límites conocidos y siguientes fases:** la búsqueda sigue limitada a la página hasta fase 3; la accesibilidad/contraste/cierres compartidos se completan en fase 2. Se conserva el logo predeterminado faltante observado en el shell para el trabajo de marca/contexto de fase 7. Los borradores viven en memoria; esta fase protege cerrar el modal, no recargar o navegar fuera de la ruta. La especificación web de testimonios se actualizó para describir los componentes y contratos activos, retirando descripciones preparatorias de SWR y rutas que no estaban implementadas.

El servidor de inspección fue detenido al terminar; las capturas temporales contienen únicamente datos sintéticos.

**Resultado:** F01/F02/F04/F05 corregidos localmente; matrices parciales explícitas. **Cierre posterior:** commit `c8fed72` verificado y ACK «Continuar» recibido el 2026-10-15; fase 1 completada.

### Fase 2 — base compartida y evidencia local (2026-10-15)

**Autorización:** ACK «Continuar» del 2026-10-15 tras `c8fed72`, rama limpia verificada. Única fase actual: 2. Código y criterios durables en [base compartida](../technical/2026-10-15_frontend_base_compartida.md).

**Implementación:** tokens HSL semánticos y pares de navegación propios; paleta de acción sobre superficies editoriales invertidas; sans en controles/datos con variables `next/font`; carga/resultado y confirmaciones comunes usadas por pantallas activas; rating textual y expansión con ARIA; salto al contenido, tablas con foco/caption/scope, cierres localizados de 44 px, menú móvil, retorno de foco y movimiento reducido. Storage denegado conserva tema y tracking en memoria; no se usa memoria como almacén de credenciales. Las confirmaciones nativas existentes de usuarios/API keys/webhooks pasan a Radix con bloqueo/error en contexto. No se implementaron nuevos contratos API ni los flujos de fases posteriores.

**TDD:** cuatro Red funcionales previos a la corrección: tema y sesión lanzaban `SecurityError` al bloquear storage; un legado que no podía borrarse lanzaba excepción; el cierre no tenía nombre en español. La nueva confirmación detectó después un fallo de retorno de foco y se corrigió con un hook utilizado también por los modales activos. Los casos ampliados de hosts/galería/marcadores se agregaron después y no se atribuyen a Red previo. Una fixture de hooks devolvía el mock desde `beforeEach`; se corrigió el harness, no producción, antes de acreditar sus resultados.

| Control                                                                                           | Resultado                                                                                                                                  | Alcance y límite                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test --workspace @testimonial-cms/web -- --maxWorkers=2`                                 | **204/204 tests, 36/36 archivos**, exit 0; 68,60 s                                                                                         | Suite completa: 12 casos nuevos sobre baseline 192; jsdom/transporte simulado. Aviso Vite preexistente conservado                                                  |
| Vitest final dirigido a auth, shared, tema, diálogo, storage, testimonios, Inicio, galería y menú | **54/54 tests, 17/17 archivos**, exit 0; 70,60 s                                                                                           | Repetido después de los últimos ajustes visuales; comando completo debajo                                                                                          |
| `npm run typecheck --workspace @testimonial-cms/web`                                              | Aprobado, exit 0                                                                                                                           | Estado final                                                                                                                                                       |
| `npm run lint --workspace @testimonial-cms/web`                                                   | Exit 0: **cero errores, diez advertencias previas**                                                                                        | No se añadieron supresiones ni se ocultaron warnings                                                                                                               |
| Detector Impeccable sobre los 39 archivos de UI modificados/nuevos, excluyendo tests, salida JSON | Exit 0, `[]`                                                                                                                               | No sustituye contraste, foco ni inspección visual                                                                                                                  |
| 40 pares HSL/sRGB, incluyendo alpha al 10 %, botones, muted y sidebar                             | Mínimo **5,13:1**                                                                                                                          | Cálculo previo/posterior; no acredita todos los colores/medios/estados de la aplicación                                                                            |
| Chrome/Playwright con Next dev, 1440×1000 y 375×812, claro/oscuro y storage denegado              | Cuatro combinaciones aprobadas, cero errores JS, cero DELETE al cancelar                                                                   | Testimonios, alta/error, usuarios, API keys, webhooks, categorías, etiquetas, ajustes, analítica y galería; respuestas sintéticas, sin cuentas ni servicios reales |
| Teclado y feedback en navegador                                                                   | Salto a main, foco de tablas, abrir/cerrar diálogo y menú, retorno de foco, cancelar confirmaciones, expansión y tema en memoria aprobados | Menú y cierre también comprobados a 320 px. Diálogos/paneles con `animation-name: none` bajo movimiento reducido                                                   |
| Contraste de estilos calculados de paneles de login/registro/landing                              | Texto de acción evaluado **7,42:1 claro y 6,71:1 oscuro**                                                                                  | Sólo paneles invertidos; sin enviar formularios ni capturar credenciales. Contenido y flujos quedan en fases 8/11                                                  |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                          | Seis recorridos en dos archivos detectados, exit 0                                                                                         | Sólo descubrimiento. No equivale a ejecutar E2E                                                                                                                    |
| Formato, enlaces y diff                                                                           | Aprobados: Prettier sobre 50 archivos afectados, enlaces/matrices y `git diff --check`                                                     | Sólo archivos afectados                                                                                                                                            |
| Backend, integración PostgreSQL/Redis, build producción, E2E real y CI                            | No ejecutados en esta fase de base UI                                                                                                      | No hubo esquema, migraciones, infraestructura, hooks, dependencias, commit, push, PR ni despliegue                                                                 |

Comando de la repetición final:

```bash
npm run test --workspace @testimonial-cms/web -- src/features/auth/screens/login-screen.test.tsx src/features/auth/components src/features/shared src/components/ThemeProvider.test.tsx src/components/ui/dialog.test.tsx src/lib/session-store.test.ts src/lib/preference-storage.test.ts src/features/testimonials src/features/overview src/features/public-testimonials/screens/public-testimonials-screen.test.tsx src/components/dashboard/DashboardSidebar.test.tsx --maxWorkers=2
```

**Inspección acotada:** ronda agrupada, corrección en bloque del cierre superpuesto al badge en escritorio y movimiento reducido, y confirmación final. El script corrigió una referencia al botón cuyo texto cambia tras expandir; no se contó como defecto del producto. La verificación de paneles invertidos sólo midió estilos de la misma paleta, sin modificar copy, precios, testimonios comerciales o destinos. El CLI agent-browser seguía no disponible; se usó Chrome instalado con Playwright. No se certifican dispositivo físico, zoom integral, lector de pantalla ni WCAG completa.

**Pendientes explícitos:** F22 conserva las semánticas de auth (fase 8) y captura/galería completas (fase 9); las confirmaciones específicas de catálogo/logo permanecen en 4/7. Rotación/revelación, bloqueo por destino e historial conservan 5/6. Hover de acciones de catálogos y sus páginas se completan en 4. El logo predeterminado faltante y el contexto de organización quedan en 7; BI conserva sus siete superficies en 10. No se consideran estos flujos completos por recibir tokens o componentes compartidos. Validación integral y proveedores continúan en 12/CI cuando corresponda.

El servidor local de inspección se detuvo al terminar. Las capturas temporales contienen sólo fixtures sintéticas; no se capturaron los formularios con credenciales de ejemplo.

**Resultado:** F13 corregido localmente y parte transversal de F22 implementada; matrices parciales explícitas. **Commit y ACK de fase 2 pendientes. Detenerse; no iniciar fase 3.**

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

### Fase 3 — búsqueda global, revisión e inicio (2026-10-15)

**Autorización:** commit previo `9ec32c4` verificado, rama `codex/mejoras-integrales-frontend` limpia al iniciar y ACK «Continuar». Única fase actual: 3. No se crean commits automáticamente.

**Decisiones adicionales confirmadas:**

- ACK específico para ejecutar las migraciones existentes sólo en servicios locales descartables del harness; no habilita una DB de desarrollo/remota, cambios de esquema o infraestructura. El intento no llegó a migrar: Docker carece de daemon en `/var/run/docker.sock` y falla al crear la red propia.
- Conservar actividad e impedir borrar un testimonio con eventos registrados; explicar que puede ocultarse si está publicado. `TESTIMONIAL_HAS_ACTIVITY` responde 409. Los datos de actividad y el testimonio permanecen; no se introduce soft delete ni se purga historial.
- Se conserva el permiso implementado de eliminación (admin cualquiera/editor propios). La tabla RBAC histórica de reglas de negocio propone restricciones por estado distintas; se registra esa divergencia. No se amplía autorización para mostrar botones ni se acredita una política de soft delete inexistente.

**Implementación:**

- `GET /testimonials`: búsqueda parcial autor/contenido, estado, categoría, todas las etiquetas elegidas y orden reciente/puntaje. Validación de query, filtrado antes de paginar, total con el mismo tenant/filtros y desempate estable por ID. Sin parámetros nuevos conserva comportamiento previo.
- `GET /categories` y `/tags`: búsqueda por nombre y `testimonialCount` de asociaciones en todo el tenant. Los selectores del listado usan esos catálogos con búsqueda y páginas independientes, conservando selecciones.
- `GET /testimonials/summary`: cantidades por cada estado y total global; Inicio consume resumen, seis recientes y seis pendientes por separado, presenta revisión primero y distingue borradores.
- Listado con consulta en URL, envío de búsqueda explícito, limpieza, estados de carga/error/vacío, descarte de respuestas obsoletas y corrección de página después de borrar/filtrar. El adaptador rechaza respuestas de otra página/límite y resúmenes inconsistentes.
- `testimonial=<uuid>` abre un detalle autorizado fuera de la página y conserva contexto. Anterior/siguiente cruzan páginas de la consulta; no inventan posición para recursos fuera del filtro. La navegación se bloquea con cambios pendientes. Una respuesta confirmada sigue visible aunque falle la colección.
- Eliminación con autor, consecuencias, cancelación sin DELETE y bloqueo de solicitudes repetidas. Limpieza de etiquetas y eliminación del registro en una transacción, tenant en cada consulta; actividad registrada impide el borrado. Las referencias concurrentes que impiden borrar producen conflicto y rollback. Borrar un publicado sin actividad invalida la caché pública.
- Los filtros móviles disponen de ancho suficiente para leer estado/orden. El detalle contiene el scroll, mantiene accesibles moderación y cierre y separa el pie destructivo del contenido. Se preserva la identidad y la base compartida.

**Pruebas y límites:** el resumen de comandos y resultados finales se registra debajo. Las integraciones PostgreSQL añadidas verifican coincidencias fuera de página, AND, filtros, desempate por puntaje/ID, conteos, tenant ajeno, borrado con etiquetas y conservación de actividad. Están preparadas para CI, **no ejecutadas localmente**. El intento del harness falló antes de servicios/migraciones/E2E por Docker no disponible; no se sustituyó por una base persistente ni se desactivaron gates.

Se mantienen los seis recorridos E2E. PUBLISH añade búsqueda por URL, apertura contextual y recarga del detalle; sus assertions de estados usan las etiquetas españolas activas. El descubrimiento de pruebas no equivale a su ejecución. El CI de servicios reales y el SHA final continúan pendientes.

La revisión con Chrome/Playwright usa Next dev y HTTP sintético. Una ronda agrupada en 1440×1000 y 375×812, claro/oscuro y storage bloqueado; corrección en bloque y una confirmación. Se comprueban búsqueda originalmente fuera de página, catálogo independiente, URL, borrador conservado, navegación de resultado 20 a 21, cancelación sin DELETE, eliminación única y página válida, resumen global y ausencia de desborde en Inicio a 320 px. Se corrigió un nombre de botón en el script de inspección antes de completar la ronda; ese fallo no se atribuye a la app. No acredita integración, lector de pantalla, dispositivo físico o auditoría WCAG completa.

Borradores en memoria: se conservan frente a las acciones del modal y navegación contextual, sin garantía de persistencia ante recarga/navegación externa/browser back. No hay snapshot reservado entre consultas/páginas de datos vivos. El logo predeterminado faltante sigue en la fase de marca; no se presenta como regresión resuelta aquí. No se ejecuta despliegue ni se adelantan otras fases.

### Resultados finales de fase 3

| Validación                                                                                          | Resultado                                                                      | Alcance real                                                                                                                                                                                                |
| --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                       | **233/233**, 39 archivos, exit 0, 32,55 s                                      | UI/adaptadores con HTTP simulado, sin tests omitidos; no E2E real.                                                                                                                                          |
| API: parser, consultas, eliminación y tres suites de reglas de testimonios                          | **39/39**, seis archivos, exit 0                                               | Jest con Prisma/repositorios simulados según suite; no acredita persistencia.                                                                                                                               |
| `npm test --workspace @testimonial-cms/api -- --runTestsByPath test/testimonial-admin-http.spec.ts` | **3/3**, exit 0                                                                | Pipeline HTTP, JWT, RBAC, feature guard, validación y envelope reales; servicio/persistencia simulados.                                                                                                     |
| Typecheck web y API                                                                                 | Exit 0 en ambos                                                                | `npm run typecheck --workspace @testimonial-cms/web` y equivalente de API.                                                                                                                                  |
| Lint web completo / API afectada                                                                    | Exit 0; web conserva diez advertencias previas, API afectada cero advertencias | `npm run lint --workspace @testimonial-cms/web`; ESLint desde `apps/api` con su config sobre fuentes/tests modificados y nuevos.                                                                            |
| Impeccable detect sobre listado, detalle, selector y Inicio finales                                 | `[]`, exit 0                                                                   | Detector determinista sobre cuatro archivos UI; no certifica accesibilidad integral.                                                                                                                        |
| Chrome/Playwright, fixtures sintéticas                                                              | Cuatro combinaciones desktop/mobile × light/dark aprobadas                     | Storage bloqueado, controles reales, viewport, URL, borradores, scroll sin oclusión de moderación, confirmaciones y página corregida; dos rondas acotadas de inspección/confirmación.                       |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                            | Seis tests en dos archivos, exit 0                                             | Sólo descubrimiento; se conservan los seis recorridos obligatorios y sus gates.                                                                                                                             |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`               | **No aprobado: exit 1**, falla al crear red propia                             | ACK específico recibido; Docker no dispone de daemon. Cero servicios, migraciones o recorridos ejecutados. PostgreSQL/Redis y ocho escenarios de persistencia quedan pendientes para entorno disponible/CI. |
| Formato de archivos afectados y `git diff --check`                                                  | Aprobados                                                                      | No se modifica esquema, migraciones, manifiestos, dependencias, infraestructura ni hooks. Sin staging ni commits automáticos.                                                                               |

Comando API de seis suites ejecutadas:

```sh
npm test --workspace @testimonial-cms/api -- --runTestsByPath \
  src/modules/testimonials/dto/admin-query.spec.ts \
  src/modules/testimonials/repositories/admin-search.spec.ts \
  src/modules/testimonials/repositories/testimonial-removal.spec.ts \
  test/testimonials.service.spec.ts \
  test/testimonial-content-validation.spec.ts \
  test/testimonial-event-payload.spec.ts
```

**Red/Green:** fallos funcionales previos para filtros/validación, consultas de repositorio, transporte de búsqueda, invalidación de caché al borrar y limpieza/retención de relaciones; después, las suites seleccionadas pasan. Los fallos iniciales por módulo todavía ausente y por localizar un diálogo que Radix oculta mientras la confirmación está abierta no se cuentan como Red funcional. La prueba de retención ahora verifica el mensaje, cancela la confirmación y comprueba que el detalle reaparece intacto. No se redujeron assertions legítimas ni se desactivaron suites/gates para conseguir verde.

**Omisiones:** integración PostgreSQL/Redis, seis E2E reales, build de producción, CI del SHA final y proveedores. No se acredita atomicidad real de una transacción con un mock. Evidencia local en `/tmp/frontend-phase3-*` y capturas sintéticas `/tmp/phase3-*`; no se versionan credenciales, cuerpos reales ni salidas sensibles.

**Commit sugerido:** `feat(testimonials): agregá búsqueda global y revisión contextual`.

**Cierre registrado el 2026-10-17:** commit humano `263fd55` verificado y ACK «Continuar» recibido para fase 4. Los límites de integración descritos se conservan.

### Fase 4 — catálogos y gestión de usuarios (2026-10-17)

**Autorización y Git:** ACK «Continuar» del 2026-10-17, posterior a la fase 3; commit `263fd55` verificado y árbol limpio al iniciar en `codex/mejoras-integrales-frontend`. Se ejecuta sólo fase 4. No se crean commits automáticamente.

**Catálogos:**

- Pantallas de categorías/etiquetas componen un catálogo operativo común con búsqueda global paginada, conteos por tenant y acciones visibles sin hover. Crear/renombrar inline, validación 2–80 caracteres, confirmación de descarte y borradores conservados tras error. Renombrar conserva ID/asociaciones; duplicados tienen conflicto legible.
- Borrado identificado con nombre, cantidad y consecuencia: se conservan testimonios y se quita su categoría/etiqueta. Cancelación sin DELETE y bloqueo síncrono de operaciones. Crear vuelve a página 1; borrar/renombrar corrige página inválida sin convertir un fallo en vacío exitoso. Se conserva la consulta.
- Limpieza transaccional de asociaciones de etiquetas antes de borrar la etiqueta, compatible con las FK existentes. Errores de unicidad, inexistencia y referencias concurrentes se traducen a conflictos/404 seguros. Se invalida caché pública después de renombrar, eliminar o adjuntar/desvincular etiquetas.
- Se detectó incompatibilidad de los inputs anidados de etiquetas con el cliente Prisma instalado: el parent aporta tenant/testimonio y el hijo acepta `tagId`. Se corrigen creación y edición, manteniendo la comprobación previa de pertenencia y la FK compuesta. Hay Red/Green de ese contrato con cliente simulado; ejecución real sigue pendiente.

**Usuarios:**

- Creación directa con campos vacíos; no se ofrece invitación por email. Requisitos completos antes de enviar, explicación de roles al crear, contraseña sólo en memoria y conservación del formulario ante errores. Cerrar con datos pendientes pide decisión y crear vuelve a página 1.
- Activación/desactivación mediante PATCH vigente, con confirmación que identifica cuenta y efecto sobre acceso/sesiones. Respuesta validada para mismo ID/estado. Se conserva contraseña/roles; no se cambia autenticación o expiración y no se promete revocación definitiva.
- No hay controles de desactivación/borrado propios y los handlers comprueban identidad. La API no incorpora una nueva prohibición global de autogestión; este límite corresponde a los controles acordados. No se ofrece editar roles existentes, cuyo DTO no acredita implementación.
- Si el borrado encuentra historial protegido, conserva la cuenta mediante rollback y comunica 409 `USER_HAS_HISTORY` con la alternativa de desactivar. No se purgan sesiones ni auditoría para forzar el borrado. Los adaptadores exigen confirmación explícita de eliminación y no presentan como exitoso un ID/estado distinto.
- La verificación HTTP demuestra que un JWT previamente emitido deja de dar acceso mientras la cuenta está desactivada y vuelve a ser admisible al reactivar si aún es válido. Los casos de login/refresh inactivos permanecen cubiertos en las suites de autenticación seleccionadas.

**Verificación y recuperación:**

La inspección agrupada en Chrome/Next dev usa exclusivamente HTTP sintético y datos de prueba: 1440×1000 y 375×812, claro/oscuro, storage denegado, nombre de 80 caracteres, conflictos, renombrado, confirmaciones, cancelación sin DELETE, página corregida, cuenta propia, validación de contraseña, creación desde página 2 y activación/desactivación. Comprobación de contención de usuarios a 320 px. La primera ronda detectó compresión del nombre/campo por los botones en móvil; se corrigió en bloque con filas de nombre y acciones separadas. La única confirmación posterior pasó las cuatro combinaciones. La tabla de usuarios conserva scroll accesible y explica cómo alcanzar acciones.

Se actualiza E2E-RBAC para comprobar acceso directo denegado, desactivación/reactivación y uso de la misma credencial, manteniendo sus assertions de permiso y ausencia de cambios ajenos. Permanecen seis recorridos, sin relajar gates, privacidad, integridad o retries.

`catalog-admin.integration.spec.ts` añade tres casos PostgreSQL de renombrado/borrado con asociaciones, acceso/islamiento y rollback con historial. El test de paginación existente recibe un sustituto explícito de caché porque el servicio ahora la invalida. Se adapta un mock heredado de eliminación de testimonios a la transacción de fase 3 manteniendo la assertion NotFound y el tenant; su fallo era de fixture, no una autorización para relajar el contrato.

Docker sigue sin daemon en `/var/run/docker.sock`. Se reintentó el harness bajo el ACK específico ya otorgado; falló al crear su red, antes de crear servicios, migrar o ejecutar recorridos. No se eludió el harness ni se usaron bases persistentes. PostgreSQL/Redis, E2E reales, build de producción y CI del SHA final no se declaran aprobados.

**Resultados finales:** se registran en la tabla siguiente. Los mocks no acreditan atomicidad, restricciones PostgreSQL o Redis reales. Las fixtures de navegador no equivalen a aceptación de integración, WCAG completa, lector de pantalla o dispositivo físico. El logo faltante previo conserva su fase de marca; no se adelanta otra fase.

### Resultados finales de fase 4

| Validación                                                                                    | Resultado                                                                     | Alcance / límite                                                                                                                                                                                                       |
| --------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                 | **255/255**, 43 archivos, exit 0, 37,68 s                                     | Suite web completa con HTTP simulado; cero omisiones. Tras corregir una opción de tipos de Testing Library en una prueba, el archivo afectado se verifica por separado.                                                |
| Jest API seleccionado: diez suites                                                            | **79/79**, exit 0                                                             | Catálogos, inputs anidados, historial, credenciales, auth/login/refresh, límites multi-tenant y regresiones de testimonios; persistencia simulada según suite.                                                         |
| `npm test --workspace @testimonial-cms/api -- --runTestsByPath test/user-access-http.spec.ts` | **2/2**, exit 0                                                               | Pipeline HTTP/JWT/RBAC/servicios/repositorios reales, Prisma simulado. Token previo, activación, validación y otro tenant.                                                                                             |
| Typecheck web y API                                                                           | Exit 0 en ambos                                                               | Tipos de todos los archivos y fixtures afectados, incluidos E2E/PG preparados.                                                                                                                                         |
| Lint web / API afectada                                                                       | Exit 0; web conserva diez advertencias previas, API afectada sin advertencias | No se ocultan advertencias ni se relajan reglas.                                                                                                                                                                       |
| Impeccable detect sobre cinco archivos UI activos                                             | `[]`, exit 0                                                                  | Catálogo común, dos composiciones, usuarios y mensajes compartidos; no equivale a auditoría WCAG completa.                                                                                                             |
| Chrome/Playwright con HTTP sintético                                                          | Cuatro combinaciones aprobadas y confirmadas                                  | Escritorio/móvil × claro/oscuro, controles visibles, datos largos, formularios, contraste heredado de tokens, teclado/foco de confirmación, storage denegado, operaciones y contención a 320 px. Sin integración real. |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                      | Seis tests en dos archivos, exit 0                                            | Descubrimiento, no ejecución; E2E-RBAC ampliado, sin eliminar assertions anteriores.                                                                                                                                   |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`         | **No aprobado: exit 1** al crear red propia                                   | Docker sin daemon; no se ejecutaron servicios, migraciones ni recorridos. El ACK específico del harness se conserva, sin habilitar otros destinos.                                                                     |
| Prettier afectado / `git diff --check`                                                        | Aprobados                                                                     | Archivos afectados, sin schema, migraciones, manifiestos, dependencias, infraestructura o hooks modificados. Sin staging ni commit automático.                                                                         |

Comando de diez suites API:

```sh
npm test --workspace @testimonial-cms/api -- --runTestsByPath \
  test/catalog-mutations.spec.ts \
  test/catalog-nested-tags.spec.ts \
  test/user-history.spec.ts \
  test/credential.repository.spec.ts \
  test/auth.service.spec.ts \
  test/auth-flow.spec.ts \
  test/phase2-api-boundaries.spec.ts \
  test/testimonials.service.spec.ts \
  test/testimonial-content-validation.spec.ts \
  test/testimonial-event-payload.spec.ts
```

**Red/Green y correcciones de pruebas:** cinco fallos funcionales UI antes de implementar búsqueda/confirmaciones/creación directa/activación; fallos de contrato previos para limpieza de etiquetas, cache, duplicados e historial. Se observaron dos rechazos del input anidado incompatible con Prisma antes de corregirlo; el sustituto valida exclusivamente ese contrato, sin acreditar consultas/transacciones reales. Las fallas de fixture por constructor de caché, estructura de transacción heredada, opciones de Testing Library o tipos anidados no se presentan como Red funcional ni se usan para debilitar assertions. Se mantienen el NotFound y el tenant de la prueba heredada.

**Evidencia local:** `/tmp/frontend-phase4-*` y capturas sintéticas `/tmp/phase4-*`. No se versionan credenciales, contraseñas, tokens, cuerpos de usuarios reales o logs de proveedores. Las tres integraciones PostgreSQL nuevas están preparadas pero no ejecutadas, al igual que los seis E2E, Redis real, build de producción y CI. Ninguna aprobación se traslada al futuro SHA por estas pruebas locales.

**Commit sugerido:** `feat(admin): mejorá catálogos y gestión de usuarios`.

**Estado:** fase 4 preparada para revisión y commit, pendiente de ACK; detenerse antes de fase 5.

**Cierre registrado de fase 4 (2026-10-18):** commit humano `a9ab823` verificado, árbol limpio al iniciar y ACK «Continuar» para fase 5. Las omisiones de integración anteriores siguen vigentes.

### Fase 5 — vencimientos y revelación de API keys (2026-10-18)

**Alcance ejecutado:** únicamente fase 5 en `codex/mejoras-integrales-frontend`. Se aplicaron Impeccable `harden`/`clarify` y detector, junto con `api-key-security-engineering`, React/Next y testing. Contexto de Impeccable reutilizado de la sesión; craft-floor leído antes de editar. No se crean commits automáticamente.

**Implementación:** hora local mediante componentes de fecha; vencimiento intacto omitido en rotación para conservar segundos/milisegundos del servidor; validación de cambios futuros y fechas inexistentes; restricción de quitar vencimiento explicada según contrato vigente. Activa/Vencida/Revocada con acciones correspondientes y reemplazo independiente de una clave vencida. La API conserva su política y su autoridad.

La revelación identifica la integración, muestra la clave completa en un campo seleccionable y anuncia el resultado sin leer el secreto. Un fallo de clipboard selecciona el campo para copia manual. Abrir formulario, paginar o refrescar no la borra; generar otra exige confirmación y sólo la reemplaza al tener una respuesta válida. Ocultar o salir requiere decisión explícita. Un candado síncrono y controles deshabilitados bloquean envíos/mutaciones simultáneas. Gracia descrita como **hasta 24 horas**, sujeta a vencimiento anterior, vencimiento lógico actual, ventana legada y revocación.

La protección de salida intercepta enlaces, Cerrar sesión del shell y Atrás ordinario, además de `beforeunload` para recarga/cierre. Una entrada auxiliar de la misma URL guarda sólo un booleano junto al estado del router; no almacena credenciales. Se verificó cancelar y confirmar, regresar sin restaurar la revelación, y salir mediante Atrás tras navegación cliente. No se promete protección ante terminación del proceso/pestaña, salto múltiple del historial o pérdida de sesión. Esos límites y la recuperación de una operación incierta están en [web-api-keys](../modules/web-api-keys.md).

**Matiz de contrato corregido:** `legacy=true` puede permanecer tras migrar, porque el hash anterior sigue durante la gracia. No se preseleccionan ambos scopes de nuevo ni se pide migración si hay public ID nuevo. La selección histórica de ambos permisos sólo se aplica a una clave legada sin scopes. Adaptadores validan ID de rotación y confirmación efectiva de revocación; no se cambia criptografía ni expiración.

**Trazabilidad:** F08 → `key-form` y rotación UI en UTC/Argentina; F14 → estados y acciones; F15 → error posterior, cierre, navegación y copia manual. O11, ruta `/admin/api-keys` y formulario correspondiente actualizados en las matrices. Contrato y comportamiento documentados en `api-api-keys.md` y `web-api-keys.md`.

### Resultados finales de fase 5

| Verificación                     | Resultado                                                     | Límite/evidencia                                                                                                                                                                                                     |
| -------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suite web completa               | **271/271** en 46 archivos, exit 0                            | Vitest/Testing Library; no acredita backend real.                                                                                                                                                                    |
| UTC y Argentina                  | 3/3 por zona                                                  | `TZ=UTC` y `TZ=America/Argentina/Buenos_Aires`, `key-form.test.ts`: hora local, edición a UTC, instante intacto y entradas inválidas.                                                                                |
| API seleccionada                 | 6/6, dos suites                                               | `api-key-crypto.spec.ts` y `api-key-guard.spec.ts`; sin persistencia real.                                                                                                                                           |
| Tipos API/web                    | Ambos aprobados, exit 0                                       | Incluye el E2E ampliado y la integración preparada.                                                                                                                                                                  |
| Lint web/API afectada            | Sin errores, exit 0; diez advertencias web preexistentes      | Diez advertencias heredadas de imágenes/variables sin uso; API afectada sin avisos.                                                                                                                                  |
| Chrome/Playwright HTTP sintético | Cuatro combinaciones aprobadas y confirmadas, cero errores JS | 1440×1000 y 320×812, claro/oscuro, storage bloqueado, tabla contenida, fechas, errores, bloqueo, copia manual y salida. Prueba adicional funcional de salida confirmada/regreso/Atrás aprobada, sin capturas nuevas. |
| Impeccable detector              | Sin hallazgos (`[]`)                                          | Pantalla activa y shell; no sustituye pruebas ni revisión visual.                                                                                                                                                    |
| Descubrimiento E2E               | Seis tests en dos archivos, exit 0                            | E2E-SESSION amplía rotación precisa y ocultamiento/cancelación; conserva assertions anteriores y gates.                                                                                                              |
| Harness PostgreSQL/Redis/E2E     | **No aprobado: exit 1** al crear red propia                   | Docker no disponible. No hubo servicios, migraciones ni recorridos. ACK descartable conservado; no habilita otro destino.                                                                                            |
| Formato y diff                   | Aprobados                                                     | Sin cambios de schema, migraciones, infraestructura, dependencias, raíz ni hooks; sin staging/commit.                                                                                                                |

**Red/Green:** antes de corregir producción fallaron funcionalmente el vencimiento reenviado con pérdida de precisión, estado de vencida, revelación perdida al siguiente envío, doble submit, respuestas ajenas/no confirmadas de los adaptadores, ampliación de permisos de una clave ya migrada y salida por Cerrar sesión sin confirmación. Una primera assertion de revelación esperaba un campo inexistente en el código viejo: se corrigió el selector y se reprodujo después la desaparición funcional real; esa falla de selector no se cuenta como Red. La primera ejecución completa fue terminada con exit 143, sin resultado: no se cuenta como aprobación. El reintento aprobó 268/268 y la primera verificación final 270/270. Al añadir la regresión de Cerrar sesión se repitió la suite final: 271/271, sin omisiones. No se desactivaron gates ni se alteraron expectativas para ocultar fallas.

**Pendientes reales:** integración PostgreSQL nueva que comprueba rotación sin expiración explícita e instante persistido exacto, integraciones HTTP/Redis existentes y seis E2E del harness; build de producción y checks del futuro SHA. No se confunden fixtures con servicios reales. La validación visual hizo una ronda agrupada, corrigió alineación de campos y una expresión de copy en un único lote, y realizó una sola confirmación. No se hicieron capturas con secretos ni se generaron credenciales reales para evidencia.

**Evidencia efímera saneada:** `/tmp/phase5-*`, `/tmp/frontend-phase5-*`; imágenes sólo de listado/formulario/confirmación sin revelación. Ningún token, contraseña o secreto se agrega al repositorio o a documentos de contexto.

**Commit sugerido:** `fix(api-keys): corregí vencimientos y protegé la revelación`.

**Estado:** fase 5 preparada para revisión y commit, pendiente de ACK; detenerse antes de fase 6.

**Cierre registrado de fase 5 (2026-10-18):** commit humano `52e4800` verificado, árbol limpio al iniciar y ACK «Continuar» para fase 6. Se conservan los límites de integración reales de las fases anteriores.

### Fase 6 — configuración y entregas de webhooks (2026-10-18)

**Autorización y alcance:** únicamente fase 6 en `codex/mejoras-integrales-frontend`. Impeccable `harden`/`clarify`, craft-floor y detector; skill `webhook-architecture-engineering` contrastada con el ledger PostgreSQL y las políticas reales del proyecto. No se adoptan como requisitos nuevos las arquitecturas genéricas, colas ni capacidades de terceros de esa skill. No se cambió backend de producción, esquema, criptografía, política de gracia ni infraestructura.

**Implementación:** candado síncrono por destino, con estado ocupado y operaciones independientes en otros destinos. La generación de secretos se serializa además globalmente por existir un único espacio de revelación. La UI no permite repetir una rotación conocida en gracia; explica un 409 por gracia/cambio concurrente, conservando su contexto. Secretos exclusivamente en memoria, separados de metadata, con URL/evento y fecha de gracia confirmados por API; copia anunciada y fallback manual; ocultamiento y reemplazo deliberados. Abrir otro formulario o un error de generación no elimina el secreto anterior. No se promete recuperación después de abandonar la página o cerrar el proceso.

Se integraron edición HTTPS/evento y pausa/reactivación mediante PATCH existente, con campos conservados ante errores y confirmación para descartar cambios. La reactivación conoce bloqueos legados y orienta a editar HTTPS o rotar firma; la API sigue siendo autoridad. El DELETE se presenta como **archivo**, conserva su registro e historial, y no cancela retroactivamente entregas ya encoladas. Pausar tiene ese mismo límite. Se muestran los eventos registrados y se conserva un código actual distinto sin inventar otros.

El historial se compone fuera del contenedor horizontal del listado; URL/evento actual, IDs de evento/entrega, estado en español y hasta 20 intentos recientes expandibles con teclado. El contador puede incluir intentos anteriores y otros ciclos. Se conserva destino/página al actualizar o reintentar, se corrigen páginas fuera del total y se ignoran consultas obsoletas. Una mutación tardía no vuelve a seleccionar otro recurso ni reabre un historial cerrado. Los avisos se identifican por destino y sobreviven a paginación/recarga. Prueba aceptada y reenvío pendiente se anuncian como **encolados**, nunca como recepción confirmada. Un 2xx no acredita procesamiento interno del receptor.

**Trazabilidad:** F07 → bloqueo por destino y de generación, gracia/409 y respuestas tardías; F20 → contexto de secreto/historial, página conservada y copia anunciada. O12, ruta `/admin/webhooks` y ambos formularios actualizados en las matrices. Contratos y límites en [api-webhooks](../modules/api-webhooks.md) y [web-webhooks](../modules/web-webhooks.md).

### Resultados finales de fase 6

| Verificación                                                  | Resultado                                                     | Evidencia/límite                                                                                                                                                                                                             |
| ------------------------------------------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2` | **291/291**, 48 archivos, exit 0                              | 53,42 s. Incluye regresiones previas y hosts de confirmación; no acredita DB/HTTP reales. Primera pasada 289/289; se agregaron dos casos pertinentes de rotación pendiente y copia anunciada antes de la final.              |
| Selección webhooks/confirmaciones                             | **25/25**, cuatro archivos, exit 0                            | Bloqueo sin esperar render, página, secreto, intentos, PATCH, error/409, flags legados, copia, generación fallida, consulta y mutación tardías.                                                                              |
| Selección API                                                 | **33/33**, seis suites, exit 0                                | Administración, SSRF, firmas/secretos, política de destino, transporte y retry; mocks donde se declaran, sin ledger PostgreSQL real. Comando debajo.                                                                         |
| Tipos web/API                                                 | Ambos aprobados, exit 0                                       | Incluye ampliación E2E e integración PostgreSQL preparada.                                                                                                                                                                   |
| Lint web/API afectada                                         | Sin errores, exit 0                                           | Diez advertencias web heredadas sobre imágenes/variables sin uso; API afectada sin avisos.                                                                                                                                   |
| Chrome/Playwright con HTTP simulado                           | Cuatro combinaciones aprobadas y confirmadas, cero errores JS | Escritorio 1440×1000 y móvil 320×812, claro/oscuro, storage bloqueado, datos largos, errores, reintentos, operaciones y copia. No se envió a proveedores ni se generaron secretos reales para capturas.                      |
| Contraste y teclado                                           | Aprobados en combinaciones medidas                            | Estados success/warning sobre fondo efectivo: mínimo 6,03:1 claro y 11,45:1 oscuro. Expansión de intentos con Enter, foco inicial de cancelación y URL extrema contenida en confirmación. No es una auditoría WCAG completa. |
| Impeccable detector                                           | Sin hallazgos (`[]`), exit 0                                  | Pantalla, historial, revelación y confirmación compartida; no sustituye el resto de pruebas.                                                                                                                                 |
| `npm run test:e2e:list --workspace @testimonial-cms/web`      | Seis tests en dos archivos, exit 0                            | E2E-RBAC ampliado para denegación de GET/PATCH y navegación directa al editor; assertions anteriores y gates conservados. Descubrimiento, no ejecución.                                                                      |
| Harness autorizado PostgreSQL/Redis/E2E                       | **No aprobado: exit 1** al crear red propia                   | `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`. Docker no disponible; no se ejecutaron servicios, migraciones ni recorridos. ACK descartable conservado.                              |
| Formato / `git diff --check`                                  | Aprobados; 16 archivos formateados, sin errores               | Sólo archivos afectados. No hay cambios en schema, migraciones, manifiestos, raíz, dependencias, infraestructura ni hooks. Sin staging/commit automático.                                                                    |

```sh
npm test --workspace @testimonial-cms/api -- --runTestsByPath \
  test/webhook-admin-controls.spec.ts \
  test/webhooks-service-ssrf.spec.ts \
  test/webhook-secret-contract.spec.ts \
  test/webhook-destination-policy.spec.ts \
  test/webhook-transport-ssrf.spec.ts \
  test/delivery-retry-policy.spec.ts
```

**Red/Green y fixtures:** seis fallos funcionales iniciales UI (duplicación, actualización a página 1, revelación sin contexto, ausencia de estados/intentos, replay tardío que volvía a otro recurso y falta de edición) y cinco fallos de adaptadores (destino/entrega ajenos o archivo no confirmado). Se corrigió la fixture compartida que retiraba el webhook del listado al borrar: el backend ya lo archivaba y conservaba. La prueba ahora también exige ver el estado Archivado, sin quitar la cancelación ni la assertion de una sola mutación. Esa diferencia de fixture no se cuenta como un defecto nuevo del backend. Las pruebas nuevas del servicio caracterizan sus restricciones vigentes; no se presentan como una implementación nueva de seguridad.

**Revisión visual acotada:** una ronda agrupada y un único lote de ajustes: intentos como filas separadas y contención de URL extensa en la confirmación compartida. Se reforzó además el cambio inmediato de referencia del historial para evitar una ventana entre un click y el próximo render. Una sola ronda de confirmación verificó cuatro combinaciones, hostname de 63 caracteres más path extenso, contraste y teclado. No se siguió puliendo después.

**Pendientes reales:** la integración PostgreSQL ampliada prueba URL/evento, pausa, tenant y archivo conservado; está preparada pero no ejecutada. También pendientes las integraciones HTTP/Redis/ledger existentes, los seis E2E, build de producción y CI del futuro SHA. Las pruebas de frontend con fixtures y los sustitutos de persistencia no se presentan como aceptación de esas capas.

**Evidencia efímera saneada:** `/tmp/phase6-*` y `/tmp/frontend-phase6-*`; capturas exclusivamente de listado, formulario, intentos y confirmaciones sin revelación. Sin secretos, tokens, contraseñas o datos de personas reales versionados en contexto/evidencia.

**Commit sugerido:** `feat(webhooks): mejorá configuración y seguimiento de entregas`.

**Estado:** fase 6 preparada para revisión y commit, pendiente de ACK; detenerse antes de fase 7.

### Fase 7 — configuración independiente e identidad del espacio (2026-10-18)

**Autorización/base:** ACK «Continuar» tras verificar `24b64b6`, rama correcta y árbol limpio. La respuesta humana específica autoriza editar `enable_analytics` y `enable_webhooks` como parámetros técnicos, aclarando que no controlan acceso, tracking o entregas. No se amplía el backend para atribuirles ese efecto. Fase 8 sin autorización.

**Cambios:** nombre, logo, enlace y recepción con guardados, bloqueos, errores y mensajes propios; parámetros en recurso independiente. Los editores permanecen montados durante refrescos, conservan borradores y feedback, y permiten descartar explícitamente. Las respuestas de escrituras paralelas se fusionan por campo; las lecturas obsoletas no revierten confirmaciones. Nombre confirmado compartido en memoria entre ajustes, shell desktop/móvil e Inicio, también tras refrescar datos de servidor; no se inventa selector multiempresa. Se reemplaza la imagen rota del shell por un ícono de la biblioteca vigente.

Logo con descarte de selección, confirmación de borrado y cancelación segura; una selección pendiente no se confunde con el logo guardado. Feedback enfocable tras guardar y retorno al contenido cuando el disparador queda deshabilitado tras eliminar. Enlace mostrado desde el valor confirmado, clipboard con selección manual de recuperación y distinción entre slug configurado y recepción abierta. El cierre conserva marca/galería y requiere confirmación. Las capacidades explican el efecto real de Testimonios y el scoring horario documentado; se retiran promesas de IA. La guía opcional del Inicio usa metadatos y totales reales, no da por compartido lo copiado ni por publicado lo aprobado, y no agrega consultas administrativas a editores ni persiste un progreso ficticio.

**Trazabilidad:** F19, O04, O14, parte de O24, rutas `/admin/settings` y `/admin`, formulario de logo/configuración y shell actualizados en las matrices. Contratos y límites en [web-settings](../modules/web-settings.md). No hay cambios de esquema, migraciones, infraestructura, dependencias, hooks, manifiesto raíz ni producción backend.

| Comando/evidencia                                                                                                                                                                                                            | Resultado                                                                             | Alcance/límite                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                                                                                                                                                | **307/307**, 50 archivos                                                              | Suite final completa, sin omisiones. Incluye fallas independientes, slug/nombre preservados, GET tardío, escrituras concurrentes, errores 409/503, flag confirmado, pertenencia de respuesta, logo, foco e identidad.                                                            |
| `npm test --workspace @testimonial-cms/api -- --runTestsByPath test/workspace-settings-http.integration.spec.ts test/tenant-logo-http.integration.spec.ts test/tenant-logo.spec.ts` y repetición dirigida del primer archivo | **24 existentes + 6 contratos nuevos aprobados**                                      | Controladores, DTOs, guards, CSRF, interceptor y servicios reales; repositorios/proveedor simulados. Sin PostgreSQL/Redis/Cloudinary.                                                                                                                                            |
| `npm run typecheck --workspace @testimonial-cms/web`, equivalente API                                                                                                                                                        | Aprobados                                                                             | Sin omitir errores de tipos.                                                                                                                                                                                                                                                     |
| `npm run lint --workspace @testimonial-cms/web`; ESLint del test API afectado                                                                                                                                                | Sin errores; **9 advertencias web preexistentes**, ninguna nueva; API afectada limpia | La advertencia introducida durante desarrollo en cleanup de un ref fue corregida. Se elimina una advertencia previa de img al reemplazar la marca rota.                                                                                                                          |
| Prettier sobre archivos afectados; `git diff --check`                                                                                                                                                                        | Aprobados                                                                             | Código y documentación, sin archivos protegidos ni staging.                                                                                                                                                                                                                      |
| Detector Impeccable sobre 9 archivos UI afectados                                                                                                                                                                            | `[]`, exit 0                                                                          | Detector determinista; no certifica accesibilidad integral.                                                                                                                                                                                                                      |
| Chrome local con Playwright; Next dev; 1440×1000 y 320×812, claro/oscuro, reduced motion y storage denegado                                                                                                                  | Cuatro combinaciones sin errores JS ni overflow horizontal                            | API interceptada con fixtures sintéticas. Identidad persistente, flags fallidos sin bloqueo, draft de slug, logo/refresco, Cancelar/Escape, borrado confirmado, foco, copia manual y guía plegable con teclado. Sin aceptación de servicios reales ni dispositivo táctil físico. |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`                                                                                                                                        | Falla al crear la red exclusiva del harness                                           | Autorización humana vigente sólo para harness descartable. Docker no disponible: no se crearon servicios ni se ejecutaron migraciones/E2E. No se desactivaron gates.                                                                                                             |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                                                                                                                                                     | **6 recorridos descubiertos**                                                         | Se amplía RBAC con GET/PATCH de flags denegados a editor y navegación directa a Ajustes. Descubrimiento no equivale a ejecución.                                                                                                                                                 |

**Red/Green y correcciones de pruebas:** se reprodujeron funcionalmente flags fallidos ocultando la marca, consultas administrativas desde un editor, eliminación del logo sin confirmación, pérdida de foco al deshabilitar el disparador o el botón de guardar un campo y la promesa de recepción sin slug. Los primeros selectores de campos nuevos que todavía no existían no se cuentan como Red funcional. Se corrigieron selectores ambiguos entre form/input y una comparación exacta contra un párrafo compuesto; no se cambió la conducta esperada. En HTTP, el supuesto inicial de rechazar campos adicionales en PATCH era incorrecto: los DTOs vigentes los descartan. La prueba final exige que un tenantId aportado por el cliente nunca cambie la pertenencia autenticada, sin alterar el contrato. Una regresión adicional comprobó que una confirmación tardía robaba foco a otra tarea: se limita la recuperación al editor de origen o al foco perdido, preservando la interacción en curso. El primer intento HTTP no pudo abrir sockets por sandbox; se ejecutó después con autorización de sockets locales.

**Impeccable:** workflows Operate, harden, clarify y onboard aplicados a esta fase. Una ronda agrupada, corrección en bloque y una confirmación posterior. La primera ronda se interrumpió por el timeout de compilación inicial de `/admin`; se completó ampliando la espera de la herramienta, sin considerar ese intento aprobación ni defecto del producto. La revisión detectó la marca rota y se corrigió. Pares de texto en reposo: mínimo observado **5,14:1 claro / 7,42:1 oscuro**. La confirmación capturó además una muestra intermedia de **1,91:1** durante el crossfade de Copiar en móvil claro: se suprime esa transición en el control, conservando sus colores finales. No se abre otra ronda visual de pulido. La actualización de identidad desde un refresco y el retorno de foco al campo editado después del guardado se verifican además con pruebas de comportamiento. No se reclama certificación WCAG, rendimiento de producción ni validación completa de rutas ajenas a esta fase.

**Límites/cierre:** las nuevas interacciones reutilizan endpoints vigentes; la API sigue siendo autoridad. CI/servicios reales y SHA final pendientes; sin despliegue. Cambios y borradores viven en memoria; no se implementa persistencia de borradores frente a recarga completa/navegación fuera de ruta. Fase 7 queda `[Actual]`, implementada y pendiente de commit humano y ACK. Sugerencia: `feat(settings): mejorá la configuración y la puesta en marcha`. Detenerse; el próximo ACK habilita sólo fase 8.

### Fase 8 — acceso y creación de espacios (2026-10-18)

**Autorización/base:** ACK «Continuar» tras verificar `8152850`, rama correcta y árbol limpio. Se ejecuta sólo fase 8; fase 9 sin autorización.

**Cambios:** login y registro vacíos, sin acceso demo ni credenciales públicas. Un marco compartido conserva crema/terracota, serif editorial y controles sans, y agrega un único `main`, título de tarea móvil/desktop, regreso a Inicio y enlaces cruzados en voseo. Se retiran términos internos como tenant y la identificación legal no acreditada del panel de acceso. Crear espacio describe la primera cuenta administradora y el ingreso al panel, sin prometer solicitudes, invitaciones o recuperación de contraseña.

Los requisitos se presentan antes del envío: nombre 3–120, email y contraseña nueva 8–72 con mayúscula, minúscula, número y símbolo. El login conserva compatibilidad con contraseñas existentes sin imponerles esa política nueva. Errores locales asociados a campos y foco al primero inválido; errores del servidor contextualizados en español, asociados al formulario/campos y sin exponer detalles técnicos arbitrarios. Fallos 401/409 y resultados inciertos conservan texto y contraseña sólo en memoria. Un candado síncrono y campos de sólo lectura impiden cambios/dobles envíos pendientes; tras confirmación se mantiene el bloqueo hasta navegar. No se alteran API, cookies, CSRF, sesión, refresh, logout o `/admin` como destino. No hay cambios de esquema, infraestructura, dependencias, hooks ni manifiesto raíz.

**Trazabilidad:** F10, O02, O03, rutas `/admin/login` y `/admin/register` y ambos formularios actualizados. Contrato y límites en [web-auth](../modules/web-auth.md); especificación [API Auth](../modules/api-auth.md) aclarada sin cambios backend. Se mantienen seis E2E y sus gates: SESSION amplía validación de registro vacío y el helper de login verifica main, título, regreso y campos vacíos antes de ingresar credenciales propias.

| Comando/evidencia                                                                                                                                                                                     | Resultado                                                                                                  | Alcance/límite                                                                                                                                                                                              |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                                                                                                                         | **318/318**, 50 archivos                                                                                   | Suite completa sin omisiones; auth dirigida 18/18, transporte/upgrade, formularios y resto del frontend.                                                                                                    |
| `npm test --workspace @testimonial-cms/api -- --runTestsByPath test/auth.service.spec.ts test/auth.controller.spec.ts test/auth-flow.spec.ts test/password-dto.spec.ts test/password.service.spec.ts` | **27/27**, cinco suites                                                                                    | Política/hash y flujos de auth seleccionados; persistencia/servicios externos simulados donde la suite lo define. No equivale a integración PostgreSQL/Redis.                                               |
| `npm run typecheck --workspace @testimonial-cms/web`                                                                                                                                                  | Aprobado                                                                                                   | No se cambia producción backend.                                                                                                                                                                            |
| `npm run lint --workspace @testimonial-cms/web`                                                                                                                                                       | Sin errores, **9 advertencias previas**                                                                    | Sin nuevas advertencias ni supresiones.                                                                                                                                                                     |
| Prettier sobre archivos afectados; `git diff --check`                                                                                                                                                 | Aprobados                                                                                                  | Sin staging ni archivos protegidos alterados.                                                                                                                                                               |
| Detector Impeccable sobre seis archivos UI de autenticación                                                                                                                                           | `[]`, exit 0                                                                                               | No certifica por sí solo accesibilidad ni integridad del flujo.                                                                                                                                             |
| Chrome local/Playwright + Next dev, 1440×1000 y 320×812, claro/oscuro, reduced motion y storage denegado                                                                                              | Cuatro combinaciones; cero errores JS y overflow horizontal; foco/Tab, validación y reintentos conservados | Respuestas API sintéticas. Cero POST al enviar vacío; un intento rechazado y otro confirmado por flujo. Se comprueban ambos destinos `/admin`; no se capturan contraseñas ni valores de acceso en imágenes. |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`                                                                                                                 | Falla al crear la red exclusiva                                                                            | Docker no disponible: no se iniciaron servicios ni ejecutaron migraciones o E2E. Autorización limitada al harness descartable permanece vigente; no se desactivan gates.                                    |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                                                                                                                              | **6 recorridos descubiertos**                                                                              | Discovery no equivale a aceptación real. CI y SHA final pendientes.                                                                                                                                         |

**Red/Green:** antes de producción fallaron campos inicialmente vacíos, validación asociada, requisitos anticipados, errores localizados y bloqueos de doble submit. Las pantallas originales fallaron por ausencia de `main`/título de tarea y regreso; tres pruebas de navegación con campos explícitos siguieron aprobando antes del cambio de marco. Las fallas causadas por valores antiguos acumulados al escribir sobre inputs precargados no se cuentan como una regresión independiente. No se relajaron reglas, gates ni assertions para ocultar defectos.

**Impeccable:** workflows Operate/clarify/harden. Ronda visual agrupada con corrección en bloque y una única confirmación posterior, sin más pulido. El arranque de la herramienta se interrumpió por compilación inicial de Next mayor que su timeout; luego un selector de alertas también incluía el anunciador interno de Next. Se corrigen la espera/alcance del selector y se completa la ronda; esos intentos no son defectos de producto ni aprobación. La revisión detecta una muestra transitoria de contraste **3,72:1** en el submit al interpolar el tema: se suprime la transición de color de los controles de autenticación. Confirmación de pares estables: mínimo **5,14:1 claro / 7,42:1 oscuro**, sin combinaciones por debajo del umbral medido. No se reclama certificación WCAG, zoom real al 200%, dispositivo táctil físico ni rendimiento de producción. Se preserva el overlay de desarrollo existente para la fase 12.

**Cierre:** implementación y validación local preparadas; integración real/CI pendientes por sus servicios y SHA. Evidencia sintética declarada, sin despliegue. Fase 8 conserva `[Actual]`, pendiente de commit humano y ACK. Sugerencia: `fix(auth): aclará el acceso y eliminá valores preseleccionados`. Detenerse; el próximo ACK habilita únicamente fase 9.

### Fase 9 — captura y galería públicas (2026-10-18)

**Autorización/base:** ACK «Continuar» tras verificar `b665226`, rama correcta y árbol limpio. Se ejecuta exclusivamente fase 9; fase 10 sin autorización.

**Cambios:** galería con nombre/logo desde form-info aunque la recepción esté cerrada, carga de marca independiente, alcance visible y Cargar más de veinte en veinte. El adaptador conserva/valida meta, página, límite e IDs únicos; una falla al cargar más conserva lectura y reintenta esa misma página. Bloqueo síncrono, deduplicación entre páginas, cancelación/descarte por slug y foco al primer autor nuevo. Sin rótulos View/Click/Play; citas editoriales, rating textual y expansión identificada por autor. Se contienen nombres de 120 caracteres sin espacios. Imágenes/miniaturas siguen lazy/async; una imagen fallida queda como mensaje compacto. YouTube conserva carga por acción, anuncio de preparación, contenedor estable y enlace externo de recuperación. Tracking y storage fallidos no bloquean contenido.

Captura exige elegir 1–5 estrellas y muestra la valoración en texto; texto/nombre con límites vigentes y tipografía de control legible. Foto opcional PNG/JPEG/WebP hasta 10 MiB informada antes de seleccionar, lectura anunciada y bloqueante para envío, error local y Quitar foto. URLs compatibles de YouTube validadas antes del POST. Un candado evita envíos duplicados; campos/rating no se editan pendientes. Recepción cerrada y confirmación conservan marca y acceso a la galería. Se preserva el borrador ante error, se enfoca la confirmación y el parcial explica que el texto ya se guardó y no debe reenviarse. Se elimina la promesa de revisión «en breve» sin un plazo acreditado.

**Contratos/alcance:** endpoints y cuotas existentes, sin producción backend, esquema, migraciones, infraestructura, dependencias ni hooks nuevos. La política de publicación y el filtro por tenant permanecen en la API. El total corresponde a la última consulta; no se promete un snapshot entre páginas de una colección que cambia. Especificación y límites en [web-public-testimonials](../modules/web-public-testimonials.md). F09, F22, O15/O16, ambas rutas y formularios actualizados en matrices.

| Comando/evidencia                                                                                                                                                                  | Resultado                                                                                                                                              | Alcance/límite                                                                                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                                                                                                      | **329/329**, 51 archivos                                                                                                                               | Suite final completa sin omisiones; lectura de foto pendiente, bloqueo, parcial, rating, publicación 21/reintento, cambio de slug, storage/tracking y medios.                                                                          |
| `npm test --workspace @testimonial-cms/api -- --runTestsByPath test/testimonials.service.spec.ts test/public-capture-response.spec.ts test/testimonial-content-validation.spec.ts` | **25/25**, tres suites                                                                                                                                 | Servicio/controlador y validación seleccionados con persistencia/proveedor simulados según suite. No acredita PostgreSQL/Redis o proveedor real.                                                                                       |
| Nueva prueba en `testimonial-persistence.integration.spec.ts`                                                                                                                      | **Escrita, no ejecutada localmente**                                                                                                                   | Prepara 21 publicados, un pendiente y un publicado de otro tenant con categoría homónima; valida 20+1 y exclusión. Requiere TEST_DATABASE_URL del entorno descartable/CI. No se cuenta entre las 25 aprobadas.                         |
| `npm run typecheck` de web y API                                                                                                                                                   | Aprobados                                                                                                                                              | Sin suprimir errores de tipos.                                                                                                                                                                                                         |
| Lint web y ESLint del test API afectado                                                                                                                                            | Sin errores; **9 advertencias web preexistentes**, ninguna nueva; test API limpio                                                                      | Se corrigió durante desarrollo una advertencia nueva sobre cleanup de ref; no se agrega suppress.                                                                                                                                      |
| Prettier de archivos afectados; `git diff --check`                                                                                                                                 | Aprobados                                                                                                                                              | Sin staging ni archivos protegidos alterados.                                                                                                                                                                                          |
| Detector Impeccable sobre ambas pantallas públicas                                                                                                                                 | `[]`, exit 0                                                                                                                                           | Detector determinista; no sustituye pruebas de comportamiento ni certificación de accesibilidad.                                                                                                                                       |
| Chrome/Playwright + Next dev; 1440×1000 y 320×812, claro/oscuro, reduced motion y storage denegado                                                                                 | Cuatro combinaciones; cero errores JS y desbordes; marca con recepción cerrada; 20+1 y foco; retry; tracking fallido; rating y adjuntos; 429 y parcial | Respuestas y contenido sintéticos. Miniaturas/proveedor simulados; nada se atribuye a Cloudinary/YouTube real, cookies, cuotas o integración remota.                                                                                   |
| `E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 npm run test:e2e --workspace @testimonial-cms/web`                                                                                              | Falla al crear la red exclusiva                                                                                                                        | Docker no disponible: no se crearon servicios ni se ejecutaron migraciones/E2E. Sólo sigue autorizado el harness descartable; no se tocan bases persistentes ni se desactivan gates.                                                   |
| `npm run test:e2e:list --workspace @testimonial-cms/web`                                                                                                                           | **6 recorridos descubiertos**                                                                                                                          | Assertions ampliadas para rating deliberado/marca. Se corrige además el selector final de sesión que aún usaba la capitalización anterior del botón de login; sin cambios de auth. Discovery no es ejecución. CI/SHA final pendientes. |

**Red/Green:** captura original reproduce rating preseleccionado y falta de límites/estado previo a adjuntos. El adaptador de HEAD, probado aisladamente y restaurando después el archivo de trabajo, reproduce descarte de meta y aceptación de paginación inválida; un primer lanzamiento coincidió con la edición y había probado ya el código nuevo, por lo que no se cuenta como Red. Los tests iniciales de galería que recibían el nuevo objeto `{items,meta}` contra una pantalla antigua que esperaba un array fallaban por contrato de fixture y tampoco se cuentan como Red funcional. Se valida finalmente el conjunto integrado. El fallback externo heredado falló antes de su corrección. Se añaden además verificaciones de lector de archivo pendiente, slug tardío, bloqueos y recuperación sin alterar las garantías previas.

**Impeccable:** modos Read/Operate, harden/clarify/adapt. Ronda agrupada con corrección en bloque y una confirmación posterior, sin otra iteración de pulido. La herramienta inicial intentó click/check sobre el radio `sr-only` y su span visible interceptó ese click: se usa la etiqueta visible en browser y Espacio en E2E para verificar interacción real, sin force. La confirmación se reanudó tras cerrarse el servidor local antes de navegar; ese intento no se considera aceptación ni defecto UI. La prueba de nombres sin espacios encontró elementos con ancho intrínseco de 5423/3389 px pese al recorte de la página: límites corregidos, confirmados en 672/414 px desktop y 272/174 px móvil, sin overflow interno. Se amplían las acciones de lectura a texto de 14 px, se compacta marca/cabecera móvil y el error de imagen; se anuncia carga del reproductor. Pares medidos: mínimo **5,14:1 claro / 7,42:1 oscuro**, sin fallas en combinaciones inspeccionadas. No se reclama certificación WCAG, zoom real al 200% ni dispositivo físico. Overlays heredados/medición de producción se conservan para fase 12.

**Cierre/límites:** captura/galería preparadas y validadas localmente. Persistencia, aislamiento real del nuevo caso 20+1, seis E2E y CI pendientes del entorno/SHA correspondiente; no hay despliegue. Cierre humano posterior: commit `380cba0` verificado y ACK recibido para fase 10. Sugerencia original: `feat(public): mejorá la captura y la galería de testimonios`. Detenerse; el próximo ACK habilita únicamente fase 10.

### Fase 10 — Analítica y siete superficies de BI (2026-10-18)

**Autorización/base:** ACK «Continuar» posterior al commit humano de fase 9 `380cba0`; rama `codex/mejoras-integrales-frontend`, árbol inicialmente limpio. Se ejecutó únicamente fase 10. Fase 11 sigue pendiente de autorización.

**Implementación:** Analítica conserva totales/eventos anteriores y agrega período acumulado desde el primer evento, observación UTC y límite real de 50. La lectura usa una transacción RepeatableRead con filtro de tenant/evento/referencia y límite temporal; selecciona autor y extracto Unicode junto con la lista, sin solicitudes individuales de la pantalla. El adaptador valida metadatos y referencias; ahora muestra también la fila 21, tipos en español, detalle contextual autorizado y un vacío con acciones para publicación/distribución. Contrato: [web-analytics](../modules/web-analytics.md).

Las siete superficies BI mejoran vigencia/resultado/acción, escala y unidades del gráfico con detalle exacto y huecos, distinción de solicitudes/intentos y diferencias de auditoría antes de los identificadores técnicos. Las acciones operativas/de recuperación quedan cerca del resultado. Configuración conserva revisión de conflictos y protege enlaces, cierre de sesión, Atrás y recarga/cierre nativo. La sincronización de la entrada de historial evita superponer una nueva edición con la retirada asíncrona del guard después de guardar. Sólo se agrega un marcador booleano al historial; draft y protocolo incierto siguen en memoria. Tablas posicionadas y contenidas permiten scroll horizontal con foco por teclado; navegación y etiquetas táctiles tienen áreas ampliadas. No se alteran adaptadores BI, comandos, idempotencia, polling, CSV, permisos ni UTC. Detalle: [web-business-intelligence](../modules/web-business-intelligence.md).

| Verificación                                                                                                                                        | Resultado                                         | Alcance y límites                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web `npm test --workspace @testimonial-cms/web -- --maxWorkers=2`                                                                                   | **345/345**, 54 archivos, sin omisiones           | Suite completa y 30 casos enfocados posteriores al ajuste de vacío inicial; incluye contratos/errores de Analítica, fila 21, auditoría, protección/reversión/guardado/busy, carrera del historial y garantías existentes de CSV/polling/comandos inciertos.                                                                                                                                                                                           |
| API: analytics-dashboard, analytics.service, bi-operations, bi-operations-policy, bi-dashboard, bi-operations-http.integration, bi-http.integration | **37 aprobadas; 39 omitidas**                     | Las 39 requieren `TEST_BI_WAREHOUSE_DATABASE_URL`, ausente; no se cuentan como aceptación de BI persistente. Los casos HTTP ejecutados usan Nest/Supertest y repositorios/credenciales simulados o controles deshabilitados. El primer intento falló por `listen EPERM`; la repetición con sockets locales autorizados pasó los 37 casos ejecutables, sin modificar código para el sandbox.                                                           |
| Tipos API/web y lint de archivos API afectados/web completo                                                                                         | Sin errores; **9 advertencias web preexistentes** | Se corrigió el tipado de las nuevas fixtures Prisma con `statusId`; el primer lint API ejecutado desde raíz no encontró su config y se repitió desde `apps/api`. No se cambió configuración ni se suprimieron avisos.                                                                                                                                                                                                                                 |
| Formato de archivos modificados y `git diff --check`                                                                                                | Conforme                                          | Sólo archivos de la fase; sin staging ni commit automático.                                                                                                                                                                                                                                                                                                                                                                                           |
| Red funcional inicial                                                                                                                               | Web: **4 fallos / 24 pasan**; API: **3 fallos**   | Antes de producción: falta de contexto/fila 21/vacío útil, ausencia de aviso de salida/diferencias y metadatos/alcance de repositorio. La regresión específica de carrera del historial se agregó después de detectarla en navegador; no se presenta como Red previo.                                                                                                                                                                                 |
| Chromium local / transporte sintético                                                                                                               | **32 combinaciones de superficie/tamaño/tema**    | Analítica + siete BI × 1440×1000 / 320×812 × claro/oscuro. Documento final igual al viewport, sin errores de página; contraste mínimo medido 5,1356:1 claro / 7,4176:1 oscuro en los textos incluidos. Scroll de tabla con teclado, detalle desde evento, cancelación/descarte de salida, Atrás, 409→versión vigente→conservar→guardar y editor de sólo lectura. No equivale a integración, lector de pantalla, Safari/Firefox ni dispositivo físico. |
| Detector Impeccable sobre pantallas/componentes modificados                                                                                         | Sin hallazgos                                     | Complementa el examen de código y navegador; no certifica calidad o accesibilidad integral.                                                                                                                                                                                                                                                                                                                                                           |
| Caso PostgreSQL nuevo de Analítica                                                                                                                  | Escrito y tipado; **no ejecutado**                | Dos tenants, 51 eventos, límite 50, orden, totales y contexto autorizado. Se conserva el gate de base aislada del archivo de persistencia.                                                                                                                                                                                                                                                                                                            |
| Seis E2E / harness real                                                                                                                             | **Bloqueados antes de servicios**                 | Run `d6a90deadd17`: `Create owned network failed (1)`. ACK de migraciones descartables vigente, pero no hubo servicios/migraciones/ejecución. Los seis recorridos siguen detectables; E2E-PUBLISH ahora registra un evento público y verifica Analítica/detalle con persistencia real cuando el harness esté disponible.                                                                                                                              |

**Ronda visual acotada:** la inspección agrupada sufrió interrupciones por selectores del script (Configuración duplicada, label de select y alert del anunciador Next), que se acotaron por navegación/rol/main; no se modificó producto para satisfacerlos. Después se completaron escritorio y móvil en ambos temas. Ejecuciones y detalle de solicitud mostraron documento de 874 px con viewport 320: los spans `sr-only` tenían BODY como bloque de posicionamiento y escapaban del scroll. Se corrigieron los wrappers posicionados; el documento final mide 320 y los spans quedan contenidos en DIV. La misma ronda encontró la carrera de Atrás tras guardar/reeditar. Se aplicó un lote de correcciones y una única ronda completa de confirmación, sin nuevas iteraciones visuales de pulido. La revisión posterior de código agregó descarte de salida diferida al desmontar y evitó presentar inventario observado donde falta el primer corte; ambos ajustes se verificaron con 30 casos enfocados, sin otra ronda visual. Agent-browser no está instalado; se usó Playwright/Chromium ya disponible, sin instalar dependencias. Capturas y mediciones temporales contienen sólo fixtures sintéticas; no se copian datos privados ni secretos a documentación.

**Cierre/límites:** implementación y validación local terminadas. PostgreSQL, warehouse real, seis E2E y CI del SHA final siguen pendientes de su entorno; no hay despliegue. Sin esquema/migraciones nuevas, infraestructura, hooks o manifiestos/dependencias. Cierre humano posterior: commit `a23d6df` verificado y ACK recibido para fase 11. Commit sugerido: `feat(analytics): clarificá métricas y operación de inteligencia de negocio`. Detenerse; el próximo ACK habilita sólo fase 11.

### Fase 11 — Landing, ayuda y rutas preparatorias (2026-10-18)

**Autorización/base:** commit humano de fase 10 `a23d6df` verificado, rama correcta y árbol limpio. El ACK «Continuar» autorizó sólo fase 11; la continuación tras el corte de contexto/tokens preservó los cambios y esa fase. No se ejecutó fase 12.

**Implementación:** portada editorial con titulares y CTA que llevan a registro, proceso y ayuda; header/footer con navegación real y salto al contenido. Capacidades descritas desde los contratos y servicios existentes: captura, moderación, galería, organización, métricas y API/webhooks. Se retiran las promesas de widget, conversión causal, integraciones instantáneas, selector multiempresa y condiciones no acreditadas. Precios, testimonios comerciales y CTA original con condiciones se conservan en componentes `landing/drafts/` sin importar ni montar en rutas públicas; no tienen URL. Sin enlaces vacíos legales/contacto/redes/blog. La portada usa contenido estático en vez de autoplay y mantiene las capacidades visibles en móvil.

`/docs` pasa a ser ayuda pública de cinco tareas con anchors, límites de medios, recepción parcial, estados, publicación, métricas, API keys y webhooks. Las otras once entradas preparatorias son aliases a pantallas vigentes; UUID validado y normalizado para detalle/edición contextual. El alias de edición abre revisión y conserva la acción Editar sólo cuando rol/propiedad/estado la habilitan. Configuración incorpora accesos reales de integración; sus secciones conocidas reciben scroll y foco después de la lectura inicial, sin saltos adicionales al refrescar. El bloque nuevo de integraciones precede a los parámetros para no desplazarse con su carga independiente. Contratos y decisiones en [landing/ayuda/rutas](../modules/web-landing-help-routes.md) y [configuración](../modules/web-settings.md).

| Verificación                                                               | Resultado                                                                                                  | Alcance/límites                                                                                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Web completa `npm test --workspace @testimonial-cms/web -- --maxWorkers=2` | **363/363**, 57 archivos, sin omisiones                                                                    | Destinos, aliases/UUID inválidos, contenido aprobado, ayuda, hero actualizado al contenido acordado, foco tardío de anchor sin salto al refrescar y regresión completa.                                                                                                                                                                                                                                                    |
| Selección tras correcciones: landing/help/legacy-routes/settings           | **39/39**, seis archivos                                                                                   | Mock de sesión/transporte donde corresponde; las pruebas de aliases simulan `redirect`/`notFound`. No son integración API.                                                                                                                                                                                                                                                                                                 |
| Tipos/lint/formato/diff                                                    | Tipos sin errores; lint sin errores y **8 advertencias preexistentes restantes**; formato y diff conformes | Se retira el img del header, eliminando una advertencia anterior. Sin suppressions/config nueva.                                                                                                                                                                                                                                                                                                                           |
| Red observado antes de producción                                          | **16 fallos funcionales**                                                                                  | Dos de CTA/contenido comercial y catorce de aliases/UUID/ausencia. La evidencia fue observada antes del corte de contexto; no se presenta un log temporal perdido como archivo persistente. El caso nuevo de foco también reproduce el fallo funcional en navegador antes de corregirlo.                                                                                                                                   |
| Navegador: landing y ayuda                                                 | **20 combinaciones conformes**                                                                             | 320/375/768/1440 px × claro/oscuro, más reflow de 720 CSS px/DPR2 × ambos temas; dos superficies. Documento y body iguales al viewport, un main/h1 por superficie, sin overflow de elementos medidos, anchors internos ausentes, links vacíos ni animaciones activas con movimiento reducido. Medición de textos incluidos con mínimo global 5,1356:1. Capturas emuladas Chromium; no hardware ni auditoría WCAG completa. |
| Navegación funcional sintética                                             | Destinos y controles verificados                                                                           | Once aliases al destino exacto, UUID inválido, salto de teclado al main, anchors, registro, acceso sin sesión, capacidades/integraciones con foco tras cargar, editor propio editable, publicado sin edición y recurso denegado sin detalle privado. Sesión, recursos y errores son fixtures HTTP; no acreditan backend real.                                                                                              |
| Detector Impeccable                                                        | Sin hallazgos en pantallas/componentes activos modificados                                                 | Borradores comerciales intencionalmente no montados fuera de este target. No acredita aceptación funcional o accesibilidad completa.                                                                                                                                                                                                                                                                                       |
| Seis E2E reales                                                            | **Bloqueados antes de servicios**                                                                          | Harness `ed621d8cd355`: `Create owned network failed (1)`. No hubo servicios/migraciones/ejecución. Se mantienen seis recorridos y gates; SESSION amplía `/login` y PUBLISH comprueba el alias `/edit` publicado sin edición.                                                                                                                                                                                              |

**Ronda visual acotada:** inspección agrupada de tamaños/temas, un lote de correcciones y una única confirmación visual completa. El lote corrigió el anchor que llegaba antes del contenido de Configuración y la transición de colores de los CTA, que producía muestras de contraste insuficientes durante el cambio de tema. La confirmación no generó nuevos cambios de UI. Hubo ajustes del guion, no del producto, para reconocer los redirects emitidos por streaming de Next, excluir marcadores React Flight como `$29` al comprobar precios visibles y usar la copia real «No encontramos…» al verificar una denegación. Esa última expectativa causó exit 1 del guion combinado aunque las 20 mediciones visuales conformaran; se clasificó como expectativa incorrecta, se validaron las mediciones guardadas y se repitió únicamente la denegación funcional con su mensaje real, aprobada sin nuevas capturas/inspecciones visuales. No se ocultó ni desactivó un test del proyecto. Agent-browser no está instalado; se usó Playwright/Chromium disponible, sin nuevas dependencias. Capturas y evidencia temporal sólo con datos sintéticos.

**HTTP observado:** los once aliases devolvieron HTML inicial 200 y metadata de refresh al destino exacto por el streaming de App Router. No se afirma un 307 previo al envío ni redirección permanente. Se verificó navegación final y preservación de las pantallas de acceso/permiso. No se introdujo canonical, sitemap, host o política SEO nueva.

**Cierre/límites:** implementación y validación local completas; E2E reales y CI del SHA a registrar pendientes. Sin cambios de API, esquema, migraciones, infraestructura, hooks Git, manifiestos o dependencias; sin despliegue. Fase 11 conserva `[Actual]` hasta commit humano y ACK. Commit sugerido: `feat(web): conectá la landing y reemplazá rutas preparatorias`. Detenerse; el próximo ACK habilita sólo fase 12.

### Fase 12 — Rendimiento y validación integral (2026-10-18)

**Autorización/base:** commit humano de fase 11 `fa7838b` verificado, árbol inicialmente limpio y ACK «Continuar». Sólo fase 12. [Informe final local y límites por escenario](../technical/2026-10-18_frontend_validacion_integral.md).

**Implementación:** se retiran las segundas instancias de NoiseOverlay de captura (todos sus estados) y galería, y el mock unitario obsoleto. El layout raíz conserva la textura editorial. Baseline DOM: dos capas en cada página pública afectada y una en portada. El JS propio baja de 7,59 a 7,29 kB en captura y de 8,51 a 8,22 kB en galería; First Load JS redondeado queda igual. No se inventa una mejora de latencia a partir de muestras individuales ni se introducen memoización/refactors especulativos.

**Verificaciones:** build de producción anterior y final aprobados, sin fuentes simuladas; 27/27 páginas generadas. API build y tipos de ambos workspaces aprobados. Web 363/363, 57 archivos y gate completo aprobado. API 358 aprobadas/174 omitidas: gate completo rechazado como corresponde. Lint completo sin errores y ocho warnings web preexistentes. Controles nativos 102/102 y release 63/63 tras habilitar procesos/sockets locales; no se tocaron assertions ni gates. Detector Impeccable final sobre `apps/web/src`: exit 0, `[]`. La crítica histórica se conserva; no se cierra automáticamente un target de directorio ni se comparan escalas diferentes.

**Navegador:** una ronda inicial agrupada de 140 casos y una confirmación de 140/140 sobre producción, con fixtures sintéticas explícitas. Una capa, un main, sin desbordes ni fallas de contraste medido/nombres de controles/runtime en la confirmación. La matriz incluye las 22 superficies actuales, las siete vistas BI, admin/editor/anónimo, claro/oscuro, desktop/móvil y estados vacío/error en tablet. Los once aliases, menú con teclado, fallback de YouTube, draft BI, storage denegado y polling en reposo tienen comprobación funcional adicional. El informe contiene distribución exacta, observaciones y exclusiones de la medición; no equivale a servicios reales, WCAG certificada, gestos físicos ni aceptación en otros motores.

**Pendientes de aceptación integral:** daemon Docker ausente; harness `dcf3b3b40f10` falla al crear la red propia antes de servicios/migraciones. Se mantienen seis E2E descubiertos, sin ejecución real aceptada. Las 174 integraciones omitidas requieren PG/Redis/warehouse reales y aislados. GitHub no conoce todavía el SHA local completo `fa7838b5feab8d699087a9eb10576f910ef115e3`; checks del próximo commit pendientes. CI debe ejecutar su cobertura y gates completos sobre ese SHA. El ACK del harness se conserva; no autoriza desarrollo/remoto ni excepciones a los gates.

**Cierre humano:** implementación preparada para commit; fase 12 sigue `[Actual]`, pendiente de aceptación integral, commit humano y ACK final. Sin commit automático, push, PR, merge ni despliegue. Sin cambios de esquema, migraciones, infraestructura, hooks o manifiestos. Commit sugerido: `perf(web): optimizá y validá la experiencia integral`. Detenerse y esperar ACK; no marcar el plan completado mientras queden verificaciones obligatorias sin aceptación.
