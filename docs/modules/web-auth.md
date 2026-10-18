# Acceso y creación de espacios

Las rutas `/admin/login` y `/admin/register` usan las pantallas de `features/auth`. La fase 8 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md) corrige su presentación y formularios; no modifica endpoints, cookies, CSRF, recuperación de sesión, hash de contraseñas, roles ni redirecciones.

## Tareas y navegación

Cada ruta tiene un único `main`, un `h1` de tarea visible también en móvil y regreso real a `/`. El acceso permite iniciar sesión con una cuenta existente; crear un espacio genera la primera cuenta administradora e ingresa al mismo panel. Los enlaces cruzados usan voseo y describen esas acciones. Se conserva el panel editorial de escritorio, serif en títulos y sans en controles.

Los campos comienzan vacíos. No se publican credenciales ni se ofrece una demo sin un entorno configurado. No se incorpora recuperación de contraseña, invitación por email ni envío de solicitudes de acceso a otras personas.

## Validación y estados

| Flujo    | Requisitos antes de enviar                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Login    | Email válido y contraseña presente. No se aplica la política de contraseñas nuevas al acceso con una cuenta existente.          |
| Registro | Nombre del espacio de 3–120 caracteres; email válido; contraseña de 8–72 caracteres con mayúscula, minúscula, número y símbolo. |

Los requisitos de contraseña coinciden con `PasswordSchema` vigente del backend, sin cambiar su política. Se conservan `autocomplete="username"`/`current-password` en acceso, y `organization`/`email`/`new-password` en registro. No se bloquea pegar contraseñas. La API sigue validando y autorizando cada operación; la validación HTML de email puede aceptar direcciones que el DTO rechace, en cuyo caso se conserva el borrador y se informa el error.

Los formularios validan explícitamente, asocian mensajes mediante `aria-describedby`/`aria-invalid` y llevan el foco al primer campo inválido. Al enviar, un candado síncrono bloquea solicitudes duplicadas, los campos quedan de sólo lectura y un estado anunciado describe la operación. Tras éxito se mantiene el bloqueo hasta navegar: no se repite un alta mientras se abre el panel. Ante error se habilita corregir/reintentar, se conservan todos los campos en memoria y se enfoca el mensaje de formulario asociado a ellos.

| Respuesta       | Presentación                                                                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 401 en acceso   | Revisar email/contraseña o consultar a quien administra el espacio, sin distinguir públicamente cuenta desactivada de credenciales inválidas.         |
| 409 en registro | Nombre o email ocupado; revisar o ingresar con una cuenta existente. No se atribuye el conflicto a un campo específico que el contrato no identifica. |
| 400/422         | Revisar campos/requisitos; conservar contenido.                                                                                                       |
| 429             | Esperar antes de otro intento; no se inventa un tiempo de desbloqueo ni se reintenta automáticamente.                                                 |
| 403             | Solicitud no autorizada; revisar la dirección del sitio y volver a intentar.                                                                          |
| Fallo incierto  | No se promete que la operación no ocurrió. En registro se sugiere probar el acceso con los datos elegidos antes de repetir el alta.                   |

El formulario declara método POST también para evitar un fallback nativo por query string; el flujo funcional sigue requiriendo JavaScript y el adaptador existente. No se muestran detalles técnicos arbitrarios del servidor ni se registran credenciales. Los borradores desaparecen al recargar o salir de la ruta; no se persisten en storage, URL ni contexto.

## Sesión y contratos conservados

`login` y `registerAdmin` siguen solicitando `X-Auth-Mode: cookie`, usando credentials include y validando la respuesta de usuario. Tras confirmación se limpia únicamente el mecanismo legado y se navega a `/admin`. No hay tokens accesibles al formulario. Los flujos de recuperación, refresh y logout mantienen sus implementaciones y pruebas previas. Ver [API Auth](api-auth.md).

## Validación y límites

Las pruebas de componentes y pantallas cubren campos vacíos, requisitos, errores asociados, datos conservados, doble envío y navegación sólo tras éxito. El adaptador y las pruebas de sesión mantienen cobertura de transporte. La inspección del navegador con respuestas sintéticas no acredita integración con PostgreSQL/Redis ni cookies reales. Los seis E2E conservan sus gates y amplían assertions de acceso/registro; su ejecución real y CI del SHA final se registran por separado en el plan.
