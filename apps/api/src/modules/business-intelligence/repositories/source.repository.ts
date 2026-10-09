import { Prisma, PrismaClient } from '@prisma/client';
import { EtlError, type CategoryRow, type Counts, type EventRow, type SourceConsumer,
  type SourceSnapshot, type TestimonialRow } from '../etl.types';

export class SourceRepository {
  constructor(private readonly client: PrismaClient, private readonly pageSize = 1000) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new EtlError('BI_CONFIGURATION_INVALID');
  }

  /** Explicit exporter inventory. Only identifiers; no private resource is read without tenant scope. */
  async tenantIds(after: string | null): Promise<string[]> {
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT tenant_id AS id FROM bi_export.tenants
        WHERE (${after}::uuid IS NULL OR tenant_id > ${after}::uuid)
        ORDER BY tenant_id LIMIT ${this.pageSize}`;
      return rows.map(row => row.id);
    }, { timeout: 35000, maxWait: 5000 });
  }

  async extract(tenantId: string, consumer: SourceConsumer, deadline = Date.now() + 300000): Promise<Counts> {
    const remaining = Math.min(300000, Math.floor(deadline - Date.now()));
    if (remaining <= 0) throw new EtlError('BI_DEADLINE_EXCEEDED');
    return this.client.$transaction(async tx => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
      await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
      await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = '60s'`;
      // Internal bounded integer, never user SQL; SET cannot bind a value parameter.
      await tx.$executeRawUnsafe(`SET LOCAL transaction_timeout = '${remaining}ms'`);
      const [snapshot] = await tx.$queryRaw<SourceSnapshot[]>`
        SELECT tenant_id AS "tenantId", name, is_active AS "isActive",
          date_trunc('milliseconds', statement_timestamp()) AS at
        FROM bi_export.tenants WHERE tenant_id = ${tenantId}::uuid`;
      if (!snapshot) throw new EtlError('BI_SOURCE_INCONSISTENT');
      await consumer.snapshot(snapshot);
      const counts: Counts = { categories: 0n, testimonials: 0n, events: 0n };
      let categoryCursor: string | null = null;
      while (true) {
        const rows: CategoryRow[] = await tx.$queryRaw`
          SELECT tenant_id AS "tenantId", category_id AS "categoryId", name FROM bi_export.categories
          WHERE tenant_id = ${tenantId}::uuid AND (${categoryCursor}::uuid IS NULL OR category_id > ${categoryCursor}::uuid)
          ORDER BY category_id LIMIT ${this.pageSize}`;
        if (!rows.length) break;
        await consumer.categories(rows);
        counts.categories += BigInt(rows.length);
        categoryCursor = rows.at(-1)!.categoryId;
      }
      let testimonialCursor: string | null = null;
      while (true) {
        const rows: TestimonialRow[] = await tx.$queryRaw`
          SELECT tenant_id AS "tenantId", testimonial_id AS "testimonialId", category_id AS "categoryId",
            status_code AS "statusCode", rating, score, created_at AS "createdAt", published_at AS "publishedAt",
            has_image AS "hasImage", has_video AS "hasVideo" FROM bi_export.testimonials
          WHERE tenant_id = ${tenantId}::uuid AND (${testimonialCursor}::uuid IS NULL OR testimonial_id > ${testimonialCursor}::uuid)
          ORDER BY testimonial_id LIMIT ${this.pageSize}`;
        if (!rows.length) break;
        await consumer.testimonials(rows);
        counts.testimonials += BigInt(rows.length);
        testimonialCursor = rows.at(-1)!.testimonialId;
      }
      let eventCursor = 0n;
      while (true) {
        const rows: EventRow[] = await tx.$queryRaw`
          SELECT tenant_id AS "tenantId", event_id AS "eventId", testimonial_id AS "testimonialId",
            event_type_code AS "eventTypeCode", source_code AS "sourceCode", created_at AS "createdAt"
          FROM bi_export.analytics_events WHERE tenant_id = ${tenantId}::uuid AND event_id > ${eventCursor}
          ORDER BY event_id LIMIT ${this.pageSize}`;
        if (!rows.length) break;
        await consumer.events(rows);
        counts.events += BigInt(rows.length);
        eventCursor = rows.at(-1)!.eventId;
      }
      return counts;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead, timeout: remaining, maxWait: 5000 });
  }
}
