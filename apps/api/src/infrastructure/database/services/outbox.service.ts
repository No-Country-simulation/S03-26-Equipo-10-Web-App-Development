import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OutboxEventInput {
  tenantId: string;
  eventType: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class OutboxService {
  constructor(private readonly prisma: PrismaService) {}

  async createEvent(event: OutboxEventInput): Promise<void> {
    await this.prisma.outboxEvent.create({
      data: {
        tenantId: event.tenantId,
        eventType: event.eventType,
        payload: event.payload as Prisma.InputJsonValue,
        status: 'pending',
        attempts: 0,
      },
    });
  }

  async acquirePending(limit = 25) {
    const now = new Date();

    return this.prisma.$transaction(async tx => {
      const pending = await tx.outboxEvent.findMany({
        where: {
          status: 'pending',
          OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }],
        },
        orderBy: { createdAt: 'asc' },
        take: limit,
      });

      if (!pending.length) {
        return [];
      }

      await tx.outboxEvent.updateMany({
        where: {
          id: { in: pending.map(item => item.id) },
          status: 'pending',
        },
        data: {
          status: 'processing',
        },
      });

      return pending;
    });
  }

  async markProcessed(eventId: string): Promise<void> {
    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: 'processed',
        processedAt: new Date(),
      },
    });
  }

  async markFailed(eventId: string, attempts: number, message: string): Promise<void> {
    const maxAttempts = 5;
    const hasRemaining = attempts < maxAttempts;

    const nextRetryAt = hasRemaining
      ? new Date(Date.now() + this.backoffMs(attempts))
      : null;

    await this.prisma.outboxEvent.update({
      where: { id: eventId },
      data: {
        status: hasRemaining ? 'pending' : 'failed',
        attempts,
        lastError: message,
        nextRetryAt,
      },
    });
  }

  private backoffMs(attempt: number): number {
    const base = 1000 * Math.max(1, attempt);
    const jitter = Math.floor(Math.random() * 500);
    return base * 2 + jitter;
  }
}
