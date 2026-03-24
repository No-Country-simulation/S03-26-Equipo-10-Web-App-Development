import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';

const DEMO_TENANT_NAME = 'Demo Tenant';
const DEMO_ADMIN_EMAIL = 'admin@demo.com';
const DEMO_ADMIN_PASSWORD = 'Admin123!';
const DEMO_EDITOR_EMAIL = 'editor@demo.com';
const DEMO_EDITOR_PASSWORD = 'Editor123!';
const DEMO_API_KEY_NAME = 'public-demo-key';
const DEMO_TESTIMONIAL_AUTHOR = 'Camila Diaz';

const envCandidates = [resolve(__dirname, '../../.env'), resolve(__dirname, '../.env')];
for (const envPath of envCandidates) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath, override: false, quiet: true });
  }
}

const prisma = new PrismaClient();

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function hashOpaque(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

async function ensureCatalogs() {
  const permissions = [
    { code: 'create:testimonial', description: 'Create testimonials' },
    { code: 'approve:testimonial', description: 'Approve testimonials' },
    { code: 'publish:testimonial', description: 'Publish testimonials' },
    { code: 'manage:users', description: 'Manage tenant users' },
    { code: 'manage:webhooks', description: 'Manage tenant webhooks' },
    { code: 'manage:api_keys', description: 'Manage tenant api keys' },
  ];

  await prisma.role.upsert({ where: { code: 'admin' }, update: { description: 'Tenant administrator' }, create: { code: 'admin', description: 'Tenant administrator' } });
  await prisma.role.upsert({ where: { code: 'editor' }, update: { description: 'Tenant editor' }, create: { code: 'editor', description: 'Tenant editor' } });

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  for (const code of ['draft', 'pending', 'approved', 'published', 'rejected']) {
    await prisma.testimonialStatus.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const code of ['view', 'click', 'play']) {
    await prisma.analyticsEventType.upsert({ where: { code }, update: {}, create: { code } });
  }

  for (const code of ['testimonial.created', 'testimonial.published']) {
    await prisma.webhookEvent.upsert({ where: { code }, update: {}, create: { code } });
  }

  const flags = [
    { name: 'enable_analytics', description: 'Enable analytics dashboard and tracking' },
    { name: 'enable_webhooks', description: 'Enable webhook delivery' },
    { name: 'enable_scoring', description: 'Enable testimonial scoring' },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { name: flag.name },
      update: { description: flag.description },
      create: flag,
    });
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is missing. Copy .env.example to .env or apps/api/.env before running db:seed.');
  }

  await ensureCatalogs();

  const tenant = await prisma.tenant.upsert({
    where: { name: DEMO_TENANT_NAME },
    update: { isActive: true },
    create: { name: DEMO_TENANT_NAME, isActive: true },
  });

  const adminRole = await prisma.role.findUniqueOrThrow({ where: { code: 'admin' } });
  const editorRole = await prisma.role.findUniqueOrThrow({ where: { code: 'editor' } });

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: { tenantId: tenant.id, passwordHash: hashPassword(DEMO_ADMIN_PASSWORD), isActive: true },
    create: { tenantId: tenant.id, email: DEMO_ADMIN_EMAIL, passwordHash: hashPassword(DEMO_ADMIN_PASSWORD), isActive: true },
  });

  const editor = await prisma.user.upsert({
    where: { email: DEMO_EDITOR_EMAIL },
    update: { tenantId: tenant.id, passwordHash: hashPassword(DEMO_EDITOR_PASSWORD), isActive: true },
    create: { tenantId: tenant.id, email: DEMO_EDITOR_EMAIL, passwordHash: hashPassword(DEMO_EDITOR_PASSWORD), isActive: true },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: admin.id, roleId: adminRole.id } },
    update: {},
    create: { userId: admin.id, roleId: adminRole.id },
  });

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: editor.id, roleId: editorRole.id } },
    update: {},
    create: { userId: editor.id, roleId: editorRole.id },
  });

  const category = await prisma.category.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'General' } },
    update: {},
    create: { tenantId: tenant.id, name: 'General' },
  });

  const tagSales = await prisma.tag.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'sales' } },
    update: {},
    create: { tenantId: tenant.id, name: 'sales' },
  });

  const tagSupport = await prisma.tag.upsert({
    where: { tenantId_name: { tenantId: tenant.id, name: 'support' } },
    update: {},
    create: { tenantId: tenant.id, name: 'support' },
  });

  const publishedStatus = await prisma.testimonialStatus.findUniqueOrThrow({ where: { code: 'published' } });

  const testimonial = await prisma.testimonial.findFirst({
    where: { tenantId: tenant.id, authorName: DEMO_TESTIMONIAL_AUTHOR },
  });

  let testimonialId = testimonial?.id;
  if (!testimonialId) {
    const created = await prisma.testimonial.create({
      data: {
        tenantId: tenant.id,
        createdById: admin.id,
        categoryId: category.id,
        authorName: DEMO_TESTIMONIAL_AUTHOR,
        content: 'Excelente soporte, simple de integrar y muy util para ventas.',
        rating: 5,
        statusId: publishedStatus.id,
        score: 94.5,
        publishedAt: new Date(),
      },
    });
    testimonialId = created.id;
  }

  await prisma.testimonialTag.upsert({
    where: { testimonialId_tagId: { testimonialId, tagId: tagSales.id } },
    update: {},
    create: { testimonialId, tagId: tagSales.id },
  });

  await prisma.testimonialTag.upsert({
    where: { testimonialId_tagId: { testimonialId, tagId: tagSupport.id } },
    update: {},
    create: { testimonialId, tagId: tagSupport.id },
  });

  const analyticsFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_analytics' } });
  const webhooksFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_webhooks' } });
  const scoringFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_scoring' } });

  for (const featureFlagId of [analyticsFlag.id, webhooksFlag.id, scoringFlag.id]) {
    await prisma.tenantFeatureFlag.upsert({
      where: { tenantId_featureFlagId: { tenantId: tenant.id, featureFlagId } },
      update: { enabled: true },
      create: { tenantId: tenant.id, featureFlagId, enabled: true },
    });
  }

  const publishedEvent = await prisma.webhookEvent.findUniqueOrThrow({ where: { code: 'testimonial.published' } });
  await prisma.webhook.upsert({
    where: {
      id: '00000000-0000-0000-0000-000000000001',
    },
    update: {
      tenantId: tenant.id,
      url: 'https://example.test/webhooks/testimonial-published',
      eventId: publishedEvent.id,
      isActive: true,
      secret: 'dev-webhook-secret',
    },
    create: {
      id: '00000000-0000-0000-0000-000000000001',
      tenantId: tenant.id,
      url: 'https://example.test/webhooks/testimonial-published',
      eventId: publishedEvent.id,
      isActive: true,
      secret: 'dev-webhook-secret',
    },
  });

  const rawApiKey = `tms_${randomBytes(24).toString('hex')}`;
  await prisma.apiKey.create({
    data: {
      tenantId: tenant.id,
      name: DEMO_API_KEY_NAME,
      keyHash: hashOpaque(rawApiKey),
      isActive: true,
    },
  }).catch(() => undefined);

  console.log('Seed completado.');
  console.log(`Tenant demo: ${DEMO_TENANT_NAME}`);
  console.log(`Admin demo: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
  console.log(`Editor demo: ${DEMO_EDITOR_EMAIL} / ${DEMO_EDITOR_PASSWORD}`);
  console.log(`API key demo (solo se muestra una vez): ${rawApiKey}`);
  console.log(`Testimonio demo: ${DEMO_TESTIMONIAL_AUTHOR}`);
  console.log('Estados catalogo: draft, pending, approved, published, rejected');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async error => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });