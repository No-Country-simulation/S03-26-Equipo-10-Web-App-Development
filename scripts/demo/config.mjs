import { X509Certificate } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export class DemoConfigurationError extends Error {
  constructor(code) { super(code); this.name = 'DemoConfigurationError'; }
}
const fail = code => { throw new DemoConfigurationError(code); };

export const profiles = Object.freeze({
  DATABASE_URL: { role: 'cms_runtime', project: 'OLTP', pool: 5 },
  BI_DATABASE_URL: { role: 'bi_api_reader', project: 'WAREHOUSE', pool: 2 },
  BI_CONTROL_DATABASE_URL: { role: 'bi_control', project: 'WAREHOUSE', pool: 2 },
  BI_SOURCE_DATABASE_URL: { role: 'bi_source_reader', project: 'OLTP', pool: 1 },
  BI_ETL_DATABASE_URL: { role: 'bi_etl_writer', project: 'WAREHOUSE', pool: 2 },
});

export function connectionNames(service, env) {
  if (!['api', 'worker'].includes(service)) fail('DEMO_SERVICE_INVALID');
  for (const name of ['BI_ENABLED', 'BI_OPERATIONS_ENABLED', 'BI_STATISTICS_ENABLED']) {
    if (env[name] !== undefined && !['true', 'false'].includes(env[name])) fail('DEMO_BI_FLAGS_INVALID');
  }
  if (service === 'worker') return ['BI_SOURCE_DATABASE_URL', 'BI_ETL_DATABASE_URL'];
  if (env.BI_STATISTICS_ENABLED === 'true' && env.BI_ENABLED !== 'true') fail('DEMO_BI_FLAGS_INVALID');
  if (env.BI_OPERATIONS_ENABLED === 'true' && env.BI_ENABLED !== 'true') fail('DEMO_BI_FLAGS_INVALID');
  return ['DATABASE_URL', ...(env.BI_ENABLED === 'true' ? ['BI_DATABASE_URL'] : []),
    ...(env.BI_OPERATIONS_ENABLED === 'true' ? ['BI_CONTROL_DATABASE_URL'] : [])];
}

export function projectHosts(env) {
  const hosts = {};
  for (const project of ['OLTP', 'WAREHOUSE']) {
    const value = env[`SUPABASE_${project}_HOST`];
    if (!value || !/^db\.[a-z0-9]+\.supabase\.co$/.test(value)) fail('DEMO_DIRECT_HOST_REQUIRED');
    hosts[project] = value;
  }
  if (hosts.OLTP === hosts.WAREHOUSE) fail('DEMO_PROJECTS_MUST_DIFFER');
  return hosts;
}

export function certificatePem(value) {
  try {
    if (!value || value.length > 65536) throw new Error();
    const certificates = value.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g);
    if (!certificates?.length || value.replace(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g, '').trim()) throw new Error();
    for (const pem of certificates) new X509Certificate(pem);
    return certificates.join('\n') + '\n';
  } catch { fail('DEMO_CA_INVALID'); }
}

export function connectionUrl(value, profile, hosts, caPath) {
  try {
    const url = new URL(value);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== hosts[profile.project]
      || (url.port && url.port !== '5432') || url.pathname !== '/postgres' || url.hash
      || decodeURIComponent(url.username) !== profile.role || !url.password) throw new Error();
    const allowed = new Set(['schema', 'connection_limit', 'pool_timeout', 'connect_timeout', 'sslmode', 'sslaccept', 'sslcert']);
    for (const key of url.searchParams.keys()) {
      if (!allowed.has(key) || url.searchParams.getAll(key).length !== 1) throw new Error();
    }
    if ((url.searchParams.has('schema') && url.searchParams.get('schema') !== 'public')
      || (url.searchParams.has('sslmode') && url.searchParams.get('sslmode') !== 'require')
      || (url.searchParams.has('sslaccept') && url.searchParams.get('sslaccept') !== 'strict')) throw new Error();
    url.searchParams.set('schema', 'public');
    url.searchParams.set('sslmode', 'require');
    url.searchParams.set('sslaccept', 'strict');
    // Prisma 6.5 accepts sslcert; absolute paths avoid resolution against its schema directory.
    url.searchParams.set('sslcert', caPath);
    url.searchParams.set('connection_limit', String(profile.pool));
    url.searchParams.set('pool_timeout', '5');
    url.searchParams.set('connect_timeout', '5');
    return url.toString();
  } catch { fail('DEMO_DATABASE_URL_INVALID'); }
}

/** No database connection here: a warehouse outage must not stop CMS startup. */
export function prepareEnvironment(service, input) {
  if (input.NODE_ENV !== 'production' || input.NODE_TLS_REJECT_UNAUTHORIZED === '0') fail('DEMO_RUNTIME_INVALID');
  if (service === 'api' && input.TRUST_PROXY_HOPS !== '0') fail('DEMO_PROXY_VERIFICATION_REQUIRED');
  const names = connectionNames(service, input);
  const hosts = projectHosts(input);
  const directory = mkdtempSync(join(tmpdir(), 'testimonial-demo-ca-'));
  const cleanup = () => rmSync(directory, { recursive: true, force: true });
  const env = { ...input };
  try {
    for (const project of new Set(names.map(name => profiles[name].project))) {
      const path = join(directory, `${project.toLowerCase()}.crt`);
      writeFileSync(path, certificatePem(input[`${project}_CA_PEM`]), { mode: 0o600, flag: 'wx' });
      for (const name of names.filter(name => profiles[name].project === project)) {
        env[name] = connectionUrl(input[name], profiles[name], hosts, path);
      }
    }
    // Runtime children never receive migration credentials or unused database identities.
    for (const name of [...Object.keys(profiles), 'MIGRATION_DATABASE_URL', 'BI_MIGRATION_DATABASE_URL']) {
      if (!names.includes(name)) delete env[name];
    }
    delete env.OLTP_CA_PEM;
    delete env.WAREHOUSE_CA_PEM;
    if (service === 'worker') {
      for (const name of Object.keys(env)) {
        if (/^(JWT_|API_KEY_|WEBHOOK_|CLOUDINARY_|YOUTUBE_|METRICS_TOKEN$|REDIS_URL$)/.test(name)) delete env[name];
      }
    }
    return { env, names, cleanup };
  } catch (error) { cleanup(); throw error; }
}
