-- The old rows lack a trustworthy principal and request fingerprint. Keep them
-- in a legacy scope until expiry; new readers never replay them.
ALTER TABLE "idempotency_keys"
  ADD COLUMN "principal_kind" TEXT,
  ADD COLUMN "principal_id" TEXT,
  ADD COLUMN "request_hash" VARCHAR(64),
  ADD COLUMN "record_state" TEXT,
  ADD COLUMN "expires_at" TIMESTAMPTZ(3);

UPDATE "idempotency_keys"
SET "principal_kind" = 'legacy',
    "principal_id" = 'legacy',
    "request_hash" = repeat('0', 64),
    "record_state" = 'completed',
    "expires_at" = "created_at" + interval '24 hours';

ALTER TABLE "idempotency_keys"
  ALTER COLUMN "principal_kind" SET NOT NULL,
  ALTER COLUMN "principal_id" SET NOT NULL,
  ALTER COLUMN "request_hash" SET NOT NULL,
  ALTER COLUMN "record_state" SET NOT NULL,
  ALTER COLUMN "expires_at" SET NOT NULL,
  ALTER COLUMN "status_code" DROP NOT NULL,
  ALTER COLUMN "response_body" DROP NOT NULL;

ALTER TABLE "idempotency_keys"
  ADD CONSTRAINT "ck_idempotency_principal_kind"
    CHECK ("principal_kind" IN ('legacy', 'user', 'api_key')),
  ADD CONSTRAINT "ck_idempotency_request_hash"
    CHECK ("request_hash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "ck_idempotency_record_state"
    CHECK (
      ("record_state" = 'pending' AND "status_code" IS NULL AND "response_body" IS NULL)
      OR ("record_state" = 'completed' AND "status_code" BETWEEN 100 AND 599 AND "response_body" IS NOT NULL)
    );

DROP INDEX "uq_idempotency_key";
CREATE UNIQUE INDEX "uq_idempotency_scope"
  ON "idempotency_keys"("tenant_id", "principal_kind", "principal_id", "method", "path", "key");
CREATE INDEX "idx_idempotency_expires_at" ON "idempotency_keys"("expires_at");
