-- Interpret historical timestamp values as UTC only after their provenance is confirmed.
-- Empty databases (including fresh CI databases) are safe without the session marker.
-- For existing rows, set tms.utc_timestamp_provenance=confirmed on the migration
-- connection only after following docs/operations/16_timestamp_utc_cutover.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL TIME ZONE 'UTC';

DO $$
DECLARE
    table_name text;
    has_rows boolean;
BEGIN
    IF current_setting('tms.utc_timestamp_provenance', true) IS DISTINCT FROM 'confirmed' THEN
        FOREACH table_name IN ARRAY ARRAY[
            'tenants',
            'users',
            'refresh_tokens',
            'refresh_sessions',
            'categories',
            'tags',
            'testimonials',
            'analytics_events',
            'webhooks',
            'webhook_deliveries',
            'webhook_delivery_attempts',
            'tenant_feature_flags',
            'api_keys',
            'api_key_credentials',
            'outbox_events',
            'idempotency_keys',
            'audit_logs'
        ] LOOP
            EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I)', table_name) INTO has_rows;
            IF has_rows THEN
                RAISE EXCEPTION 'timestamp UTC provenance is unconfirmed for table %', table_name;
            END IF;
        END LOOP;
    END IF;
END
$$;

ALTER TABLE "tenants"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "users"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "refresh_tokens"
    ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "refresh_sessions"
    ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "revoked_at" TYPE TIMESTAMPTZ(3) USING "revoked_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "categories"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "tags"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "testimonials"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "published_at" TYPE TIMESTAMPTZ(3) USING "published_at" AT TIME ZONE 'UTC';

ALTER TABLE "analytics_events"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "webhooks"
    ALTER COLUMN "previous_secret_valid_until" TYPE TIMESTAMPTZ(3) USING "previous_secret_valid_until" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "deleted_at" TYPE TIMESTAMPTZ(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "webhook_deliveries"
    ALTER COLUMN "retry_budget_started_at" TYPE TIMESTAMPTZ(3) USING "retry_budget_started_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "next_retry_at" TYPE TIMESTAMPTZ(3) USING "next_retry_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "lease_until" TYPE TIMESTAMPTZ(3) USING "lease_until" AT TIME ZONE 'UTC',
    ALTER COLUMN "finished_at" TYPE TIMESTAMPTZ(3) USING "finished_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "webhook_delivery_attempts"
    ALTER COLUMN "started_at" TYPE TIMESTAMPTZ(3) USING "started_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "completed_at" TYPE TIMESTAMPTZ(3) USING "completed_at" AT TIME ZONE 'UTC';

ALTER TABLE "tenant_feature_flags"
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "api_keys"
    ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "revoked_at" TYPE TIMESTAMPTZ(3) USING "revoked_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "legacy_valid_until" TYPE TIMESTAMPTZ(3) USING "legacy_valid_until" AT TIME ZONE 'UTC',
    ALTER COLUMN "last_used_at" TYPE TIMESTAMPTZ(3) USING "last_used_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "api_key_credentials"
    ALTER COLUMN "expires_at" TYPE TIMESTAMPTZ(3) USING "expires_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

ALTER TABLE "outbox_events"
    ALTER COLUMN "next_retry_at" TYPE TIMESTAMPTZ(3) USING "next_retry_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "processed_at" TYPE TIMESTAMPTZ(3) USING "processed_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "deliveries_initialized_at" TYPE TIMESTAMPTZ(3) USING "deliveries_initialized_at" AT TIME ZONE 'UTC';

ALTER TABLE "idempotency_keys"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC',
    ALTER COLUMN "updated_at" TYPE TIMESTAMPTZ(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "audit_logs"
    ALTER COLUMN "created_at" TYPE TIMESTAMPTZ(3) USING "created_at" AT TIME ZONE 'UTC';

COMMIT;
