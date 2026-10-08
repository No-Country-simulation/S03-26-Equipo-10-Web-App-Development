-- Migración aditiva de logo y limpieza durable; no aplicada por el agente.
BEGIN;
SET LOCAL lock_timeout = '1s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE public.tenants
    ADD COLUMN logo_url text,
    ADD COLUMN logo_public_id text,
    ADD COLUMN logo_revision bigint NOT NULL DEFAULT 0;

ALTER TABLE public.tenants
    ADD CONSTRAINT ck_tenants_logo_revision CHECK (logo_revision >= 0);

ALTER TABLE public.tenants
    ADD CONSTRAINT ck_tenants_logo_pair CHECK (
        (logo_url IS NULL AND logo_public_id IS NULL)
        OR (
            logo_url IS NOT NULL AND logo_public_id IS NOT NULL
            AND logo_url LIKE 'https://res.cloudinary.com/%'
            AND length(logo_url) > length('https://res.cloudinary.com/')
            AND logo_public_id LIKE 'tenant-logos/' || id::text || '/%'
            AND length(logo_public_id) > length('tenant-logos/' || id::text || '/')
        )
    );

-- Intención durable previa a subida + limpieza del asset reemplazado.
-- Una carga cancelada/ambigua se recupera por public_id preasignado.
CREATE TABLE public.tenant_logo_cleanup_jobs (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id uuid NOT NULL,
    public_id text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    attempts integer NOT NULL DEFAULT 0,
    next_attempt_at timestamptz(3) NOT NULL,
    lease_token uuid,
    lease_until timestamptz(3),
    error_code text,
    created_at timestamptz(3) NOT NULL DEFAULT current_timestamp,
    updated_at timestamptz(3) NOT NULL DEFAULT current_timestamp,
    CONSTRAINT pk_tenant_logo_cleanup_jobs PRIMARY KEY (id),
    CONSTRAINT uq_tenant_logo_cleanup_asset UNIQUE (tenant_id, public_id),
    CONSTRAINT fk_tenant_logo_cleanup_tenant FOREIGN KEY (tenant_id)
        REFERENCES public.tenants (id) ON DELETE RESTRICT,
    CONSTRAINT ck_tenant_logo_cleanup_status CHECK (
        status IN ('pending', 'processing', 'completed', 'cancelled', 'dead')
    ),
    CONSTRAINT ck_tenant_logo_cleanup_attempts CHECK (attempts BETWEEN 0 AND 10),
    CONSTRAINT ck_tenant_logo_cleanup_namespace CHECK (
        public_id LIKE 'tenant-logos/' || tenant_id::text || '/%'
        AND length(public_id) > length('tenant-logos/' || tenant_id::text || '/')
    ),
    CONSTRAINT ck_tenant_logo_cleanup_lease CHECK (
        (status = 'processing' AND lease_token IS NOT NULL AND lease_until IS NOT NULL)
        OR (status <> 'processing' AND lease_token IS NULL AND lease_until IS NULL)
    ),
    CONSTRAINT ck_tenant_logo_cleanup_error_code CHECK (
        error_code IS NULL OR error_code ~ '^[A-Z][A-Z0-9_]{0,63}$'
    )
);

-- Índices sólo sobre tabla nueva vacía; no bloquear escaneos existentes.
CREATE INDEX idx_tenant_logo_cleanup_due
    ON public.tenant_logo_cleanup_jobs (next_attempt_at, id)
    WHERE status = 'pending';
CREATE INDEX idx_tenant_logo_cleanup_expired
    ON public.tenant_logo_cleanup_jobs (lease_until, id)
    WHERE status = 'processing';

COMMIT;
