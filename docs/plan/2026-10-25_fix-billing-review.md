# Corrección de los cuatro hallazgos de billing

## Contexto y restricciones

Plan aprobado por el usuario el 2026-10-25. Implementar sólo la fase actual y detenerse con evidencia y commit sugerido; esperar ACK entre fases. Se eligió liberar automáticamente los checkouts cuyo vencimiento Stripe confirme sin pago ni adhesión remota. Sin cambios de Prisma, infraestructura, manifest raíz ni hooks; sin pagos externos ni despliegues.

ACK específico recibido el 2026-10-25: «Sí, sólo PostgreSQL propio descartable». Autoriza aplicar únicamente el historial existente en servidores propios descartables, con propiedad/destino verificados y limpieza. No autoriza destinos persistentes ni modificaciones de esquema.

Aplican AGENTS.md, payments-engineering y testing-tdd-engineering. Los proveedores se simulan en pruebas: la evidencia local no acredita sandbox externo.

## Fases HITL

### [Completada] 1. Recuperación financiera

- Metadatos internos `not_started`/`possibly_submitted`, sin alterar hash ni identidad de la solicitud. Marcar bajo lease antes de la creación remota. Reintentar preflight no enviado; buscar/reconciliar cualquier envío posible, incluidas operaciones legadas inciertas.
- Stripe consulta el estado remoto y devuelve expiración verificada, validada por cuenta/ambiente/tenant/operación/referencia/importe. Cierre atómico: orden expired, obligación void, contratación inicial sin cobertura/adhesión ended. Renovación manual conserva contrato/cobertura. Duplicados idempotentes; pagos confirmados no se cierran y contradicciones van a revisión.
- No programar reconciliaciones de obligaciones resueltas. Nueva contratación sólo por solicitud expresa del administrador.
- HTTP/UI admiten paymentStatus expired, detienen sondeo y liberan selección de plan sin abrir checkout automáticamente.
- Pruebas Red/Green de preflight, reinicio, leases, operador, timeout tras envío, expiración por webhook/reconciliación, identidad incorrecta, duplicados/concurrencia y renovación manual; regresiones UI.

### [Completada] 2. Controles del CMS

Scoring verifica prestación antes de calcular y dentro de la publicación transaccional bajo lock; cuenta sólo filas modificadas. Billing deshabilitado reanuda suspensiones comerciales, preservando intentos/historial/nextRetryAt y ajustando una sola vez el presupuesto. Pruebas del worker y concurrencia de reanudación.

### [Completada] 3. Validación integral y documentación

Pruebas unitarias, integración PostgreSQL y recorridos locales afectados; typecheck/lint/build y diff check. Actualizar runbook de expiración, incertidumbre y revisión. Registrar evidencia y límites. Mercado Pago conserva reglas propias.

## Evidencia de fase 1

Implementación sobre la base local `67a90b6`, sin commit/push automático. Fases 2 y 3 pendientes de ACK; no se modificaron scoring ni webhooks salientes.

- **Red observado:** prueba del adaptador Stripe devolvía sólo payments vacío en vez de expiración verificada; la UI no mostraba Checkout vencido. En PostgreSQL real, preflight persistía uncertain en vez de ready y la expiración dejaba abierta la obligación. Los cuatro fallos funcionales se observaron antes de corregir producción. Los demás casos se añadieron junto a la implementación; no se presentan como Red previo.
- **Green:** 132/132 pruebas unitarias API en seis suites; 65/65 pruebas de integración en tres suites (processing/product/persistence); 17/17 pruebas UI de billing con HTTP simulado. Total seleccionado 214/214, sin omisiones. No es la regresión integral del monorepo.
- **Recorridos comprobados:** fallo de preflight y reinicio, recuperación de lease no enviado frente a legado incierto, fencing del dueño anterior, replay del operador tanto antes como después de posible envío, timeout tras POST sin segundo POST, hash estable; expiración desde webhook/reconciliación, cierre idempotente concurrente, identidad/importe incorrectos, competencia con reconfirmación de pago, renovación manual con cobertura conservada, notificación fallida tardía inocua y pago contradictorio enviado a revisión. HTTP devuelve expired sin redirección, aísla tenants y permite un nuevo checkout expreso. UI detiene sondeo, elimina bloqueo de selección y no inicia otro cobro.
- **PostgreSQL:** servidor 18 propio en loopback y directorio temporal único. Verificados data_directory, PID del postmaster y marcador de propiedad antes de las fixtures; éstas aplicaron únicamente el historial autorizado en bases hijas propias. Sin cambios de Prisma/SQL versionado ni destinos persistentes. Servidor/bases/directorios eliminados al terminar; comprobada ausencia de procesos PostgreSQL propios restantes. El sandbox bloqueó el primer socket local; se ejecutó después mediante escalación autorizada. La excepción synthetic database unavailable impresa por Nest corresponde al negativo existente que verifica ausencia de ACK ante fallo de persistencia, y no es una falla de suite.
- **Checks:** typecheck y build API/web aprobados; lint sin errores ni advertencias nuevas (tres API y ocho web previas). Build web con NEXT_PUBLIC_API_URL=/api/v1 y API_BACKEND_ORIGIN=http://127.0.0.1:4000; las ejecuciones iniciales sin esas variables fallaron en validación de configuración, sin cambios de archivos de entorno. git diff --check aprobado.
- **Límites:** SDKs/proveedores simulados; persistencia, leases y HTTP financieros reales en PostgreSQL. Sin llamadas de pago externas, aceptación sandbox ni E2E de navegador en esta fase. El esquema, infraestructura, dependencias raíz y hooks permanecen sin cambios. Validación integral y runbook completos corresponden a fase 3.

