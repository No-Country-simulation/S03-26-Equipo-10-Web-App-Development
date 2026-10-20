# Analítica estadística: aceptación local, habilitación y recuperación

**Fecha:** 2026-10-20. **Alcance:** fase 5 del [plan HITL](../plan/2026-10-19_feat-bi-analitica-estadistica.md). Validación sobre recursos descartables; habilitación remota, capacidad productiva y utilidad predictiva real pendientes.
**Contratos:** [estadísticas](../modules/api-bi-statistics.md), [datos y backfill](28_bi_statistics_data.md), [worker](29_bi_statistics_worker.md), [consumo](30_bi_statistics_consumption.md).

## Entorno y garantías comprobadas

Dos PostgreSQL 18.6 propios, loopback, `shared_buffers=32MB` y `max_connections=30`, Redis 7.4.7 temporal real sin persistencia, Node 24.21.0 y dependencias del lockfile. Mismo host de cuatro CPU lógicas/8GB: no acredita aislamiento físico de recursos. Docker no estaba disponible; Redis se compiló temporalmente desde el release oficial, sin instalar dependencias del monorepo. El origen se prepara con DDL generado desde Prisma y las dos migraciones de vistas: no reproduce toda la cadena histórica OLTP.

`bi-statistics-system.integration.spec.ts` utiliza AppModule completo con sesiones reales, JWT/RBAC/CSRF y Redis; worker CLI en otro proceso. Dos empresas de 100 testimonios, dos etiquetas por taxonomía y 60 relaciones por empresa, con intersección 10. Admin/editor reciben sólo su empresa; el transporte no incluye contenido, autores, credenciales ni jobs. Las confianzas usan el orden canónico UUID, no el nombre de la etiqueta.

Verifica éxito ETL conservado ante tres fallos estadísticos, presupuesto durable agotado para ese corte y publicación anterior intacta. También verifica caída del lector: 503 estadístico privado mientras readiness/liveness, listado, captura y moderación del CMS siguen funcionando. Apagar estadísticas conserva dashboard e informes.

Backup completo y restauración en otra base vacía comparan cantidad y digest de las 30 tablas de `dw`, `etl` y `staging`, incluido ledger, puente, creaciones, tareas, publicaciones y punteros. `pg_restore --no-owner --single-transaction --exit-on-error` conserva ACL con roles ya existentes en el mismo cluster. Una tarea estadística pendiente se completa con la CLI restringida restaurada, una publicación y un intento, incluso tras otro barrido. No acredita PITR, provisión de roles entre clusters ni RTO/RPO del proveedor.

Las identidades de extracción, publicación, lectura, control y CMS son distintas. El CMS de la fixture tiene permisos públicos de prueba sin propiedad ni superusuario; la política mínima de entrega se audita por separado con los SQL propuestos. Las pruebas negativas deniegan jobs al lector, informes al control y UPDATE/DELETE de informes/creaciones al worker, antes y después de restaurar.

## Navegador y regresión

[Recorrido Chrome real](../technical/bi-statistics-browser-2026-10-20.json): web compilada en modo producción, API completa, Redis y worker independiente, sin interceptar HTTP. Se sirvió la compilación con `next start` para esta prueba; no valida el empaquetado standalone, HTTPS o ingress del despliegue. Admin solicita carga y cierra la sesión; editor de la misma empresa entra desde 390×844, espera la publicación y descarga tres CSV. Otra empresa sigue sin cortes y sin descarga. Una nueva sesión admin en 1440×1000 recupera la solicitud exitosa. Ambos tamaños carecen de desborde horizontal de página; la tabla de 90 días se abre correctamente.

Los CSV conservan el mismo corte de API, BOM, NULL del pronóstico insuficiente, 25 filas de pronóstico/histórico, 12 de patrones y 180 señales. El par conocido conserva cantidad 10, soporte 10%, confianzas 25/50% y lift 1,25; el nombre sintético con prefijo de fórmula sale neutralizado. Los estados de teclado, error, antigüedad y cambio de identidad se cubren también en los tests de UI. No acredita otros motores, dispositivo físico o auditoría completa con lector de pantalla. `agent-browser` no estaba instalado; se utilizó Playwright/Chrome ya disponibles.

