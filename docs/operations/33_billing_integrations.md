# Integraciones financieras — fase 3

## Estado y límites

Stripe `23.0.0` y Mercado Pago `3.6.1` fijados en el workspace API. `BillingModule` registrado; `BILLING_MODE` omiso/`disabled` no consulta tablas billing al arrancar, no construye clientes remotos ni inicia polling. Los dos receptores responden 404. La migración aditiva sigue siendo necesaria **antes de habilitar sandbox**; esta fase no migra destinos persistentes. No hay todavía pantallas ni endpoints de contratación del tenant: corresponden a fase 4.

La composición acepta `disabled`, `simulation` y `sandbox`. `live` falla al arrancar; no debe usarse una simulación como evidencia de pagos reales. `simulation` está prohibido con `NODE_ENV=production`. En sandbox, Stripe exige una clave de prueba y objetos `livemode=false`. MP exige vendedor `MLA` con tag `test_user`, consultado con `/users/me`. Las credenciales de una cuenta de prueba de Suscripciones pueden tener formato productivo: `resourceLiveMode` declara el valor esperado del recurso, no se deduce del prefijo del token. Una cuenta comercial real no supera el control de vendedor de prueba.

## Configuración externa

`BILLING_CONFIG_JSON` se inyecta en el proceso desde un gestor de secretos; no guardarlo en Git, documentos, capturas, comandos con secretos literales ni logs. El error de configuración es estático y no imprime el JSON. Esquema completo en [billing.config.ts](../../apps/api/src/modules/billing/integrations/billing.config.ts).

| Campo sandbox                 | Valor esperado                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `returnUrl`                   | HTTPS de retorno de la web, sin credenciales/query/fragmento; futuro `/admin/billing/return` |
| `notificationUrl`             | HTTPS directo a NestJS `/api/v1/billing/webhooks/mercadopago`                                |
| `stripe`, `mercadopago`       | Uno o ambos objetos; omitir un proveedor lo deshabilita                                      |
| `accountId`                   | UUID local de `billing_provider_accounts`, ambiente sandbox y `enabled=true`                 |
| `sellerId`                    | Cuenta remota esperada: `acct_…` o ID exacto del vendedor MP de prueba                       |
| `applicationId`               | ID de aplicación MP cuando corresponda, igual al registrado en BD                            |
| `credential`                  | Clave secreta Stripe test / access token MP, nunca `NEXT_PUBLIC_*`                           |
| `webhookSecrets`              | Uno o dos secretos vigentes para rotación; separados de API credentials                      |
| `resourceLiveMode`            | `false` en Stripe; valor explícito del recurso de la cuenta MP de prueba                     |
| `mpSignatureToleranceSeconds` | Default 900, entre 60 y 86400; validar política con entregas reales                          |

`configuration_key` es una referencia no secreta en MAYÚSCULAS; `BILLING_SIMULATION` está reservado exclusivamente al simulador. UUID, vendedor, aplicación y ambiente locales deben corresponder con configuración/consultas remotas. No habilitar el catálogo por editar un precio remoto: la versión local es la autoridad.

La configuración no secreta de cuentas y las rutas de publicación/sincronización se conectarán al panel del operador en fase 4. Actualmente el repositorio expone `enqueueSync`, `enqueueCheckout`, `enqueueCancellation` y `retry`; sólo el primero y los replays globales requieren operador, la autorización admin tenant se compondrá en su API. No invocarlos desde handlers sin dicha autorización.

## Catálogo, consentimiento y recuperación

Sincronizar requiere una versión local publicada (se rechaza draft); publica producto/precio recurrente Stripe con identidades deterministas y verifica moneda, intervalo e importe; manual usa `price_data` con importe local y sin imponer tarjetas como único método. MP no crea planes compartidos: Preferences para manual, `/preapproval` pendiente y checkout alojado para automático, con términos locales inmutables. Una binding sólo pasa a `ready` tras validación del adaptador y confirmación durable. MP aplica un techo local de 999999999999 centavos para serialización exacta; no es una promesa de límite comercial del proveedor. Stripe limita a ocho dígitos de unidades menores. El proveedor puede imponer mínimos, elegibilidad y métodos más restrictivos.

