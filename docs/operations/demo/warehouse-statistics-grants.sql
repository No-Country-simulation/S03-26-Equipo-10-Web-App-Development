-- ADICIÓN PROPUESTA: después de 0005; requiere ACK del destino y mantenimiento.
-- Complementa warehouse-grants.sql. Informes y primeras observaciones sin UPDATE/DELETE runtime.
BEGIN;
REVOKE ALL ON staging.tags, staging.testimonial_tags, dw.dim_tag, dw.fact_tag_snapshot,
  dw.bridge_testimonial_tag_snapshot, dw.fact_testimonial_creation, dw.statistics_history_state,
  etl.statistics_jobs, dw.statistics_publication, dw.statistics_current
  FROM PUBLIC, anon, authenticated, service_role, bi_api_reader, bi_control, bi_etl_writer;
GRANT SELECT ON dw.dim_tag, dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot,
  dw.fact_testimonial_creation, dw.statistics_history_state, dw.statistics_publication, dw.statistics_current TO bi_api_reader;
GRANT SELECT, INSERT, DELETE ON staging.tags, staging.testimonial_tags TO bi_etl_writer;
GRANT SELECT, INSERT, UPDATE ON dw.dim_tag, dw.statistics_history_state, dw.statistics_current, etl.statistics_jobs TO bi_etl_writer;
GRANT SELECT, INSERT ON dw.fact_tag_snapshot, dw.bridge_testimonial_tag_snapshot,
  dw.fact_testimonial_creation, dw.statistics_publication TO bi_etl_writer;
COMMIT;
