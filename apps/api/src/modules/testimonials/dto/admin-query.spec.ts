import { parseCatalogQuery, parseTestimonialQuery } from './admin-query';

describe('administrative search query', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  it('preserves legacy pagination and trims search', () => {
    expect(parseTestimonialQuery({ page: '2', q: '  equipo  ' })).toEqual({
      page: 2,
      limit: 20,
      q: 'equipo',
    });
    expect(parseCatalogQuery({})).toEqual({ page: 1, limit: 20 });
  });
  it('accepts AND tag IDs and deduplicates them', () => {
    expect(
      parseTestimonialQuery({
        tagIds: [id, id],
        status: 'pending',
        sort: 'score:desc',
      }),
    ).toMatchObject({ tagIds: [id], status: 'pending', sort: 'score:desc' });
  });
  it.each([
    { q: ['a', 'b'] },
    { q: 'a'.repeat(201) },
    { status: 'unknown' },
    { sort: 'rating' },
    { categoryId: 'other' },
    { tagIds: ['bad'] },
    { tagIds: Array(21).fill(id) },
    { page: '0' },
  ])('rejects malformed input %j', (query) => {
    expect(() => parseTestimonialQuery(query)).toThrow();
  });
});
