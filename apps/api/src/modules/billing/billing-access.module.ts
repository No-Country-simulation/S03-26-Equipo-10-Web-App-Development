import { Global, Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import {
  BILLING_CONFIG,
  readBillingConfig,
} from './integrations/billing.config';
import { BillingAccessRepository } from './repositories/billing-access.repository';
@Global()
@Module({
  imports: [PrismaModule],
  providers: [
    { provide: BILLING_CONFIG, useFactory: readBillingConfig },
    BillingAccessRepository,
  ],
  exports: [BILLING_CONFIG, BillingAccessRepository],
})
export class BillingAccessModule {}
