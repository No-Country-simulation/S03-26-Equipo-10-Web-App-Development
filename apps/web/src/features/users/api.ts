import { z } from 'zod';
import { deletedSchema, sessionRequest, type SessionFetch } from '@/lib/api/validated-response';

export const userSchema = z.object({
  id: z.string(), tenantId: z.string(), email: z.string(), isActive: z.boolean(),
  roles: z.array(z.string()), createdAt: z.string(), updatedAt: z.string(),
}).passthrough();

export const listUsers = (fetchApi: SessionFetch) => sessionRequest(fetchApi, '/users', z.array(userSchema));
export const createUser = (fetchApi: SessionFetch, input: object) =>
  sessionRequest(fetchApi, '/users', userSchema, { method: 'POST', body: JSON.stringify(input) });
export const deleteUser = (fetchApi: SessionFetch, id: string) =>
  sessionRequest(fetchApi, `/users/${id}`, deletedSchema, { method: 'DELETE' });
