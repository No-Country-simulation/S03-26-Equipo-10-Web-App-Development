import { ConflictException } from '@nestjs/common';
import { TestimonialsService } from '../src/modules/testimonials/application/services/testimonials.service';

describe('TestimonialsService transitions', () => {
  const findUnique = jest.fn();
  const updateMany = jest.fn();
  const findFirst = jest.fn();

  const prismaMock = {
    testimonialStatus: {
      findUnique,
    },
    testimonial: {
      updateMany,
      findFirst,
    },
  } as any;

  const outboxMock = {
    createEvent: jest.fn(),
  } as any;

  let service: TestimonialsService;

  beforeEach(() => {
    findUnique.mockReset();
    updateMany.mockReset();
    findFirst.mockReset();
    outboxMock.createEvent.mockReset();
    service = new TestimonialsService(prismaMock, outboxMock);
  });

  it('returns 409 conflict when submit transition does not match expected status', async () => {
    findUnique.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce({ id: 2 });
    updateMany.mockResolvedValueOnce({ count: 0 });

    await expect(service.submit('tenant-1', 'testimonial-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('publishes approved testimonial and emits outbox event', async () => {
    findUnique
      .mockResolvedValueOnce({ id: 3 })
      .mockResolvedValueOnce({ id: 4 })
      .mockResolvedValueOnce({ id: 4 });

    updateMany.mockResolvedValueOnce({ count: 1 });

    findFirst.mockResolvedValueOnce({
      id: 'testimonial-1',
      authorName: 'Ana',
      content: 'Muy buen producto',
      rating: 5,
      status: { code: 'published' },
      score: 95,
      createdAt: new Date('2026-01-01T10:00:00.000Z'),
      updatedAt: new Date('2026-01-01T10:00:00.000Z'),
      publishedAt: new Date('2026-01-01T10:00:00.000Z'),
      category: null,
      tags: [],
      moderationNotes: null,
    });

    const result = await service.publish('tenant-1', 'testimonial-1');

    expect(result).toEqual(
      expect.objectContaining({
        id: 'testimonial-1',
        status: 'published',
      }),
    );

    expect(outboxMock.createEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'testimonial.published',
      }),
    );
  });
});
