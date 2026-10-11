import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { certificatePem, connectionUrl, prepareEnvironment, profiles, projectHosts } from './config.mjs';

const directory = mkdtempSync(join(tmpdir(), 'demo-config-test-'));
execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
  '-keyout', join(directory, 'key.pem'), '-out', join(directory, 'cert.pem'), '-subj', '/CN=localhost'], { stdio: 'ignore' });
const cert = readFileSync(join(directory, 'cert.pem'), 'utf8');
after(() => rmSync(directory, { force: true, recursive: true }));
const hosts = { OLTP: 'db.syntheticoltp.supabase.co', WAREHOUSE: 'db.syntheticdw.supabase.co' };
function uri(name) {
  const p = profiles[name]; const url = new URL(`postgresql://${hosts[p.project]}/postgres`);
  url.username = p.role; url.password = 'synthetic-only'; return url.toString();
}
function environment() {
  return { NODE_ENV: 'production', TRUST_PROXY_HOPS: '0', BI_ENABLED: 'true', BI_OPERATIONS_ENABLED: 'true',
    SUPABASE_OLTP_HOST: hosts.OLTP, SUPABASE_WAREHOUSE_HOST: hosts.WAREHOUSE,
    OLTP_CA_PEM: cert, WAREHOUSE_CA_PEM: cert,
    ...Object.fromEntries(Object.keys(profiles).map(name => [name, uri(name)])) };
}

test('normalizes all runtime pools and enforces TLS with an absolute CA path', () => {
  for (const p of Object.values(profiles)) {
    const raw = new URL(`postgresql://${hosts[p.project]}/postgres`);
    raw.username = p.role; raw.password = 'synthetic-only'; raw.searchParams.set('connection_limit', '999');
    const url = new URL(connectionUrl(raw.toString(), p, hosts, '/tmp/ca.crt'));
    assert.equal(url.searchParams.get('connection_limit'), String(p.pool));
    assert.equal(url.searchParams.get('pool_timeout'), '5'); assert.equal(url.searchParams.get('connect_timeout'), '5');
    assert.equal(url.searchParams.get('sslmode'), 'require'); assert.equal(url.searchParams.get('sslaccept'), 'strict');
    assert.equal(url.searchParams.get('sslcert'), '/tmp/ca.crt');
  }
});
for (const query of ['host=/tmp', 'sslmode=disable', 'sslmode=prefer', 'sslaccept=accept_invalid_certs', 'options=anything', 'schema=auth', 'sslmode=require&sslmode=disable']) {
  test(`rejects unsafe connection parameters: ${query}`, () => {
    assert.throws(() => connectionUrl(uri('DATABASE_URL') + '?' + query, profiles.DATABASE_URL, hosts, '/tmp/ca.crt'), /DEMO_DATABASE_URL_INVALID/);
  });
}
test('rejects a pooler, wrong role, wrong project and unrecognized database without echoing credentials', () => {
  for (const mutate of [u => { u.hostname = 'pooler.supabase.com'; }, u => { u.username = 'postgres'; },
    u => { u.hostname = hosts.WAREHOUSE; }, u => { u.port = '6543'; }, u => { u.pathname = '/other'; }]) {
    const url = new URL(uri('DATABASE_URL')); mutate(url);
    assert.throws(() => connectionUrl(url.toString(), profiles.DATABASE_URL, hosts, '/tmp/ca.crt'), e => e.message === 'DEMO_DATABASE_URL_INVALID');
  }
});
test('requires separate project endpoints', () => {
  const env = environment(); env.SUPABASE_WAREHOUSE_HOST = env.SUPABASE_OLTP_HOST;
  assert.throws(() => projectHosts(env), /DEMO_PROJECTS_MUST_DIFFER/);
});
test('validates public CA material and rejects private keys or arbitrary trailing data', () => {
  assert.equal(certificatePem(cert).trim(), cert.trim());
  for (const value of ['', 'anything', cert + 'trailing', readFileSync(join(directory, 'key.pem'), 'utf8')]) {
    assert.throws(() => certificatePem(value), /DEMO_CA_INVALID/);
  }
});
test('isolates worker credentials and removes temporary certificates after shutdown', () => {
  const input = { ...environment(), JWT_SECRET: 'synthetic', REDIS_URL: 'redis://localhost', BI_MIGRATION_DATABASE_URL: 'never-forward' };
  const p = prepareEnvironment('worker', input);
  const ca = new URL(p.env.BI_ETL_DATABASE_URL).searchParams.get('sslcert');
  try {
    assert.ok(existsSync(ca)); assert.equal(p.env.DATABASE_URL, undefined); assert.equal(p.env.BI_DATABASE_URL, undefined);
    assert.equal(p.env.JWT_SECRET, undefined); assert.equal(p.env.REDIS_URL, undefined);
    assert.equal(p.env.BI_MIGRATION_DATABASE_URL, undefined); assert.equal(p.env.WAREHOUSE_CA_PEM, undefined);
  } finally { p.cleanup(); }
  assert.equal(existsSync(ca), false);
});
test('disabled BI needs no warehouse credentials or certificate and performs no connection', () => {
  const input = environment(); input.BI_ENABLED = 'false'; input.BI_OPERATIONS_ENABLED = 'false';
  delete input.WAREHOUSE_CA_PEM; delete input.BI_DATABASE_URL; delete input.BI_CONTROL_DATABASE_URL;
  const p = prepareEnvironment('api', input);
  try { assert.deepEqual(p.names, ['DATABASE_URL']); } finally { p.cleanup(); }
});
test('refuses unverified trust proxy configuration, unsafe TLS and inconsistent flags', () => {
  for (const mutation of [{ TRUST_PROXY_HOPS: '1' }, { NODE_TLS_REJECT_UNAUTHORIZED: '0' },
    { NODE_ENV: 'development' }, { BI_ENABLED: 'false', BI_OPERATIONS_ENABLED: 'true' }]) {
    assert.throws(() => prepareEnvironment('api', { ...environment(), ...mutation }), /DEMO_/);
  }
});
