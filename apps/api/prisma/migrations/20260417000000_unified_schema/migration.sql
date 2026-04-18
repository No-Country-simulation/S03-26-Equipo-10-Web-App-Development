-- Unified schema migration for Testimonial CMS
-- Roles: admin, editor (only)
-- No user_profiles table

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE "tenants" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "public_slug" TEXT,
    "is_public_form_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "uq_tenants_name" ON "tenants"("name");
CREATE UNIQUE INDEX "uq_tenants_public_slug" ON "tenants"("public_slug");

-- ============================================================
-- RBAC: ROLES & PERMISSIONS
-- ============================================================
CREATE TABLE "roles" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "roles_code_key" ON "roles"("code");

CREATE TABLE "permissions" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "permissions_code_key" ON "permissions"("code");

CREATE TABLE "role_permissions" (
    "role_id" INT NOT NULL,
    "permission_id" INT NOT NULL,
    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("role_id", "permission_id"),
    CONSTRAINT "fk_rp_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_rp_permission" FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- ============================================================
-- USERS & AUTH
-- ============================================================
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_users_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "uq_users_email" ON "users"("email");
CREATE INDEX "idx_users_tenant" ON "users"("tenant_id");

CREATE TABLE "user_roles" (
    "user_id" UUID NOT NULL,
    "role_id" INT NOT NULL,
    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("user_id", "role_id"),
    CONSTRAINT "fk_ur_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "fk_ur_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "token_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT FALSE,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_rt_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens"("user_id");

-- ============================================================
-- TESTIMONIALS
-- ============================================================
CREATE TABLE "testimonial_status" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "testimonial_status_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "testimonial_status_code_key" ON "testimonial_status"("code");

CREATE TABLE "categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "categories_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_category_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE UNIQUE INDEX "uq_category" ON "categories"("tenant_id", "name");
CREATE INDEX "idx_categories_tenant" ON "categories"("tenant_id");

CREATE TABLE "tags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "tags_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_tag_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE UNIQUE INDEX "uq_tag" ON "tags"("tenant_id", "name");
CREATE INDEX "idx_tags_tenant" ON "tags"("tenant_id");

CREATE TABLE "testimonials" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "content" TEXT NOT NULL,
    "author_name" TEXT NOT NULL,
    "rating" INT NOT NULL,
    "status_id" INT NOT NULL,
    "category_id" UUID,
    "created_by_id" UUID,
    "moderation_notes" TEXT,
    "image_url" TEXT,
    "video_url" TEXT,
    "video_title" TEXT,
    "video_thumbnail_url" TEXT,
    "score" NUMERIC(10,4) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "published_at" TIMESTAMP,
    CONSTRAINT "testimonials_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "chk_rating" CHECK ("rating" BETWEEN 1 AND 5),
    CONSTRAINT "fk_testimonial_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_testimonial_status" FOREIGN KEY ("status_id") REFERENCES "testimonial_status"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "fk_testimonial_category" FOREIGN KEY ("category_id") REFERENCES "categories"("id"),
    CONSTRAINT "fk_testimonial_created_by" FOREIGN KEY ("created_by_id") REFERENCES "users"("id")
);
CREATE INDEX "idx_testimonials_tenant_status" ON "testimonials"("tenant_id", "status_id");
CREATE INDEX "idx_testimonials_score" ON "testimonials"("score" DESC);
CREATE INDEX "idx_testimonials_category" ON "testimonials"("tenant_id", "category_id");

CREATE TABLE "testimonial_tags" (
    "testimonial_id" UUID NOT NULL,
    "tag_id" UUID NOT NULL,
    CONSTRAINT "testimonial_tags_pkey" PRIMARY KEY ("testimonial_id", "tag_id"),
    CONSTRAINT "fk_tt_testimonial" FOREIGN KEY ("testimonial_id") REFERENCES "testimonials"("id"),
    CONSTRAINT "fk_tt_tag" FOREIGN KEY ("tag_id") REFERENCES "tags"("id")
);

-- ============================================================
-- ANALYTICS
-- ============================================================
CREATE TABLE "analytics_event_types" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "analytics_event_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "analytics_event_types_code_key" ON "analytics_event_types"("code");

CREATE TABLE "analytics_events" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID NOT NULL,
    "testimonial_id" UUID NOT NULL,
    "event_type_id" INT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'public',
    "ip_hash" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_ae_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
    CONSTRAINT "fk_ae_testimonial" FOREIGN KEY ("testimonial_id") REFERENCES "testimonials"("id"),
    CONSTRAINT "fk_ae_type" FOREIGN KEY ("event_type_id") REFERENCES "analytics_event_types"("id")
);
CREATE INDEX "idx_analytics_testimonial" ON "analytics_events"("testimonial_id");
CREATE INDEX "idx_analytics_tenant_time" ON "analytics_events"("tenant_id", "created_at");

