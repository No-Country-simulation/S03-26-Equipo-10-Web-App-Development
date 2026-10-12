# Integración real y recorridos E2E

Leer al probar HTTP, persistencia, Redis, proveedores, worker BI o navegador. Definir primero qué componentes están dentro del sistema bajo prueba; usar la [guía operativa](../../../../docs/technical/05_testing.md) para comandos vigentes.

## Dependencias y datos

| Límite evaluado                      | Mantener real                                                                     | Qué puede sustituirse fuera del límite                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| API → servicio → Prisma → PostgreSQL | Controller, reglas, repositorio, ORM y DB                                         | Cloudinary/YouTube o destino webhook controlado, si su funcionamiento remoto no es lo evaluado.                                    |
| Auth/RBAC/CSRF HTTP                  | Pipeline HTTP y políticas afectadas; persistencia de sesión si se afirma probarla | Proveedores ajenos al caso; no reemplazar el guard cuya denegación se evalúa.                                                      |
| Cuota/caché                          | Cliente y servidor Redis, operaciones atómicas e invalidación                     | Reloj controlado para política aislada; evaluar TTL real por separado si es parte del contrato.                                    |
| Worker BI → OLTP/DW                  | Conexiones y repositorios reales, reservas/leases y publicación                   | Datos sintéticos y dependencias externas al flujo; conservar separación de servidores para evidenciar aislamiento ante caída OLAP. |
| Pantalla/cliente HTTP                | Componente o adaptador bajo prueba                                                | HTTP simulado permite probar la UI/contrato cliente, sin acreditar integración del backend.                                        |

Usar PostgreSQL compatible con el destino: CI actual utiliza PostgreSQL 18 y Redis 7 descartables; el entorno remoto debe verificarse. No sustituir PostgreSQL por otro motor para afirmar que se probaron sus restricciones, SQL, transacciones o bloqueos. Testcontainers es una opción futura; los servicios reproducibles existentes ya pueden servir al propósito.

Verificar que el destino es descartable antes de ejecutar suites que crean schemas, roles o datos y hacen limpieza. Los nombres `TEST_*` no demuestran por sí solos que la URL sea segura. No usar una cuenta o base productiva. Inspeccionar fixtures antes de ampliar su alcance; no suponer que un rollback del test deshace operaciones HTTP hechas desde conexiones independientes.

Las integraciones deben partir de un esquema coherente con las migraciones reales. El workflow prepara la base descartable; reproducir `prisma migrate deploy`/`db push` desde una sesión del agente exige ACK específico aun en pruebas. Algunas fixtures aplican SQL propio en recursos aislados: no extrapolar su permiso ni su evidencia a una base persistente.

Usar factories/fixtures pequeñas, identidad única por ejecución, datos y reloj reproducibles, y limpieza acotada a los recursos creados. Restaurar estado global, cerrar clientes y drenar procesos. No compartir filas mutables entre workers paralelos; usar namespaces/schemas/destinos separados o serializar cuando el recurso no pueda aislarse. Guardar semillas cuando se use aleatoriedad reproducible.

## Entorno actual de API

El [setup de Jest](../../../../apps/api/test/setup.ts) exige estas variables cuando `CI` está presente:

| Variable                         | Recurso requerido                                            |
| -------------------------------- | ------------------------------------------------------------ |
| `TEST_DATABASE_URL`              | PostgreSQL descartable para integraciones OLTP.              |
| `TEST_LOGO_DATABASE_URL`         | Destino descartable de las pruebas de logo.                  |
| `TEST_REDIS_URL`                 | Redis para cuotas y caché.                                   |
| `TEST_BI_SOURCE_DATABASE_URL`    | Servidor PostgreSQL fuente BI.                               |
| `TEST_BI_WAREHOUSE_DATABASE_URL` | Servidor PostgreSQL DW, distinto del fuente.                 |
| `TEST_BI_BENCHMARK_SCHEMA_FILE`  | Archivo DDL sintético legible generado para las fixtures BI. |
| `TEST_BI_REDIS_URL`              | Redis de las pruebas de sistema BI.                          |

Fuente y warehouse deben diferir en host o puerto; cambiar sólo el nombre de la base no satisface el setup. El workflow también instala clientes `pg_dump`/`pg_restore` compatibles para restauración. Los requisitos adicionales y efectos de cada suite se consultan en sus fixtures. No completar variables con una base de desarrollo para conseguir que deje de fallar el setup.

