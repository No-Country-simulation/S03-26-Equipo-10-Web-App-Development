import { Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { ApplicationError } from '../../../common/errors/application.error';
import {
  BillingProductRepository,
  type BillingActor,
} from '../repositories/billing-product.repository';
import { BillingGateways } from './billing-gateways.service';
import { BillingProcessor } from './billing-processor.service';
import { BillingLedgerRepository } from '../repositories/billing-ledger.repository';
import { SimulationGateway } from '../integrations/simulation.gateway';
@Injectable()
export class BillingProductService {
  constructor(
    readonly repository: BillingProductRepository,
    private readonly gateways: BillingGateways,
    private readonly ledger: BillingLedgerRepository,
    private readonly processor: BillingProcessor,
  ) {}
  async checkout(
    actor: BillingActor,
    key: string,
    input: Parameters<BillingProductRepository['checkout']>[2],
  ) {
    const result = await this.repository.checkout(actor, key, input);
    if (
      this.gateways.config.mode === 'simulation' &&
      result &&
      typeof result === 'object' &&
      'operationId' in result &&
      typeof result.operationId === 'string'
    ) {
      const row = await this.repository.ownedOperation(
        actor,
        result.operationId,
      );
      try {
        await this.processor.tick([row.providerAccountId]);
      } catch {
        /* Durable acceptance survives a temporarily unavailable worker. */
      }
    }
    return result;
  }
  async operation(actor: BillingActor, id: string) {
    const state = await this.repository.operation(actor, id);
    if (
      ['confirmed', 'reversed'].includes(state.paymentStatus) ||
      state.status !== 'succeeded' ||
      state.kind !== 'checkout'
    )
      return state;
    const context = await this.repository.checkoutContext(actor, id);
    if (!context) return state;
    try {
      const gateway = await this.gateways.get(context.row.providerAccountId);
      await gateway.assertAccount();
      const checkout = await gateway.findCheckout(
        context.command,
        context.row.externalResourceId!,
      );
      return {
        ...state,
        ...(checkout?.url ? { redirectUrl: checkout.url } : {}),
      };
    } catch {
      return { ...state, redirectUnavailable: true };
    }
  }
  async simulate(
    actor: BillingActor,
    key: string,
    id: string,
    input: {
      scenario:
        | 'pending'
        | 'approved'
        | 'rejected'
        | 'partial_refund'
        | 'full_refund'
        | 'chargeback';
      at: string;
      cycle: string;
    },
  ) {
    if (this.gateways.config.mode !== 'simulation')
      throw new ApplicationError(
        'La simulación sólo está disponible en el entorno local.',
        'forbidden',
        'BILLING_SIMULATION_REQUIRED',
      );
    const row = await this.ledger.operatorOperation(actor.userId, id);
    if (row.kind !== 'checkout')
      throw new ApplicationError(
        'La operación no es un checkout.',
        'invalid_input',
      );
    const gateway = await this.gateways.get(row.providerAccountId);
    if (!(gateway instanceof SimulationGateway))
      throw new ApplicationError(
        'Cuenta de simulación requerida.',
        'forbidden',
      );
    const command = await this.ledger.command({
      kind: 'operation',
      row,
      recovering: true,
    });
    const resourceId = gateway.observation(
      command,
      input.scenario,
      new Date(input.at),
      input.cycle,
    );
    await this.repository.operatorReceipt(
      actor,
      key,
      `/platform/billing/operations/${id}/simulate`,
      input,
      async (tx) => {
        await this.ledger.receive(
          row.providerAccountId,
          'sandbox',
          {
            topic: 'simulation',
            resourceId,
            eventKey: createHash('sha256').update(resourceId).digest('hex'),
          },
          tx,
        );
        return { accepted: true };
      },
    );
    await this.processor.tick([row.providerAccountId]);
    return { accepted: true };
  }
}