-- ============================================================
-- WEBHOOKS
-- ============================================================
CREATE TABLE "webhook_events" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "webhook_events_code_key" ON "webhook_events"("code");

CREATE TABLE "webhooks" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "url" TEXT NOT NULL,
    "event_id" INT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "secret" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "webhooks_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_webhook_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
    CONSTRAINT "fk_webhook_event" FOREIGN KEY ("event_id") REFERENCES "webhook_events"("id")
);
CREATE INDEX "idx_webhooks_tenant" ON "webhooks"("tenant_id");

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INT NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "next_retry_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    "processed_at" TIMESTAMP,
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_outbox_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE INDEX "idx_outbox_status" ON "outbox_events"("status");
CREATE INDEX "idx_outbox_tenant" ON "outbox_events"("tenant_id");

CREATE TABLE "webhook_deliveries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "webhook_id" UUID NOT NULL,
    "outbox_event_id" UUID,
    "status" TEXT NOT NULL,
    "attempts" INT NOT NULL DEFAULT 0,
    "response_code" INT,
    "response_body" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_delivery_webhook" FOREIGN KEY ("webhook_id") REFERENCES "webhooks"("id"),
    CONSTRAINT "fk_delivery_outbox" FOREIGN KEY ("outbox_event_id") REFERENCES "outbox_events"("id")
);
CREATE INDEX "idx_webhook_deliveries_webhook" ON "webhook_deliveries"("webhook_id");
CREATE INDEX "idx_webhook_deliveries_outbox" ON "webhook_deliveries"("outbox_event_id");

-- ============================================================
-- FEATURE FLAGS
-- ============================================================
CREATE TABLE "feature_flags" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "feature_flags_name_key" ON "feature_flags"("name");

CREATE TABLE "tenant_feature_flags" (
    "tenant_id" UUID NOT NULL,
    "feature_flag_id" UUID NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "tenant_feature_flags_pkey" PRIMARY KEY ("tenant_id", "feature_flag_id"),
    CONSTRAINT "fk_tff_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
    CONSTRAINT "fk_tff_flag" FOREIGN KEY ("feature_flag_id") REFERENCES "feature_flags"("id")
);

-- ============================================================
-- API KEYS
-- ============================================================
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tenant_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
    "last_used_at" TIMESTAMP,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_api_key_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE INDEX "idx_api_keys_tenant" ON "api_keys"("tenant_id");
CREATE INDEX "idx_api_keys_hash" ON "api_keys"("key_hash");

-- ============================================================
-- IDEMPOTENCY
-- ============================================================
CREATE TABLE "idempotency_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "status_code" INT NOT NULL,
    "response_body" JSONB NOT NULL,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_idempotency_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id")
);
CREATE UNIQUE INDEX "uq_idempotency_key" ON "idempotency_keys"("key", "tenant_id", "method", "path");
CREATE INDEX "idx_idempotency_tenant" ON "idempotency_keys"("tenant_id");

-- ============================================================
-- AUDIT LOGS
-- ============================================================
CREATE TABLE "audit_logs" (
    "id" BIGSERIAL NOT NULL,
    "tenant_id" UUID,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMP NOT NULL DEFAULT now(),
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "fk_audit_tenant" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id"),
    CONSTRAINT "fk_audit_user" FOREIGN KEY ("user_id") REFERENCES "users"("id")
);
CREATE INDEX "idx_audit_logs_tenant_time" ON "audit_logs"("tenant_id", "created_at");
CREATE INDEX "idx_audit_logs_user_time" ON "audit_logs"("user_id", "created_at");

-- ============================================================
-- CATALOG DATA: Only admin & editor roles
-- ============================================================
INSERT INTO "roles" ("code", "description") VALUES
  ('admin', 'Tenant administrator'),
  ('editor', 'Tenant editor')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "permissions" ("code", "description") VALUES
  ('create:testimonial', 'Create testimonials'),
  ('approve:testimonial', 'Approve testimonials'),
  ('publish:testimonial', 'Publish testimonials'),
  ('manage:users', 'Manage tenant users'),
  ('manage:webhooks', 'Manage tenant webhooks'),
  ('manage:api_keys', 'Manage tenant api keys')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "testimonial_status" ("code") VALUES
  ('draft'), ('pending'), ('approved'), ('published'), ('rejected')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "analytics_event_types" ("code") VALUES
  ('view'), ('click'), ('play')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "webhook_events" ("code") VALUES
  ('testimonial.created'), ('testimonial.published')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "feature_flags" ("name", "description") VALUES
  ('enable_analytics', 'Enable analytics dashboard and tracking'),
  ('enable_webhooks', 'Enable webhook event delivery'),
  ('enable_scoring', 'Enable testimonial scoring strategy'),
  ('testimonials', 'Enable testimonials public API')
ON CONFLICT ("name") DO NOTHING;
