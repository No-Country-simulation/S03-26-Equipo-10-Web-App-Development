import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseUUIDPipe,
  Req,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { ApiHeader, ApiTags } from '@nestjs/swagger';
import type { ApiRequest } from '../../../common/interfaces/auth-context.interface';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { BillingOperatorGuard } from '../guards/billing-operator.guard';
import { BillingProductService } from '../services/billing-product.service';
import { BillingCatalogRepository } from '../repositories/billing-catalog.repository';
import { BillingLedgerRepository } from '../repositories/billing-ledger.repository';
import { BillingTenantRepository } from '../repositories/billing-tenant.repository';
import {
  BillingPlanDto,
  BillingVersionDto,
  BillingEditVersionDto,
  BillingRevisionDto,
  BillingAccountDto,
  BillingSyncDto,
  BillingPolicyDto,
  BillingReplayDto,
  BillingSimulationDto,
} from '../contracts/billing.dto';
import { financialKey } from './billing.controller';
@ApiTags('Platform billing')
@Controller('platform/billing')
@UseGuards(JwtAuthGuard, BillingOperatorGuard)
export class PlatformBillingController {
  constructor(
    private readonly billing: BillingProductService,
    private readonly catalog: BillingCatalogRepository,
    private readonly ledger: BillingLedgerRepository,
    private readonly tenants: BillingTenantRepository,
  ) {}
  @Get() overview(@Req() r: ApiRequest) {
    return this.billing.repository.platform(r.user!);
  }
  @Get('catalog') plans() {
    return this.billing.repository.catalog(true);
  }
  @Post('plans')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(201)
  create(@Req() r: ApiRequest, @Body() d: BillingPlanDto) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      '/platform/billing/plans',
      d,
      (tx) => this.catalog.createPlan(r.user!.userId, d.code, tx),
    );
  }
  @Post('plans/:id/versions')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(201)
  version(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingVersionDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/plans/${id}/versions`,
      d,
      (tx) => this.catalog.createVersion(r.user!.userId, id, d, tx),
    );
  }
  @Patch('versions/:id')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  edit(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingEditVersionDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/versions/${id}`,
      d,
      (tx) =>
        this.catalog.editDraft(
          r.user!.userId,
          id,
          BigInt(d.expectedRevision),
          d.draft,
          tx,
        ),
    );
  }
  @Post('versions/:id/publish')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  publish(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingRevisionDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/versions/${id}/publish`,
      d,
      (tx) =>
        this.catalog.publish(
          r.user!.userId,
          id,
          BigInt(d.expectedRevision),
          tx,
        ),
    );
  }
  @Post('versions/:id/archive')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  archive(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingRevisionDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/versions/${id}/archive`,
      d,
      (tx) =>
        this.catalog.archive(
          r.user!.userId,
          id,
          BigInt(d.expectedRevision),
          tx,
        ),
    );
  }
  @Post('accounts')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  account(@Req() r: ApiRequest, @Body() d: BillingAccountDto) {
    return this.billing.repository.configureAccount(
      r.user!,
      financialKey(r),
      d,
    );
  }
  @Post('sync')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  sync(@Req() r: ApiRequest, @Body() d: BillingSyncDto) {
    const key = financialKey(r);
    return this.billing.repository.operatorReceipt(
      r.user!,
      key,
      '/platform/billing/sync',
      d,
      async (tx) => {
        const op = await this.ledger.enqueueSync(
          r.user!.userId,
          d.accountId,
          d.priceId,
          key,
          tx,
        );
        return { operationId: op.id };
      },
    );
  }
  @Post('operations/:id/reconcile')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  retry(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingReplayDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/operations/${id}/reconcile`,
      d,
      async (tx) => {
        await this.ledger.retry(r.user!.userId, id, d.kind, tx);
        return { accepted: true };
      },
    );
  }
  @Get('tenants/:id') tenantPolicy(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.billing.repository.tenantPolicy(r.user!, id);
  }
  @Patch('tenants/:id/policy')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  policy(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingPolicyDto,
  ) {
    return this.billing.repository.operatorReceipt(
      r.user!,
      financialKey(r),
      `/platform/billing/tenants/${id}/policy`,
      d,
      (tx) =>
        this.tenants.setPolicy(
          r.user!.userId,
          id,
          BigInt(d.expectedRevision),
          d.enforcementEnabled,
          tx,
        ),
    );
  }
  @Post('operations/:id/simulate')
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @HttpCode(202)
  simulate(
    @Req() r: ApiRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: BillingSimulationDto,
  ) {
    return this.billing.simulate(r.user!, financialKey(r), id, d);
  }
}
