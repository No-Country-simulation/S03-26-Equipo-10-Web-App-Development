# Aceptación de facturación: local y sandbox externo

Estado: fase 5. El usuario indicó el 2026-10-21 que todavía no dispone de cuentas/claves de prueba y pidió dejar preparada la aceptación externa. **No se ejecutaron pagos ni renovaciones en Stripe o Mercado Pago.** La evidencia local, las integraciones de adaptadores y la aceptación externa son evidencias distintas. `live` permanece rechazado; facturación omisa sigue deshabilitada.

## Aceptación local reproducible

Requiere Node/npm del repositorio, dependencias instaladas, PostgreSQL 18 (`initdb`, `postgres`, `createdb`, `pg_isready`), Redis 7, OpenSSL y Chromium/Chrome. No requiere Docker ni claves financieras. El runner no acepta URLs de servicios existentes: crea sus propios servidores, puertos loopback, base, directorio privado, certificados y credenciales sintéticas. Comprueba `data_directory`, nombre de base, marcador de propiedad y PID Redis antes de migrar. Rechaza archivos `.env` locales para evitar cargar credenciales por accidente. El flag de migración sólo se usa tras el ACK humano específico exigido por AGENTS.md.

```bash
E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 \
BILLING_E2E_REDIS_EXECUTABLE=/ruta/al/redis-server \
BILLING_E2E_CHROME_EXECUTABLE=/ruta/al/chrome \
node scripts/billing/acceptance-local.mjs --run

E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 \
BILLING_E2E_REDIS_EXECUTABLE=/ruta/al/redis-server \
BILLING_E2E_CHROME_EXECUTABLE=/ruta/al/chrome \
node scripts/billing/acceptance-local.mjs --run --regression

E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 \
BILLING_E2E_REDIS_EXECUTABLE=/ruta/al/redis-server \
node scripts/billing/acceptance-local.mjs --run --api-checks
```

`--run`: NestJS compilado con `NODE_ENV=test` para habilitar el simulador; Next standalone de producción y proxy HTTPS del mismo origen. Las cookies son las del entorno test del backend: esto no certifica las cookies Secure de producción. La API usa un rol de prueba con DML, membresías de operador sólo SELECT y auditoría append-only; la CLI de concesión usa otra conexión de preparación. Se registra el operador mediante HTTP real y se concede su permiso mediante CLI con UUID. Se publica/sincroniza un catálogo sintético y se reinicia la API conservando el ledger antes de abrir el navegador. No se interceptan ni reemplazan respuestas de la aplicación.

Cinco casos obligatorios, un worker y cero reintentos: catálogo/permisos/idempotencia; Stripe manual/prueba/cuota/devolución; MP automático/renovación simulada/cancelación; retorno manipulado/rechazo/recuperación; móvil de 390px/foco/errores. La cuenta administradora consume la cuota de usuarios. Una renovación simulada no demuestra un débito sandbox.

`--regression`: seis recorridos críticos existentes, API compilada en producción y billing deshabilitado. `--run --api-checks` ejecuta por separado toda la regresión Jest con PostgreSQL/Redis propios, sin compilar ni abrir navegador. Mantiene el reporter y la matriz original. No reemplaza la construcción/verificación de imágenes Docker de CI. Las suites de BI que necesitan otro servidor OLAP/DDL requieren su harness específico; los conteos indican los casos omitidos.

Evidencia saneada en `apps/web/.e2e-results/billing/{environment,results}.json` y `apps/web/.e2e-results/{environment,results}.json` y `apps/web/.e2e-results/billing-api/api-regression.json`. Sólo estados, identificadores de caso permitidos, versiones y conteos; sin sesiones, headers, capturas, trazas, cuerpos ni URLs de checkout. Los recursos privados se eliminan al terminar y las fallas de limpieza fallan la ejecución. No copiar resultados crudos de proveedores a documentos. `failures.json` conserva únicamente archivos/líneas permitidos de errores saneados.

## Worker explícito para operación local

Inyectar desde el gestor externo `BILLING_MODE`, `BILLING_CONFIG_JSON` y `BILLING_WORKER_DATABASE_URL` (BD migrada propia del entorno). Conceder previamente operador mediante la CLI documentada en la guía 32. Ejecutar desde la raíz:

