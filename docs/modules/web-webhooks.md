# Webhooks en el panel

**Actualizado:** 2026-10-18. **Alcance:** fase 6 del [plan de frontend](../plan/2026-10-14_feat-mejoras-integrales-frontend.md). Ruta activa `/admin/webhooks`, sólo administración. Se consumen los endpoints existentes, sin modificar esquemas, entrega durable, firma ni políticas del backend.

## Configuración y estados

La guía opcional presenta el recorrido real: preparar receptor HTTPS, crear destino, guardar/configurar secreto, encolar prueba y comprobar su respuesta en el historial. Crear mantiene el comportamiento existente: el destino queda activo. No se declara que un receptor esté configurado o verificado por mostrar instrucciones ni por copiar su secreto.

Editar usa `PATCH /webhooks/:id` para URL HTTPS y evento. Las opciones disponibles son los dos eventos registrados en las migraciones actuales: testimonio creado y publicado. Un código distinto ya registrado se conserva como opción actual; no se inventa un catálogo nuevo ni se ofrecen eventos no implementados. El formulario conserva URL/evento ante errores y exige descartar cambios antes de cerrar o cambiar de formulario.

Pausar/reactivar requiere confirmación con URL y evento. Pausar frena eventos nuevos; las entregas ya encoladas pueden continuar. Una reactivación de un destino legado bloqueado exige reparar HTTPS y/o firma antes de habilitar el control. La API sigue validando ambas condiciones y puede rechazar un cambio concurrente. La defensa SSRF valida DNS y redes privadas en el servidor; la comprobación HTTPS del navegador no la sustituye.

El DELETE **archiva** el destino. La confirmación explica que conserva destino, entregas e intentos y que no habilita edición/reactivación posterior. Los archivados siguen en el listado con acceso a Historial. Archivar tampoco deshace efectos ni cancela necesariamente entregas ya encoladas. La UI no altera las posibilidades de reenvío que ofrece el backend para una entrega terminal.

## Operaciones y revelación

Un candado síncrono por destino bloquea sus mutaciones simultáneas; otro destino puede seguir operando. Cada resultado/estado pendiente identifica su URL y evento. Los avisos permanecen aunque se actualice o pagine el listado; se pueden cerrar explícitamente. Las respuestas de operaciones anteriores no cambian el historial de otro destino seleccionado después. Los resultados de una sesión/tenant obsoletos se descartan.

Como hay un solo espacio de revelación, sólo se genera un secreto por vez en toda la pantalla. Abrir otro formulario no elimina el secreto vigente; una generación posterior solicita confirmación y sólo lo reemplaza al tener una respuesta válida. Un error conserva la revelación anterior. URL, evento y gracia pertenecen al destino identificado, sin incluir el secreto en anuncios o avisos. La metadata se valida separadamente para no propagar el secreto al contexto del historial.

La clave completa se muestra únicamente en memoria React en un campo seleccionable de sólo lectura. Copiar tiene resultado anunciado; si el portapapeles falla o no existe, se enfoca y selecciona el campo para copia manual. Ocultar solicita confirmación y no revoca el secreto. No se guarda en storage, URL, historial del navegador, logs ni documentos. Esta fase no incorpora recuperación después de abandonar la página o cerrar el proceso.

La gracia usa `signatureGraceUntil` devuelto por la API. Mientras esté vigente se deshabilita otra rotación y se indica actualizar al finalizar. No se simula una cuenta regresiva ni se asegura entrega durante toda esa ventana: también importan las restricciones del destino. Un 409 puede indicar gracia vigente o un cambio concurrente; la confirmación conserva su contexto e indica actualizar antes de repetir. Los controles de concurrencia y cifrado existentes permanecen vigentes.

## Historial e intentos

Historial se conserva fuera del contenedor horizontal de la tabla. Su encabezado identifica el destino y evento **actuales**; explica que entregas anteriores conservan su URL original y que su evento pudo ser diferente. Cada entrega muestra sus IDs, fecha local con zona, contador de intentos, estado traducido y última respuesta HTTP. La API no entrega la URL histórica en esta vista; la interfaz no la inventa.

Actualizar o reintentar una carga conserva destino y página. Elegir un destino diferente comienza en la primera página. Se ignoran respuestas de consultas obsoletas; cerrar un historial tampoco permite que una mutación tardía vuelva a abrirlo. Un reenvío sólo refresca el historial si ese destino sigue seleccionado. Los dos listados corrigen páginas fuera del total disponible.

Los estados de entrega son Pendiente, En proceso, Entregada y Sin entrega. Entregada significa respuesta HTTP 2xx, no prueba del procesamiento interno del receptor. Una prueba devuelve **encolada**, con ID de evento, y un reenvío devuelve **pendiente**, con ID de entrega: ninguno se anuncia como recepción confirmada. Reenviar una entrega terminal abre otro ciclo y conserva los intentos, por lo que el texto recuerda corregir el receptor y considerar efectos previos.

La expansión nativa de intentos funciona con teclado y muestra hasta los 20 más recientes que devuelve el backend: inicio/fin, HTTP, error redactado y estado En proceso/Correcto/Fallido/Interrumpido. El contador incluye todos los ciclos y puede ser mayor que ese detalle. Un estado desconocido no se convierte en éxito; un detalle ausente se declara ausente.

## Validación y límites

Pruebas de pantalla y adaptadores junto a la feature cubren bloqueo, contexto, página, resultados tardíos, PATCH, gracia, reactivación, errores y copia. Se añadieron pruebas del servicio para reactivación con firma/HTTPS y aislamiento de tenant; usan persistencia simulada. La integración PostgreSQL preparada comprueba edición, evento, pausa y archivo mediante el servicio real y Prisma, conservando las pruebas de congelamiento de URL y ledger existentes.

Los seis E2E se conservan; E2E-RBAC añade denegación al editor en GET/PATCH y acceso directo a esta pantalla. El harness local autorizado sigue sin poder crear su red Docker: integración PostgreSQL/Redis y E2E reales están **pendientes**, sin servicios ni migraciones ejecutados. Chrome con HTTP simulado es evidencia de UI, no de un receptor externo, integración real o CI del futuro commit. Capturas sólo de estados sin revelación, con datos sintéticos.
