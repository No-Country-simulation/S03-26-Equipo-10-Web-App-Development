# Checkout Pro mediante Preferences

Usar esta referencia para el flujo de la skill original. Confirmar país, ambiente y versión en la [API oficial de creación de preferences](https://www.mercadopago.com.ar/developers/en/reference/online-payments/checkout-pro-preferences/create-preference/post).

## Contrato de integración

`POST https://api.mercadopago.com/checkout/preferences` se realiza en backend con credenciales privadas. La preference agrupa ítems y configuración del checkout; no demuestra un cobro.

Construir `items` desde catálogo y cantidades validadas en servidor. Asociar `external_reference` a la operación local, conservar el ID de preference y evitar referencias ambiguas entre tenants. Configurar `back_urls` y, si corresponde, `auto_return`, métodos/cuotas y vencimiento con el contrato vigente. No forzar esas opciones por el ejemplo de TiendaGo.

Mantener dinero exacto en el dominio. Convertir al formato monetario esperado por el proveedor en el adaptador, verificando escala y límites, sin usar floating point para calcular totales. No copiar los structs `float64` originales como modelo financiero del CMS.

Abrir el checkout con el mecanismo documentado para ese ambiente. No declarar `sandbox_init_point` obsoleto ni elegir URL sólo por el prefijo del token. Ver [pruebas de integración](test-cards-argentina.md).

## Retorno y notificaciones

Una vuelta a `back_urls.success` no confirma el pago. La pantalla consulta estado local; backend confirma con API/eventos verificados. No habilitar prestaciones mediante query params del navegador.

Configurar `notification_url` y/o el panel según la [guía oficial de notificaciones de Preferences](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications). La URL enviada al crear el pago tiene precedencia sobre la del panel según esa guía; no conservar la regla inversa del original. Verificar la firma en el flujo configurado, sin deducir que una URL por preference implica ausencia de HMAC.

## Reintentos y mantenimiento

Coordinar intentos concurrentes y conservar la referencia lógica. No asumir que Preferences deduplica por `X-Idempotency-Key`: comprobar el contrato del endpoint. Ante timeout, revisar el recurso y estado local antes de repetir.

Consultar el contrato antes de actualizar o expirar una preference. Vencimiento del checkout y estado de un pago son conceptos separados; no imponer cancelación universal a los 30 días ni programas de cuotas históricos. Si el usuario pide Orders API, usar su documentación específica sin migrar silenciosamente el flujo.
