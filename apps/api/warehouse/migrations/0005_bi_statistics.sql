-- Datos y persistencia estadística BI. Requiere 0004 y mantenimiento autorizado.
-- Sin activación automática ni backfill implícito.
-- Sólo DDL aditivo. El backfill reanudable se implementará fuera de este DDL.
-- No crear bases, roles, secretos ni GRANT a PUBLIC. Sin FK entre servidores.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE staging.tags (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    name text NOT NULL,
    CONSTRAINT pk_stats_staging_tags PRIMARY KEY (tenant_id, run_id, tag_id),
    CONSTRAINT fk_stats_staging_tags_run FOREIGN KEY (tenant_id, run_id)
        REFERENCES etl.runs (tenant_id, id)
);

CREATE TABLE staging.testimonial_tags (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    CONSTRAINT pk_stats_staging_links PRIMARY KEY (tenant_id, run_id, testimonial_id, tag_id),
    CONSTRAINT fk_stats_staging_links_testimonial FOREIGN KEY (tenant_id, run_id, testimonial_id)
        REFERENCES staging.testimonials (tenant_id, run_id, testimonial_id) ON DELETE CASCADE,
    CONSTRAINT fk_stats_staging_links_tag FOREIGN KEY (tenant_id, run_id, tag_id)
        REFERENCES staging.tags (tenant_id, run_id, tag_id)
);
CREATE INDEX idx_stats_staging_links_tag ON staging.testimonial_tags (tenant_id, run_id, tag_id);

CREATE TABLE dw.dim_tag (
    tenant_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    name text NOT NULL,
    is_present boolean NOT NULL DEFAULT true,
    CONSTRAINT pk_stats_dim_tag PRIMARY KEY (tenant_id, tag_id),
    CONSTRAINT fk_stats_dim_tag_tenant FOREIGN KEY (tenant_id) REFERENCES dw.dim_tenant (tenant_id)
);

-- Su presencia acredita extracción de etiquetas, incluso sin tags ni relaciones.
-- No insertar cabeceras retroactivas a partir de asignaciones actuales.
CREATE TABLE dw.fact_tag_snapshot (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    tag_count bigint NOT NULL,
    relation_count bigint NOT NULL,
    CONSTRAINT pk_stats_tag_snapshot PRIMARY KEY (tenant_id, run_id),
    CONSTRAINT fk_stats_tag_snapshot_header FOREIGN KEY (tenant_id, run_id)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id),
    CONSTRAINT ck_stats_tag_snapshot_counts CHECK (tag_count >= 0 AND relation_count >= 0)
);

CREATE TABLE dw.bridge_testimonial_tag_snapshot (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    tag_id uuid NOT NULL,
    CONSTRAINT pk_stats_tag_bridge PRIMARY KEY (tenant_id, run_id, testimonial_id, tag_id),
    CONSTRAINT fk_stats_tag_bridge_header FOREIGN KEY (tenant_id, run_id)
        REFERENCES dw.fact_tag_snapshot (tenant_id, run_id),
    CONSTRAINT fk_stats_tag_bridge_testimonial FOREIGN KEY (tenant_id, run_id, testimonial_id)
        REFERENCES dw.fact_testimonial_snapshot (tenant_id, run_id, testimonial_id),
    CONSTRAINT fk_stats_tag_bridge_tag FOREIGN KEY (tenant_id, tag_id)
        REFERENCES dw.dim_tag (tenant_id, tag_id)
);
CREATE INDEX idx_stats_bridge_tag ON dw.bridge_testimonial_tag_snapshot (tenant_id, tag_id, run_id);

