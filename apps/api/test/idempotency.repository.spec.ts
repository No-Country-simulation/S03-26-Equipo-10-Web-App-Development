import { IdempotencyRepository } from '../src/common/repositories/idempotency.repository';

describe('IdempotencyRepository', () => {
  const findUnique = jest.fn();
  const upsert = jest.fn();

  const prismaMock = {
    idempotencyKey: {
      findUnique,
      upsert,
    },
  } as any;

  let repository: IdempotencyRepository;

  beforeEach(() => {
    findUnique.mockReset();
    upsert.mockReset();
    repository = new IdempotencyRepository(prismaMock);
  });

  it('returns null when key is not cached', async () => {
    findUnique.mockResolvedValueOnce(null);

    await expect(
      repository.get({
        key: 'idem-1',
        tenantId: 'tenant-1',
        method: 'POST',
        path: '/api/v1/testimonials',
      }),
    ).resolves.toBeNull();

    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns cached response payload and status', async () => {
    findUnique.mockResolvedValueOnce({ responseBody: { ok: true }, statusCode: 201 });

    await expect(
      repository.get({
        key: 'idem-2',
        tenantId: 'tenant-1',
        method: 'POST',
        path: '/api/v1/testimonials',
      }),
    ).resolves.toEqual({ statusCode: 201, body: { ok: true } });
  });

  it('upserts idempotent response payload', async () => {
    upsert.mockResolvedValueOnce({});

    await repository.save({
      key: 'idem-3',
      tenantId: 'tenant-1',
      method: 'POST',
      path: '/api/v1/public/analytics/events',
      statusCode: 201,
      body: { accepted: true },
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          key: 'idem-3',
          tenantId: 'tenant-1',
          method: 'POST',
          path: '/api/v1/public/analytics/events',
          statusCode: 201,
        }),
      }),
    );
  });
});


