import { ConflictError, ForbiddenError, NotFoundError } from '../src/common/errors/application.error';

import { TestimonialsService } from '../src/modules/testimonials/services/testimonials.service';
import { VALID_TRANSITIONS, TestimonialView } from '../src/modules/testimonials/entities/testimonial.model';
import { TransitionTestimonialUseCase } from '../src/modules/testimonials/use-cases/transition-testimonial.use-case';
import { CreateTestimonialUseCase } from '../src/modules/testimonials/use-cases/create-testimonial.use-case';

describe('VALID_TRANSITIONS', () => {
  it('defines correct transitions for each status', () => {
    expect(VALID_TRANSITIONS.draft).toEqual(['pending']);
    expect(VALID_TRANSITIONS.pending).toEqual(['approved', 'rejected']);
    expect(VALID_TRANSITIONS.approved).toEqual(['published', 'rejected']);
    expect(VALID_TRANSITIONS.published).toEqual(['rejected']);
    expect(VALID_TRANSITIONS.rejected).toEqual([]);
  });
});

describe('TestimonialsService', () => {
  const makeView = (overrides: Partial<TestimonialView> = {}): TestimonialView => ({
    id: 'test-1',
    tenantId: 'tenant-1',
    createdById: 'user-1',
    authorName: 'John',
    content: 'Great product, highly recommend it!',
    rating: 5,
    status: 'draft',
    score: 0,
    categoryId: null,
    moderationNotes: null,
    imageUrl: null,
    videoUrl: null,
    videoTitle: null,
    videoThumbnailUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    publishedAt: null,
    ...overrides,
  });

  const mockRepo = {
    findById: jest.fn(),
    createWithEvent: jest.fn(),
    updateFields: jest.fn(),
    updateStatus: jest.fn(),
    remove: jest.fn(),
    findByTenant: jest.fn(),
    findPublished: jest.fn(),
    findPublishedById: jest.fn(),
  };

  const mockCategoryRepo = {
    findById: jest.fn(),
  };

  const mockTenantsService = {
    getTenantByPublicSlug: jest.fn(),
  };

  const mockAnalyticsRepo = {
    getTestimonialMetrics: jest.fn(),
  };

  const mockCloudinaryService = {
    uploadImage: jest.fn(),
  };

  const mockYoutubeService = {
    getVideoMetadata: jest.fn(),
  };

  const mockCacheService = {
    get: jest.fn().mockReturnValue(null),
    set: jest.fn(),
    getOrSetPublic: jest.fn().mockImplementation((_tenant: string, _key: string, factory: () => Promise<unknown>) => factory()),
    invalidate: jest.fn(),
    invalidateTenantPublic: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  };

  let service: TestimonialsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new TestimonialsService(
      mockRepo as any,
      mockCategoryRepo as any,
      mockTenantsService as any,
      mockAnalyticsRepo as any,
      mockCloudinaryService as any,
      mockYoutubeService as any,
      mockCacheService as any,
      new TransitionTestimonialUseCase(mockRepo as any, mockCacheService as any),
      new CreateTestimonialUseCase(mockRepo as any, mockCategoryRepo as any),
    );
  });

  it('creates a draft testimonial', async () => {
    const created = makeView();
    mockRepo.createWithEvent.mockResolvedValue(created);

    const result = await service.createTestimonial('tenant-1', 'user-1', {
      authorName: 'John',
      content: 'Great product, highly recommend it!',
      rating: 5,
    });

    expect(result.status).toBe('draft');
    expect(result.score).toBe(0);
    expect(mockRepo.createWithEvent).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      createdById: 'user-1',
      rating: 5,
    }), 'draft', expect.objectContaining({ eventType: 'testimonial.created' }), undefined);
  });

  it('creates public submissions directly as pending', async () => {
    const pending = makeView({ status: 'pending', createdById: null });
    mockTenantsService.getTenantByPublicSlug.mockResolvedValue({ id: 'tenant-1', isPublicFormEnabled: true });
    mockRepo.createWithEvent.mockResolvedValue(pending);
    mockRepo.findById.mockResolvedValue(pending);

    const result = await service.submitPublicTestimonial('acme', {
      authorName: 'John', content: 'Great product, highly recommend it!', rating: 5,
    });

    expect(result.status).toBe('pending');
    expect(mockRepo.createWithEvent).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'tenant-1', createdById: null }),
      'pending',
      expect.objectContaining({ eventType: 'testimonial.created' }),
    );
    expect(mockRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('follows the correct state machine: draft → pending → approved → published', async () => {
    const draft = makeView({ status: 'draft' });
    const pending = makeView({ status: 'pending' });
    const approved = makeView({ status: 'approved' });
    const published = makeView({ status: 'published', publishedAt: new Date() });

    mockRepo.findById.mockResolvedValueOnce(draft);
    mockRepo.updateStatus.mockResolvedValueOnce(pending);
    const submitResult = await service.submitTestimonial('tenant-1', 'test-1');
    expect(submitResult.status).toBe('pending');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'test-1', 'draft', 'pending');

    mockRepo.findById.mockResolvedValueOnce(pending);
    mockRepo.updateStatus.mockResolvedValueOnce(approved);
    const approveResult = await service.approveTestimonial('tenant-1', 'test-1');
    expect(approveResult.status).toBe('approved');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'test-1', 'pending', 'approved');

    mockRepo.findById.mockResolvedValueOnce(approved);
    mockRepo.updateStatus.mockResolvedValueOnce(published);
    const publishResult = await service.publishTestimonial('tenant-1', 'test-1');
    expect(publishResult.status).toBe('published');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'test-1', 'approved', 'published', expect.any(Object), expect.objectContaining({ eventType: 'testimonial.published' }), undefined);
    expect(mockCacheService.invalidateTenantPublic).toHaveBeenCalledWith('tenant-1');
  });

  it('rejects invalid state transitions', async () => {
    const draft = makeView({ status: 'draft' });

    mockRepo.findById.mockResolvedValue(draft);
    await expect(service.approveTestimonial('tenant-1', 'test-1')).rejects.toThrow(ConflictError);
    await expect(service.publishTestimonial('tenant-1', 'test-1')).rejects.toThrow(ConflictError);
  });

  it('allows rejection from pending', async () => {
    const pending = makeView({ status: 'pending' });
    const rejected = makeView({ status: 'rejected', moderationNotes: 'Not appropriate' });

    mockRepo.findById.mockResolvedValue(pending);
    mockRepo.updateStatus.mockResolvedValue(rejected);

    const result = await service.rejectTestimonial('tenant-1', 'test-1', 'Not appropriate');
    expect(result.status).toBe('rejected');
    expect(mockRepo.updateStatus).toHaveBeenCalledWith('tenant-1', 'test-1', 'pending', 'rejected', { moderationNotes: 'Not appropriate' });
  });

  it('prevents editing published testimonials', async () => {
    const published = makeView({ status: 'published' });
    mockRepo.findById.mockResolvedValue(published);

    await expect(
      service.updateTestimonial('tenant-1', 'test-1', { userId: 'user-1', roles: ['admin'] }, { authorName: 'Changed' }),
    ).rejects.toThrow(ConflictError);
  });

  it('validates rating bounds on create', async () => {
    await expect(
      service.createTestimonial('tenant-1', 'user-1', {
        authorName: 'Eve',
        content: 'Invalid rating test content here.',
        rating: 0,
      }),
    ).rejects.toThrow(ConflictError);

    await expect(
      service.createTestimonial('tenant-1', 'user-1', {
        authorName: 'Eve',
        content: 'Invalid rating test content here.',
        rating: 6,
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('throws NotFoundError when testimonial not found', async () => {
    mockRepo.findById.mockResolvedValue(null);
    await expect(service.getTestimonial('tenant-1', 'nonexistent')).rejects.toThrow(NotFoundError);
  });

  it('lists public testimonials by slug', async () => {
    mockTenantsService.getTenantByPublicSlug.mockResolvedValue({ id: 'tenant-1' });
    mockRepo.findPublished.mockResolvedValue({
      items: [makeView({ status: 'published' })],
      total: 1,
    });

    const result = await service.listPublicTestimonialsBySlug('acme', {});

    expect(mockTenantsService.getTenantByPublicSlug).toHaveBeenCalledWith('acme');
    expect(mockRepo.findPublished).toHaveBeenCalledWith(
      'tenant-1',
      expect.objectContaining({ page: 1, limit: 20 }),
    );
    expect(result.meta.total).toBe(1);
  });

  it('enforces ownership for editors on edit and delete', async () => {
    const testimonial = makeView({ createdById: 'other-user', status: 'pending' });
    mockRepo.findById.mockResolvedValue(testimonial);

    const admin = { userId: 'admin-user', roles: ['admin'] };
    const ownerEditor = { userId: 'other-user', roles: ['editor'] };
    const otherEditor = { userId: 'unauthorized-user', roles: ['editor'] };

    // Other editor should fail
    await expect(service.updateTestimonial('tenant-1', 'test-1', otherEditor, { content: 'x' })).rejects.toThrow(ForbiddenError);
    await expect(service.removeTestimonial('tenant-1', 'test-1', otherEditor)).rejects.toThrow(ForbiddenError);

    // Admin should succeed
    mockRepo.updateFields.mockResolvedValue({ ...testimonial, content: 'x' });
    mockRepo.remove.mockResolvedValue(undefined);
    await expect(service.updateTestimonial('tenant-1', 'test-1', admin, { content: 'x' })).resolves.toBeDefined();
    await expect(service.removeTestimonial('tenant-1', 'test-1', admin)).resolves.toEqual({ id: 'test-1', deleted: true });

    // Owner editor should succeed
    await expect(service.updateTestimonial('tenant-1', 'test-1', ownerEditor, { content: 'x' })).resolves.toBeDefined();
    await expect(service.removeTestimonial('tenant-1', 'test-1', ownerEditor)).resolves.toEqual({ id: 'test-1', deleted: true });
  });
});