CREATE TABLE dw.fact_testimonial_creation (
    tenant_id uuid NOT NULL,
    testimonial_id uuid NOT NULL,
    created_at timestamptz(3) NOT NULL,
    first_observed_at timestamptz(3) NOT NULL,
    first_observed_date_key date NOT NULL,
    first_observed_run_id uuid NOT NULL,
    CONSTRAINT pk_stats_creation PRIMARY KEY (tenant_id, testimonial_id),
    CONSTRAINT fk_stats_creation_testimonial FOREIGN KEY (tenant_id, testimonial_id)
        REFERENCES dw.dim_testimonial (tenant_id, testimonial_id),
    CONSTRAINT fk_stats_creation_detail FOREIGN KEY (tenant_id, first_observed_run_id, testimonial_id)
        REFERENCES dw.fact_testimonial_snapshot (tenant_id, run_id, testimonial_id),
    CONSTRAINT fk_stats_creation_time FOREIGN KEY
        (tenant_id, first_observed_run_id, first_observed_at, first_observed_date_key)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key),
    CONSTRAINT ck_stats_creation_time CHECK (created_at <= first_observed_at),
    CONSTRAINT ck_stats_creation_date CHECK
        (first_observed_date_key = (first_observed_at AT TIME ZONE 'UTC')::date)
);
CREATE INDEX idx_stats_creation_month ON dw.fact_testimonial_creation (tenant_id, created_at, first_observed_at);
CREATE INDEX idx_stats_creation_origin ON dw.fact_testimonial_creation (tenant_id, first_observed_run_id, testimonial_id);
-- El inicializador verifica también que created_at coincida con TODOS los detalles.
-- Una FK de fila no demuestra mínima primera observación ni inmutabilidad de fecha.

-- Barrera publicada sólo tras inicialización/reconciliación completa por empresa.
-- No confundir tablas presentes con backfill terminado.
CREATE TABLE dw.statistics_history_state (
    tenant_id uuid NOT NULL,
    creations_through_run_id uuid NOT NULL,
    CONSTRAINT pk_stats_history_state PRIMARY KEY (tenant_id),
    CONSTRAINT fk_stats_history_header FOREIGN KEY (tenant_id, creations_through_run_id)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id)
);
CREATE INDEX idx_stats_history_source ON dw.statistics_history_state (tenant_id, creations_through_run_id);

CREATE TABLE etl.statistics_jobs (
    tenant_id uuid NOT NULL,
    source_run_id uuid NOT NULL,
    algorithm_version text NOT NULL,
    source_snapshot_at timestamptz(3) NOT NULL,
    source_snapshot_date_key date NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    attempt_count smallint NOT NULL DEFAULT 0,
    created_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    claimed_at timestamptz(3),
    finished_at timestamptz(3),
    lease_token uuid,
    lease_until timestamptz(3),
    deadline_at timestamptz(3),
    error_code text,
    CONSTRAINT pk_stats_job PRIMARY KEY (tenant_id, source_run_id, algorithm_version),
    CONSTRAINT uq_stats_job_source UNIQUE
        (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key),
    CONSTRAINT fk_stats_job_source FOREIGN KEY
        (tenant_id, source_run_id, source_snapshot_at, source_snapshot_date_key)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key),
    CONSTRAINT ck_stats_job_version CHECK (algorithm_version ~ '^stats_v[1-9][0-9]*$'),
    CONSTRAINT ck_stats_job_status CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'superseded')),
    CONSTRAINT ck_stats_job_attempts CHECK (attempt_count BETWEEN 0 AND 3),
    CONSTRAINT ck_stats_job_lifecycle CHECK (
        (status = 'pending' AND attempt_count = 0 AND claimed_at IS NULL AND finished_at IS NULL)
        OR (status = 'running' AND attempt_count > 0 AND claimed_at IS NOT NULL AND finished_at IS NULL)
        OR (status IN ('succeeded', 'failed') AND attempt_count > 0 AND claimed_at IS NOT NULL AND finished_at IS NOT NULL)
        OR (status = 'superseded' AND finished_at IS NOT NULL)),
    CONSTRAINT ck_stats_job_lease CHECK (
        (status = 'running' AND lease_token IS NOT NULL AND lease_until IS NOT NULL AND deadline_at IS NOT NULL
            AND deadline_at = claimed_at + interval '60 seconds'
            AND lease_until > claimed_at AND lease_until <= claimed_at + interval '90 seconds')
        OR (status <> 'running' AND lease_token IS NULL AND lease_until IS NULL AND deadline_at IS NULL)),
    CONSTRAINT ck_stats_job_dates CHECK (
        (claimed_at IS NULL OR claimed_at >= created_at)
        AND (finished_at IS NULL OR finished_at >= coalesce(claimed_at, created_at))),
    CONSTRAINT ck_stats_job_error CHECK (
        (status = 'failed' AND error_code IS NOT NULL AND error_code IN
            ('BI_STATISTICS_FAILED', 'BI_STATISTICS_DEADLINE_EXCEEDED', 'BI_STATISTICS_LEASE_LOST',
             'BI_STATISTICS_DATA_INVALID', 'BI_STATISTICS_COUNT_OUT_OF_RANGE'))
        OR (status <> 'failed' AND error_code IS NULL))
);
CREATE UNIQUE INDEX uq_stats_job_running ON etl.statistics_jobs (tenant_id) WHERE status = 'running';
CREATE INDEX idx_stats_job_candidates ON etl.statistics_jobs (created_at, tenant_id, source_run_id)
    WHERE status IN ('pending', 'failed') AND attempt_count < 3;