Regresión final: 267/267 casos en 21 suites BI backend, sin omisiones, 96/96 en 9 archivos web BI, 67/67 tests nativos de configuración/runtime/planificación y una prueba nativa adicional de los grants efectivos. Typecheck, lint y build de ambos workspaces aprobados; permanecen tres warnings backend y ocho frontend previos, sin errores nuevos. Análisis estático de workflows aprobado. La suite conjunta detectó contadores de login compartidos en Redis; la fixture ahora reserva una base lógica vacía por instancia y limpia sólo la que le pertenece, conservando guardias/cuotas reales. No se ejecutó toda la suite CMS ni CI remoto.

## Reproducción local

Requiere dos PostgreSQL 18 propios independientes, `psql`/`pg_dump`/`pg_restore`, Redis 7 exclusivo descartable, Node del proyecto y dependencias del lockfile. Configurar `TEST_BI_SOURCE_DATABASE_URL`, `TEST_BI_WAREHOUSE_DATABASE_URL`, `TEST_BI_REDIS_URL` y `TEST_BI_BENCHMARK_SCHEMA_FILE` con valores locales, sin guardarlos en documentación. El archivo DDL se genera desde el schema con `prisma migrate diff --from-empty --to-schema-datamodel apps/api/prisma/schema.prisma --script`, que no aplica migraciones. Las fixtures crean y eliminan sólo sus bases/roles. La prueba de permisos verifica que sus roles canónicos no existan antes de crearlos.

```bash
npm test --workspace apps/api -- --testPathPatterns='bi-.*spec.ts'
npm test --workspace apps/web -- src/features/business-intelligence
node --test scripts/demo/config.test.mjs scripts/demo/runtime.test.mjs scripts/demo/statistics.test.mjs scripts/release/release.test.mjs
node scripts/demo/statistics-permissions.integration.mjs
bash scripts/release/check-workflows.sh
```

Desde `apps/api`, con esas variables, ejecutar `TS_NODE_TRANSPILE_ONLY=true ../../node_modules/.bin/ts-node test/bi-statistics-benchmark.ts --run` para repetir benchmark. Produce sólo agregados y códigos técnicos; no conserva SQL, nombres, contenido o credenciales. No comparar corridas sobre recursos de destino sin declarar las diferencias.

Para navegador, desde `apps/api` iniciar `TS_NODE_TRANSPILE_ONLY=true ../../node_modules/.bin/ts-node test/bi-statistics-browser.ts --serve`. Compilar web con `NEXT_PUBLIC_API_URL=http://127.0.0.1:4105/api/v1` y servirla en 3105. Ejecutar `TEST_CHROME_EXECUTABLE=<ruta Chrome local> node apps/web/e2e/bi-statistics-local.mjs --run` desde raíz. El harness usa identidades sintéticas de código de prueba; no conecta con usuarios reales. Terminarlo con SIGTERM para drenar CLI y borrar sus bases/roles; detener web y servicios propios al finalizar. No apuntar estas herramientas a recursos compartidos/persistentes.

## Rendimiento y corrección encontrada

[Evidencia inicial](../technical/bi-statistics-benchmark-initial-2026-10-20.json): 1001 testimonios de una empresa, 50 etiquetas simultáneas por testimonio y 50050 relaciones. La consulta anterior de pares agotó SQL 30s; el job falló en 30235ms, después de un ETL exitoso de 21003ms. Las 60 lecturas HTTP devolvieron 200 y el fallo estadístico no revirtió ETL. No se amplió ningún plazo.

La consulta ahora forma conjuntos ordenados de etiquetas por testimonio, agrupa conjuntos idénticos y expande pares ponderando su frecuencia. La PK del puente garantiza una asignación por testimonio/etiqueta. Es algebraicamente el mismo conteo, con los mismos 50 tags, 1225 pares candidatos, umbrales y versión `stats_v1`; no incorpora clustering ni un modelo nuevo. Prueba independiente: 100 testimonios con 50 etiquetas compartidas producen 1225 pares de peso 100, frecuencias 100 y lift 1, por lo tanto ninguna asociación destacada. Las pruebas previas mantienen las confianzas 0,25/0,5 y lift 1,25 del caso no denso.

