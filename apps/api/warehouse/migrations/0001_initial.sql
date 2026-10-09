-- Warehouse PostgreSQL 18. Migración independiente; nunca se ejecuta desde ETL/HTTP.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA staging;
CREATE SCHEMA dw;
CREATE SCHEMA etl;
REVOKE ALL ON SCHEMA staging, dw, etl FROM PUBLIC;

CREATE TABLE etl.schema_migrations (
    version text NOT NULL,
    checksum text NOT NULL,
    applied_at timestamptz(3) NOT NULL DEFAULT current_timestamp,
    CONSTRAINT pk_etl_schema_migrations PRIMARY KEY (version),
    CONSTRAINT ck_etl_schema_migrations_checksum CHECK (checksum ~ '^[0-9a-f]{64}$')
);

CREATE TABLE dw.dim_date (
    date_key date NOT NULL,
    year smallint GENERATED ALWAYS AS (extract(year FROM date_key)::smallint) STORED,
    quarter smallint GENERATED ALWAYS AS (extract(quarter FROM date_key)::smallint) STORED,
    month smallint GENERATED ALWAYS AS (extract(month FROM date_key)::smallint) STORED,
    day smallint GENERATED ALWAYS AS (extract(day FROM date_key)::smallint) STORED,
    CONSTRAINT pk_dim_date PRIMARY KEY (date_key)
);

CREATE TABLE dw.dim_tenant (
    tenant_id uuid NOT NULL,
    name text NOT NULL,
    is_active boolean NOT NULL,
    updated_at timestamptz(3) NOT NULL DEFAULT current_timestamp,
    CONSTRAINT pk_dim_tenant PRIMARY KEY (tenant_id)
);

CREATE TABLE dw.dim_testimonial (
    tenant_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    is_present boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_dim_testimonial PRIMARY KEY (tenant_id, testimonial_id),
    CONSTRAINT fk_dim_testimonial_tenant FOREIGN KEY (tenant_id)
        REFERENCES dw.dim_tenant (tenant_id)
);

CREATE TABLE dw.dim_category (
    category_key bigint GENERATED ALWAYS AS IDENTITY,
    tenant_id uuid NOT NULL,
    source_category_id uuid,
    name text NOT NULL,
    is_present boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_dim_category PRIMARY KEY (category_key),
    CONSTRAINT uq_dim_category_tenant_key UNIQUE (tenant_id, category_key),
    CONSTRAINT uq_dim_category_source UNIQUE NULLS NOT DISTINCT (tenant_id, source_category_id),
    CONSTRAINT fk_dim_category_tenant FOREIGN KEY (tenant_id)
        REFERENCES dw.dim_tenant (tenant_id)
);

CREATE TABLE dw.dim_status (
    status_code text NOT NULL,
    CONSTRAINT pk_dim_status PRIMARY KEY (status_code),
    CONSTRAINT ck_dim_status_nonempty CHECK (length(status_code) > 0)
);

CREATE TABLE dw.dim_source (
    source_key bigint GENERATED ALWAYS AS IDENTITY,
    tenant_id uuid NOT NULL,
    code text NOT NULL,
    CONSTRAINT pk_dim_source PRIMARY KEY (source_key),
    CONSTRAINT uq_dim_source_tenant_key UNIQUE (tenant_id, source_key),
    CONSTRAINT uq_dim_source_code UNIQUE (tenant_id, code),
    CONSTRAINT ck_dim_source_catalog CHECK (code IN ('public', 'public-browser', 'api', 'widget', 'other')),
    CONSTRAINT fk_dim_source_tenant FOREIGN KEY (tenant_id)
        REFERENCES dw.dim_tenant (tenant_id)
);

CREATE TABLE dw.dim_event_type (
    event_type_key bigint GENERATED ALWAYS AS IDENTITY,
    code text NOT NULL,
    CONSTRAINT pk_dim_event_type PRIMARY KEY (event_type_key),
    CONSTRAINT uq_dim_event_type_code UNIQUE (code),
    CONSTRAINT ck_dim_event_type_nonempty CHECK (length(code) > 0)
);