```bash
npx ts-node apps/api/src/modules/billing/worker.cli.ts --once UUID_OPERADOR --apply
# Con la API compilada:
node apps/api/dist/modules/billing/worker.cli.js --once UUID_OPERADOR --apply
```

Comprueba el operador vigente en BD y ejecuta una vuelta acotada con los leases/fencing normales. En simulación sólo reclama cuentas sandbox habilitadas con referencia `BILLING_SIMULATION`; en sandbox usa las cuentas declaradas en configuración. Repetir para vaciar más de una tanda o reintentos cuya fecha ya venció. No adelanta el reloj, no fuerza leases y no genera débitos recurrentes. El polling automático de sandbox ya ejecuta el mismo procesador; esta CLI no necesita otro scheduler.

## Preparación del sandbox externo

Usar una BD y cuentas separadas del simulador. Nunca copiar bindings o referencias `BILLING_SIMULATION`. Aplicar migraciones persistentes sólo con su autorización específica; el ACK de PostgreSQL descartable no las autoriza.

1. Preparar HTTPS de frontend y API NestJS. `returnUrl` termina en `/admin/billing/return`; `notificationUrl` apunta directamente a `/api/v1/billing/webhooks/mercadopago`. Stripe también entrega directamente a `/api/v1/billing/webhooks/stripe`. No enviar firmas financieras al proxy Next.
2. Preparar Stripe sandbox con cuenta esperada `acct_…`, clave test, secreto de firma del endpoint y eventos de la guía 33. Preparar aplicación MP Argentina con vendedor **de prueba MLA**, comprador de prueba separado, access token del vendedor, ID de aplicación y secreto de firma. Confirmar elegibilidad de Suscripciones en esa cuenta.
3. Inyectar `BILLING_MODE=sandbox` y `BILLING_CONFIG_JSON` mediante gestor de secretos. El contrato exacto es [billing.config.ts](../../apps/api/src/modules/billing/integrations/billing.config.ts). Campos globales: `returnUrl`, `notificationUrl`, opcional `mpSignatureToleranceSeconds`. Cada proveedor: `accountId`, `sellerId`, `credential`, `webhookSecrets`, `resourceLiveMode`; MP además `applicationId` cuando corresponda. Stripe requiere `resourceLiveMode=false`; MP exige el valor esperado de los recursos de su vendedor de prueba. No deducirlo del formato del token.
4. Crear/conceder operador por CLI. Registrar desde `/platform/billing` las cuentas esperadas y sus referencias no secretas (`BILLING_STRIPE_SANDBOX`, `BILLING_MP_SANDBOX`). Para una cuenta nueva, reservar un UUID local mediante `crypto.randomUUID()` e inyectarlo como `accountId`: el alta del panel persiste exactamente ese UUID desde la configuración del servidor. Para una cuenta existente, usar su UUID registrado; no reutilizar identidades de otro ambiente.
5. Publicar versiones y precios sintéticos independientes USD/ARS. Sincronizar y comprobar que las ofertas estén listas, sin operaciones en revisión. La validación remota comprueba vendedor y ambiente; una clave válida no basta. Activar la política comercial sólo para tenants de aceptación.
6. Utilizar compradores y datos de prueba de la documentación oficial. Completar los checkouts alojados de forma interactiva; no automatizar los formularios antifraude del proveedor. El CMS nunca recibe datos de tarjeta.

