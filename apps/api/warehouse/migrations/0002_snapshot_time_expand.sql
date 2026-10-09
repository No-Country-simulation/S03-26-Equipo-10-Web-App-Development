-- Expansión compatible con el lector anterior; backfill manual antes de 0003.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE TABLE dw.fact_tenant_snapshot (
    tenant_id uuid NOT NULL,
    run_id uuid NOT NULL,
    snapshot_at timestamptz(3) NOT NULL,
    snapshot_date_key date NOT NULL,
    published_at timestamptz(3) NOT NULL,
    testimonial_count bigint NOT NULL,
    CONSTRAINT pk_fact_tenant_snapshot PRIMARY KEY (tenant_id, run_id),
    CONSTRAINT uq_tenant_snapshot_time UNIQUE (tenant_id, run_id, snapshot_at, snapshot_date_key),
    CONSTRAINT fk_tenant_snapshot_tenant FOREIGN KEY (tenant_id) REFERENCES dw.dim_tenant (tenant_id),
    CONSTRAINT fk_tenant_snapshot_run FOREIGN KEY (tenant_id, run_id) REFERENCES etl.runs (tenant_id, id),
    CONSTRAINT fk_tenant_snapshot_date FOREIGN KEY (snapshot_date_key) REFERENCES dw.dim_date (date_key),
    CONSTRAINT ck_tenant_snapshot_count CHECK (testimonial_count >= 0),
    CONSTRAINT ck_tenant_snapshot_date CHECK (snapshot_date_key = (snapshot_at AT TIME ZONE 'UTC')::date)
);

ALTER TABLE dw.fact_testimonial_snapshot
    ADD COLUMN snapshot_at timestamptz(3),
    ADD COLUMN snapshot_date_key date;

REVOKE ALL ON dw.fact_tenant_snapshot FROM PUBLIC;
COMMIT;
