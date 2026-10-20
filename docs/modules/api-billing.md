# Billing: contratos y diseño

**Estado 2026-10-20:** fase 1 del [plan HITL](../plan/2026-10-20_feat-billing-subscriptions.md). Implementados contratos Zod, decisiones puras y simuladores de tests. **No hay endpoints, SDKs, tablas aplicadas, cobros, restricciones comerciales ni pantallas activas.** El [SQL](../plan/2026-10-20_feat-billing-subscriptions_oltp-borrador.sql) es un borrador revisable; no sustituye `schema.prisma`.

## 1. Autoridades y capacidades

La plataforma es el vendedor; cada tenant compra acceso al CMS. Una cuenta vendedora por proveedor/ambiente, configurada por el operador; no OAuth marketplace ni fondos de tenants. La pertenencia se resuelve desde entidades locales y cuenta esperada, nunca desde un `tenant_id` del webhook o navegador.

| Capacidad           | Stripe/USD                                    | Mercado Pago/ARS                                                                 |
| ------------------- | --------------------------------------------- | -------------------------------------------------------------------------------- |
| Período manual      | Checkout alojado, pago único                  | Checkout Pro vía Preferences                                                     |
| Recurrencia         | Checkout + Billing                            | Suscripciones `/preapproval`, adhesión con `pending` y checkout alojado          |
| Catálogo            | Producto/precio vinculado a versión local     | Términos locales por suscripción sin plan asociado; no confundir con Preferences |
| Prueba              | Local, sin tarjeta; no crear trial remoto     | Local, sin tarjeta; no crear trial remoto                                        |
| Cambio              | Detener renovación y nueva adhesión al vencer | Detener renovación y nueva adhesión al vencer                                    |
| Reembolsos/disputas | Observar y reconciliar                        | Observar y reconciliar                                                           |

Los métodos exactos los presenta el proveedor según cuenta, país, moneda, dispositivo y modalidad. No publicar una lista estática prometiendo soporte universal. No interpretar cuotas de tarjeta como renovación de una suscripción. No integrar Orders/Bricks/QR por analogía con Preferences/preapproval.

