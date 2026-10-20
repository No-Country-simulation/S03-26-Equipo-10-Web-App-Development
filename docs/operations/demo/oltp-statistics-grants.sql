-- ADICIÓN PROPUESTA: después de 20261019000000; requiere ACK del destino y mantenimiento.
-- Complementa oltp-grants.sql. Sin roles/contraseñas ni migración implícita.
BEGIN;
REVOKE ALL ON bi_export.tags, bi_export.testimonial_tags FROM PUBLIC, anon, authenticated, service_role, cms_runtime, bi_source_reader;
GRANT SELECT ON bi_export.tags, bi_export.testimonial_tags TO bi_source_reader;
COMMIT;
