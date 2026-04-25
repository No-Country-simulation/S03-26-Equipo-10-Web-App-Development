# ADR 0002: Patrón Outbox Transaccional para Eventos y Webhooks

**Fecha:** 2026-04-25  
**Estado:** Aceptado

## Contexto

El CMS de testimonios necesita notificar a sistemas de terceros (por ejemplo, canales de Slack o endpoints de clientes) cuando un testimonio es publicado, rechazado o recibe un voto. Estos eventos son enviados a través de *Webhooks*.

Si la API intenta enviar el webhook de forma síncrona durante la transacción principal:
1. Retrasaría la respuesta al usuario.
2. Si el sistema externo está caído, la petición HTTP fallaría, obligando a revertir la transacción completa en nuestra base de datos (o perdiendo la notificación del evento si no se revierte).

## Decisión

Hemos decidido implementar el patrón **Transactional Outbox**, apoyado por **BullMQ (Redis)** y un Worker de procesamiento asíncrono.

## Implementación

1. Cuando ocurre un cambio de estado, se inserta o actualiza la entidad principal en la base de datos (Ej: `testimonials`).
2. En la *misma transacción SQL*, se inserta un registro en la tabla `outbox_events` (ej: `{ type: 'testimonial.published', payload: {...} }`).
3. La petición HTTP del usuario finaliza rápidamente con un código de éxito.
4. Un proceso asíncrono (Worker) lee continuamente de `outbox_events` y encola los trabajos en Redis (BullMQ) para su distribución a los sistemas externos.
5. BullMQ se encarga de reintentos (Exponential Backoff) si el webhook falla. Al tener éxito, el evento en el Outbox se marca como procesado.

## Justificación

- **Consistencia Garantizada:** Al escribir el evento en la misma base de datos relacional dentro de la misma transacción, garantizamos que si se guarda el testimonio, el evento se guardará sí o sí. No hay pérdida de eventos.
- **Desacoplamiento:** La API principal no sabe ni le importa el tiempo que demore enviar el webhook o si este sistema está caído.
- **Tolerancia a fallos:** El sistema externo puede estar caído horas; los eventos se acumularán en nuestra cola y se enviarán cuando se restablezca el servicio.

## Consecuencias (Trade-offs)

- **Positivas:** Sistema extremadamente resiliente. Respuesta inmediata al usuario. Imposibilidad de inconsistencias entre los datos guardados y los eventos disparados.
- **Negativas:** Introduce complejidad arquitectónica (requiere un servicio *Worker*, tabla extra `outbox_events`, infraestructura de Redis y BullMQ).
- **Mitigaciones:** Mantener el Worker como un proceso separado pero dentro del mismo monorepo para facilitar su despliegue y desarrollo.
