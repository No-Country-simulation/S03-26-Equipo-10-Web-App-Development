import { config as loadEnv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
import { randomBytes, scryptSync } from 'node:crypto';

const DEMO_TENANT_NAME = 'Demo Tenant';
const DEMO_ADMIN_EMAIL = 'admin@demo.com';
const DEMO_ADMIN_PASSWORD = 'Admin123!';
const DEMO_EDITOR_EMAIL = 'editor@demo.com';
const DEMO_EDITOR_PASSWORD = 'Editor123!';
const DEMO_TESTIMONIAL_AUTHOR = 'Camila Diaz';

const envCandidates = [
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
];

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

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      'DATABASE_URL is missing. Copy .env.example to .env or apps/api/.env before running db:seed.',
    );
  }

  const adminRole = await prisma.role.upsert({
    where: { code: 'admin' },
    update: { description: 'Tenant administrator' },
    create: { code: 'admin', description: 'Tenant administrator' },
  });

  const editorRole = await prisma.role.upsert({
    where: { code: 'editor' },
    update: { description: 'Tenant editor' },
    create: { code: 'editor', description: 'Tenant editor' },
  });

  const permissions = [
    { code: 'create:testimonial', description: 'Create testimonials' },
    { code: 'approve:testimonial', description: 'Approve testimonials' },
    { code: 'publish:testimonial', description: 'Publish testimonials' },
    { code: 'manage:users', description: 'Manage tenant users' },
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission.code },
      update: { description: permission.description },
      create: permission,
    });
  }

  const statuses = ['draft', 'pending', 'approved', 'published', 'rejected'];
  for (const code of statuses) {
    await prisma.testimonialStatus.upsert({
      where: { code },
      update: {},
      create: { code },
    });
  }

  const tenant = await prisma.tenant.upsert({
    where: { name: DEMO_TENANT_NAME },
    update: {},
    create: { name: DEMO_TENANT_NAME },
  });

  const admin = await prisma.user.upsert({
    where: { email: DEMO_ADMIN_EMAIL },
    update: {
      tenantId: tenant.id,
      isActive: true,
      passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
    },
    create: {
      tenantId: tenant.id,
      email: DEMO_ADMIN_EMAIL,
      passwordHash: hashPassword(DEMO_ADMIN_PASSWORD),
      isActive: true,
    },
  });

  const editor = await prisma.user.upsert({
    where: { email: DEMO_EDITOR_EMAIL },
    update: {
      tenantId: tenant.id,
      isActive: true,
      passwordHash: hashPassword(DEMO_EDITOR_PASSWORD),
    },
    create: {
      tenantId: tenant.id,
      email: DEMO_EDITOR_EMAIL,
      passwordHash: hashPassword(DEMO_EDITOR_PASSWORD),
      isActive: true,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: admin.id,
        roleId: adminRole.id,
      },
    },
    update: {},
    create: {
      userId: admin.id,
      roleId: adminRole.id,
    },
  });

  await prisma.userRole.upsert({
    where: {
      userId_roleId: {
        userId: editor.id,
        roleId: editorRole.id,
      },
    },
    update: {},
    create: {
      userId: editor.id,
      roleId: editorRole.id,
    },
  });

  const publishedStatus = await prisma.testimonialStatus.findUniqueOrThrow({
    where: { code: 'published' },
  });

  const testimonial = await prisma.testimonial.findFirst({
    where: { tenantId: tenant.id, authorName: DEMO_TESTIMONIAL_AUTHOR },
  });

  if (!testimonial) {
    await prisma.testimonial.create({
      data: {
        tenantId: tenant.id,
        authorName: DEMO_TESTIMONIAL_AUTHOR,
        content: 'Excelente soporte, simple de integrar y muy util para ventas.',
        rating: 5,
        statusId: publishedStatus.id,
        score: 94.5,
        publishedAt: new Date(),
      },
    });
  }

  console.log('Seed completado.');
  console.log(`Tenant demo: ${DEMO_TENANT_NAME}`);
  console.log(`Admin demo: ${DEMO_ADMIN_EMAIL} / ${DEMO_ADMIN_PASSWORD}`);
  console.log(`Editor demo: ${DEMO_EDITOR_EMAIL} / ${DEMO_EDITOR_PASSWORD}`);
  console.log(`Testimonio demo: ${DEMO_TESTIMONIAL_AUTHOR}`);
  console.log(`Estados cargados: ${statuses.join(', ')}`);
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