Fuentes oficiales consultadas el 2026-10-20: [compatibilidad Stripe](https://docs.stripe.com/payments/payment-methods/payment-method-support), [Checkout](https://docs.stripe.com/checkout/quickstart), [webhooks Stripe](https://docs.stripe.com/webhooks), [adhesión MP](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-configuration/subscription-no-associated-plan/pending-payments), [gestión MP](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/subscription-management), [webhooks MP](https://www.mercadopago.com.ar/developers/es/docs/your-integrations/notifications/webhooks), [prueba MP](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-test/payment-approval), [test clocks Stripe](https://docs.stripe.com/billing/testing/test-clocks). Revalidar endpoints, SDK, firma e idempotencia por operación al implementar fase 3. MP documenta particularidades de configuración de notificaciones para Suscripciones: comprobar ese flujo específico en sandbox, sin asumir que el dashboard genérico o una simulación de webhook acredita la adhesión.

## 2. Modelo relacional propuesto

### Catálogo y autoridad global

`billing_plans` identifica el producto; `billing_plan_versions` guarda nombre, condiciones, prestaciones, cuotas, días de prueba/gracia y revisión optimista. `billing_prices` fija importe, moneda, proveedor, mensual/anual y modalidades. Editar borradores requiere revisión esperada; una versión publicada y sus precios no admiten modificación de términos o borrado mediante repositorio. Archivar conserva contratos, historial y renovaciones existentes, pero impide nuevas altas y trials.

`billing_provider_accounts` guarda vendedor/app esperados y nombre de configuración, **sin claves**; `billing_price_bindings` distingue pendiente/listo/error por cuenta. Publicar no equivale a sincronizar: una oferta se muestra sólo si cuenta habilitada y binding listo en el ambiente actual. Una caída de MP no impide ofrecer Stripe listo. Nuevas versiones no migran automáticamente contratos.

`billing_platform_operators` referencia un usuario existente y permite revocación. Alta/baja exclusivamente mediante CLI por UUID en fase 2, con auditoría. No es otro rol asignable desde `/users`; proteger modificaciones y eliminación de toda identidad con historial de operador frente a administradores tenant. Verificar usuario/tenant activos y membresía no revocada en cada operación; no confiar sólo en un claim de JWT. La UI obtiene capacidades de operador desde una consulta autenticada.

### Tenant y dinero

`billing_accounts` contiene opt-in y consumo de trial una vez por tenant, compartido entre ambientes. `billing_customers` vincula cliente remoto y cuenta del proveedor. No guardar tarjeta, CVV, token de tarjeta ni una copia del pagador. Cuando MP requiera `payer_email`, resolverlo desde el usuario autenticado en servidor; las pruebas deberán usar el comprador sintético esperado por el producto. No incluirlo en operaciones, logs o evidencia.

`billing_subscriptions` conserva versión/precio/modo/cuenta, ID remoto opcional, estado, ancla calendario y horizonte pago. El índice parcial permite una contratación abierta por tenant/ambiente, contando pendiente, activa, impaga y cancelación pendiente. Una cancelada conserva sus grants; impide nuevo checkout incompatible hasta que venza lo ya pagado. Un manual puede renovar el mismo contrato antes de vencer, sin crear otro contrato paralelo.

`billing_orders` representa una compra; `billing_obligations` el importe exigible de ese ciclo; `billing_payments` cada intento/recurso de pago observado. Renovaciones automáticas generan orden/obligación con identidad estable del ciclo del proveedor, no por llegada de cada evento. Un cambio de estado de un pago no crea otra obligación.

Dinero: `BIGINT` no negativo más moneda, precios/obligaciones estrictamente positivos. Wire: `{ "amountMinor": "1999", "currency": "USD" }`. Sólo ARS/USD, exponente 2 en v1. Se rechazan fracciones en unidades menores, negativos, notación exponencial, ceros iniciales y desbordamiento de int64. La conversión a unidades mayores devuelve texto decimal exacto, nunca `Number`; cada adaptador validará límites más estrechos y la serialización oficial de su endpoint. La biblioteca monetaria no certifica límites comerciales de Stripe/MP.

`billing_access_periods` une cobertura y fuente; unicidad por obligación paga y por tenant para trial. Un pago adicional para la misma obligación se registra y alerta sin crear otro grant. `billing_adjustments` observa reembolsos/disputas por identidad externa, sin emitirlos. `billing_subscription_changes` programa cambio/nueva adhesión. `billing_audit` guarda acción, estados, IDs y correlación minimizados, no cuerpos arbitrarios.

`billing_operations` coordina trabajo remoto e idempotencia por tenant/cuenta/tipo/clave, también sincronización global con tenant nulo. `request_data` sólo contiene parámetros internos permitidos y condiciones monetarias; sin credenciales, pagador ni firmas. No reutilizar el servicio actual de idempotencia que mantiene una transacción durante el callback para llamadas remotas. Persistir intención → cerrar transacción → llamar al proveedor → persistir resultado condicional por lease.

`billing_webhook_inbox` deduplica por cuenta e identidad de evento; se recibe antes de conocer el tenant y se resuelve la pertenencia al consultar el recurso. En MP `data.id` identifica recurso, no evento. Conservar identidad de notificación y topic, sin suprimir futuras actualizaciones del mismo recurso. Si falta la identidad exigida por el contrato del adaptador, no inventar una identidad permanente por pago: rechazar y recuperar mediante reconciliación.

Las entidades financieras usan ambiente explícito. Las FK compuestas refuerzan tenant/ambiente/cuenta; el repositorio debe verificar además consistencia de orden/suscripción/precio/moneda/modo y snapshot contractual. Las tablas globales y el inbox no requieren un tenant ficticio. No hay nuevas políticas RLS.

## 3. Reglas, estados y recuperación

### Acceso y cuotas

Los períodos son intervalos UTC `[inicio, fin)`. Período mensual/anual significa calendario, no 30/365 días. Pagos manuales tempranos extienden desde el horizonte pago; se conserva ancla original (31 enero → último febrero → 31 marzo). Pago tardío reinicia ancla en su fecha. Para automático prevalecen las fechas comprobadas del proveedor, no un mes calculado localmente.

La prueba se solicita expresamente para una versión publicada con `trialDays > 0`; consumo y grant se escriben en una transacción bloqueando la cuenta. Sin repetirla al cambiar de plan, proveedor, usuario o ambiente. Pago confirmado revoca el trial activo y concede su período pago en el mismo commit. Checkout pendiente no termina la prueba. El estado de suscripción remoto `authorized` por sí solo no acredita dinero ni acceso.

Con control apagado se conserva el CMS previo; permisos/flags técnicos siguen vigentes. Encendido: sin períodos, sólo lectura; paid activo prevalece sobre trial; al finalizar paid, gracia configurada, luego lectura. Sin gracia para trial, primer pago pendiente o período revocado. Un reembolso del último período no resucita gracia del anterior. Un grant futuro no habilita acceso antes del inicio.

Para escritura: acceso comercial habilitado AND RBAC AND prestación del plan AND flag técnico si existe. Lectura histórica y galerías publicadas se conservan al perder prestación/acceso. Operaciones de sesión/facturación/revocación siempre alcanzables. `hasFeature` decide prestación, no reemplaza la política de mutación ni autorización de rutas. Para recursos nuevos sin flag propio, el permiso técnico proviene del control de disponibilidad del módulo; no agregar flags editables que otorguen prestaciones.

Cuotas 0/positivo/null; administrador incluido en usuarios, rechazados/borradores incluidos en testimonios. Crear/reactivar consume capacidad; eliminar/desactivar libera. Rotar cuenta como reemplazo de una key. Lectura nunca ejecuta `assertQuota`; limpiar recursos por encima del límite sigue permitido cuando hay acceso de escritura. La función pura no garantiza concurrencia: bloquear la misma cuenta, volver a contar en PostgreSQL y escribir bajo esa transacción; no usar un guard que mida y escriba después sin lock. Aplicar también a captura anónima resolviendo tenant desde slug confiable.

### Estados mínimos

| Recurso     | Evolución y efectos                                                                                                                                   |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión     | draft → published → archived; términos publicados inmutables                                                                                          |
| Suscripción | pending → active/past_due; active/past_due → cancel_pending → canceled; manual agotada → ended                                                        |
| Cambio      | requested → cancel_pending → awaiting_checkout → completed; cancelar intención no reactiva débitos automáticamente                                    |
| Operación   | ready → processing → succeeded/uncertain/review; lease perdido no puede confirmar; consulta antes de recrear                                          |
| Pago        | pending/failed/canceled → succeeded; no degradar éxito por notificación tardía; refunds acumulados monotónicos y chargeback confirmado terminal en v1 |
| Grant       | creado una vez por obligación pagada; revocado sólo por su pago o sustitución del trial; no borrar historial                                          |

El reducer recibe **observaciones actuales normalizadas por un adaptador tras consulta autenticada**, nunca cuerpos de webhook o parámetros del retorno. Comprueba tenant, cuenta, proveedor, ambiente, referencia, obligación, importe y moneda. Cero en devolución es válido, parcial conserva acceso, total/contracargo confirmado lo revoca. `accessEffect` es una decisión pura: fase 2 debe persistirla junto con el pago y auditoría bajo lock por obligación. No acredita exactly once distribuido por sí misma.

Cambiar de plan/proveedor/modalidad: confirmar baja de renovación anterior, guardar intención y horizonte; nuevo checkout sólo cuando venza cobertura, con nueva aprobación del cliente. No transferir credenciales. Si la cancelación no está confirmada, el cambio permanece pendiente. La cancelación sola no reembolsa y conserva tiempo pago; UI debe advertir si hay un cobro ya en curso que requiere reconciliación.

### Recepción y reconciliación previstas para fase 3

Los webhooks autentican por proveedor; Stripe requiere bytes originales y MP su manifest documentado. Rutas exactas con modo CSRF específico de webhook que ignora cookies y exige firma; no reutilizar un bypass de API key ni desactivar CSRF globalmente. API limita tamaño y no registra cuerpo, query con IDs de pagador, firmas ni secretos. Llegan directo a NestJS: el proxy Next actual no reenvía los headers de firma y debe conservar esa allowlist salvo cambio específico probado.

Persistir inbox verificado antes de ACK 2xx. Fallo de persistencia → no ACK. Poller durable reclama con SKIP LOCKED y lease/fencing; reutilizar patrón PostgreSQL, no la misma tabla de entregas salientes. Consulta el recurso de cuenta esperada y aplica efectos de negocio una vez. Estado desconocido o asociación incorrecta → revisión, nunca paid.

Defaults operativos internos propuestos: polling 3 s, lote 10, concurrencia 2, timeout HTTP 10 s, lease 60 s renovado cada 20 s; trabajo sin lease no publica. Backoff con jitter y máximo 10 intentos automáticos antes de revisión. Un timeout de creación no autoriza recrear automáticamente; consultar por referencia/operación y paginar. La ausencia temporal en una búsqueda no demuestra ausencia de cobro.

Reconciliación acotada: incertidumbres elegibles en el siguiente ciclo; pagos pendientes con `next_check_at` según vencimiento/método devuelto por proveedor; fallback de consulta 15 min, nunca aprobación por tiempo. Revisar renovaciones al llegar fecha esperada y después de fallos de webhooks; barrido diario paginado de contratos abiertos para cancelaciones/devoluciones/disputas. Límites/respuestas 429 respetan Retry-After. El procesamiento no llama APIs de cobro para renovar: sólo los proveedores crean los débitos. Agotar reintentos deja discrepancia visible y replay explícito del operador, con la identidad original.

## 4. Contrato HTTP previsto (no registrado)

Prefijo `/api/v1`. JSON estricto; rechazar campos extra. Respuestas existentes `{data, meta?}`; listas paginadas `page/limit` con máximo 100, orden estable por fecha e ID. Fechas ISO UTC; importes como cadena. `Idempotency-Key` obligatorio en todos los POST mutantes de billing y plataforma; también en PATCH que sincronice con proveedor. Mismo ámbito/clave y otro hash → 409; retry compatible devuelve la operación original, no repite efecto. Lectura de historial y DTOs nunca serializan Prisma directamente.

| Método/ruta                                       | Actor                    | Entrada / resultado bajo `data`                                                            |
| ------------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| GET `/billing/entitlements`                       | admin/editor del tenant  | modo de acceso, prestaciones efectivas, cuotas y uso; sin datos financieros de terceros    |
| GET `/billing/catalog`                            | admin                    | versiones publicadas y ofertas listas del ambiente; precio/local ID, funciones/cuotas      |
| GET `/billing/summary`                            | admin                    | versión contratada, modalidad, estado, período, gracia, trial consumido y cambio pendiente |
| POST `/billing/trial`                             | admin                    | `{planVersionId}`; 201 trial vigente, idempotente                                          |
| POST `/billing/checkouts`                         | admin                    | `{priceId, mode}`; 202 `{operationId}`                                                     |
| GET `/billing/operations/:id`                     | admin del tenant         | `{id, status, redirectUrl?, errorCode?}`; URL sólo validada contra origen oficial esperado |
| POST `/billing/subscription/cancel`               | admin                    | `{}`; 202 operación de cese de renovación                                                  |
| POST `/billing/subscription/change`               | admin                    | `{priceId, mode}`; 202 operación/intención, no checkout anticipado                         |
| GET `/billing/payments`                           | admin                    | historial paginado con importes, devoluciones y estado normalizado                         |
| GET `/billing/capabilities`                       | autenticado              | `{platformBillingOperator: boolean}` obtenido de BD                                        |
| GET/POST `/platform/billing/plans`                | operador                 | catálogo global / `{code}` crea producto draft                                             |
| POST `/platform/billing/plans/:id/versions`       | operador                 | `PlanVersionDraft`; 201 versión nueva                                                      |
| PATCH `/platform/billing/versions/:id`            | operador                 | `{expectedRevision, draft: PlanVersionDraft}`; sólo draft                                  |
| POST `/platform/billing/versions/:id/publish`     | operador                 | `{expectedRevision}`; publica términos y encola sincronización                             |
| POST `/platform/billing/versions/:id/archive`     | operador                 | `{expectedRevision}`; archiva sin modificar términos                                       |
| GET `/platform/billing/providers`                 | operador                 | disponibilidad/configuración no secreta y cuenta esperada                                  |
| GET `/platform/billing/operations`                | operador                 | operaciones/discrepancias paginadas, filtro tenant explícito autorizado                    |
| POST `/platform/billing/operations/:id/reconcile` | operador                 | `{}`; 202 reconciliación/replay auditado                                                   |
| PATCH `/platform/billing/tenants/:id/policy`      | operador                 | `{enforcementEnabled, expectedRevision}`; no lo configura admin tenant                     |
| POST `/billing/webhooks/stripe` y `/mercadopago`  | autenticación específica | ACK sólo tras inbox durable; no sesión ni precio del caller                                |

Checkout/trial nunca reciben tenant, vendedor, importe, moneda, días, ambiente o URLs del cliente. Fuente del importe: precio publicado aceptado y listo, modo permitido, cuenta habilitada y ambiente del servidor. `PlanVersionDraft` requiere todos los booleanos/cuotas y 1–4 precios únicos proveedor/moneda/período, importes positivos, modalidades únicas, trial/gracia enteros no negativos; gracia omitida → 7. Días acotados a INTEGER PostgreSQL; el dominio además valida fecha resultante. Código del plan: slug ASCII ≤64; name ≤120, description ≤2000. BI estadístico requiere BI. Una cuota de usuarios cero impide nuevas altas, pero conserva al admin ya existente y su facturación.

Errores a traducir mediante el filtro actual en fases 2/3: input inválido 400; sesión 401; RBAC/operador/feature 403; recurso no visible 404; transición/revisión/idempotencia/cuota 409; límite técnico 429; proveedor/configuración temporalmente indisponibles 503. Fallo financiero se informa como estado del pago, no como 500. Lecturas/mutaciones privadas `no-store`; nunca cachear el resultado de otro tenant/ambiente.

## 5. UI, configuración y aceptación pendientes

Pantallas previstas `/admin/billing` y `/platform/billing`; composición delgada en app y adaptación HTTP en features. Operador ve catálogo y revisión de incidencias; admin tenant ve catálogo, comparación, uso, prueba, pago/adhesión, cancelación y cambio. Editor sólo prestaciones/avisos necesarios. El frontend no concede permisos. Retorno ignora `status`/`payment_id` del navegador como autoridad; consulta operación/summary propia. Sondeo acotado a 60 s, luego botón para actualizar; pago pendiente se presenta sin afirmar rechazo. Sin forms de tarjetas en CMS.

Configuración futura: `BILLING_MODE=disabled|simulation|sandbox|live`, default disabled, ambiente separado y control opt-in por tenant. Los fixtures actuales **no implementan el modo runtime simulation**: fase 3 deberá conectar un harness explícito no productivo o implementar su composición segura, sin importar `test/**`. Secretos externos por ambiente, vendedor esperado y webhook secret separados de access token; nombres definitivos al agregar validación config. En disabled el arranque no exige claves ni consulta tablas billing. La elegibilidad comercial, HTTPS y habilitación de métodos no se resuelven pegando una API key.

Plan de aceptación por riesgo: identidad/precio manipulado; dos tenants y operador independiente; contención de cuotas en BD; eventos duplicados/desordenados; pérdida antes/después de ACK; timeout después del posible cobro; búsqueda sin webhook; trial único; cambio con cancelación incierta; gracia; refund/chargeback; rotación y downgrade; lectura/galerías preservadas. Simuladores representan puertos sin red y reloj local: no validan firmas, SDKs, BD, procesos reiniciados, sandbox externo o cobros recurrentes de MP. La evidencia se registra por fase y ambiente sin secretos ni PII.
