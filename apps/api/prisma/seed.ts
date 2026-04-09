import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { randomBytes, scryptSync, createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { fakerES as faker } from '@faker-js/faker';

// Make Faker generation deterministic for idempotency
faker.seed(12345);

const DEMO_TENANT_NAME = 'Demo Tenant';
const DEMO_ADMIN_EMAIL = 'admin@demo.com';
const DEMO_ADMIN_PASSWORD = 'Admin123!';
const DEMO_EDITOR_EMAIL = 'editor@demo.com';
const DEMO_EDITOR_PASSWORD = 'Editor123!';
const DEMO_API_KEY_NAME = 'public-demo-key';

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
  await prisma.role.upsert({ where: { code: 'user' }, update: { description: 'Regular User' }, create: { code: 'user', description: 'Regular User' } });

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
    { name: 'testimonials', description: 'Enable testimonials public API' },
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
  const userRole = await prisma.role.findUniqueOrThrow({ where: { code: 'user' } });

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: { tenantId: tenant.id, isActive: true },
    create: { tenantId: tenant.id, email: DEMO_ADMIN_EMAIL, passwordHash: hashPassword(DEMO_ADMIN_PASSWORD), isActive: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: admin.id },
    update: { firstName: 'Admin', lastName: 'Demo', bio: 'Administrator of the tenant' },
    create: { userId: admin.id, firstName: 'Admin', lastName: 'Demo', bio: 'Administrator of the tenant' }
  });

  const editor = await prisma.user.upsert({
    where: { email: DEMO_EDITOR_EMAIL },
    update: { tenantId: tenant.id, isActive: true },
    create: { tenantId: tenant.id, email: DEMO_EDITOR_EMAIL, passwordHash: hashPassword(DEMO_EDITOR_PASSWORD), isActive: true },
  });

  await prisma.userProfile.upsert({
    where: { userId: editor.id },
    update: { firstName: 'Editor', lastName: 'Demo', bio: 'Content Editor' },
    create: { userId: editor.id, firstName: 'Editor', lastName: 'Demo', bio: 'Content Editor' }
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

  // FAKE USERS
  const fakeUsersCount = 5;
  const fakeUsers = [];
  for (let i = 0; i < fakeUsersCount; i++) {
    const email = faker.internet.email();
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();
    
    // We update only tenantId if the user already exists to keep it idempotent and save time
    const user = await prisma.user.upsert({
      where: { email },
      update: { tenantId: tenant.id },
      create: { 
        tenantId: tenant.id, 
        email, 
        passwordHash: hashPassword('FakeUser123!'),
        isActive: true 
      },
    });

    await prisma.userProfile.upsert({
      where: { userId: user.id },
      update: { firstName, lastName, avatarUrl: faker.image.avatar(), bio: faker.person.bio() },
      create: { userId: user.id, firstName, lastName, avatarUrl: faker.image.avatar(), bio: faker.person.bio() }
    });

    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: user.id, roleId: userRole.id } },
      update: {},
      create: { userId: user.id, roleId: userRole.id },
    });
    
    fakeUsers.push(user);
  }

  // FAKE CATEGORIES AND TAGS
  const categories = ['General', 'Support', 'Sales', 'Product', 'Community'];
  const createdCats = [];
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: cat } },
      update: {},
      create: { tenantId: tenant.id, name: cat },
    });
    createdCats.push(c);
  }

  const tags = ['SaaS', 'B2B', 'Excellent', 'Fast', 'Bug', 'Feature Request'];
  const createdTags = [];
  for (const t of tags) {
    const tg = await prisma.tag.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: t } },
      update: {},
      create: { tenantId: tenant.id, name: t },
    });
    createdTags.push(tg);
  }

  // FAKE TESTIMONIALS
  const publishedStatus = await prisma.testimonialStatus.findUniqueOrThrow({ where: { code: 'published' } });
  
  for (let i = 0; i < 10; i++) {
    const authorName = faker.person.fullName();
    const content = faker.lorem.paragraph();
    const rating = faker.number.int({ min: 3, max: 5 });
    const score = rating * 20;

    const testimonial = await prisma.testimonial.findFirst({
      where: { tenantId: tenant.id, authorName, rating }
    });

    let testimonialId = testimonial?.id;
    if (!testimonialId) {
       const created = await prisma.testimonial.create({
        data: {
          tenantId: tenant.id,
          createdById: fakeUsers[faker.number.int({ min: 0, max: fakeUsers.length - 1 })].id,
          categoryId: createdCats[faker.number.int({ min: 0, max: createdCats.length - 1 })].id,
          authorName,
          content,
          rating,
          statusId: publishedStatus.id,
          score,
          publishedAt: new Date(),
          imageUrl: faker.datatype.boolean() ? faker.image.urlLoremFlickr({ category: 'people' }) : null
        },
      });
      testimonialId = created.id;
    }

    // Attach 2 random tags
    for(let j = 0; j < 2; j++) {
       const randomTag = createdTags[faker.number.int({ min: 0, max: createdTags.length - 1 })];
       await prisma.testimonialTag.upsert({
          where: { testimonialId_tagId: { testimonialId, tagId: randomTag.id } },
          update: {},
          create: { testimonialId, tagId: randomTag.id },
       });
    }
  }

  const analyticsFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_analytics' } });
  const webhooksFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_webhooks' } });
  const scoringFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'enable_scoring' } });
  const testimonialsFlag = await prisma.featureFlag.findUniqueOrThrow({ where: { name: 'testimonials' } });

  for (const featureFlagId of [analyticsFlag.id, webhooksFlag.id, scoringFlag.id, testimonialsFlag.id]) {
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
  console.log('Se generaron usuarios ficticios y testimonios usando Faker.');
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