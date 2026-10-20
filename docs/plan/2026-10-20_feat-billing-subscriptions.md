# Pagos y suscripciones del Testimonial CMS

## Contexto y Restricciones

- Solicitud y decisiones del usuario del 2026-10-20: el CMS cobra a sus tenants; Stripe/USD y Mercado Pago Argentina/ARS; catálogo propio; mensual/anual; prueba sin tarjeta una vez por tenant; funciones y cuotas; pago automático o manual; nueva adhesión para cambios, sin prorrateos.
- Rama `codex/billing-subscriptions`, creada y seleccionada antes de modificar archivos desde `codex/fix-sprintf-js-dependency`, base `aead37c10de2a3345c2ed47ff2fc3ccc69e98d02`. Árbol inicialmente limpio.
- Aplican [AGENTS.md](../../AGENTS.md), [payments-engineering](../../.agents/skills/payments-engineering/SKILL.md), [mercadopago-api](../../.agents/skills/mercadopago-api/SKILL.md), [testing-tdd-engineering](../../.agents/skills/testing-tdd-engineering/SKILL.md) y las reglas PostgreSQL. Ejecutar sólo la fase actual; detenerse con commit sugerido y esperar ACK entre fases.
- La implementación autorizada en esta fase comprende documentación, borrador SQL, contratos, dominio puro y simuladores de prueba. No modifica Prisma, aplica DDL, instala SDKs, registra controladores ni activa pagos o restricciones en el CMS.
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

### [Actual] 1. Contratos y diseño — implementada, pendiente de revisión/ACK

- [x] Especificar capacidades, estados, HTTP, permisos y modelo relacional; preparar SQL revisable sin aplicarlo.
- [x] Implementar dominio puro: dinero exacto, calendario, trial, gracia, funciones/cuotas y efectos idempotentes de observaciones financieras normalizadas.
- [x] Preparar contratos de adaptadores y simuladores deterministas sin red, claves ni datos personales.
- [x] Probar reglas con oráculos independientes, casos negativos y escenarios de timeout/reconciliación. Typecheck, lint, build y comprobación estática de SQL/documentos.
- [x] Registrar evidencia y límites; detenerse con commit sugerido. No marcar fase 2 como actual sin ACK.

### [Pendiente] 2. Persistencia y permisos

ACK explícito para editar Prisma y aplicar migraciones sólo sobre bases descartables identificadas. Migración aditiva desde el borrador revisado; repositorios transaccionales, pertenencia entre tenants y operadores independientes otorgados/revocados por CLI UUID. Comprobar protección de cuentas operadoras frente a endpoints tenant, revocación inmediata, unicidad de períodos y contención concurrente de cuotas. Validar DDL efectivo, restauración y cliente Prisma; no desplegar a entornos persistentes.

### [Pendiente] 3. Integraciones financieras

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

**Detención:** fase 1 terminada técnicamente. Fases 2–5 permanecen pendientes; el siguiente ACK debe autorizar explícitamente editar `apps/api/prisma/schema.prisma` y aplicar migraciones sólo en PostgreSQL descartable identificado. No implica habilitación productiva ni autorización conjunta de fases.
