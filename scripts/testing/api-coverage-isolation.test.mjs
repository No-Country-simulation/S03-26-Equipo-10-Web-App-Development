import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';

const execute = promisify(execFile);

test(
  'API coverage isolates the next suite from a worker retaining excess heap',
  { timeout: 30000 },
  async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'api-coverage-isolation-'));
    t.after(() => rm(directory, { recursive: true, force: true }));
    const marker = join(directory, 'workers.json');
    const fixture = `
    const fs = require('node:fs');
    test('retained runner heap does not contaminate the next suite', () => {
      const marker = ${JSON.stringify(marker)};
      const previous = fs.existsSync(marker) ? JSON.parse(fs.readFileSync(marker, 'utf8')) : [];
      expect(previous).not.toContain(process.pid);
      fs.writeFileSync(marker, JSON.stringify([...previous, process.pid]));
      // Deliberately retain 192 MiB beyond environment teardown, only in this fixture.
      process.__coverageIsolationFixture = new Array(24 * 1024 * 1024).fill(0);
    });
  `;
    await Promise.all([
      writeFile(join(directory, 'first.test.js'), fixture),
      writeFile(join(directory, 'second.test.js'), fixture),
    ]);
    const config = JSON.stringify({
      rootDir: directory,
      testRegex: '\\.test\\.js$',
      transform: {},
      coverageDirectory: join(directory, 'coverage'),
      coverageReporters: ['json-summary'],
      cache: false,
    });
    const result = await execute(
      'npm',
      [
        'run',
        'test:cov',
        '--workspace',
        '@testimonial-cms/api',
        '--',
        '--config',
        config,
      ],
      { timeout: 25000, maxBuffer: 128 * 1024 },
    );
    assert.match(result.stderr, /Tests:\s+2 passed, 2 total/);
    const pids = JSON.parse(await readFile(marker, 'utf8'));
    assert.equal(pids.length, 2);
    assert.equal(new Set(pids).size, 2);
  },
);
