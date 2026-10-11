const select = ['SELECT'];
const write = ['SELECT', 'INSERT', 'UPDATE'];
const crud = [...write, 'DELETE'];
export const cmsTables = 'tenants tenant_logo_cleanup_jobs roles permissions role_permissions users user_roles refresh_tokens refresh_sessions testimonial_status categories tags testimonials testimonial_tags analytics_event_types analytics_events webhook_events webhooks webhook_deliveries webhook_delivery_attempts feature_flags tenant_feature_flags api_keys api_key_credentials outbox_events idempotency_keys audit_logs'.split(' ').map(name => `public.${name}`);
export const exportTables = ['tenants', 'categories', 'testimonials', 'analytics_events'].map(name => `bi_export.${name}`);
export const dwTables = 'dim_date dim_tenant dim_testimonial dim_category dim_status dim_source dim_event_type fact_tenant_snapshot fact_testimonial_snapshot fact_engagement_daily'.split(' ').map(name => `dw.${name}`);
export const stagingTables = ['categories', 'testimonials', 'analytics_events'].map(name => `staging.${name}`);
export const operationalTables = ['tenant_settings', 'load_requests', 'control_audit', 'runs', 'tenant_load_state', 'worker_health'].map(name => `etl.${name}`);
export const cmsSequences = ['roles_id_seq', 'testimonial_status_id_seq', 'analytics_event_types_id_seq', 'analytics_events_id_seq', 'audit_logs_id_seq'].map(name => `public.${name}`);
export const privileges = ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER'];
const mapping = (names, rights) => Object.fromEntries(names.map(name => [name, rights]));

export const permissions = {
  cms_runtime: {
    schemas: ['public'], tables: {
      ...mapping(cmsTables, crud),
      ...mapping(['permissions', 'role_permissions', 'webhook_events'].map(name => `public.${name}`), select),
      ...mapping(['roles', 'testimonial_status', 'analytics_event_types', 'feature_flags'].map(name => `public.${name}`), write),
      'public.audit_logs': ['SELECT', 'INSERT'],
    },
  },
  bi_source_reader: { schemas: ['bi_export'], tables: mapping(exportTables, select) },
  bi_api_reader: { schemas: ['dw', 'etl'], tables: mapping([...dwTables, ...operationalTables], select) },
  bi_etl_writer: {
    schemas: ['staging', 'dw', 'etl'], tables: {
      ...mapping([...stagingTables, ...dwTables], crud),
      ...mapping(['etl.runs', 'etl.tenant_load_state', 'etl.tenant_settings', 'etl.worker_health'], write),
      'etl.load_requests': ['SELECT', 'UPDATE'], 'etl.schema_migrations': select,
    },
  },
  bi_control: {
    schemas: ['etl'], tables: {
      ...mapping(operationalTables, select),
      'etl.tenant_settings': write,
      'etl.load_requests': ['SELECT', 'INSERT'],
      'etl.control_audit': ['SELECT', 'INSERT'],
    },
  },
};

