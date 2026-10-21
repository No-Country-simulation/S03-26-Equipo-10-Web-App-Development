# Pagos y suscripciones del Testimonial CMS

## Contexto y Restricciones

- Solicitud y decisiones del usuario del 2026-10-20: el CMS cobra a sus tenants; Stripe/USD y Mercado Pago Argentina/ARS; catálogo propio; mensual/anual; prueba sin tarjeta una vez por tenant; funciones y cuotas; pago automático o manual; nueva adhesión para cambios, sin prorrateos.
- Rama `codex/billing-subscriptions`, creada y seleccionada antes de modificar archivos desde `codex/fix-sprintf-js-dependency`, base `aead37c10de2a3345c2ed47ff2fc3ccc69e98d02`. Árbol inicialmente limpio.
- Aplican [AGENTS.md](../../AGENTS.md), [payments-engineering](../../.agents/skills/payments-engineering/SKILL.md), [mercadopago-api](../../.agents/skills/mercadopago-api/SKILL.md), [testing-tdd-engineering](../../.agents/skills/testing-tdd-engineering/SKILL.md) y las reglas PostgreSQL. Ejecutar sólo la fase actual; detenerse con commit sugerido y esperar ACK entre fases.
- Fase 1 cerrada por ACK «Continuar» del 2026-10-20. Ese ACK, recibido tras explicitar Prisma y migraciones descartables en el cierre, autoriza la fase 2: esquema, migración aditiva sólo en PostgreSQL descartable propio, repositorios y operadores. No habilita SDKs, controladores financieros, cobros ni fases 3–5.
- Cambiar `schema.prisma` y ejecutar migraciones descartables requieren ACK específico de fase 2. Infraestructura, raíz npm y hooks permanecen fuera de este cambio. Sin secretos, tarjetas, firmas ni PII en contexto o evidencias.
- NestJS/Prisma 6.5/PostgreSQL; aislamiento lógico por tenant, sin RLS; procesamiento durable por polling PostgreSQL, sin nueva cola o servicio. Conservar sesión, CSRF, Redis para cuotas técnicas y caché, y el ledger saliente existente.

## Resultado esperado

Contratar y renovar acceso al CMS mediante checkouts alojados; administrar catálogo y operaciones desde UI propia. Stripe no incorpora MP como billetera/pasarela: son adaptadores independientes. No prometer todos los métodos en todas las monedas o para recurrencia. Sin marketplace, consumo medido, cupones, prorrateos, cambio de tarjetas entre proveedores, reembolsos iniciados desde el CMS ni facturación fiscal.

- Catálogo global con versiones comerciales inmutables; precios ARS/USD independientes. Los contratos retienen la versión aceptada; publicar otra no altera suscripciones existentes.
- Funciones: media, analytics, scoring, business_intelligence, bi_statistics, api_keys y webhooks. Testimonios básicos siempre incluidos; bi_statistics requiere business_intelligence.
- Cuotas: usuarios activos incluyendo administrador; testimonios almacenados en cualquier estado; API keys vigentes; destinos webhook activos. Cero es válido; `null` significa sin límite. No reinicios mensuales ni sobrecargos. Desactivar/borrar libera capacidad; rotar reemplaza una credencial sin consumir dos cupos. Degradar no elimina datos.
- Prueba configurable (0 deshabilita), una vez por tenant y compartida entre ambientes; elegir versión publicada y comenzar expresamente. No concede nuevos trials cambiar moneda/plan/proveedor. Pagar termina la prueba sólo cuando se confirma el pago.
- Gracia default siete días, configurable por versión comercial, únicamente tras un período pago no revocado. Renovación manual del mismo contrato extiende desde `max(paidThrough, paidAt)` con ancla calendario UTC; recurrencia usa los períodos comprobados del proveedor.
- El control de acceso está apagado por defecto y es opt-in por tenant. Encendido: prueba/pago/gracia permiten mutaciones; sin cobertura queda lectura. Sesión, facturación y revocación siguen disponibles; galerías publicadas permanecen. RBAC y flags técnicos se aplican también con control comercial apagado.
- Funciones fuera del plan: negar nuevos usos/ejecuciones, detener nuevas entregas/tracking/ETL opcionales; conservar datos e historial consultable y contenido ya publicado. No purgar mensajes salientes durables: esperar habilitación y mostrar estado suspendido. Revocación de API keys/destinos siempre disponible. Detallar conexión y pruebas en fase 4.
- Cambios: registrar intención, confirmar cese de renovación remota, conservar lo pagado; nuevo checkout al terminar la cobertura. Sin activar dos adhesiones. Si la baja es incierta no habilitar reemplazo. No llamar al proveedor por un retorno del navegador.
- Una devolución total o contracargo confirmado revoca sólo el período respaldado por ese pago; no abre gracia sobre él. Parcial conserva duración. Revertir una disputa o reasignar un cobro adicional requiere reconciliación operativa explícita, nunca un evento antiguo.

