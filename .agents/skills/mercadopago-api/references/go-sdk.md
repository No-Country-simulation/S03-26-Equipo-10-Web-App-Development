# SDK Go: referencia opcional

Leer sólo cuando la tarea requiera Go. El CMS utiliza NestJS/TypeScript: la existencia de esta referencia no propone migrarlo a Go ni agregar otro servicio.

- [Repositorio oficial Go](https://github.com/mercadopago/sdk-go).
- [Documentación de paquetes Go](https://pkg.go.dev/github.com/mercadopago/sdk-go).
- Para el stack actual: [SDK oficial Node.js](https://github.com/mercadopago/sdk-nodejs).

El original describía una versión del SDK Go y el cliente HTTP de TiendaGo. Confirmar versión instalada y API pública antes de usar nombres de constructores, helpers o métodos de reembolso. No afirmar que todos los SDKs incluyen reintentos o que ninguno incluye validación de webhook.

Elegir SDK o HTTP según capacidades, mantenimiento y dependencias reales. Mantener adaptadores pequeños, timeouts, validación de respuestas y dinero exacto en el dominio. Verificar cómo serializa los importes la versión usada; los ejemplos históricos con `float64` no autorizan cálculos monetarios binarios.

Las reglas de autenticación, recepción durable, deduplicación y reconciliación son las de [webhooks](webhooks-hmac.md) y [pagos](payments-api.md). No copiar un handler síncrono que marque `payment_id` como procesado para siempre.
