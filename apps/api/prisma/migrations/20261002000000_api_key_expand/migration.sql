-- Expand: old binaries keep using key_hash/is_active during the compatibility window.
ALTER TABLE "api_keys" ALTER COLUMN "key_hash" DROP NOT NULL;
ALTER TABLE "api_keys" ADD COLUMN "owner_id" UUID;
ALTER TABLE "api_keys" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "api_keys" ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "api_keys" ADD COLUMN "expires_at" TIMESTAMP(3);
ALTER TABLE "api_keys" ADD COLUMN "revoked_at" TIMESTAMP(3);
ALTER TABLE "api_keys" ADD COLUMN "rotation_version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "api_keys" ADD COLUMN "legacy_valid_until" TIMESTAMP(3);
UPDATE "api_keys" SET "status" = 'REVOKED', "revoked_at" = "updated_at"
WHERE "is_active" = false;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_fkey"
  FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "api_key_credentials" (
  "id" UUID NOT NULL,
  "api_key_id" UUID NOT NULL,
  "public_id" TEXT NOT NULL,
  "secret_digest" VARCHAR(64) NOT NULL,
  "pepper_version" INTEGER NOT NULL,
  "environment" TEXT NOT NULL,
  "scopes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_key_credentials_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "api_key_credentials_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "api_key_credentials_environment_check" CHECK ("environment" IN ('live', 'test')),
  CONSTRAINT "api_key_credentials_status_check" CHECK ("status" IN ('ACTIVE', 'ROTATING')),
  CONSTRAINT "api_key_credentials_digest_check" CHECK ("secret_digest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "api_key_credentials_pepper_version_check" CHECK ("pepper_version" > 0),
  CONSTRAINT "api_key_credentials_scopes_check"
    CHECK ("scopes" <@ ARRAY['testimonials:read', 'analytics:write']::TEXT[])
);
CREATE UNIQUE INDEX "uq_api_key_credentials_public_id" ON "api_key_credentials"("public_id");
CREATE INDEX "idx_api_key_credentials_parent" ON "api_key_credentials"("api_key_id", "created_at");
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_status_check" CHECK ("status" IN ('ACTIVE', 'REVOKED'));
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_scopes_check"
  CHECK ("scopes" <@ ARRAY['testimonials:read', 'analytics:write']::TEXT[]);
