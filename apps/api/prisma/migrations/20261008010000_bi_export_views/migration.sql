-- Proyección de exportación OLTP sin PII, URLs ni credenciales. No aplicada a bases persistentes.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';
CREATE SCHEMA bi_export;
REVOKE ALL ON SCHEMA bi_export FROM PUBLIC;

-- El propietario de estas vistas puede leer el origen; el extractor sólo recibe SELECT de vistas.
CREATE VIEW bi_export.tenants WITH (security_barrier = true) AS
    SELECT id AS tenant_id, name, is_active FROM public.tenants;
CREATE VIEW bi_export.categories WITH (security_barrier = true) AS
    SELECT tenant_id, id AS category_id, name FROM public.categories;
CREATE VIEW bi_export.testimonials WITH (security_barrier = true) AS
    SELECT t.tenant_id, t.id AS testimonial_id, t.category_id, s.code AS status_code,
        t.rating, t.score, t.created_at, t.published_at,
        t.image_url IS NOT NULL AS has_image, t.video_url IS NOT NULL AS has_video
    FROM public.testimonials t LEFT JOIN public.testimonial_status s ON s.id = t.status_id;
CREATE VIEW bi_export.analytics_events WITH (security_barrier = true) AS
    SELECT e.tenant_id, e.id AS event_id, e.testimonial_id, k.code AS event_type_code,
        CASE WHEN e.source IN ('public', 'public-browser', 'api', 'widget')
            THEN e.source ELSE 'other' END AS source_code,
        e.created_at
    FROM public.analytics_events e LEFT JOIN public.analytics_event_types k ON k.id = e.event_type_id;
REVOKE ALL ON ALL TABLES IN SCHEMA bi_export FROM PUBLIC;
COMMIT;
