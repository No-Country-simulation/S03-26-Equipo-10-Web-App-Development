---
name: mercadopago-api
description: >-
  Integrar y revisar Mercado Pago para Argentina: Checkout Pro mediante Preferences,
  consulta de pagos, reembolsos, webhooks con x-signature y pruebas de integración.
  Usar ante Mercado Pago, MercadoPago, Checkout Pro, notification_url o webhooks MP.
  Adaptar al stack del proyecto; Go es una referencia opcional. Para suscripciones,
  Bricks u Orders API consultar el contrato específico, sin extrapolar Preferences.
license: MIT
metadata:
  author: Daniela Regert
  version: "1.0.1"
  source_version: "1.0.0"
  category: payments
  country: AR
  adapted_on: "2026-10-20"
---

# Mercado Pago API para Argentina

Adaptación para Codex de la skill local `.claude/skills/mercadopago-api`, originalmente orientada a Go/TiendaGo. Autoría y licencia en [CREDITS.md](CREDITS.md) y [LICENSE](LICENSE). Los ejemplos de aquella aplicación no describen capacidades existentes del CMS.

## Elegir el flujo y leer sólo lo necesario

Antes de integrar, identificar producto, país, cuenta vendedora, ambiente y stack. Esta guía conserva el flujo Checkout Pro mediante Preferences del original. No confundirlo con Checkout Pro mediante Orders ni reutilizar sus recursos para Bricks, QR o suscripciones sin consultar la documentación de ese producto.

| Necesidad | Referencia |
| --- | --- |
| Crear checkout, configurar retorno y notificaciones | [Checkout Pro](references/checkout-pro.md) |
| Verificar HMAC, aceptar y procesar notificaciones | [Webhooks](references/webhooks-hmac.md) |
| Consultar estados, reconciliar y reembolsar | [Payments API](references/payments-api.md) |
| Cuentas y compras de prueba en Argentina | [Pruebas](references/test-cards-argentina.md) |
| Diagnosticar errores o diferencias de ambiente | [Troubleshooting](references/troubleshooting.md) |
| Trabajar expresamente en Go | [SDK Go](references/go-sdk.md) |

Consultar documentación oficial vigente y la versión instalada antes de escribir código. Las referencias son guías de integración, no una copia exhaustiva de la API ni una garantía de que una versión del SDK incluya un método. No instalar dependencias ni configurar cuentas por la sola invocación de la skill.

## Aplicación en este repositorio

Leer [AGENTS.md](../../../AGENTS.md) y [llm.txt](../../../llm.txt). El CMS usa NestJS/TypeScript, Next.js y Prisma: adaptar el contrato al stack real, con cliente del proveedor en backend y credenciales privadas fuera del frontend. Para diseñar el dominio financiero, consultar [payments-engineering](../payments-engineering/SKILL.md).

Respetar aislamiento por tenant y resolver la cuenta vendedora desde configuración confiable. El ledger de webhooks salientes del CMS no constituye un consumidor entrante de Mercado Pago. Elegir persistencia y procesamiento durable compatibles con la arquitectura, sin imponer Go, BullMQ, ngrok ni servicios adicionales. Esta adaptación documental no agrega endpoints ni autoriza operaciones financieras reales.

## Flujo de referencia

1. Calcular el importe en servidor y persistir la operación local antes del checkout. Vincular la preference con una referencia interna y guardar su ID externo.
2. Crear la preference desde backend y devolver la información mínima para abrir el checkout alojado. Las URLs de retorno muestran el estado local; sus parámetros no acreditan un pago.
3. Verificar la autenticidad del webhook y guardar durablemente su recepción antes de confirmar. Procesar después con recuperación ante fallos.
4. Consultar el recurso con credenciales de la cuenta esperada. Comprobar referencia local, tenant, vendedor, ambiente, importe y moneda antes de aplicar efectos.
5. Actualizar el estado financiero de forma idempotente y auditable. Reconciliar operaciones pendientes, discrepancias y resultados inciertos.

## Reglas que cambian la implementación

- No identificar una notificación por `data.id` solamente: es el recurso de pago y puede recibir múltiples actualizaciones legítimas. Distinguir identidad de evento, recurso y operación de negocio; deduplicar la recepción sin bloquear cambios futuros.
- La firma de notificaciones de este flujo se valida con el manifest documentado por Mercado Pago; no se calcula sobre JSON reserializado ni se importa el esquema de firma de otros proveedores.
- No asumir idempotencia remota en Preferences por enviar `X-Idempotency-Key`. Verificar soporte por endpoint y conservar coordinación local; una respuesta incierta exige consultar antes de recrear la operación.
- Separar access token y secreto de webhook. No registrar credenciales, firmas calculadas ni datos del pagador. Las convenciones de nombres de variables se adaptan al proyecto; no contienen valores reales en documentación.
- Las credenciales y cuentas de prueba dependen del producto. No inferir el ambiente sólo por prefijos `TEST-`/`APP_USR-` ni hacer pagos reales para resolver dudas de sandbox.

## Validación y entrega

Probar checkout con precios del servidor, firma válida/inválida, persistencia fallida sin ACK, recepción duplicada y dos actualizaciones distintas del mismo pago (`pending → approved`, luego reembolso). Cubrir desorden, cuenta/tenant o importe incorrectos, timeout y reconciliación. Simular notificaciones prueba la recepción; una compra de prueba verifica el recorrido completo.

Al cerrar, informar flujo y versión usados, evidencia de sandbox y pendientes operativos. No convertir la preparación técnica en activación productiva ni atribuir al CMS decisiones del proyecto TiendaGo.