## Entregables y contratos

- [Contrato de dominio, API y operación](../modules/api-billing.md).
- [Modelo y borrador SQL no aplicado](./2026-10-20_feat-billing-subscriptions_oltp-borrador.sql).
- Dominio puro y esquemas en `apps/api/src/modules/billing/`, sin dependencias de Nest/Prisma/proveedores, sin importación desde AppModule.
- Simulador exclusivamente en fixtures bajo `apps/api/test/`; no forma parte del build de producción. No acredita SDK, autenticación, atomicidad PostgreSQL ni sandbox.

## Fases HITL

### [Completada] 1. Contratos y diseño — aprobada

- [x] Especificar capacidades, estados, HTTP, permisos y modelo relacional; preparar SQL revisable sin aplicarlo.
- [x] Implementar dominio puro: dinero exacto, calendario, trial, gracia, funciones/cuotas y efectos idempotentes de observaciones financieras normalizadas.
- [x] Preparar contratos de adaptadores y simuladores deterministas sin red, claves ni datos personales.
- [x] Probar reglas con oráculos independientes, casos negativos y escenarios de timeout/reconciliación. Typecheck, lint, build y comprobación estática de SQL/documentos.
- [x] Registrar evidencia y límites; detenerse con commit sugerido. No marcar fase 2 como actual sin ACK.

### [Completada] 2. Persistencia y permisos — aprobada

ACK explícito para editar Prisma y aplicar migraciones sólo sobre bases descartables identificadas. Migración aditiva desde el borrador revisado; repositorios transaccionales, pertenencia entre tenants y operadores independientes otorgados/revocados por CLI UUID. Comprobar protección de cuentas operadoras frente a endpoints tenant, revocación inmediata, unicidad de períodos y contención concurrente de cuotas. Validar DDL efectivo, restauración y cliente Prisma; no desplegar a entornos persistentes.

- [x] Recibir ACK «Continuar» del 2026-10-20 para esta fase, incluyendo Prisma y migración descartable.
- [x] Crear migración aditiva y 18 modelos Prisma; conservar el historial anterior y los contratos puros.
- [x] Implementar repositorios de catálogo, tenant/cuotas/trial, liquidación y operadores, módulo de composición sin registrar en AppModule y CLI manual.
- [x] Validar aislamiento, idempotencia local, concurrencia, privacidad, protección de identidades, restauración y privilegios limitados en PostgreSQL propio.
- [x] Ejecutar checks, registrar evidencia y detenerse sin avanzar a integración con proveedores.

### [Actual] 3. Integraciones financieras — implementada, pendiente de revisión/ACK

ACK «Continuar» del 2026-10-20, posterior al commit `7a19a70`, autoriza esta fase. Durante la validación, la revisión automática pidió especificidad adicional para `prisma migrate deploy`; el usuario respondió «Sí, autorizo migraciones sólo en el PostgreSQL descartable propio». El historial existente se aplicó sólo a ese servidor propio, sin editar esquema ni SQL. No autoriza la fase 4, cobros reales ni despliegues.