-- El control existe incluso antes de la primera publicación de dim_tenant.
-- No exigir FK de runs a dim_tenant: conservar auditoría de un primer fallo.
CREATE TABLE etl.runs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    slot_at timestamptz(3) NOT NULL,
    attempt_no integer NOT NULL,
    status text NOT NULL DEFAULT 'running',
    started_at timestamptz(3) NOT NULL DEFAULT current_timestamp,
    source_snapshot_at timestamptz(3),
    finished_at timestamptz(3),
    source_category_count bigint NOT NULL DEFAULT 0,
    source_testimonial_count bigint NOT NULL DEFAULT 0,
    source_event_count bigint NOT NULL DEFAULT 0,
    snapshot_row_count bigint NOT NULL DEFAULT 0,
    engagement_row_count bigint NOT NULL DEFAULT 0,
    error_code text,
    CONSTRAINT pk_etl_runs PRIMARY KEY (id),
    CONSTRAINT uq_etl_runs_tenant_id UNIQUE (tenant_id, id),
    CONSTRAINT uq_etl_runs_attempt UNIQUE (tenant_id, slot_at, attempt_no),
    CONSTRAINT ck_etl_runs_attempt CHECK (attempt_no BETWEEN 1 AND 3),
    CONSTRAINT ck_etl_runs_status CHECK (status IN ('running', 'succeeded', 'failed', 'abandoned')),
    CONSTRAINT ck_etl_runs_hour CHECK (
        slot_at = date_trunc('hour', slot_at AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    ),
    CONSTRAINT ck_etl_runs_source_slot CHECK (
        source_snapshot_at IS NULL
        OR (source_snapshot_at >= slot_at AND source_snapshot_at < slot_at + interval '1 hour')
    ),
    CONSTRAINT ck_etl_runs_completion CHECK (
        (status = 'running' AND finished_at IS NULL)
        OR (status <> 'running' AND finished_at IS NOT NULL AND finished_at >= started_at)
    ),
    CONSTRAINT ck_etl_runs_success CHECK (
        status <> 'succeeded'
        OR (source_snapshot_at IS NOT NULL AND error_code IS NULL
            AND snapshot_row_count = source_testimonial_count)
    ),
    CONSTRAINT ck_etl_runs_counts CHECK (
        source_category_count >= 0 AND source_testimonial_count >= 0
        AND source_event_count >= 0 AND snapshot_row_count >= 0 AND engagement_row_count >= 0
    ),
    CONSTRAINT ck_etl_runs_error_code CHECK (
        error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
    )
);

CREATE UNIQUE INDEX uq_etl_runs_success_slot
    ON etl.runs (tenant_id, slot_at) WHERE status = 'succeeded';
CREATE INDEX idx_etl_runs_success_time
    ON etl.runs (tenant_id, source_snapshot_at DESC, id)
    WHERE status = 'succeeded';

