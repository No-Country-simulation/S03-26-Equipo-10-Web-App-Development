-- Migración para habilitar extensiones críticas de PostgreSQL (SKL-DB-001)
-- Observabilidad y performance

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ejemplo de un Covering Index propuesto en el plan (optimización de I/O)
-- Si Testimonial se filtra mucho por tenant_id y category_id, pero se lee content y author_name:
CREATE INDEX IF NOT EXISTS "idx_testimonials_covering" ON "testimonials" ("tenant_id", "category_id") INCLUDE ("content", "author_name");
