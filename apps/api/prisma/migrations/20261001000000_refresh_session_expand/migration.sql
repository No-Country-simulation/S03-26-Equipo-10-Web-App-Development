-- Expand first: old binaries can keep writing refresh_tokens without family_id.
CREATE TABLE "refresh_sessions" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "refresh_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "refresh_tokens" ADD COLUMN "family_id" UUID;

-- Each pre-existing token becomes its own family. Revoked tokens retain their
-- history so reuse can be detected during the compatibility window.
WITH legacy AS (
  SELECT id, user_id, expires_at, revoked, gen_random_uuid() AS family_id
  FROM refresh_tokens
  WHERE family_id IS NULL
), inserted AS (
  INSERT INTO refresh_sessions (id, user_id, expires_at, revoked_at)
  SELECT family_id, user_id, expires_at,
    CASE WHEN revoked THEN CURRENT_TIMESTAMP ELSE NULL END
  FROM legacy
  RETURNING id
)
UPDATE refresh_tokens AS token
SET family_id = legacy.family_id
FROM legacy
WHERE token.id = legacy.id;

CREATE UNIQUE INDEX "uq_refresh_tokens_hash" ON "refresh_tokens"("token_hash");
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id");
CREATE INDEX "idx_refresh_sessions_user_active" ON "refresh_sessions"("user_id", "revoked_at");
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_family_id_fkey"
  FOREIGN KEY ("family_id") REFERENCES "refresh_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
