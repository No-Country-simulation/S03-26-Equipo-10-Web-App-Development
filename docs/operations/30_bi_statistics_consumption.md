# Consumo privado de analítica estadística

**Fecha:** 2026-10-19; aceptación integral: 2026-10-20. **Estado:** fase4 aprobada y fase5 validada localmente, cierre pendiente ACK. Habilitación persistente pendiente. [Evidencia y procedimiento](31_bi_statistics_validation_and_rollout.md).
**Referencias:** [plan](../plan/2026-10-19_feat-bi-analitica-estadistica.md), [contrato](../modules/api-bi-statistics.md), [datos](28_bi_statistics_data.md), [motor](29_bi_statistics_worker.md), [interfaz](../modules/web-business-intelligence.md).

## Acoplamiento y habilitación posterior

`GET /api/v1/bi/statistics` lee una publicación compatible de `dw`, sin consultar jobs ni calcular. La lectura comparte una transacción RR READ ONLY UTC con el último corte base, reloj DW e inicios de cobertura, mediante la conexión BI existente (SQL5s/lock1s/tx10s/pool2). Preferencias de vigencia se leen por el servicio técnico vigente. La API no abre conexiones nuevas de estadísticas ni altera readiness.

JWT y RBAC admin/editor se verifican antes de la bandera/conexión. Tenant exclusivamente de identidad validada; cualquier parámetro query se rechaza. Middleware privado agrega `Cache-Control: private, no-store` también a errores. Se conserva la cuota existente120/min por IP/tenant; su dependencia Redis se simula en los tests HTTP de esta fase, sin afirmar una prueba Redis integral.

El API requiere `BI_ENABLED=true` y `BI_STATISTICS_ENABLED=true`. El worker tiene su opt-in independiente para generar informes. Ambos están apagados por defecto y requieren software/esquema/permisos compatibles; no habilitar sólo la UI ni usar esta guía como autorización de migración/despliegue.

Para un entorno posteriormente autorizado, complementar los grants del lector privado de datos con:

```sql
GRANT SELECT ON dw.statistics_publication, dw.statistics_current TO bi_api_reader;
```

El lector conserva SELECT de `dw.fact_tenant_snapshot`, `dw.fact_tag_snapshot` y los permisos técnicos de preferencias ya existentes. No necesita staging, `etl.statistics_jobs`, DML ni identidad migradora. La fase5 agrega SQL aditivos y preflight con política estadística, probados en PostgreSQL local. Con flags apagados permite conservar grants compatibles; encendidos exige los mínimos nuevos. El control no recibe permisos estadísticos. La validación conectada remota sigue pendiente; consultar la guía de habilitación.

## Estados y errores

- Sin corte: `not_loaded`; con corte sin informe: `pending`. Cantidades desconocidas NULL, sin suponer inventario cero ni insuficiencia histórica. Ventanas ancladas al reloj DW hasta tener informe.
- Publicación compatible y del último run: `current`; una anterior: `outdated`. La frescura se mide desde el corte fuente, según frecuencia+tolerancia; pausa no rejuvenece datos.
- Informe anterior o vencido: conservar histórico/patrones/señales con aviso y retirar estimación (`STALE_PUBLICATION`). Si el objetivo ya no coincide con próximo mes del reloj DW, prevalece `TARGET_OUTDATED`. No se reescribe el payload almacenado.
- Flags:503 `BI_DISABLED` / `BI_STATISTICS_DISABLED`. Esquema, permisos, conexión o JSON inválido:503 `BI_STATISTICS_UNAVAILABLE`, sin detalles SQL. No convertirlo en un informe vacío ni usar OLTP como respaldo.401/403/400/429 mantienen el transporte vigente.

La web valida el contrato con Zod3, separado del Zod4 backend. Sólo recibe metadatos y agregados versionados, nunca texto, autores, jobs o credenciales. La publicación relacional determina tenant/run/corte; el JSON no autoriza acceso.

## Vista y CSV

`/admin/business-intelligence?view=statistics` ofrece pronóstico mensual, minería de patrones y señales diarias. Sus ventanas son independientes del resumen. Entrar desde la navegación elimina filtros heredados; la pantalla lo explica. No agrega polling ni lecturas operativas: actualiza al entrar, volver a la pestaña, botón o reintento. Reutiliza abortos y remount por usuario/tenant/roles; logout o errores400/401/403/404 retiran datos.

Los tres CSV reproducen exclusivamente la respuesta visible validada: conteos decimales exactos, NULL vacío, cero literal, porcentajes en puntos porcentuales, lift como razón y metadatos/estado/motivo. BOM UTF8, CRLF, escape de comillas y neutralización de fórmulas incluso tras espacios/control. Descargas bloqueadas sin publicación, durante actualización o tras error. Sin endpoints de exportación adicionales.

Gráficos con tablas alternativas, señales sin depender del color, captions, foco visible y scroll local para tablas densas. El histórico y el pronóstico tienen marcas diferentes; los huecos no se interpolan. El mes parcial muestra días transcurridos como denominador de cobertura. La interfaz expone inicio general y de etiquetas separados, corte/cálculo, edad y plazo de vigencia.

## Evidencia y límites

Fase4 agrega16 casos backend (4 de presentación,9 HTTP,3 DW) y18 web (10 de contrato/CSV,6 de vista/gráfico,2 de sesión/navegación). Regresión final:255/255 en19 suites backend con dos PostgreSQL18.6 descartables y96/96 en9 archivos web BI. Los tests de autorización usan guardias JWT/RBAC reales con repositorio de identidad y cuota simulados; la lectura DW usa un rol restringido sólo `dw`. JSON estructuralmente válido pero incompatible se rechaza sin afectar el inventario base.

Revisión local de Chrome en1440×1000 y390×844, con sesión/respuestas sintéticas: sin desborde horizontal de página, CSV de patrones descargado y comprobado, detalle diario operable y actualización manual sin consultas a `/bi/status`. El modo desarrollo puede duplicar la lectura inicial por StrictMode; no se afirmó frecuencia productiva a partir de ese conteo. No es E2E completo con API/CMS reales ni certificación WCAG. Build, typecheck y lint de ambos workspaces se verifican en el plan; warnings previos se conservan.

La fase5 verifica restauración integral, rendimiento con/sin ampliación y recorrido real API/worker/Redis/navegador según la [guía de aceptación](31_bi_statistics_validation_and_rollout.md). La evidencia de los párrafos anteriores corresponde a fase4 y conserva sus límites de simulación. Aceptación remota y utilidad predictiva sobre historial real siguen pendientes. No se aplicaron migraciones persistentes ni cambios a infraestructura, Prisma schema o despliegue.
