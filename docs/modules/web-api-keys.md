# API keys en el panel

**Actualizado:** 2026-10-18. **Alcance:** fase 5 del [plan de frontend](../plan/2026-10-14_feat-mejoras-integrales-frontend.md). Ruta activa `/admin/api-keys`, sólo administración. La autorización del backend sigue siendo la autoridad.

## Crear, rotar y revocar

El formulario pide nombre de integración, permisos y vencimiento opcional en la zona local del navegador. Los permisos se muestran como Leer testimonios publicados y Registrar vistas y clics; conservan los scopes existentes de la API.

La rotación muestra una fecha local, sin recortar una cadena UTC como si fuera hora de pared. Si esa fecha no cambia, el cliente **omite** `expiresAt`: el servicio conserva el instante original, incluidos segundos y milisegundos. Si se edita, se valida y convierte a UTC una vez. El contrato actual no admite quitar un vencimiento mediante rotación; el formulario explica esa restricción y exige conservar o cambiar una fecha ya configurada. No se añadió una nueva política de expiración.

El estado proviene del campo `status` del listado: Activa, Vencida o Revocada. Se ofrece rotación para Activa, creación de una clave independiente como reemplazo de Vencida y revocación para las claves aún no revocadas. Los registros históricos se conservan. Al crear, la lista vuelve a la primera página.

`legacy` indica que aún existe un hash legado; no acredita que la credencial actual siga siendo legada. Después de migrar, el listado puede conservar `legacy=true` y un `publicId` nuevo. En ese caso no se vuelve a pedir migración ni se añaden permisos al formulario. Sólo una clave legada sin scopes recibe la selección histórica de ambos permisos, coherente con el servicio.

La confirmación de revocación identifica la integración y explica que corta todas sus credenciales y cualquier gracia. Los adaptadores rechazan una rotación con ID ajeno y una revocación sin el mismo ID y `revoked=true`. No se presentan respuestas incompletas como éxitos.

## Revelación y salida

El secreto se conserva exclusivamente en estado React, identificado por el nombre devuelto al generar. El anuncio de resultado no incluye su contenido. Se muestra completo en un campo de sólo lectura, seleccionable; si falla el portapapeles, el foco y la selección permiten copiar manualmente. Copiar no oculta ni acredita que se haya guardado en un lugar seguro.

Abrir otro formulario, actualizar o cambiar de página del listado no destruye una revelación. Antes de generar otra clave se pide confirmación para reemplazarla **sólo si la operación termina correctamente**. Un error conserva el secreto anterior y el formulario. Ocultar requiere una confirmación independiente; Escape cancela esa confirmación. Cerrar el formulario no oculta la clave.

Mientras haya una revelación o una mutación pendiente se instala una protección de salida. Los enlaces que abandonan la página y el botón Cerrar sesión del shell piden confirmación; abrir otra pestaña no elimina el estado de la original. Una entrada de historial con la misma URL permite tratar Atrás ordinario como una salida protegida en App Router. El historial contiene únicamente un indicador booleano junto al estado existente del router, nunca el secreto. Al cancelar se conserva la pantalla; al confirmar se oculta y se navega. La salida por enlace reemplaza esa entrada auxiliar, evitando un regreso adicional por ella. Al ocultar permaneciendo en la página se retira la entrada.

Recargar/cerrar utiliza el aviso nativo `beforeunload`; su presentación depende del navegador. No se promete recuperación después de cerrar el proceso, terminar la pestaña desde el sistema, saltar varias entradas del historial o perder la sesión. No se guarda una copia de recuperación en storage, URL, logs o documentación. Las mutaciones bloquean envíos simultáneos y los controles que cambian su contexto; no se puede confirmar la salida interna hasta conocer su resultado. Una salida forzada durante una petición deja un resultado incierto: comprobar el listado antes de repetir y rotar si se perdió la revelación.

La gracia de la credencial anterior es **hasta** 24 horas: puede terminar antes por el vencimiento anterior, el vencimiento lógico actual, la ventana global legada o una revocación. No se muestra una cuenta regresiva calculada como si el servidor hubiera confirmado un corte exacto. Criptografía, concurrencia y políticas del backend permanecen vigentes.

## Verificación y límites

Las regresiones de pantalla, adaptadores y fechas están junto a la feature. Las fechas se verificaron con `TZ=UTC` y `TZ=America/Argentina/Buenos_Aires`. Chrome con HTTP simulado cubrió escritorio/320 px, claro/oscuro, storage denegado, estado, precisión, bloqueo, fallos, copia manual, cancelación, Atrás y recarga. Las capturas se toman sin una revelación presente; los valores usados en los escenarios son sintéticos y no tienen formato de credencial utilizable.

Se amplió E2E-SESSION para rotar con vencimiento preciso y comprobar el cierre deliberado, conservando los seis recorridos y las assertions de sesión previas. La integración PostgreSQL incorpora una rotación sin `expiresAt` y comprueba el instante persistido exacto. Ambos requieren servicios reales: están preparados, **pendientes de ejecución** por Docker no disponible. Los mocks y el navegador con fixtures no acreditan esa integración ni CI del futuro commit.
