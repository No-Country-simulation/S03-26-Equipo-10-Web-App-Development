import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { BillingOperatorGuard } from './guards/billing-operator.guard';
import { BillingCatalogRepository } from './repositories/billing-catalog.repository';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';
import { BillingSettlementRepository } from './repositories/billing-settlement.repository';
import { BillingTenantRepository } from './repositories/billing-tenant.repository';

const providers = [
  BillingOperatorGuard,
  BillingCatalogRepository,
  BillingOperatorRepository,
  BillingSettlementRepository,
  BillingTenantRepository,
];

// Persistence composition only. Not imported by AppModule until its authorized
// integration phase; no HTTP controllers, pollers or provider SDKs in phase 2.
@Module({ imports: [PrismaModule], providers, exports: providers })
export class BillingModule {}