SDKs oficiales fijados en workspace API; verificar versiones y contratos vigentes antes de integrar. Stripe Checkout/Billing; MP Preferences y Suscripciones/preapproval, sin extrapolar Orders. Operaciones remotas fuera de transacciones, inbox durable, firmas, bytes originales, autenticación específica y reconciliación. Consultas validan cuenta/tenant/ambiente/referencia/importe/moneda. Pruebas de caída, duplicación y eventos desordenados. No confiar en el navegador ni introducir un segundo scheduler de débitos.

### [Pendiente] 4. Producto completo

Registrar API, configuración y pantallas en features; catálogo/operación para operador, facturación para admin tenant, prestaciones mínimas para editor. Funciones comerciales independientes de flags. Cuotas comprobadas junto a escrituras bajo lock por tenant, incluidos captura pública, reactivación y rotación. Control opt-in; prueba, gracia, lectura, historial y cambios con nueva adhesión. Móvil, foco, teclado, estados de error y regresión sesión/CSRF.

### [Pendiente] 5. Aceptación y preparación

E2E navegador/API/BD descartable y sandbox de ambos proveedores con credenciales externas. Stripe test clocks cuando corresponda; MP prueba de compra/adhesión según producto. No afirmar una renovación MP observada a partir de reloj local. Runbook de HTTPS, webhooks, cuentas esperadas, catálogo, métodos y claves; evidencia saneada y regresión de checks vigentes. Sin activación productiva ni recursos remotos creados implícitamente.

## Evidencia de fase 1

- **Implementado:** siete fuentes bajo `apps/api/src/modules/billing/`: tipos/errores, dinero exacto BigInt, calendario UTC con ancla, trial/acceso/cuotas/prestaciones, reducer de liquidación, esquemas Zod estrictos y puertos por capacidad. Sin importación desde AppModule, controladores o acceso a Prisma/red.
- **Implementado:** simulador de proveedor y reloj exclusivamente en fixtures de tests; lookup tras respuesta perdida, coordinación local de replays, aislamiento de referencias y snapshots. Son simuladores de puertos, no clientes Stripe/MP ni prueba de su idempotencia remota.
- **TDD observado:** 30 pruebas de dinero y 52 de política/liquidación fallaron funcionalmente antes de implementar las reglas (`BILLING_NOT_IMPLEMENTED` con interfaces presentes); después aprobaron. Las pruebas de esquemas y simulador se añadieron junto a su implementación y no se presentan como un ciclo Red observado. La revisión agregó el caso de período actual revocado que no debe recuperar gracia de un período anterior.
- **Verificado final:** **108/108 pruebas nuevas en cinco suites**, cero omisiones. Incluye importe mayor que MAX_SAFE_INTEGER/int64, rechazo de precio manipulado, identidad financiera incorrecta, prueba única, límites de gracia, meses cortos/bisiestos, cuotas cero/ilimitadas, flags/RBAC, duplicados/desorden, devolución parcial/total, contracargo y cobro adicional sin segundo grant. No se ejecutó la suite completa del CMS ni E2E.
- **Verificado:** typecheck, lint y build API. Lint sin errores ni advertencias nuevas: conserva tres advertencias en idempotency.repository, public-testimonials.controller y test/setup, todos sin diferencias respecto de HEAD. El build excluye fixtures/simulador y no activa el módulo billing.
- **Verificado estático:** borrador de 18 tablas y 40 sentencias aceptadas por el separador `migrationStatements` existente; 22 nombres explícitos de índices/constraint únicos y <=63 bytes; 17 FK explícitas con aridad y claves únicas de destino consistentes. Sin conexión a BD: esto no valida sintaxis/constraints efectivos, planes, privilegios ni concurrencia PostgreSQL.
- **Verificado:** formato de fuentes/tests/documentos nuevos, ocho enlaces locales, `git diff --check`; sin modificaciones en Prisma, migraciones existentes, arranque/config API, web, manifests/lockfile, infraestructura o hooks. Contexto `llm.txt` enlaza la preparación sin afirmar que los pagos están activos.
- **Pendiente:** revisión humana y ACK específico de fase 2; persistencia y operadores reales, SDKs/firmas/inbox/reconciliación durable, API/UI/cuotas transaccionales, simulación runtime, sandbox y aceptación integral. Sin migraciones aplicadas, claves configuradas, recursos remotos, cobros ni commit automático.

