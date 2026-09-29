import { NotFoundError } from '../src/common/errors/application.error';

import { AnalyticsService } from '../src/modules/analytics/services/analytics.service';

describe('AnalyticsService', () => {
  const analyticsRepo = {
    trackEvent: jest.fn(),
    getDashboard: jest.fn(),
    getTestimonialMetrics: jest.fn(),
    isPublishedTestimonial: jest.fn(),
  };

  const tenantsService = {
    getTenantByPublicSlug: jest.fn(),
  };

  let service: AnalyticsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnalyticsService(
      analyticsRepo as any,
      tenantsService as any,
    );
  });

  it('tracks public events by slug when the testimonial belongs to the tenant', async () => {
    tenantsService.getTenantByPublicSlug.mockResolvedValue({ id: 'tenant-1' });
    analyticsRepo.isPublishedTestimonial.mockResolvedValue(true);
    analyticsRepo.trackEvent.mockResolvedValue(undefined);

    const result = await service.trackPublicEventBySlug(
      'acme',
      { testimonialId: 'testimonial-1', eventType: 'view' },
      '127.0.0.1',
    );

    expect(analyticsRepo.isPublishedTestimonial).toHaveBeenCalledWith('tenant-1', 'testimonial-1');
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
    analyticsRepo.isPublishedTestimonial.mockResolvedValue(false);

    await expect(
      service.trackPublicEventBySlug(
        'acme',
        { testimonialId: 'missing', eventType: 'click' },
        '127.0.0.1',
      ),
    ).rejects.toThrow(NotFoundError);
  });
});
