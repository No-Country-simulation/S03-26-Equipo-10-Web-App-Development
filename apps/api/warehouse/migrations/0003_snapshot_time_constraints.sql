-- Requiere preflight de cierre en el migrador y mantenimiento BI.
-- El escritor compatible se incorpora en la fase 2 del plan temporal.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE dw.fact_testimonial_snapshot
    ADD CONSTRAINT ck_snapshot_time_present CHECK (snapshot_at IS NOT NULL AND snapshot_date_key IS NOT NULL) NOT VALID,
    ADD CONSTRAINT ck_snapshot_utc_date CHECK (snapshot_date_key = (snapshot_at AT TIME ZONE 'UTC')::date) NOT VALID,
    ADD CONSTRAINT fk_snapshot_date FOREIGN KEY (snapshot_date_key) REFERENCES dw.dim_date (date_key) NOT VALID,
    ADD CONSTRAINT fk_snapshot_header_time FOREIGN KEY (tenant_id, run_id, snapshot_at, snapshot_date_key)
        REFERENCES dw.fact_tenant_snapshot (tenant_id, run_id, snapshot_at, snapshot_date_key) NOT VALID;

ALTER TABLE dw.fact_testimonial_snapshot VALIDATE CONSTRAINT ck_snapshot_time_present;
ALTER TABLE dw.fact_testimonial_snapshot VALIDATE CONSTRAINT ck_snapshot_utc_date;
ALTER TABLE dw.fact_testimonial_snapshot VALIDATE CONSTRAINT fk_snapshot_date;
ALTER TABLE dw.fact_testimonial_snapshot VALIDATE CONSTRAINT fk_snapshot_header_time;
ALTER TABLE dw.fact_testimonial_snapshot ALTER COLUMN snapshot_at SET NOT NULL, ALTER COLUMN snapshot_date_key SET NOT NULL;
ALTER TABLE dw.fact_testimonial_snapshot DROP CONSTRAINT ck_snapshot_time_present;
COMMIT;