Comandos principales ejecutados:

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-money.spec.ts test/billing-policy.spec.ts \
  test/billing-settlement.spec.ts test/billing-contracts.spec.ts \
  test/billing-simulator.spec.ts
npm run typecheck --workspace apps/api
npm run lint --workspace apps/api
npm run build --workspace apps/api
git diff --check
```

La corrida final agregó cobertura acotada a `src/modules/billing/**/*.ts`, sin umbral global: líneas150/155, ramas171/178, funciones26/26; reporte temporal en `/tmp/billing-phase1-coverage`. No acredita persistencia, sandbox, frontend ni integración productiva.

**Commit sugerido:** `feat(billing): definí contratos y simulaciones de suscripciones`

**Detención histórica:** fase 1 terminada técnicamente y aprobada por «Continuar» del 2026-10-20, que habilitó únicamente fase 2, Prisma y migración descartable. No implica habilitación productiva ni autorización conjunta de fases.

## Evidencia y cierre de fase 2

- **Implementado:** migración `20261020000000_billing_core`, 18 modelos Prisma y repositorios con transacciones locales; módulo/exports de persistencia sin importar desde AppModule. Trigger de términos/precios publicados inmutables, unicidad de trial/grant/contrato abierto, referencias financieras compuestas que incluyen tenant/ambiente/cuenta/importe/moneda y auditoría protegida.
- **Implementado:** catálogo versionado con revisión optimista y archivo sin alterar contratos, consumo de trial y composición con idempotencia local en el mismo TransactionClient, cuotas bajo lock de cuenta y callback de escritura, preparación de obligaciones según precios del servidor y liquidación monotónica con grant/revocación/auditoría atómicos. No se generan ciclos automáticos externos ni se aceptan inputs del navegador como observaciones.
- **Operadores:** membresía separada de admin/editor; CLI UUID con DSN externo y `--apply`, guard con consulta actual a BD, cuentas activas y revocación inmediata. Repositorio de usuarios y trigger impiden cambios de contraseña/activación/borrado de identidades con historial de operador, incluso revocadas. El marcador transaccional distingue rutas tenant de operaciones internas; no es una defensa frente a SQL arbitrario con credenciales internas.
- **TDD/regresiones observadas:** dos pruebas PostgreSQL reprodujeron modificaciones de operadores que debían rechazarse antes de conectar la protección. Una prueba de primeras compras concurrentes detectó P2002 por el upsert vacío emulado en Prisma6.5; se corrigió con INSERT ON CONFLICT nativo antes del lock. Tres mocks anteriores se adaptaron a la nueva transacción de usuarios sin cambiar sus expectativas de alcance/error.
- **Verificado final:** **186/186 pruebas en12 suites, cero omisiones**: 108 de fase1,29 nuevas de fase2 (24 persistencia y5 HTTP/CLI),49 regresiones de usuarios/tenants/catálogo/límites. Concurrencia de trial global entre ambientes, recibo idempotente+grant, cuotas cero/ilimitadas/vigentes, carrera grant vs cambio de usuario, doble observación, precio incorrecto, referencias ajenas, refund parcial/total, cobro adicional, rollback sin período automático verificado, inbox con eventos distintos del mismo recurso y archivo que conserva renovaciones. No se ejecutó toda la suite del CMS ni E2E de fase5.
- **Restauración verificada:** dumps custom en memoria a dos bases nuevas distintas del origen; recuperan trial/auditoría y pago/obligación/grant con FK, unicidad y triggers. Dumps de ensayo sin propietarios/ACL: no acreditar recuperación productiva de privilegios. Un rol runtime aleatorio con SELECT de operadores rechaza concesión de membresías y DDL.
- **Prisma/migración verificados:** Prisma6.5.0, cliente regenerado, esquema válido; todo el historial aplicado desde cero en bases propias PostgreSQL18.6; repetición sin migraciones pendientes. Comparación de esquema no propuso cambios billing; drift previo de nombres/defaults/acciones en entidades anteriores se inspeccionó y no se ejecutó. Los 14 SQL anteriores y migration_lock permanecen byte por byte; modelos anteriores sólo agregan backreferences de relaciones billing.
- **Checks:** typecheck, lint y build API aprobados. Cero errores/advertencias nuevas; conserva las tres advertencias previas. CLI compilada presente, fixtures excluidos y AppModule sin registrar BillingModule. Formato/documentación/enlaces y `git diff --check` verificados. Sin cambios en web, dependencias/lockfile npm, infraestructura o hooks.
- **Operación y contexto:** [runbook de persistencia/operadores](../operations/32_billing_persistence.md), contrato, arquitectura, diccionario, AGENTS y llm actualizados. La migración sólo se aplicó en el cluster propio descartable; ningún destino persistente, cuenta de proveedor, secreto, cobro o despliegue fue configurado.
- **Limpieza:** harness comprobó cero bases `billing_test_`/`billing_restore_` y cero roles `billing_runtime_` remanentes antes de apagar el PostgreSQL propio. PostgreSQL propio detenido y directorio temporal propio eliminado al finalizar la fase.
- **Pendiente:** revisión/ACK para fase3; SDKs/firmas, operaciones/inbox con claim/fencing y poller, creación de ciclos recurrentes, reconciliación con proveedores y simulación runtime. API/UI, conexión de cuotas a todas las mutaciones CMS, sandbox externo y aceptación integral son fases posteriores.

Comando de regresión final (ambas variables TEST apuntan al mismo servidor descartable propio; la suite billing crea y elimina sus propias bases):

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-money.spec.ts test/billing-policy.spec.ts \
  test/billing-settlement.spec.ts test/billing-contracts.spec.ts \
  test/billing-simulator.spec.ts test/billing-persistence.integration.spec.ts \
  test/billing-operator-http.integration.spec.ts \
  test/user-access-http.spec.ts test/user-history.spec.ts \
  test/phase2-api-boundaries.spec.ts \
  test/tenant-integrity.integration.spec.ts test/catalog-admin.integration.spec.ts
npm run typecheck --workspace apps/api
npm run lint --workspace apps/api
npm run build --workspace apps/api
```

