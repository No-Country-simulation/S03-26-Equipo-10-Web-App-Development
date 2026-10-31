-- BORRADOR FASE 1. No es una migración aplicada ni la fuente de Prisma.
-- Requiere ACK de fase 2, revisión de Prisma/DDL y pruebas PG18 descartables.
-- Sólo expansión. No modifica objetos existentes ni almacena credenciales.
BEGIN;

CREATE TABLE billing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE CHECK (code ~ '^[a-z][a-z0-9_-]{0,63}$'),
  archived_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE billing_plan_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES billing_plans(id) ON DELETE RESTRICT,
  version integer NOT NULL CHECK (version > 0),
  revision bigint NOT NULL DEFAULT 0 CHECK (revision BETWEEN 0 AND 9007199254740991),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 2000),
  trial_days integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  grace_days integer NOT NULL DEFAULT 7 CHECK (grace_days >= 0),
  media boolean NOT NULL, analytics boolean NOT NULL, scoring boolean NOT NULL,
  business_intelligence boolean NOT NULL, bi_statistics boolean NOT NULL,
  api_keys boolean NOT NULL, webhooks boolean NOT NULL,
  active_users bigint CHECK (active_users BETWEEN 0 AND 9007199254740991),
  stored_testimonials bigint CHECK (stored_testimonials BETWEEN 0 AND 9007199254740991),
  active_api_keys bigint CHECK (active_api_keys BETWEEN 0 AND 9007199254740991),
  active_webhooks bigint CHECK (active_webhooks BETWEEN 0 AND 9007199254740991),
  published_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  UNIQUE (plan_id, version),
  CHECK (NOT bi_statistics OR business_intelligence),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE TABLE billing_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_version_id uuid NOT NULL REFERENCES billing_plan_versions(id) ON DELETE RESTRICT,
  provider text NOT NULL CHECK (provider IN ('stripe','mercadopago')),
  currency text NOT NULL CHECK (currency IN ('USD','ARS')),
  interval text NOT NULL CHECK (interval IN ('month','year')),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  manual_enabled boolean NOT NULL, automatic_enabled boolean NOT NULL,
  UNIQUE (plan_version_id, provider, currency, interval),
  UNIQUE (id, plan_version_id, provider),
  CHECK ((provider = 'stripe' AND currency = 'USD') OR (provider = 'mercadopago' AND currency = 'ARS')),
  CHECK (manual_enabled OR automatic_enabled)
);

CREATE TABLE billing_provider_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL CHECK (provider IN ('stripe','mercadopago')),
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  seller_id text NOT NULL CHECK (seller_id <> ''),
  application_id text,
  configuration_key text NOT NULL CHECK (configuration_key ~ '^[A-Z][A-Z0-9_]{0,63}$'),
  enabled boolean NOT NULL DEFAULT false,
  UNIQUE (provider, environment),
  UNIQUE (id, provider, environment),
  UNIQUE (id, environment)
);

CREATE TABLE billing_price_bindings (
  price_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  provider text NOT NULL,
  provider_account_id uuid NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','ready','failed')),
  external_product_id text,
  external_price_id text,
  error_code text,
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (price_id, provider_account_id),
  FOREIGN KEY (price_id, plan_version_id, provider) REFERENCES billing_prices(id, plan_version_id, provider) ON DELETE RESTRICT,
  FOREIGN KEY (provider_account_id, provider, environment) REFERENCES billing_provider_accounts(id, provider, environment) ON DELETE RESTRICT
);
CREATE INDEX idx_billing_bindings_account ON billing_price_bindings(provider_account_id);

CREATE TABLE billing_platform_operators (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  granted_at timestamptz(3) NOT NULL DEFAULT now(),
  revoked_at timestamptz(3),
  CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE TABLE billing_accounts (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE RESTRICT,
  enforcement_enabled boolean NOT NULL DEFAULT false,
  policy_revision bigint NOT NULL DEFAULT 0 CHECK (policy_revision BETWEEN 0 AND 9007199254740991),
  trial_consumed_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now()
);

CREATE TABLE billing_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
  provider_account_id uuid NOT NULL REFERENCES billing_provider_accounts(id) ON DELETE RESTRICT,
  external_customer_id text NOT NULL CHECK (external_customer_id <> ''),
  UNIQUE (tenant_id, provider_account_id),
  UNIQUE (provider_account_id, external_customer_id),
  UNIQUE (tenant_id, id, provider_account_id)
);

