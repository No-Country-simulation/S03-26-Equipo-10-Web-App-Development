-- Corte: drenar primero TODOS los procesadores antiguos. El índice único
-- final no admite sus escrituras duplicadas. No ejecutar en base persistente
-- sin autorización separada.
-- Cada fila histórica pasa a ser un intento de una sola entrega
-- lógica por (evento, destino). Los tests antiguos sin evento siguen como
-- historial legado y no compiten con la clave única nullable.
UPDATE "webhook_deliveries" d
SET "destination_url" = w.url FROM "webhooks" w
WHERE w.id = d."webhook_id";
ALTER TABLE "webhook_deliveries" ALTER COLUMN "destination_url" SET NOT NULL;

WITH ranked AS (
    SELECT d.*,
           first_value(d.id) OVER pair AS canonical_id,
           row_number() OVER pair AS attempt_no
    FROM "webhook_deliveries" d
    WHERE d."outbox_event_id" IS NOT NULL
    WINDOW pair AS (PARTITION BY d."outbox_event_id", d."webhook_id" ORDER BY d."created_at", d.id)
)
INSERT INTO "webhook_delivery_attempts"
    ("delivery_id", "attempt_no", "lease_token", "status", "response_code", "response_body", "error_message", "started_at", "completed_at")
SELECT canonical_id, attempt_no, gen_random_uuid(),
       CASE WHEN status = 'success' THEN 'success' ELSE 'failed' END,
       "response_code", "response_body", "error_message", "created_at", "updated_at"
FROM ranked;

WITH grouped AS (
    SELECT first_value(d.id) OVER pair AS canonical_id,
           count(*) OVER (PARTITION BY d."outbox_event_id", d."webhook_id") AS old_attempts,
           bool_or(d.status = 'success') OVER (PARTITION BY d."outbox_event_id", d."webhook_id") AS succeeded
    FROM "webhook_deliveries" d
    WHERE d."outbox_event_id" IS NOT NULL
    WINDOW pair AS (PARTITION BY d."outbox_event_id", d."webhook_id" ORDER BY d."created_at", d.id)
), canonical AS (
    SELECT DISTINCT canonical_id, old_attempts, succeeded FROM grouped
)
UPDATE "webhook_deliveries" d
SET status = CASE WHEN c.succeeded THEN 'success' ELSE 'pending' END,
    attempts = c.old_attempts,
    retry_budget_attempts = c.old_attempts,
    retry_budget_started_at = now(),
    next_retry_at = CASE WHEN c.succeeded THEN NULL ELSE now() END,
    finished_at = CASE WHEN c.succeeded THEN now() ELSE NULL END,
    updated_at = now()
FROM canonical c
WHERE d.id = c.canonical_id;

WITH duplicates AS (
    SELECT id, row_number() OVER (
        PARTITION BY "outbox_event_id", "webhook_id" ORDER BY "created_at", id
    ) AS rank
    FROM "webhook_deliveries" WHERE "outbox_event_id" IS NOT NULL
)
DELETE FROM "webhook_deliveries" d USING duplicates x
WHERE d.id = x.id AND x.rank > 1;

-- Un evento que el worker anterior marcó como processed con destinos fallidos
-- vuelve a pending; de otro modo se conservaría una pérdida silenciosa.
UPDATE "outbox_events" e
SET status = 'pending', processed_at = NULL, deliveries_initialized_at = NULL,
    next_retry_at = NULL, updated_at = now()
WHERE e.status <> 'processed' OR EXISTS (
    SELECT 1 FROM "webhook_deliveries" d
    WHERE d."outbox_event_id" = e.id AND d.status = 'pending'
);
UPDATE "outbox_events" SET deliveries_initialized_at = now()
WHERE status = 'processed';

CREATE UNIQUE INDEX "uq_webhook_delivery_event_destination"
    ON "webhook_deliveries"("outbox_event_id", "webhook_id");
CREATE UNIQUE INDEX "uq_webhook_delivery_attempt_number"
    ON "webhook_delivery_attempts"("delivery_id", "attempt_no");
CREATE INDEX "idx_webhook_delivery_attempts_history"
    ON "webhook_delivery_attempts"("delivery_id", "started_at");
CREATE INDEX "idx_webhook_deliveries_due"
    ON "webhook_deliveries"("status", "next_retry_at");
CREATE INDEX "idx_webhook_deliveries_lease"
    ON "webhook_deliveries"("status", "lease_until");
CREATE INDEX "idx_outbox_needs_delivery_init"
    ON "outbox_events"("created_at")
    WHERE status = 'pending' AND deliveries_initialized_at IS NULL;
