import { z } from 'zod';
import {
  deletedSchema,
  sessionRequest,
  type SessionFetch,
} from '@/lib/api/validated-response';
import { pagePath, sessionPageRequest } from '@/features/shared/pagination';

export const userSchema = z
  .object({
    id: z.string(),
    tenantId: z.string(),
    email: z.string(),
    isActive: z.boolean(),
    roles: z.array(z.string()),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .passthrough();

export const listUsers = (fetchApi: SessionFetch, page = 1) =>
  sessionPageRequest(fetchApi, pagePath('/users', page), userSchema);
export type CreateUserInput = {
  email: string;
  password: string;
  role: 'admin' | 'editor';
};
export const createUser = (fetchApi: SessionFetch, input: CreateUserInput) =>
  sessionRequest(fetchApi, '/users', userSchema, {
    method: 'POST',
    body: JSON.stringify(input),
  });
export const deleteUser = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(
    fetchApi,
    `/users/${encodeURIComponent(id)}`,
    deletedSchema.extend({ id: z.literal(id), deleted: z.literal(true) }),
    { method: 'DELETE' },
  );

export const setUserActive = (
  fetchApi: SessionFetch,
  id: string,
  isActive: boolean,
) =>
  sessionRequest(
    fetchApi,
    `/users/${encodeURIComponent(id)}`,
    userSchema.refine((user) => user.id === id && user.isActive === isActive),
    { method: 'PATCH', body: JSON.stringify({ isActive }) },
  );
