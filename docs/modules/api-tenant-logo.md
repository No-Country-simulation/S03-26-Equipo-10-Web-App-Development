# Logo de empresa

**Fecha:** 2026-10-08. **Estado:** implementado y probado localmente; despliegue y configuración del proveedor pendientes.

**Plan:** [Foto de empresa y BI](../plan/2026-10-08_feat-foto-empresa-bi.md).

**Persistencia:** [migración aditiva](../../apps/api/prisma/migrations/20261008000000_tenant_logos/migration.sql), preparada y verificada en un esquema descartable. No aplicada a bases persistentes. El [borrador OLTP](../plan/2026-10-08_feat-foto-empresa-bi_oltp-borrador.sql) conserva el diseño original.

## API y autorización

| Método / ruta | Entrada | Respuesta `data` | Autorización |
| --- | --- | --- | --- |
| `GET /api/v1/tenants/me` | Sesión actual | TenantView existente más `logoUrl: string \| null` | Sesión vigente, comportamiento actual. |
| `PUT /api/v1/tenants/me/logo` | `{ imageBase64: string }` | TenantView con el logo confirmado; HTTP 200 | JWT, rol admin y CSRF de sesión. |
| `DELETE /api/v1/tenants/me/logo` | Sin cuerpo | TenantView con `logoUrl: null`; HTTP 200 | JWT, rol admin y CSRF de sesión. |
| `GET /api/v1/public/testimonials/:slug/form-info` | Slug público | `{ name, isPublicFormEnabled, logoUrl }` | Lectura pública actual. |

Conservar el envelope HTTP vigente `{ success, data }`. `logoPublicId` y los trabajos internos no forman parte de TenantView ni de las respuestas públicas. El PUT no acepta `tenantId`, URLs arbitrarias ni IDs del proveedor. El PATCH general de tenant no acepta campos de logo. El DELETE repetido devuelve el tenant con logo NULL.

Errores: entrada inválida 400, cuerpo superior a 3 MiB 413, sin sesión 401, sin rol/CSRF 403, tenant inexistente 404, conflicto concurrente 409. Fallo o falta de configuración del proveedor responde Problem Details 503 (`MEDIA_STORAGE_UNAVAILABLE`) sin cambiar el logo anterior. No publicar URLs, cuerpos del proveedor ni credenciales en logs o detalles.

## Archivo y almacenamiento

