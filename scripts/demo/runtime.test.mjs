import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { main as preflight } from './preflight.mjs';

test('worker wrapper isolates credentials, forwards SIGTERM and removes CA files after draining', { timeout: 15000 }, async () => {
  const root = mkdtempSync(join(tmpdir(), 'demo-runtime-test-'));
  let child;
  try {
    mkdirSync(join(root, 'scripts/demo'), { recursive: true });
    mkdirSync(join(root, 'apps/api/dist/modules/business-intelligence'), { recursive: true });
    for (const name of ['runtime.mjs', 'config.mjs']) copyFileSync(new URL(name, import.meta.url), join(root, 'scripts/demo', name));
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1', '-keyout', join(root, 'key.pem'),
      '-out', join(root, 'ca.pem'), '-subj', '/CN=localhost'], { stdio: 'ignore' });
    const cert = readFileSync(join(root, 'ca.pem'), 'utf8');
    const uri = (role, host) => { const u = new URL(`postgresql://${host}/postgres`); u.username = role; u.password = 'synthetic-only'; return u.toString(); };
    const env = { ...process.env, NODE_ENV: 'production', SUPABASE_OLTP_HOST: 'db.fixtureoltp.supabase.co', SUPABASE_WAREHOUSE_HOST: 'db.fixturedw.supabase.co',
      OLTP_CA_PEM: cert, WAREHOUSE_CA_PEM: cert, BI_SOURCE_DATABASE_URL: uri('bi_source_reader', 'db.fixtureoltp.supabase.co'),
      BI_ETL_DATABASE_URL: uri('bi_etl_writer', 'db.fixturedw.supabase.co'), JWT_SECRET: 'synthetic', MIGRATION_DATABASE_URL: 'synthetic', REDIS_URL: 'redis://localhost' };
    writeFileSync(join(root, 'apps/api/dist/modules/business-intelligence/etl.cli.js'), `
      const u = new URL(process.env.BI_ETL_DATABASE_URL);
      const timer = setInterval(() => {}, 1000);
      process.on('SIGTERM', () => setTimeout(() => { clearInterval(timer); process.exit(0); }, 50));
      console.log(JSON.stringify({ca: u.searchParams.get('sslcert'), isolated: !process.env.JWT_SECRET && !process.env.REDIS_URL && !process.env.MIGRATION_DATABASE_URL}));
    `);
    child = spawn(process.execPath, [join(root, 'scripts/demo/runtime.mjs'), 'worker'], { env, stdio: ['ignore', 'pipe', 'pipe'] });
    const ready = await once(child.stdout, 'data', { signal: AbortSignal.timeout(5000) }); const message = JSON.parse(ready[0].toString());
    assert.equal(message.isolated, true); assert.equal(existsSync(message.ca), true);
    const exit = once(child, 'exit', { signal: AbortSignal.timeout(5000) }); child.kill('SIGTERM');
    assert.equal((await exit)[0], 0); assert.equal(existsSync(message.ca), false);
    const logs = []; const original = console.log; console.log = value => logs.push(value);
    try { assert.equal(await preflight(['worker', '--offline'], env), true); } finally { console.log = original; }
    assert.equal(logs.length, 1); assert.equal(logs[0].includes('synthetic-only'), false);
    assert.deepEqual(JSON.parse(logs[0]).checks.map(c => c.pool), [1, 2]);
  } finally {
    if (child?.exitCode === null && child.signalCode === null) {
      const exit = once(child, 'exit', { signal: AbortSignal.timeout(2000) }); child.kill('SIGKILL'); await exit;
    }
    rmSync(root, { recursive: true, force: true });
  }
});
