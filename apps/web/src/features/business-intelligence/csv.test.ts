import { describe, expect, it } from 'vitest';
import { buildBiCsv } from './csv';
import { dashboardFixture } from './test-fixtures';
import { biHref, parseBiQuery, rangeError } from './query';
import { biDashboardSchema } from './api';
describe('Authorized visible BI exports', () => {
  it('preserves large decimals, range and UTC with BOM and CRLF', () => {
    const report = buildBiCsv(dashboardFixture, 'summary');
    expect(report.filename).toBe('bi-resumen_2024-02-29_2024-03-01_UTC.csv'); expect(report.content.startsWith('\uFEFF')).toBe(true);
    expect(report.content).toContain('"9007199254740993"'); expect(report.content).toContain('"UTC"'); expect(report.content).toContain('\r\n'); expect(report.content).not.toContain('9007199254740992');
  });
  it.each(['=HYPERLINK("x")', '+1', '-1+2', '@SUM(1)', ' \t=1+1', '\r\n+1'])('escapes category text and neutralizes formula %j', name => {
    const result = buildBiCsv({ ...dashboardFixture, categories: [{ categoryKey: '1', name, count: 2, averageRating: null }] }, 'categories');
    expect(result.content).toContain(`"'${name.replaceAll('"', '""')}"`);
  });
  it('escapes commas, quotes and multiline text in a single CSV cell', () => {
    const report = buildBiCsv({ ...dashboardFixture, categories: [{ categoryKey: '1', name: 'a,"b"\nñ', count: 2, averageRating: 4.5 }] }, 'categories');
    expect(report.content).toContain('"a,""b""\nñ"');
  });
  it('keeps absent snapshots distinct from observed zero and never adds inventory', () => {
    const content = buildBiCsv(dashboardFixture, 'daily').content;
    expect(content).toContain('"sin_corte","",""'); expect(content).toContain('"observado","2","4.5"'); expect(content).toContain('"0","2","1",""');
  });
  it('exports only supplied categories and statuses with separate files', () => {
    const categories = buildBiCsv(dashboardFixture, 'categories'); const statuses = buildBiCsv(dashboardFixture, 'statuses');
    expect(categories.content).toContain('Category A'); expect(statuses.content).not.toContain('Category A'); expect(statuses.content).toContain('Publicado'); expect(categories.filename).not.toBe(statuses.filename);
  });
  it('rejects series misalignment before it can be exported', () => {
    expect(biDashboardSchema.safeParse({ ...dashboardFixture, engagementSeries: [] }).success).toBe(false);
  });
});
describe('Shareable BI filters', () => {
  it.each(['2024-02-30', '0000-01-01', 'x'])('rejects invalid UTC day %s', from => expect(rangeError({ from, to: '2024-03-01' })).not.toBeNull());
  it('defaults to 30 UTC days relative to an explicit end and validates max range/future dates', () => {
    expect(parseBiQuery(new URLSearchParams('to=2024-03-01')).query?.from).toBe('2024-02-01');
    expect(rangeError({ from: '2023-03-02', to: '2024-03-01' })).toBeNull(); expect(rangeError({ from: '2023-03-01', to: '2024-03-01' })).not.toBeNull();
    expect(rangeError({ from: '9999-01-01', to: '9999-01-02' })).not.toBeNull();
  });
  it.each(['page=0', 'requestPage=10001', 'status=published', 'origin=unknown', 'run=secret', 'view=sql'])('rejects bad query %s', query => expect(parseBiQuery(new URLSearchParams(query)).query).toBeNull());
  it('builds local links with whitelisted filters, removing stale details and foreign tenant params', () => {
    expect(biHref(new URLSearchParams('tenantId=foreign&view=runs&page=2&run=old'), { view: 'settings', run: null })).toBe('/admin/business-intelligence?view=settings&page=2');
  });
});
