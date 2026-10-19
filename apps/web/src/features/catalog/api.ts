import { z } from 'zod';
import {
  deletedSchema,
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
import { pagePath, sessionPageRequest } from '@/features/shared/pagination';

export const categorySchema = z
  .object({
    id: z.string(),
    name: z.string(),
    tenantId: z.string(),
    testimonialCount: z.number().int().nonnegative().optional(),
  })
  .passthrough();
export const tagSchema = categorySchema;

export const listCategories = (
  fetchApi: SessionFetch,
  page = 1,
  limit = 20,
  q = '',
) =>
  sessionPageRequest(
    fetchApi,
    `${pagePath('/categories', page, limit)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
    categorySchema,
  );
export const listTags = (
  fetchApi: SessionFetch,
  page = 1,
  limit = 20,
  q = '',
) =>
  sessionPageRequest(
    fetchApi,
    `${pagePath('/tags', page, limit)}${q.trim() ? `&q=${encodeURIComponent(q.trim())}` : ''}`,
    tagSchema,
  );
export const createCategory = (fetchApi: SessionFetch, name: string) =>
  sessionRequest(fetchApi, '/categories', categorySchema, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
export const createTag = (fetchApi: SessionFetch, name: string) =>
  sessionRequest(fetchApi, '/tags', tagSchema, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
export const deleteCategory = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/categories/${encodeURIComponent(id)}`,
    deletedSchema.extend({ id: z.literal(id), deleted: z.literal(true) }),
    {
      method: 'DELETE',
    },
  );
export const deleteTag = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/tags/${encodeURIComponent(id)}`,
    deletedSchema.extend({ id: z.literal(id), deleted: z.literal(true) }),
    { method: 'DELETE' },
  );

export const renameCategory = (
  fetchApi: SessionFetch,
  id: string,
  name: string,
) =>
  sessionRequest(
    fetchApi,
    `/categories/${encodeURIComponent(id)}`,
    categorySchema.refine((item) => item.id === id && item.name === name),
    { method: 'PATCH', body: JSON.stringify({ name }) },
  );
export const renameTag = (fetchApi: SessionFetch, id: string, name: string) =>
  sessionRequest(
    fetchApi,
    `/tags/${encodeURIComponent(id)}`,
    tagSchema.refine((item) => item.id === id && item.name === name),
    { method: 'PATCH', body: JSON.stringify({ name }) },
  );
