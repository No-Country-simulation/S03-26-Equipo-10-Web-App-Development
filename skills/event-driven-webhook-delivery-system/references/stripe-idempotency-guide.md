# Guía de Idempotencia en Webhooks de Stripe

Esta referencia explica cómo evitar cobros dobles y errores de duplicidad al procesar pagos (Skill **SKL-PAY-STRIPE-001**).

## 1. ¿Por qué es necesaria la idempotencia?
Stripe garantiza la entrega de los webhooks, pero no garantiza que se entreguen **exactamente una vez**. Debido a reintentos automáticos tras fallos temporales de red, tu backend podría recibir el mismo evento múltiples veces.

## 2. Estrategia de Implementación

### A. Registro de IDs de Eventos (Recomendado)
1. Crea una tabla en tu base de datos llamada `processed_events`.
2. El campo principal debe ser `event_id` (el ID que viene en el payload de Stripe).
3. Antes de ejecutar cualquier lógica de negocio (ej: entregar un curso o marcar pedido como pagado), verifica si el `event_id` ya existe en la tabla.
4. Si existe, responde `200 OK` y termina el proceso.
5. Si no existe, ejecuta la lógica y registra el `event_id` en la tabla dentro de una **transacción atómica**.

### B. Estados de Pedido Deterministas
Asegúrate de que la lógica de actualización sea segura:
- `UPDATE orders SET status = 'paid' WHERE id = 123 AND status != 'paid';`
Esto previene que procesos paralelos (si los hay) causen efectos secundarios inesperados.

## 3. Manejo de "Race Conditions"
Usa transacciones de base de datos para asegurar que la verificación y la inserción del evento procesado ocurran de forma atómica.

---

## Flujo de Trabajo Seguro
1. Recibir Webhook.
2. Validar Firma.
3. Responder `200 OK`.
4. (Background) Verificar `event_id` en DB.
5. (Background) Ejecutar lógica de negocio.
6. (Background) Marcar `event_id` como procesado.
