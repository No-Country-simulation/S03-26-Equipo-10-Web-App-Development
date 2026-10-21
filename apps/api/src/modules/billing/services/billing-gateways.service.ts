import { Inject, Injectable } from '@nestjs/common';
import {
  BILLING_CONFIG,
  type BillingConfig,
  type ProviderSettings,
} from '../integrations/billing.config';
import { StripeGateway } from '../integrations/stripe.gateway';
import { MercadoPagoGateway } from '../integrations/mercadopago.gateway';
import { SimulationGateway } from '../integrations/simulation.gateway';
import type { FinancialGateway } from '../ports/financial-gateway.port';
import { GatewayError } from '../ports/financial-gateway.port';
import { BillingLedgerRepository } from '../repositories/billing-ledger.repository';

@Injectable()
export class BillingGateways {
  private readonly cache = new Map<string, FinancialGateway>();
  constructor(
    @Inject(BILLING_CONFIG) readonly config: BillingConfig,
    private readonly ledger: BillingLedgerRepository,
  ) {}
  accountIds() {
    return this.config.mode === 'sandbox'
      ? [
          this.config.stripe?.accountId,
          this.config.mercadopago?.accountId,
        ].filter((v): v is string => !!v)
      : [];
  }
  settings(provider: 'stripe' | 'mercadopago'): ProviderSettings {
    if (this.config.mode !== 'sandbox')
      throw new GatewayError('BILLING_DISABLED', true);
    const setting =
      provider === 'stripe' ? this.config.stripe : this.config.mercadopago;
    if (!setting) throw new GatewayError('BILLING_PROVIDER_DISABLED', true);
    return setting;
  }
  async get(accountId: string): Promise<FinancialGateway> {
    if (this.config.mode === 'disabled')
      throw new GatewayError('BILLING_DISABLED', true);
    const account = await this.ledger.account(accountId);
    if (!account.enabled || account.environment !== 'sandbox')
      throw new GatewayError('BILLING_ACCOUNT_DISABLED', true);
    if (this.config.mode === 'simulation') {
      // Polling simulation accounts is explicit (service/CLI), never inferred
      // from normal accounts to avoid consuming sandbox operations as simulated.
      if (account.configurationKey !== 'BILLING_SIMULATION')
        throw new GatewayError('BILLING_SIMULATION_ACCOUNT_REQUIRED', true);
      return new SimulationGateway(
        this.config.simulationKey,
        this.config.returnUrl,
      );
    }
    if (account.provider !== 'stripe' && account.provider !== 'mercadopago')
      throw new GatewayError('BILLING_PROVIDER_INVALID', true);
    const settings = this.settings(account.provider);
    if (
      settings.accountId !== account.id ||
      settings.sellerId !== account.sellerId ||
      (settings.applicationId ?? null) !== account.applicationId ||
      account.configurationKey === 'BILLING_SIMULATION'
    )
      throw new GatewayError('BILLING_ACCOUNT_MISMATCH', true);
    const cached = this.cache.get(accountId);
    if (cached) return cached;
    const gateway =
      account.provider === 'stripe'
        ? new StripeGateway(settings, this.config.returnUrl)
        : new MercadoPagoGateway(
            settings,
            this.config.returnUrl,
            this.config.notificationUrl,
          );
    this.cache.set(accountId, gateway);
    return gateway;
  }
}
