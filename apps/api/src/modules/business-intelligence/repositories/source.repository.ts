import { evaluateAccess } from '../../billing/domain/access-policy';
import { termsPeriod } from '../../billing/domain/terms-period';
import { Prisma, PrismaClient } from '@prisma/client';
import {
  EtlError,
  type CategoryRow,
  type Counts,
  type EventRow,
  type SourceConsumer,
  type SourceSnapshot,
  type TestimonialRow,
  type TagRow,
  type TestimonialTagRow,
} from '../etl.types';

export class SourceRepository {
  constructor(
    private readonly client: PrismaClient,
    private readonly pageSize = 1000,
    private readonly statistics = false,
  ) {
    if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000)
      throw new EtlError('BI_CONFIGURATION_INVALID');
  }

  async commercialEligibility(
    tenantId: string,
  ): Promise<{ bi: boolean; statistics: boolean }> {
    if (!process.env.BILLING_MODE || process.env.BILLING_MODE === 'disabled')
      return { bi: true, statistics: true };
    const rows = await this.client.$queryRaw<
      Array<{
        enforcement_enabled: boolean;
        kind: string | null;
        starts_at: Date | null;
        ends_at: Date | null;
        revoked_at: Date | null;
        grace_days: number;
        business_intelligence: boolean;
        bi_statistics: boolean;
      }>
    >`SELECT enforcement_enabled,kind,starts_at,ends_at,revoked_at,grace_days,business_intelligence,bi_statistics FROM bi_export.billing_policy WHERE tenant_id=${tenantId}::uuid ORDER BY ends_at DESC NULLS LAST`;
    if (!rows.length) return { bi: false, statistics: false };
    if (!rows[0]!.enforcement_enabled) return { bi: true, statistics: true };
    const periods = rows.flatMap((p) =>
      p.kind && p.starts_at && p.ends_at
        ? [
            {
              ...p,
              kind: p.kind,
              startsAt: p.starts_at,
              endsAt: p.ends_at,
              revokedAt: p.revoked_at,
            },
          ]
        : [],
    );
    const now = new Date();
    const current = termsPeriod(periods, now);
    const access = evaluateAccess({
      enabled: true,
      now,
      graceDays: current?.grace_days ?? 0,
      periods: periods.map((p) => ({
        kind: p.kind === 'paid' ? 'paid' : 'trial',
        startsAt: p.startsAt,
        endsAt: p.endsAt,
        revoked: !!p.revokedAt,
      })),
    });
    return {
      bi: access.canMutate && !!current?.business_intelligence,
      statistics:
        access.canMutate &&
        !!current?.business_intelligence &&
        !!current?.bi_statistics,
    };
  }
  /** Explicit exporter inventory. Only identifiers; no private resource is read without tenant scope. */
  async tenantIds(after: string | null): Promise<string[]> {
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT tenant_id AS id FROM bi_export.tenants
        WHERE (${after}::uuid IS NULL OR tenant_id > ${after}::uuid)
        ORDER BY tenant_id LIMIT ${this.pageSize}`;
        return rows.map((row) => row.id);
      },
      { timeout: 35000, maxWait: 5000 },
    );
  }

  async extract(
    tenantId: string,
    consumer: SourceConsumer,
    deadline = Date.now() + 300000,
  ): Promise<Counts> {
    if (this.statistics && (!consumer.tags || !consumer.testimonialTags))
      throw new EtlError('BI_CONFIGURATION_INVALID');
    const remaining = Math.min(300000, Math.floor(deadline - Date.now()));
    if (remaining <= 0) throw new EtlError('BI_DEADLINE_EXCEEDED');
    return this.client.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        await tx.$executeRaw`SET LOCAL timezone = 'UTC'`;
        await tx.$executeRaw`SET LOCAL statement_timeout = '30s'`;
        await tx.$executeRaw`SET LOCAL lock_timeout = '1s'`;
        await tx.$executeRaw`SET LOCAL idle_in_transaction_session_timeout = '60s'`;
        // Internal bounded integer, never user SQL; SET cannot bind a value parameter.
        await tx.$executeRawUnsafe(
          `SET LOCAL transaction_timeout = '${remaining}ms'`,
        );
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
        if (this.statistics) {
          counts.taxonomy = { tags: 0n, relations: 0n };
          let tagCursor: string | null = null;
          while (true) {
            const rows: TagRow[] = await tx.$queryRaw`
            SELECT tenant_id AS "tenantId", tag_id AS "tagId", name FROM bi_export.tags
            WHERE tenant_id = ${tenantId}::uuid AND (${tagCursor}::uuid IS NULL OR tag_id > ${tagCursor}::uuid)
            ORDER BY tag_id LIMIT ${this.pageSize}`;
            if (!rows.length) break;
            await consumer.tags!(rows);
            counts.taxonomy.tags += BigInt(rows.length);
            tagCursor = rows.at(-1)!.tagId;
          }
        }
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
        if (this.statistics && counts.taxonomy) {
          let linkCursor: TestimonialTagRow | undefined;
          while (true) {
            const rows: TestimonialTagRow[] = await tx.$queryRaw`
            SELECT tenant_id AS "tenantId", testimonial_id AS "testimonialId", tag_id AS "tagId"
            FROM bi_export.testimonial_tags WHERE tenant_id = ${tenantId}::uuid
            AND (${linkCursor?.testimonialId ?? null}::uuid IS NULL OR (testimonial_id, tag_id) >
              (${linkCursor?.testimonialId ?? null}::uuid, ${linkCursor?.tagId ?? null}::uuid))
            ORDER BY testimonial_id, tag_id LIMIT ${this.pageSize}`;
            if (!rows.length) break;
            await consumer.testimonialTags!(rows);
            counts.taxonomy.relations += BigInt(rows.length);
            linkCursor = rows.at(-1)!;
          }
        }
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
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: remaining,
        maxWait: 5000,
      },
    );
  }
}
