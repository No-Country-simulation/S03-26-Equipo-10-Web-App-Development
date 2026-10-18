# Catálogos y usuarios — frontend administrativo

**Actualización:** 2026-10-17. Fase 4 del [plan integral](../plan/2026-10-14_feat-mejoras-integrales-frontend.md).

## Catálogos

`/admin/categories` y `/admin/tags` componen `CatalogScreen` con configuración por recurso. Conserva la identidad editorial y usa una lista operativa con acciones visibles tanto con mouse como en dispositivos táctiles. El nombre y las acciones ocupan filas separadas en móvil; el campo de edición conserva ancho útil.

- Búsqueda por nombre en la API, confirmada con Buscar/Enter, paginación de 20 y limpieza de consulta. No se filtra únicamente la página cargada. El estado de búsqueda/página de estas dos pantallas vive en memoria; no se incorpora un nuevo contrato de URL.
- Cada fila presenta `testimonialCount` de asociaciones en todo el tenant, para todos los estados. Si un servidor anterior omite el conteo, se indica que no está disponible; no se inventa cero.
- Crear/renombrar se realiza inline con un nombre de 2–80 caracteres, recortado al enviar. PATCH conserva la identidad y las asociaciones. Un fallo conserva el texto y ofrece recuperación; un duplicado recibe un conflicto comprensible.
- Cambiar o cerrar una edición con texto pendiente pide descartarlo explícitamente. Se bloquean envíos repetidos y operaciones simultáneas. Los resultados confirmados se anuncian y no desaparecen al refrescar.
- Eliminar identifica el recurso, muestra la cantidad conocida y explica que los testimonios se conservan: categoría a null o desvinculación de esa etiqueta. Cancelar no envía DELETE. La API debe confirmar el mismo ID y `deleted: true`.
- Crear vuelve a página 1 conservando la consulta; el mensaje identifica el nombre confirmado aunque el filtro no lo incluya. Después de borrar o renombrar, una página que dejó de existir se corrige según el total filtrado.

## Usuarios

`/admin/users` sólo carga datos y presenta controles para administradores. Un editor recibe acceso denegado sin consultar el listado administrativo.

La creación es directa y no envía invitaciones por email. Campos inicialmente vacíos; contraseña en memoria, con tipo password, autocomplete de contraseña nueva y requisitos anteriores al envío: 8–72 caracteres, al menos A–Z, a–z, número y símbolo. Se replica el patrón vigente del backend sin cambiar su política. Un error conserva los campos; cerrar con datos pendientes requiere decisión y un éxito limpia el formulario. No se persisten credenciales en storage, URL, documentos ni logs.

Se explica el rol elegido durante la creación y su alcance; no se ofrece edición de roles existentes, porque `UpdateUserDto.role` no está implementado por el servicio. Los permisos y feature flags siguen siendo autoridad de la API.

Activar/desactivar otra cuenta usa `PATCH /users/:id` con sólo `{ isActive }`. La respuesta debe confirmar el ID y el estado solicitado. La confirmación identifica email y consecuencias. Mientras esté desactivada, la cuenta no puede iniciar sesión, refrescar ni usar sus credenciales de acceso vigentes; reactivarla permite sesiones todavía válidas. No se promete revocación permanente de sesiones ni se cambia la política de autenticación.

La cuenta propia no ofrece desactivación ni eliminación y los handlers vuelven a comprobarlo. Esta restricción corresponde a estos controles: no se añade una prohibición global nueva a los endpoints existentes. La API mantiene roles y aislamiento por tenant.

Eliminar conserva la confirmación e informa sobre la alternativa de desactivar. Si hay historial protegido por las relaciones actuales, `USER_HAS_HISTORY` conserva la cuenta y explica la recuperación; no se purgan sesiones o auditoría para forzar el borrado. La tabla es una región de scroll con nombre, foco y caption; en móvil indica cómo acceder a las acciones. Crear vuelve a página 1; borrar corrige la última página inválida.

## Evidencia y límites

Vitest/Testing Library cubre contratos de adaptadores, confirmación/cancelación, búsqueda global, renombrado, borradores, páginas tras crear/borrar, cuentas propias, roles y activación. Chrome revisa escritorio/móvil, claro/oscuro, datos largos y storage bloqueado con HTTP sintético. No acredita integración backend.

Las pruebas HTTP usan Nest, JWT, guards, servicios y repositorios reales con Prisma simulado. Las pruebas PostgreSQL de asociaciones, aislamiento, activación e historial están escritas para servicios descartables/CI. Docker no dispone de daemon: el harness autorizado no llegó a ejecutar migraciones ni E2E reales. Resultados y comandos finales en el plan.