Comandos de checks y regresión seleccionada:

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-integrations.spec.ts test/billing-settlement.spec.ts \
  test/billing-policy.spec.ts test/billing-contracts.spec.ts \
  test/billing-money.spec.ts test/billing-worker.spec.ts
# Con TEST_BILLING_DATABASE_URL apuntando sólo al servidor propio verificado:
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-processing.integration.spec.ts \
  test/billing-product.integration.spec.ts \
  test/billing-persistence.integration.spec.ts
npm test --workspace apps/web -- src/features/billing/billing.test.tsx --maxWorkers=2
npm run typecheck --workspace apps/api
npm run typecheck --workspace apps/web
npm run lint --workspace apps/api
npm run lint --workspace apps/web
npm run build --workspace apps/api
NEXT_PUBLIC_API_URL=/api/v1 API_BACKEND_ORIGIN=http://127.0.0.1:4000 npm run build --workspace apps/web
git diff --check
```

**Commit sugerido:** `fix(billing): recuperá checkouts y resolvé vencimientos verificados`

**Detención:** fase 1 terminada para revisión. El plan aprobado y AGENTS.md exigen ACK entre fases; fase 2 permanece pendiente.

## Inicio de fase 2

ACK «continuar» del usuario el 2026-10-25, posterior al cierre de fase 1 y al commit humano `48d236a`. Sólo habilita scoring y reanudación de webhooks con sus regresiones. Se mantiene el ACK restringido al historial existente en PostgreSQL propio descartable. Fase 3 pendiente.

## Evidencia de fase 2 — 2026-10-25

Base local `48d236a`, sin commit/push automático. ACK «continuar» habilitó esta fase; la fase 3 permanece pendiente.

- **Scoring implementado:** el repositorio verifica prestación/acceso antes de leer testimonios para calcular métricas. La publicación vuelve a verificar bajo el lock comercial del tenant dentro de la misma transacción que actualiza las filas. Un permiso retirado omite el trabajo, sin abortar los otros tenants. Se conserva el filtro técnico y el aislamiento por tenant/status. `updateScores` devuelve el conteo real de updates y el worker lo acumula, en lugar de contar el tamaño del lote solicitado. El control está encapsulado en la interfaz interna `canFeatureForUpdate`, sin SDKs ni controladores en el worker.
- **Webhooks implementado:** billing deshabilitado reanuda entregas con estado suspended y marcador BILLING_SUSPENDED. La misma actualización condicional se reutiliza al recuperar una prestación. Se ajusta una vez el reloj del presupuesto, conservando intentos, historial y nextRetryAt; pausas con otro motivo permanecen intactas. No se emiten llamadas de red dentro de una transacción.
- **Red observado:** el worker cargaba engagement y recalculaba scoring con prestación excluida o acceso vencido; además escribía tras una retirada de cobertura anterior a la publicación. La prueba de reanudación, después de corregir el fixture, esperaba pending pero obtenía suspended al desactivar billing. El error inicial del fixture usaba eventCode donde Prisma exige eventId; no se cuenta como fallo de producto. Los casos de bloqueo/concurrencia y compatibilidad se añadieron junto a la corrección, sin atribuirles Red previo.
- **Green:** 66/66 pruebas en siete suites, sin fallos, omisiones ni TODO: billing-cms-workers.integration, billing-product.integration, bi-etl, webhook-delivery-ledger.integration, delivery-retry-policy, webhook-admin-controls y webhook-destination-policy. La suite nueva contiene siete casos, incluyendo los dos estados comerciales parametrizados.
- **Concurrencia real:** PostgreSQL mostró una publicación esperando en pg_stat_activity por el lock comercial; al confirmar la retirada, el conteo fue cero y el score quedó intacto. Cuatro llamadas paralelas de reanudación conservaron una hora de presupuesto ya consumido después de cuatro días de suspensión, sin duplicar el ajuste. Un segundo refresh no volvió a modificarlo; se respetó el próximo reintento, se conservó el historial y la entrega pudo reclamarse y finalizar con éxito al llegar su turno. No se reanudó una pausa manual.
- **Límites de prueba:** worker, repositorios, consultas de engagement y transacciones reales; el fixture adapta withRetry a $transaction como la integración de scoring existente, por lo que esta evidencia no prueba backoff de deadlocks. El destino HTTP saliente está simulado; no hubo red externa ni aceptación sandbox. Se conservó la prueba existente de fórmula y alcance por tenant, ajustando su doble para devolver el nuevo conteo interno.
- **Entorno y limpieza:** PostgreSQL 18 propio en loopback, marcador y directorio temporal únicos. Antes de migrar, se verificaron data_directory y PID del postmaster. Las fixtures crearon/migraron/eliminaron sólo bases hijas propias bajo el ACK existente; una base propia adicional alojó la regresión del ledger original. Servidor y directorios eliminados al finalizar, sin procesos PostgreSQL propios pendientes. Sin cambios Prisma, migraciones versionadas, infraestructura, manifest raíz, hooks o frontend.
- **Checks:** typecheck y build API aprobados; lint API sin errores, con las tres advertencias previas; git diff --check aprobado. No se repitieron navegador ni builds web: la aceptación integral y el runbook se completarán en fase 3.

Comandos de verificación (variables TEST sólo para PostgreSQL propio descartable y verificado; la base de TEST_DATABASE_URL debe contener el historial existente):

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-cms-workers.integration.spec.ts \
  test/billing-product.integration.spec.ts test/bi-etl.spec.ts \
  test/webhook-delivery-ledger.integration.spec.ts \
  test/delivery-retry-policy.spec.ts test/webhook-admin-controls.spec.ts \
  test/webhook-destination-policy.spec.ts
npm run typecheck --workspace apps/api
npm run lint --workspace apps/api
npm run build --workspace apps/api
git diff --check
```

