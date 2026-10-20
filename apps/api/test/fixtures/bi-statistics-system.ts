import type { createBiSystem } from './bi-system-environment';

/** Two observable synthetic taxonomies with independent tenants and directional association counts. */
export async function seedBiStatisticsSource(
  system: Awaited<ReturnType<typeof createBiSystem>>,
) {
  for (const { company } of system.users) {
    await system.source.testimonial.createMany({
      data: Array.from({ length: 99 }, () => ({
        tenantId: company.id,
        content: 'Private synthetic content excluded from BI',
        authorName: 'Private synthetic author',
        rating: 2,
        statusId: 5,
      })),
    });
    const ids = await system.source.testimonial.findMany({
      where: { tenantId: company.id },
      orderBy: { id: 'asc' },
      select: { id: true },
    });
    const tags = (
      await Promise.all(
        ['A', 'B'].map((name) =>
          system.source.tag.create({
            data: {
              tenantId: company.id,
              name: `=Tema ${name} ${company.name}`,
            },
          }),
        ),
      )
    ).sort((a, b) => a.id.localeCompare(b.id));
    await system.source.testimonialTag.createMany({
      data: ids.flatMap((row, i) => [
        ...(i < 40
          ? [
              {
                tenantId: company.id,
                testimonialId: row.id,
                tagId: tags[0]!.id,
              },
            ]
          : []),
        ...(i >= 30 && i < 50
          ? [
              {
                tenantId: company.id,
                testimonialId: row.id,
                tagId: tags[1]!.id,
              },
            ]
          : []),
      ]),
    });
  }
}
