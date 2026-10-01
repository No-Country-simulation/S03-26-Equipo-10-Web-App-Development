import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { UnauthorizedError } from '../src/common/errors/application.error';
import { PrismaService } from '../src/modules/database/prisma.service';
import { AuthRepository } from '../src/modules/auth/repositories/auth.repository';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (process.env.CI && !testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL is required in CI for refresh-session integration tests');
}
const describeWithDatabase = testDatabaseUrl ? describe : describe.skip;

describeWithDatabase('refresh families in PostgreSQL', () => {
  let first: PrismaClient;
  let second: PrismaClient;
  let firstRepo: AuthRepository;
  let secondRepo: AuthRepository;
  let tenantId: string;
  let userId: string;

  beforeAll(async () => {
    if (!testDatabaseUrl) throw new Error('TEST_DATABASE_URL is required');
    first = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    second = new PrismaClient({ datasources: { db: { url: testDatabaseUrl } } });
    await Promise.all([first.$connect(), second.$connect()]);
    const tenant = await first.tenant.create({ data: { name: `auth-test-${randomUUID()}` } });
    tenantId = tenant.id;
    const user = await first.user.create({ data: {
      tenantId, email: `auth-${randomUUID()}@example.test`, passwordHash: 'unused',
    } });
    userId = user.id;
    firstRepo = new AuthRepository(first as PrismaService);
    secondRepo = new AuthRepository(second as PrismaService);
  });

  afterAll(async () => {
    if (!first) return;
    await first.auditLog.deleteMany({ where: { userId } });
    await first.refreshToken.deleteMany({ where: { userId } });
    await first.refreshSession.deleteMany({ where: { userId } });
    await first.user.delete({ where: { id: userId } });
    await first.tenant.delete({ where: { id: tenantId } });
    await Promise.all([first.$disconnect(), second.$disconnect()]);
  });

  it('permite una sola rotación concurrente y audita reutilización', async () => {
    const oldHash = randomUUID();
    const familyId = await firstRepo.createRefreshSession(userId, oldHash, new Date(Date.now() + 3600000));
    const attempts = await Promise.allSettled([
      firstRepo.rotateRefreshToken(oldHash, randomUUID(), new Date(Date.now() + 3600000)),
      secondRepo.rotateRefreshToken(oldHash, randomUUID(), new Date(Date.now() + 3600000)),
    ]);
    expect(attempts.filter(item => item.status === 'fulfilled')).toHaveLength(1);
    expect(attempts.filter(item => item.status === 'rejected')).toHaveLength(1);
    expect((attempts.find(item => item.status === 'rejected') as PromiseRejectedResult).reason)
      .toBeInstanceOf(UnauthorizedError);
    expect(await first.refreshToken.count({ where: { familyId } })).toBe(2);
    expect((await first.refreshSession.findUniqueOrThrow({ where: { id: familyId } })).revokedAt).not.toBeNull();
    expect(await first.auditLog.count({ where: { resourceId: familyId, action: 'REFRESH_TOKEN_REUSE' } })).toBe(1);
  });

  it('revoca la familia completa al cerrar sesión', async () => {
    const oldHash = randomUUID();
    const familyId = await firstRepo.createRefreshSession(userId, oldHash, new Date(Date.now() + 3600000));
    const nextHash = randomUUID();
    await firstRepo.rotateRefreshToken(oldHash, nextHash, new Date(Date.now() + 3600000));
    await secondRepo.revokeSessionFamilyByHash(nextHash);
    expect((await first.refreshSession.findUniqueOrThrow({ where: { id: familyId } })).revokedAt).not.toBeNull();
    expect(await first.refreshToken.count({ where: { familyId, revoked: false } })).toBe(0);
  });
});
