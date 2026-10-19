# Configuración y primera puesta en marcha

La fase 7 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md) conserva la identidad editorial del panel y permite administrar el espacio actual desde `/admin/settings`. No incorpora membresías multiempresa ni modifica autenticación, criptografía o esquema.

## Tareas independientes

El nombre, logo, identificador público y recepción tienen guardado, error y confirmación propios. Un error al consultar parámetros no impide editar la marca; un error en los datos del espacio tampoco impide cargar parámetros. El refresco conserva montados los editores, su feedback y sus borradores. Un campo limpio refleja cambios confirmados; un borrador se conserva hasta guardar o descartar explícitamente.

Las mutaciones bloquean dobles envíos por tarea con un candado síncrono. Cada respuesta actualiza sólo los campos que esa operación escribió: un nombre que llega tarde no revierte una recepción confirmada en paralelo. Una lectura iniciada antes de un guardado no reemplaza sus datos. El refresco del espacio se deshabilita mientras hay escrituras pendientes. No se reintentan mutaciones automáticamente ante resultados inciertos.

El nombre confirmado se comparte en memoria con el shell y el inicio. La identidad se obtiene originalmente de la sesión autenticada y se reinicia al cambiar el espacio. No se guarda información de onboarding en storage ni se inventa un selector de organizaciones.

## Logo y recepción

PNG, JPEG o WebP hasta 2 MiB. La selección se conserva en memoria ante error del proveedor, con opción de reintentar o descartar. Una previsualización pendiente impide eliminar el logo actual hasta descartarla. El borrado requiere confirmación y ofrece Cancelar; las iniciales reemplazan la imagen y no se eliminan testimonios ni enlaces. Tras guardar se anuncia el resultado y el foco permanece recuperable; refrescar no elimina ese mensaje. Se conservan las garantías CAS y limpieza durable del backend.

El enlace mostrado corresponde al slug **guardado**, aunque haya otro valor pendiente en el campo. Cambiarlo reemplaza las URLs previas. El contrato actual no admite quitar el slug. Copiar tiene recuperación manual si clipboard falla. Abrir o cerrar recepción cambia únicamente la aceptación de nuevos envíos anónimos: la marca, testimonios y galería se conservan. Cerrar requiere confirmación. Configurar un enlace y abrir la recepción son condiciones distintas.

## Capacidades y parámetros

| Parámetro          | Efecto vigente                                                                                                                                                                                                                                                               |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testimonials`     | Controla operaciones autenticadas de testimonios y lectura mediante API key. No cierra captura anónima por slug ni oculta la galería. Desactivar requiere confirmación y puede impedir revisar/publicar desde el panel.                                                      |
| `enable_scoring`   | Habilita recálculo sobre publicados al iniciar el proceso y cada hora. Fórmula: `rating × 10 + views × 0.1 + clicks × 0.5 − daysSincePublished × 0.05`, mínimo cero, redondeo a cuatro decimales. Desactivar conserva puntajes previos. No hay IA ni publicación automática. |
| `enable_analytics` | Valor técnico persistido sin enforcement actual de acceso o tracking. Editable por decisión humana, sin prometer ese efecto.                                                                                                                                                 |
| `enable_webhooks`  | Valor técnico persistido sin enforcement actual de acceso o entrega. Para pausar entregas se desactiva cada destino en Webhooks. Editable por decisión humana.                                                                                                               |
| Otros registrados  | Se muestra el nombre real y su valor técnico; no se atribuyen efectos no documentados.                                                                                                                                                                                       |

Los valores cambian sólo después de una respuesta validada. Un fallo conserva el estado anterior y presenta recuperación local. Cambiar un parámetro no bloquea los demás.

## Recorrido opcional

Inicio ofrece identidad → captura → revisión → publicación. Se puede plegar sin impedir tareas. El nombre y enlace provienen de `/tenants/me`; pendientes, borradores, aprobados y publicados del resumen global. No se da por compartido un enlace por copiarlo, ni por publicado un aprobado. El logo es opcional. Un fallo local del recorrido no reemplaza el resumen ni las acciones operativas. Los editores no consultan recursos administrativos para este recorrido.

## Contratos vigentes consumidos

| Método/ruta                                       | Acceso y respuesta                                                                                                                                                                                    |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /tenants/me`                                 | Sesión autenticada; TenantView del tenant de la sesión.                                                                                                                                               |
| `PATCH /tenants/me`                               | Administrador + CSRF para cookies. Parcial: `name` (3–120), `publicSlug` (3–50, minúsculas/números/guiones), `isPublicFormEnabled` booleano. Devuelve TenantView completo; nombre/slug ocupado → 409. |
| `PUT /tenants/me/logo`, `DELETE /tenants/me/logo` | Administrador + CSRF; TenantView completo. Ver [logo](api-tenant-logo.md).                                                                                                                            |
| `GET /feature-flags`                              | Administrador; `data[]` con `id`, `name`, `description`, `enabled` y `meta`.                                                                                                                          |
| `PATCH /feature-flags/:name`                      | Administrador + CSRF; `{enabled:boolean}`. Respuesta distinta del listado: `{flagName, enabled, tenantId, updatedAt}`.                                                                                |

El adaptador valida forma y confirmación del campo pedido; las mutaciones de nombre/enlace/recepción y flags verifican también tenant esperado. El logo verifica pertenencia antes de actualizar su presentación. Nunca se envía tenantId como parte del body de escritura: la autoridad procede de la sesión. Los DTOs de nombre/flags vigentes descartan campos adicionales, incluido un tenantId enviado por otro cliente; esto no permite modificar un tenant ajeno. No se convierte esta característica en un nuevo rechazo HTTP ni se modifica el contrato backend.

## Validación y límites

Pruebas de UI/adaptadores cubren fallas independientes, borradores, lecturas tardías, guardados concurrentes, confirmaciones y foco; contratos HTTP ejecutan controladores, guards, CSRF y servicios reales con repositorios simulados. Esa evidencia no valida PostgreSQL, Redis, cookies reales del navegador ni Cloudinary. La aceptación con servicios reales y los seis E2E permanece separada en el registro del plan. No se despliega desde esta fase.

## Entradas de navegación — fase 11

Las rutas preparatorias de capacidades e integraciones apuntan a `#capabilities` y `#integrations` en esta pantalla. Tras terminar la lectura inicial del espacio, el destino conocido recibe scroll y foco; el guard de anchor evita repetir el salto al refrescar o guardar. Nombre y captura admiten la misma entrada por `#brand`/`#capture`. La sección estática de integraciones precede a los parámetros, para que la carga independiente de esos parámetros no desplace su destino. Los accesos llevan a API keys, webhooks y ayuda, sin configurar servicios externos automáticamente. Se mantienen los permisos de administrador de la pantalla y los endpoints.