El pagador MP sale del primer administrador activo local del tenant; el correo sólo vive durante la llamada y no entra en `request_data`. Se deberá informar/confirmar el contacto en el flujo de contratación de fase 4. No se reciben tarjetas ni tokens de tarjeta en el CMS.

Operación persistida y hash del contenido antes de cualquier POST. La misma clave con otra entidad da conflicto; una obligación no puede iniciar otro checkout por cambiar la clave. Los POST utilizan el UUID durable como identidad remota. Ambos SDK tienen reintentos de red desactivados. Timeout o caída deja `uncertain`; un nuevo worker consulta/pagina y **no recrea** el checkout. Una ausencia de búsqueda jamás prueba que sea seguro repetir el POST. Un checkout Stripe completado sin URL sigue siendo recuperable por ID. El navegador sólo podrá mostrar el estado confirmado por backend.

Polling cada 3 s, máximo diez reclamos por vuelta y dos procesadores concurrentes. Lease 60 s, heartbeat 20 s, recuperación `SKIP LOCKED`; confirmación financiera e inbox/operación dentro de la misma transacción con comprobación del lease. Sin red dentro de ella. Máximo diez intentos remotos; jitter exponencial hasta una hora y respeto de `Retry-After` hasta 24 h. Error de esquema, pertenencia o importe pasa a revisión. Los logs sólo contienen código estático, tipo e ID de tarea.

Reconciliación durable: contratos automáticos activos cada 15 min; cancelados/finalizados diariamente. Cada obligación manual impaga cada 15 min y pagada diariamente, con paginación local de 100 y búsquedas remotas paginadas. No se crea ningún débito para renovar. Los ciclos recurrentes se identifican por invoice nativa; períodos Stripe provienen de sus líneas, MP usa `debit_date` y calendario mensual/anual con el ancla declarada en su adhesión. Validar ese calendario MP con renovaciones sandbox reales en fase 5. Un cobro adicional se registra como discrepancia, sin otro período.

Una cancelación consulta el contrato remoto y detiene la renovación; la respuesta incierta conserva `cancel_pending`. La cobertura paga permanece. Para pagos manuales Stripe, el acceso comienza al confirmar por primera vez el éxito: la fecha antigua de creación de un PaymentIntent no acorta el período comprado. La nueva adhesión/cambio al vencer cobertura será parte de fase 4. El replay de operador conserva la identidad original y vuelve a consulta; no convierte incertidumbre en permiso para cobrar nuevamente.

## Webhooks directos

| Proveedor | Endpoint y autenticación                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Stripe    | `POST /api/v1/billing/webhooks/stripe`, `stripe-signature`, SDK sobre Buffer original, tolerancia oficial de 300 s                  |
| MP        | `POST /api/v1/billing/webhooks/mercadopago?data.id=…`, `x-signature`, `x-request-id`, validador oficial sobre ID de URL normalizado |

En ambos: límite 256 KiB, JSON sin compresión, firmas antes de escribir, inbox durable antes de 200. Error de BD produce error HTTP, nunca ACK. CSRF tiene modo `provider-signature` sólo en este controlador; no consume cookies/JWT y el resto del CMS conserva sus controles. No enviar estos eventos a Next: su proxy no permite headers de firma. No habilitar IPN sin firma como fallback.

Stripe: configurar eventos `checkout.session.completed`, `async_payment_succeeded`, `async_payment_failed`, `expired`; `invoice.paid`, `payment_succeeded`, `payment_failed`; `customer.subscription.updated`, `deleted`; `payment_intent.succeeded`, `payment_failed`, `canceled`; `charge.refunded`; `charge.dispute.created`, `updated`, `closed`. Los sufijos se anteponen a su familia completa. El receptor rechaza eventos no soportados y eventos Connect: esta integración utiliza una cuenta vendedora propia.

