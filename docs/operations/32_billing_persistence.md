# Persistencia y operadores de billing

> Registro de fase 2. El estado de integraciones posterior está en [fase 3](33_billing_integrations.md); BillingModule ahora está registrado y deshabilitado por defecto.

Estado: fase 2 del [plan](../plan/2026-10-20_feat-billing-subscriptions.md). Migración, cliente y repositorios preparados y probados localmente; sólo se aplicó DDL en PostgreSQL 18.6 descartable propio. **Sin proveedores, pagos reales, endpoints financieros, frontend ni restricciones comerciales activadas.** El módulo de persistencia no está importado por AppModule. La protección de usuarios operadoras se integra en el repositorio de usuarios existente y necesita los triggers de la migración para surtir efecto.

## Migración y consistencia

La fuente efectiva es [20261020000000_billing_core](../../apps/api/prisma/migrations/20261020000000_billing_core/migration.sql), no el borrador histórico de fase 1. Agrega 18 tablas, índices/FK/CHECK y triggers. No modifica filas existentes, no asigna operadores, no habilita cuentas de proveedor ni control comercial y no guarda claves. No utiliza el tokenizador simplificado del warehouse: el SQL contiene funciones PL/pgSQL y se aplica con Prisma Migrate.

Antes de aplicarla en cualquier destino persistente: ACK específico del destino, copia verificable, revisión de privilegios y confirmación de SHA/migración aprobados. Esta fase no autoriza ejecutarla allí. Los ensayos crean bases con prefijos `billing_test_`/`billing_restore_`, aplican todo el historial mediante `migrate deploy`, verifican y eliminan sólo sus recursos. Nunca apuntar las pruebas a una cuenta con acceso a producción.

Para validar localmente, usar `TEST_BILLING_DATABASE_URL` como conexión externa al PostgreSQL descartable propio. El harness crea y elimina bases nuevas; requiere CREATEDB y, para el ensayo de privilegios, CREATEROLE. No es el rol de la aplicación. En CI también acepta `TEST_DATABASE_URL`, cuya infraestructura ya es descartable.

```bash
npm test --workspace apps/api -- --runTestsByPath \
  test/billing-persistence.integration.spec.ts \
  test/billing-operator-http.integration.spec.ts
```

Prisma 6.5 no representa CHECK, triggers, índices parciales o NULLS NOT DISTINCT por completo. Conservarlos en SQL. Las relaciones compuestas y los campos están en Prisma; `BillingOrder` expone una colección inversa por la limitación de Prisma 6.5 para inferir una relación uno a uno desde una unicidad parcial del conjunto FK. La BD igualmente impone una sola obligación por orden mediante `order_id UNIQUE`.

El diff de migración sólo se inspecciona, nunca se ejecuta para “alinear” automáticamente. El esquema original ya presenta diferencias de defaults, nombres y acciones de FK con su historial; no eliminarlas como parte de billing. La comparación realizada no propuso cambios sobre tablas billing. Los checks/triggers se validan mediante operaciones reales en BD, no mediante ese diff.

## Operadores y credenciales

El operador usa la misma autenticación de usuario, pero su permiso global vive en `billing_platform_operators`, fuera de `admin/editor`. Se comprueba usuario/tenant activo y membresía vigente en BD por cada operación privilegiada. Las escrituras de catálogo toman bloqueo de lectura de membresía para serializarse con revocaciones; el guard vuelve a consultar sin caché de JWT.

La CLI requiere `BILLING_OPERATOR_DATABASE_URL` externo y separado del DSN runtime. No acepta URLs como argumentos ni imprime datos personales, credenciales o errores SQL. Tras compilar:

```bash
node apps/api/dist/modules/billing/operator.cli.js check UUID
node apps/api/dist/modules/billing/operator.cli.js grant UUID --apply
node apps/api/dist/modules/billing/operator.cli.js revoke UUID --apply
```

`UUID` representa un usuario existente, no un email. `check` no cambia membresías; grant/revoke exigen `--apply`, son idempotentes y registran auditoría sólo cuando cambia el estado. El aprovisionamiento de esa identidad es responsabilidad del operador humano; no convertir el registro público de administradores en alta de operadores.

