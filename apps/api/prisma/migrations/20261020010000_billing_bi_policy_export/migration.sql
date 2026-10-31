-- Additive export for the existing read-only BI worker. No payment, payer,
-- credential, subscription identifier or amount is exported. No PUBLIC grant.
CREATE VIEW bi_export.billing_policy WITH (security_barrier = true) AS
SELECT t.id AS tenant_id, COALESCE(a.enforcement_enabled, false) AS enforcement_enabled,
  p.kind, p.starts_at, p.ends_at, p.revoked_at,
  COALESCE(v.grace_days, 0) AS grace_days,
  COALESCE(v.business_intelligence, false) AS business_intelligence,
  COALESCE(v.bi_statistics, false) AS bi_statistics
FROM tenants t
LEFT JOIN billing_accounts a ON a.tenant_id = t.id
LEFT JOIN billing_access_periods p ON p.tenant_id = t.id AND p.environment = 'sandbox' AND p.starts_at <= now()
LEFT JOIN billing_plan_versions v ON v.id = p.plan_version_id
WHERE t.is_active;
REVOKE ALL ON bi_export.billing_policy FROM PUBLIC;
