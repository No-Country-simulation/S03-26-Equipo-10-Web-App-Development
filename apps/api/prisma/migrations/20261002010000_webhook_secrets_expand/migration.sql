-- Expand: keep the plaintext legacy reader until the compatible API is deployed
-- and the separately authorized backfill has encrypted existing secrets.
ALTER TABLE "webhooks" ADD COLUMN "secret_ciphertext" TEXT;
ALTER TABLE "webhooks" ADD COLUMN "secret_key_version" INTEGER;
ALTER TABLE "webhooks" ADD COLUMN "previous_secret_ciphertext" TEXT;
ALTER TABLE "webhooks" ADD COLUMN "previous_secret_key_version" INTEGER;
ALTER TABLE "webhooks" ADD COLUMN "previous_secret_valid_until" TIMESTAMP(3);
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_current_secret_pair_check"
  CHECK (("secret_ciphertext" IS NULL) = ("secret_key_version" IS NULL));
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_previous_secret_pair_check"
  CHECK (("previous_secret_ciphertext" IS NULL) = ("previous_secret_key_version" IS NULL));
ALTER TABLE "webhooks" ADD CONSTRAINT "webhooks_previous_secret_deadline_check"
  CHECK (("previous_secret_ciphertext" IS NULL) = ("previous_secret_valid_until" IS NULL));
