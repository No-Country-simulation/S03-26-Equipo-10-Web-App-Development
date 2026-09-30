import { z } from 'zod';
import { deletedSchema, sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

export const categorySchema = z.object({ id: z.string(), name: z.string(), tenantId: z.string() }).passthrough();
export const tagSchema = categorySchema;

export const listCategories = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/categories', z.array(categorySchema));
export const listTags = (fetchApi: SessionFetch) =>
  sessionRequest(fetchApi, '/tags', z.array(tagSchema));
export const createCategory = (fetchApi: SessionFetch, name: FormDataEntryValue | null) =>
  sessionRequest(fetchApi, '/categories', categorySchema, { method: 'POST', body: JSON.stringify({ name }) });
export const createTag = (fetchApi: SessionFetch, name: FormDataEntryValue | null) =>
  sessionRequest(fetchApi, '/tags', tagSchema, { method: 'POST', body: JSON.stringify({ name }) });
export const deleteCategory = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/categories/${id}`, deletedSchema, { method: 'DELETE' });
export const deleteTag = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/tags/${id}`, deletedSchema, { method: 'DELETE' });
