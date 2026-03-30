import { Module } from '@nestjs/common';

import { TenantsController } from './controllers/tenants.controller';
import { TenantsService } from './services/tenants.service';

import { TenantRepository } from './repositories/tenant.repository';

@Module({
  controllers: [TenantsController],
  providers: [
    TenantRepository,
    TenantsService,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}


