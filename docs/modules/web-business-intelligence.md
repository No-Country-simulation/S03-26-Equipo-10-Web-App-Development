# Interfaz de inteligencia de negocio

**Estado:** frontend implementado y aceptación integral local de fase5 completada; despliegue pendiente. [Evidencia y habilitación](../operations/23_bi_validation_and_release.md). [Plan HITL](../plan/2026-10-09_feat-interfaces-operacion-bi.md), [contratos HTTP](api-bi-operations.md).

## Entrada, roles y navegación

`/admin/business-intelligence` compone la pantalla del feature mediante Suspense. La sesión vigente (`useSession`) proporciona el transporte privado con cookies, recuperación y CSRF; no se introducen credenciales ni almacenamiento de tokens. NestJS autoriza cada consulta y mutación y obtiene el tenant de sesión.

| Vista | Admin | Editor | Contenido |
| --- | --- | --- | --- |
| Resumen | Consulta y CSV | Consulta y CSV | Indicadores, vigencia, estados, categorías, gráfico con cortes ausentes y tabla diaria. |
| Ejecuciones | Consulta | Consulta | Solicitudes e intentos paginados de forma independiente, filtros UTC/estado/origen. |
| Detalle | Consulta y acciones permitidas | Consulta | Fase, tiempos, cantidades conocidas, resultado y explicación segura; solicitud con intentos asociados. |
| Operación | Solicitar, reintentar y cancelar pendiente | Consulta | Señal del worker, programación, presupuesto, actividad y motivos de bloqueo del servidor. |
| Configuración | Edición versionada | Sólo lectura | Frecuencia 1/6/24 h, pausa y avisos de fallos/atrasos con tolerancia 30/60/120 min. |
| Auditoría | Consulta | Sin acceso | Actor técnico, instante, solicitud y configuración anterior/posterior. |

`view`, `from`, `to`, `page`, `requestPage`, `status`, `origin`, `requestStatus`, `run` y `request` viven en URL. Los enlaces conservan filtros y eliminan detalles al cambiar de vista. Fechas reales UTC, máximo 366 días hasta hoy; 30 días por defecto. Un enlace inválido se explica sin consultar la API. Listas de 20 filas; paginación validada desde `meta` del envelope, nunca inventada.

## Lecturas y aislamiento

Los adaptadores validan datos con Zod, preservan cantidades decimales y diferencias entre NULL y cero. Sólo se cargan las listas/detalles de la vista seleccionada. El estado operativo se consulta cada 30 s en las vistas válidas y cada 5 s si hay actividad de la empresa. Historial activo y detalles pendientes/en ejecución usan 5 s; detalles terminados dejan de consultar periódicamente. Configuración, auditoría y resumen se actualizan al entrar, al volver a la pestaña o mediante «Actualizar vista».

Las lecturas se programan después de terminar la anterior, sin solapamientos. Se abortan al ocultar la pestaña, desmontar o cambiar filtros y se descartan respuestas obsoletas. Al volver se consulta inmediatamente. Errores de validación, permisos, recurso ausente, cuotas y banderas detienen el polling automático; una lectura temporalmente fallida conserva el último resultado con aviso. 400/401/403/404 retiran datos retenidos. No hay caché compartida entre identidades: el workspace se remonta al cambiar usuario, empresa o roles, incluyendo las mutaciones pendientes del navegador.

## Operaciones y configuración

«Actualizar vista» sólo realiza lecturas. «Ejecutar ahora» solicita POST con clave de idempotencia y abre el enlace de seguimiento tras recibir aceptación. El estado de carga se obtiene de GET requests; aceptación nunca se presenta como publicación completada. Las solicitudes sobreviven al cierre de la página en el warehouse, como define el backend.

Un bloqueo síncrono evita dobles envíos. Ante respuesta ambigua se conserva en memoria el mismo cuerpo y clave: «Repetir solicitud con la misma clave» recupera el resultado durable. No hay reenvíos automáticos ni cambio de intención mientras esa respuesta permanece incierta. El backend conserva su idempotencia aunque se cierre la página; el cliente no persiste claves en almacenamiento del navegador. Al desmontar, una respuesta de mutación no navega ni modifica otra sesión.

Las acciones se habilitan con los permisos y motivos del servidor. Un reintento vincula el fallo y observa el estado actual. Sólo se cancela una solicitud pendiente, con transición confirmada por API; no se ofrece interrupción forzada.

El formulario envía `expectedVersion`. Tras conflicto o respuesta incierta conserva los campos y exige consultar la versión vigente. Muestra las preferencias guardadas y ofrece usar esa configuración o conservar los campos editados sobre la nueva versión, manteniendo los valores vigentes de los campos no editados, antes de otro guardado explícito. No copia automáticamente respuestas nuevas encima de una edición de admin. En editor, la vista se renueva cuando cambia la versión consultada.

## CSV y accesibilidad

Cuatro archivos independientes se generan desde el resultado visible autorizado: resumen, estados, categorías y serie diaria. Incluyen rango, UTC y corte/publicación; BOM UTF-8, CRLF y celdas entre comillas con escape de comillas internas. Los textos que puedan iniciar una fórmula reciben apóstrofo, incluso tras espacios/control. Las cantidades grandes permanecen cadenas decimales; NULL queda vacío y los cortes ausentes tienen marca `sin_corte`. No se agregaron dependencias.

La UI utiliza los tokens HSL y primitivas existentes; navegación semántica, `aria-current`, formularios etiquetados, fieldsets, avisos accesibles, foco visible y tablas con captions. Tablas densas tienen contenedor con scroll horizontal; navegación y acciones envuelven en móvil. Los errores técnicos se traducen a mensajes seguros, sin mostrar SQL, stack, conexiones o tokens de métricas.

## Evidencia y límites

Pruebas de contratos, UI, permisos, sesión, idempotencia, polling, configuración y CSV en el feature, más regresión web. La revisión móvil/teclado de fase4 usa una API sintética. Fase5 agrega un recorrido con navegador, API real del CMS, worker CLI independiente, dos PostgreSQL18.6 y Redis7 descartables: solicitud pendiente, cierre, nueva sesión y resultado correcto. Las pruebas verifican restauración, privilegios y caída OLAP aislada; el benchmark registra costo local de polling. Estas pruebas no certifican capacidad productiva ni auditoría WCAG completa. Los instantes usan UTC y ciclo explícito de24h para distinguir medianoche de mediodía. `BI_OPERATIONS_ENABLED` permanece desactivada por defecto; no se modificó infraestructura ni se aplicaron migraciones persistentes.
