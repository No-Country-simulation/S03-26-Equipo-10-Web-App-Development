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

### [Pendiente] 2. Controles del CMS

Scoring verifica prestación antes de calcular y dentro de la publicación transaccional bajo lock; cuenta sólo filas modificadas. Billing deshabilitado reanuda suspensiones comerciales, preservando intentos/historial/nextRetryAt y ajustando una sola vez el presupuesto. Pruebas del worker y concurrencia de reanudación.

### [Pendiente] 3. Validación integral y documentación

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
