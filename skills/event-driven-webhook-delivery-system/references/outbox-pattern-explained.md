# El Patrón Transactional Outbox

Esta referencia detalla el funcionamiento del sistema de eventos interno (Skill **SKL-SYS-001**).

## 1. El Problema: Consistencia Dual
Cuando un sistema debe actualizar su base de datos y, al mismo tiempo, notificar a otro sistema (vía Webhook), existe el riesgo de que la base de datos se actualice pero la notificación falle (o viceversa). Esto rompe la consistencia del sistema.

## 2. La Solución: Tabla Outbox
En lugar de enviar la notificación directamente, la guardamos en una tabla de "salida" (`OutboxEvent`) dentro de la misma transacción de la base de datos.

### El Flujo:
1. **Transacción:** El servicio de negocio guarda el cambio principal y el evento en el Outbox.
2. **Commit:** Si algo falla, nada se guarda. Si tiene éxito, ambos están persistidos.
3. **Polling/Relay:** Un proceso independiente (Worker) lee los eventos de la tabla Outbox.
4. **Entrega:** El Worker intenta entregar el webhook.
5. **Confirmación:** Una vez entregado con éxito (200 OK), el evento se marca como `processed` o se elimina.

## 3. Ventajas en este Sistema
- **At-least-once Delivery:** Si el Worker falla después de enviar pero antes de marcar como procesado, el evento se reintentará (garantizando entrega).
- **Desacoplamiento:** El API principal no se ralentiza por fallos de red externos.
- **Auditoría:** Tenemos un historial completo de cada intento de entrega en `WebhookDelivery`.

---

## Estructura de Datos en el Sistema
- `OutboxEvent`: La "intención" de notificar.
- `Webhook`: La configuración del destino (URL, Secret).
- `WebhookDelivery`: El resultado de cada intento de envío.
