-- BORRADOR FASE 1: NO APLICADO, NO DESCUBIERTO POR PRISMA NI RUNTIME.
-- Promover a migración nueva únicamente en fase 2 tras ACK y revisión.
-- Requiere bi_export existente. No modifica modelos/tablas operacionales.
-- Permisos de extractor: SELECT sólo estas vistas, provisionado por operación.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

CREATE VIEW bi_export.tags WITH (security_barrier = true) AS
    SELECT tenant_id, id AS tag_id, name FROM public.tags;

CREATE VIEW bi_export.testimonial_tags WITH (security_barrier = true) AS
    SELECT tt.tenant_id, tt.testimonial_id, tt.tag_id
    FROM public.testimonial_tags tt
    JOIN public.testimonials t
        ON t.tenant_id = tt.tenant_id AND t.id = tt.testimonial_id
    JOIN public.tags g
        ON g.tenant_id = tt.tenant_id AND g.id = tt.tag_id;

-- Cada lectura del extractor debe filtrar tenant_id y paginar por UUID,
-- o por (testimonial_id, tag_id) para relaciones, en la misma transacción RR.
-- Los joins restringen relaciones; no sustituyen el filtro por tenant.
-- No se exportan contenido, autores, notas, usuarios, IP/hash ni URLs.
REVOKE ALL ON bi_export.tags, bi_export.testimonial_tags FROM PUBLIC;
COMMIT;
