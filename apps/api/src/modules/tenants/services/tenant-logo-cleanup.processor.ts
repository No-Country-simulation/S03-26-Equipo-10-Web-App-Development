import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from '@nestjs/common';
import { MetricsService } from '../../../common/observability/metrics.service';
import { CloudinaryService } from '../../shared/cloud';
import { TenantLogoRepository, type CleanupClaim } from '../repositories/tenant-logo.repository';

@Injectable()
export class TenantLogoCleanupProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantLogoCleanupProcessor.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly logos: TenantLogoRepository, private readonly cloud: CloudinaryService,
    @Optional() private readonly metrics?: MetricsService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      void this.process().catch(() => this.logger.warn({ event: 'tenant_logo.cleanup_poll_failed' }));
    }, 30_000);
    this.timer.unref();
  }

  onModuleDestroy(): void { if (this.timer) clearInterval(this.timer); }

  async process(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      let remaining = 5;
      for (const tenantId of await this.logos.dueTenants()) {
        const claims = await this.logos.claim(tenantId, remaining);
        for (const claim of claims) await this.cleanup(claim);
        remaining -= claims.length;
        if (!remaining) break;
      }
    } finally { this.running = false; }
  }

  private async cleanup(claim: CleanupClaim): Promise<void> {
    try {
      if (await this.logos.isReferenced(claim)) {
        await this.logos.finish(claim, 'cancelled');
        return;
      }
      await this.cloud.destroyLogo(claim.publicId);
      if (await this.logos.finish(claim, 'completed')) this.metrics?.recordLogoCleanup('completed');
    } catch {
      const dead = claim.attempts >= 10;
      const cap = Math.min(30_000 * 2 ** (claim.attempts - 1), 3_600_000);
      const delay = Math.floor(cap / 2 + Math.random() * cap / 2);
      const accepted = await this.logos.finish(claim, dead ? 'dead' : 'pending', delay, 'MEDIA_CLEANUP_FAILED');
      if (accepted) {
        this.metrics?.recordLogoCleanup(dead ? 'dead' : 'retry');
        this.logger.warn({ event: dead ? 'tenant_logo.cleanup_dead' : 'tenant_logo.cleanup_retry',
          tenantId: claim.tenantId, jobId: claim.id, attempts: claim.attempts, code: 'MEDIA_CLEANUP_FAILED' });
      }
    }
  }
}
