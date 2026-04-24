import { PrismaClient } from '@prisma/client';
import { TestimonialRepository } from './apps/api/src/modules/testimonials/repositories/testimonial.repository';

async function main() {
  const prisma = new PrismaClient();
  const repo = new TestimonialRepository(prisma);
  
  const tenantId = 'b67a70f6-405c-4cc6-b3f4-5e0189c22f17';
  
  console.log('Testing findPublished for tenant:', tenantId);
  const result = await repo.findPublished(tenantId, {
    page: 1,
    limit: 20
  });

  console.log('Results count:', result.items.length);
  console.log('Total in DB:', result.total);
  
  if (result.items.length > 0) {
    console.log('Sample item status:', result.items[0].status);
  }

  await prisma.$disconnect();
}

main();
