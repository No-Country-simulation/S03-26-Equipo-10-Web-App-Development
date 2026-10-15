import { describe, expect, it, vi } from 'vitest';
import { getTestimonial, getTestimonialSummary, listTestimonials } from './api';
import { listCategories } from '@/features/catalog/api';

describe('global search adapters', () => {
  it('sends search, state, category, AND tags and sort to the server before pagination', async () => {
    const fetchApi = vi.fn().mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 2, limit: 20, total: 0 },
    });
    // New options are intentionally ignored by the baseline implementation.
    await listTestimonials(fetchApi, 2, {
      q: 'fuera de página',
      status: 'pending',
      categoryId: 'category',
      tagIds: ['one', 'two'],
      sort: 'score:desc',
    });
    const url = new URL(fetchApi.mock.calls[0][0], 'http://example.invalid');
    expect(url.searchParams.get('q')).toBe('fuera de página');
    expect(url.searchParams.getAll('tagIds')).toEqual(['one', 'two']);
    expect(url.searchParams.get('status')).toBe('pending');
    expect(url.searchParams.get('categoryId')).toBe('category');
    expect(url.searchParams.get('sort')).toBe('score:desc');
    expect(url.searchParams.get('page')).toBe('2');
  });
  it('requests catalog search globally', async () => {
    const fetchApi = vi.fn().mockResolvedValue({
      success: true,
      data: [],
      meta: { page: 1, limit: 10, total: 0 },
    });
    await listCategories(fetchApi, 1, 10, 'cohorte');
    expect(fetchApi.mock.calls[0][0]).toContain('q=cohorte');
  });
});

it('rejects malformed detail IDs without requesting a resource', () => {
  const fetchApi = vi.fn();
  expect(() => getTestimonial(fetchApi, 'not-a-uuid')).toThrow();
  expect(fetchApi).not.toHaveBeenCalled();
});
it('rejects inconsistent global summary totals', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: {
      total: 1,
      byStatus: {
        draft: 0,
        pending: 0,
        approved: 0,
        published: 0,
        rejected: 0,
      },
    },
  });
  await expect(getTestimonialSummary(fetchApi)).rejects.toThrow();
});

it('rejects a returned page that does not match the requested URL', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: [],
    meta: { page: 1, limit: 20, total: 50 },
  });
  await expect(listTestimonials(fetchApi, 2)).rejects.toThrow(
    'página diferente',
  );
});

it('rejects a detail response belonging to a different identifier', async () => {
  const fetchApi = vi.fn().mockResolvedValue({
    success: true,
    data: {
      id: '00000000-0000-4000-8000-000000000002',
      createdById: null,
      authorName: 'Autor sintético',
      content: 'Texto sintético de prueba',
      rating: 4,
      status: 'pending',
      score: 0,
      createdAt: '2026-10-15T00:00:00Z',
    },
  });
  await expect(
    getTestimonial(fetchApi, '00000000-0000-4000-8000-000000000001'),
  ).rejects.toThrow();
});
