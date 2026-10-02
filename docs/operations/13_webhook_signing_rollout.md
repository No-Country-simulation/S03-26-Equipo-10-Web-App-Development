# Firmas salientes y migración de secretos de webhooks

**Estado:** preparado localmente en la Fase 7 del [plan HITL](../plan/2026-09-30_chore-endurecimiento-seguridad.md). No se aplicaron migraciones ni infraestructura a entornos persistentes.

## Contrato del receptor

Cada POST lleva `X-TMS-Event-Id` (UUID estable en todos los reintentos), `X-TMS-Schema-Version: 1` y `X-TMS-Signature: t=<segundos>,v1=<hex>`. El cuerpo JSON incluye `id`, `schemaVersion`, `eventType`, `tenantId`, `payload`, `outboxEventId` y `sentAt`. La firma HMAC-SHA-256 usa el secreto del destino como clave y los bytes exactos `ASCII(t) + "." + rawBody` como mensaje. El receptor debe leer el cuerpo crudo antes de parsearlo, rechazar una marca de tiempo con más de cinco minutos de diferencia y comparar el digest en tiempo constante. Durante una rotación puede haber dos valores `v1` en el mismo header; aceptar cualquiera dentro de esa ventana. Una firma válida no reemplaza la deduplicación: guardar el ID del evento junto con el efecto de negocio en una transacción.

Ejemplo Node.js de verificación, antes de procesar el JSON:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

function verify(rawBody: Buffer, header: string, secret: string, now = Math.floor(Date.now() / 1000)) {
  const parts = header.split(',').map(part => part.trim());
  const timestampText = parts.find(part => /^t=\d+$/.test(part))?.slice(2);
  if (!timestampText) return false;
  const timestamp = Number(timestampText);
  if (!Number.isSafeInteger(timestamp) || Math.abs(now - timestamp) > 300) return false;
  const digest = createHmac('sha256', secret)
    .update(timestampText).update('.').update(rawBody).digest();
  return parts.some(part => /^v1=[0-9a-f]{64}$/.test(part) &&
    timingSafeEqual(digest, Buffer.from(part.slice(3), 'hex')));
}
```

En Express, configurar `express.raw({ type: 'application/json' })` para esa ruta y verificar `req.body` antes de deserializar. Mantener relojes sincronizados. No registrar el secreto ni el header de firma. Para un secreto rotado, instalar el nuevo en el receptor antes de que termine la gracia de **24 horas**; el anterior deja de firmar al vencer.

## Despliegue expand–migrate–contract

1. Generar una clave AES de 32 bytes con CSPRNG, codificada en base64url, e inyectarla desde el gestor de secretos como `WEBHOOK_SECRET_KEYS_JSON`, por ejemplo `{"1":"<base64url>"}`. Establecer `WEBHOOK_SECRET_CURRENT_VERSION=1`. No commitear ni imprimir el valor. `WEBHOOK_SIGNATURE_LEGACY_STARTED_AT` se fija en UTC al **primer despliegue compatible**; no cambiarlo entre réplicas ni reinicios. Alinear `WEBHOOK_LEGACY_HTTP_STARTED_AT` con el corte HTTP de la Fase 2 según su despliegue real.
2. Con autorización de base persistente separada, aplicar la migración de expansión `20261002010000_webhook_secrets_expand`. Actualizar todas las réplicas API y web, y drenar los procesos antiguos que aún escriben `webhooks.secret` en texto plano. Durante el cambio, el lector acepta tanto el campo legado como el cifrado.
3. Hacer copia de seguridad y ejecutar `npm run webhooks:encrypt-legacy --workspace @testimonial-cms/api` en modo de inspección. Con aprobación específica, repetir con `-- --apply` para cifrar secretos legados y limpiar el campo en texto plano. Verificar que `SELECT count(*) FROM webhooks WHERE secret IS NOT NULL` da cero. La operación usa comparación de estado para no pisar una rotación concurrente; repetir si hay nuevas filas pendientes. Las cadenas legadas vacías se limpian como destinos sin firma.
4. Mostrar a cada administrador los avisos `legacyUnsigned`, `legacyHttp` y `legacySignatureUntil` desde el listado. Migrar destinos HTTP a HTTPS y rotar los que no tengan firma. El procesador suspende automáticamente los destinos legados sin firma o HTTP cuando termina su ventana de 30 días. Durante la ventana, `X-Signature` se emite solo para destinos legados que tenían secreto; los nuevos usan únicamente `X-TMS-Signature`.
5. Observar entregas y errores en staging antes del despliegue gradual a producción. Verificar firmas actuales/anteriores, rechazos por replay y deduplicación real en un receptor de prueba. Revisar que los logs y las respuestas GET no contienen secretos. La Fase 8 cubre alertas, métricas y retiro del campo y header legados después del plazo y de confirmar ausencia de uso.

Para rotar la **clave de cifrado de la aplicación**, agregar una versión nueva al JSON, configurar `WEBHOOK_SECRET_CURRENT_VERSION` a esa versión en todas las réplicas y conservar las versiones anteriores mientras exista cualquier `secret_key_version` o `previous_secret_key_version` que las use. La rotación de secretos por destino reescribe con la versión nueva. Un cambio de clave de aplicación no requiere que el receptor cambie su secreto.

## Rollback

Mientras existan destinos cifrados, un binario anterior que solo lee `webhooks.secret` no puede firmar sus entregas. Volver a la versión compatible de Fase 7, mantener todas las versiones de clave requeridas y suspender el procesador antiguo. No revertir la migración de expansión ni restaurar secretos en texto plano. El contrato de entrega conserva el mismo ID y cuerpo al reintentar; el receptor debe tolerar duplicados.
