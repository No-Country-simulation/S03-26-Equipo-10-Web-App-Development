import { Module } from '@nestjs/common';
import { TENANT_REPOSITORY } from '../../../core/repositories/tenant.repository';
import { PrismaTenantRepository } from '../../database/repositories/prisma-tenant.repository';
import { GetTenantUseCase } from '../../../application/use-cases/get-tenant.use-case';
import { UpdateTenantUseCase } from '../../../application/use-cases/update-tenant.use-case';
import { TenantsController } from '../controllers/tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [
    { provide: TENANT_REPOSITORY, useClass: PrismaTenantRepository },
    GetTenantUseCase,
    UpdateTenantUseCase,
  ],
  exports: [GetTenantUseCase],
})
export class TenantsModule {}
