-- Measured on 30,000 synthetic testimonials with representative admin and
-- published-list queries; neither plan used this index. The narrower
-- idx_testimonials_category retains the same (tenant_id, category_id) keys.
DROP INDEX IF EXISTS "idx_testimonials_covering";
