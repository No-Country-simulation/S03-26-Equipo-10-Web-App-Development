-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tenants
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_tenants_name" ON "tenants"("name");

-- RBAC
CREATE TABLE "roles" (
    "id" SMALLSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_roles_code" ON "roles"("code");

CREATE TABLE "permissions" (
    "id" SMALLSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_permissions_code" ON "permissions"("code");

CREATE TABLE "role_permissions" (
    "role_id" SMALLINT NOT NULL,
    "permission_id" SMALLINT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id")
);

-- Users
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id");

CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" SMALLINT NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id")
);

-- Auth
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- Testimonials
CREATE TABLE "testimonial_status" (
    "id" SMALLSERIAL NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "testimonial_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_testimonial_status_code" ON "testimonial_status"("code");

CREATE TABLE "testimonials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "status_id" SMALLINT NOT NULL,
    "score" NUMERIC(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "published_at" TIMESTAMP,
    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_rating" CHECK ("rating" BETWEEN 1 AND 5)
);
CREATE INDEX "idx_testimonials_tenant_status" ON "testimonials"("tenant_id", "status_id");
CREATE INDEX "idx_testimonials_score" ON "testimonials"("score" DESC);

ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_rp_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "role_permissions" ADD CONSTRAINT "fk_rp_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "users" ADD CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_ur_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_roles" ADD CONSTRAINT "fk_ur_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "fk_rt_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "testimonials" ADD CONSTRAINT "fk_testimonial_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "testimonials" ADD CONSTRAINT "fk_testimonial_status" FOREIGN KEY ("status_id") REFERENCES "testimonial_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "roles" ("code", "description") VALUES
  ('admin', 'Tenant administrator'),
  ('editor', 'Tenant editor')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("code", "description") VALUES
  ('create:testimonial', 'Create testimonials'),
  ('approve:testimonial', 'Approve testimonials'),
  ('publish:testimonial', 'Publish testimonials'),
  ('manage:users', 'Manage tenant users')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "testimonial_status" ("code") VALUES
  ('draft'),
  ('pending'),
  ('approved'),
  ('published'),
  ('rejected')
ON CONFLICT ("code") DO NOTHING;
