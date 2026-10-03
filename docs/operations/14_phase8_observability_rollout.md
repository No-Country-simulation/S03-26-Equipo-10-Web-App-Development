# Fase 8: observabilidad y despliegue gradual

**Estado:** código e instrucciones locales en preparación. No hay evidencia de staging, producción ni alertas activas. El [plan HITL](../plan/2026-09-30_chore-endurecimiento-seguridad.md) no se cierra con una prueba local.

## Contratos operativos

- La API acepta JSON general de hasta **1 MiB**. Los dos POST que transportan imágenes aceptan JSON de hasta 14 MiB para el overhead base64 y verifican una imagen decodificada de **10 MiB** como máximo antes de persistirla o enviarla a Cloudinary. El cliente web rechaza archivos mayores antes de leerlos.
- Los listados administrativos de testimonios, usuarios, claves, destinos, entregas, categorías y etiquetas reciben `page` y `limit` (1 y 20 por defecto, 100 máximo) y responden `items` y `meta` con `total`.
- El transporte Cloudinary/YouTube no sigue redirecciones ni proxies HTTP implícitos. Los 4xx definitivos no se reintentan; 408, 429, 5xx y errores de red sí. La clave YouTube viaja en `X-Goog-Api-Key`, fuera de la URL. La URL Cloudinary configurada exige HTTPS sin usuario, contraseña, query ni fragmento. Los errores expuestos incluyen solo estado/categoría, no la URL.
- `GET /api/v1/internal/metrics` devuelve formato Prometheus solo con un `x-metrics-token` válido; sin `METRICS_TOKEN` responde 404. Inyectar un token aleatorio desde el gestor de secretos y limitar la ruta a la red de monitoreo. No registrar el token.
- Métricas: `tms_http_requests_total`, `tms_http_request_duration_seconds`, `tms_webhook_attempts_total`, `tms_webhook_deliveries_pending`, `tms_webhook_deliveries_dead`, `tms_outbox_oldest_pending_age_seconds`, `tms_outbox_poll_failures_total` y las métricas de proceso/event loop de `@prometheus-io/client`. Las etiquetas HTTP usan método, patrón de ruta y estado; no contienen tenant, ID de usuario, URL ni secretos.
- `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` activa trazas HTTP/Nest/Prisma/Axios al iniciar Node con `telemetry.js` precargado. El contexto de solicitud expone `x-trace-id` y se incorpora a logs/errores. El colector OTLP y su retención deben configurarse en el entorno; la ausencia de endpoint desactiva la exportación.

## Alertas requeridas

| Condición | Umbral y ventana | Acción |
| --- | --- | --- |
| Entregas `dead` | `tms_webhook_deliveries_dead > 0`, un muestreo confirmado | Abrir incidente, revisar tenant/destino y reenvío administrativo tras resolver la causa. |
| Pendiente antiguo | `tms_outbox_oldest_pending_age_seconds > 300` durante 5 minutos | Comprobar leases, errores de PostgreSQL, capacidad del procesador y destinos lentos. |
| Fallos sostenidos | crecimiento de `tms_outbox_poll_failures_total` o tasa de HTTP 5xx elevada durante 5 minutos | Correlacionar trace ID, logs y salud de PostgreSQL/Redis; escalar si afecta escrituras. |

La fuente puede ser Prometheus u otra plataforma que recopile las mismas series. En AWS, los logs JSON `outbox.health` cada 30 s también permiten filtros y alarmas CloudWatch para `dead` y antigüedad mientras se instala un scraper. Probar cada alarma con datos sintéticos y confirmar recepción en el canal operativo antes de depender de ella. No usar tenant o secreto como dimensión de métrica.

## Puertas de despliegue

1. **CI:** `npm ci`, generación Prisma, migraciones únicamente en PostgreSQL descartable, typecheck, lint, suite API/web con Redis descartable, build de ambas apps, build y smoke de contenedores. Adjuntar URL y SHA de un run verde posterior a este cambio.
2. **Staging:** respaldo y autorización separados para migraciones persistentes; probar un ciclo de registro/login/refresh/logout y CSRF en navegador real, actualización de `localStorage`, aislamiento entre tenants, claves nuevas/legadas, límites entre dos réplicas, SSRF, firmas y reenvío de `dead`. Confirmar 413 para JSON e imagen fuera de límite y navegación de páginas altas. Validar con Cloudinary/YouTube reales que el header de clave YouTube funciona. Verificar scrape protegido, spans OTLP correlacionados y tres alarmas inducidas, sin secretos en logs.
3. **Producción gradual:** desplegar primero los lectores compatibles y secretos versionados, mantener rollback que lee formatos nuevos y viejos; pasar de una réplica/canary a todas solo si errores, latencia, cuotas, antigüedad de outbox y entregas `dead` permanecen aceptables. Registrar SHA, UTC y responsables. No reescribir las fechas `AUTH_LEGACY_STARTED_AT`, `API_KEY_LEGACY_STARTED_AT`, `WEBHOOK_LEGACY_HTTP_STARTED_AT` y `WEBHOOK_SIGNATURE_LEGACY_STARTED_AT` al reiniciar o redeplegar.
4. **Contracción posterior:** solo transcurridos 30 días desde el **primer despliegue compatible** y tras medir ausencia de uso legado, retirar endpoints/headers/lectores/columnas mediante cambio y migración separados. Conservar un lector dual en el rollback mientras existan credenciales o secretos nuevos. Archivar evidencia de métricas, avisos enviados y consultas de uso antes de declarar completa la fase.

## Estado de verificación

Las pruebas locales y sus resultados se registran en el plan HITL. No se ejecutó Terraform `apply`, no se aplicaron migraciones persistentes, no se desplegó staging ni producción y no se activó un canal de alertas. Esos pasos requieren acceso/ACK y evidencia del entorno.
