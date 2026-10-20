# Pagos, estados, reconciliación y reembolsos

Usar el contrato de [consulta de pago para Checkout Pro/Preferences](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/get-payment/get). No sustituirlo por recursos de Orders API por similitud del nombre.

## Consultar y validar

`GET https://api.mercadopago.com/v1/payments/{id}` se ejecuta desde backend con la cuenta esperada. Validar ID, `external_reference`, vendedor, ambiente, `transaction_amount` y `currency_id` contra la operación local antes de publicar efectos. El tenant sale de la asociación confiable local/cuenta, no de un campo arbitrario de la notificación.

Un pago consultado puede tener varias notificaciones y una orden puede tener varios intentos. No marcar la orden fallida sólo porque un intento fue rechazado, ni cobrar de nuevo porque la consulta dio timeout. No registrar la respuesta completa con datos de pagador o tarjeta.

## Estados conceptuales

| Estado del proveedor | Tratamiento de dominio orientativo |
| --- | --- |
| `approved` | Confirmar las condiciones del cobro y reflejar el resultado una vez; comprobar devoluciones parciales. |
| `authorized` | Autorización pendiente de captura; no equiparar automáticamente con cobro completado. |
| `pending`, `in_process` | Mantener pendiente/revisión según detalle y método; reconciliar. |
| `rejected`, `cancelled` | Cerrar el intento según política, sin borrar otros intentos válidos. |
| `refunded` | Registrar devolución y su importe; no inferir efectos de stock o prestaciones universales. |
| `charged_back` | Registrar disputa/contracargo con tratamiento explícito. |
| Desconocido | Conservar el dato y consultar contrato; no promover a pagado. |

La tabla no enumera todos los `status_detail`. Consultar la respuesta y contrato vigente del método, conservar estado externo y mapear al dominio. No mostrar códigos crudos ni afirmar que todo rechazo provino del banco. Un código de duplicación exige comprobar el pago previo antes de sugerir otra tarjeta.

## Reconciliación

Buscar mediante `GET /v1/payments/search` con la referencia y filtros documentados, paginando resultados. Comparar todos los intentos relevantes y montos; no elegir el primer aprobado sin validar asociación, moneda y devoluciones. Programar antigüedad, frecuencia y presupuesto según el método y requisitos, sin adoptar el cron de TiendaGo como regla universal.

Las consultas también pueden fallar: conservar trabajo pendiente y reintentos acotados. Una notificación vieja no debe degradar un resultado financiero confirmado.

## Reembolsos

El [contrato de reembolso](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/create-refund/post) utiliza `POST /v1/payments/{id}/refunds` y requiere `X-Idempotency-Key`. El campo `amount` permite indicar una devolución parcial; verificar elegibilidad y condiciones actuales del pago/método antes de enviar.

Conservar clave y payload de la operación lógica durante los reintentos. Controlar devoluciones acumuladas y concurrencia, guardar ID/resultado externo y reconciliar si hay timeout. No repetir con una clave nueva para resolver incertidumbre. Aplicar sólo reembolsos solicitados dentro del alcance autorizado.
