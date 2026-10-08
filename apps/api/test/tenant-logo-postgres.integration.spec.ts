import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/modules/database/prisma.service';
import { TenantLogoRepository } from '../src/modules/tenants/repositories/tenant-logo.repository';
import { TenantRepository } from '../src/modules/tenants/repositories/tenant.repository';

// Explicit opt-in: a disposable PostgreSQL database. Each run owns a fresh schema.
const databaseUrl = process.env.TEST_LOGO_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;

describeDatabase('tenant logo durable protocol in PostgreSQL', () => {
  let admin: PrismaClient;
  let prisma: PrismaClient;
  let repo: TenantLogoRepository;
  let tenantId: string;
  let otherId: string;
  const schema = `logo_test_${randomUUID().replaceAll('-', '')}`;
  const asset = (tenant = tenantId) => `tenant-logos/${tenant}/${randomUUID()}`;
  const url = (id: string) => `https://res.cloudinary.com/synthetic/image/upload/v1/${id}.png`;

  beforeAll(async () => {
    admin = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
    await admin.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    const isolatedUrl = new URL(databaseUrl!);
    isolatedUrl.searchParams.set('schema', schema);
    prisma = new PrismaClient({ datasources: { db: { url: isolatedUrl.toString() } } });
    // Minimal pre-migration fixture; do not migrate an existing deployment.
    await prisma.$executeRawUnsafe(`CREATE TABLE "${schema}".tenants (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE,
      public_slug text UNIQUE, is_public_form_enabled boolean NOT NULL DEFAULT false,
      is_active boolean NOT NULL DEFAULT true, created_at timestamptz(3) NOT NULL DEFAULT now(),
      updated_at timestamptz(3) NOT NULL DEFAULT now())`);
    // Fixed repository fixture; the path never comes from a request or environment.
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const migration = readFileSync(join(__dirname, '../prisma/migrations/20261008000000_tenant_logos/migration.sql'), 'utf8')
      .replace(/^--.*$/gm, '').replaceAll('public.', `"${schema}".`);
    const statements = migration.split(';').map(sql => sql.trim())
      .filter(sql => sql && !['BEGIN', 'COMMIT'].includes(sql));
    await prisma.$transaction(async tx => {
      for (const sql of statements) await tx.$executeRawUnsafe(sql);
    }, { timeout: 20000 });
    repo = new TenantLogoRepository(prisma as unknown as PrismaService);
  });
  beforeEach(async () => {
    await prisma.tenantLogoCleanupJob.deleteMany();
    await prisma.tenant.deleteMany();
    tenantId = (await prisma.tenant.create({ data: { name: `Synthetic-${randomUUID()}` } })).id;
    otherId = (await prisma.tenant.create({ data: { name: `Synthetic-${randomUUID()}` } })).id;
  });
  afterAll(async () => {
    await prisma?.$disconnect();
    if (admin) {
      await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.$disconnect();
    }
  });

  async function attach(id = asset()) {
    const state = await repo.findState(tenantId);
    const job = await repo.registerCandidate(tenantId, id);
    return repo.attach(tenantId, state, job, id, url(id));
  }

  it('publishes only public fields and atomically schedules replaced assets', async () => {
    const first = asset();
    const view = await attach(first);
    expect(view.logoUrl).toBe(url(first));
    expect(view).not.toHaveProperty('logoPublicId');
    expect(view).not.toHaveProperty('logoRevision');
    const second = asset();
    await attach(second);
    expect(await prisma.tenantLogoCleanupJob.findMany({ where: { tenantId }, select: { publicId: true, status: true } }))
      .toEqual(expect.arrayContaining([{ publicId: first, status: 'pending' }, { publicId: second, status: 'cancelled' }]));
    const publicRepo = new TenantRepository(prisma as unknown as PrismaService);
    expect(await publicRepo.findById(tenantId)).not.toHaveProperty('logoPublicId');
    await prisma.tenant.update({ where: { id: tenantId }, data: { publicSlug: 'synthetic-public' } });
    expect(await publicRepo.findByPublicSlug('synthetic-public')).not.toHaveProperty('logoRevision');
  });

  it('lets exactly one simultaneous replacement win without overwriting other configuration', async () => {
    const state = await repo.findState(tenantId);
    const ids = [asset(), asset()];
    const jobs = await Promise.all(ids.map(id => repo.registerCandidate(tenantId, id)));
    await prisma.tenant.update({ where: { id: tenantId }, data: { name: 'Synthetic changed', publicSlug: 'changed' } });
    const results = await Promise.allSettled(ids.map((id, index) => repo.attach(tenantId, state, jobs.at(index)!, id, url(id))));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1);
    const stored = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(stored).toMatchObject({ name: 'Synthetic changed', publicSlug: 'changed', logoRevision: 1n });
    const losingId = ids.find(id => id !== stored.logoPublicId);
    if (!losingId) throw new Error('Expected a losing candidate');
    expect(await prisma.tenantLogoCleanupJob.findFirst({ where: { tenantId, publicId: losingId } })).toMatchObject({ status: 'pending' });
  });

  it('rejects another company candidate and invalid database references', async () => {
    const foreign = asset(otherId);
    const job = await repo.registerCandidate(otherId, foreign);
    await expect(repo.attach(tenantId, await repo.findState(tenantId), job, foreign, url(foreign)))
      .rejects.toMatchObject({ kind: 'conflict' });
    await expect(prisma.tenant.update({ where: { id: tenantId }, data: { logoUrl: url(foreign), logoPublicId: foreign } })).rejects.toThrow();
    await expect(repo.registerCandidate(tenantId, foreign)).rejects.toThrow();
    expect(await repo.findState(tenantId)).toEqual({ logoPublicId: null, logoRevision: 0n });
    expect(await repo.findState(otherId)).toEqual({ logoPublicId: null, logoRevision: 0n });
  });

  it('removes the visible logo immediately and tolerates repeated removal', async () => {
    const id = asset();
    await attach(id);
    const state = await repo.findState(tenantId);
    expect((await repo.remove(tenantId, state)).logoUrl).toBeNull();
    await expect(repo.remove(tenantId, state)).rejects.toMatchObject({ kind: 'conflict' });
    expect((await repo.remove(tenantId, await repo.findState(tenantId))).logoUrl).toBeNull();
    const [claim] = await repo.claim(tenantId, 5);
    expect(claim?.publicId).toBe(id);
    expect(await repo.isReferenced(claim!)).toBe(false);
    expect(await repo.finish(claim!, 'completed')).toBe(true);
    expect(await repo.claim(tenantId, 5)).toEqual([]);
  });

  it('recovers an abandoned upload only after its deadline and forbids late attachment', async () => {
    const id = asset();
    const state = await repo.findState(tenantId);
    const job = await repo.registerCandidate(tenantId, id);
    expect(await repo.claim(tenantId, 5)).toEqual([]);
    await prisma.$executeRaw`UPDATE tenant_logo_cleanup_jobs
      SET created_at = clock_timestamp() - interval '11 minutes', next_attempt_at = clock_timestamp()
      WHERE tenant_id = ${tenantId}::uuid AND id = ${job}::uuid`;
    await expect(repo.attach(tenantId, state, job, id, url(id))).rejects.toMatchObject({ kind: 'conflict' });
    const [claim] = await repo.claim(tenantId, 5);
    expect(claim?.publicId).toBe(id);
    await repo.finish(claim!, 'pending', 60000, 'MEDIA_CLEANUP_FAILED');
    // A retry extends next_attempt_at, never the original attachment deadline.
    await expect(repo.attach(tenantId, state, job, id, url(id))).rejects.toMatchObject({ kind: 'conflict' });
  });

  it('fences expired workers and recovers leases without duplicate claims', async () => {
    const id = asset();
    await attach(id);
    await repo.remove(tenantId, await repo.findState(tenantId));
    const [[first], concurrent] = await Promise.all([repo.claim(tenantId, 5), repo.claim(tenantId, 5)]);
    const original = first ?? concurrent[0]!;
    expect((first ? 1 : 0) + concurrent.length).toBe(1);
    await prisma.tenantLogoCleanupJob.update({ where: { id: original.id }, data: { leaseUntil: new Date(0) } });
    expect(await repo.finish(original, 'completed')).toBe(false);
    const [recovered] = await repo.claim(tenantId, 5);
    expect(recovered).toMatchObject({ id: original.id, attempts: 2 });
    expect(recovered!.leaseToken).not.toBe(original.leaseToken);
    expect(await repo.finish(original, 'completed')).toBe(false);
    expect(await repo.finish(recovered!, 'completed')).toBe(true);
  });

  it('marks a final expired lease dead and never selects it again', async () => {
    const id = asset();
    await attach(id);
    await repo.remove(tenantId, await repo.findState(tenantId));
    const [claim] = await repo.claim(tenantId, 5);
    await prisma.tenantLogoCleanupJob.update({ where: { id: claim!.id }, data: { attempts: 10, leaseUntil: new Date(0) } });
    expect(await repo.claim(tenantId, 5)).toEqual([]);
    expect(await prisma.tenantLogoCleanupJob.findUnique({ where: { id: claim!.id } })).toMatchObject({ status: 'dead' });
    expect(await repo.dueTenants()).toEqual([]);
  });

  it('rolls back the tenant and candidate if scheduling the previous asset fails', async () => {
    const first = asset();
    await attach(first);
    const second = asset();
    const state = await repo.findState(tenantId);
    const job = await repo.registerCandidate(tenantId, second);
    await prisma.$executeRawUnsafe(`CREATE FUNCTION "${schema}".fail_retire() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN IF NEW.public_id = '${first}' AND NEW.status = 'pending' THEN RAISE EXCEPTION 'synthetic scheduling failure'; END IF;
      RETURN NEW; END $$`);
    await prisma.$executeRawUnsafe(`CREATE TRIGGER fail_retire BEFORE UPDATE ON "${schema}".tenant_logo_cleanup_jobs
      FOR EACH ROW EXECUTE FUNCTION "${schema}".fail_retire()`);
    try {
      await expect(repo.attach(tenantId, state, job, second, url(second))).rejects.toThrow();
      expect(await repo.findState(tenantId)).toEqual(state);
      expect(await prisma.tenantLogoCleanupJob.findUnique({ where: { id: job } })).toMatchObject({ status: 'pending' });
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER fail_retire ON "${schema}".tenant_logo_cleanup_jobs`);
    }
  });
});