[Comparación final](../technical/bi-statistics-benchmark-2026-10-20.json): 425 cortes diarios sintéticos, 217170 detalles, 1001 testimonios observados en el nuevo corte y 50050 relaciones actuales. No se inventaron etiquetas históricas. Preparación administrativa del registro sintético y validación de coherencia; su tiempo no representa el backfill operativo. Se ejecutó primero modo apagado y luego encendido, sobre fixtures nuevas equivalentes, con caché calentada después de prepararlas.

| Medición local                             |        Apagado |      Encendido |
| ------------------------------------------ | -------------: | -------------: |
| Extracción ETL                             |          119ms |         6215ms |
| Publicación ETL                            |          229ms |        14897ms |
| Run ETL completo                           |          371ms |        21138ms |
| Tarea estadística durable                  |   No ejecutada |          567ms |
| Ciclo estadístico observado en CLI         |   No ejecutado |          592ms |
| Proceso CLI completo, con arranque         |         1597ms |        23027ms |
| CMS concurrente p95/p99, 20 muestras       |    66,1/67,3ms |  148,9/150,8ms |
| Dashboard concurrente p95/p99, 20 muestras |    94,4/97,3ms |  164,1/175,6ms |
| Statistics HTTP p95/p99, 20 muestras       |  No consultado |  143,4/167,2ms |
| Tamaño final DW                            | 62314175 bytes | 81974975 bytes |

Los dos eventos ETL guardados en el reporte corresponden, en orden, a extracción y publicación. Referencia del listado sin worker: 10 muestras por modo, p95/p99 de 77,7ms apagado y 71,9ms encendido. Rondas concurrentes: 20 tandas con 50ms después de cada tanda; CMS+dashboard apagado y CMS+dashboard+statistics encendido. Hubo 40/40 y 60/60 respuestas 200 respectivamente. El reporte conserva CPU/RSS del proceso API padre, no de cada PostgreSQL ni del worker.

**Existe costo:** el caso extremo de 50 etiquetas aumenta extracción/publicación y latencia del CMS. Cambian también las rutas concurrentes; la comparación combina costo de escritura y lectura y no identifica una causa aislada. El gate sólo comprueba una conexión de extracción presente, no solapamiento de cada muestra con una fase concreta. Las muestras p95/p99 son pequeñas y no equivalen a usuarios, cadencias reales ni capacidad sostenida.

En esta muestra ETL queda debajo de 5min, estadística debajo de 60s y HTTP conserva SQL 5s/tx 10s. Antes de habilitar, repetir con distribución/volumen, concurrencia, recursos separados, CPU/IO/pools y SLO acordados del destino. Medir también antigüedad de cola, crecimiento y errores, no sólo duración de un cálculo. No deducir utilidad predictiva a partir del dataset sintético.

## Preparación de permisos y compatibilidad

