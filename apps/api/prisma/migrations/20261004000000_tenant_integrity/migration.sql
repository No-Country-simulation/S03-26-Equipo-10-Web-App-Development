-- Cutover migration for the future demonstration. Drain old API writers first.
-- Apply only with a separate deployment ACK; this transaction aborts if legacy
-- rows violate tenant ownership or minimum testimonial content.
BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM testimonials t JOIN categories c ON c.id = t.category_id
    WHERE t.tenant_id <> c.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: testimonial_category'; END IF;

  IF EXISTS (
    SELECT 1 FROM testimonials t JOIN users u ON u.id = t.created_by_id
    WHERE t.tenant_id <> u.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: testimonial_author'; END IF;

  IF EXISTS (
    SELECT 1 FROM testimonial_tags tt
    JOIN testimonials t ON t.id = tt.testimonial_id
    JOIN tags tag ON tag.id = tt.tag_id
    WHERE t.tenant_id <> tag.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: testimonial_tag'; END IF;

  IF EXISTS (
    SELECT 1 FROM analytics_events e JOIN testimonials t ON t.id = e.testimonial_id
    WHERE e.tenant_id <> t.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: analytics_testimonial'; END IF;

  IF EXISTS (
    SELECT 1 FROM api_keys k JOIN users u ON u.id = k.owner_id
    WHERE k.tenant_id <> u.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: api_key_owner'; END IF;

  IF EXISTS (
    SELECT 1 FROM webhook_deliveries d
    JOIN webhooks w ON w.id = d.webhook_id
    JOIN outbox_events e ON e.id = d.outbox_event_id
    WHERE w.tenant_id <> e.tenant_id
  ) THEN RAISE EXCEPTION 'tenant preflight failed: delivery_outbox'; END IF;

  IF EXISTS (SELECT 1 FROM testimonials WHERE char_length(content) < 10)
  THEN RAISE EXCEPTION 'tenant preflight failed: short_testimonial_content'; END IF;
END $$;

CREATE UNIQUE INDEX "uq_users_tenant_id" ON "users"("tenant_id", "id");
CREATE UNIQUE INDEX "uq_categories_tenant_id" ON "categories"("tenant_id", "id");
CREATE UNIQUE INDEX "uq_tags_tenant_id" ON "tags"("tenant_id", "id");
CREATE UNIQUE INDEX "uq_testimonials_tenant_id" ON "testimonials"("tenant_id", "id");
CREATE UNIQUE INDEX "uq_webhooks_tenant_id" ON "webhooks"("tenant_id", "id");
CREATE UNIQUE INDEX "uq_outbox_events_tenant_id" ON "outbox_events"("tenant_id", "id");

ALTER TABLE "testimonial_tags" ADD COLUMN "tenant_id" UUID;
UPDATE "testimonial_tags" tt SET "tenant_id" = t."tenant_id"
FROM "testimonials" t WHERE t.id = tt."testimonial_id";
ALTER TABLE "testimonial_tags" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "webhook_deliveries" ADD COLUMN "tenant_id" UUID;
UPDATE "webhook_deliveries" d SET "tenant_id" = w."tenant_id"
FROM "webhooks" w WHERE w.id = d."webhook_id";
ALTER TABLE "webhook_deliveries" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "testimonials" DROP CONSTRAINT "fk_testimonial_category";
ALTER TABLE "testimonials" DROP CONSTRAINT "fk_testimonial_created_by";
ALTER TABLE "testimonial_tags" DROP CONSTRAINT "fk_tt_testimonial";
ALTER TABLE "testimonial_tags" DROP CONSTRAINT "fk_tt_tag";
ALTER TABLE "analytics_events" DROP CONSTRAINT "fk_ae_testimonial";
ALTER TABLE "api_keys" DROP CONSTRAINT "api_keys_owner_id_fkey";
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "fk_delivery_webhook";
ALTER TABLE "webhook_deliveries" DROP CONSTRAINT "fk_delivery_outbox";

ALTER TABLE "testimonials" ADD CONSTRAINT "fk_testimonial_category"
  FOREIGN KEY ("tenant_id", "category_id") REFERENCES "categories"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "testimonials" ADD CONSTRAINT "fk_testimonial_created_by"
  FOREIGN KEY ("tenant_id", "created_by_id") REFERENCES "users"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "testimonial_tags" ADD CONSTRAINT "fk_tt_testimonial"
  FOREIGN KEY ("tenant_id", "testimonial_id") REFERENCES "testimonials"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "testimonial_tags" ADD CONSTRAINT "fk_tt_tag"
  FOREIGN KEY ("tenant_id", "tag_id") REFERENCES "tags"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "analytics_events" ADD CONSTRAINT "fk_ae_testimonial"
  FOREIGN KEY ("tenant_id", "testimonial_id") REFERENCES "testimonials"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_owner_id_fkey"
  FOREIGN KEY ("tenant_id", "owner_id") REFERENCES "users"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "fk_delivery_webhook"
  FOREIGN KEY ("tenant_id", "webhook_id") REFERENCES "webhooks"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "fk_delivery_outbox"
  FOREIGN KEY ("tenant_id", "outbox_event_id") REFERENCES "outbox_events"("tenant_id", "id")
  ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "testimonials" ADD CONSTRAINT "chk_testimonial_content_min"
  CHECK (char_length("content") >= 10);
CREATE INDEX "idx_testimonial_tags_tag" ON "testimonial_tags"("tag_id");

COMMIT;
