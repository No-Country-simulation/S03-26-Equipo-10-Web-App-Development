# Webhooks: firma y recepción durable

Consultar [Webhooks oficiales](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks) para el mecanismo y [notificaciones de Preferences](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications) para el producto. No mezclar topics y recursos de Orders, Payments o suscripciones.

## Verificación

Leer `x-signature` (`ts`, `v1`), `x-request-id` y el identificador desde la URL según el contrato. La familia de validación utiliza este manifest:

```text
id:<data.id de URL>;request-id:<x-request-id>;ts:<ts>;
```

Usar el validador oficial cuando la versión instalada lo soporte; de otro modo implementar el contrato exacto con HMAC-SHA256 y comparación de bytes en tiempo constante. Confirmar normalización del identificador, omisión de componentes ausentes y unidad temporal en la documentación del flujo. No introducir fallbacks de parámetros ni una ventana fija de cinco minutos por el ejemplo original.

Rechazar firma ausente, malformada o inválida para un flujo que la requiere. No usar el body como sustituto del ID verificado: comprobar consistencia y consultar el recurso de ese ID. La firma del manifest no autentica cada campo del body. No registrar el secreto, HMAC esperado ni manifest completo al diagnosticar.

## Recepción y procesamiento

1. Resolver configuración de cuenta/app desde una fuente confiable y verificar autenticidad antes de cualquier efecto financiero.
2. Validar estructura y topic. Persistir durablemente los datos mínimos necesarios para recuperar el trabajo; la deduplicación y el encolado deben ser atómicos o recuperables.
3. Confirmar recepción con `200`/`201` después de persistir. Si falla la persistencia, no confirmar. No depender de una tarea sólo en memoria tras el ACK.
4. En el procesador durable, consultar el pago de la cuenta esperada y aplicar las comprobaciones de [Payments API](payments-api.md). El mismo pago puede pasar de pendiente a aprobado y luego reembolsado.

`data.id` identifica el recurso; no sirve como marca permanente de «pago ya procesado». Definir una identidad de recepción que tolere reentregas y permita actualizaciones distintas. Aplicar idempotencia adicional en los efectos de negocio y recuperación tras caídas, incluso si se deduplicó el evento.

La guía oficial solicita confirmación en 22 segundos y describe reintentos con intervalos crecientes. No asumir ocho entregas como límite garantizado ni usar su calendario como mecanismo de recuperación local. Separar métricas de recepción y procesamiento; reconciliar notificaciones faltantes.

## Pruebas necesarias

Cubrir firma válida, inválida y ausente; ID de URL/body inconsistente; reentrega del mismo evento; eventos distintos del mismo pago; desorden; fallo antes y después del ACK; procesamiento repetido tras reinicio. La simulación del panel no garantiza que exista un pago consultable con un ID arbitrario.
