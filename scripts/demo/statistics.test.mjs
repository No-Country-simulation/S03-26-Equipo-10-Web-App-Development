import { test } from 'node:test';
import assert from 'node:assert/strict';
import { permissions, permissionPolicy } from './permissions.mjs';
import { connectionNames } from './config.mjs';

test('statistics opt-in requires explicit API BI, validates worker flags, and adds no connections', () => {
  assert.throws(
    () => connectionNames('api', { BI_STATISTICS_ENABLED: 'true' }),
    /DEMO_BI_FLAGS_INVALID/,
  );
  assert.throws(
    () => connectionNames('worker', { BI_STATISTICS_ENABLED: 'invalid' }),
    /DEMO_BI_FLAGS_INVALID/,
  );
  assert.deepEqual(
    connectionNames('worker', { BI_STATISTICS_ENABLED: 'true' }),
    ['BI_SOURCE_DATABASE_URL', 'BI_ETL_DATABASE_URL'],
  );
  assert.deepEqual(
    connectionNames('api', {
      BI_ENABLED: 'true',
      BI_STATISTICS_ENABLED: 'true',
    }),
    ['DATABASE_URL', 'BI_DATABASE_URL'],
  );
});
test('statistics grants preserve immutable reports and creations and isolate control/read/source', () => {
  assert.deepEqual(
    permissionPolicy('bi_etl_writer', true).tables['dw.statistics_publication'],
    ['SELECT', 'INSERT'],
  );
  assert.deepEqual(
    permissionPolicy('bi_etl_writer', true).tables[
      'dw.fact_testimonial_creation'
    ],
    ['SELECT', 'INSERT'],
  );
  assert.deepEqual(
    permissionPolicy('bi_etl_writer', true).tables['etl.statistics_jobs'],
    ['SELECT', 'INSERT', 'UPDATE'],
  );
  assert.deepEqual(
    permissionPolicy('bi_api_reader', true).tables['dw.statistics_publication'],
    ['SELECT'],
  );
  assert.equal(
    permissionPolicy('bi_api_reader', true).tables['etl.statistics_jobs'],
    undefined,
  );
  assert.deepEqual(
    permissionPolicy('bi_source_reader', true).tables[
      'bi_export.testimonial_tags'
    ],
    ['SELECT'],
  );
  assert.deepEqual(
    permissionPolicy('bi_control', true),
    permissions.bi_control,
  );
  assert.deepEqual(
    permissionPolicy('bi_etl_writer'),
    permissions.bi_etl_writer,
  );
});
