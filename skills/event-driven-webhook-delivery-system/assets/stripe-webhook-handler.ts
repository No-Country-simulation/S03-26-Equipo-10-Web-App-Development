import { Controller, Post, Headers, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import Stripe from 'stripe';

/**
 * Ejemplo de Controlador de Webhooks de Stripe (NestJS)
 * Skill: SKL-PAY-STRIPE-001
 */

@Controller('webhooks')
export class WebhooksController {
  private stripe: Stripe;

  constructor() {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
    });
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: Request,
  ) {
    let event: Stripe.Event;

    // 1. Validar la firma del Webhook (Seguridad Zero-Trust)
    try {
      event = this.stripe.webhooks.constructEvent(
        req.body, // Debe ser el body en crudo (raw bytes)
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    // 2. Procesar el evento de forma asíncrona
    // Respondemos 200 OK inmediatamente para evitar timeouts
    this.processEvent(event);

    return { received: true };
  }

  private async processEvent(event: Stripe.Event) {
    // 3. Manejo de Idempotencia (Verificar si el event.id ya fue procesado)
    // const isProcessed = await this.db.events.findUnique({ where: { id: event.id } });
    // if (isProcessed) return;

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        console.log('Pago exitoso:', paymentIntent.id);
        // await this.orderService.markAsPaid(paymentIntent.metadata.orderId);
        break;
      
      case 'payment_intent.payment_failed':
        console.log('Pago fallido');
        break;

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // 4. Registrar evento como procesado
    // await this.db.events.create({ data: { id: event.id, type: event.type } });
  }
}
