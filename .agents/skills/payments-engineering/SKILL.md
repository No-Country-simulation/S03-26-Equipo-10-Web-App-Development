---
name: payments-engineering
description: >-
  Diseño, integración y revisión de pagos, pasarelas, reembolsos y suscripciones
  (SKL-PAYMENTS-ENG-001). Usar para modelar dinero y estados financieros,
  integrar proveedores y resolver idempotencia, webhooks o reconciliación de pagos;
  no para facturación de servicios de infraestructura ni webhooks sin dominio financiero.
---

# Ingeniería de pagos y pasarelas

**Código:** SKL-PAYMENTS-ENG-001 · **Versión:** 1.0.0

**Fuente:** especificación del usuario «Pasarelas y Métodos de Pagos», v1.0.0, adaptada al Testimonial CMS el 2026-10-20. El adjunto termina en RF-06: se conserva su indicación completa sobre identificadores externos y se omite la frase truncada, sin reconstruir requisitos faltantes.

Priorizar integridad financiera, idempotencia, seguridad, reconciliación, observabilidad y experiencia de usuario. Un pago es un proceso distribuido: una respuesta HTTP o el retorno del navegador no bastan para representar su ciclo de vida.

## Contexto y alcance

Leer [AGENTS.md](../../../AGENTS.md), [llm.txt](../../../llm.txt) y las restricciones del plan activo, si existe. Esta habilidad orienta cambios autorizados; no habilita cobros, reembolsos reales ni fases posteriores por sí misma.

- El CMS utiliza NestJS por capas, Prisma y aislamiento lógico por `tenant_id`. Respetar esos límites en lecturas, escrituras y resolución de identidades externas. No asumir políticas PostgreSQL RLS.
- Según la [arquitectura vigente](../../../docs/technical/01_architecture.md), los webhooks salientes usan ledger y polling PostgreSQL dentro de la API; Redis sirve cuotas y caché. Un consumidor financiero entrante es una capacidad a diseñar, no una integración existente. No imponer BullMQ, nuevos servicios o proveedores por el diagrama conceptual del adjunto.
- Esta incorporación documental no implementa pagos. Inspeccionar el código antes de describir capacidades disponibles; separar comportamiento existente, propuesta y evidencia pendiente.

## Dinero, autoridad y dominio

- Representar importe y moneda como un valor inseparable. Preferir unidades menores enteras cuando moneda y proveedor lo permitan; respetar exponentes, límites y redondeo reales. Evitar floating point binario para cálculos monetarios y conversiones que pierdan precisión.
- El cliente solicita producto, cantidad o cupón; el servidor obtiene precios, descuentos, impuestos y moneda de fuentes confiables y calcula el total. Validar la solicitud sin aceptar un precio enviado por el navegador como autoridad.
- Distinguir orden, obligación de pago e intento de cobro. Incorporar reembolsos, suscripciones y disputas cuando el negocio los necesite, sin condensar todas las responsabilidades en una única entidad genérica ni crear entidades sin uso.
- Persistir los identificadores externos necesarios de forma explícita: proveedor, pago, cliente o suscripción según corresponda. Resolver su pertenencia al tenant y cuenta del proveedor antes de aplicar efectos locales.
- Mantener estados internos explícitos y auditables. El modelo conceptual `CREATED → PENDING`, con resultados como `REQUIRES_ACTION`, `AUTHORIZED`, `SUCCEEDED`, `FAILED` o `CANCELED`, se adapta al negocio y al método de pago; no es un grafo obligatorio ni una copia del proveedor. Tras el éxito pueden existir reembolsos parciales, totales o disputas, con representación acorde al dominio.

## Integración, incertidumbre e idempotencia

Para integrar o revisar Mercado Pago, leer la skill específica [mercadopago-api](../mercadopago-api/SKILL.md) y sólo las referencias del flujo elegido.

