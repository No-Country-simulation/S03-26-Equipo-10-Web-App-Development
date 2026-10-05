# Corte de integridad entre tenants

Esta migración agrega `tenant_id` obligatorio a `testimonial_tags` y
`webhook_deliveries`, FK compuestas y el mínimo de 10 caracteres del testimonio.
El corte está preparado para la demostración futura; no se aplicó a ninguna base
persistente. El binario anterior no puede crear tags ni entregas después del corte.

## Antes del corte

1. Probar un respaldo y su restauración en una copia aislada de PostgreSQL 18.
2. Ejecutar `apps/api/prisma/checks/tenant-integrity-preflight.sql` primero en
   la copia y luego en la base de destino. Las siete cuentas deben ser cero.
   Si alguna es positiva, detener el corte y corregir las filas con una revisión
   de dominio; no reasignar `tenant_id` automáticamente.
3. Drenar todas las réplicas de la API y sus procesadores de outbox. Confirmar
   que no quedan escritores de la versión anterior.
4. Obtener el ACK separado requerido por `AGENTS.md` antes de ejecutar
   `prisma migrate deploy` sobre cualquier entorno. No usar `db push`.

## Corte y comprobación

1. Aplicar la migración versionada `20261004000000_tenant_integrity` como parte
   del despliegue coordinado y arrancar sólo la API con Prisma Client generado
   desde el esquema nuevo.
2. Comprobar readiness, creación y edición de testimonios con tags, emisión de
   eventos con entregas y ausencia de filas cruzadas en el preflight.
3. Revisar errores de FK y métricas del outbox antes de reabrir tráfico.

La migración aborta dentro de una transacción si encuentra datos incompatibles.
Si Prisma registra una migración fallida, resolver ese estado mediante el
procedimiento de recuperación de Prisma antes de reintentar. Volver al binario
anterior por sí solo no es un rollback válido: restaurar la copia verificada o
preparar un escritor compatible con el esquema nuevo.