**Commit sugerido:** `feat(billing): incorporá persistencia y operadores de facturación`

**Cierre histórico de fase 2:** revisado/aprobado por el ACK que abrió fase 3. En aquel cierre no se habían ejecutado fases3–5 ni habilitado SDKs, webhooks financieros o control comercial.

## Evidencia de fase 3

- **Integraciones:** SDKs oficiales fijados `stripe@23.0.0`, `mercadopago@3.6.1`, sin cambiar runtime ni manifest raíz. Stripe Checkout/Billing, Preferences manuales y adhesión `/preapproval` pendiente. Catálogo local publicado antes de sincronizar; binding `ready` después de confirmar. Cuenta, ambiente, términos y referencia verificados por consultas autenticadas. Importes convertidos exactamente con límites explícitos del adaptador.
- **Durabilidad:** repositorio de operaciones/inbox, hash ligado a contenido, exclusión de otro checkout por obligación, claims `SKIP LOCKED`, leases y heartbeat, fencing y liquidación en una misma transacción, auditoría de resultados/reintentos/revisión. SDK/network fuera de transacciones; respuesta perdida obliga a consultar, nunca recrear. Replays de operador auditados conservan esa semántica.
- **Recuperación:** consultas paginadas, ciclos nativos de recurrencia, una acreditación por obligación y cobros adicionales como discrepancias. Cada compra manual conserva su operación/referencia para reconciliación independiente; checkouts Stripe completos se recuperan aunque ya no tengan URL. Cancelación durable conserva acceso pago; devolución total o pérdida confirmada revoca únicamente su grant.
- **Recepción:** dos rutas directas NestJS, firmas oficiales específicas y rotación; Stripe sobre Buffer original, MP con normalización y frescura. Parser financiero 256 KiB y conservación exacta de identificadores MP largos. CSRF específico sin consumir sesión ambiental; no se modifica proxy Next ni CSRF del resto del CMS. Inbox antes de ACK; error de BD no confirma recepción.
- **Runtime seguro:** BillingModule registrado, `disabled` por defecto sin consultas billing/polling al arrancar; sin composición `live`. Stripe sólo test; MP sólo vendedor MLA de prueba consultado. Simulación sin claves reales, CLI con operador por BD y reloj explícito; estado firmado persistido, recuperable tras reinicio; prohibida en producción.
- **Contratos vigentes revisados:** Chargeback MP 3.6.1 expone contrato anterior y omite header requerido `X-Caller-Id`; GET nativo encapsulado con host fijo, timeout y sin redirección, esquema vigente `coverage_applied`. No extrapolar `lost`/`payment_id` del tipo legado. `/preapproval` no declara `notification_url`: no se envía; disponibilidad/configuración de eventos de Suscripciones queda para aceptación externa, con reconciliación preparada.
- **Validación final:** **248/248 pruebas, 17 suites y cero omisiones**: incluye 38 nuevas (22 de contratos/adaptadores y 16 PostgreSQL/HTTP/CLI), las 186 de la regresión de fase 2 y 24 de configuración/arranque/CSRF. Typecheck, lint y build API aprobados, sin advertencias nuevas (conserva tres previas). Tras reducir sólo el diff de formato se repitieron 82 pruebas afectadas en cuatro suites; se verificó además por HTTP un ID numérico MP mayor que MAX_SAFE_INTEGER. Evidencia local no equivale a checkout/renovación sandbox externa. Pruebas añadidas junto a código, sin afirmar un ciclo TDD completo; los primeros fallos detectaron normalización MP, fixtures SQL y deduplicación esperada, corregidos antes del cierre.
- **Configuración y operación:** [guía de integraciones](../operations/33_billing_integrations.md), contrato y contexto actualizados. No se persistieron secretos, se crearon cuentas de proveedor, se hicieron llamadas de pago remotas ni se modificó infraestructura, hooks, Prisma o migraciones existentes. Migración únicamente en PostgreSQL propio descartable con ACK explícito.
- **Limpieza:** cero bases hijas `billing_test_`/`billing_restore_` y cero roles `billing_runtime_` remanentes; las 18 tablas billing verificadas antes de detener y eliminar el cluster propio. Sin PostgreSQL de esta fase activo al cierre. Enlaces locales (16), formato de fuentes/tests nuevos y `git diff --check` verificados; manifest raíz, Prisma/SQL, infraestructura y hooks sin modificaciones.
- **Pendiente de fases 4–5:** API/UI tenant y plataforma, conexión de prestaciones/cuotas a las mutaciones del CMS, aceptación E2E y sandbox con cuentas/claves externas. Configurar webhooks MP de Suscripciones y observar calendario/renovaciones reales; la simulación no los acredita. Producción queda deshabilitada.

**Commit sugerido:** `feat(billing): integrá pasarelas y conciliación financiera durable`

**Detención de fase 3:** implementación y validación local completadas. Commit sugerido, sin commit/push automático. Esperar ACK humano antes de fase 4; no se implementó API/UI de producto ni aceptación externa.

Comandos de validación de fase 3 (variables TEST inyectadas únicamente para el servidor descartable propio):

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-money.spec.ts test/billing-policy.spec.ts \
  test/billing-settlement.spec.ts test/billing-contracts.spec.ts \
  test/billing-simulator.spec.ts test/billing-persistence.integration.spec.ts \
  test/billing-operator-http.integration.spec.ts test/billing-integrations.spec.ts \
  test/billing-processing.integration.spec.ts test/user-access-http.spec.ts \
  test/user-history.spec.ts test/phase2-api-boundaries.spec.ts \
  test/tenant-integrity.integration.spec.ts test/catalog-admin.integration.spec.ts \
  test/csrf-http.integration.spec.ts test/app.config.spec.ts \
  test/app-bootstrap.integration.spec.ts
npm run typecheck --workspace apps/api
npm run lint --workspace apps/api
npm run build --workspace apps/api
```
