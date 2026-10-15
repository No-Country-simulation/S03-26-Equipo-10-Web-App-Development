import { describe, expect, it } from 'vitest';
import { readTestimonialLocation, testimonialLocation } from './query';
const id = '00000000-0000-4000-8000-000000000001';
describe('testimonial URLs', () => {
  it('roundtrips search, AND tags, category, state, ordering, page and detail', () => {
    const href = testimonialLocation(
      3,
      {
        q: 'Atención & equipo',
        status: 'pending',
        categoryId: id,
        tagIds: [id],
        sort: 'score:desc',
      },
      id,
    );
    expect(readTestimonialLocation(href.split('?')[1])).toEqual({
      valid: true,
      page: 3,
      testimonial: id,
      filters: {
        q: 'Atención & equipo',
        status: 'pending',
        categoryId: id,
        tagIds: [id],
        sort: 'score:desc',
      },
    });
  });
  it.each([
    'page=0',
    'page=1.0',
    'page=1e2',
    'page=10001',
    'status=unknown',
    'testimonial=invalid',
    'categoryId=invalid',
    'q=a&q=b',
    'sort=rating',
    'tagIds=bad',
  ])('rejects malformed location %s', (url) =>
    expect(readTestimonialLocation(url).valid).toBe(false),
  );
});
