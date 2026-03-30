import { Module } from '@nestjs/common';

import { TenantsController } from './controllers/tenants.controller';
import { TenantsService } from './services/tenants.service';

import { TENANT_REPOSITORY } from './repositories/tenant.repository';
import { PrismaTenantRepository } from './repositories/prisma-tenant.repository';

@Module({
  controllers: [TenantsController],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    TenantsService,
  ],
  exports: [TenantsService],
})
export class TenantsModule {}
