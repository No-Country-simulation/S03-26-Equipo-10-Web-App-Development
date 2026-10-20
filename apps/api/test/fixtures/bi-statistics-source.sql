-- Taxonomía sintética; sólo después de bi-source.sql, en bases descartables.
CREATE TABLE tags (id uuid PRIMARY KEY, tenant_id uuid NOT NULL REFERENCES tenants(id), name text NOT NULL,
    UNIQUE (tenant_id, id));
CREATE TABLE testimonial_tags (
    tenant_id uuid NOT NULL, testimonial_id uuid NOT NULL, tag_id uuid NOT NULL,
    PRIMARY KEY (testimonial_id, tag_id),
    FOREIGN KEY (tenant_id, testimonial_id) REFERENCES testimonials (tenant_id, id),
    FOREIGN KEY (tenant_id, tag_id) REFERENCES tags (tenant_id, id)
);
