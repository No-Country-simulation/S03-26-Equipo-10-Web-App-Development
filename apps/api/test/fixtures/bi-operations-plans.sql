-- Sólo PostgreSQL descartable vacío con 0001..0004 instaladas; nunca producción.
-- Datos sintéticos: 100 empresas x 200 horas, más 500 pendientes de otras empresas.
-- ROLLBACK elimina las filas; no representa una prueba de capacidad productiva.
\set ON_ERROR_STOP on
BEGIN;
SET LOCAL timezone = 'UTC';
SET LOCAL statement_timeout = '30s';
INSERT INTO etl.load_requests
    (id, tenant_id, actor_id, kind, idempotency_key, payload_hash, slot_at, expires_at,
     status, created_at, finished_at)
SELECT md5('request-' || t || '-' || h)::uuid, md5('tenant-' || t)::uuid, md5('actor-' || t)::uuid,
    'manual', 'fixture-' || h, repeat('a', 64),
    date_trunc('hour', now()) - h * interval '1 hour',
    date_trunc('hour', now()) - (h - 1) * interval '1 hour', 'cancelled',
    date_trunc('hour', now()) - h * interval '1 hour' + interval '1 minute',
    date_trunc('hour', now()) - h * interval '1 hour' + interval '2 minutes'
FROM generate_series(1, 100) t CROSS JOIN generate_series(1, 200) h;
INSERT INTO etl.load_requests
    (tenant_id, actor_id, kind, idempotency_key, payload_hash, slot_at, expires_at, created_at)
SELECT md5('queued-tenant-' || t)::uuid, md5('actor-' || t)::uuid, 'manual', 'pending', repeat('a', 64),
    date_trunc('hour', now()), date_trunc('hour', now()) + interval '1 hour',
    date_trunc('hour', now()) + t * interval '1 millisecond'
FROM generate_series(1, 500) t;
INSERT INTO etl.runs (id, tenant_id, slot_at, attempt_no, status, started_at, finished_at, error_code)
SELECT md5('run-' || t || '-' || h)::uuid, md5('tenant-' || t)::uuid,
    date_trunc('hour', now()) - h * interval '1 hour', 1, 'failed',
    date_trunc('hour', now()) - h * interval '1 hour' + interval '1 minute',
    date_trunc('hour', now()) - h * interval '1 hour' + interval '2 minutes', 'BI_ETL_FAILED'
FROM generate_series(1, 100) t CROSS JOIN generate_series(1, 200) h;
INSERT INTO etl.control_audit (tenant_id, actor_id, action, request_id, created_at)
SELECT tenant_id, actor_id, 'request_created', id, created_at FROM etl.load_requests;
ANALYZE etl.load_requests;
ANALYZE etl.runs;
ANALYZE etl.control_audit;

EXPLAIN (ANALYZE, BUFFERS)
SELECT id, tenant_id FROM etl.load_requests WHERE status = 'pending'
ORDER BY created_at, id LIMIT 1 FOR UPDATE SKIP LOCKED;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status FROM etl.load_requests WHERE tenant_id = md5('tenant-1')::uuid
    AND created_at >= current_date - interval '30 days' AND created_at < current_date + interval '1 day'
ORDER BY created_at DESC, id DESC LIMIT 20;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, status FROM etl.runs WHERE tenant_id = md5('tenant-1')::uuid
    AND started_at >= current_date - interval '30 days' AND started_at < current_date + interval '1 day'
ORDER BY started_at DESC, id DESC LIMIT 20;
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, action FROM etl.control_audit WHERE tenant_id = md5('tenant-1')::uuid
    AND created_at >= current_date - interval '30 days' AND created_at < current_date + interval '1 day'
ORDER BY created_at DESC, id DESC LIMIT 20;
EXPLAIN (ANALYZE, BUFFERS)
SELECT count(*) FROM etl.load_requests WHERE tenant_id = md5('tenant-1')::uuid
    AND created_at >= current_date - interval '30 days' AND created_at < current_date + interval '1 day';
ROLLBACK;
