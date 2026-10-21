# Facturación del CMS: producto y controles comerciales

Fase 4. Usar junto con [persistencia y operador](32_billing_persistence.md), [integraciones y claves externas](33_billing_integrations.md) y el [contrato API](../modules/api-billing.md). Esta guía no acredita aceptación sandbox externa ni habilita producción.

## Preparación del entorno

1. Aplicar el historial OLTP por el proceso de migración autorizado. La migración aditiva `20261020010000_billing_bi_policy_export` agrega sólo una vista de política mínima para el lector BI; no cambia Prisma ni el warehouse. En esta fase se ejecutó únicamente en PostgreSQL propio descartable con ACK específico.
2. Mantener `BILLING_MODE=disabled` hasta preparar configuración. Sin claves y en disabled, el CMS funciona normalmente, las prestaciones comerciales no restringen y la pantalla informa que la facturación está desactivada. La política opt-in de cada tenant se conserva en BD.
3. Para simulación local, inyectar `BILLING_MODE=simulation` y `BILLING_CONFIG_JSON` según la guía 33: `returnUrl` del frontend terminado en `/admin/billing/return` y `simulationKey` externa aleatoria. El proveedor, sus firmas y el calendario se simulan; no hay pagos reales. Este modo se rechaza en producción.
4. Para sandbox, inyectar configuración/credenciales del servidor descritas en la guía 33. Stripe y Mercado Pago son integraciones independientes. Mantener vendedor, aplicación, ambiente y cuenta esperados; el CMS verifica su identidad. No cargar secretos en el panel ni en variables `NEXT_PUBLIC_*`.
5. Conceder operador por CLI UUID según guía 32. El admin tenant no puede concederse este permiso; la UI no ofrece asignarlo. La revocación se comprueba en BD en cada solicitud.
6. Abrir `/platform/billing`, registrar la cuenta no secreta y preparar catálogo. Crear plan, guardar versión borrador, revisar prestaciones/cuotas/precios, publicar y sincronizar cada precio con su cuenta. Publicar hace inmutables los términos; sincronizar es una operación durable separada. En simulación, el tick explícito de `worker.cli.ts` en la [guía 35](35_billing_acceptance.md#worker-explícito-para-operación-local) procesa sincronizaciones/cancelaciones; el worker automático funciona únicamente en sandbox.
7. Habilitar el control comercial por UUID de tenant desde el panel, con la revisión actual. Es opt-in: habilitarlo sin prueba o cobertura deja el tenant en consulta. El operador puede deshabilitarlo de nuevo. Se auditan ambas acciones.

Deshabilitar una cuenta del proveedor detiene trabajo local contra ella; **no cancela** los débitos remotos existentes. Coordinar cancelación/reconciliación antes de usar ese interruptor. Cambiar vendedor o referencia de una cuenta existente se rechaza: no reutilizar identidades financieras entre cuentas o ambientes.

## Catálogo y contratación

Precios independientes USD/Stripe y ARS/MP, mensual/anual, compra manual o renovación automática. Configurar sólo combinaciones elegibles para la cuenta. El checkout alojado determina los métodos disponibles; no se promete que todos permitan recurrencia. Todos los importes HTTP son cadenas enteras en unidades menores; el formulario transforma exactamente el punto decimal a centavos.

El administrador abre `/admin/billing`: ve acceso, fin de cobertura/gracia en UTC, uso, funciones, cuotas, modalidades e historial paginado. La prueba se inicia expresamente una vez por tenant sin tarjeta. No se cobra automáticamente al terminar. Un pago confirmado inicia el período pago y termina la prueba; visitar un retorno nunca concede acceso.

El retorno contiene únicamente el UUID de operación generado por el servidor. La pantalla consulta el backend cada 3 segundos por hasta un minuto y luego conserva la consulta manual. Pendiente, rechazo y revisión no conceden acceso. No recrear un cobro por timeout; la operación durable conserva identidad y se reconcilia. Un checkout ya cerrado sin URL recuperable exige revisión; no se fuerza una sesión nueva ni se abandona una obligación impaga desde el navegador.

El cambio de plan/moneda/proveedor/modalidad programa cancelación y conserva la cobertura paga. Al vencimiento y tras confirmar la baja, el cliente acepta una nueva adhesión. No se migran tarjetas ni hay prorrateos. Retirar la intención de cambio no reactiva una renovación cancelada. Una obligación anterior sin resolver bloquea el reemplazo aunque se haya detenido la adhesión.

## Funciones, capacidad y conservación

Cada prestación combina RBAC, flag técnico y permiso comercial. Un flag técnico no amplía el plan. Cuotas cero bloquean nuevas altas; vacío en el editor representa sin límite. Contar usuarios activos incluido admin, todos los testimonios, API keys padre vigentes y destinos webhook activos. Las escrituras de creación/activación/rotación y captura pública comprueban capacidad en su transacción bajo el lock de cuenta del tenant. La rotación de key conserva un solo cupo padre. Una reducción de plan conserva datos e impide aumentos mientras se exceda la capacidad.

Tras vencimiento y gracia paga, conservar sesión, consulta, facturación, revocación de API keys/destinos y contenido publicado. Denegar nuevas mutaciones del CMS. No hay gracia para contratación inicial impaga ni prueba vencida. El formulario público omite multimedia cuando no está incluida; el backend también lo comprueba.

Las entregas webhook quedan `suspended` y conservan destinatarios, intentos y auditoría. No se envían ni se consumen nuevos intentos mientras falta permiso; al recuperar elegibilidad se extiende el presupuesto por el tiempo suspendido. Un lease vencido puede suspenderse sin convertir el mensaje en dead sólo por el tiempo de suspensión. La revocación técnica del destino sigue aplicando.

BI detiene nuevas extracciones/publicaciones cuando falta acceso o prestación. Estadística avanzada exige ambos bits BI y estadística; el lector conserva consultas históricas. También se comprueban tareas ya en cola antes de leer/calcular/publicar: la suspensión difiere la reserva con fencing, preserva los intentos anteriores y no suma otro intento por la pausa. Los candidatos se recorren en lotes con cursor para que tenants suspendidos no oculten a los elegibles. El worker debe recibir el mismo `BILLING_MODE` que la API. Con modo activo, otorgar al rol lector fuente únicamente `USAGE ON SCHEMA bi_export` y `SELECT ON bi_export.billing_policy`, además de sus vistas ya autorizadas. La vista no exporta pagos, importes, identificadores de suscripción, secretos ni pagadores. No otorgar SELECT a tablas financieras. Un fallo de política impide publicar; no asumir elegibilidad.

## Operación y límites de evidencia

El panel muestra últimas 50 operaciones, recepciones, pagos y auditorías de discrepancias. `ledger.review` requiere investigar y reconciliar el recurso original; `payment.additional` señala cobro adicional sin segundo período. El CMS observa devoluciones/contracargos, pero no los inicia. Una devolución total o pérdida confirmada invalida el período asociado; una parcial conserva duración. No borrar ledger/auditoría para desbloquear una contratación.

La evidencia se divide en: dominio/simulador local, HTTP y PostgreSQL real descartable, componentes web con mocks, e inspección visual Chrome con HTTP sintético. Ninguna sustituye checkout/adhesión/renovación en sandbox de los dos proveedores. La fase 5 requiere ACK propio y cuentas externas elegibles; E2E completo, sandbox y producción no se dan por aprobados en esta fase.

La aceptación de navegador/API/BD y la preparación del sandbox externo se describen en la [guía 35](35_billing_acceptance.md). No usar el simulador local como evidencia de débitos de prueba de un proveedor.
