import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { INestApplication } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import request from 'supertest';
import { TestimonialsController } from '../src/modules/testimonials/controllers/testimonials.controller';
import { TestimonialsService } from '../src/modules/testimonials/services/testimonials.service';
import { TagsService } from '../src/modules/testimonials/services/tags.service';
import { IdempotencyService } from '../src/common/services/idempotency.service';
import { CredentialRepository } from '../src/common/repositories/credential.repository';
import { IFeatureFlagEvaluator } from '../src/common/interfaces/feature-flag-evaluator.interface';
import { ApiResponseInterceptor } from '../src/common/interceptors/api-response.interceptor';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

// Real routing/JWT/RBAC/feature guards and response envelope; persistence is mocked.
describe('administrative testimonial HTTP contract', () => {
  let app: INestApplication;
  const tenantId = '00000000-0000-4000-8000-000000000001';
  const signingSecret = randomBytes(32).toString('hex');
  let editorToken: string;
  let guestToken: string;
  const service = {
    listTestimonials: jest.fn(),
    getSummary: jest.fn(),
    getTestimonial: jest.fn(),
  };
  const features = { isEnabled: jest.fn().mockResolvedValue(true) };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [TestimonialsController],
      providers: [
        JwtService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => ({ jwt: { secret: signingSecret } }) },
        },
        {
          provide: CredentialRepository,
          useValue: {
            findActiveUser: async (userId: string) => ({
              userId,
              tenantId,
              roles: [userId === 'editor' ? 'editor' : 'guest'],
              isActive: true,
            }),
          },
        },
        { provide: IFeatureFlagEvaluator, useValue: features },
        { provide: TestimonialsService, useValue: service },
        { provide: TagsService, useValue: {} },
        { provide: IdempotencyService, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalInterceptors(new ApiResponseInterceptor());
    app.useGlobalFilters(new ApiExceptionFilter());
    await app.init();
    const jwt = app.get(JwtService);
    editorToken = jwt.sign(
      { sub: 'editor', tenantId },
      { secret: signingSecret },
    );
    guestToken = jwt.sign(
      { sub: 'guest', tenantId },
      { secret: signingSecret },
    );
  });
  beforeEach(() => {
    jest.clearAllMocks();
    features.isEnabled.mockResolvedValue(true);
    service.listTestimonials.mockResolvedValue({
      items: [],
      meta: { total: 0, page: 2, limit: 20 },
    });
    service.getSummary.mockResolvedValue({
      total: 0,
      byStatus: {
        draft: 0,
        pending: 0,
        approved: 0,
        published: 0,
        rejected: 0,
      },
    });
  });
  afterAll(async () => {
    await app?.close();
  });
  it('preserves data[] + meta and takes tenant exclusively from the verified identity', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/testimonials')
      .auth(editorToken, { type: 'bearer' })
      .query({
        page: '2',
        q: ' autor ',
        status: 'pending',
        tagIds: tenantId,
        tenantId: 'foreign',
      })
      .expect(200);
    expect(response.body).toEqual({
      success: true,
      data: [],
      meta: { total: 0, page: 2, limit: 20 },
    });
    expect(service.listTestimonials).toHaveBeenCalledWith(tenantId, {
      page: 2,
      limit: 20,
      q: 'autor',
      status: 'pending',
      tagIds: [tenantId],
    });
  });
  it('routes summary before the identifier and authorizes editors', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/testimonials/summary')
      .auth(editorToken, { type: 'bearer' })
      .expect(200);
    expect(service.getSummary).toHaveBeenCalledWith(tenantId);
    expect(service.getTestimonial).not.toHaveBeenCalled();
  });
  it('rejects unauthenticated, unauthorized, disabled-feature and malformed requests before the service', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/testimonials/summary')
      .expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/testimonials/summary')
      .auth(guestToken, { type: 'bearer' })
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/testimonials?status=unknown')
      .auth(editorToken, { type: 'bearer' })
      .expect(400);
    features.isEnabled.mockResolvedValue(false);
    await request(app.getHttpServer())
      .get('/api/v1/testimonials/summary')
      .auth(editorToken, { type: 'bearer' })
      .expect(403);
    expect(service.listTestimonials).not.toHaveBeenCalled();
    expect(service.getSummary).not.toHaveBeenCalled();
  });
});