Se agregaron propuestas aditivas [OLTP](demo/oltp-statistics-grants.sql) y [warehouse](demo/warehouse-statistics-grants.sql), complementarias a los grants base. Revocan privilegios de PUBLIC/roles Data API sobre los objetos nuevos y conceden sólo el catálogo específico; no crean credenciales ni habilitan LOGIN. No conceder SELECT privado al navegador. La definición de permisos sigue las operaciones PostgreSQL [GRANT/REVOKE y roles](https://supabase.com/docs/guides/database/postgres/roles); el aislamiento por tenant permanece en consultas y FK del CMS, sin migración a RLS.

`inspectConnection` reconoce los objetos nuevos. Con estadísticas encendidas exige todos los mínimos y ledger 0005 del worker. Apagadas, permite que esos grants compatibles sigan presentes sin exigirlos; en ambos casos rechaza privilegios adicionales y edición de datos inmutables. El perfil de control no cambia. `prepareEnvironment` valida el opt-in y exige BI para estadísticas API; no agrega conexiones ni credenciales.

La prueba nativa de propuestas usa bases/roles propios en dos servidores loopback: mínimos, denegaciones y detección de un UPDATE extra y ledger faltante. Conserva todos los controles del preflight salvo TLS, que aparece deliberadamente como única incidencia esperada por conexión local. No acredita TLS remoto, Data API desactivada, rol administrado, IPv6, ingress ni proveedor. El preflight productivo sigue rechazando esa incidencia; no se relajó TLS.

## Habilitación futura con ACK del destino

1. Mantener flags API/worker apagados. Identificar SHA, entorno, responsable, backup restaurable y ventana. Detener/drenar todos los workers y comprobar ausencia de runs, reservas y jobs estadísticos activos. Un proceso activo en la copia antigua no queda protegido por el fencing de otra base restaurada.
2. Aplicar las vistas OLTP y 0005 DW por sus procedimientos autorizados, sin editar migraciones/checksums. El planificador manual mantiene 0004 por defecto. Sólo `DEMO_BI_STATISTICS_MIGRATION=true` selecciona 0005 y exige `APPLY <SHA completo> warehouse statistics`; una confirmación antigua se rechaza. El workflow pasa esa opción a maintenance y registra la selección. Los gates de tag, imagen, entorno, migrador y TLS se conservan. Esta preparación no autoriza ejecutar comandos Prisma ni migraciones persistentes desde el agente.
3. Provisionar los grants base y después los dos SQL aditivos. Confirmar propietarios, mínimo privilegio, ausencia de acceso Data API y conexiones privadas por los procedimientos de entrega. Revisar versión/extensiones reales del destino; no extrapolar PostgreSQL 18 local al proveedor.
4. Ejecutar `statistics-history.cli --check`; si falta historial, aplicar `--apply --maintenance` con migrador y workers detenidos, luego repetir comprobación. No calcular mientras el marcador esté atrasado. No rellenar etiquetas históricas ni inventar altas eliminadas entre cortes.
5. Desplegar software compatible con flags apagados, sin DDL implícito. Verificar CMS/readiness y resumen BI. Ejecutar preflight conectado del API/worker con la política estadística para comprobar objetos/permisos/TLS antes de abrir consumo; el preflight es READ ONLY y no sustituye el procedimiento de provisión.
6. Encender primero `BI_STATISTICS_ENABLED` del worker y reiniciarlo de forma controlada. Verificar extracción completa, marcador de etiquetas incluso vacío, registro observado, job y publicación `stats_v1`; una falla conserva el último informe. Sólo entonces encender el opt-in independiente del API y comprobar dos tenants/admin/editor y CSV contra el mismo informe.
7. Registrar corte, versión, actualidad, latencias y errores reales. Sin 12 meses/cobertura/evaluación/mejora no habrá proyección, aunque el sistema esté técnicamente habilitado. Ausencia de estimación no significa un fallo de infraestructura.

No se activaron flags externos, workflows, tags, recursos o despliegues. El CI remoto del commit de cierre deberá ejecutarse al publicar la rama; la evidencia local no lo reemplaza.

## Recuperación y reversión

Ante fallo estadístico, conservar ETL exitoso y última publicación; no editar el JSON, puntero o presupuesto para aparentar éxito. Recuperación de tareas pendientes/vencidas ocurre por CLI dentro de sus tres intentos y último corte; tercero fallido es terminal para ese run/versión. Corregir datos/permisos/servicio y observar la siguiente carga permitida. Una respuesta ambigua se concilia por éxito durable, nunca duplicando el informe.

Para apagar consumo, desactivar el opt-in API y reiniciar; dashboard/CMS siguen disponibles. Para apagar cálculo/extracción nueva, drenar worker y desactivar su opt-in. Conservar 0005 y todos sus datos/grants; no DROP ni DDL inverso. Si se vuelve a cargas sin extracción estadística, el marcador puede quedar atrás: conciliarlo en mantenimiento antes de reactivar. Para volver a software antiguo, conservar un worker compatible y aplicar las restricciones de limpieza de staging de la guía de datos.

El backup debe incluir toda la base DW y ACL; roles/credenciales se provisionan por separado. Restaurar en otra base vacía, verificar 30 tablas, digest/constraints/ledger/ACL y aislar la copia anterior antes de reanudar. Heartbeats restaurados son históricos; dejar vencer reservas de procesos detenidos y recuperar por las reglas normales. No resetear intentos ni reutilizar cortes inventados. Origen y DW no comparten transacción de backup; declarar pérdida posterior al backup y reconciliar sin prometer captura durable de todas las altas.