En local algunas suites sin servicios se omiten. Informar sus cantidades y motivos: una suite verde con omisiones no valida las integraciones. En CI, además del setup, el reporte JSON API debe indicar éxito, tests presentes y cero tests/suites pendientes. No eliminar `CI` ni introducir skips para sortear el gate.

## Assertions de integración

- **HTTP:** comprobar código y contrato del body, validación, errores, autenticación/autorización y efectos persistentes según el caso. HTTP 200 por sí solo no demuestra que la operación haya ocurrido.
- **Tenants:** usar al menos dos tenants para el escenario de aislamiento; comprobar denegación de lectura/escritura y ausencia de cambios ajenos. La protección es por consultas y restricciones, sin RLS implementada.
- **Persistencia:** comprobar UNIQUE/FK/CHECK relevantes, relaciones, rollback, cascadas y conflictos concurrentes; no afirmar índices o planes de consulta evaluados si sólo se probaron resultados.
- **Outbox/webhooks:** comprobar dominio y evento en la misma transacción, rollback ante fallo del evento, idempotencia y concurrencia/reintento según contrato. Redis no es la cola durable; firma/bytes y entrega at least once requieren escenarios propios.
- **BI:** verificar solicitudes/leases/fencing, horas UTC y publicación atómica cuando se afecten; para resiliencia, demostrar que la caída OLAP no invalida el CMS. Fixtures de backup/restauración y benchmarks locales no certifican capacidad productiva.

Ejemplo de evidencia existente: [persistencia de testimonios](../../../../apps/api/test/testimonial-persistence.integration.spec.ts) comprueba que un fallo de inserción outbox revierte el testimonio, y que una publicación fallida conserva el estado anterior y no deja el evento. Para afirmar atomicidad hay que ejecutar esos escenarios con PostgreSQL; sustituir el repositorio por un mock sólo verifica la reacción del consumidor del repositorio.

Elegir negativos relevantes: request inválido, inexistente, prohibido, duplicación, estado incompatible, timeout, fallo parcial, reintentos o concurrencia. No imponer todos los errores a cada endpoint. Un contrato externo simulado no valida al proveedor real: complementar con sandbox o aceptación autorizada cuando el riesgo lo requiera y reportar ese alcance.

## E2E: adopción futura y criterios

No hay runner persistente E2E en los manifests/configuración actuales. Los [recorridos documentados de navegador](../../../../apps/web/src/tests/e2e/README.md) y el smoke sintético del proxy tienen límites distintos de un recorrido completo con AuthService, PostgreSQL y Redis. No crear scripts ficticios `test:e2e` ni afirmar que ese gate existe.

Cuando una tarea autorice adoptar Playwright, definir entorno, datos, ciclo de arranque/limpieza y recorridos críticos. Candidatos según riesgos del cambio: login/logout y acceso protegido; captura seguida de moderación/publicación y visibilidad pública; denegación de operaciones por rol/tenant; operación BI y estado final visible. No agregar recuperación de contraseña, checkout u otros flujos ajenos al producto por provenir de ejemplos genéricos.

Seguir las [prácticas oficiales de Playwright](https://playwright.dev/docs/best-practices):

- Preferir `getByRole`/`getByLabel`; reservar test IDs para controles sin un selector semántico estable. Esperar mediante condiciones y assertions con auto-retry, sin sleeps arbitrarios.
- Preparar datos por test y aislar cookies/sesiones. Ningún recorrido debe depender del test anterior; conservar trazas al fallar y redactar secretos de evidencia/estado de sesión.
- Confirmar estado visible y efectos finales con backend/almacenamiento reales en el límite acordado. Clicks o navegación aislados no prueban persistencia.
- Usar POM cuando reduzca repetición real, manteniendo la intención del escenario y sus assertions visibles; evitar objetos gigantes.
- Simular proveedores externos no deterministas con alcance declarado; pruebas de contrato/sandbox cubren su integración real cuando corresponda. No provocar operaciones productivas destructivas.
- Elegir navegadores/resoluciones según soporte declarado, uso y riesgo. Medir estabilidad y costo antes de ampliar combinaciones o sharding; retries de diagnóstico no reparan flakiness.

MSW puede mejorar la interceptación HTTP de tests de UI cuando se adopte justificadamente; los mocks actuales son válidos si no ocultan el comportamiento que afirman verificar. La [Testing Library](https://testing-library.com/docs/guiding-principles/) orienta a pruebas que se parecen al uso observable de la interfaz, sin inspeccionar detalles internos del componente.
