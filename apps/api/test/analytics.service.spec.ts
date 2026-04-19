import { NotFoundException } from '@nestjs/common';
import { AnalyticsService } from '../src/modules/analytics/services/analytics.service';

describe('AnalyticsService', () => {
  const webhookRepo = {
    findActiveByEvent: jest.fn(),
  };

  const dispatcher = {
    dispatch: jest.fn(),
  };

  const analyticsRepo = {
    trackEvent: jest.fn(),
    getDashboard: jest.fn(),
    getTestimonialMetrics: jest.fn(),
  };

  const tenantsService = {
    getTenantByPublicSlug: jest.fn(),
  };

  const testimonialRepo = {
    findPublishedById: jest.fn(),
  };

  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(
      webhookRepo as any,
      dispatcher as any,
      analyticsRepo as any,
      tenantsService as any,
      testimonialRepo as any,
    );
  });

  it('tracks public events by slug when the testimonial belongs to the tenant', async () => {
    tenantsService.getTenantByPublicSlug.mockResolvedValue({ id: 'tenant-1' });
    testimonialRepo.findPublishedById.mockResolvedValue({ id: 'testimonial-1' });
    analyticsRepo.trackEvent.mockResolvedValue(undefined);

    const result = await service.trackPublicEventBySlug(
      'acme',
      { testimonialId: 'testimonial-1', eventType: 'view' },
      '127.0.0.1',
    );

    expect(testimonialRepo.findPublishedById).toHaveBeenCalledWith('tenant-1', 'testimonial-1');
    expect(analyticsRepo.trackEvent).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({
        testimonialId: 'testimonial-1',
        eventType: 'view',
        source: 'public-browser',
        metadata: expect.objectContaining({ ip: '127.0.0.1' }),
      }),
    );
    expect(result).toEqual({ tracked: true });
  });

  it('rejects public tracking when the testimonial is not published for the tenant', async () => {
    tenantsService.getTenantByPublicSlug.mockResolvedValue({ id: 'tenant-1' });
    testimonialRepo.findPublishedById.mockResolvedValue(null);

    await expect(
      service.trackPublicEventBySlug(
        'acme',
        { testimonialId: 'missing', eventType: 'click' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(NotFoundException);
  });
});
