import { PrismaClient, Role, TestimonialStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: 'admin@testimonial.local' },
    update: {},
    create: {
      email: 'admin@testimonial.local',
      name: 'Admin Demo',
      role: Role.ADMIN,
    },
  });

  await prisma.testimonial.upsert({
    where: { id: 'seed-testimonial-1' },
    update: {},
    create: {
      id: 'seed-testimonial-1',
      authorName: 'Camila Diaz',
      authorRole: 'Product Manager',
      company: 'North Studio',
      content:
        'El equipo pudo centralizar aprobaciones y publicar testimonios mucho más rápido.',
      status: TestimonialStatus.PUBLISHED,
      publishedAt: new Date(),
      createdById: admin.id,
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
