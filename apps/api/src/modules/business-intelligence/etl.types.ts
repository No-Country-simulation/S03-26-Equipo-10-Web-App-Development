import type { Prisma } from '@prisma/client';

export class EtlError extends Error {
  constructor(readonly code: 'BI_CONFIGURATION_INVALID' | 'BI_ETL_FAILED' | 'BI_LEASE_LOST'
    | 'BI_SOURCE_INCONSISTENT' | 'BI_SOURCE_NOT_NEWER' | 'BI_DEADLINE_EXCEEDED' | 'BI_SLOT_CHANGED'
    | 'BI_MIGRATION_DRIFT' | 'BI_MIGRATION_INVALID' | 'BI_MIGRATION_REQUIRED' | 'BI_BACKFILL_REQUIRED'
    | 'BI_BACKFILL_INCONSISTENT' | 'BI_MAINTENANCE_REQUIRED' | 'BI_BACKFILL_INTERRUPTED') {
    super(code);
  }
}

export interface Lease { tenantId: string; runId: string; token: string; slot: Date; deadline: number }
export interface SourceSnapshot { tenantId: string; name: string; isActive: boolean; at: Date }
export interface CategoryRow { tenantId: string; categoryId: string; name: string }
export interface TestimonialRow {
  tenantId: string; testimonialId: string; categoryId: string | null; statusCode: string;
  rating: number; score: Prisma.Decimal; createdAt: Date; publishedAt: Date | null;
  hasImage: boolean; hasVideo: boolean;
}
export interface EventRow {
  tenantId: string; eventId: bigint; testimonialId: string; eventTypeCode: string;
  sourceCode: 'public' | 'public-browser' | 'api' | 'widget' | 'other'; createdAt: Date;
}
export interface Counts { categories: bigint; testimonials: bigint; events: bigint }
export interface SourceConsumer {
  snapshot(snapshot: SourceSnapshot): Promise<void>;
  categories(rows: CategoryRow[]): Promise<void>;
  testimonials(rows: TestimonialRow[]): Promise<void>;
  events(rows: EventRow[]): Promise<void>;
}
export interface EtlResult {
  tenantId: string; status: 'succeeded' | 'failed' | 'skipped'; runId?: string; code?: string;
}
export function hourUtc(date: Date): Date {
  return new Date(Math.floor(date.getTime() / 3_600_000) * 3_600_000);
}
