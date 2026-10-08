import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CloudinaryService } from '../../shared/cloud';
import { TenantLogoRepository } from '../repositories/tenant-logo.repository';
import { validateTenantLogo } from '../utils/validate-tenant-logo';

@Injectable()
export class TenantLogoService {
  constructor(private readonly logos: TenantLogoRepository, private readonly cloud: CloudinaryService) {}

  async upload(tenantId: string, value: string) {
    const image = validateTenantLogo(value);
    this.cloud.assertLogoStorage();
    const state = await this.logos.findState(tenantId);
    const publicId = `tenant-logos/${tenantId}/${randomUUID()}`;
    const candidateId = await this.logos.registerCandidate(tenantId, publicId);
    const uploaded = await this.cloud.uploadLogo(image, publicId);
    // Failure/crash leaves the pre-registered candidate for durable cleanup.
    return this.logos.attach(tenantId, state, candidateId, publicId, uploaded.secureUrl);
  }

  async remove(tenantId: string) {
    const state = await this.logos.findState(tenantId);
    return this.logos.remove(tenantId, state);
  }
}