El backend usa el email del primer administrador activo del tenant como pagador MP. La cuenta de aceptación debe usar el comprador de prueba correspondiente. Los métodos se anotan por proveedor, país, moneda y modalidad; no prometer todos los métodos de un pago único para renovación automática. Ver [compatibilidad Stripe](https://docs.stripe.com/payments/payment-methods/payment-method-support), [compras Checkout Pro](https://www.mercadopago.com.ar/developers/es/docs/checkout-pro-preferences/integration-test/test-purchases) y [compras Suscripciones MP](https://www.mercadopago.com.ar/developers/es/docs/subscriptions/integration-test/payment-approval).

## Matriz externa por ejecutar

Todos los renglones siguientes están **pendientes**, no aprobados por simulación. Usar tenants independientes y mantener sólo evidencia saneada en una copia de esta matriz: fecha UTC, commit, proveedor, moneda/modalidad, resultado, cardinalidades locales, código estático de discrepancia. Los IDs remotos necesarios para operar se conservan en el ledger y en los dashboards, sin copiar URLs, PII ni payloads a contexto.

| Caso | Acción externa | Criterio de aceptación |
| --- | --- | --- |
| Stripe USD manual | Checkout aprobado, rechazado y método asíncrono disponible | Retorno no concede; consulta autenticada y pago exacto conceden un período; rechazo no concede |
| MP ARS manual | Checkout Pro con comprador de prueba | Vendedor, aplicación, referencia, importe/moneda coinciden; un período por obligación |
| Stripe USD automático | Adhesión y renovación aprobada/rechazada | Contrato y factura reales; ciclo único; rechazo no extiende; aprobación posterior recupera |
| MP ARS automático | Adhesión pendiente y débitos autorizados posteriores | Validar `debit_date`, ancla mensual/anual y búsqueda paginada de pagos; no inferir recurrencia desde Preferences |
| Cancelación | Detener desde el CMS y comprobar estado remoto | Incertidumbre conserva `cancel_pending`; confirmación detiene renovación y conserva cobertura pagada |
| Cambio | Solicitar plan/moneda/proveedor/modo distinto | Espera fin de cobertura y cancelación confirmada; requiere nueva adhesión sin prorrateo |
| Webhook/replay | Entrega firmada real, duplicado, desorden y pérdida temporal | Inbox durable antes del ACK, acceso único; polling recupera pérdida sin segundo POST de cobro |
| Recuperación | Reiniciar API/worker tras envío y antes de confirmación | Se consulta la identidad durable; sin duplicar checkout/débito; agotamiento pasa a revisión |
| Devoluciones/disputas | Gestionarlas en dashboard/API del proveedor | Parcial conserva duración; total/pérdida confirmada invalida sólo su período; registrar lo realmente soportado |
| Gracia y cuotas | Renovación fallida de período previamente pago, recuperación y reducción | Gracia configurada; prueba sin gracia; conserva datos y contenido publicado; bloquea altas/activaciones sobre cuota |

### Stripe Simulations / test clocks

La [guía oficial de Simulations](https://docs.stripe.com/billing/testing/test-clocks/simulate-subscriptions) permite seleccionar una suscripción elegible en sandbox, ejecutar la simulación y avanzar el tiempo, como máximo dos intervalos por avance. Comprobar primero que el cliente creado por Checkout sea elegible; no asumir que cualquier contrato admite el botón. Registrar el `test_clock` y sus eventos en el entorno de prueba y esperar su estado estable antes de evaluar renovaciones. El CMS no crea clientes con `test_clock` ni modifica intervalos sólo para acelerar pruebas.

Si la cuenta no permite simular ese contrato, dejar su renovación pendiente hasta observar un débito real de prueba o preparar un harness sandbox específico revisado. No reemplazarlo por eventos `stripe trigger`, editar el ledger o usar el reloj del simulador local como aprobación. Las fechas de acceso futuras del reloj del proveedor no adelantan el reloj del CMS: la política temporal se contrasta con sus pruebas de dominio controladas, además de verificar la factura/renovación externa. Ver [referencia Test Clocks](https://docs.stripe.com/api/test_clocks).

MP no se considera poseedor de un equivalente a test clocks en esta implementación. Esperar y consultar el ciclo que efectivamente emita su sandbox; si no lo emite, declarar pendiente. Las notificaciones de Suscripciones tienen particularidades documentadas en la guía 33: comprobar el mecanismo que ofrezca la cuenta; la reconciliación cubre consultas, pero no acredita una entrega firmada que no ocurrió.

## Cierre y recuperación

Revisar `/platform/billing`: pendientes antiguos, operaciones inciertas, leases, reintentos agotados, pagos adicionales y discrepancias. El replay conserva identidad; nunca borrar una operación incierta para volver a cobrar. Resolver en proveedor y reconciliar antes de pedir otra adhesión. Detener renovaciones de aceptación en los proveedores y comprobar confirmación antes de deshabilitar sus cuentas locales; deshabilitar una cuenta en CMS no cancela débitos remotos. Revocar/rotar las claves de prueba cuando corresponda. La salida a producción requiere aceptación externa y trabajo/autorización separados.

Documentación oficial revalidada el 2026-10-21. Completar resultados en el [plan HITL](../plan/2026-10-20_feat-billing-subscriptions.md); no convertir esta preparación en evidencia de sandbox aprobado.
