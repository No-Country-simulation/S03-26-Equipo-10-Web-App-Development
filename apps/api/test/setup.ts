import { accessSync, constants } from 'node:fs';

// Local unit runs may omit services. CI must exercise every integration suite.
if (process.env.CI) {
  const required = [
    'TEST_DATABASE_URL',
    'TEST_LOGO_DATABASE_URL',
    'TEST_REDIS_URL',
    'TEST_BI_SOURCE_DATABASE_URL',
    'TEST_BI_WAREHOUSE_DATABASE_URL',
    'TEST_BI_BENCHMARK_SCHEMA_FILE',
    'TEST_BI_REDIS_URL',
  ] as const;
  const missing = required.filter(name => !process.env[name]);
  if (missing.length) throw new Error(`CI integration configuration required: ${missing.join(', ')}`);
  try {
    accessSync(process.env.TEST_BI_BENCHMARK_SCHEMA_FILE!, constants.R_OK);
  } catch {
    throw new Error('TEST_BI_BENCHMARK_SCHEMA_FILE must reference readable generated DDL in CI');
  }
  const source = new URL(process.env.TEST_BI_SOURCE_DATABASE_URL!);
  const warehouse = new URL(process.env.TEST_BI_WAREHOUSE_DATABASE_URL!);
  if (source.hostname === warehouse.hostname && (source.port || '5432') === (warehouse.port || '5432')) {
    throw new Error('CI BI integration requires two separate PostgreSQL servers');
  }
}

process.env.JWT_SECRET = 'test-only-placeholder-with-at-least-32-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test?schema=public';
process.env.PORT = '4000';
process.env.CORS_ORIGIN = 'http://localhost:3000';
