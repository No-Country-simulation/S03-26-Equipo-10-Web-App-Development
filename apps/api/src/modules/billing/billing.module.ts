import { APP_INTERCEPTOR } from '@nestjs/core';
import { BillingCmsInterceptor } from './services/billing-cms.interceptor';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { BillingOperatorGuard } from './guards/billing-operator.guard';
import { BillingCatalogRepository } from './repositories/billing-catalog.repository';
import { BillingOperatorRepository } from './repositories/billing-operator.repository';
import { BillingSettlementRepository } from './repositories/billing-settlement.repository';
import { BillingTenantRepository } from './repositories/billing-tenant.repository';

import { BillingAccessModule } from './billing-access.module';
import { BillingLedgerRepository } from './repositories/billing-ledger.repository';
import { BillingGateways } from './services/billing-gateways.service';
import { BillingProcessor } from './services/billing-processor.service';
import { BillingWebhooksController } from './controllers/billing-webhooks.controller';

import { BillingController } from './controllers/billing.controller';
import { PlatformBillingController } from './controllers/platform-billing.controller';
import { BillingProductRepository } from './repositories/billing-product.repository';
import { BillingProductService } from './services/billing-product.service';
import { IdempotencyRepository } from '../../common/repositories/idempotency.repository';

const providers = [
  BillingProductRepository,
  BillingProductService,
  IdempotencyRepository,
  { provide: APP_INTERCEPTOR, useClass: BillingCmsInterceptor },
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
  imports: [PrismaModule, BillingAccessModule],
  controllers: [
    BillingWebhooksController,
    BillingController,
    PlatformBillingController,
  ],
  providers,
  exports: [
    BillingOperatorGuard,
    BillingCatalogRepository,
    BillingOperatorRepository,
    BillingSettlementRepository,
    BillingTenantRepository,
    BillingLedgerRepository,
    BillingProductRepository,
    BillingProductService,
  ],
})
export class BillingModule {}
