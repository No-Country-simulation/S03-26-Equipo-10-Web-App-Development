-- Sync schemas: tenants
ALTER TABLE "tenants" 
  ADD COLUMN "public_slug" TEXT,
  ADD COLUMN "is_public_form_enabled" BOOLEAN NOT NULL DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenants_public_slug" ON "tenants"("public_slug");

-- Sync schemas: testimonials
ALTER TABLE "testimonials"
  ADD COLUMN "image_url" TEXT,
  ADD COLUMN "video_url" TEXT,
  ADD COLUMN "video_title" TEXT,
  ADD COLUMN "video_thumbnail_url" TEXT;

-- Sync schemas: user_profiles
CREATE TABLE IF NOT EXISTS "user_profiles" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "first_name" TEXT NOT NULL,
  "last_name" TEXT NOT NULL,
  "avatar_url" TEXT,
  "bio" TEXT,
  "created_at" TIMESTAMP NOT NULL DEFAULT now(),
  "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "fk_up_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "uq_user_profiles_user_id" ON "user_profiles"("user_id");