CREATE TABLE billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
  environment text NOT NULL,
  provider text NOT NULL,
  provider_account_id uuid NOT NULL,
  price_id uuid NOT NULL,
  plan_version_id uuid NOT NULL,
  customer_id uuid,
  mode text NOT NULL CHECK (mode IN ('manual','automatic')),
  status text NOT NULL CHECK (status IN ('pending','active','past_due','cancel_pending','canceled','ended')),
  external_subscription_id text,
  renewal_stopped_at timestamptz(3),
  anchor_day smallint NOT NULL CHECK (anchor_day BETWEEN 1 AND 31),
  paid_through timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (provider_account_id, external_subscription_id),
  FOREIGN KEY (provider_account_id, provider, environment) REFERENCES billing_provider_accounts(id, provider, environment) ON DELETE RESTRICT,
  FOREIGN KEY (price_id, plan_version_id, provider) REFERENCES billing_prices(id, plan_version_id, provider) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, customer_id, provider_account_id) REFERENCES billing_customers(tenant_id, id, provider_account_id) ON DELETE RESTRICT,
  CHECK (mode <> 'manual' OR external_subscription_id IS NULL)
);
CREATE UNIQUE INDEX uq_billing_subscription_open ON billing_subscriptions(tenant_id, environment)
  WHERE status IN ('pending','active','past_due','cancel_pending');
CREATE INDEX idx_billing_subscriptions_price ON billing_subscriptions(price_id);
CREATE INDEX idx_billing_subscriptions_customer ON billing_subscriptions(tenant_id, customer_id, provider_account_id);
CREATE INDEX idx_billing_subscriptions_account ON billing_subscriptions(provider_account_id);

CREATE TABLE billing_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  subscription_id uuid NOT NULL,
  external_reference text NOT NULL CHECK (external_reference <> ''),
  status text NOT NULL DEFAULT 'created' CHECK (status IN ('created','pending','paid','expired','canceled')),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, subscription_id),
  UNIQUE (external_reference),
  FOREIGN KEY (tenant_id, environment, subscription_id) REFERENCES billing_subscriptions(tenant_id, environment, id) ON DELETE RESTRICT
);
CREATE INDEX idx_billing_orders_subscription ON billing_orders(tenant_id, environment, subscription_id);

CREATE TABLE billing_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  order_id uuid NOT NULL UNIQUE,
  subscription_id uuid NOT NULL,
  provider_account_id uuid NOT NULL,
  cycle_key text NOT NULL CHECK (cycle_key <> ''),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency IN ('ARS','USD')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','paid','void')),
  credited_payment_id uuid,
  due_at timestamptz(3),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, provider_account_id),
  UNIQUE (tenant_id, environment, id, credited_payment_id),
  UNIQUE (subscription_id, cycle_key),
  FOREIGN KEY (tenant_id, environment, order_id, subscription_id) REFERENCES billing_orders(tenant_id, environment, id, subscription_id) ON DELETE RESTRICT,
  FOREIGN KEY (tenant_id, environment, subscription_id) REFERENCES billing_subscriptions(tenant_id, environment, id) ON DELETE RESTRICT,
  FOREIGN KEY (provider_account_id, environment) REFERENCES billing_provider_accounts(id, environment) ON DELETE RESTRICT,
  CHECK (status <> 'paid' OR credited_payment_id IS NOT NULL)
);
CREATE INDEX idx_billing_obligations_account ON billing_obligations(provider_account_id);