/** Inspect effective permissions, including inheritance/ownership/PUBLIC, without changing data. */
export async function inspectConnection(client, role) {
  const policy = permissions[role];
  if (!policy) throw new Error('DEMO_ROLE_INVALID');
  return client.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
    const [server] = await tx.$queryRaw`
      SELECT current_user AS identity, current_setting('server_version_num')::int AS version,
        current_setting('max_connections')::int AS max_connections,
        coalesce((SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()), false) AS tls,
        r.rolsuper OR r.rolcreatedb OR r.rolcreaterole OR r.rolreplication OR r.rolbypassrls AS elevated,
        EXISTS (SELECT 1 FROM pg_roles other WHERE other.rolname <> current_user
          AND pg_has_role(current_user, other.oid, 'MEMBER')) AS membership,
        has_database_privilege(current_database(), 'CREATE') AS database_create
      FROM pg_roles r WHERE r.rolname = current_user`;
    const issues = [];
    if (!server || server.identity !== role) issues.push('IDENTITY');
    if (!server || server.version < 170000 || server.version >= 190000) issues.push('VERSION');
    if (!server?.tls) issues.push('TLS');
    if (server?.elevated || server?.membership || server?.database_create) issues.push('ROLE_PRIVILEGES');

    const schemas = await tx.$queryRaw`
      SELECT nspname AS name, has_schema_privilege(oid, 'CREATE') AS can_create,
        has_schema_privilege(oid, 'USAGE') AS can_use
      FROM pg_namespace WHERE nspname IN ('public', 'bi_export', 'staging', 'dw', 'etl')`;
    if (schemas.some(s => s.can_create) || policy.schemas.some(name => !schemas.some(s => s.name === name && s.can_use))) issues.push('SCHEMA_PRIVILEGES');
    const objects = await tx.$queryRaw`
      SELECT n.nspname || '.' || c.relname AS name, c.oid::bigint AS object_id,
        pg_has_role(current_user, c.relowner, 'MEMBER') AS owned,
        has_table_privilege(c.oid, 'SELECT') AS "SELECT", has_table_privilege(c.oid, 'INSERT') AS "INSERT",
        has_table_privilege(c.oid, 'UPDATE') AS "UPDATE", has_table_privilege(c.oid, 'DELETE') AS "DELETE",
        has_table_privilege(c.oid, 'TRUNCATE') AS "TRUNCATE", has_table_privilege(c.oid, 'REFERENCES') AS "REFERENCES",
        has_table_privilege(c.oid, 'TRIGGER') AS "TRIGGER",
        EXISTS (SELECT 1 FROM pg_roles exposed WHERE exposed.rolname IN ('anon', 'authenticated', 'service_role')
          AND (has_table_privilege(exposed.oid, c.oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
            OR has_any_column_privilege(exposed.oid, c.oid, 'SELECT,INSERT,UPDATE,REFERENCES'))) AS data_api_grants
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_roles owner ON owner.oid = c.relowner
      WHERE c.relkind IN ('r', 'p', 'v', 'm') AND (
        n.nspname IN ('bi_export', 'staging', 'dw', 'etl') OR (n.nspname = 'public' AND (
          c.relname = ANY(${cmsTables.map(name => name.slice(7)).concat('_prisma_migrations')}::text[])
          OR owner.rolname = 'cms_migrator')))`;
    if (Object.keys(policy.tables).some(name => !objects.some(o => o.name === name))) issues.push('SCHEMA_INCOMPLETE');
    for (const object of objects) {
      const allowed = policy.tables[object.name] ?? [];
      if (object.owned || privileges.some(p => object[p] !== allowed.includes(p))) issues.push('TABLE_PRIVILEGES');
      if (object.data_api_grants) issues.push('DATA_API_GRANTS');
    }
    const columns = await tx.$queryRaw`
      SELECT n.nspname || '.' || c.relname AS name, a.attname AS column,
        has_column_privilege(c.oid, a.attnum, 'UPDATE') AS can_update,
        has_column_privilege(c.oid, a.attnum, 'INSERT') AS can_insert,
        has_column_privilege(c.oid, a.attnum, 'SELECT') AS can_select,
        has_column_privilege(c.oid, a.attnum, 'REFERENCES') AS can_reference
      FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p', 'v', 'm')
        AND c.oid::bigint = ANY(${objects.map(o => o.object_id)}::bigint[])`;
    for (const column of columns) {
      const allowed = policy.tables[column.name] ?? [];
      const update = allowed.includes('UPDATE') || (role === 'bi_control' && column.name === 'etl.load_requests'
        && ['status', 'finished_at', 'error_code'].includes(column.column));
      if (column.can_update !== update || column.can_insert !== allowed.includes('INSERT')
        || column.can_select !== allowed.includes('SELECT') || column.can_reference) issues.push('COLUMN_PRIVILEGES');
    }
    const sequences = await tx.$queryRaw`
      SELECT n.nspname || '.' || c.relname AS name,
        has_sequence_privilege(c.oid, 'USAGE') AS can_use,
        has_sequence_privilege(c.oid, 'SELECT,UPDATE') AS extra
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'S' AND n.nspname IN ('public', 'dw', 'staging', 'etl', 'bi_export')`;
    for (const sequence of sequences) {
      const expected = role === 'bi_etl_writer' && sequence.name.startsWith('dw.')
        || role === 'cms_runtime' && cmsSequences.includes(sequence.name);
      if (sequence.can_use !== expected || sequence.extra) issues.push('SEQUENCE_PRIVILEGES');
    }
    const [functions] = await tx.$queryRaw`
      SELECT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname IN ('public', 'bi_export', 'staging', 'dw', 'etl') AND p.prosecdef
          AND has_function_privilege(p.oid, 'EXECUTE')) AS unsafe`;
    if (functions?.unsafe) issues.push('DEFINER_PRIVILEGES');
    if (role === 'bi_etl_writer') {
      const ledger = await tx.$queryRaw`SELECT version FROM etl.schema_migrations WHERE version = '0004_bi_operations.sql'`;
      if (ledger.length !== 1) issues.push('WAREHOUSE_PROTOCOL');
    }
    return { passed: issues.length === 0, issues: [...new Set(issues)], version: server?.version,
      maxConnections: server?.max_connections };
  }, { timeout: 15000, maxWait: 1000 });
}