**Commit sugerido:** `fix(billing): aplicá controles comerciales a scoring y webhooks`

**Detención:** fase 2 terminada para revisión; el plan aprobado exige ACK antes de la fase 3. No se inicia validación integral, despliegue ni operación financiera externa.

## Inicio de fase 3

ACK «Continuar» del usuario el 2026-10-25, posterior al commit humano `a4d7375`. Autoriza validación integral y actualización de runbooks, conservando el ACK para el historial existente únicamente en PostgreSQL propio descartable. Sin pagos externos ni despliegues.

## Evidencia de fase 3 — 2026-10-25

Base `a4d7375d0e82c79e22f8e1ee7fef085e0d368f05`, con cambios documentales locales. Las fases 1 y 2 ya están commiteadas por el usuario. Alcance técnico aprobado completo; cierre documental para revisión humana, sin commit/push automático.

| Validación                     | Resultado                                                                | Evidencia/alcance                                                                                                                                            |
| ------------------------------ | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| API integral con BI            | **859/859, 102/102 suites**, cero fallos/omisiones/TODO; `complete=true` | Corrida `548e13a8582a`, gate nativo de CI aplicado al reporte Jest; dos PostgreSQL propios separados y Redis propio                                          |
| Web completa                   | **399/399, 60/60 archivos**                                              | Vitest/jsdom, dos workers; no es ejecución de navegador                                                                                                      |
| Controles del harness          | **73/73**                                                                | Seis archivos nativos de consentimiento, evidencia, privacidad y gate de resultados; cero omisiones                                                          |
| Billing en navegador           | **5/5**, cero reintentos/omisiones; `complete=true`                      | Corrida `f8f49b66c891`: catálogo, Stripe manual simulado, MP automático simulado, recuperación y móvil                                                       |
| Regresión general en navegador | **6/6**, cero reintentos/omisiones; `complete=true`                      | Corrida `da0680e5e7dc`: sesión, publicación, tenant/CSRF, RBAC, menú y captura móvil; billing deshabilitado                                                  |
| Gates de código                | Typecheck, lint y build API/web aprobados                                | Lint conserva tres advertencias API y ocho web anteriores; sin errores nuevos. Los dos harness de navegador construyen ambas aplicaciones antes de probarlas |