CREATE TABLE billing_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  obligation_id uuid NOT NULL,
  provider_account_id uuid NOT NULL,
  external_payment_id text NOT NULL CHECK (external_payment_id <> ''),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency IN ('ARS','USD')),
  refunded_minor bigint NOT NULL DEFAULT 0,
  status text NOT NULL CHECK (status IN ('pending','failed','canceled','succeeded','partially_refunded','refunded','charged_back')),
  provider_status text NOT NULL,
  observed_at timestamptz(3) NOT NULL,
  UNIQUE (tenant_id, environment, id),
  UNIQUE (tenant_id, environment, id, provider_account_id),
  UNIQUE (tenant_id, environment, obligation_id, id),
  UNIQUE (provider_account_id, external_payment_id),
  FOREIGN KEY (tenant_id, environment, obligation_id, provider_account_id) REFERENCES billing_obligations(tenant_id, environment, id, provider_account_id) ON DELETE RESTRICT,
  CHECK (refunded_minor BETWEEN 0 AND amount_minor),
  CHECK (status <> 'refunded' OR refunded_minor = amount_minor),
  CHECK (status <> 'partially_refunded' OR (refunded_minor > 0 AND refunded_minor < amount_minor))
);
ALTER TABLE billing_obligations ADD CONSTRAINT fk_billing_credited_payment
  FOREIGN KEY (tenant_id, environment, id, credited_payment_id) REFERENCES billing_payments(tenant_id, environment, obligation_id, id) ON DELETE RESTRICT;

CREATE TABLE billing_access_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
  environment text NOT NULL CHECK (environment IN ('sandbox','live')),
  plan_version_id uuid NOT NULL REFERENCES billing_plan_versions(id) ON DELETE RESTRICT,
  kind text NOT NULL CHECK (kind IN ('trial','paid')),
  obligation_id uuid,
  payment_id uuid,
  starts_at timestamptz(3) NOT NULL,
  ends_at timestamptz(3) NOT NULL,
  revoked_at timestamptz(3),
  CHECK (ends_at > starts_at),
  CHECK ((kind = 'trial' AND obligation_id IS NULL AND payment_id IS NULL) OR (kind = 'paid' AND obligation_id IS NOT NULL AND payment_id IS NOT NULL)),
  FOREIGN KEY (tenant_id, environment, obligation_id, payment_id) REFERENCES billing_obligations(tenant_id, environment, id, credited_payment_id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_billing_trial_once ON billing_access_periods(tenant_id) WHERE kind = 'trial';
CREATE UNIQUE INDEX uq_billing_grant_once ON billing_access_periods(obligation_id) WHERE kind = 'paid';
CREATE INDEX idx_billing_access_tenant ON billing_access_periods(tenant_id, environment, ends_at);
CREATE INDEX idx_billing_access_version ON billing_access_periods(plan_version_id);

CREATE TABLE billing_subscription_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  source_subscription_id uuid NOT NULL,
  target_price_id uuid NOT NULL REFERENCES billing_prices(id) ON DELETE RESTRICT,
  target_mode text NOT NULL CHECK (target_mode IN ('manual','automatic')),
  effective_at timestamptz(3) NOT NULL,
  status text NOT NULL CHECK (status IN ('requested','cancel_pending','awaiting_checkout','completed','canceled')),
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, environment, source_subscription_id) REFERENCES billing_subscriptions(tenant_id, environment, id) ON DELETE RESTRICT
);
CREATE UNIQUE INDEX uq_billing_change_pending ON billing_subscription_changes(source_subscription_id)
  WHERE status IN ('requested','cancel_pending','awaiting_checkout');
CREATE INDEX idx_billing_changes_tenant ON billing_subscription_changes(tenant_id, environment, source_subscription_id);
CREATE INDEX idx_billing_changes_price ON billing_subscription_changes(target_price_id);

