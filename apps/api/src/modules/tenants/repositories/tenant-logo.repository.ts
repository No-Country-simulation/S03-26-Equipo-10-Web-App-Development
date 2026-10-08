import { Injectable } from '@nestjs/common';
import { Prisma, type Tenant } from '@prisma/client';
import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { PrismaService } from '../../database/prisma.service';
import type { TenantView } from './tenant.repository';

export type LogoState = Pick<Tenant, 'logoPublicId' | 'logoRevision'>;
export interface CleanupClaim {
  id: string;
  tenantId: string;
  publicId: string;
  attempts: number;
  leaseToken: string;
}

@Injectable()
export class TenantLogoRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findState(tenantId: string): Promise<LogoState> {
    const tenant = await this.bounded(tx => tx.tenant.findUnique({
      where: { id: tenantId }, select: { logoPublicId: true, logoRevision: true },
    }));
    if (!tenant) throw new NotFoundError('Tenant not found');
    return tenant;
  }

  async registerCandidate(tenantId: string, publicId: string): Promise<string> {
    const [job] = await this.bounded(tx => tx.$queryRaw<Array<{ id: string }>>`
      INSERT INTO tenant_logo_cleanup_jobs (tenant_id, public_id, next_attempt_at)
      VALUES (${tenantId}::uuid, ${publicId}, clock_timestamp() + interval '10 minutes')
      RETURNING id`);
    if (!job) throw new ConflictError('Could not register logo upload');
    return job.id;
  }

  async attach(tenantId: string, expected: LogoState, candidateId: string,
    publicId: string, logoUrl: string): Promise<TenantView> {
    return this.bounded(async tx => {
      const [job] = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM tenant_logo_cleanup_jobs
        WHERE tenant_id = ${tenantId}::uuid AND id = ${candidateId}::uuid
          AND public_id = ${publicId} AND status = 'pending'
          AND lease_token IS NULL AND created_at + interval '10 minutes' > clock_timestamp()
        FOR UPDATE`;
      if (!job) throw new ConflictError('Logo upload expired or was claimed for cleanup');
      await this.updateLogo(tx, tenantId, expected.logoRevision, logoUrl, publicId);
      const cancelled = await tx.$executeRaw`
        UPDATE tenant_logo_cleanup_jobs SET status = 'cancelled', updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND id = ${job.id}::uuid AND status = 'pending'
          AND created_at + interval '10 minutes' > clock_timestamp()`;
      if (cancelled !== 1) throw new ConflictError('Logo upload expired');
      if (expected.logoPublicId) await this.enqueueRetired(tx, tenantId, expected.logoPublicId);
      return this.view(tx, tenantId);
    });
  }

  async remove(tenantId: string, expected: LogoState): Promise<TenantView> {
    return this.bounded(async tx => {
      await this.updateLogo(tx, tenantId, expected.logoRevision, null, null);
      if (expected.logoPublicId) await this.enqueueRetired(tx, tenantId, expected.logoPublicId);
      return this.view(tx, tenantId);
    });
  }

  private bounded<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SET LOCAL lock_timeout = '2s'`;
      await tx.$executeRaw`SET LOCAL statement_timeout = '5s'`;
      return work(tx);
    }, { maxWait: 5000, timeout: 10000 });
  }

  private async updateLogo(tx: Prisma.TransactionClient, tenantId: string,
    revision: bigint, logoUrl: string | null, logoPublicId: string | null): Promise<void> {
    const changed = await tx.tenant.updateMany({ where: { id: tenantId, logoRevision: revision },
      data: { logoUrl, logoPublicId, logoRevision: { increment: 1 } } });
    if (changed.count !== 1) throw new ConflictError('Logo changed concurrently; reload before trying again');
  }

  private async enqueueRetired(tx: Prisma.TransactionClient, tenantId: string, publicId: string): Promise<void> {
    await tx.$executeRaw`
      INSERT INTO tenant_logo_cleanup_jobs (tenant_id, public_id, next_attempt_at)
      VALUES (${tenantId}::uuid, ${publicId}, clock_timestamp())
      ON CONFLICT (tenant_id, public_id) DO UPDATE
        SET status = 'pending', attempts = 0, next_attempt_at = clock_timestamp(),
          lease_token = NULL, lease_until = NULL, error_code = NULL, updated_at = clock_timestamp()`;
  }

  private async view(tx: Prisma.TransactionClient, tenantId: string): Promise<TenantView> {
    const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: {
      id: true, name: true, publicSlug: true, isPublicFormEnabled: true, isActive: true,
      logoUrl: true, createdAt: true, updatedAt: true,
    } });
    if (!tenant) throw new NotFoundError('Tenant not found');
    return tenant;
  }

  /** Explicit system worker discovery; every later read/write is tenant-scoped. */
  async dueTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ tenantId: string }>>`
      SELECT tenant_id AS "tenantId" FROM tenant_logo_cleanup_jobs
      WHERE (status = 'pending' AND next_attempt_at <= clock_timestamp())
         OR (status = 'processing' AND lease_until <= clock_timestamp())
      GROUP BY tenant_id ORDER BY min(next_attempt_at), tenant_id LIMIT 5`;
    return rows.map(row => row.tenantId);
  }

  async claim(tenantId: string, limit: number): Promise<CleanupClaim[]> {
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`
        UPDATE tenant_logo_cleanup_jobs SET
          status = CASE WHEN attempts >= 10 THEN 'dead' ELSE 'pending' END,
          lease_token = NULL, lease_until = NULL, next_attempt_at = clock_timestamp(),
          error_code = 'CLEANUP_LEASE_EXPIRED', updated_at = clock_timestamp()
        WHERE tenant_id = ${tenantId}::uuid AND status = 'processing' AND lease_until <= clock_timestamp()`;
      return tx.$queryRaw<CleanupClaim[]>`
        WITH due AS (
          SELECT id FROM tenant_logo_cleanup_jobs
          WHERE tenant_id = ${tenantId}::uuid AND status = 'pending' AND attempts < 10
            AND next_attempt_at <= clock_timestamp()
          ORDER BY next_attempt_at, id FOR UPDATE SKIP LOCKED LIMIT ${limit}
        )
        UPDATE tenant_logo_cleanup_jobs j SET status = 'processing', attempts = attempts + 1,
          lease_token = gen_random_uuid(), lease_until = clock_timestamp() + interval '60 seconds',
          updated_at = clock_timestamp()
        FROM due WHERE j.id = due.id AND j.tenant_id = ${tenantId}::uuid
        RETURNING j.id, j.tenant_id AS "tenantId", j.public_id AS "publicId",
          j.attempts, j.lease_token AS "leaseToken"`;
    });
  }

  async isReferenced(claim: CleanupClaim): Promise<boolean> {
    const row = await this.prisma.tenant.findFirst({
      where: { id: claim.tenantId, logoPublicId: claim.publicId }, select: { id: true },
    });
    return row !== null;
  }

  async finish(claim: CleanupClaim, status: 'completed' | 'cancelled' | 'pending' | 'dead',
    delayMs = 0, errorCode: string | null = null): Promise<boolean> {
    const count = await this.prisma.$executeRaw`
      UPDATE tenant_logo_cleanup_jobs SET status = ${status}, lease_token = NULL, lease_until = NULL,
        next_attempt_at = clock_timestamp() + ${delayMs} * interval '1 millisecond',
        error_code = ${errorCode}, updated_at = clock_timestamp()
      WHERE tenant_id = ${claim.tenantId}::uuid AND id = ${claim.id}::uuid AND status = 'processing'
        AND lease_token = ${claim.leaseToken}::uuid AND lease_until > clock_timestamp()`;
    return count === 1;
  }
}
