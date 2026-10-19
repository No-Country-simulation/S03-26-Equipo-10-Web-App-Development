# Usuarios — contrato administrativo activo

**Actualización:** 2026-10-18. `apps/api/src/modules/users/`. Autenticación propia con JWT/cookies y RBAC; no se incorpora un proveedor de autenticación.

## Endpoints y permisos

Todos los endpoints de `/api/v1/users` requieren sesión activa y rol admin. La identidad verificada aporta el tenant. Lecturas, actualización y borrado filtran por tenant; una cuenta ajena se trata como inexistente. La unicidad de email es global según el esquema vigente; no se cambia ese contrato.

| Método/ruta         | Comportamiento                                                                                                                                                                                                                                                        |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GET `/users`        | Listado paginado, default 20, `data[]` más `meta` en HTTP; orden creado descendente, ID descendente.                                                                                                                                                                  |
| GET `/users/:id`    | Cuenta del tenant o 404.                                                                                                                                                                                                                                              |
| POST `/users`       | Email, contraseña según `PasswordSchema` y rol admin/editor. Crea acceso activo inmediatamente; no envía invitación. Sólo devuelve datos de presentación, sin hash o contraseña.                                                                                      |
| PATCH `/users/:id`  | `isActive` booleano y cambio de contraseña existentes. El DTO también acepta `role`, pero el servicio no lo implementa: no anunciar edición de rol. El frontend de fase 4 usa exclusivamente `isActive`.                                                              |
| DELETE `/users/:id` | Devuelve ID y `deleted: true` sólo tras borrar una fila propia. Conserva la transacción de desvinculación de autoría/propiedad; si una FK de historial impide borrar, revierte y devuelve 409 `USER_HAS_HISTORY`. No se elimina historial para eludir la restricción. |

La normalización del conflicto admite `P2003` y el caso observado en PostgreSQL 18 con Prisma 6.5: `PrismaClientUnknownRequestError` cuyo error de conector identifica `PostgresError` con SQLSTATE `23001` (RESTRICT). La clasificación se realiza al salir de la transacción fallida, sin borrar sesiones ni historial. Otros códigos y errores no clasificados conservan su error original; no se convierten todos los errores Prisma en conflictos de historial.

La protección de la cuenta propia implementada en fase 4 es de presentación y handlers de UI. No se altera la autorización global de endpoints ni se introduce gestión del último administrador.

## Acceso de cuentas desactivadas

`AuthService` rechaza login y refresh para cuentas/tenants inactivos. Cada request JWT consulta `CredentialRepository.findActiveUser`; no basta un JWT aún vigente si la cuenta está desactivada. Reactivar permite credenciales aún válidas, sin cambiar roles. No es una operación de revocación definitiva de familias, expiraciones o contraseñas.

## Verificación

`user-access-http.spec.ts` conserva reales controller, servicio, repositorios, JWT, guards y validación; Prisma es un sustituto en memoria. Comprueba token previo rechazado tras desactivar, recuperación tras activar, rol editor, otro tenant y booleanos inválidos, sin ampliar permisos.

`catalog-admin.integration.spec.ts` verifica en PostgreSQL el cambio de acceso, aislamiento y rollback al bloquear eliminación por historial. Requiere base descartable verificada; localmente no se ejecutó por falta de daemon Docker. El plan distingue esta omisión de las pruebas HTTP con persistencia simulada. Se conservan y amplían las assertions del recorrido E2E-RBAC sin aumentar los seis recorridos obligatorios ni desactivar gates.

La PR #11, run `39190959933` vinculado al head `b174eaf`, ejecutó 532 pruebas API con servicios reales: 531 aprobaron y falló únicamente la traducción del error RESTRICT en `catalog-admin.integration.spec.ts`. Se conserva íntegra esa prueba, que comprueba el usuario, la autoría y la sesión después del rollback. `user-history.spec.ts` incorpora la forma de error observada y negativos para otros fallos; esa regresión pasó de 1 fallo/5 aprobadas a 6/6 después de corregir producción. No se modifican constraints, esquema ni migraciones. La integración PostgreSQL y CI deben repetirse sobre el commit de corrección; el éxito unitario no sustituye ese resultado.