CREATE TABLE etl.tenant_load_state (
    tenant_id uuid NOT NULL,
    lease_run_id uuid,
    lease_token uuid,
    lease_until timestamptz(3),
    last_published_run_id uuid,
    CONSTRAINT pk_etl_tenant_load_state PRIMARY KEY (tenant_id),
    CONSTRAINT fk_etl_state_lease_run FOREIGN KEY (tenant_id, lease_run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT fk_etl_state_published_run FOREIGN KEY (tenant_id, last_published_run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT ck_etl_state_lease CHECK (
        (lease_run_id IS NULL AND lease_token IS NULL AND lease_until IS NULL)
        OR (lease_run_id IS NOT NULL AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
    )
);

CREATE TABLE staging.categories (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    category_id uuid NOT NULL,
    name text NOT NULL,
    CONSTRAINT pk_staging_categories PRIMARY KEY (tenant_id, run_id, category_id),
    CONSTRAINT fk_staging_categories_run FOREIGN KEY (tenant_id, run_id)
        REFERENCES etl.runs (tenant_id, id)
);

CREATE TABLE staging.testimonials (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    category_id uuid,
    status_code text NOT NULL,
    rating smallint NOT NULL,
    score numeric(10,4) NOT NULL,
    created_at timestamptz(3) NOT NULL,
    published_at timestamptz(3),
    has_image boolean NOT NULL,
    has_video boolean NOT NULL,
    CONSTRAINT pk_staging_testimonials PRIMARY KEY (tenant_id, run_id, testimonial_id),
    CONSTRAINT fk_staging_testimonials_run FOREIGN KEY (tenant_id, run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT fk_staging_testimonials_category FOREIGN KEY (tenant_id, run_id, category_id)
        REFERENCES staging.categories (tenant_id, run_id, category_id),
    CONSTRAINT ck_staging_testimonials_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE staging.analytics_events (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    event_id bigint NOT NULL,
    testimonial_id uuid NOT NULL,
    event_type_code text NOT NULL,
    source_code text NOT NULL,
    created_at timestamptz(3) NOT NULL,
    CONSTRAINT pk_staging_analytics_events PRIMARY KEY (tenant_id, run_id, event_id),
    CONSTRAINT fk_staging_analytics_run FOREIGN KEY (tenant_id, run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT fk_staging_analytics_testimonial FOREIGN KEY (tenant_id, run_id, testimonial_id)
        REFERENCES staging.testimonials (tenant_id, run_id, testimonial_id),
    CONSTRAINT ck_staging_analytics_event_id CHECK (event_id > 0),
    CONSTRAINT ck_staging_analytics_source CHECK (
        source_code IN ('public', 'public-browser', 'api', 'widget', 'other')
    )
);

CREATE TABLE dw.fact_testimonial_snapshot (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    category_key bigint NOT NULL,
    status_code text NOT NULL,
    rating smallint NOT NULL,
    score numeric(10,4) NOT NULL,
    created_at timestamptz(3) NOT NULL,
    published_at timestamptz(3),
    has_image boolean NOT NULL,
    has_video boolean NOT NULL,
    CONSTRAINT pk_fact_testimonial_snapshot PRIMARY KEY (tenant_id, run_id, testimonial_id),
    CONSTRAINT fk_snapshot_run FOREIGN KEY (tenant_id, run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT fk_snapshot_testimonial FOREIGN KEY (tenant_id, testimonial_id)
        REFERENCES dw.dim_testimonial (tenant_id, testimonial_id),
    CONSTRAINT fk_snapshot_category FOREIGN KEY (tenant_id, category_key)
        REFERENCES dw.dim_category (tenant_id, category_key),
    CONSTRAINT fk_snapshot_status FOREIGN KEY (status_code)
        REFERENCES dw.dim_status (status_code),
    CONSTRAINT ck_snapshot_rating CHECK (rating BETWEEN 1 AND 5)
);

CREATE TABLE dw.fact_engagement_daily (
    tenant_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    date_key date NOT NULL,
    source_key bigint NOT NULL,
    event_type_key bigint NOT NULL,
    event_count bigint NOT NULL,
    last_reconciled_run_id uuid NOT NULL,
    CONSTRAINT pk_fact_engagement_daily
        PRIMARY KEY (tenant_id, testimonial_id, date_key, source_key, event_type_key),
    CONSTRAINT fk_engagement_testimonial FOREIGN KEY (tenant_id, testimonial_id)
        REFERENCES dw.dim_testimonial (tenant_id, testimonial_id),
    CONSTRAINT fk_engagement_date FOREIGN KEY (date_key)
        REFERENCES dw.dim_date (date_key),
    CONSTRAINT fk_engagement_source FOREIGN KEY (tenant_id, source_key)
        REFERENCES dw.dim_source (tenant_id, source_key),
    CONSTRAINT fk_engagement_type FOREIGN KEY (event_type_key)
        REFERENCES dw.dim_event_type (event_type_key),
    CONSTRAINT fk_engagement_run FOREIGN KEY (tenant_id, last_reconciled_run_id)
        REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT ck_engagement_count CHECK (event_count > 0)
);

CREATE INDEX idx_fact_engagement_tenant_date
    ON dw.fact_engagement_daily (tenant_id, date_key);

-- No otorgar derechos a PUBLIC. El runbook debe otorgar SELECT/DML por tablas
-- y columnas a identidades distintas sin contraseña en el script.
REVOKE ALL ON ALL TABLES IN SCHEMA staging, dw, etl FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA staging, dw, etl FROM PUBLIC;

COMMIT;