CREATE TABLE billing_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
  environment text NOT NULL,
  provider_account_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('sync_catalog','checkout','stop_renewal','reconcile')),
  entity_id uuid NOT NULL,
  idempotency_key text NOT NULL CHECK (idempotency_key ~ '^[A-Za-z0-9._~-]{1,128}$'),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  request_data jsonb NOT NULL CHECK (jsonb_typeof(request_data) = 'object'),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','processing','succeeded','uncertain','review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz(3) NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz(3),
  external_resource_id text,
  error_code text,
  created_at timestamptz(3) NOT NULL DEFAULT now(),
  updated_at timestamptz(3) NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (tenant_id, provider_account_id, kind, idempotency_key),
  FOREIGN KEY (provider_account_id, environment) REFERENCES billing_provider_accounts(id, environment) ON DELETE RESTRICT,
  CHECK ((status = 'processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (status <> 'processing' AND lease_token IS NULL AND lease_until IS NULL)),
  CHECK (tenant_id IS NOT NULL OR kind = 'sync_catalog')
);
CREATE INDEX idx_billing_operations_ready ON billing_operations(next_attempt_at, id) WHERE status IN ('ready','uncertain');
CREATE INDEX idx_billing_operations_lease ON billing_operations(lease_until) WHERE status = 'processing';

CREATE TABLE billing_webhook_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment text NOT NULL,
  provider_account_id uuid NOT NULL,
  event_key text NOT NULL CHECK (event_key <> ''),
  topic text NOT NULL,
  resource_id text NOT NULL CHECK (resource_id <> ''),
  received_at timestamptz(3) NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'ready' CHECK (status IN ('ready','processing','completed','review')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  next_attempt_at timestamptz(3) NOT NULL DEFAULT now(),
  lease_token uuid,
  lease_until timestamptz(3),
  error_code text,
  UNIQUE (provider_account_id, event_key),
  FOREIGN KEY (provider_account_id, environment) REFERENCES billing_provider_accounts(id, environment) ON DELETE RESTRICT,
  CHECK ((status = 'processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL) OR (status <> 'processing' AND lease_token IS NULL AND lease_until IS NULL))
);
CREATE INDEX idx_billing_inbox_ready ON billing_webhook_inbox(next_attempt_at, id) WHERE status = 'ready';
CREATE INDEX idx_billing_inbox_lease ON billing_webhook_inbox(lease_until) WHERE status = 'processing';

CREATE TABLE billing_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  environment text NOT NULL,
  payment_id uuid NOT NULL,
  provider_account_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('refund','chargeback')),
  external_adjustment_id text NOT NULL CHECK (external_adjustment_id <> ''),
  amount_minor bigint NOT NULL CHECK (amount_minor > 0),
  currency text NOT NULL CHECK (currency IN ('ARS','USD')),
  provider_status text NOT NULL,
  confirmed boolean NOT NULL,
  observed_at timestamptz(3) NOT NULL,
  UNIQUE (provider_account_id, kind, external_adjustment_id),
  FOREIGN KEY (tenant_id, environment, payment_id, provider_account_id) REFERENCES billing_payments(tenant_id, environment, id, provider_account_id) ON DELETE RESTRICT,
  FOREIGN KEY (provider_account_id, environment) REFERENCES billing_provider_accounts(id, environment) ON DELETE RESTRICT
);
CREATE INDEX idx_billing_adjustments_payment ON billing_adjustments(tenant_id, environment, payment_id);

CREATE TABLE billing_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES billing_accounts(tenant_id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  environment text CHECK (environment IN ('sandbox','live')),
  action text NOT NULL,
  entity_id uuid NOT NULL,
  correlation_id uuid NOT NULL,
  previous_state text,
  next_state text NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT now()
);
CREATE INDEX idx_billing_audit_tenant ON billing_audit(tenant_id, created_at, id);
CREATE INDEX idx_billing_audit_actor ON billing_audit(actor_id);

-- Obligaciones adicionales del repositorio (fase 2):
-- 1. Bloquear billing_accounts por tenant antes de medir/mutar cuotas o trial.
-- 2. No UPDATE/DELETE de términos/precios publicados; crear una versión nueva.
-- 3. Comprobar plan/precio/cuenta/moneda/modo/order/subscription consistentes.
-- 4. Insertar pago + asignación de credited_payment_id + grant + auditoría ACID.
-- 5. Revocación de período, refunds acumulados y fencing condicional ACID.
-- 6. Guardar sólo IDs, importes y parámetros permitidos en request_data; sin PII.
-- 7. Nunca habilitar acceso live mediante grants/observaciones sandbox.
COMMIT;
