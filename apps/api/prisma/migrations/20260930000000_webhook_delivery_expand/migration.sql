-- Expand: conserva los escritores antiguos hasta el corte coordinado.
-- No ejecutar en una base persistente sin autorización separada.
ALTER TABLE "webhooks" ADD COLUMN "deleted_at" TIMESTAMP;
ALTER TABLE "outbox_events" ADD COLUMN "deliveries_initialized_at" TIMESTAMP;
ALTER TABLE "outbox_events" ADD COLUMN "target_webhook_id" UUID;
ALTER TABLE "webhook_deliveries" ADD COLUMN "retry_budget_attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "webhook_deliveries" ADD COLUMN "retry_budget_started_at" TIMESTAMP NOT NULL DEFAULT now();
ALTER TABLE "webhook_deliveries" ADD COLUMN "next_retry_at" TIMESTAMP;
ALTER TABLE "webhook_deliveries" ADD COLUMN "lease_until" TIMESTAMP;
ALTER TABLE "webhook_deliveries" ADD COLUMN "lease_token" UUID;
ALTER TABLE "webhook_deliveries" ADD COLUMN "finished_at" TIMESTAMP;
ALTER TABLE "webhook_deliveries" ADD COLUMN "destination_url" TEXT;

CREATE TABLE "webhook_delivery_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "delivery_id" UUID NOT NULL,
    "attempt_no" INTEGER NOT NULL,
    "lease_token" UUID NOT NULL,
    "status" TEXT NOT NULL,
    "response_code" INTEGER,
    "response_body" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP NOT NULL DEFAULT now(),
    "completed_at" TIMESTAMP,
    CONSTRAINT "webhook_delivery_attempts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_webhook_delivery_attempt_delivery" FOREIGN KEY ("delivery_id") REFERENCES "webhook_deliveries"("id")
);
