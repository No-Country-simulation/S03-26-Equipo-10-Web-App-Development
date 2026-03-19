-- EXTENSIONS

CREATE EXTENSION IF NOT EXISTS "pgcrypto";


-- TENANTS

CREATE TABLE tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT uq_tenants_name UNIQUE (name)
);


-- RBAC

CREATE TABLE roles (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  CONSTRAINT uq_roles_code UNIQUE (code)
);

CREATE TABLE permissions (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  description TEXT,
  CONSTRAINT uq_permissions_code UNIQUE (code)
);

CREATE TABLE role_permissions (
  role_id SMALLINT NOT NULL,
  permission_id SMALLINT NOT NULL,
  PRIMARY KEY (role_id, permission_id),

  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id),
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id)
);


-- USERS

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  email TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_users_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT uq_users_email UNIQUE (email)
);

CREATE TABLE user_roles (
  user_id UUID NOT NULL,
  role_id SMALLINT NOT NULL,
  PRIMARY KEY (user_id, role_id),

  CONSTRAINT fk_ur_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_ur_role FOREIGN KEY (role_id) REFERENCES roles(id)
);


-- AUTH

CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  revoked BOOLEAN DEFAULT FALSE,

  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id)
);


-- TESTIMONIAL STATUS (CATALOG)

CREATE TABLE testimonial_status (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  CONSTRAINT uq_testimonial_status_code UNIQUE (code)
);


-- TESTIMONIALS

CREATE TABLE testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT NOT NULL,
  rating INT NOT NULL,
  status_id SMALLINT NOT NULL,
  score NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  published_at TIMESTAMP,

  CONSTRAINT fk_testimonial_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_testimonial_status FOREIGN KEY (status_id) REFERENCES testimonial_status(id),
  CONSTRAINT chk_rating CHECK (rating BETWEEN 1 AND 5)
);


-- CATEGORIES

CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,

  CONSTRAINT fk_category_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT uq_category UNIQUE (tenant_id, name)
);


-- TAGS

CREATE TABLE tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,

  CONSTRAINT fk_tag_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT uq_tag UNIQUE (tenant_id, name)
);


-- TESTIMONIAL TAGS (M:N)

CREATE TABLE testimonial_tags (
  testimonial_id UUID NOT NULL,
  tag_id UUID NOT NULL,

  PRIMARY KEY (testimonial_id, tag_id),

  CONSTRAINT fk_tt_testimonial FOREIGN KEY (testimonial_id) REFERENCES testimonials(id),
  CONSTRAINT fk_tt_tag FOREIGN KEY (tag_id) REFERENCES tags(id)
);


-- ANALYTICS

CREATE TABLE analytics_event_types (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  CONSTRAINT uq_event_type UNIQUE (code)
);

CREATE TABLE analytics_events (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL,
  testimonial_id UUID NOT NULL,
  event_type_id SMALLINT NOT NULL,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_ae_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_ae_testimonial FOREIGN KEY (testimonial_id) REFERENCES testimonials(id),
  CONSTRAINT fk_ae_type FOREIGN KEY (event_type_id) REFERENCES analytics_event_types(id)
);


-- WEBHOOKS

CREATE TABLE webhook_events (
  id SMALLSERIAL PRIMARY KEY,
  code TEXT NOT NULL,
  CONSTRAINT uq_webhook_event UNIQUE (code)
);

CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  url TEXT NOT NULL,
  event_id SMALLINT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  secret TEXT,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_webhook_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_webhook_event FOREIGN KEY (event_id) REFERENCES webhook_events(id)
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID NOT NULL,
  status TEXT NOT NULL,
  attempts INT DEFAULT 0,
  response_code INT,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_delivery_webhook FOREIGN KEY (webhook_id) REFERENCES webhooks(id)
);


-- FEATURE FLAGS

CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  CONSTRAINT uq_flag_name UNIQUE (name)
);

CREATE TABLE tenant_feature_flags (
  tenant_id UUID NOT NULL,
  feature_flag_id UUID NOT NULL,
  enabled BOOLEAN DEFAULT TRUE,

  PRIMARY KEY (tenant_id, feature_flag_id),

  CONSTRAINT fk_tff_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT fk_tff_flag FOREIGN KEY (feature_flag_id) REFERENCES feature_flags(id)
);


-- API KEYS

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  key_hash TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT now(),

  CONSTRAINT fk_api_key_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id)
);


-- OUTBOX PATTERN

CREATE TABLE outbox_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT now(),
  processed_at TIMESTAMP,

  CONSTRAINT fk_outbox_tenant FOREIGN KEY (tenant_id) REFERENCES tenants(id),
  CONSTRAINT chk_outbox_status CHECK (status IN ('pending','processed','failed'))
);


-- INDEXES

CREATE INDEX idx_users_tenant ON users(tenant_id);

CREATE INDEX idx_testimonials_tenant_status
ON testimonials(tenant_id, status_id);

CREATE INDEX idx_testimonials_score
ON testimonials(score DESC);

CREATE INDEX idx_analytics_testimonial
ON analytics_events(testimonial_id);

CREATE INDEX idx_analytics_tenant_time
ON analytics_events(tenant_id, created_at);

CREATE INDEX idx_outbox_status
ON outbox_events(status);


-- SEED DATA (BASIC CATALOGS)


INSERT INTO roles (code) VALUES ('admin'), ('editor');

INSERT INTO permissions (code) VALUES
('create:testimonial'),
('approve:testimonial'),
('publish:testimonial');

INSERT INTO testimonial_status (code) VALUES
('draft'),
('pending'),
('approved'),
('published'),
('rejected');

INSERT INTO analytics_event_types (code) VALUES
('view'),
('click'),
('play');

INSERT INTO webhook_events (code) VALUES
('testimonial.published'),
('testimonial.created');

INSERT INTO feature_flags (name) VALUES
('enable_analytics'),
('enable_webhooks'),
('enable_scoring');