Permisos DB: el runtime requiere DML sobre tablas usadas por sus repositorios; **sólo SELECT** sobre membresías y SELECT/INSERT sobre auditoría. No puede crear objetos ni conceder membresías. La cuenta manual de operación es la única que concede/revoca; no entregar su DSN al proceso web/API. El ensayo usa un rol aleatorio sin CREATEDB/CREATEROLE/DDL y verifica esas denegaciones. No se configuraron roles de entornos persistentes.

El repositorio tenant de usuarios bloquea primero la fila y fija `tms.billing_tenant_user_mutation=true` de forma local a la transacción. Un trigger impide cambiar o eliminar cualquier identidad con historial de operador, incluso revocada. La CLI bloquea la misma fila para evitar carreras. El marcador no es una credencial ni proviene del HTTP: distingue escrituras tenant de operaciones internas como rehash de contraseña. No representa una defensa frente a ejecución arbitraria de SQL con credenciales internas. Conserva este límite en nuevas rutas que modifiquen usuarios; no escribir directamente con Prisma desde un controlador.

## Atomicidad financiera y cuotas

- Crear cuenta: INSERT ON CONFLICT nativo y luego bloqueo por tenant. El `upsert` de Prisma 6.5 con `update: {}` puede leer e insertar separadamente y no se usa para este punto de concurrencia.
- Trial: cuenta, consumo global una vez, período y auditoría en una transacción. El método admite `TransactionClient` para componerse con el recibo del servicio de idempotencia local sin abrir otra transacción ni confirmar parcialmente el trial.
- Cuotas: lock tenant → lectura de cobertura del ambiente → uso vigente → validación → callback que escribe con ese mismo TransactionClient. No hacer I/O externo o hashing dentro del callback. Las rutas CMS aún no llaman a este límite: conexión completa reservada a fase 4.
- Compra local: precio/versionado/modo/cuenta y binding listos se resuelven en servidor. Repetir la misma identidad de ciclo devuelve la obligación existente; otra compra pendiente impide abrir cobros paralelos.
- Acreditación: lock tenant → obligación; verificar contexto, aplicar reducer monotónico, guardar intento, asignar pago acreditado, conceder período/terminar trial y auditar en un solo commit. El automático exige período normalizado y verificado por adaptador; sin él revierte el pago completo. Un segundo pago para la obligación queda registrado como discrepancia, sin otro grant.
- Refund parcial conserva cobertura; total/contracargo confirmado revoca sólo su grant y recalcula horizonte. Una observación antigua no repone cobertura. Dinero/moneda incompatibles y referencias entre tenants/ambientes/cuentas se rechazan.
- Inbox y operaciones ya tienen estructuras durables, deduplicación por evento y restricciones de lease. Reclamación, fencing, firmas, sondeo, creación de ciclos recurrentes y reconciliación son fase 3; no existe un worker financiero activo en esta entrega.

`BillingSettlementRepository.recordObservation` es una frontera interna, sin controlador. Sólo podrá recibir consultas autenticadas y normalizadas de un adaptador. La fase 3 debe verificar vendedor real, estado, período y ambiente y coordinar liquidación con fencing; el HTTP de retorno del usuario nunca la invoca directamente. Tampoco atribuir a `preparePurchase` el alta de ciclos automáticos futuros: evita nuevas adhesiones sobre una suscripción activa; el consumidor financiero de fase 3 creará las obligaciones recurrentes por identidad del ciclo externo.

## Restauración y recuperación

El ensayo usa `pg_dump` custom en memoria y `pg_restore` en otra base creada por el harness. Verifica trial/auditoría, pago/obligación/grant, FK, unicidad y protección de términos publicados. El dump de ensayo omite propietarios y ACL: no acredita recuperación de roles ni privilegios productivos; deben aprovisionarse y validarse por separado, como en el ensayo de runtime.

Recuperación de aplicación: mantener el esquema aditivo y datos; no ejecutar DROP ni “DDL inverso”. No volver a una versión que carezca de la protección de identidades mientras haya operadores habilitados. Una recuperación anterior exige mantenimiento, revocación/rotación de esas identidades y plan específico, no sólo restaurar el binario viejo. Restaurar un backup financiero en el futuro también exigirá reconciliación con proveedores para no perder cobros externos posteriores; sandbox y esos adaptadores permanecen pendientes.
