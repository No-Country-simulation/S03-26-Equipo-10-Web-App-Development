> **Adaptación para Codex (2026-10-20):** se conserva debajo la atribución del original v1.0.0 de Daniela Regert. Esa sección describe sus fuentes y decisiones históricas, no el estado actual del CMS ni una reverificación completa de los SDKs. La adaptación v1.0.1 reorganiza instrucciones para NestJS/TypeScript, sintetiza las seis referencias y corrige deduplicación permanente por pago, procesamiento antes del ACK, precedencia de URLs y supuestos de credenciales/reintentos. Se conserva la licencia MIT. El original local en `.claude/skills/mercadopago-api` permanece intacto. Las referencias adaptadas enlazan las fuentes oficiales que deben verificarse al integrar.

# Credits & attributions

Este skill agrega valor sintetizando información de varias fuentes públicas. Detalle de las fuentes abajo.

## Documentación oficial de MercadoPago

La gran mayoría del contenido fue verificado contra la documentación pública oficial de MercadoPago (MercadoLibre S.R.L.):

- [MercadoPago Developers — Checkout Pro](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/landing)
- [Webhooks — Payment notifications](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/payment-notifications)
- [Test cards](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/integration-test/test-purchases)
- [Test accounts](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/test/accounts)
- [Get payment status](https://www.mercadopago.com.co/developers/en/docs/checkout-api-payments/response-handling/query-results)
- [Why is a payment rejected](https://www.mercadopago.com.co/developers/en/docs/subscriptions/how-tos/improve-payment-approval/reasons-for-rejection)
- [Go to production](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro/go-to-production)

El código de ejemplo en Go para validación HMAC está basado en el ejemplo oficial publicado por MercadoPago en su documentación de Webhooks, adaptado y extendido con:
- Replay protection (ventana de 5 minutos sobre `ts`).
- Omisión de campos vacíos en el template.
- Constant-time comparison (`hmac.Equal`).
- Logging de debug descriptivo.

## Tabla de `status_detail` — fuente secundaria

El mapeo de códigos `cc_rejected_*` a mensajes humanos fue contrastado contra:

- **[Shoperti/Payme](https://github.com/Shoperti/Payme)** — `src/Gateways/MercadoPago/MercadoPagoGateway.php`
  Licencia: **MIT**. Copyright (c) Shoperti.

La tabla final en `references/payments-api.md` fue reescrita desde cero en español, pero los códigos y el orden de aparición coinciden con Payme como referencia cruzada de completitud.

## SDK oficial Go

- **[mercadopago/sdk-go](https://github.com/mercadopago/sdk-go)** — MIT License.
  El archivo `references/go-sdk.md` resume la API pública del SDK v1.8.0 (diciembre 2025) como alternativa al enfoque HTTP directo, con enlaces al GoDoc oficial.

## Discusiones técnicas de la comunidad

- [sdk-nodejs webhook x-signature discussion #318](https://github.com/mercadopago/sdk-nodejs/discussions/318) — útil para entender el parsing exacto del header y los modos de falla frecuentes en producción.
- [Hookdeck — HMAC-SHA256 webhook signature verification guide](https://hookdeck.com/webhooks/guides/how-to-implement-sha256-webhook-signature-verification) — mejores prácticas generales de validación HMAC (constant-time, raw body, timestamp tolerance).

## Sobre marcas registradas

- **MercadoPago** y **MercadoLibre** son marcas registradas de MercadoLibre S.R.L. Este proyecto no está afiliado, endorseado ni auspiciado por MercadoLibre.
- **Claude Code** es un producto de Anthropic.
- **Visa**, **Mastercard**, **American Express** son marcas registradas de sus respectivos dueños. Los números de tarjeta que figuran en `references/test-cards-argentina.md` son **tarjetas de test públicas** publicadas oficialmente por MercadoPago en su documentación para desarrolladores y **no son tarjetas reales**.

## Autor del skill

**Daniela Regert** — armado durante la integración de un proyecto de e-commerce real (TiendaGo) en abril de 2026.

## Cambios materiales respecto a la documentación fuente

- Idioma: contenido en español rioplatense, con glosas en inglés donde los términos técnicos son universales.
- Organización: estructurado como skill navegable (entry point + references), no como docu de referencia lineal.
- Foco: Argentina (ARS, DNI, Rapipago/Pago Fácil, Ahora 12), aunque la mayoría del contenido aplica a toda LATAM cambiando dominios.
- Código Go: adaptado al estilo de TiendaGo (HTTP directo, sin SDK), con ejemplos listos para copiar-pegar.
- Opinión: agregué recomendaciones de mi propia experiencia (ej: cuándo usar SDK vs HTTP directo, cómo manejar anti-fraude, patrón de reconciliación por cron). Estas son opiniones del autor, no posturas oficiales de MercadoPago.

## Feedback y correcciones

Si encontrás contenido desactualizado, errores técnicos, o atribuciones faltantes, abrí un issue en [github.com/danielaregert/claude-skill-mercadopago-api](https://github.com/danielaregert/claude-skill-mercadopago-api/issues).
