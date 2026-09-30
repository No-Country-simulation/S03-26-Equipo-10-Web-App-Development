import { TestimonialRepository } from '../src/modules/testimonials/repositories/testimonial.repository';
import type { PrismaService } from '../src/modules/database/prisma.service';

describe('TestimonialRepository outbox payload', () => {
  it('rechaza un payload no JSON antes de insertar el evento', async () => {
    const row = {
      id: 'testimonial', tenantId: 'tenant', createdById: null,
      authorName: 'Test', content: 'Contenido suficiente', rating: 5,
      status: { code: 'pending' }, score: 0, categoryId: null, category: null,
      tags: [], moderationNotes: null, imageUrl: null, videoUrl: null,
      videoTitle: null, videoThumbnailUrl: null,
      createdAt: new Date(), updatedAt: new Date(), publishedAt: null,
    };
    const outboxCreate = jest.fn();
    const tx = {
      testimonialStatus: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
      testimonial: { create: jest.fn().mockResolvedValue(row) },
      outboxEvent: { create: outboxCreate },
    };
    const prisma = { $transaction: (callback: (client: typeof tx) => Promise<unknown>) => callback(tx) };
    const repo = new TestimonialRepository(prisma as unknown as PrismaService);

    await expect(repo.createWithEvent({
      tenantId: 'tenant', createdById: null, authorName: 'Test',
      content: 'Contenido suficiente', rating: 5,
    }, 'pending', {
      eventType: 'testimonial.created',
      payload: () => ({ invalidJson: BigInt(1) }),
    })).rejects.toThrow();
    expect(outboxCreate).not.toHaveBeenCalled();
  });
});
