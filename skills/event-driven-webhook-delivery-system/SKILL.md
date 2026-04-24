# Especificación Técnica de Habilidad: Arquitectura de Eventos y Sistema de Entrega de Webhooks (Outbox Pattern)

**Código de Skill:** SKL-SYS-001  
**Versión:** 1.3.0  
**Estándar:** ISO/IEC 26514 / IEEE 29148 / Transactional Outbox Pattern

---

## 1. Ficha de Identificación del Skill
| Atributo | Definición Técnica |
| :--- | :--- |
| **Habilidad Principal** | Arquitectura de Eventos y Delivery de Webhooks Multi-tenant |
| **Objetivo de Dominio** | Capacitar al usuario para diseñar e implementar sistemas de notificación asincrónica altamente confiables mediante el uso del patrón **Transactional Outbox**, garantizando la entrega de eventos sin pérdida de datos. |
| **Tipo de Proyecto** | Arquitecturas Distribuidas / SaaS / Sistemas Event-Driven |
| **Complejidad** | **Alta** (Manejo de consistencia eventual, reintentos y concurrencia) |

---

## 2. Descripción y Filosofía de Diseño
El skill de **Sistemas de Entrega de Webhooks** se basa en la fiabilidad absoluta de la comunicación entre sistemas desacoplados. A diferencia de las notificaciones síncronas, este sistema utiliza el patrón **Outbox** para asegurar que el cambio en la base de datos y la creación del evento ocurran en una misma transacción atómica.

* **Fiabilidad (At-least-once delivery):** Garantizar que cada evento se intente entregar hasta recibir una confirmación (2xx) del receptor.
* **Consistencia Atómica:** El evento se persiste en la tabla `OutboxEvent` en la misma transacción que la lógica de negocio.
* **Escalabilidad Multi-tenant:** Gestión independiente de webhooks y entregas para múltiples inquilinos (Tenants).

#### 2.1. Resiliencia y Observabilidad (Patrones Aplicables)
* **Patrón Outbox:** Evita la pérdida de eventos si el servicio de entrega falla o se reinicia.
* **Estrategia de Reintentos (Exponential Backoff):** Reintentar entregas fallidas con tiempos de espera incrementales para no saturar al receptor.
* **Trazabilidad de Entregas:** Registro detallado en `WebhookDelivery` (códigos de respuesta, cuerpos y errores) para auditoría y soporte técnico.

---

## 3. Requerimientos del Skill
#### 3.1. Requerimientos Funcionales (RF)
* **[RF-01]:** Persistir eventos en la tabla `OutboxEvent` con estado `pending` durante las transacciones de negocio.
* **[RF-02]:** Implementar un Worker/Procesador que escanee eventos pendientes y los despache a los `Webhook` configurados.
* **[RF-03]:** Validar la autenticidad de la entrega mediante firmas criptográficas en los headers (HMAC-SHA256).
* **[RF-04]:** Registrar cada intento de envío en `WebhookDelivery` para mantener un historial de salud del sistema.

#### 3.2. Requerimientos No Funcionales (RNF)
* **[RNF-01] Consistencia:** Garantizar que si una transacción de negocio falla, el evento NO se envíe (Atomicidad).
* **[RNF-02] Rendimiento:** El despacho de webhooks no debe bloquear el hilo principal de la API (Procesamiento en segundo plano).
* **[RNF-03] Seguridad:** Protección de los secretos de webhook por inquilino y rotación de firmas.

---

## 4. Criterios de Aceptación (Definition of Done)
* **Validación Lógica:** Al crear un recurso (ej: Testimonial), se genera automáticamente un registro en `OutboxEvent` vinculado al inquilino.
* **Resiliencia de Entrega:** Si el servidor receptor está caído, el sistema marca el intento como fallido y programa un reintento automático.
* **Calidad Técnica:** El sistema soporta la firma de payloads para que el receptor pueda verificar que el evento proviene de nuestra plataforma.
* **Observabilidad:** El dashboard/API permite consultar el historial de `deliveries` de un webhook específico.

---

## 5. Ecosistema de Herramientas (Stack)
* **Persistencia:** PostgreSQL + Prisma (Tablas: `Webhook`, `OutboxEvent`, `WebhookDelivery`).
* **Framework:** NestJS (API + Workers).
* **Seguridad:** Criptografía de Node.js (Crypto) para firmas HMAC.
* **Procesamiento:** @nestjs/event-emitter o tareas programadas (Cron/Workers).

---

## 6. Metodología de Práctica (Paso a Paso)
1.  **Fase de Modelado:** Diseñar las tablas de Outbox y Delivery vinculadas al esquema de Tenant.
2.  **Fase de Emisión:** Integrar la creación de `OutboxEvent` en los servicios de negocio mediante transacciones de Prisma.
3.  **Fase de Despacho:** Crear un servicio `WebhookProcessor` que recupere eventos `pending` y realice las peticiones HTTP con firma.
4.  **Fase de Seguimiento:** Implementar la lógica de actualización de estados de entrega y manejo de reintentos.

---

## 7. Antipatrones (Lo que NO se debe hacer)
* ⚠️ **Envío Directo desde el API:** Nunca envíes el webhook directamente en el hilo de la petición del usuario (si la red falla, la transacción queda en un estado inconsistente).
* ⚠️ **Reintentos Infinitos:** No reintentar indefinidamente si el receptor devuelve un 4xx (error del cliente); establece un límite de intentos.
* ⚠️ **Payloads Masivos:** Evita enviar todo el objeto de base de datos; envía solo lo necesario o un puntero al recurso.

---

## 8. Evaluación y KPIs
| Métrica | Meta |
| :--- | :--- |
| **Event Loss Rate** | 0% (Gracias al patrón Outbox) |
| **Average Delivery Time** | < 2s desde la ocurrencia del evento |
| **Max Retry Attempts** | 5-10 intentos con backoff |

---

## 9. Recursos Adicionales
- [Microservices.io - Transactional Outbox Pattern](https://microservices.io/patterns/data/transactional-outbox.html)
- [Stripe-style Webhook Security (Best Practices)](https://stripe.com/docs/webhooks/signatures)