- PNG, JPEG o WebP, máximo **2 × 1024 × 1024 bytes decodificados**, no GIF/SVG. Admitir Base64 canónico con o sin prefijo data URL; cuando exista MIME declarado, debe coincidir con el formato detectado.
- Comprobar firma PNG, marcadores JPEG y contenedor RIFF/WEBP antes de llamar al proveedor; comprobar longitudes mínimas y tamaños declarados de contenedores cuando existan. El reconocimiento de firma no equivale a un decodificador completo: Cloudinary debe aceptar y procesar el archivo; una respuesta inválida no se persiste.
- Usar un parser JSON de **3 MiB sólo para PUT `/api/v1/tenants/me/logo`**, con barra final opcional. Conservar las políticas actuales de las rutas de testimonios; no elevar el límite general.
- URL devuelta HTTPS del host Cloudinary esperado y public ID coincidente con el generado por el servidor. Generar un ID único por carga dentro del namespace `tenant-logos/<tenant UUID>/<asset UUID>`; no reutilizar public IDs ni sobrescribir assets.
- Ampliar el adaptador Cloudinary con carga firmada para logos y eliminación firmada por ID. Credenciales mediante configuración externa (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`); no guardar sus valores en el repo.
- En producción, la falta de configuración devuelve 503 en operaciones de medios; eliminar el éxito ficticio del adaptador actual. BI y la API pueden arrancar sin Cloudinary; el fallo se presenta al operar medios. Un placeholder sólo se admite en modo local explícito y no debe presentarse como prueba de carga real.
- Usar plazos HTTP acotados; la subida no se reintenta automáticamente como una escritura nueva. El resultado sólo se confirma tras validar respuesta y persistir.

## Reemplazo concurrente y limpieza durable

No abrir una transacción PostgreSQL durante una llamada de red. Añadir `logo_revision: bigint` interno, inicialmente cero, como comparación optimista e incrementarlo en cada escritura de logo. No usar `updatedAt` como versión: dos escrituras pueden compartir el mismo milisegundo. La revisión no forma parte de TenantView ni de la respuesta pública; su lectura privada pertenece al repositorio de logo.

1. Validar archivo/configuración y leer el tenant. Antes de llamar a Cloudinary, generar el public ID y registrar un trabajo de limpieza `pending` para ese candidato, con vencimiento a diez minutos. Si no puede registrarse, no subir.
2. Subir con el public ID preasignado. La intención previa permite recuperar el candidato ante timeout ambiguo o crash entre la subida y el guardado.
3. En una transacción corta, bloquear el trabajo candidato y comprobar que continúa `pending`, sin lease y con vencimiento futuro. Hacer una actualización condicional del tenant por `(id, logo_revision)`; persistir URL/ID, incrementar revisión/actualizar timestamp, cancelar el trabajo candidato y activar/enlistar la limpieza del ID anterior en la misma transacción.
4. Si otra modificación ganó la carrera, devolver 409; el candidato permanece pendiente de limpieza. Si el proceso cae después de guardar, el logo nuevo y la limpieza del anterior quedan confirmados juntos.
5. DELETE usa la misma comparación optimista y guarda NULL/NULL junto con el trabajo de limpieza del asset anterior. La visibilidad del logo se elimina inmediatamente; el borrado remoto ocurre posteriormente.

El procesador de limpieza vive en el módulo tenants, con polling de 30 segundos, lotes de hasta cinco jobs y leases de 60 segundos. Reclamar con `FOR UPDATE SKIP LOCKED`, cambiar a `processing`, incrementar intentos y generar token. Nunca borrar un ID aún referenciado por el tenant: cancelar ese job. Un worker que reclamó el candidato impide su posterior adjunción mediante la comprobación del paso 3.

El endpoint debe terminar en menos de un minuto; una adjunción después del vencimiento del candidato se rechaza. La limpieza de un intento ambiguo no se ejecuta antes de su vencimiento de diez minutos. IDs retirados no pueden volver a adjuntarse porque el cliente nunca los proporciona.

Tratar «asset no encontrado» como eliminación exitosa. Reintentar errores con backoff exponencial y jitter, máximo diez intentos, intervalo máximo una hora; entonces marcar `dead` y registrar métrica/código técnico. Recuperar `processing` con lease vencido. La finalización comprueba el token para descartar resultados de workers vencidos. Guardar sólo referencias técnicas y códigos acotados, nunca el Base64 ni respuestas completas. El borrado remoto usa invalidación del proveedor cuando corresponda; no afirmar invalidación CDN instantánea.

## Interfaz y compatibilidad

Configuración incorpora previsualización, selección, reemplazo y eliminación sólo para admin; conserva el archivo/feedback ante error sin afirmar guardado. El formulario `/p/[slug]` muestra la imagen junto al nombre con tamaño reservado, `alt="Logo de <nombre>"` y respaldo de iniciales. Restablecer el estado de error de imagen al cambiar slug o URL. El fallo de la imagen no impide completar el formulario. Mantener la identidad y los tokens vigentes.

La columna nueva es opcional y la migración es aditiva. Aplicar la migración mediante el procedimiento autorizado antes de arrancar la API nueva; desplegar backend antes del frontend que consume el logo. Los esquemas Zod de `form-info` y TenantView incluyen `logoUrl`; NULL expresa ausencia de logo. No hacer backfill de imágenes de testimonios ni registrar perfiles personales.

## Validación de fase 2

Probar firma/MIME, Base64 inválido, cero bytes, 2 MiB exactos y exceso; límite de 3 MiB exclusivo de la ruta; admin/editor, CSRF y tenant obtenido de sesión. Verificar carga exitosa, reemplazo simultáneo con igual milisegundo, modificación de configuración concurrente sin pisar nombre/slug, eliminación repetida, proveedor caído, respuesta inválida, crash antes/después del commit, candidato vencido, worker vencido y job `dead`. Probar logo ausente/roto y cambio de slug en UI. La integración real no se sustituye por mocks para certificar limpieza durable.

## Operación y evidencia

- Configurar externamente `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` y `CLOUDINARY_API_SECRET` para logos. La URL/preset anteriores continúan en el flujo de imágenes de testimonios. `CLOUDINARY_LOCAL_PLACEHOLDER=true` sólo permite su placeholder local explícito; no habilita logos y se ignora en producción.
- Las operaciones de persistencia del endpoint usan transacciones de hasta 10 s, espera de conexión de hasta 5 s, `lock_timeout=2s` y `statement_timeout=5s`. La red está fuera de esas transacciones, con timeout de 5 s y sin reintento de subida.
- Observar `tms_tenant_logo_cleanup_total{result="completed|retry|dead"}` y `tms_tenant_logo_cleanup_dead`. El gauge incluye jobs agotados por vencimiento del último lease; el counter refleja finalizaciones aceptadas por el worker. No hay labels con IDs o nombres de empresas.
- Ante jobs `dead`, comprobar configuración/proveedor y el código técnico del job. Reintentar sólo referencias que ya no estén en `tenants.logo_public_id`, con una intervención operativa autorizada que restablezca `pending`, intentos cero, vencimiento actual y lease NULL. No editar referencias de tenant para rescatar una carga vencida. La cola no tiene purga automática; medir crecimiento antes de definir retención.
- La integración PostgreSQL usa `TEST_LOGO_DATABASE_URL` **sólo hacia una base descartable**. Crea un esquema aleatorio, una fixture mínima previa y ejecuta el DDL de la migración allí; elimina el esquema al terminar. No usa `migrate deploy`, `db push` ni tablas de un despliegue existente.
- Las pruebas verifican persistencia real, atomicidad, concurrencia, aislamiento, lease vencido y recuperación. El protocolo Cloudinary se prueba con respuestas simuladas; falta una prueba real con una cuenta configurada y verificar invalidación CDN. La interfaz se verifica con pruebas DOM; no se declara una revisión visual de navegador ni capacidad productiva.