- **Entorno:** Node 24.21.0, PostgreSQL 18.6, Redis 7.4.7 compilado desde la distribución oficial únicamente en /tmp, Chrome instalado. API compilada y Next standalone de producción; HTTPS local de mismo origen. Billing usa NODE_ENV=test y proveedor simulado; la regresión general ejecuta API en producción y billing disabled. Los roles runtime mantienen operadores sólo SELECT y auditoría append-only. Sin interceptación de respuestas de aplicación en navegador.
- **Propiedad/consentimiento:** se reutilizó el ACK explícito de migraciones sólo para servidores/bases propios descartables. El harness verificó data_directory, PID y marcadores antes de crear/migrar. `--with-bi` generó DDL temporal desde el schema vigente sin modificarlo y habilitó las ocho suites BI que necesitan ese entorno. No se alteraron schema, migraciones versionadas, dependencias, infraestructura ni hooks.
- **Evidencia:** reportes saneados locales ignorados por Git en apps/web/.e2e-results/billing-api-complete/, billing/ y la raíz .e2e-results/. Se registraron estados, conteos, versiones, IDs de corrida y SHA; sin secretos, sesiones, cuerpos de proveedores ni PII. Estos resultados no se trasladan a CI remota ni certifican imágenes Docker finales o capacidad productiva.
- **Runbooks:** guías 33/34 distinguen prueba durable de no envío, envío posible/legado incierto, vencimiento Stripe verificado y contradicciones; documentan la coordinación de actualización de workers, los códigos de revisión, los controles de scoring y la reanudación comercial. La guía 35 conserva la aceptación externa pendiente e incorpora el caso real de expiración Stripe a su matriz.
- **Límites:** los once recorridos de navegador existentes regresaron sin fallos; no acreditan expiración/renovación externa de Stripe/MP. La expiración nueva conserva su evidencia de adaptador con SDK simulado, integración HTTP/PostgreSQL y componente UI de fase 1. No se agregó un backdoor de expiración al simulador para simular una aceptación externa. Sin cuentas/recursos remotos, pagos reales o despliegues.
- **Limpieza:** las tres corridas terminaron con exit0 y sin error de limpieza. No quedan sus servidores PostgreSQL/Redis ni directorios de aceptación. Se eliminaron también fuente, binario y archivo comprimido temporales de Redis; no hubo instalación global. Los reportes saneados se conservan para revisión.
- **Comprobaciones finales:** enlaces locales de runbooks e índice verificados; git diff --check aprobado. La fase 3 modifica únicamente documentación e índice del plan.

Comandos principales ejecutados:

```bash
# Sólo tras el ACK de migraciones y con el Redis temporal propio:
E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 BILLING_E2E_REDIS_EXECUTABLE=/ruta/temporal/redis-server \
  node scripts/billing/acceptance-local.mjs --run --api-checks --with-bi
E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 BILLING_E2E_REDIS_EXECUTABLE=/ruta/temporal/redis-server \
  BILLING_E2E_CHROME_EXECUTABLE=/usr/bin/google-chrome node scripts/billing/acceptance-local.mjs --run
E2E_ALLOW_DISPOSABLE_MIGRATIONS=1 BILLING_E2E_REDIS_EXECUTABLE=/ruta/temporal/redis-server \
  BILLING_E2E_CHROME_EXECUTABLE=/usr/bin/google-chrome node scripts/billing/acceptance-local.mjs --run --regression
npm test --workspace apps/web -- --maxWorkers=2
node --test scripts/billing/controls.test.mjs scripts/billing/evidence.test.mjs \
  scripts/e2e/runner-controls.test.mjs scripts/e2e/privacy.test.mjs \
  scripts/e2e/evidence.test.mjs scripts/testing/check-results.test.mjs
npm run typecheck --workspace apps/api
npm run typecheck --workspace apps/web
npm run lint --workspace apps/api
npm run lint --workspace apps/web
git diff --check
```

**Commit sugerido:** `docs(billing): registrá la validación integral y la recuperación operativa`

**Cierre:** las tres fases autorizadas están implementadas/verificadas. Entregar para revisión y commit humano; no iniciar sandbox externo, despliegue ni una fase adicional.
