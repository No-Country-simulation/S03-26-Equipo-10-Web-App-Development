# Despliegue de API keys versionadas

## Preparación

1. Generar un pepper aleatorio de al menos 32 bytes fuera del repositorio y guardarlo en el gestor de secretos. Configurar `API_KEY_PEPPERS_JSON` como un objeto JSON cuyas claves sean versiones positivas y cuyos valores sean bytes codificados en base64url. Configurar `API_KEY_PEPPER_CURRENT_VERSION` con una versión presente en ese objeto. Conservar peppers anteriores mientras haya credenciales emitidas con ellos.
2. Registrar `API_KEY_LEGACY_STARTED_AT` en UTC (`YYYY-MM-DDTHH:mm:ssZ`) con el instante del **primer despliegue compatible**. No reiniciar ese reloj en despliegues posteriores. En producción, sin fecha, `tms_` falla cerrado. En Compose de desarrollo, si falta el pepper, se pueden leer claves legadas, pero crear o verificar claves nuevas requiere configurarlo.
3. Revisar acceso al secreto en Terraform/ECS y proteger el estado remoto de Terraform, que puede contener valores sensibles. Ejecutar la migración `20261002000000_api_key_expand` solo mediante el procedimiento de cambios de base autorizado. Mantener `key_hash`, `is_active` y el lector dual durante toda la convivencia.
4. Desplegar primero la API compatible con ambos formatos; después la web que permite seleccionar scopes, vencimiento y rotación. Un rollback tras emitir claves `ak_` debe volver a una versión que siga leyendo ambos formatos; el binario previo a esta fase no sirve como rollback completo.

## Contrato y operación

- Los administradores crean o rotan claves desde el panel. El valor completo aparece solo en esa respuesta y debe copiarse entonces. La API de listado entrega public ID, propietario, scopes, estado, vencimiento, última utilización y aviso de legado; el panel muestra los datos operativos de la clave.
- Los consumidores envían `Authorization: Bearer ak_...`. Deben guardar el secreto fuera de logs y URL. `403` indica falta de scope; `401` indica credencial inválida, vencida o revocada. El tenant se deriva de la clave.
- En una rotación, actualizar primero los consumidores a la nueva clave y después de 24 horas comprobar que la antigua ya no se usa. Una revocación administrativa corta ambas inmediatamente.
- Vigilar `API_KEY_LEGACY_USED` y avisar a los tenants que aún usan `tms_`. A los 30 días, comprobar ausencia de uso antes de retirar el lector y las columnas legadas en una migración de contracción posterior.

## Verificación y límites actuales

La expansión se probó en PostgreSQL 18 descartable, tanto desde cero como sobre dos claves legadas sintéticas con estados activo y revocado. Las pruebas de guard, repositorio y HTTP cubren scopes, tenant, expiración, rotación concurrente, revelado único, ventana legada y revocación. Redis 7 descartable cubrió la suite de integración. Quedan para la fase de despliegue la prueba gradual en staging, las métricas de uso real y el retiro tras 30 días; no se aplicó la migración a bases persistentes.
