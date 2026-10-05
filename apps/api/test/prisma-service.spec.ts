import { Prisma } from '@prisma/client';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../src/modules/database/prisma.service';

function prismaError(code: string): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError('private database details', {
    code,
    clientVersion: '6.5.0',
  });
}

describe('PrismaService.withRetry', () => {
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = new PrismaService();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await prisma.$disconnect();
  });

  it('retries P2034 and returns the result after a conflict', async () => {
    const transaction = jest.spyOn(prisma, '$transaction')
      .mockRejectedValueOnce(prismaError('P2034'))
      .mockResolvedValueOnce('ok' as never);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    await expect(prisma.withRetry(async () => 'ok', 3, 0)).resolves.toBe('ok');
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('does not retry the generic transaction API error P2028', async () => {
    const error = prismaError('P2028');
    const transaction = jest.spyOn(prisma, '$transaction').mockRejectedValue(error);

    await expect(prisma.withRetry(async () => 'ok', 3, 0)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it('stops after the configured number of P2034 attempts', async () => {
    const error = prismaError('P2034');
    const transaction = jest.spyOn(prisma, '$transaction').mockRejectedValue(error);
    jest.spyOn(Math, 'random').mockReturnValue(0);

    await expect(prisma.withRetry(async () => 'ok', 2, 0)).rejects.toBe(error);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it('logs slow-query metadata without SQL or engine messages', async () => {
    const handlers = new Map<string, (event: unknown) => void>();
    jest.spyOn(prisma, '$connect').mockResolvedValue();
    jest.spyOn(prisma, '$on').mockImplementation((event, handler) => {
      handlers.set(event, handler as (event: unknown) => void);
      return prisma;
    });
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await prisma.onModuleInit();
    handlers.get('query')?.({ duration: 150, query: "SELECT 'private-value'", params: 'private-value' });
    handlers.get('error')?.({ target: 'query-engine', message: 'private-value' });
    handlers.get('warn')?.({ target: 'query-engine', message: 'private-value' });

    expect(warn).toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls])).not.toContain('private-value');
  });
});
