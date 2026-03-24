-- Extend existing baseline schema to full PRD runtime model.

ALTER TABLE IF EXISTS tenants
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS users
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS refresh_tokens
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now();

ALTER TABLE IF EXISTS testimonials
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category_id UUID,
  ADD COLUMN IF NOT EXISTS created_by_id UUID,
  ADD COLUMN IF NOT EXISTS moderation_notes TEXT;

CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_category_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_tag_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS testimonial_tags (
  testimonial_id UUID NOT NULL,
  tag_id UUID NOT NULL,
  PRIMARY KEY (testimonial_id, tag_id),
  CONSTRAINT fk_tt_testimonial FOREIGN KEY (testimonial_id) REFERENCES testimonials(id),
  CONSTRAINT fk_tt_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS analytics_event_types (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  CONSTRAINT uq_event_type UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  testimonial_id UUID NOT NULL,
  event_type_id SMALLINT NOT NULL,
  source TEXT NOT NULL DEFAULT 'public',
  ip_hash TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_ae_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ae_testimonial FOREIGN KEY (testimonial_id) REFERENCES testimonials(id),
  CONSTRAINT fk_ae_type FOREIGN KEY (event_type_id) REFERENCES analytics_event_types(id)
);

CREATE TABLE IF NOT EXISTS webhook_events (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  CONSTRAINT uq_webhook_event UNIQUE (code)
);

CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  url TEXT NOT NULL,
  event_id SMALLINT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  secret TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_webhook_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_webhook_event FOREIGN KEY (event_id) REFERENCES webhook_events(id)
);

CREATE TABLE IF NOT EXISTS outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  processed_at TIMESTAMP,
  CONSTRAINT fk_outbox_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  outbox_event_id UUID,
  status TEXT NOT NULL,
  attempts INT NOT NULL DEFAULT 0,
  response_code INT,
  response_body TEXT,
  error_message TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_delivery_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks(id),
  CONSTRAINT fk_delivery_outbox FOREIGN KEY (outbox_event_id) REFERENCES outbox_events(id)
);

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  CONSTRAINT uq_flag_name UNIQUE (name)
);

CREATE TABLE IF NOT EXISTS tenant_feature_flags (
  tenant_id UUID NOT NULL,
  feature_flag_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, feature_flag_id),
  CONSTRAINT fk_tff_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_tff_flag FOREIGN KEY (feature_flag_id) REFERENCES feature_flags(id)
);

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_used_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_api_key_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL,
  tenant_id UUID NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  status_code INT NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_idempotency_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  metadata JSONB,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT fk_audit_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id)
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_testimonial_category'
  ) THEN
    ALTER TABLE testimonials
      ADD CONSTRAINT fk_testimonial_category FOREIGN KEY (category_id) REFERENCES categories(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_testimonial_created_by'
  ) THEN
    ALTER TABLE testimonials
      ADD CONSTRAINT fk_testimonial_created_by FOREIGN KEY (created_by_id) REFERENCES users(id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_category ON categories(tenant_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uq_tag ON tags(tenant_id, name);
CREATE INDEX IF NOT EXISTS idx_categories_tenant ON categories(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tags_tenant ON tags(tenant_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_category ON testimonials(tenant_id, category_id);
CREATE INDEX IF NOT EXISTS idx_analytics_testimonial ON analytics_events(testimonial_id);
CREATE INDEX IF NOT EXISTS idx_analytics_tenant_time ON analytics_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhooks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_outbox ON webhook_deliveries(outbox_event_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_outbox_status ON outbox_events(status);
CREATE INDEX IF NOT EXISTS idx_outbox_tenant ON outbox_events(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_idempotency_key ON idempotency_keys(key, tenant_id, method, path);
CREATE INDEX IF NOT EXISTS idx_idempotency_tenant ON idempotency_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_time ON audit_logs(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_time ON audit_logs(user_id, created_at);

INSERT INTO analytics_event_types (code) VALUES
  ('view'),
  ('click'),
  ('play')
ON CONFLICT (code) DO NOTHING;

INSERT INTO webhook_events (code) VALUES
  ('testimonial.created'),
  ('testimonial.published')
ON CONFLICT (code) DO NOTHING;

INSERT INTO feature_flags (name, description) VALUES
  ('enable_analytics', 'Enable analytics dashboard and tracking'),
  ('enable_webhooks', 'Enable webhook event delivery'),
  ('enable_scoring', 'Enable testimonial scoring strategy')
ON CONFLICT (name) DO NOTHING;