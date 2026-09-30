# Cierre SSRF de webhooks salientes — Fase 2

## Controles activos

- Altas y cambios de destino exigen HTTPS y resuelven todas las IP A/AAAA. Si una sola IP es privada, reservada o no global, se rechaza la operación.
- Cada socket de entrega vuelve a resolver todas las IP, las valida y entrega a Node una única dirección aprobada. El `Host` y la verificación TLS conservan el nombre original. No hay segunda resolución entre la aprobación y la conexión.
- El cliente de webhooks usa agentes nuevos sin `keepAlive`, `proxy: false` y `maxRedirects: 0`. Una respuesta 3xx se registra como fallo; nunca se solicita el `Location`.
- La ACL de las subredes de aplicación en Terraform deniega destinos RFC 1918, CGNAT, loopback, link-local y multicast tras permitir respuestas de ALB, PostgreSQL y DNS. Se asocia **después** de crear sus reglas. No aplicar en una base o entorno persistente como parte de esta fase; primero validar el plan y conectividad en staging.

AWS aclara que [las ACL de VPC no filtran IMDS ni Route 53 Resolver](https://docs.aws.amazon.com/vpc/latest/userguide/vpc-network-acls.html). La protección frente a esos destinos en el flujo de webhooks depende de la validación de URL, DNS y socket; la ACL añade defensa para destinos de red ordinarios. No interpretar la regla `169.254.0.0/16` como bloqueo de IMDS administrado por el hipervisor.

## Ventana de HTTP legado

`WEBHOOK_LEGACY_HTTP_STARTED_AT` registra la fecha UTC del **primer despliegue compatible** (`YYYY-MM-DDTHH:mm:ssZ`). Se configura en el `.env` de Compose o en `webhook_legacy_http_started_at` de Terraform antes del despliegue. No se rellena automáticamente: si falta, los destinos HTTP existentes no pueden enviarse. No usar la fecha del commit ni una fecha distinta por réplica.

Durante 30 días solo se permite el envío a destinos HTTP creados antes de esa fecha. Cada conexión sigue validando las IP y no sigue redirecciones. Una edición de URL debe cambiarla a HTTPS. El listado administrativo incluye fecha límite y estado del legado, la pantalla muestra un aviso al tenant y los envíos HTTP dejan un log estructurado con ID de webhook, ID de tenant y fecha límite; no registran secreto ni payload.

Al vencer la ventana, el transporte rechaza HTTP. La suspensión persistente y el aviso de destinos sin firma pertenecen a la Fase 7. El historial de entregas y la semántica robusta del outbox se completan en la Fase 3.

## Verificación antes de aplicar infraestructura

1. Ejecutar `terraform fmt -check` y `terraform validate` sobre el módulo y revisar el plan de staging. La ACL reemplaza la asociación de las subredes privadas de aplicación; confirmar que las excepciones de puertos/cidrs corresponden a las redes reales.
2. En staging, comprobar salud de web/API a través de ambos ALB, conexión API→RDS, resolución DNS, CloudWatch Logs y salida HTTPS a Cloudinary/YouTube y a un destino de webhook público. Comprobar que `10/8`, `172.16/12`, `192.168/16` y metadata no son alcanzables mediante el dispatcher.
3. Observar VPC Flow Logs y métricas de entregas antes de promover la ACL gradualmente a producción. Mantener el rollback de la asociación anterior preparado.

Las pruebas unitarias cubren DNS privado, respuesta A/AAAA mixta, rebinding al conectar, IPv6, IP literal, redirección y proxies desactivados. La aplicación real de Terraform y la prueba de conectividad de staging aún son evidencias pendientes de despliegue.