MP: tópicos `payment`, `subscription_preapproval`, `subscription_authorized_payment`, `topic_chargebacks_wh`. Se compara ID URL/body, conservando enteros largos del JSON en el parser Node 24. `body.id` no está firmado; la identidad de recepción es SHA-256 de ID de recurso, request ID y timestamp autenticados. No se deduplica permanentemente por pago. El SDK 3.6.1 no normaliza alfanuméricos ni tolerancia de milisegundos: se normaliza el ID antes del SDK y se verifica frescura sobre el `ts` original autenticado, aceptando segundos o milisegundos documentados.

**Particularidad MP:** la guía general excluye Suscripciones de la configuración estándar del dashboard, pero la documentación de tópicos sí exige habilitar sus eventos; la referencia `/preapproval` y SDK 3.6.1 no declaran `notification_url`. El adaptador no envía ese campo no documentado. Configurar el mecanismo de Suscripciones que la cuenta de prueba soporte y comprobar firma/eventos consultables antes de aceptación; si la cuenta no los ofrece, la reconciliación ya cubre consulta de adhesiones, facturas y pagos. No afirmar que quedó validada una entrega sandbox por un POST sintético local.

## Devoluciones y disputas

Se consultan, no se emiten. Stripe obtiene refunds y disputes asociados al charge; sólo `lost` confirma contracargo. MP consulta refunds y casos por pago: `coverage_applied=null` conserva el período, `false` confirma pérdida, `true` conserva acceso. No interpretar `documentation_status` como resolución financiera ni asumir `charged_back` aislado como prueba de pérdida definitiva. Parcial conserva duración; total/pérdida confirmada revoca únicamente su período.

El cliente Chargeback de SDK MP 3.6.1 refleja un contrato anterior y no expone `X-Caller-Id`. La excepción usa GET nativo a host fijo `api.mercadopago.com/v1/chargebacks`, headers requeridos, timeout 10 s, sin redirecciones y esquema estricto de respuesta vigente. No hay URL de proveedor suministrada por el usuario. Si cambian contratos, se deriva a revisión, sin acreditar por fallback.

## Simulación local

Sin claves reales. Inyectar `BILLING_MODE=simulation` y JSON con `returnUrl` local y `simulationKey` aleatoria externa, más `BILLING_SIMULATION_DATABASE_URL` apuntando a una BD local de pruebas migrada. Reservar cuentas sandbox con `configuration_key=BILLING_SIMULATION`; nunca compartir esa cuenta/BD con un sandbox externo. El worker automático no arranca en este modo.

CLI explícita, una operación checkout existente y operador concedido por la CLI de fase 2:

```bash
npx ts-node apps/api/src/modules/billing/simulation.cli.ts \
  UUID_OPERADOR UUID_OPERACION approved 2026-10-20T00:00:00.000Z ciclo_1 --apply
```

Escenarios: `pending`, `approved`, `rejected`, `partial_refund`, `full_refund`, `chargeback`. La fecha es el reloj controlado; conservar el mismo ciclo para sucesivas observaciones de un mismo pago, otro ciclo para renovación. La CLI valida modo, cuenta y operador por BD; firma el recurso simulado y lo persiste en inbox antes de procesarlo. Puede reanudarse tras reemplazar el proceso porque su estado está firmado en el recurso durable. Los fixtures de fase 1 siguen excluidos del build; este adaptador runtime sólo se compone en modo simulación no productivo.

## Fuentes consultadas el 2026-10-20

- [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create), [webhooks](https://docs.stripe.com/webhooks), [invoices](https://docs.stripe.com/api/invoices/object), [límites de moneda](https://docs.stripe.com/currencies).
- [MP adhesión pendiente](https://www.mercadopago.com.ar/developers/en/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments), [referencia preapproval](https://www.mercadopago.com.ar/developers/en/reference/online-payments/subscriptions/create-preapproval/post), [webhooks](https://www.mercadopago.com.ar/developers/en/docs/your-integrations/notifications/webhooks), [tópicos](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/additional-info).
- [MP búsqueda de contracargos](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-api/chargebacks/search-chargebacks/get), [resolución de contracargos](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/chargebacks/management).

La evidencia de pruebas y los pendientes de aceptación se registran en el [plan HITL](../plan/2026-10-20_feat-billing-subscriptions.md). No se configuraron credenciales, recursos externos, cobros, entrega o producción.
