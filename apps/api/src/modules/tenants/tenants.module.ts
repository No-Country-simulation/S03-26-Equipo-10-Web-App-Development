import { Module } from '@nestjs/common';

import { TenantsController } from './controllers/tenants.controller';
import { TenantsService } from './services/tenants.service';

import { TenantRepository } from './repositories/tenant.repository';
import { CloudModule } from '../shared/cloud';
import { TenantLogoRepository } from './repositories/tenant-logo.repository';
import { TenantLogoService } from './services/tenant-logo.service';
import { TenantLogoCleanupProcessor } from './services/tenant-logo-cleanup.processor';

@Module({
  imports: [CloudModule],
  controllers: [TenantsController],
  providers: [
    TenantRepository,
    TenantsService,
    TenantLogoRepository,
    TenantLogoService,
    TenantLogoCleanupProcessor,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
