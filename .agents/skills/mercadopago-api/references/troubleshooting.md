# Diagnóstico de Mercado Pago

Consultar el [panel de integraciones](https://www.mercadopago.com.ar/developers/panel/app), [estado del servicio](https://status.mercadopago.com/) y contrato oficial del producto. Tratar las causas como hipótesis a verificar, sin atribuir fraude, límites o rechazo bancario por intuición.

| Síntoma | Comprobación útil |
| --- | --- |
| `401` | Verificar que backend usa la credencial de la cuenta/app esperada y que no contiene espacios accidentales. No regenerarla automáticamente. |
| `403` | Revisar permisos, cuenta, producto y ambiente; no prometer resolverlo sólo cambiando token. |
| `400` al crear checkout | Validar tipos, importe, moneda, cantidades y URLs contra el contrato de Preferences. |
| `429` o indisponibilidad | Acotar concurrencia y reintentos; coordinar idempotencia en mutaciones antes de reenviar. |
| Firma inválida | Revisar secreto de la app, header y manifest exacto; usar [webhooks](webhooks-hmac.md). No imprimir firma esperada ni exponer credenciales. |
| Firma ausente | Verificar producto y configuración de notificaciones. No desactivar autenticación ni concluir que `notification_url` siempre llega sin firma. |
| `404` al consultar | Revisar ID, cuenta, ambiente y si es una simulación sin recurso real; conservar trabajo recuperable cuando corresponda. |
| Retorno success y estado local pendiente | Mostrar pendiente y consultar/reconciliar; no acreditar por query params. |
| Falta una actualización posterior | Comprobar que la deduplicación no bloqueó permanentemente el `payment_id`, además del log de entregas y procesamiento. |
| Reembolso incierto | Consultar resultado con la identidad original antes de repetir; no cambiar la clave por un timeout. |

Revisar entrega del proveedor y procesamiento interno por separado. Si se confirmó un evento ya persistido, la recuperación depende del procesador local; no asumir que el proveedor volverá a entregarlo tras un ACK exitoso.

Para rechazos repetidos, contrastar el código y las recomendaciones oficiales. No fabricar pagos propios o de conocidos para «calentar» cuentas, ni probar cobros reales como solución de sandbox. Comisiones, acreditaciones, promociones y cuotas deben consultarse para la cuenta y fecha efectivas; no conservar las tarifas o programas históricos del original como contrato vigente.
