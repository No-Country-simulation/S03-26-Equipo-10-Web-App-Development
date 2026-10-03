import { z } from 'zod';
import { deletedSchema, sessionRequest, type SessionFetch } from '@/lib/api/validated-response';
import { pagePath, paginatedSchema } from '@/features/shared/pagination';

export const categorySchema = z.object({ id: z.string(), name: z.string(), tenantId: z.string() }).passthrough();
export const tagSchema = categorySchema;

export const listCategories = (fetchApi: SessionFetch, page = 1, limit = 20) =>
  sessionRequest(fetchApi, pagePath('/categories', page, limit), paginatedSchema(categorySchema));
export const listTags = (fetchApi: SessionFetch, page = 1, limit = 20) =>
  sessionRequest(fetchApi, pagePath('/tags', page, limit), paginatedSchema(tagSchema));
export const createCategory = (fetchApi: SessionFetch, name: FormDataEntryValue | null) =>
  sessionRequest(fetchApi, '/categories', categorySchema, { method: 'POST', body: JSON.stringify({ name }) });
export const createTag = (fetchApi: SessionFetch, name: FormDataEntryValue | null) =>
  sessionRequest(fetchApi, '/tags', tagSchema, { method: 'POST', body: JSON.stringify({ name }) });
export const deleteCategory = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/categories/${id}`, deletedSchema, { method: 'DELETE' });
export const deleteTag = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/tags/${id}`, deletedSchema, { method: 'DELETE' });
