import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { BillingOperatorGuard } from './guards/billing-operator.guard';
import { BillingCatalogRepository } from './repositories/billing-catalog.repository';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';
import { BillingSettlementRepository } from './repositories/billing-settlement.repository';
import { BillingTenantRepository } from './repositories/billing-tenant.repository';

import {
  BILLING_CONFIG,
  readBillingConfig,
} from './integrations/billing.config';
import { BillingLedgerRepository } from './repositories/billing-ledger.repository';
import { BillingGateways } from './services/billing-gateways.service';
import { BillingProcessor } from './services/billing-processor.service';
import { BillingWebhooksController } from './controllers/billing-webhooks.controller';

const providers = [
  { provide: BILLING_CONFIG, useFactory: readBillingConfig },
  BillingLedgerRepository,
  BillingGateways,
  BillingProcessor,
  BillingOperatorGuard,
  BillingCatalogRepository,
  BillingOperatorRepository,
  BillingSettlementRepository,
  BillingTenantRepository,
];

// Disabled by default: no provider clients, startup queries or pollers.
@Module({
  imports: [PrismaModule],
  controllers: [BillingWebhooksController],
  providers,
  exports: providers,
})
export class BillingModule {}
