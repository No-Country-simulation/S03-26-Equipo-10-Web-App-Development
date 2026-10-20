# Pruebas de Checkout Pro en Argentina

Consultar [configuración del ambiente](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/configure-development-enviroment) y [compras de prueba](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases) antes de elegir credenciales. El flujo de cuentas depende del producto; el prefijo del token por sí solo no demuestra que una operación sea de prueba.

Usar comprador y vendedor de prueba distintos del mismo país y sesiones separadas, siguiendo la guía de Preferences. Mantener sus accesos fuera de archivos de contexto. No crear cuentas ni hacer compras reales por la sola invocación de esta skill.

## Datos de prueba

Obtener número, CVV y vencimiento desde la tabla oficial del producto al ejecutar la prueba, en lugar de mantener aquí una copia que caduque. El original incluía tarjetas públicas de test, no datos reales de usuarios.

Los nombres de titular permiten simular resultados: `APRO` aprobado, `OTHE` rechazo general, `CONT` pendiente y `FUND` saldo insuficiente. Consultar en la misma tabla el documento requerido y demás combinaciones. No usar esos datos con una cuenta real para probar la integración.

## Recorrido y aceptación

- Crear preference desde backend con importe calculado, abrir checkout con comprador de prueba y comprobar resultado local.
- Confirmar webhook auténtico y consulta del recurso asociado, no sólo la pantalla de retorno.
- Verificar aprobado, rechazado y pendiente. Los métodos offline de prueba pueden finalizar pendientes; no acreditar localmente por el simple paso del tiempo.
- Probar notificación duplicada, actualizaciones del mismo pago, retrasos y recuperación por reconciliación.
- Simular la recepción del panel por separado: un ID inventado no demuestra consulta exitosa ni acreditación.

Registrar evidencias saneadas del ambiente usado. La aceptación en sandbox no sustituye la validación productiva ni habilita cobros reales.