Encapsular cada proveedor en adaptadores que traduzcan solicitudes y respuestas al modelo interno. Usar puertos por capacidad cuando ayude —creación, consulta, reembolso o suscripción— y evitar una interfaz universal que obligue a simular capacidades inexistentes.

Antes de concretar SDKs, endpoints, firmas, estados, unidades monetarias o reintentos, consultar documentación oficial vigente del proveedor elegido y la versión instalada. No trasladar reglas de Stripe a PayPal, Mercado Pago o Adyen por analogía ni elegir proveedor sin una necesidad de la tarea.

- Identificar cada operación lógica y conservar su identidad en los reintentos. Coordinar la idempotencia local y la admitida por el proveedor; una solicitud repetida o concurrente no debe producir un segundo cobro por la misma operación.
- Separar estado del pago, intentos y resultados del proveedor. Un timeout después del envío puede ocultar un cobro exitoso: persistir la incertidumbre y consultar/reconciliar antes de generar otro intento de cobro. Un error de transporte no demuestra un rechazo financiero.
- Documentar las transiciones permitidas y cómo se resuelven eventos tardíos o fuera de orden. No degradar un estado confirmado por la mera llegada de una notificación antigua.
- Minimizar el contacto con datos de tarjeta mediante tokenización o componentes alojados del proveedor, según la integración. Mantener secretos fuera del código y datos sensibles fuera de logs, contexto y evidencia. Aplicar la habilidad no acredita certificación ni cumplimiento PCI DSS.

## Webhooks y recuperación

Verificar autenticidad con el mecanismo oficial del proveedor antes de confiar en el evento. Preservar los bytes originales cuando la firma lo requiera y validar su estructura. No imponer un algoritmo de firma común a todos los proveedores.

Deduplicar por la identidad del evento dentro del ámbito correcto del proveedor/cuenta y persistir su recepción de forma durable antes del ACK exitoso. Si la persistencia falla, no confirmar recepción. Procesar el trabajo pesado fuera del handler mediante un mecanismo durable con recuperación tras reinicios; una tarea sólo en memoria no basta.

La deduplicación del evento no reemplaza la idempotencia de negocio: eventos distintos pueden referirse a la misma operación. Aplicar cambios financieros de forma condicional y auditable, tolerando duplicados y desorden. El navegador sólo presenta el resultado; no confirma por sí solo el pago ni habilita prestaciones.

Combinar estado local, eventos verificados y consultas al proveedor o datos de liquidación disponibles. Diseñar reconciliación para pagos pendientes demasiado tiempo, operaciones externas sin correspondencia local, diferencias de importe/moneda y reembolsos no reflejados. Definir antigüedad y acciones según el método/proveedor y los requisitos del negocio, sin inventar plazos universales.

Registrar cambios y resultados suficientes para reconstruir la operación, con identificadores de correlación y datos minimizados. Distinguir recepción HTTP de procesamiento financiero; observar pendientes envejecidos, fallos de procesamiento y discrepancias de reconciliación según el alcance operativo acordado.

## Validación y entrega

Al implementar o revisar una integración, seleccionar pruebas por riesgo. Como mínimo, considerar:

| Escenario | Resultado que verificar |
| --- | --- |
| Cliente manipula el precio | El total procede del cálculo del servidor y fuentes confiables. |
| Timeout después de un posible cobro | La operación queda incierta y se consulta/reconcilia antes de volver a cobrar. |
| Webhook duplicado o desordenado | La recepción y los efectos son idempotentes; un evento antiguo no revierte un estado confirmado. |
| Pago pendiente sin webhook final | La reconciliación consulta al proveedor y resuelve o expone la discrepancia de forma auditable. |

Agregar casos de concurrencia, firmas inválidas, fallos de persistencia y reembolsos cuando afecten al cambio. Separar evidencia de sandbox de cualquier afirmación sobre producción. Entregar contratos afectados, resultados comprobados y pendientes concretos; cerrar sólo la fase HITL autorizada.
