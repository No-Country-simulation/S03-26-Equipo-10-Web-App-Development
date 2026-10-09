-- Control operativo BI. Requiere 0003 y mantenimiento; no habilita la interfaz.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

-- Sin FK a dim_tenant: configurar y solicitar antes de la primera publicación es válido.
CREATE TABLE etl.tenant_settings (
    tenant_id uuid PRIMARY KEY,
    frequency_hours smallint NOT NULL DEFAULT 1,
    schedule_enabled boolean NOT NULL DEFAULT true,
    next_scheduled_at timestamptz(3) DEFAULT (date_trunc('hour', clock_timestamp() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'),
    alert_failures boolean NOT NULL DEFAULT true,
    alert_delays boolean NOT NULL DEFAULT true,
    delay_tolerance_minutes smallint NOT NULL DEFAULT 60,
    version integer NOT NULL DEFAULT 1,
    updated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT ck_bi_settings_frequency CHECK (frequency_hours IN (1, 6, 24)),
    CONSTRAINT ck_bi_settings_tolerance CHECK (delay_tolerance_minutes IN (30, 60, 120)),
    CONSTRAINT ck_bi_settings_version CHECK (version > 0),
    CONSTRAINT ck_bi_settings_schedule CHECK (schedule_enabled = (next_scheduled_at IS NOT NULL)),
    CONSTRAINT ck_bi_settings_hour CHECK (next_scheduled_at IS NULL OR
        next_scheduled_at = date_trunc('hour', next_scheduled_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC')
);

CREATE TABLE etl.load_requests (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    kind text NOT NULL,
    retry_of_run_id uuid,
    idempotency_key text NOT NULL,
    payload_hash text NOT NULL,
    slot_at timestamptz(3) NOT NULL,
    expires_at timestamptz(3) NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    started_at timestamptz(3),
    finished_at timestamptz(3),
    error_code text,
    CONSTRAINT pk_bi_load_requests PRIMARY KEY (id),
    CONSTRAINT uq_bi_load_requests_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_bi_load_requests_run_context UNIQUE (tenant_id, id, kind, slot_at),
    CONSTRAINT uq_bi_load_requests_key UNIQUE (tenant_id, actor_id, idempotency_key),
    CONSTRAINT fk_bi_request_retry FOREIGN KEY (tenant_id, retry_of_run_id) REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT ck_bi_request_kind CHECK ((kind = 'manual' AND retry_of_run_id IS NULL)
        OR (kind = 'retry' AND retry_of_run_id IS NOT NULL)),
    CONSTRAINT ck_bi_request_key CHECK (length(idempotency_key) BETWEEN 1 AND 128 AND idempotency_key !~ '[^A-Za-z0-9._:-]'),
    CONSTRAINT ck_bi_request_hash CHECK (length(payload_hash) = 64 AND payload_hash !~ '[^0-9a-f]'),
    CONSTRAINT ck_bi_request_slot CHECK (
        slot_at = date_trunc('hour', slot_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
        AND expires_at = slot_at + interval '1 hour' AND created_at >= slot_at AND created_at < expires_at),
    CONSTRAINT ck_bi_request_state CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'cancelled', 'expired', 'skipped')),
    CONSTRAINT ck_bi_request_lifecycle CHECK (
        (status = 'pending' AND started_at IS NULL AND finished_at IS NULL)
        OR (status = 'running' AND started_at IS NOT NULL AND finished_at IS NULL)
        OR (status = 'succeeded' AND started_at IS NOT NULL AND finished_at IS NOT NULL)
        OR (status = 'failed' AND finished_at IS NOT NULL)
        OR (status IN ('cancelled', 'expired', 'skipped') AND started_at IS NULL AND finished_at IS NOT NULL)),
    CONSTRAINT ck_bi_request_dates CHECK (
        (started_at IS NULL OR (started_at >= created_at AND started_at < expires_at))
        AND (finished_at IS NULL OR finished_at >= coalesce(started_at, created_at))),
    CONSTRAINT ck_bi_request_error CHECK ((error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,63}$')
        AND (status NOT IN ('pending', 'running', 'succeeded') OR error_code IS NULL)
        AND (status <> 'failed' OR error_code IS NOT NULL))
);

CREATE UNIQUE INDEX uq_bi_request_active ON etl.load_requests (tenant_id) WHERE status IN ('pending', 'running');
CREATE INDEX idx_bi_request_queue ON etl.load_requests (created_at, id) WHERE status = 'pending';
CREATE INDEX idx_bi_request_history ON etl.load_requests (tenant_id, created_at DESC, id DESC);
CREATE INDEX idx_bi_request_retry ON etl.load_requests (tenant_id, retry_of_run_id) WHERE retry_of_run_id IS NOT NULL;

ALTER TABLE etl.runs
    ADD COLUMN request_id uuid,
    ADD COLUMN origin text NOT NULL DEFAULT 'legacy',
    ADD COLUMN phase text,
    ADD COLUMN extraction_completed_at timestamptz(3),
    ADD CONSTRAINT fk_bi_run_request FOREIGN KEY (tenant_id, request_id, origin, slot_at)
        REFERENCES etl.load_requests (tenant_id, id, kind, slot_at),
    ADD CONSTRAINT ck_bi_run_origin CHECK (
        (origin IN ('legacy', 'scheduled', 'cli') AND request_id IS NULL)
        OR (origin IN ('manual', 'retry') AND request_id IS NOT NULL)),
    ADD CONSTRAINT ck_bi_run_phase CHECK (phase IS NULL OR phase IN ('extraction', 'publication')),
    ADD CONSTRAINT ck_bi_run_extraction CHECK (extraction_completed_at IS NULL OR
        (extraction_completed_at >= started_at AND (finished_at IS NULL OR extraction_completed_at <= finished_at)));

CREATE INDEX idx_bi_run_request ON etl.runs (tenant_id, request_id, attempt_no) WHERE request_id IS NOT NULL;
CREATE INDEX idx_bi_run_history ON etl.runs (tenant_id, started_at DESC, id DESC);
CREATE INDEX idx_bi_run_running ON etl.runs (tenant_id, id) WHERE status = 'running';

CREATE TABLE etl.control_audit (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    action text NOT NULL,
    request_id uuid,
    settings_before jsonb,
    settings_after jsonb,
    idempotency_key text,
    created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT pk_bi_control_audit PRIMARY KEY (id),
    CONSTRAINT fk_bi_audit_request FOREIGN KEY (tenant_id, request_id) REFERENCES etl.load_requests (tenant_id, id),
    CONSTRAINT ck_bi_audit_action CHECK (
        (action = 'settings_updated' AND request_id IS NULL AND settings_before IS NOT NULL AND settings_after IS NOT NULL AND idempotency_key IS NULL)
        OR (action = 'request_created' AND request_id IS NOT NULL AND settings_before IS NULL AND settings_after IS NULL AND idempotency_key IS NULL)
        OR (action = 'request_cancelled' AND request_id IS NOT NULL AND settings_before IS NULL AND settings_after IS NULL AND idempotency_key IS NOT NULL)),
    CONSTRAINT ck_bi_audit_key CHECK (idempotency_key IS NULL OR (length(idempotency_key) BETWEEN 1 AND 128 AND idempotency_key !~ '[^A-Za-z0-9._:-]')),
    CONSTRAINT ck_bi_audit_settings CHECK (settings_before IS NULL OR (
        jsonb_typeof(settings_before) = 'object' AND jsonb_typeof(settings_after) = 'object'
        AND settings_before - ARRAY['frequencyHours','scheduleEnabled','nextScheduledAt','alertFailures','alertDelays','delayToleranceMinutes','version','updatedAt'] = '{}'::jsonb
        AND settings_after - ARRAY['frequencyHours','scheduleEnabled','nextScheduledAt','alertFailures','alertDelays','delayToleranceMinutes','version','updatedAt'] = '{}'::jsonb))
);
CREATE INDEX idx_bi_audit_history ON etl.control_audit (tenant_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX uq_bi_cancel_key ON etl.control_audit (tenant_id, actor_id, idempotency_key) WHERE action = 'request_cancelled';

-- Inventario técnico del servicio; nunca exponer worker_id ni otras empresas al navegador.
CREATE TABLE etl.worker_health (
    worker_id uuid PRIMARY KEY,
    protocol_version smallint NOT NULL CHECK (protocol_version = 1),
    started_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    last_seen_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    stopping boolean NOT NULL DEFAULT false,
    CONSTRAINT ck_bi_worker_dates CHECK (last_seen_at >= started_at)
);
REVOKE ALL ON etl.tenant_settings, etl.load_requests, etl.control_audit, etl.worker_health FROM PUBLIC;
COMMIT;
