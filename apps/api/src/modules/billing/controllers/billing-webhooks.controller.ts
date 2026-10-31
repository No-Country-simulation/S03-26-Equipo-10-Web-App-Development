import {
  Controller,
  Post,
  Req,
  HttpCode,
  NotFoundException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CsrfMode } from '../../../common/decorators/csrf-mode.decorator';
import { BillingGateways } from '../services/billing-gateways.service';
import {
  BillingLedgerRepository,
  type Receipt,
} from '../repositories/billing-ledger.repository';
import {
  stripeReceipt,
  mercadoPagoReceipt,
} from '../integrations/webhook-authentication';
import { GatewayError } from '../ports/financial-gateway.port';
import { ApiExcludeController } from '@nestjs/swagger';

@ApiExcludeController()
@Controller('billing/webhooks')
@CsrfMode('provider-signature')
export class BillingWebhooksController {
  constructor(
    private readonly gateways: BillingGateways,
    private readonly ledger: BillingLedgerRepository,
  ) {}
  @Post('stripe')
  @HttpCode(200)
  async stripe(@Req() req: Request) {
    if (this.gateways.config.mode !== 'sandbox' || !this.gateways.config.stripe)
      throw new NotFoundException();
    const settings = this.gateways.settings('stripe');
    let receipt: Receipt;
    try {
      if (!Buffer.isBuffer(req.body))
        throw new GatewayError('BILLING_RAW_BODY_REQUIRED', true);
      receipt = stripeReceipt(
        req.body,
        req.header('stripe-signature') ?? '',
        settings,
      );
    } catch (error) {
      this.invalid(error);
    }
    // Database failures deliberately propagate: never ACK non-durable reception.
    await this.ledger.receive(settings.accountId, 'sandbox', receipt!);
    return { received: true };
  }
  @Post('mercadopago')
  @HttpCode(200)
  async mercadoPago(@Req() req: Request) {
    if (
      this.gateways.config.mode !== 'sandbox' ||
      !this.gateways.config.mercadopago
    )
      throw new NotFoundException();
    const settings = this.gateways.settings('mercadopago');
    let receipt: Receipt;
    try {
      const dataId = req.query['data.id'];
      if (typeof dataId !== 'string')
        throw new GatewayError('BILLING_SIGNATURE_INVALID', true);
      receipt = mercadoPagoReceipt(
        {
          signature: req.header('x-signature') ?? '',
          requestId: req.header('x-request-id') ?? '',
          dataId,
          body: req.body,
        },
        settings,
        this.gateways.config.mpSignatureToleranceSeconds,
      );
    } catch (error) {
      this.invalid(error);
    }
    await this.ledger.receive(settings.accountId, 'sandbox', receipt!);
    return { received: true };
  }
  private invalid(error: unknown): never {
    if (
      error instanceof GatewayError &&
      error.code === 'BILLING_SIGNATURE_INVALID'
    )
      throw new UnauthorizedException({
        code: error.code,
        message: 'Invalid provider signature',
      });
    throw new BadRequestException({
      code: 'BILLING_WEBHOOK_INVALID',
      message: 'Invalid provider notification',
    });
  }
}
