import { PrismaClient } from '@prisma/client';
import { SourceRepository } from '../src/modules/business-intelligence/repositories/source.repository';
import { statisticsDataReady } from '../src/modules/business-intelligence/repositories/statistics-data-preflight';
import { main as statisticsHistory } from '../src/modules/business-intelligence/statistics-history.cli';

describe('optional statistics taxonomy extraction', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const tagId = '22222222-2222-4222-8222-222222222222';
  const testimonialId = '33333333-3333-4333-8333-333333333333';
  function fixture() {
    const queries: string[] = [];
    let tagsRead = false; let linksRead = false;
    const tx = { $executeRaw: jest.fn(), $executeRawUnsafe: jest.fn(),
      $queryRaw: jest.fn(async (sql: TemplateStringsArray, ...values: unknown[]) => {
        const text = sql.join('?'); queries.push(text);
        expect(values[0]).toBe(tenantId);
        if (text.includes('FROM bi_export.tenants')) return [{ tenantId, name: 'Synthetic', isActive: true, at: new Date() }];
        if (text.includes('FROM bi_export.tags') && !tagsRead) { tagsRead = true; return [{ tenantId, tagId, name: 'Synthetic tag' }]; }
        if (text.includes('FROM bi_export.testimonial_tags') && !linksRead) { linksRead = true; return [{ tenantId, testimonialId, tagId }]; }
        return [];
      }) };
    const client = { $transaction: async (work: (value: typeof tx) => Promise<unknown>) => work(tx) };
    const consumer = { snapshot: jest.fn(), categories: jest.fn(), testimonials: jest.fn(), events: jest.fn(),
      tags: jest.fn(), testimonialTags: jest.fn() };
    return { client: client as unknown as PrismaClient, consumer, queries };
  }
  it('preserves the legacy extraction without touching taxonomy when disabled', async () => {
    const { client, consumer, queries } = fixture();
    expect(await new SourceRepository(client, 1).extract(tenantId, consumer))
      .toEqual({ categories: 0n, testimonials: 0n, events: 0n });
    expect(queries.some(query => /FROM bi_export\.(tags|testimonial_tags)/.test(query))).toBe(false);
    expect(consumer.tags).not.toHaveBeenCalled();
  });
  it('pages tags and links in the same extraction and returns separately reconciliable totals', async () => {
    const { client, consumer } = fixture();
    const counts = await new SourceRepository(client, 1, true).extract(tenantId, consumer);
    expect(consumer.tags).toHaveBeenCalledWith([{ tenantId, tagId, name: 'Synthetic tag' }]);
    expect(consumer.testimonialTags).toHaveBeenCalledWith([{ tenantId, testimonialId, tagId }]);
    expect(counts).toEqual({ categories: 0n, testimonials: 0n, events: 0n, taxonomy: { tags: 1n, relations: 1n } });
  });
  it('does not query either connection from a disabled optional preflight', async () => {
    const query = jest.fn().mockRejectedValue(new Error('Should not connect'));
    const client = { $queryRaw: query } as unknown as PrismaClient;
    expect(await statisticsDataReady(client, client, false)).toBe(false);
    expect(query).not.toHaveBeenCalled();
  });
  it('rejects a maintenance CLI without explicit mode/maintenance before creating a connection', async () => {
    await expect(statisticsHistory([])).rejects.toMatchObject({ code: 'BI_CONFIGURATION_INVALID' });
    await expect(statisticsHistory(['--apply'])).rejects.toMatchObject({ code: 'BI_CONFIGURATION_INVALID' });
  });
});
