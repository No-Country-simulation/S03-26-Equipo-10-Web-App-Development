-- Read-only preflight for the tenant-integrity migration. Every count must be zero.
-- Run against a copy first; never record row values or PII in diagnostic output.
SELECT relation, violations FROM (
  SELECT 'testimonial_category' AS relation, count(*) AS violations
  FROM testimonials t JOIN categories c ON c.id = t.category_id
  WHERE t.tenant_id <> c.tenant_id
  UNION ALL
  SELECT 'testimonial_author', count(*)
  FROM testimonials t JOIN users u ON u.id = t.created_by_id
  WHERE t.tenant_id <> u.tenant_id
  UNION ALL
  SELECT 'testimonial_tag', count(*)
  FROM testimonial_tags tt
  JOIN testimonials t ON t.id = tt.testimonial_id
  JOIN tags tag ON tag.id = tt.tag_id
  WHERE t.tenant_id <> tag.tenant_id
  UNION ALL
  SELECT 'analytics_testimonial', count(*)
  FROM analytics_events e JOIN testimonials t ON t.id = e.testimonial_id
  WHERE e.tenant_id <> t.tenant_id
  UNION ALL
  SELECT 'api_key_owner', count(*)
  FROM api_keys k JOIN users u ON u.id = k.owner_id
  WHERE k.tenant_id <> u.tenant_id
  UNION ALL
  SELECT 'delivery_outbox', count(*)
  FROM webhook_deliveries d
  JOIN webhooks w ON w.id = d.webhook_id
  JOIN outbox_events e ON e.id = d.outbox_event_id
  WHERE w.tenant_id <> e.tenant_id
  UNION ALL
  SELECT 'short_testimonial_content', count(*)
  FROM testimonials WHERE char_length(content) < 10
) findings ORDER BY relation;
