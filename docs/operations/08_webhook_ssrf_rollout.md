# Cierre SSRF de webhooks salientes — Fase 2

**Estado:** controles de aplicación implementados y probados localmente. El control de egreso de red del futuro alojamiento no está definido ni desplegado.

## Controles activos en la aplicación

- Altas y cambios de destino exigen HTTPS y resuelven todas las direcciones A/AAAA. Una dirección privada, reservada o no global rechaza la operación.
- Cada socket de entrega vuelve a resolver y validar todas las direcciones, y fija una sola IP aprobada para la conexión. El nombre original se conserva para Host y TLS.
- El cliente no sigue redirecciones ni utiliza proxies HTTP implícitos. Una respuesta 3xx se registra como fallo.

Estos controles se validaron con pruebas de DNS mixto, rebinding, IPv6, IP literal, redirecciones y proxies desactivados. El alojamiento elegido para la demostración deberá añadir y probar su propia política de egreso; no se presupone una ACL de red activa.

## Ventana de HTTP legado

WEBHOOK_LEGACY_HTTP_STARTED_AT debe registrar en UTC el instante del primer despliegue compatible, con el mismo valor en todas las réplicas. Se inyecta mediante las variables de entorno del despliegue. Si falta, los destinos HTTP existentes fallan cerrados. No usar la fecha del commit ni reiniciar el plazo en cada despliegue.

Durante 30 días solo pueden enviarse destinos HTTP creados antes del corte. Cada conexión mantiene la validación de IP y el rechazo de redirecciones. Cambiar una URL exige HTTPS. El panel muestra el plazo, y los envíos legados generan un log estructurado sin secreto ni payload.

## Verificación del futuro entorno

1. Comprobar salud de web y API, acceso a PostgreSQL y Redis, DNS y salida HTTPS a Cloudinary, YouTube y un receptor público de prueba.
2. Intentar destinos privados, loopback, link-local y metadata desde el dispatcher en un entorno controlado; confirmar rechazo por la aplicación y por la política de red que se configure.
3. Observar intentos y entregas antes de promover el despliegue. Registrar los resultados de la política de egreso y el procedimiento de rollback del alojamiento elegido.

No hay prueba de conectividad ni control de egreso desplegado en staging o producción.