CREATE INDEX idx_stats_job_expired ON etl.statistics_jobs (lease_until) WHERE status = 'running';

CREATE TABLE dw.statistics_publication (
    tenant_id uuid NOT NULL,
    source_run_id uuid NOT NULL,
    algorithm_version text NOT NULL,
    source_snapshot_at timestamptz(3) NOT NULL,
    source_snapshot_date_key date NOT NULL,
    generated_at timestamptz(3) NOT NULL DEFAULT clock_timestamp(),
    payload jsonb NOT NULL,
    CONSTRAINT pk_stats_publication PRIMARY KEY (tenant_id, source_run_id, algorithm_version),
    CONSTRAINT fk_stats_publication_job FOREIGN KEY
        (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key)
        REFERENCES etl.statistics_jobs
            (tenant_id, source_run_id, algorithm_version, source_snapshot_at, source_snapshot_date_key),
    CONSTRAINT fk_stats_publication_source FOREIGN KEY
        (tenant_id, source_run_id, source_snapshot_at, source_snapshot_date_key)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key),
    CONSTRAINT ck_stats_publication_shape CHECK (
        jsonb_typeof(payload) = 'object'
        AND payload ?& ARRAY['forecast', 'patterns', 'anomalies']
        AND payload - ARRAY['forecast', 'patterns', 'anomalies'] = '{}'::jsonb
        AND jsonb_typeof(payload->'forecast') = 'object'
        AND jsonb_typeof(payload->'patterns') = 'object'
        AND jsonb_typeof(payload->'anomalies') = 'object')
);
-- Las secciones y sus límites se validan con esquema versionado antes de escribir
-- y al leer. El CHECK de JSON no acredita corrección estadística ni seguridad.
CREATE INDEX idx_stats_publication_source ON dw.statistics_publication
    (tenant_id, source_run_id, source_snapshot_at, source_snapshot_date_key);

CREATE TABLE dw.statistics_current (
    tenant_id uuid NOT NULL,
    algorithm_version text NOT NULL,
    source_run_id uuid NOT NULL,
    CONSTRAINT pk_stats_current PRIMARY KEY (tenant_id, algorithm_version),
    CONSTRAINT fk_stats_current_publication FOREIGN KEY (tenant_id, source_run_id, algorithm_version)
        REFERENCES dw.statistics_publication (tenant_id, source_run_id, algorithm_version)
);
CREATE INDEX idx_stats_current_publication ON dw.statistics_current (tenant_id, source_run_id, algorithm_version);

REVOKE ALL ON staging.tags, staging.testimonial_tags, dw.dim_tag, dw.fact_tag_snapshot,
    dw.bridge_testimonial_tag_snapshot, dw.fact_testimonial_creation,
    dw.statistics_history_state, etl.statistics_jobs, dw.statistics_publication, dw.statistics_current FROM PUBLIC;

-- No grants genéricos: provisionar explícitamente según api-bi-statistics.md.
-- Worker: publicaciones INSERT/SELECT, sin UPDATE/DELETE; puntero por tenant.
-- La no regresión del puntero y el fencing son responsabilidad transaccional.
-- Orden de publicación: job -> puntero; validar token/plazo antes de COMMIT.
COMMIT;
