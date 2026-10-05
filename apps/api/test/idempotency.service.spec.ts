import { IdempotencyRepository, type IdempotencyRequest } from '../src/common/repositories/idempotency.repository';
import { createHash } from 'node:crypto';
import type { PrismaService } from '../src/modules/database/prisma.service';
import { ApplicationError } from '../src/common/errors/application.error';

const request: IdempotencyRequest = {
  key: 'same-request-key',
  tenantId: '00000000-0000-0000-0000-000000000001',
  principalKind: 'user',
  principalId: '00000000-0000-0000-0000-000000000002',
  method: 'POST',
  path: '/api/v1/testimonials',
  payload: { body: { content: 'Enough content', rating: 5 } },
  statusCode: 201,
};
const requestHash = createHash('sha256')
  .update('{"body":{"content":"Enough content","rating":5}}')
  .digest('hex');

function fixture() {
  const tx = { $executeRaw: jest.fn().mockResolvedValue(1), $queryRaw: jest.fn() };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    $executeRaw: jest.fn(),
  };
  return { service: new IdempotencyRepository(prisma as unknown as PrismaService), tx, prisma };
}

describe('IdempotencyRepository', () => {
  it('runs an unkeyed operation without promising a replay', async () => {
    const { service, prisma } = fixture();
    const operation = jest.fn().mockResolvedValue({ id: 'created' });

    await expect(service.execute({ ...request, key: undefined }, operation))
      .resolves.toEqual({ value: { id: 'created' }, replayed: false });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('rejects malformed keys before entering the transaction', async () => {
    const { service, prisma } = fixture();
    await expect(service.execute({ ...request, key: 'space in key' }, jest.fn()))
      .rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_INVALID' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('waits for the result write before returning a new success', async () => {
    const { service, tx } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([{ id: '00000000-0000-0000-0000-000000000003' }]);
    let releaseWrite: (() => void) | undefined;
    tx.$executeRaw.mockImplementationOnce(() => Promise.resolve(1))
      .mockImplementationOnce(() => Promise.resolve(1))
      .mockImplementationOnce(() => Promise.resolve(1))
      .mockImplementationOnce(() => new Promise<void>(resolve => { releaseWrite = resolve; }));

    let settled = false;
    const pending = service.execute(request, async () => ({ id: 'created' }))
      .then(result => { settled = true; return result; });
    await new Promise(resolve => setImmediate(resolve));
    expect(settled).toBe(false);
    releaseWrite?.();
    await expect(pending).resolves.toEqual({ value: { id: 'created' }, replayed: false });
  });

  it('replays the committed response without running the operation', async () => {
    const { service, tx } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([
      {
        requestHash,
        recordState: 'completed', statusCode: 201, responseBody: { id: 'existing' },
      },
    ]);
    const operation = jest.fn();
    const result = await service.execute(request, operation);
    expect(result.replayed).toBe(true);
    expect(result.value).toEqual({ id: 'existing' });
    expect(operation).not.toHaveBeenCalled();
  });

  it('rejects a reused key with a different request hash', async () => {
    const { service, tx } = fixture();
    tx.$queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{
      requestHash: '0'.repeat(64), recordState: 'completed',
      statusCode: 201, responseBody: { id: 'existing' },
    }]);
    const operation = jest.fn();
    await expect(service.execute(request, operation)).rejects.toMatchObject({
      code: 'IDEMPOTENCY_KEY_REUSED', kind: 'conflict',
    } satisfies Partial<ApplicationError>);
    expect(operation).not.toHaveBeenCalled();
  });
});
